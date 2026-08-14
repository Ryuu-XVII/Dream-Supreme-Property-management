import { describe, expect, it } from "vitest";
import {
  isNumberInRange,
  validateEmailFormat,
  validateSouthAfricanId,
  validateSouthAfricanPhone,
  validateSouthAfricanVat,
} from "./sa-validation";

describe("South African Validation Utilities", () => {
  describe("validateSouthAfricanId", () => {
    // Valid sample test IDs with valid Luhn checksums
    // 9001015009087: Male, born 1990-01-01, SA Citizen
    // 8001015009087 -> let's test algorithm with verified Luhn test vectors
    // 8001015009087 checksum check:
    // 8 0 0 1 0 1 5 0 0 9 0 8 7 ->
    // 7 + (8*2->7) + 0 + (9*2->9) + 0 + (5*2->1) + 1 + (0*2->0) + 1 + (0*2->0) + 0 + (8*2->7) = 33 -> not 0 mod 10
    // Let's compute a known valid ID: 9202204720082 -> 92/02/20, female, citizen, Luhn valid.
    // 900101 5800 08 3:
    // 9 0 0 1 0 1 5 8 0 0 0 8 3 ->
    // 3 + (8*2->7) + 0 + (0) + 0 + (8*2->7) + 5 + (1*2->2) + 0 + (1*2->2) + 0 + (9*2->9) = 3 + 7 + 0 + 0 + 0 + 7 + 5 + 2 + 0 + 2 + 0 + 9 = 35 -> not 0 mod 10
    // Let's test standard Luhn generator logic

    it("rejects empty or non-13-digit inputs", () => {
      expect(validateSouthAfricanId("").valid).toBe(false);
      expect(validateSouthAfricanId("12345").valid).toBe(false);
      expect(validateSouthAfricanId("12345678901234").valid).toBe(false);
      expect(validateSouthAfricanId("abcdefghijklm").valid).toBe(false);
    });

    it("rejects invalid month or day", () => {
      // Month 13
      expect(validateSouthAfricanId("9013015009087").valid).toBe(false);
      expect(validateSouthAfricanId("9013015009087").error).toContain("Invalid birth month");
      // Day 32
      expect(validateSouthAfricanId("9001325009087").valid).toBe(false);
      expect(validateSouthAfricanId("9001325009087").error).toContain("Invalid birth day");
    });

    it("validates correct Luhn ID and extracts details", () => {
      // Constructing a valid Luhn test ID:
      // Prefix: "950515500008" (born 15 May 1995, male, SA citizen)
      // Checksum calculation:
      // Pos from right (excluding check digit):
      // d12=9, d11=5, d10=0, d9=5, d8=1, d7=5, d6=5, d5=0, d4=0, d3=0, d2=0, d1=8
      // Luhn doubling odd positions from right:
      // d1(8)*2=16->7, d2(0), d3(0)*2=0, d4(0), d5(0)*2=0, d6(5), d7(5)*2=10->1, d8(1), d9(5)*2=10->1, d10(0), d11(5)*2=10->1, d12(9)
      // sum = 7 + 0 + 0 + 0 + 0 + 5 + 1 + 1 + 1 + 0 + 1 + 9 = 25
      // Check digit needed = (10 - (25 % 10)) % 10 = 5.
      // ID = "9505155000085"
      const res = validateSouthAfricanId("9505155000085");
      expect(res.valid).toBe(true);
      expect(res.gender).toBe("male");
      expect(res.isCitizen).toBe(true);
      expect(res.dob).toBeInstanceOf(Date);
      expect(res.dob?.getFullYear()).toBe(1995);
      expect(res.dob?.getMonth()).toBe(4); // May (0-indexed)
      expect(res.dob?.getDate()).toBe(15);
    });

    it("rejects ID with corrupted check digit", () => {
      const res = validateSouthAfricanId("9505155000086"); // corrupted check digit (6 instead of 5)
      expect(res.valid).toBe(false);
      expect(res.error).toContain("checksum");
    });
  });

  describe("validateSouthAfricanPhone", () => {
    it("validates and normalizes South African mobile and landlines", () => {
      const res1 = validateSouthAfricanPhone("0821234567");
      expect(res1.valid).toBe(true);
      expect(res1.formatted).toBe("+27 82 123 4567");

      const res2 = validateSouthAfricanPhone("+27 83 987 6543");
      expect(res2.valid).toBe(true);
      expect(res2.formatted).toBe("+27 83 987 6543");

      const res3 = validateSouthAfricanPhone("011 234 5678");
      expect(res3.valid).toBe(true);
      expect(res3.formatted).toBe("+27 11 234 5678");
    });

    it("rejects invalid phone formats", () => {
      expect(validateSouthAfricanPhone("").valid).toBe(false);
      expect(validateSouthAfricanPhone("12345").valid).toBe(false);
      expect(validateSouthAfricanPhone("0991234567").valid).toBe(false); // 09 is not valid in SA
    });
  });

  describe("validateSouthAfricanVat", () => {
    it("validates 10-digit SARS VAT numbers starting with 4", () => {
      expect(validateSouthAfricanVat("4123456789").valid).toBe(true);
      expect(validateSouthAfricanVat("4999999999").valid).toBe(true);
    });

    it("rejects invalid VAT numbers", () => {
      expect(validateSouthAfricanVat("").valid).toBe(false);
      expect(validateSouthAfricanVat("1234567890").valid).toBe(false); // must start with 4
      expect(validateSouthAfricanVat("412345678").valid).toBe(false); // 9 digits
      expect(validateSouthAfricanVat("41234567890").valid).toBe(false); // 11 digits
    });
  });

  describe("validateEmailFormat and isNumberInRange", () => {
    it("validates email formats", () => {
      expect(validateEmailFormat("test@example.com")).toBe(true);
      expect(validateEmailFormat("agent.smith@dreamsupreme.co.za")).toBe(true);
      expect(validateEmailFormat("invalid-email")).toBe(false);
      expect(validateEmailFormat("@example.com")).toBe(false);
      expect(validateEmailFormat("")).toBe(false);
    });

    it("validates numerical ranges", () => {
      expect(isNumberInRange(50, 0, 100)).toBe(true);
      expect(isNumberInRange(-5, 0, 100)).toBe(false);
      expect(isNumberInRange(150, 0, 100)).toBe(false);
      expect(isNumberInRange(NaN, 0, 100)).toBe(false);
    });
  });
});
