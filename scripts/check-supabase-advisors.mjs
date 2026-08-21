#!/usr/bin/env node
// Fails when the live Supabase project has a security/performance advisor
// finding (WARN or ERROR level) that isn't in supabase/advisor-baseline.json.
//
// This exists because a real regression sat undetected for days: something
// re-granted EXECUTE on process_monthly_section_86_4_interest_allocation()
// (a SECURITY DEFINER function with no internal auth check, meant to run
// only from the monthly pg_cron job) directly against the live database,
// outside any migration — any logged-in user could have called it and
// posted real trust-account interest entries for any agency. A later
// "reconcile live drift" migration then captured that already-drifted grant
// back into version control, since drift-reconciliation can't distinguish
// "someone made a deliberate live change" from "a bug reopened." Nothing in
// CI ever looks at the live project between pushes, so this ran on a
// schedule (.github/workflows/supabase-advisor-check.yml), not just on
// push/PR. See documentation/technical/DATABASE_SCHEMA_AND_RLS.md §30.
//
// Requires SUPABASE_ACCESS_TOKEN (a personal/service access token, not the
// anon or service_role key) and SUPABASE_PROJECT_ID.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectId = process.env.SUPABASE_PROJECT_ID;

if (!accessToken || !projectId) {
  console.log(
    "::warning title=Advisor check skipped::Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID to enable it.",
  );
  process.exit(0);
}

const baselinePath = fileURLToPath(new URL("../supabase/advisor-baseline.json", import.meta.url));
const baseline = new Set(JSON.parse(readFileSync(baselinePath, "utf8")).baseline_cache_keys);

async function fetchLints(kind) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/advisors/${kind}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase advisor API (${kind}) returned ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  // Tolerate either a bare {lints: [...]} or a {result: {lints: [...]}} wrapper.
  return body.lints ?? body.result?.lints ?? [];
}

const [securityLints, performanceLints] = await Promise.all([
  fetchLints("security"),
  fetchLints("performance"),
]);
const allLints = [...securityLints, ...performanceLints];

const notable = allLints.filter((l) => l.level === "WARN" || l.level === "ERROR");
const newFindings = notable.filter((l) => !baseline.has(l.cache_key));

console.log(`Checked ${allLints.length} advisor findings (${notable.length} WARN/ERROR level).`);

if (newFindings.length === 0) {
  console.log("No findings outside the accepted baseline. ✅");
  process.exit(0);
}

console.log(`\n${newFindings.length} finding(s) not in supabase/advisor-baseline.json:\n`);
for (const l of newFindings) {
  console.log(`- [${l.level}] ${l.title}: ${l.detail}`);
  console.log(`  ${l.remediation ?? ""}`);
  console.log(`  cache_key: ${l.cache_key}\n`);
}
console.log(
  "If each of these is a deliberate, reviewed decision (not a regression), add its cache_key " +
    "to supabase/advisor-baseline.json. Otherwise, fix it.",
);
process.exit(1);
