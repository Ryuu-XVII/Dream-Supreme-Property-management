import type { TransferDutyBracket } from "@/lib/domain";

export const DEFAULT_VAT_PERCENT = 15;
export const DEFAULT_SALE_PRICE_CENTS = 250_000_000;
export const DEFAULT_COMMISSION_BPS = 600;
export const DEFAULT_OFFICE_SHARE_PERCENT = 45;

// Offline fallback for authenticated calculator widgets. The public calculator
// reads the effective schedule through get_current_transfer_duty_brackets().
export const TRANSFER_DUTY_FALLBACK: TransferDutyBracket[] = [
  { from: 0, to: 121_000_000, rate: 0, base: 0 },
  { from: 121_000_000, to: 166_380_000, rate: 3, base: 0 },
  { from: 166_380_000, to: 232_930_000, rate: 6, base: 1_361_400 },
  { from: 232_930_000, to: 299_480_000, rate: 8, base: 5_354_400 },
  { from: 299_480_000, to: 1_331_000_000, rate: 11, base: 10_678_400 },
  { from: 1_331_000_000, to: null, rate: 13, base: 124_145_600 },
];
