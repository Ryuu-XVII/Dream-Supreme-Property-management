import { describe, expect, it } from "vitest";
import { STAGES, type Stage } from "@/types";

describe("STAGES pipeline stages configuration", () => {
  it("defines exactly 13 property transfer stages in order", () => {
    expect(STAGES.length).toBe(13);
    expect(STAGES[0]).toBe("Mandate Signed");
    expect(STAGES[12]).toBe("Commission Released");
  });

  it("includes all expected legal and conveyancing checkpoints", () => {
    expect(STAGES).toContain("Listed/Marketing");
    expect(STAGES).toContain("Offer Received");
    expect(STAGES).toContain("OTP Signed");
    expect(STAGES).toContain("Conditions Pending");
    expect(STAGES).toContain("Conveyancer Instructed");
    expect(STAGES).toContain("Compliance Certs");
    expect(STAGES).toContain("Transfer Duty");
    expect(STAGES).toContain("Rates & Levy Clearance");
    expect(STAGES).toContain("Documents & Guarantees");
    expect(STAGES).toContain("Lodged");
    expect(STAGES).toContain("Registered");
  });

  it("correctly identifies index progression", () => {
    const isCompletedStage = (stage: Stage) => STAGES.indexOf(stage) >= 11;
    const isPendingStage = (stage: Stage) =>
      STAGES.indexOf(stage) >= 4 && STAGES.indexOf(stage) < 11;

    expect(isCompletedStage("Registered")).toBe(true);
    expect(isCompletedStage("Commission Released")).toBe(true);
    expect(isCompletedStage("Mandate Signed")).toBe(false);

    expect(isPendingStage("Conditions Pending")).toBe(true);
    expect(isPendingStage("Rates & Levy Clearance")).toBe(true);
    expect(isPendingStage("Listed/Marketing")).toBe(false);
  });
});
