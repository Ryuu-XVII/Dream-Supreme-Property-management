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

export const users: User[] = [
  {
    id: "u1",
    name: "Thandiwe Mokoena",
    email: "thandiwe@dreamsupreme.co.za",
    mobile: "082 445 1120",
    role: "Principal",
    seniority: "Principal",
    branch: "Sandton",
    ppra: "PPRA-2019-114820",
    ffc: { number: "FFC-2026-00114", issued: past(210), expiry: d(155) },
    active: true,
    colour: "#2f4f8f",
  },
  {
    id: "u2",
    name: "Riaan van Niekerk",
    email: "riaan@dreamsupreme.co.za",
    mobile: "083 219 7745",
    role: "Agent",
    seniority: "Senior",
    branch: "Sandton",
    ppra: "PPRA-2016-098311",
    ffc: { number: "FFC-2026-00220", issued: past(340), expiry: d(24) },
    active: true,
    colour: "#1f7a52",
  },
  {
    id: "u3",
    name: "Nomsa Dlamini",
    email: "nomsa@dreamsupreme.co.za",
    mobile: "071 908 3312",
    role: "Agent",
    seniority: "Senior",
    branch: "Fourways",
    ppra: "PPRA-2017-104555",
    ffc: { number: "FFC-2026-00341", issued: past(300), expiry: d(64) },
    active: true,
    colour: "#8a5a1f",
  },
  {
    id: "u4",
    name: "Kagiso Sithole",
    email: "kagiso@dreamsupreme.co.za",
    mobile: "072 551 9004",
    role: "Agent",
    seniority: "Mid-level",
    branch: "Midrand",
    ppra: "PPRA-2020-127440",
    ffc: { number: "FFC-2025-00988", issued: past(400), expiry: past(12) },
    active: true,
    colour: "#7a2f5f",
  },
  {
    id: "u5",
    name: "Lerato Khumalo",
    email: "lerato@dreamsupreme.co.za",
    mobile: "078 330 2218",
    role: "Candidate",
    seniority: "Candidate",
    branch: "Sandton",
    ppra: "PPRA-2025-160991",
    ffc: null,
    supervisor: "u2",
    active: true,
    colour: "#2f6f8a",
  },
  {
    id: "u6",
    name: "Chantelle Adams",
    email: "chantelle@dreamsupreme.co.za",
    mobile: "084 112 6690",
    role: "Admin",
    seniority: "Admin",
    branch: "Sandton",
    ppra: "—",
    ffc: { number: "FFC-2026-00512", issued: past(120), expiry: d(245) },
    active: true,
    colour: "#555f70",
  },
];

export const userById = (id: string) => users.find((u) => u.id === id)!;

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

export const properties: Property[] = [
  {
    id: "p1",
    address: "12 Aloe Ridge Close",
    suburb: "Bryanston",
    city: "Johannesburg",
    type: "Freehold House",
    beds: 4,
    baths: 3,
    garages: 2,
    erfSize: 1420,
    floorSize: 380,
  },
  {
    id: "p2",
    address: "Unit 604, The Foundry, 89 Rivonia Road",
    suburb: "Sandton",
    city: "Johannesburg",
    type: "Sectional Title",
    beds: 2,
    baths: 2,
    garages: 1,
    erfSize: 0,
    floorSize: 96,
    schemeName: "The Foundry",
  },
  {
    id: "p3",
    address: "7 Kingfisher Bend, Dainfern Golf Estate",
    suburb: "Fourways",
    city: "Johannesburg",
    type: "Estate House",
    beds: 5,
    baths: 4,
    garages: 3,
    erfSize: 1100,
    floorSize: 520,
  },
  {
    id: "p4",
    address: "Unit 21, Carlswald Crest",
    suburb: "Midrand",
    city: "Johannesburg",
    type: "Sectional Title",
    beds: 3,
    baths: 2,
    garages: 2,
    erfSize: 0,
    floorSize: 142,
    schemeName: "Carlswald Crest",
  },
  {
    id: "p5",
    address: "88 Protea Avenue",
    suburb: "Centurion",
    city: "Pretoria",
    type: "Freehold House",
    beds: 3,
    baths: 2,
    garages: 2,
    erfSize: 890,
    floorSize: 240,
  },
  {
    id: "p6",
    address: "3 Silverwood Drive, Steyn City",
    suburb: "Fourways",
    city: "Johannesburg",
    type: "Estate House",
    beds: 6,
    baths: 5,
    garages: 4,
    erfSize: 1650,
    floorSize: 720,
  },
  {
    id: "p7",
    address: "Unit 12, Sandown Mews, 5 Maude Street",
    suburb: "Sandton",
    city: "Johannesburg",
    type: "Sectional Title",
    beds: 1,
    baths: 1,
    garages: 1,
    erfSize: 0,
    floorSize: 62,
    schemeName: "Sandown Mews",
  },
  {
    id: "p8",
    address: "45 Peach Tree Road",
    suburb: "Bryanston",
    city: "Johannesburg",
    type: "Freehold House",
    beds: 4,
    baths: 3,
    garages: 2,
    erfSize: 1200,
    floorSize: 310,
  },
  {
    id: "p9",
    address: "9 Waterfall Equestrian Estate",
    suburb: "Midrand",
    city: "Johannesburg",
    type: "Estate House",
    beds: 4,
    baths: 4,
    garages: 3,
    erfSize: 1350,
    floorSize: 480,
  },
  {
    id: "p10",
    address: "Unit 8, Lonehill Gardens",
    suburb: "Fourways",
    city: "Johannesburg",
    type: "Sectional Title",
    beds: 2,
    baths: 1,
    garages: 1,
    erfSize: 0,
    floorSize: 78,
    schemeName: "Lonehill Gardens",
  },
];

export const propertyById = (id: string) => properties.find((p) => p.id === id)!;

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

const seeds: Seed[] = [
  {
    ref: "DSP-2026-0141",
    propertyId: "p1",
    stage: "Conditions Pending",
    price: 425000000,
    bps: 600,
    branch: "Sandton",
    stageDays: 9,
    practitioners: [
      { userId: "u2", role: "Listing Agent", splitPct: 60, external: false },
      { userId: "u5", role: "Selling Agent", splitPct: 40, external: false },
    ],
    seller: ["Pieter & Marlene Fourie", "Natural Person", "Complete"],
    purchaser: ["Sipho Ndlovu", "Natural Person", "Partial"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Purchaser to obtain bond approval of R3,400,000",
        due: 2,
        user: "u2",
        party: "Purchaser",
      },
      {
        type: "Deposit Payment",
        desc: "Deposit of R850,000 into conveyancer trust",
        due: 6,
        user: "u2",
        party: "Purchaser",
      },
    ],
    bond: { status: "Submitted", institution: "Standard Bank", appliedAt: past(11) },
  },
  {
    ref: "DSP-2026-0138",
    propertyId: "p3",
    stage: "Lodged",
    price: 550000000,
    bps: 550,
    branch: "Fourways",
    stageDays: 4,
    practitioners: [{ userId: "u3", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Dainfern Holdings (Pty) Ltd", "Company", "Complete"],
    purchaser: ["The Mbeki Family Trust", "Trust", "Complete"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Bond of R4,000,000 formally granted",
        due: -18,
        status: "Fulfilled",
        user: "u3",
        party: "Purchaser",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "Investec",
      appliedAt: past(60),
      decidedAt: past(31),
    },
  },
  {
    ref: "DSP-2026-0134",
    propertyId: "p2",
    stage: "Registered",
    price: 189500000,
    bps: 700,
    branch: "Sandton",
    stageDays: 3,
    registeredDaysAgo: 3,
    practitioners: [
      { userId: "u2", role: "Listing Agent", splitPct: 70, external: false },
      { userId: "u4", role: "Selling Agent", splitPct: 30, external: false },
    ],
    seller: ["Anita Pillay", "Natural Person", "Complete"],
    purchaser: ["Jaco Steyn", "Natural Person", "Complete"],
    conds: [
      {
        type: "Body Corporate Consent",
        desc: "Body corporate levy clearance obtained",
        due: -25,
        status: "Fulfilled",
        user: "u2",
        party: "Conveyancer",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "FNB",
      appliedAt: past(75),
      decidedAt: past(50),
    },
  },
  {
    ref: "DSP-2026-0129",
    propertyId: "p5",
    stage: "Commission Released",
    price: 132000000,
    bps: 700,
    branch: "Midrand",
    stageDays: 12,
    registeredDaysAgo: 26,
    practitioners: [{ userId: "u4", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Estate Late J.P. Bekker", "Deceased Estate", "Complete"],
    purchaser: ["Zanele Mahlangu", "Natural Person", "Complete"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Bond granted by Absa",
        due: -60,
        status: "Fulfilled",
        user: "u4",
        party: "Purchaser",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "Absa",
      appliedAt: past(110),
      decidedAt: past(88),
    },
  },
  {
    ref: "DSP-2026-0145",
    propertyId: "p6",
    stage: "OTP Signed",
    price: 985000000,
    bps: 500,
    branch: "Fourways",
    stageDays: 2,
    practitioners: [
      { userId: "u3", role: "Listing Agent", splitPct: 50, external: false },
      { userId: "u2", role: "Co-mandate", splitPct: 50, external: true },
    ],
    seller: ["Silverwood Trust", "Trust", "Partial"],
    purchaser: ["Dr. Ayanda Zulu", "Natural Person", "Not Started"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Bond approval of R7,000,000 required",
        due: 12,
        user: "u3",
        party: "Purchaser",
      },
      {
        type: "Sale of Existing Property",
        desc: "Purchaser to sell 4 Rivonia Close by due date",
        due: 25,
        user: "u3",
        party: "Purchaser",
      },
    ],
    bond: { status: "Approved in principle", institution: "Nedbank", appliedAt: past(5) },
  },
  {
    ref: "DSP-2026-0147",
    propertyId: "p4",
    stage: "Offer Received",
    price: 178000000,
    bps: 650,
    branch: "Midrand",
    stageDays: 1,
    practitioners: [{ userId: "u4", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Carlswald Props CC", "Close Corporation", "Partial"],
    purchaser: ["Lebo & Tumi Modise", "Natural Person", "Not Started"],
    conds: [
      {
        type: "Deposit Payment",
        desc: "10% deposit within 7 days of acceptance",
        due: 5,
        user: "u4",
        party: "Purchaser",
      },
    ],
    bond: { status: "Not applied", institution: "—" },
  },
  {
    ref: "DSP-2026-0122",
    propertyId: "p8",
    stage: "Conveyancer Instructed",
    price: 298000000,
    bps: 600,
    branch: "Sandton",
    stageDays: 15,
    practitioners: [
      { userId: "u5", role: "Listing Agent", splitPct: 40, external: false },
      { userId: "u2", role: "Selling Agent", splitPct: 60, external: false },
    ],
    seller: ["Grant & Sarah Whitfield", "Natural Person", "Complete"],
    purchaser: ["Nkosi Investments (Pty) Ltd", "Company", "Complete"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Bond of R2,400,000 granted",
        due: -8,
        status: "Fulfilled",
        user: "u2",
        party: "Purchaser",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "Standard Bank",
      appliedAt: past(45),
      decidedAt: past(20),
    },
  },
  {
    ref: "DSP-2026-0119",
    propertyId: "p9",
    stage: "Compliance Certs",
    price: 462000000,
    bps: 550,
    branch: "Midrand",
    stageDays: 7,
    practitioners: [
      { userId: "u4", role: "Listing Agent", splitPct: 70, external: false },
      { userId: "u3", role: "Referral", splitPct: 30, external: false },
    ],
    seller: ["Waterfall Living (Pty) Ltd", "Company", "Complete"],
    purchaser: ["Michael Botha", "Natural Person", "Complete"],
    conds: [
      {
        type: "Electrical Compliance",
        desc: "Electrical & gas COC to be issued",
        due: -2,
        user: "u4",
        party: "Seller",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "Investec",
      appliedAt: past(50),
      decidedAt: past(30),
    },
  },
  {
    ref: "DSP-2026-0150",
    propertyId: "p7",
    stage: "Mandate Signed",
    price: 95000000,
    bps: 750,
    branch: "Sandton",
    stageDays: 3,
    mandateType: "Open",
    practitioners: [{ userId: "u5", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Refiloe Mathe", "Natural Person", "Partial"],
    purchaser: ["—", "Natural Person", "Not Started"],
    conds: [],
    bond: { status: "Not applied", institution: "—" },
  },
  {
    ref: "DSP-2026-0151",
    propertyId: "p10",
    stage: "Listed/Marketing",
    price: 82000000,
    bps: 750,
    branch: "Fourways",
    stageDays: 6,
    practitioners: [{ userId: "u3", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Lonehill Rentals CC", "Close Corporation", "Complete"],
    purchaser: ["—", "Natural Person", "Not Started"],
    conds: [],
    bond: { status: "Not applied", institution: "—" },
  },
  {
    ref: "DSP-2026-0126",
    propertyId: "p1",
    stage: "Rates & Levy Clearance",
    price: 315000000,
    bps: 600,
    branch: "Sandton",
    stageDays: 11,
    practitioners: [{ userId: "u2", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Hendrik de Wet", "Natural Person", "Complete"],
    purchaser: ["Fatima Patel", "Natural Person", "Complete"],
    conds: [
      {
        type: "Due Diligence",
        desc: "Municipal rates clearance figures requested",
        due: 3,
        user: "u2",
        party: "Conveyancer",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "FNB",
      appliedAt: past(70),
      decidedAt: past(44),
    },
  },
  {
    ref: "DSP-2026-0131",
    propertyId: "p5",
    stage: "Transfer Duty",
    price: 247500000,
    bps: 600,
    branch: "Midrand",
    stageDays: 5,
    practitioners: [
      { userId: "u4", role: "Listing Agent", splitPct: 60, external: false },
      { userId: "u5", role: "Selling Agent", splitPct: 40, external: false },
    ],
    seller: ["Protea Estates CC", "Close Corporation", "Complete"],
    purchaser: ["Bongani & Thabile Cele", "Natural Person", "Partial"],
    conds: [
      {
        type: "Deposit Payment",
        desc: "Balance deposit of R500,000",
        due: 7,
        user: "u4",
        party: "Purchaser",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "Nedbank",
      appliedAt: past(58),
      decidedAt: past(29),
    },
  },
  {
    ref: "DSP-2026-0143",
    propertyId: "p3",
    stage: "Documents & Guarantees",
    price: 512000000,
    bps: 550,
    branch: "Fourways",
    stageDays: 8,
    practitioners: [{ userId: "u3", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Kingfisher Trust", "Trust", "Complete"],
    purchaser: ["Sanele Gumede", "Natural Person", "Complete"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Guarantees to be delivered by bank attorney",
        due: 1,
        user: "u3",
        party: "Conveyancer",
      },
    ],
    bond: {
      status: "Formally granted",
      institution: "Standard Bank",
      appliedAt: past(80),
      decidedAt: past(40),
    },
  },
  {
    ref: "DSP-2026-0108",
    propertyId: "p4",
    stage: "Conditions Pending",
    price: 165000000,
    bps: 700,
    branch: "Midrand",
    stageDays: 34,
    practitioners: [{ userId: "u4", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Yolanda Mkhize", "Natural Person", "Complete"],
    purchaser: ["Ruan Kruger", "Natural Person", "Partial"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Third bond application — Absa",
        due: -6,
        user: "u4",
        party: "Purchaser",
      },
    ],
    bond: { status: "Declined", institution: "Absa", appliedAt: past(40), decidedAt: past(6) },
  },
  {
    ref: "DSP-2026-0113",
    propertyId: "p8",
    stage: "OTP Signed",
    price: 289000000,
    bps: 600,
    branch: "Sandton",
    stageDays: 22,
    practitioners: [{ userId: "u2", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Peach Tree Props (Pty) Ltd", "Company", "Complete"],
    purchaser: ["Ntando Khoza", "Natural Person", "Complete"],
    conds: [
      {
        type: "Sale of Existing Property",
        desc: "Purchaser's Randburg townhouse to be sold",
        due: 4,
        user: "u2",
        party: "Purchaser",
      },
    ],
    bond: { status: "Approved in principle", institution: "FNB", appliedAt: past(20) },
    cancelled: undefined,
  },
  {
    ref: "DSP-2026-0099",
    propertyId: "p7",
    stage: "Conditions Pending",
    price: 88000000,
    bps: 750,
    branch: "Sandton",
    stageDays: 19,
    practitioners: [{ userId: "u5", role: "Listing Agent", splitPct: 100, external: false }],
    seller: ["Sandown Mews Body Corporate", "Company", "Complete"],
    purchaser: ["Palesa Motaung", "Natural Person", "Partial"],
    conds: [
      {
        type: "Bond Approval",
        desc: "Bond declined — purchaser withdrew",
        due: -14,
        status: "Failed",
        user: "u5",
        party: "Purchaser",
      },
    ],
    bond: { status: "Declined", institution: "Nedbank", appliedAt: past(48), decidedAt: past(14) },
    cancelled: { reason: "Bond declined", daysAgo: 12 },
  },
];

export const deals: Deal[] = seeds.map((s, i) => {
  const id = `d${i + 1}`;
  const prop = propertyById(s.propertyId);
  return {
    id,
    ref: s.ref,
    propertyId: s.propertyId,
    stage: s.stage,
    cancelled: s.cancelled
      ? { reason: s.cancelled.reason, at: past(s.cancelled.daysAgo) }
      : undefined,
    salePrice: s.price,
    listingPrice: Math.round(s.price * 1.05),
    commissionBps: s.bps,
    mandateType: s.mandateType ?? "Sole",
    mandateSigned: past(90 + i),
    mandateExpiry: d(90 - i * 4),
    otpSigned: STAGES.indexOf(s.stage) >= 3 ? past(40 + i) : undefined,
    occupationDate: STAGES.indexOf(s.stage) >= 3 ? d(30 + i) : undefined,
    registeredAt: s.registeredDaysAgo != null ? past(s.registeredDaysAgo) : undefined,
    branch: s.branch,
    stageSince: past(s.stageDays),
    bond: s.bond,
    conveyancer: conveyancers[i % conveyancers.length],
    practitioners: s.practitioners,
    parties: [
      mkParty(id, 1, "Seller", s.seller[0], s.seller[1], s.seller[2]),
      ...(s.purchaser[0] !== "—"
        ? [mkParty(id, 2, "Purchaser", s.purchaser[0], s.purchaser[1], s.purchaser[2])]
        : []),
    ],
    conditions: s.conds.map((c, j) => ({
      id: `${id}-c${j + 1}`,
      dealId: id,
      type: c.type,
      description: c.desc,
      dueDate: d(c.due),
      originalDueDate: c.due > 0 ? d(c.due - 7) : undefined,
      status: c.status ?? "Open",
      responsibleUserId: c.user,
      responsibleParty: c.party,
    })),
    offers:
      STAGES.indexOf(s.stage) >= 2
        ? [
            {
              id: `${id}-o1`,
              price: s.price,
              deposit: Math.round(s.price * 0.1),
              bondAmount: Math.round(s.price * 0.85),
              expiry: d(6 - i),
              purchaser: s.purchaser[0],
              occupationDate: d(30 + i),
              status: "Accepted",
            },
            {
              id: `${id}-o2`,
              price: Math.round(s.price * 0.94),
              deposit: Math.round(s.price * 0.05),
              bondAmount: Math.round(s.price * 0.9),
              expiry: past(4),
              purchaser: "W. Naidoo",
              occupationDate: d(45),
              status: "Rejected",
            },
            {
              id: `${id}-o3`,
              price: Math.round(s.price * 0.97),
              deposit: Math.round(s.price * 0.15),
              bondAmount: Math.round(s.price * 0.8),
              expiry: d(3),
              purchaser: "K. Erasmus",
              occupationDate: d(60),
              status: "Pending",
            },
          ]
        : [],
    timeline: STAGES.slice(0, STAGES.indexOf(s.stage) + 1)
      .map((st, k, arr) => ({
        id: `${id}-t${k}`,
        at: past(90 - k * 6 + i),
        from: k === 0 ? undefined : arr[k - 1],
        to: st,
        actor:
          k % 3 === 0
            ? userById(s.practitioners[0].userId).name
            : "registrations@" + conveyancers[i % 4].split(" ")[0].toLowerCase() + ".co.za",
        action: k === 0 ? "Deal created" : "Stage advanced",
        reason: k === 4 ? "All suspensive conditions captured" : undefined,
      }))
      .reverse(),
    documents: mkDocs(id, 6),
    // keep property reference implicitly resolvable
    ...(prop ? {} : {}),
  } as Deal;
});

export const dealById = (id: string) => deals.find((x) => x.id === id || x.ref === id);

export const allConditions: (Condition & { deal: Deal })[] = deals.flatMap((dl) =>
  dl.conditions.map((c) => ({ ...c, deal: dl })),
);

export const openConditions = allConditions.filter(
  (c) => c.status === "Open" || c.status === "Extended",
);

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
  {
    id: "rs2",
    name: "Legacy 2025 Structure",
    effectiveFrom: "2025-01-01",
    effectiveTo: "2025-12-31",
    isDefault: false,
    vatInclusive: true,
    defaultBps: 700,
    rounding: "Nearest rand",
    officeSharePct: 50,
    deductions: [
      { id: "dl4", type: "Franchise Fee", basis: "Percentage", bps: 700, payee: "Head Office" },
    ],
  },
  {
    id: "rs3",
    name: "Referral Partner Structure",
    effectiveFrom: "2026-03-01",
    isDefault: false,
    vatInclusive: false,
    defaultBps: 550,
    rounding: "Nearest cent",
    officeSharePct: 40,
    deductions: [
      {
        id: "dl5",
        type: "Referral Fee",
        basis: "Percentage",
        bps: 2500,
        payee: "Referral Partner",
      },
      { id: "dl6", type: "Desk Fee", basis: "Fixed", fixed: 180000, payee: "Agency" },
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
  const gross = Math.round((deal.salePrice * deal.commissionBps) / 10000);
  const vat = Math.round(gross - gross / (1 + VAT_RATE));
  const net = gross - vat;
  const franchise = Math.round(
    (net * (rules.deductions.find((x) => x.type === "Franchise Fee")?.bps ?? 0)) / 10000,
  );
  const referral = Math.round(
    (net * (rules.deductions.find((x) => x.type === "Referral Fee")?.bps ?? 0)) / 10000,
  );
  const pool = net - franchise - referral;
  const office = Math.round((pool * rules.officeSharePct) / 100);
  const agentPool = pool - office;
  const desk = rules.deductions.find((x) => x.type === "Desk Fee")?.fixed ?? 0;
  const advance = deal.id === "d1" ? 1500000 : 0;
  return [
    {
      label: "Gross commission",
      formula: `${zarRate(deal.salePrice)} × ${(deal.commissionBps / 100).toFixed(2)}%`,
      amount: gross,
      kind: "base",
    },
    { label: "Less VAT (15%)", formula: "gross − gross ÷ 1.15", amount: -vat, kind: "deduct" },
    { label: "Net commission (excl. VAT)", formula: "gross − VAT", amount: net, kind: "subtotal" },
    {
      label: `Less franchise fee`,
      formula: `net × ${((rules.deductions.find((x) => x.type === "Franchise Fee")?.bps ?? 0) / 100).toFixed(2)}%`,
      amount: -franchise,
      kind: "deduct",
    },
    {
      label: "Less referral fee",
      formula: `net × ${((rules.deductions.find((x) => x.type === "Referral Fee")?.bps ?? 0) / 100).toFixed(2)}%`,
      amount: -referral,
      kind: "deduct",
    },
    { label: "Distributable pool", formula: "net − deductions", amount: pool, kind: "subtotal" },
    {
      label: `Office share (${rules.officeSharePct}%)`,
      formula: `pool × ${rules.officeSharePct}%`,
      amount: -office,
      kind: "deduct",
    },
    { label: "Agent pool", formula: "pool − office share", amount: agentPool, kind: "subtotal" },
    { label: "Less desk fee", formula: "fixed per registration", amount: -desk, kind: "deduct" },
    {
      label: "Less advance recovery",
      formula: "outstanding advances",
      amount: -advance,
      kind: "deduct",
    },
    {
      label: "Net payable to practitioners",
      formula: "agent pool − deductions",
      amount: agentPool - desk - advance,
      kind: "final",
    },
  ];
}

function zarRate(cents: number) {
  return `R ${(cents / 100).toLocaleString("en-ZA")}`;
}

export function grossCommission(deal: Deal) {
  return Math.round((deal.salePrice * deal.commissionBps) / 10000);
}

export function netPayable(deal: Deal) {
  const w = commissionWaterfall(deal);
  return w[w.length - 1].amount;
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

export const leads: Lead[] = [
  {
    id: "l1",
    name: "Sizwe Ngcobo",
    email: "sizwe.n@gmail.com",
    mobile: "082 331 4409",
    source: "Bond",
    assignedTo: "u2",
    status: "New",
    createdAt: past(1),
    payload: "Calculated bond repayment for R2,500,000 loan at 11.50% over 20 years",
    notes: "",
  },
  {
    id: "l2",
    name: "Elmarie Joubert",
    email: "elmarie@outlook.com",
    mobile: "073 552 1180",
    source: "Transfer",
    assignedTo: "u3",
    status: "Contacted",
    createdAt: past(3),
    payload: "Transfer costs on a R1,850,000 purchase with R1,600,000 bond",
    notes: "Wants Fourways stock under R2m.",
  },
  {
    id: "l3",
    name: "Tebogo Maluleke",
    email: "tebogo.m@yahoo.com",
    mobile: "071 220 7788",
    source: "Affordability",
    status: "New",
    createdAt: past(4),
    payload: "Affordability on R68,000 gross monthly income, R21,000 expenses",
    notes: "",
  },
  {
    id: "l4",
    name: "Werner Botha",
    email: "wbotha@icloud.com",
    mobile: "084 776 3312",
    source: "Yield",
    assignedTo: "u4",
    status: "Qualified",
    createdAt: past(8),
    payload: "Rental yield on R1,200,000 purchase with R9,800 monthly rental",
    notes: "Investor, looking for 3 units.",
  },
  {
    id: "l5",
    name: "Nadia Cassim",
    email: "nadia.c@gmail.com",
    mobile: "079 118 4420",
    source: "Bond",
    assignedTo: "u2",
    status: "Converted",
    createdAt: past(21),
    payload: "Bond repayment for R4,100,000 at 10.75% over 25 years",
    notes: "Now DSP-2026-0141 purchaser referral.",
  },
  {
    id: "l6",
    name: "Johan Pretorius",
    email: "jpret@webmail.co.za",
    mobile: "082 990 1123",
    source: "Transfer",
    status: "Closed",
    createdAt: past(35),
    payload: "Transfer costs on R950,000 purchase, no bond",
    notes: "Bought privately.",
  },
  {
    id: "l7",
    name: "Lindiwe Sibeko",
    email: "lindiwe.s@gmail.com",
    mobile: "076 445 9021",
    source: "Affordability",
    assignedTo: "u5",
    status: "Contacted",
    createdAt: past(6),
    payload: "Affordability on R42,000 gross monthly income, R14,500 expenses",
    notes: "First-time buyer, Midrand.",
  },
  {
    id: "l8",
    name: "Ravi Naicker",
    email: "ravi.naicker@gmail.com",
    mobile: "083 224 6677",
    source: "Yield",
    assignedTo: "u3",
    status: "New",
    createdAt: past(2),
    payload: "Rental yield on R2,300,000 Sandton apartment at R18,500 rental",
    notes: "",
  },
];

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

export const auditEvents: AuditEvent[] = Array.from({ length: 48 }, (_, i) => {
  const dl = deals[i % deals.length];
  const u = users[i % users.length];
  const actions: AuditEvent["action"][] = [
    "Created",
    "Updated",
    "Stage Changed",
    "Calculated",
    "Deleted",
  ];
  const action = actions[i % actions.length];
  const entities: AuditEvent["entityType"][] = [
    "Deal",
    "Condition",
    "Commission",
    "User",
    "Document",
    "Property",
  ];
  const entityType = entities[i % entities.length];
  return {
    id: `a${i + 1}`,
    at: new Date(Date.now() - i * 7_600_000).toISOString(),
    user: u.name,
    entityType,
    entityRef: entityType === "User" ? u.email : dl.ref,
    action,
    summary:
      action === "Stage Changed"
        ? `Stage moved to ${dl.stage}`
        : action === "Calculated"
          ? `Commission recalculated (${zarRate(grossCommission(dl))} gross)`
          : `${entityType} record ${action.toLowerCase()}`,
    before: {
      stage: STAGES[Math.max(0, STAGES.indexOf(dl.stage) - 1)],
      salePrice: dl.salePrice - 100000,
    },
    after: { stage: dl.stage, salePrice: dl.salePrice },
  };
});

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

export const fallThroughReasons = [
  { reason: "Bond declined", count: 7 },
  { reason: "Purchaser withdrew", count: 4 },
  { reason: "Seller withdrew", count: 2 },
  { reason: "Conditions lapsed", count: 3 },
  { reason: "Valuation shortfall", count: 2 },
  { reason: "Other", count: 1 },
];

export const monthlyCommission = [
  { month: "Feb", gross: 41200000, agent: 18500000 },
  { month: "Mar", gross: 52800000, agent: 23100000 },
  { month: "Apr", gross: 38600000, agent: 17200000 },
  { month: "May", gross: 61400000, agent: 27900000 },
  { month: "Jun", gross: 57300000, agent: 25600000 },
  { month: "Jul", gross: 69800000, agent: 31400000 },
];

export const forecast = [
  { month: "Aug", projected: 72400000 },
  { month: "Sep", projected: 88100000 },
  { month: "Oct", projected: 64200000 },
  { month: "Nov", projected: 95600000 },
  { month: "Dec", projected: 51300000 },
  { month: "Jan", projected: 43800000 },
];

export const advances = [
  {
    id: "adv1",
    userId: "u2",
    amount: 1500000,
    date: past(40),
    dealRef: "DSP-2026-0141",
    recovered: 0,
    status: "Outstanding",
  },
  {
    id: "adv2",
    userId: "u4",
    amount: 800000,
    date: past(75),
    dealRef: "DSP-2026-0129",
    recovered: 800000,
    status: "Recovered",
  },
  {
    id: "adv3",
    userId: "u5",
    amount: 600000,
    date: past(20),
    dealRef: "DSP-2026-0122",
    recovered: 200000,
    status: "Partial",
  },
];

export const notifications = [
  {
    id: "n1",
    title: "Condition due in 1 day",
    body: "DSP-2026-0143 — guarantees outstanding",
    at: past(0),
    unread: true,
    tone: "warning" as const,
  },
  {
    id: "n2",
    title: "FFC expired",
    body: "Kagiso Sithole's FFC lapsed 12 days ago",
    at: past(1),
    unread: true,
    tone: "danger" as const,
  },
  {
    id: "n3",
    title: "Deal registered",
    body: "DSP-2026-0134 registered at Deeds Office",
    at: past(3),
    unread: true,
    tone: "success" as const,
  },
  {
    id: "n4",
    title: "New lead",
    body: "Sizwe Ngcobo via Bond Calculator",
    at: past(1),
    unread: true,
    tone: "info" as const,
  },
  {
    id: "n5",
    title: "Mandate expiring",
    body: "DSP-2026-0151 mandate expires in 21 days",
    at: past(4),
    unread: false,
    tone: "warning" as const,
  },
];
