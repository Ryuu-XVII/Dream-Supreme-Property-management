import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// These assertions guard authorization rules that were found broken during a
// commission audit (see documentation/technical/DATABASE_SCHEMA_AND_RLS.md
// §16). They read the migrations rather than the database so they run in CI
// without credentials, and so a future migration that reintroduces the defect
// fails the build.

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(prefix: string): string {
  const file = readdirSync(MIGRATIONS_DIR).find((name) => name.startsWith(prefix));
  if (!file) throw new Error(`No migration found starting with ${prefix}`);
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

function allMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }));
}

describe("only administrators can set commission", () => {
  const sql = readMigration("20260818000008");

  it("forces a non-administrator's mandate to the agency default rate on insert", () => {
    // create_mandate took commissionRateBps straight from the client payload,
    // and the mandate's rate overrides the administrator's rule set inside
    // calculate_deal_commission.
    expect(sql).toContain("create or replace function public.enforce_admin_only_commission_rate");
    expect(sql).toMatch(/new\.commission_rate_bps\s*:=\s*coalesce\(v_default_bps, 500\)/);
  });

  it("refuses a non-administrator's change to an existing rate", () => {
    expect(sql).toMatch(
      /new\.commission_rate_bps is distinct from old\.commission_rate_bps[\s\S]*?raise exception/,
    );
  });

  it("fires on both insert and update so no write path is missed", () => {
    // A trigger rather than a guard inside create_mandate, so a direct
    // PostgREST insert or a bulk import is covered too.
    expect(sql).toMatch(/before insert or update on public\.mandate/);
  });

  it("decides admin status with is_manager(), which cannot return NULL", () => {
    expect(sql).toContain("public.is_manager()");
  });
});

describe("commission guards fail closed for a caller with no active account", () => {
  // get_current_role() returns NULL for a suspended agent whose JWT is still
  // valid, or someone who signed up without accepting an invitation.
  // `NULL not in (...)` is NULL, not true, so an unguarded comparison falls
  // through instead of raising.
  const sql = readMigration("20260818000008");

  it.each(["calculate commission", "change commission rules"])(
    "coalesces the role before comparing it (%s)",
    (message) => {
      const guard = new RegExp(
        `coalesce\\(public\\.get_current_role\\(\\)::text, ''\\) not in \\('admin', 'admin_agent'\\)[\\s\\S]{0,120}${message}`,
      );
      expect(sql).toMatch(guard);
    },
  );

  it("leaves no commission guard comparing an uncoalesced role", () => {
    // Any migration that reintroduces the bare form for a commission function
    // should fail here rather than ship.
    const offenders = allMigrations().filter(
      ({ name, sql: body }) =>
        // Only the migrations that define the two commission RPCs matter; the
        // fix supersedes their earlier definitions.
        Number(name.slice(0, 14)) > 20260818000008 &&
        /public\.get_current_role\(\) not in \('admin', 'admin_agent'\)/.test(body) &&
        /(save_commission_rule_set|calculate_deal_commission)/.test(body),
    );

    expect(offenders.map((o) => o.name)).toEqual([]);
  });
});

describe("an agent may only see their own Fidelity Fund Certificate", () => {
  const sql = readMigration("20260818000009");

  it("drops the agency-wide policy that overrode the stricter one", () => {
    // Postgres ORs permissive policies, so "Agency FFCs are readable" made
    // "Users view own or agency FFCs" have no effect at all.
    expect(sql).toContain('drop policy if exists "Agency FFCs are readable"');
  });

  it("does not recreate a role-free read policy on the table", () => {
    const recreated = allMigrations().filter(
      ({ name, sql: body }) =>
        Number(name.slice(0, 14)) >= 20260818000009 &&
        /create policy[\s\S]{0,200}on public\.ffc_certificate[\s\S]{0,400}for select/i.test(body) &&
        !/get_current_user_account_id\(\)/.test(body),
    );

    expect(recreated.map((o) => o.name)).toEqual([]);
  });
});

describe("removing a Property24 link clears the data it brought in", () => {
  const sql = readMigration("20260818000007");

  it("deletes the cached listings and clears the cached profile", () => {
    expect(sql).toContain("delete from public.agent_property24_listing");
    expect(sql).toMatch(/new\.property24_profile\s*:=\s*null/);
    expect(sql).toMatch(/new\.property24_synced_at\s*:=\s*null/);
  });

  it("only acts on the transition from a set URL to NULL", () => {
    // Not on every profile save.
    expect(sql).toMatch(/new\.property24_url is null and old\.property24_url is not null/);
  });
});
