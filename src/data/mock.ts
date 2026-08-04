import { addDays, subDays, format } from "date-fns";

const today = new Date();
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const d = (n: number) => iso(addDays(today, n));
const past = (n: number) => iso(subDays(today, n));

export type Role = "Principal" | "Agent" | "Candidate" | "Admin";

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: Role;
  seniority: "Principal" | "Senior" | "Mid-level" | "Candidate" | "Admin";
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
}

export const users: User[] = [];

export const userById = (id: string): User =>
  users.find((u) => u.id === id) || {
    id: id || "unknown",
    name: "Unassigned Agent",
    email: "agent@dreamsupreme.co.za",
    mobile: "N/A",
    role: "Agent",
    seniority: "Mid-level",
    branch: "Sandton",
    ppra: "N/A",
    ffc: null,
    active: true,
    colour: "#0026D9",
  };

export const branches = [
  { id: "b1", name: "Sandton", address: "14 West Street, Sandton, 2196" },
  { id: "b2", name: "Fourways", address: "Cedar Square, Fourways, 2055" },
  { id: "b3", name: "Midrand", address: "Boulders Office Park, Midrand, 1685" },
];

export interface Property {
  id: string;
  address: string;
  suburb: string;
  city: string;
  type: "Freehold House" | "Sectional Title" | "Estate House";
  beds: number;
  baths: number;
  garages: number;
  erfSize: number;
  floorSize: number;
  schemeName?: string;
}

export const properties: Property[] = [];

export const propertyById = (id: string): Property =>
  properties.find((p) => p.id === id) || {
    id: id || "unknown",
    address: "Property Details Pending",
    suburb: "N/A",
    city: "N/A",
    type: "Freehold House",
    beds: 0,
    baths: 0,
    garages: 0,
    erfSize: 0,
    floorSize: 0,
  };

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
  registeredAt?: string;
  branch: string;
  stageSince: string;
  bond: {
    status: "Not applied" | "Submitted" | "Declined" | "Approved in principle" | "Formally granted";
    institution: string;
    appliedAt?: string;
    decidedAt?: string;
  };
  conveyancer: string;
  practitioners: Practitioner[];
  parties: Party[];
  conditions: Condition[];
  offers: Offer[];
  timeline: TimelineEvent[];
  documents: DocumentRec[];
}

const conveyancers = [
  "Vermeulen & Associates Inc.",
  "Ntuli Attorneys",
  "Bezuidenhout Conveyancing",
  "Mabaso & Partners",
];

function mkParty(
  dealId: string,
  n: number,
  side: "Seller" | "Purchaser",
  name: string,
  entityType: EntityType,
  fica: Party["fica"],
): Party {
  return {
    id: `${dealId}-pty${n}`,
    dealId,
    name,
    side,
    entityType,
    email: `${name.split(" ")[0].toLowerCase()}@example.co.za`,
    mobile: `08${(n % 4) + 2} ${300 + n} ${1000 + n * 7}`,
    idNumber: `${7 + (n % 3)}${String(100000 + n * 913).slice(0, 5)}5${String(80 + n).slice(0, 2)}083`,
    fica,
    popia: fica !== "Not Started",
    popiaAt: fica !== "Not Started" ? past(20 + n) : undefined,
    checklist: [
      { label: "Certified ID document", done: fica !== "Not Started" },
      { label: "Proof of residential address", done: fica === "Complete" },
      { label: "Source of funds declaration", done: fica === "Complete" },
      { label: "SARS tax number confirmation", done: fica === "Complete" },
    ],
  };
}

const docCats = [
  "Mandate",
  "OTP",
  "FICA",
  "Compliance Certificate",
  "Bond Grant",
  "Clearance",
  "Guarantee",
];

function mkDocs(dealId: string, count: number): DocumentRec[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${dealId}-doc${i + 1}`,
    name: `${docCats[i % docCats.length].replace(/ /g, "-")}-${dealId.toUpperCase()}-v${(i % 2) + 1}.pdf`,
    category: docCats[i % docCats.length],
    version: (i % 2) + 1,
    uploadedBy: users[(i + 1) % 5].name,
    uploadedAt: past(30 - i * 2),
    sizeKb: 180 + i * 63,
    supersedes: i % 2 === 1 ? `${dealId}-doc${i}` : undefined,
  }));
}

interface Seed {
  ref: string;
  propertyId: string;
  stage: Stage;
  price: number;
  bps: number;
  branch: string;
  stageDays: number;
  practitioners: Practitioner[];
  seller: [string, EntityType, Party["fica"]];
  purchaser: [string, EntityType, Party["fica"]];
  conds: {
    type: ConditionType;
    desc: string;
    due: number;
    status?: ConditionStatus;
    user: string;
    party: Condition["responsibleParty"];
  }[];
  bond: Deal["bond"];
  registeredDaysAgo?: number;
  cancelled?: { reason: string; daysAgo: number };
  mandateType?: Deal["mandateType"];
}

const seeds: Seed[] = [];

export const deals: Deal[] = [];

export const dealById = (id: string) => deals.find((x) => x.id === id || x.ref === id);

export const allConditions: (Condition & { deal: Deal })[] = [];

export const openConditions: (Condition & { deal: Deal })[] = [];

/* ---------- Commission ---------- */

export interface DeductionLine {
  id: string;
  type: "Franchise Fee" | "Referral Fee" | "Marketing Recovery" | "Co-mandate Share" | "Desk Fee";
  basis: "Percentage" | "Fixed";
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

export const ruleSets: RuleSet[] = [
  {
    id: "rs1",
    name: "Dream Supreme Standard 2026",
    effectiveFrom: "2026-01-01",
    isDefault: true,
    vatInclusive: true,
    defaultBps: 600,
    rounding: "Nearest cent",
    officeSharePct: 45,
    deductions: [
      { id: "dl1", type: "Franchise Fee", basis: "Percentage", bps: 600, payee: "Head Office" },
      {
        id: "dl2",
        type: "Marketing Recovery",
        basis: "Fixed",
        fixed: 350000,
        payee: "Marketing Pool",
      },
      { id: "dl3", type: "Desk Fee", basis: "Fixed", fixed: 250000, payee: "Agency" },
    ],
  },
];

export const ruleTemplates = [
  {
    id: "t1",
    name: "Standard Independent Agency",
    bps: 600,
    office: 45,
    franchise: 0,
    blurb: "No franchise fee. 45/55 office-to-agent split.",
  },
  {
    id: "t2",
    name: "RE/MAX Franchise",
    bps: 600,
    office: 30,
    franchise: 600,
    blurb: "6% franchise fee, high agent retention model.",
  },
  {
    id: "t3",
    name: "Keller Williams",
    bps: 600,
    office: 30,
    franchise: 600,
    blurb: "Capped franchise contribution with profit share.",
  },
  {
    id: "t4",
    name: "Seeff",
    bps: 700,
    office: 50,
    franchise: 500,
    blurb: "Traditional brand model with marketing recovery.",
  },
];

export const VAT_RATE = 0.15;

export interface WaterfallStep {
  label: string;
  formula: string;
  amount: number;
  kind: "base" | "deduct" | "subtotal" | "final";
}

export function commissionWaterfall(deal: Deal, rules: RuleSet = ruleSets[0]): WaterfallStep[] {
  return [];
}

function zarRate(cents: number) {
  return `R ${(cents / 100).toLocaleString("en-ZA")}`;
}

export function grossCommission(deal: Deal) {
  return Math.round(((deal?.salePrice || 0) * (deal?.commissionBps || 0)) / 10000);
}

export function netPayable(deal: Deal) {
  return 0;
}

/* ---------- Leads ---------- */

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

export const leads: Lead[] = [];

/* ---------- Audit log ---------- */

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

export const auditEvents: AuditEvent[] = [];

/* ---------- Misc ---------- */

export const agency = {
  name: "Dream Supreme Properties",
  registration: "2014/118842/07",
  ppra: "PPRA-FFC-2026-DSP-001",
  vatNumber: "4820119937",
  vatVendor: true,
  address: "14 West Street, Sandton, Johannesburg, 2196",
  phone: "011 884 2200",
  email: "info@dreamsupreme.co.za",
};

export const conveyancerFirms = [
  {
    id: "cf1",
    name: "Vermeulen & Associates Inc.",
    contact: "Danie Vermeulen",
    email: "danie@vermeulenlaw.co.za",
    tel: "011 447 3300",
    preferred: true,
  },
  {
    id: "cf2",
    name: "Ntuli Attorneys",
    contact: "Sindi Ntuli",
    email: "sindi@ntuliattorneys.co.za",
    tel: "011 326 7710",
    preferred: true,
  },
  {
    id: "cf3",
    name: "Bezuidenhout Conveyancing",
    contact: "Marius Bezuidenhout",
    email: "marius@bezcon.co.za",
    tel: "012 663 4491",
    preferred: false,
  },
  {
    id: "cf4",
    name: "Mabaso & Partners",
    contact: "Thabo Mabaso",
    email: "thabo@mabasolaw.co.za",
    tel: "011 021 8890",
    preferred: false,
  },
];

export const transferDutyBrackets = [
  { from: 0, to: 121000000, rate: 0, base: 0 },
  { from: 121000000, to: 154500000, rate: 3, base: 0 },
  { from: 154500000, to: 212500000, rate: 6, base: 1005000 },
  { from: 212500000, to: 288000000, rate: 8, base: 4485000 },
  { from: 288000000, to: 400000000, rate: 11, base: 10525000 },
  { from: 400000000, to: null, rate: 13, base: 22845000 },
];

export const notificationTypes = [
  "Condition due",
  "Condition failed",
  "Stage advanced",
  "Deal registered",
  "Deal cancelled",
  "FFC expiring",
  "Mandate expiring",
  "Deal stale",
  "Commission issued",
  "Conveyancer status request",
  "New lead",
];

export const fallThroughReasons: any[] = [];

export const monthlyCommission: any[] = [];

export const forecast: any[] = [];

export const advances: any[] = [];

export const notifications: any[] = [];
