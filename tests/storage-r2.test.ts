import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uploadFileToR2,
  getR2FileUrl,
  removeStoredFile,
  MAX_SINGLE_FILE_BYTES,
  getR2Client,
} from "@/lib/storage";
import { supabase } from "@/lib/supabase";

// `supabase.functions` is a getter that returns a brand-new FunctionsClient on
// every access (unlike `supabase.storage`, which is a stable instance property),
// so `vi.spyOn(supabase.functions, "invoke")` only stubs a throwaway instance and
// never intercepts the real calls made from src/lib/storage.ts. Overriding the
// getter itself is what actually works.
function mockFunctionsInvoke(impl: (name: string, opts: any) => Promise<any>) {
  const invoke = vi.fn(impl);
  Object.defineProperty(supabase, "functions", {
    configurable: true,
    get: () => ({ invoke }),
  });
  return invoke;
}

describe("Cloudflare R2 Storage Adapter", () => {
  const originalEnv = process.env;
  const functionsDescriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(supabase),
    "functions",
  );

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    if (functionsDescriptor) {
      Object.defineProperty(supabase, "functions", functionsDescriptor);
    } else {
      delete (supabase as any).functions;
    }
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

  it("throws instead of falling back to Supabase storage when R2 is not configured", async () => {
    mockFunctionsInvoke(async () => ({ data: { error: "r2_not_configured" }, error: null }));
    const storageSpy = vi.spyOn(supabase.storage, "from");

    const dummyFile = new File(["%PDF-1.4 test content"], "doc.pdf", {
      type: "application/pdf",
    });
    await expect(uploadFileToR2(dummyFile, "mandates/doc.pdf")).rejects.toThrow(
      /Cloudflare R2 is not configured/,
    );
    await expect(getR2FileUrl("mandates/doc.pdf")).rejects.toThrow(
      /Cloudflare R2 is not configured/,
    );
    await expect(removeStoredFile("mandates/doc.pdf")).rejects.toThrow(
      /Cloudflare R2 is not configured/,
    );

    // Confirms no request ever reaches Supabase Storage as a silent fallback.
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("uploads real file bytes directly to Cloudflare R2 via a presigned URL when configured", async () => {
    const invokeSpy = mockFunctionsInvoke(async (_name, opts: any) => {
      if (opts.body.action === "presign-put") {
        return {
          data: {
            url: "https://accountid.r2.cloudflarestorage.com/bucket/mandates/doc.pdf?sig=x",
            key: "mandates/doc.pdf",
          },
          error: null,
        };
      }
      if (opts.body.action === "presign-get") {
        return {
          data: {
            url: "https://accountid.r2.cloudflarestorage.com/bucket/mandates/doc.pdf?sig=get",
          },
          error: null,
        };
      }
      if (opts.body.action === "delete") {
        return { data: { deleted: true }, error: null };
      }
      throw new Error(`Unexpected action ${opts.body.action}`);
    });

    const realFetch = globalThis.fetch.bind(globalThis);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.includes("r2.cloudflarestorage.com")) {
        return new Response(null, { status: 200 });
      }
      return realFetch(input as any, init);
    });

    const dummyFile = new File(["%PDF-1.4 test content"], "doc.pdf", {
      type: "application/pdf",
    });
    const uploadedPath = await uploadFileToR2(dummyFile, "mandates/doc.pdf");
    expect(uploadedPath).toBe("mandates/doc.pdf");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("r2.cloudflarestorage.com"),
      expect.objectContaining({ method: "PUT" }),
    );

    const signedUrl = await getR2FileUrl("mandates/doc.pdf");
    expect(signedUrl).toContain("r2.cloudflarestorage.com");

    await expect(removeStoredFile("mandates/doc.pdf")).resolves.not.toThrow();
    expect(invokeSpy).toHaveBeenCalled();
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
