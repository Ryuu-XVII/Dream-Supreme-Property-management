#!/usr/bin/env node
// Fails when the linked Supabase project's `public` schema contains anything
// the migrations in this repo would not reproduce.
//
// This exists because production silently drifted from source control: 19
// functions -- several of them authorization logic (is_manager,
// can_access_deal, protect_user_account_sensitive_fields, prevent_hard_delete)
// -- had been applied directly to the database and existed in no migration. A
// `db reset` would not have rebuilt them, and any later `create or replace`
// written against the repo copy would have silently reverted a security fix.
// See supabase/migrations/20260818000006_reconcile_live_drift.sql.
//
// Requires SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD, plus a linked
// project (SUPABASE_PROJECT_ID or supabase/.temp/project-ref).
import { execFileSync } from "node:child_process";

// `supabase db diff` always re-emits every privilege as a `revoke all ...`
// immediately followed by a `grant` of the same privileges. That is a
// restatement of current state, not a difference, and it never goes away --
// so treating it as drift would make this check fail permanently.
const NOISE = [/^set\s+local\s/i, /^revoke\s+all\s+on\s/i, /^grant\s+[a-z, ]+\s+on\s/i];

function runDiff() {
  // shell: true so this resolves npx.cmd on Windows as well as npx on CI.
  const raw = execFileSync("npx supabase db diff --linked --schema public", {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
    shell: true,
  });

  // Newer CLI versions wrap the result as {"diff": "..."}; older ones print
  // bare SQL after the "Applying migration ..." progress lines.
  const jsonStart = raw.indexOf('{"diff"');
  if (jsonStart !== -1) {
    return JSON.parse(raw.slice(jsonStart, raw.lastIndexOf("}") + 1)).diff ?? "";
  }
  return raw
    .split("\n")
    .filter((line) => !/^(Applying migration|Diffing schemas|Finished supabase)/.test(line))
    .join("\n");
}

// Splits on ";\n" like a naive tokenizer, except while inside a dollar-quoted
// block (e.g. a `CREATE FUNCTION ... AS $function$ ... $function$;` body),
// where ";\n" is just plpgsql, not a statement boundary. Without this, one
// function-body diff explodes into dozens of fake "statements" (its `begin;`,
// `end if;`, etc. lines), each innocently passing the NOISE filter below.
function splitStatements(diff) {
  const statements = [];
  let current = "";
  let dollarTag = null;
  for (let i = 0; i < diff.length; i++) {
    if (dollarTag === null) {
      const tagMatch = diff.slice(i).match(/^(\$[a-zA-Z_]*\$)/);
      if (tagMatch) {
        dollarTag = tagMatch[1];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
      if (diff.startsWith(";\n", i)) {
        statements.push(current);
        current = "";
        i += 1;
        continue;
      }
    } else if (diff.startsWith(dollarTag, i)) {
      current += dollarTag;
      i += dollarTag.length - 1;
      dollarTag = null;
      continue;
    }
    current += diff[i];
  }
  statements.push(current);
  return statements;
}

function significantStatements(diff) {
  return splitStatements(diff)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !NOISE.some((pattern) => pattern.test(statement)));
}

let diff;
try {
  diff = runDiff();
} catch (error) {
  console.error("Could not run `supabase db diff --linked`.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

const drift = significantStatements(diff);

if (drift.length === 0) {
  console.log("✅ No schema drift: the linked database matches supabase/migrations.");
  process.exit(0);
}

console.error(`❌ Schema drift detected — ${drift.length} statement(s) exist in the linked`);
console.error("   database but are not reproduced by supabase/migrations.\n");
for (const statement of drift.slice(0, 40)) {
  console.error(`${statement.split("\n")[0].slice(0, 160)};`);
}
if (drift.length > 40) console.error(`... and ${drift.length - 40} more`);
console.error(
  "\nCapture production into a migration rather than editing the database directly:\n" +
    "  npx supabase db diff --linked -f <describe_the_change>\n" +
    "Review it (production is usually the more-hardened side), then commit and push it.",
);
process.exit(1);
