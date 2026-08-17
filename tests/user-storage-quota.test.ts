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
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const mockFile = {
      size: 15 * 1024 * 1024, // 15 MB file, under the 20MB per-file cap
      type: "application/pdf",
      arrayBuffer: async () => pdfHeader.buffer,
      slice: () => ({ arrayBuffer: async () => pdfHeader.buffer }),
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
    const newFile = new File(["%PDF-1.4 small content"], "small.pdf", {
      type: "application/pdf",
    });

    // uploadFileToR2 always goes through the r2-storage Edge Function now (see
    // src/lib/storage.ts). `supabase.functions` is a getter that returns a fresh
    // FunctionsClient on every access, so the getter itself must be stubbed for the
    // mock to actually intercept the real call.
    const functionsDescriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(supabase),
      "functions",
    );
    Object.defineProperty(supabase, "functions", {
      configurable: true,
      get: () => ({
        invoke: async (_name: string, opts: any) =>
          opts.body.action === "presign-put"
            ? {
                data: {
                  url: "https://accountid.r2.cloudflarestorage.com/bucket/small.pdf",
                  key: opts.body.key,
                },
                error: null,
              }
            : { data: { error: "unexpected action" }, error: null },
      }),
    });
    const realFetch = globalThis.fetch.bind(globalThis);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("r2.cloudflarestorage.com")) return new Response(null, { status: 200 });
      return realFetch(input as any, init);
    });

    try {
      await expect(
        uploadFileToR2(newFile, "users/agent-1/small.pdf", {
          currentStorageUsedBytes: currentUsed,
          storageLimitBytes: limit,
        }),
      ).resolves.toBe("users/agent-1/small.pdf");
    } finally {
      if (functionsDescriptor) {
        Object.defineProperty(supabase, "functions", functionsDescriptor);
      } else {
        delete (supabase as any).functions;
      }
    }
  });
});
