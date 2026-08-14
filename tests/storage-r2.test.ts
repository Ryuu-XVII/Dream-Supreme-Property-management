import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uploadFileToR2,
  getR2FileUrl,
  removeStoredFile,
  MAX_SINGLE_FILE_BYTES,
  getR2Client,
} from "@/lib/storage";
import { supabase } from "@/lib/supabase";

describe("Cloudflare R2 Storage Adapter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns null for getR2Client when env vars are missing", () => {
    delete process.env.VITE_R2_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    expect(getR2Client()).toBeNull();
  });

  it("throws an error when uploaded file exceeds 20MB max limit", async () => {
    const oversizedBlob = {
      size: MAX_SINGLE_FILE_BYTES + 1,
      type: "application/pdf",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File;

    await expect(uploadFileToR2(oversizedBlob, "test/oversized.pdf")).rejects.toThrow(
      /exceeds the maximum allowable limit of 20MB/,
    );
  });

  it("throws an error when uploaded file type is not in the allowed list", async () => {
    const disallowedFile = {
      size: 1024,
      type: "application/zip",
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File;

    await expect(uploadFileToR2(disallowedFile, "test/archive.zip")).rejects.toThrow(
      /is not supported/,
    );
  });

  it("successfully falls back to Supabase storage when R2 credentials are not set", async () => {
    delete process.env.VITE_R2_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;

    vi.spyOn(supabase.storage, "from").mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: "mandates/doc.pdf" }, error: null }),
      createSignedUrl: vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://example.com/test.pdf" }, error: null }),
      remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const dummyFile = new File(["%PDF-1.4 test content"], "doc.pdf", {
      type: "application/pdf",
    });
    const uploadedPath = await uploadFileToR2(dummyFile, "mandates/doc.pdf");
    expect(uploadedPath).toBe("mandates/doc.pdf");

    const signedUrl = await getR2FileUrl("mandates/doc.pdf");
    expect(signedUrl).toContain("https://example.com/test.pdf");

    await expect(removeStoredFile("mandates/doc.pdf")).resolves.not.toThrow();
  });

  it("returns empty string when key is empty or null for getR2FileUrl", async () => {
    expect(await getR2FileUrl(null)).toBe("");
    expect(await getR2FileUrl("")).toBe("");
  });

  it("returns original URL if key is already an HTTP or HTTPS link", async () => {
    const fullUrl = "https://r2.cloudflare.com/my-bucket/doc.pdf";
    expect(await getR2FileUrl(fullUrl)).toBe(fullUrl);
  });
});
