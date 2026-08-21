import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [tailwindcss(), TanStackRouterVite({ autoCodeSplitting: true }), react()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    // Emits dist/.vite/manifest.json (chunk graph with isEntry/imports/
    // dynamicImports) so scripts/check-bundle-budget.mjs can tell an
    // eagerly-loaded chunk from a lazy one — the distinction that made the
    // PDF template designer's ~4MB bundle fine to ship (see
    // src/routes/admin/pdf-templates/$documentType.tsx's React.lazy()) but
    // would be a real regression if a future change pulled it into the
    // chunks every page pays for on load.
    manifest: true,
  },
  test: {
    // workers/property24-sync is its own npm package with its own
    // dependencies (cheerio, etc.) and its own test script — the root
    // Vitest run must not try to import its tests without them installed.
    exclude: [...configDefaults.exclude, "workers/**"],
  },
});
