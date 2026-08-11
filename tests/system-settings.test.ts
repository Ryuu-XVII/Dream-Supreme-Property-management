import { describe, it, expect } from "vitest";
import { defaultSystemSettings } from "@/data/system-settings";

describe("System Governance & Storage Settings Data Layer", () => {
  it("defines default system governance settings with valid defaults", () => {
    expect(defaultSystemSettings.globalStorageQuotaMb).toBe(1024);
    expect(defaultSystemSettings.maxFileUploadMb).toBe(50);
    expect(defaultSystemSettings.sessionTimeoutMinutes).toBe(60);
    expect(defaultSystemSettings.enforceMfa).toBe(true);
    expect(defaultSystemSettings.requireAdminApproval).toBe(true);
    expect(defaultSystemSettings.idleAgentDays).toBe(90);
    expect(defaultSystemSettings.dealArchiveDays).toBe(365);
    expect(defaultSystemSettings.recycleBinRetentionDays).toBe(30);
  });
});
