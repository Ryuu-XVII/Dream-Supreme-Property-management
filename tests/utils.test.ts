import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn class merging utility", () => {
  it("combines class names into a single string", () => {
    expect(cn("flex", "items-center", "justify-between")).toBe("flex items-center justify-between");
  });

  it("handles conditional arguments correctly", () => {
    const isTrue = true;
    const isFalse = false;
    expect(
      cn("base-class", isTrue && "active-class", isFalse && "inactive-class", null, undefined),
    ).toBe("base-class active-class");
  });

  it("merges conflicting Tailwind CSS classes", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
  });

  it("supports array arguments", () => {
    expect(cn(["font-bold", "text-sm"], "text-red-500")).toBe("font-bold text-sm text-red-500");
  });
});
