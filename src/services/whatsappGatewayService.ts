/**
 * Format phone number to international E.164 format.
 */
export function formatE164Phone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    return `27${cleaned.slice(1)}`; // Default SA country code
  }
  return cleaned;
}
