import { defineConfig } from "vitest/config";

// Without a config of its own, vitest walks up and picks the repository root's
// vite.config.ts, whose TanStack Router plugin then tries to scan a src/routes
// directory that does not exist in this package. The tests still ran, but
// every invocation printed an ENOENT stack trace first.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
