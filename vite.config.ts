import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [tailwindcss(), TanStackRouterVite({ autoCodeSplitting: true }), react()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 8080,
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
});
