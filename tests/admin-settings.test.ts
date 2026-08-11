import { describe, it, expect } from "vitest";
import { Route } from "@/routes/admin/settings";

describe("Admin System Settings Hub Route", () => {
  it("exports a valid TanStack createFileRoute route component", () => {
    expect(Route).toBeDefined();
    expect(Route.options?.component).toBeDefined();
  });
});
