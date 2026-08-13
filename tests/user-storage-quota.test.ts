import { describe, it, expect, vi, afterEach } from "vitest";
import { DEFAULT_USER_STORAGE_LIMIT_BYTES, uploadFileToR2 } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

describe("Per-Agent Storage Isolation & Quota Limits", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults user storage quota to 1GB (1,073,741,824 bytes)", () => {
    expect(DEFAULT_USER_STORAGE_LIMIT_BYTES).toBe(1024 * 1024 * 1024);
  });

  it("rejects uploads that exceed the user's storage quota limit", async () => {
    const currentUsed = 1010 * 1024 * 1024; // 1010 MB used
    const limit = 1024 * 1024 * 1024; // 1 GB limit
    const mockFile = {
      size: 15 * 1024 * 1024, // 15 MB file, under the 20MB per-file cap
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

    // uploadFileToR2 always goes through Supabase Storage now (see src/lib/storage.ts);
    // stub it so this quota-logic test doesn't depend on a live, authenticated session.
    vi.spyOn(supabase.storage, "from").mockReturnValue({
      upload: async (path: string) => ({ data: { path }, error: null }),
    } as unknown as ReturnType<typeof supabase.storage.from>);

    await expect(
      uploadFileToR2(newFile, "users/agent-1/small.pdf", {
        currentStorageUsedBytes: currentUsed,
        storageLimitBytes: limit,
      }),
    ).resolves.toBe("users/agent-1/small.pdf");
  });
});
