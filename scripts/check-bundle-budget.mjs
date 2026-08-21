#!/usr/bin/env node
// Fails when (a) the app's eagerly-loaded JS/CSS — everything downloaded on
// first paint, before any route loads — grows past a fixed budget, or
// (b) any individual route's own marginal cost (what visiting that specific
// route downloads beyond the eager baseline) exceeds its budget.
//
// Both checks exist because of the same failure mode, caught twice by real
// examples in this codebase: a heavy dependency landing in a bundle that
// doesn't need it because an import wasn't deferred.
//   - (a) guards against something becoming globally eager — the bug
//     already found and fixed for the PDF template designer, which is ~4MB
//     via @pdfme/ui and only safe to ship because it's behind React.lazy()
//     (src/routes/admin/pdf-templates/$documentType.tsx).
//   - (b) guards against a single route quietly absorbing another route's
//     weight through a shared, non-lazy module — which is live in this
//     codebase today: src/data/pdf-generate.ts statically imports
//     @pdfme/generator (~860KB gzipped, pulling in clawpdf/canvg/
//     html2canvas for PDF-to-image conversion) despite its own comment
//     saying it's kept lightweight on purpose, so every route that can
//     generate a PDF (documents.tsx, rentals/index.tsx's lease wizard,
//     reports/$report.tsx, admin/compliance/ffc.tsx) pays that cost on
//     render, not on click. Each is allow-listed below with a budget that
//     accounts for it rather than silently passing — see
//     documentation/technical/DATABASE_SCHEMA_AND_RLS.md §31 for the fix.
//
// Reads Vite's build manifest (dist/.vite/manifest.json, enabled via
// build.manifest in vite.config.ts) and only follows static `imports`,
// never `dynamicImports` (route-split/lazy chunks) — that's the exact
// distinction between "downloads now" and "downloads if you go there."
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const EAGER_BUDGET_GZIP_KB = 600;

// Per-route marginal budget in gzipped KB. `default` applies to any route
// chunk not listed explicitly. Routes below are the ones that genuinely
// need to be heavier than default, each with a one-line reason — anything
// not on this list is expected to stay under `default`.
const ROUTE_BUDGETS_GZIP_KB = {
  default: 250,
  // pdf-generate.ts's @pdfme/generator import (~860KB) — see file header.
  "src/routes/documents.tsx": 1150,
  "src/routes/rentals/index.tsx": 1150,
  "src/routes/reports/$report.tsx": 1150,
  "src/routes/admin/compliance/ffc.tsx": 1150,
  // @pdfme/ui designer (~1.4MB) — correctly React.lazy()'d, not in this
  // route's own `imports`, but still the single heaviest legitimate route.
  "src/routes/admin/pdf-templates/$documentType.tsx": 500,
  "src/routes/admin/pdf-templates/index.tsx": 500,
  // recharts.
  "src/routes/reports/index.tsx": 400,
  // @dnd-kit + the email block editor.
  "src/routes/admin/email-templates/$emailType.tsx": 300,
};

const manifestPath = fileURLToPath(new URL("../dist/.vite/manifest.json", import.meta.url));
const distDir = fileURLToPath(new URL("../dist/", import.meta.url));

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (err) {
  console.error(`Could not read ${manifestPath} — run \`npm run build\` first.`, err.message);
  process.exit(1);
}

function fileSizeGzip(file) {
  const path = new URL(file, `file://${distDir.replace(/\\/g, "/")}`);
  if (!existsSync(path)) return 0;
  return gzipSync(readFileSync(path)).length;
}

// Collects every manifest key reachable from `key` via static `imports`
// (and, if includeDynamic, `dynamicImports` too) into `into`.
function collect(key, into, includeDynamic = false) {
  if (into.has(key)) return;
  const chunk = manifest[key];
  if (!chunk) return;
  into.add(key);
  for (const imp of chunk.imports ?? []) collect(imp, into, includeDynamic);
  if (includeDynamic) {
    for (const imp of chunk.dynamicImports ?? []) collect(imp, into, includeDynamic);
  }
}

function gzipTotal(keys) {
  const files = new Set();
  for (const key of keys) {
    const chunk = manifest[key];
    if (!chunk) continue;
    if (chunk.file) files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
  }
  let total = 0;
  for (const file of files) total += fileSizeGzip(file);
  return total;
}

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entryKey) {
  console.error("No entry chunk (isEntry: true) found in the Vite manifest.");
  process.exit(1);
}

const eagerKeys = new Set();
collect(entryKey, eagerKeys);
const eagerGzipKb = gzipTotal(eagerKeys) / 1024;

console.log(
  `Eager (non-lazy) bundle: ${eagerKeys.size} chunks, ${eagerGzipKb.toFixed(1)} KB gzipped`,
);
console.log(`  budget: ${EAGER_BUDGET_GZIP_KB} KB`);

let failed = false;
if (eagerGzipKb > EAGER_BUDGET_GZIP_KB) {
  failed = true;
  console.error(
    `  ❌ Exceeds budget by ${(eagerGzipKb - EAGER_BUDGET_GZIP_KB).toFixed(1)} KB. ` +
      "Something that should be lazy-loaded (React.lazy() + Suspense, or a dynamic import()) " +
      "is being statically imported into the main bundle instead.",
  );
} else {
  console.log("  ✅ Within budget.");
}

console.log(
  "\nPer-route marginal cost (what visiting each route downloads beyond the eager bundle):",
);
const routeKeys = Object.keys(manifest).filter(
  (k) => k.startsWith("src/routes/") && k.endsWith("?tsr-split=component"),
);
const routeResults = routeKeys
  .map((key) => {
    const sourcePath = key.replace(/\?tsr-split=component$/, "");
    const closure = new Set();
    collect(key, closure);
    const marginalKeys = [...closure].filter((k) => !eagerKeys.has(k));
    const gzipKb = gzipTotal(marginalKeys) / 1024;
    const budget = ROUTE_BUDGETS_GZIP_KB[sourcePath] ?? ROUTE_BUDGETS_GZIP_KB.default;
    return { sourcePath, gzipKb, budget };
  })
  .sort((a, b) => b.gzipKb - a.gzipKb);

for (const r of routeResults) {
  const over = r.gzipKb > r.budget;
  if (over) failed = true;
  const marker = over ? "❌" : r.gzipKb > r.budget * 0.8 ? "⚠️ " : "  ";
  console.log(
    `  ${marker} ${r.gzipKb.toFixed(1).padStart(8)} / ${String(r.budget).padStart(4)} KB  ${r.sourcePath}`,
  );
}

if (failed) {
  console.error(
    "\n❌ One or more budgets exceeded. If a route legitimately needs to be heavier " +
      "(a real new feature, not an accidental import), add it to ROUTE_BUDGETS_GZIP_KB in " +
      "scripts/check-bundle-budget.mjs with a comment explaining why. Otherwise, defer the " +
      "heavy import (dynamic import() inside the function that needs it, not a top-level import).",
  );
  process.exit(1);
}
console.log("\n✅ All routes within budget.");
