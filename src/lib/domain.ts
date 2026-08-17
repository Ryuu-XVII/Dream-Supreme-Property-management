import type { AgentSeniority, ConditionStatus, ConditionType, EntityType, Stage } from "@/types";

export const stageToDb: Record<Stage, string> = {
  "Mandate Signed": "mandate_signed",
  "Listed/Marketing": "listed_marketing",
  "Offer Received": "offer_received",
  "OTP Signed": "otp_signed",
  "Conditions Pending": "suspensive_conditions_pending",
  "Conveyancer Instructed": "conveyancer_instructed",
  "Compliance Certs": "compliance_certificates",
  "Transfer Duty": "transfer_duty_vat",
  "Rates & Levy Clearance": "rates_levy_clearance",
  "Documents & Guarantees": "documents_signed_guarantees",
  Lodged: "lodged",
  Registered: "registered",
  "Commission Released": "commission_released",
};

export const stageFromDb = Object.fromEntries(
  Object.entries(stageToDb).map(([label, value]) => [value, label]),
) as Record<string, Stage>;

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
  junior: "Junior",
  mid_level: "Mid-level",
  senior: "Senior",
};

export const seniorityToDb: Record<AgentSeniority, string> = {
  Junior: "junior",
  "Mid-level": "mid_level",
  Senior: "senior",
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
