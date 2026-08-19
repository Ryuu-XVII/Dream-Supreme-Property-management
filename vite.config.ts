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
  },
  test: {
    // workers/property24-sync is its own npm package with its own
    // dependencies (cheerio, etc.) and its own test script — the root
    // Vitest run must not try to import its tests without them installed.
    exclude: [...configDefaults.exclude, "workers/**"],
  },
});
