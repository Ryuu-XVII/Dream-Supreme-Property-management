/**
 * South African Regulatory & Contact Validation Utilities
 * Covers SA National ID (13-digit Luhn algorithm + DOB sanity),
 * South African phone number format (+27 / 0X),
 * South African SARS VAT numbers (10-digits starting with 4),
 * and email / percentage range validation.
 */

export interface SaIdValidationResult {
  valid: boolean;
  error?: string;
  dob?: Date;
  gender?: "male" | "female";
  isCitizen?: boolean;
}

/**
 * Validates a South African National ID Number.
 * Format: YYMMDD SSSS C A Z
 * - YYMMDD: Date of birth
 * - SSSS: Gender (0000-4999 = Female, 5000-9999 = Male)
 * - C: Citizenship (0 = SA Citizen, 1 = Permanent Resident)
 * - A: Usually 8 (historically racial classification, now fixed)
 * - Z: Luhn checksum check digit
 */
export function validateSouthAfricanId(idNumber: string | null | undefined): SaIdValidationResult {
  if (!idNumber) {
    return { valid: false, error: "ID number is required." };
  }

  const clean = idNumber.trim().replace(/[\s-]/g, "");

  if (!/^\d{13}$/.test(clean)) {
    return {
      valid: false,
      error: "South African ID number must be exactly 13 digits.",
    };
  }

  // Extract DOB parts
  const yearPart = parseInt(clean.substring(0, 2), 10);
  const monthPart = parseInt(clean.substring(2, 4), 10);
  const dayPart = parseInt(clean.substring(4, 6), 10);

  if (monthPart < 1 || monthPart > 12) {
    return { valid: false, error: "Invalid birth month in ID number." };
  }

  // Determine full year based on current century heuristic
  const currentYear = new Date().getFullYear();
  const currentCenturyPrefix = Math.floor(currentYear / 100) * 100;
  const currentYear2Digit = currentYear % 100;

  // If yearPart is <= current 2-digit year, assume 2000s; otherwise 1900s
  const fullYear =
    yearPart <= currentYear2Digit
      ? currentCenturyPrefix + yearPart
      : currentCenturyPrefix - 100 + yearPart;

  const daysInMonth = new Date(fullYear, monthPart, 0).getDate();
  if (dayPart < 1 || dayPart > daysInMonth) {
    return { valid: false, error: "Invalid birth day in ID number." };
  }

  const dob = new Date(fullYear, monthPart - 1, dayPart);

  // Luhn Checksum validation
  let sum = 0;
  let alternate = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = parseInt(clean.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }

  if (sum % 10 !== 0) {
    return { valid: false, error: "Invalid ID number checksum (Luhn check failed)." };
  }

  const genderCode = parseInt(clean.substring(6, 10), 10);
  const gender = genderCode >= 5000 ? "male" : "female";
  const citizenshipCode = parseInt(clean.charAt(10), 10);
  const isCitizen = citizenshipCode === 0;

  return {
    valid: true,
    dob,
    gender,
    isCitizen,
  };
}

export interface SaPhoneValidationResult {
  valid: boolean;
  formatted?: string;
  error?: string;
}

/**
 * Validates and normalizes South African phone numbers.
 * Supports:
 * - Local formats: 0821234567, 011 234 5678
 * - International formats: +27821234567, +27 82 123 4567, 0027821234567, 27821234567
 */
export function validateSouthAfricanPhone(
  phone: string | null | undefined,
): SaPhoneValidationResult {
  if (!phone) {
    return { valid: false, error: "Phone number is required." };
  }

  const clean = phone.trim().replace(/[\s\-()]/g, "");

  let normalized = clean;
  if (normalized.startsWith("+27")) {
    normalized = "0" + normalized.slice(3);
  } else if (normalized.startsWith("0027")) {
    normalized = "0" + normalized.slice(4);
  } else if (normalized.startsWith("27") && normalized.length === 11) {
    normalized = "0" + normalized.slice(2);
  }

  // Standard South African phone numbers must start with 0 followed by 1-8 and have 10 digits
  if (!/^0[1-8]\d{8}$/.test(normalized)) {
    return {
      valid: false,
      error: "Please enter a valid 10-digit South African phone number (e.g. 082 123 4567).",
    };
  }

  return {
    valid: true,
    formatted: `+27 ${normalized.slice(1, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`,
  };
}

export interface SaVatValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a South African SARS VAT Registration Number.
 * Format: 10 digits, typically starting with '4'.
 */
export function validateSouthAfricanVat(vat: string | null | undefined): SaVatValidationResult {
  if (!vat) {
    return { valid: false, error: "VAT number is required." };
  }

  const clean = vat.trim().replace(/[\s-]/g, "");

  if (!/^4\d{9}$/.test(clean)) {
    return {
      valid: false,
      error: "South African VAT number must be exactly 10 digits starting with 4.",
    };
  }

  return { valid: true };
}

/**
 * Validates standard email address format.
 */
export function validateEmailFormat(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Clamps or checks numeric ranges.
 */
export function isNumberInRange(val: number, min: number, max: number): boolean {
  return !isNaN(val) && val >= min && val <= max;
}
