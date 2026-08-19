import { describe, expect, it } from "vitest";
import { STAGES, type Stage } from "@/types";

describe("STAGES pipeline stages configuration", () => {
  it("defines exactly 7 property transfer stages in order", () => {
    expect(STAGES.length).toBe(7);
    expect(STAGES[0]).toBe("Listing & Negotiation");
    expect(STAGES[6]).toBe("Commission Released");
  });

  it("includes all expected legal and conveyancing checkpoints", () => {
    expect(STAGES).toContain("OTP Signed");
    expect(STAGES).toContain("Conditions Pending");
    expect(STAGES).toContain("Conveyancing");
    expect(STAGES).toContain("Lodged");
    expect(STAGES).toContain("Registered");
  });

  it("correctly identifies index progression", () => {
    const isCompletedStage = (stage: Stage) => STAGES.indexOf(stage) >= 5;
    const isPendingStage = (stage: Stage) =>
      STAGES.indexOf(stage) >= 2 && STAGES.indexOf(stage) < 5;

    expect(isCompletedStage("Registered")).toBe(true);
    expect(isCompletedStage("Commission Released")).toBe(true);
    expect(isCompletedStage("Listing & Negotiation")).toBe(false);

    expect(isPendingStage("Conditions Pending")).toBe(true);
    expect(isPendingStage("Conveyancing")).toBe(true);
    expect(isPendingStage("Listing & Negotiation")).toBe(false);
  });
});
