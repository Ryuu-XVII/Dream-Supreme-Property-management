export type Role = "Agent" | "Admin";

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  seniority: "Senior" | "Mid-level" | "Admin";
  branch: string;
  ppra: string;
  ffc: {
    number: string;
    issued: string;
    expiry: string | null;
  } | null;
  supervisor?: string;
  active: boolean;
  colour: string;
  avatarUrl?: string;
}

export interface Property {
  id: string;
  address: string;
  suburb: string;
  city: string;
  postalCode?: string;
  type: "Freehold House" | "Sectional Title" | "Estate House";
  beds: number;
  baths: number;
  garages: number;
  erfSize: number;
  floorSize: number;
  erfNumber?: string;
  titleDeedNumber?: string;
  schemeName?: string;
}

export const STAGES = [
  "Mandate Signed",
  "Listed/Marketing",
  "Offer Received",
  "OTP Signed",
  "Conditions Pending",
  "Conveyancer Instructed",
  "Compliance Certs",
  "Transfer Duty",
  "Rates & Levy Clearance",
  "Documents & Guarantees",
  "Lodged",
  "Registered",
  "Commission Released",
] as const;

export type Stage = (typeof STAGES)[number];

export type ConditionType =
  | "Bond Approval"
  | "Sale of Existing Property"
  | "Deposit Payment"
  | "Body Corporate Consent"
  | "Due Diligence"
  | "Electrical Compliance";

export type ConditionStatus = "Open" | "Fulfilled" | "Extended" | "Waived" | "Failed";

export interface Condition {
  id: string;
  dealId: string;
  type: ConditionType;
  description: string;
  dueDate: string;
  originalDueDate?: string;
  status: ConditionStatus;
  responsibleUserId: string;
  responsibleParty: "Purchaser" | "Seller" | "Agent" | "Conveyancer";
}

export type EntityType =
  "Natural Person" | "Company" | "Close Corporation" | "Trust" | "Deceased Estate";

export interface Party {
  id: string;
  dealId: string;
  name: string;
  side: "Seller" | "Purchaser";
  entityType: EntityType;
  maritalStatus?:
    | "Single"
    | "Married in Community of Property"
    | "Married out of Community of Property"
    | "Married by Foreign Law"
    | "Divorced"
    | "Widowed";
  isVatVendor?: boolean;
  email: string;
  mobile: string;
  idNumber: string;
  fica: "Complete" | "Partial" | "Not Started";
  popia: boolean;
  popiaAt?: string;
  checklist: { label: string; done: boolean }[];
}

export interface Practitioner {
  userId: string;
  role: "Listing Agent" | "Selling Agent" | "Referral" | "Co-mandate";
  splitPct: number;
  external: boolean;
}

export interface Offer {
  id: string;
  price: number;
  deposit: number;
  bondAmount: number;
  expiry: string;
  purchaser: string;
  occupationDate: string;
  status: "Pending" | "Accepted" | "Rejected" | "Expired";
}

export interface TimelineEvent {
  id: string;
  at: string;
  from?: Stage;
  to?: Stage;
  actor: string;
  action: string;
  reason?: string;
}

export interface DocumentRec {
  id: string;
  name: string;
  category: string;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  sizeKb: number;
  supersedes?: string;
  url?: string;
  partyId?: string;
}

export interface Deal {
  id: string;
  ref: string;
  propertyId: string;
  stage: Stage;
  cancelled?: { reason: string; at: string };
  salePrice: number;
  listingPrice: number;
  commissionBps: number;
  mandateType: "Sole" | "Joint" | "Open";
  mandateSigned: string;
  mandateExpiry: string;
  otpSigned?: string;
  occupationDate?: string;
  occupationalRent?: number;
  registeredAt?: string;
  branch: string;
  stageSince: string;
  bond: {
    status: "Not applied" | "Submitted" | "Declined" | "Approved in principle" | "Formally granted";
    institution: string;
    appliedAt?: string;
    decidedAt?: string;
  };
  isVatSale?: boolean;
  conveyancer: string;
  practitioners: Practitioner[];
  parties: Party[];
  conditions: Condition[];
  offers: Offer[];
  timeline: TimelineEvent[];
  documents: DocumentRec[];
}

export interface DeductionLine {
  id: string;
  type: "Franchise Fee" | "Referral Fee" | "Marketing Recovery" | "Co-mandate Share" | "Desk Fee";
  basis: "Percentage" | "Percentage of Remaining" | "Fixed";
  bps?: number;
  fixed?: number;
  payee: string;
}

export interface RuleSet {
  id: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isDefault: boolean;
  vatInclusive: boolean;
  defaultBps: number;
  rounding: "Nearest cent" | "Nearest rand" | "Round down";
  officeSharePct: number;
  deductions: DeductionLine[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  mobile: string;
  source: "Bond" | "Transfer" | "Affordability" | "Yield";
  assignedTo?: string;
  status: "New" | "Contacted" | "Qualified" | "Converted" | "Closed";
  createdAt: string;
  payload: string;
  notes: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  user: string;
  entityType: "Deal" | "Condition" | "Commission" | "User" | "Document" | "Property";
  entityRef: string;
  action: "Created" | "Updated" | "Stage Changed" | "Calculated" | "Deleted";
  summary: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export type TrustAccountType = "section_86_2_general" | "section_86_4_investment";
export type TrustTransactionType =
  | "deposit_inflow"
  | "refund_outflow"
  | "conveyancer_transfer"
  | "interest_credit"
  | "ppra_levy_deduction";

export interface TrustLedgerEntry {
  id: string;
  agencyId: string;
  dealId?: string;
  leaseId?: string;
  accountType: TrustAccountType;
  transactionType: TrustTransactionType;
  amountCents: number;
  referenceNumber: string;
  bankStatementDate: string;
  payerPayeeName: string;
  interestSplitClientPct: number;
  interestSplitPpraPct: number;
  approvedByPrincipal?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface LeaseEscalationSchedule {
  id: string;
  leaseId: string;
  effectiveDate: string;
  escalationPercentage: number;
  previousRentCents: number;
  newRentCents: number;
  isApplied: boolean;
  appliedAt?: string;
  createdAt: string;
}

export interface DocumentTemplate {
  id: string;
  agencyId: string;
  name: string;
  category: string;
  bodyMarkdown: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyRentalSettings {
  defaultManagementFeeBps: number;
  defaultProcurementFeeCents: number;
  proRataCalculationBasis: "exact_calendar_days" | "standard_30_days";
}

export interface LeaseOnboardingPayload {
  propertyId: string;
  landlordPartyId: string;
  tenantPartyId: string;
  managedBy?: string;
  monthlyRentCents: number;
  depositCents?: number;
  depositHeldBy?: "agency_trust" | "landlord" | "deposit_scheme";
  procurementFeeCents?: number;
  managementFeeBps?: number;
  startOn: string;
  endOn: string;
  escalationRateBps?: number;
  escalationMonth?: number;
  adminFeeCents?: number;
  proRataRentCents?: number;
  inspectionDate?: string;
  occupantsText?: string;
  cpaNoticeApplicable?: boolean;
}
