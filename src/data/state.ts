import { STAGES } from "@/types";

export { STAGES };
export type {
  AuditEvent,
  Condition,
  ConditionStatus,
  ConditionType,
  Deal,
  DeductionLine,
  DocumentRec,
  Lead,
  Offer,
  Party,
  Property,
  Role,
  RuleSet,
  Stage,
  User,
} from "@/types";

export const users: any[] = [];
export const userById: any = (_id: string) => undefined;
export const branches: any[] = [];
export const properties: any[] = [];
export const propertyById: any = (_id: string) => undefined;
export const deals: any[] = [];
export const dealById: any = (_id: string) => undefined;
export const allConditions: any[] = [];
export const openConditions: any[] = [];
export const ruleSets: any[] = [];
export const ruleTemplates: any[] = [];
export const VAT_RATE = 15;
export const leads: any[] = [];
export const auditEvents: any[] = [];
export const agency = {
  name: "Dream Supreme Properties",
  logo: null,
  registration: "",
  ppra: "",
  vatNumber: "",
  vatVendor: false,
  address: "",
};
export const conveyancerFirms: any[] = [];
// SARS transfer-duty schedule effective 1 April 2026 (unchanged from 2025).
// Monetary values are cents; update this table only from the published SARS schedule.
export const transferDutyBrackets = [
  { from: 0, to: 121_000_000, rate: 0, base: 0 },
  { from: 121_000_000, to: 166_380_000, rate: 3, base: 0 },
  { from: 166_380_000, to: 232_930_000, rate: 6, base: 1_361_400 },
  { from: 232_930_000, to: 299_480_000, rate: 8, base: 5_354_400 },
  { from: 299_480_000, to: 1_331_000_000, rate: 11, base: 10_678_400 },
  { from: 1_331_000_000, to: null, rate: 13, base: 124_145_600 },
];
export const notificationTypes = [
  "Suspensive condition deadline",
  "Suspensive condition overdue",
  "Mandate expiry",
  "FFC expiry",
  "New lead captured",
  "Deal stage changed",
  "Commission calculated",
  "Commission released",
];
export const fallThroughReasons: any[] = [];
export const monthlyCommission: any[] = [];
export const forecast: any[] = [];
export const advances: any[] = [];
export const notifications: any[] = [];

export const grossCommission: any = (deal: any) =>
  Math.round((deal.salePrice * deal.commissionBps) / 10000);
export const netPayable: any = (deal: any) => grossCommission(deal);
export const commissionWaterfall: any = () => [];
