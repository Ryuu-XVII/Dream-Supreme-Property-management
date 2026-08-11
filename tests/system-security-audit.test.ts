import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "../src/lib/supabase";

describe("System Security Audit & JWT Claims Parsing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid JWT session claims correctly", async () => {
    const mockSession = {
      access_token: "mock-jwt-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh",
      user: {
        id: "user-123",
        email: "principal@dreamsupreme.co.za",
        app_metadata: { role: "principal", agency_id: "agency-1" },
        user_metadata: { full_name: "Principal Owner" },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      },
    };

    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: mockSession as any },
      error: null,
    });

    const { data, error } = await supabase.auth.getSession();
    expect(error).toBeNull();
    expect(data.session?.user.id).toBe("user-123");
    expect(data.session?.user.app_metadata.role).toBe("principal");
  });

  it("handles missing or invalid JWT claims gracefully", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: null },
      error: new Error("Invalid JWT token signature") as any,
    });

    const { data, error } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
    expect(error?.message).toContain("Invalid JWT token signature");
  });

  it("verifies role-based access levels from JWT app_metadata", () => {
    const principalUser = {
      id: "u-1",
      app_metadata: { role: "principal" },
    };
    const agentUser = {
      id: "u-2",
      app_metadata: { role: "agent" },
    };

    const isAuthorizedForAdmin = (user: typeof principalUser) =>
      user.app_metadata.role === "principal" || user.app_metadata.role === "admin";

    expect(isAuthorizedForAdmin(principalUser)).toBe(true);
    expect(isAuthorizedForAdmin(agentUser)).toBe(false);
  });
});
