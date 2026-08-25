import type { AgentSeniority, ConditionStatus, ConditionType, EntityType, Stage } from "@/types";

export const stageToDb: Record<Stage, string> = {
  "Listing & Negotiation": "listing_negotiation",
  "OTP Signed": "otp_signed",
  "Conditions Pending": "suspensive_conditions_pending",
  Conveyancing: "conveyancing",
  Lodged: "lodged",
  Registered: "registered",
  "Commission Released": "commission_released",
};

// Includes the pre-consolidation (2026-08-19) stage values, which never get
// written to deal.stage anymore but still appear in deal_stage_history rows
// that predate the consolidation and are never rewritten — this keeps that
// history displaying a sensible current-model label instead of `undefined`.
export const stageFromDb: Record<string, Stage> = {
  ...(Object.fromEntries(
    Object.entries(stageToDb).map(([label, value]) => [value, label]),
  ) as Record<string, Stage>),
  mandate_signed: "Listing & Negotiation",
  listed_marketing: "Listing & Negotiation",
  offer_received: "Listing & Negotiation",
  conveyancer_instructed: "Conveyancing",
  compliance_certificates: "Conveyancing",
  transfer_duty_vat: "Conveyancing",
  rates_levy_clearance: "Conveyancing",
  documents_signed_guarantees: "Conveyancing",
};

export const conditionTypeFromDb: Record<string, ConditionType> = {
  bond_approval: "Bond Approval",
  sale_of_property: "Sale of Existing Property",
  fica_clearance: "Due Diligence",
  due_diligence: "Due Diligence",
  body_corporate_consent: "Body Corporate Consent",
  subdivision_rezoning: "Due Diligence",
  other: "Due Diligence",
};

export const conditionStatusFromDb: Record<string, ConditionStatus> = {
  pending: "Open",
  fulfilled: "Fulfilled",
  extended: "Extended",
  waived: "Waived",
  failed: "Failed",
};

export const entityTypeFromDb: Record<string, EntityType> = {
  natural_person: "Natural Person",
  company: "Company",
  close_corporation: "Close Corporation",
  trust: "Trust",
  deceased_estate: "Deceased Estate",
};

export const propertyTypeFromDb: Record<string, string> = {
  house: "Freehold House",
  apartment: "Sectional Title",
  townhouse: "Townhouse",
  vacant_land: "Vacant Land",
  farm: "Farm",
  commercial: "Commercial",
  industrial: "Industrial",
  other: "Other",
};

export const ficaStatusFromDb: Record<string, "Complete" | "Partial" | "Not Started"> = {
  complete: "Complete",
  partial: "Partial",
  not_started: "Not Started",
  expired: "Not Started",
};

export const seniorityFromDb: Record<string, AgentSeniority> = {
  junior: "Candidate",
  mid_level: "Non-Principal Agent",
  senior: "Principal",
};

export const seniorityToDb: Record<AgentSeniority, string> = {
  Candidate: "junior",
  "Non-Principal Agent": "mid_level",
  Principal: "senior",
};

export interface TransferDutyBracket {
  from: number;
  to: number | null;
  rate: number;
  base: number;
}

export function calculateTransferDutyCents(priceCents: number, brackets: TransferDutyBracket[]) {
  const bracket = brackets.find(
    (candidate) =>
      priceCents > candidate.from && (candidate.to === null || priceCents <= candidate.to),
  );
  const appliedBracket = bracket ?? brackets[0];
  if (!appliedBracket || appliedBracket.rate === 0) {
    return { duty: 0, bracket: appliedBracket };
  }
  return {
    duty:
      appliedBracket.base +
      Math.round(((priceCents - appliedBracket.from) * appliedBracket.rate) / 100),
    bracket: appliedBracket,
  };
}
