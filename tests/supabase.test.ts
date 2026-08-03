import { describe, expect, it } from "vitest";
import { supabase } from "@/lib/supabase";

describe("supabase client initialization", () => {
  it("exports a defined client instance with required methods", () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe("function");
    expect(typeof supabase.rpc).toBe("function");
    expect(typeof supabase.storage).toBe("object");
  });

  it("exposes storage bucket capabilities", () => {
    const bucket = supabase.storage.from("mandate-documents");
    expect(bucket).toBeDefined();
    expect(typeof bucket.upload).toBe("function");
  });
});
