import { describe, it, expect } from "vitest";
import {
  getUserStoragePath,
  DEFAULT_USER_STORAGE_LIMIT_BYTES,
  uploadFileToR2,
  MAX_SINGLE_FILE_BYTES,
} from "@/lib/storage";

describe("Per-Agent Storage Isolation & Quota Limits", () => {
  it("generates isolated per-agent storage paths", () => {
    const userId = "agent-123-uuid";
    const path = getUserStoragePath(userId, "fica/identity-document.pdf");
    expect(path).toBe("users/agent-123-uuid/fica/identity-document.pdf");
  });

  it("does not duplicate users prefix if already present", () => {
    const userId = "agent-123-uuid";
    const existingPath = "users/agent-123-uuid/ffc/cert.pdf";
    expect(getUserStoragePath(userId, existingPath)).toBe("users/agent-123-uuid/ffc/cert.pdf");
  });

  it("defaults user storage quota to 1GB (1,073,741,824 bytes)", () => {
    expect(DEFAULT_USER_STORAGE_LIMIT_BYTES).toBe(1024 * 1024 * 1024);
  });

  it("rejects uploads that exceed the user's storage quota limit", async () => {
    const currentUsed = 990 * 1024 * 1024; // 990 MB used
    const limit = 1024 * 1024 * 1024; // 1 GB limit
    const mockFile = {
      size: 40 * 1024 * 1024, // 40 MB file
      type: "application/pdf",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File;

    await expect(
      uploadFileToR2(mockFile, "users/agent-1/document.pdf", {
        currentStorageUsedBytes: currentUsed,
        storageLimitBytes: limit,
      }),
    ).rejects.toThrow(/Storage quota exceeded/);
  });

  it("allows uploads within the assigned custom quota limit", async () => {
    const currentUsed = 500 * 1024 * 1024; // 500 MB used
    const limit = 2 * 1024 * 1024 * 1024; // 2 GB limit (upgraded by admin)
    const newFile = new File(["small content"], "small.pdf", {
      type: "application/pdf",
    });

    await expect(
      uploadFileToR2(newFile, "users/agent-1/small.pdf", {
        currentStorageUsedBytes: currentUsed,
        storageLimitBytes: limit,
      }),
    ).resolves.toBe("users/agent-1/small.pdf");
  });
});
