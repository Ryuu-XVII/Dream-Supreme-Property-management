export interface PdfDocumentTypeDef {
  id: string;
  label: string;
  description: string;
  group: "Deal & Compliance Documents" | "Reports";
  /**
   * Which default-template layout `buildDefaultTemplate` composes for this
   * type: a two-party contract with a signature block ("legal"), a formal
   * bordered certificate ("certificate"), or an executive-summary cover
   * sheet with KPI tiles ("report").
   */
  layout: "legal" | "certificate" | "report";
  /**
   * The `document.category` enum value a generated instance of this document
   * type is stored under. Undefined for report types, which aren't stored
   * as `document` rows.
   */
  documentCategory?: string;
  /**
   * Sample merge-field values shown in the designer as starter text fields
   * and default placeholder content, so an admin can see how a field will
   * render without needing a real deal on hand. The field names here are
   * the contract a "Generate" action must fill with real data.
   */
  sampleInput: Record<string, string>;
  /**
   * Sample category/value breakdown charted as a bar chart on "report"-layout
   * templates (e.g. deals per stage, cancellation reasons). Static/decorative
   * — like the rest of a default template, it's a starting visual an admin
   * customizes, not merge-field data a "Generate" action fills in.
   */
  chartData?: { label: string; value: number }[];
}

export const PDF_DOCUMENT_TYPES: PdfDocumentTypeDef[] = [
  {
    id: "offer_to_purchase",
    label: "Offer to Purchase",
    description: "Signed OTP summary generated from deal and party data.",
    group: "Deal & Compliance Documents",
    layout: "legal",
    documentCategory: "otp",
    sampleInput: {
      dealReference: "DSP-2026-00001",
      propertyAddress: "150 Frikkie De Beer St, Pretoria",
      sellerName: "Jane Seller",
      purchaserName: "John Purchaser",
      salePrice: "R 2,500,000.00",
      effectiveDate: "21 August 2026",
    },
  },
  {
    id: "mandate_agreement",
    label: "Mandate Agreement",
    description: "Sole/open mandate summary generated from the property listing.",
    group: "Deal & Compliance Documents",
    layout: "legal",
    documentCategory: "mandate",
    sampleInput: {
      propertyAddress: "150 Frikkie De Beer St, Pretoria",
      mandateType: "Sole Mandate",
      listingPrice: "R 2,650,000.00",
      commissionRate: "6.00%",
      signedOn: "1 July 2026",
      expiresOn: "1 January 2027",
    },
  },
  {
    id: "deal_registration_certificate",
    label: "Deal Registration Certificate",
    description: "Confirmation certificate issued once a deal is registered and closed.",
    group: "Deal & Compliance Documents",
    layout: "certificate",
    documentCategory: "other",
    sampleInput: {
      dealReference: "DSP-2026-00001",
      propertyAddress: "150 Frikkie De Beer St, Pretoria",
      salePrice: "R 2,500,000.00",
      registrationDate: "21 August 2026",
      agentName: "Alex Agent",
    },
  },
  {
    id: "ffc_certificate",
    label: "FFC Certificate Cover Sheet",
    description: "Cover sheet accompanying an agent's Fidelity Fund Certificate.",
    group: "Deal & Compliance Documents",
    layout: "certificate",
    documentCategory: "ffc_certificate",
    sampleInput: {
      agentName: "Alex Agent",
      certificateNumber: "FFC2023223906",
      expiresOn: "31 December 2026",
    },
  },
  {
    id: "lease_agreement",
    label: "Lease Agreement",
    description: "Residential lease contract generated during lease onboarding.",
    group: "Deal & Compliance Documents",
    layout: "legal",
    documentCategory: "other",
    sampleInput: {
      propertyAddress: "150 Frikkie De Beer St, Pretoria",
      landlordName: "Jane Landlord",
      tenantName: "John Tenant",
      monthlyRent: "R 15,000.00",
      startDate: "1 September 2026",
      endDate: "31 August 2027",
    },
  },
  {
    id: "pipeline_report",
    label: "Pipeline Report",
    description: "Active deals by stage and value.",
    group: "Reports",
    layout: "report",
    sampleInput: {
      generatedOn: "21 August 2026",
      totalActiveDeals: "18",
      totalPipelineValue: "R 42,300,000.00",
    },
    chartData: [
      { label: "Listing", value: 5 },
      { label: "OTP Signed", value: 4 },
      { label: "Conditions", value: 3 },
      { label: "Conveyancing", value: 3 },
      { label: "Lodged", value: 2 },
      { label: "Registered", value: 1 },
    ],
  },
  {
    id: "fallthrough_report",
    label: "Fall-through Report",
    description: "Cancelled deals and recorded reasons.",
    group: "Reports",
    layout: "report",
    sampleInput: {
      generatedOn: "21 August 2026",
      totalCancelledDeals: "3",
    },
    chartData: [
      { label: "Buyer Finance Declined", value: 2 },
      { label: "Failed Inspection", value: 1 },
      { label: "Change of Mind", value: 0 },
    ],
  },
  {
    id: "commission_report",
    label: "Commission Report",
    description: "Live deal commission exposure.",
    group: "Reports",
    layout: "report",
    sampleInput: {
      generatedOn: "21 August 2026",
      totalCommissionExposure: "R 2,538,000.00",
    },
    chartData: [
      { label: "Alex Agent", value: 612000 },
      { label: "Sam Practitioner", value: 487000 },
      { label: "Jordan Broker", value: 355000 },
      { label: "Other Agents", value: 1084000 },
    ],
  },
  {
    id: "compliance_report",
    label: "Compliance Report",
    description: "Current FFC coverage across visible users.",
    group: "Reports",
    layout: "report",
    sampleInput: {
      generatedOn: "21 August 2026",
      agentsCovered: "12 / 14",
    },
    chartData: [
      { label: "FFC Current", value: 12 },
      { label: "Expiring Soon", value: 1 },
      { label: "Expired", value: 1 },
    ],
  },
];

export function getPdfDocumentType(id: string | undefined): PdfDocumentTypeDef | undefined {
  return PDF_DOCUMENT_TYPES.find((doc) => doc.id === id);
}
