import { STAGES } from "@/types";

export { STAGES };

export const users: any[] = [];
export const userById: any = (id: string) => undefined;
export const branches: any[] = [];
export const properties: any[] = [];
export const propertyById: any = (id: string) => undefined;
export const deals: any[] = [];
export const dealById: any = (id: string) => undefined;
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
};
export const conveyancerFirms: any[] = [];
export const transferDutyBrackets: any[] = [];
export const notificationTypes: any[] = [];
export const fallThroughReasons: any[] = [];
export const monthlyCommission: any[] = [];
export const forecast: any[] = [];
export const advances: any[] = [];
export const notifications: any[] = [];

export const netPayable: any = () => 0;
export const grossCommission: any = () => 0;
export const commissionWaterfall: any = () => [];
