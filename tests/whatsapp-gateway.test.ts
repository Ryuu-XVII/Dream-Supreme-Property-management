import { describe, it, expect } from "vitest";
import { formatE164Phone } from "../src/services/whatsappGatewayService";

describe("WhatsApp Business API Gateway (Pillar 1)", () => {
  it("formats local South African phone numbers to standard E.164 format", () => {
    const formatted = formatE164Phone("082 123 4567");
    expect(formatted).toBe("27821234567");
  });

  it("preserves pre-formatted international numbers cleanly", () => {
    const formatted = formatE164Phone("+27 82 999 8888");
    expect(formatted).toBe("27829998888");
  });
});
