import type { ConditionStatus, ConditionType, EntityType, Stage } from "@/types";

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

export const cancellationReasonToDb: Record<string, string> = {
  "Bond declined": "bond_declined",
  "Bond not applied in time": "bond_not_applied_in_time",
  "Sale of purchaser property failed": "sale_of_purchasers_property_failed",
  "Purchaser withdrew": "purchaser_withdrew",
  "Seller withdrew": "seller_withdrew",
  "Property defect": "property_defect",
  "Compliance certificate failure": "compliance_certificate_failure",
  "Price renegotiation failed": "price_renegotiation_failed",
  "Purchaser death or insolvency": "purchaser_death_or_insolvency",
  "Seller death or insolvency": "seller_death_or_insolvency",
  "Deceased estate or trust complication": "deceased_estate_or_trust_complication",
  "Title or boundary defect": "title_or_boundary_defect",
  "Municipal or clearance obstruction": "municipal_or_clearance_obstruction",
  Other: "other",
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
