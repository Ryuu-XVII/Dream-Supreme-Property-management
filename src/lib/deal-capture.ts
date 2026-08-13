import type { EntityType } from "@/types";

export type FicaStatus = "Complete" | "Partial" | "Not Started";

export interface DealPartyInput {
  name: string;
  sharePercent: string;
  entityType: EntityType;
  idNumber: string;
  email: string;
  mobile: string;
  taxNumber: string;
  dateOfBirth: string;
  maritalStatus: string;
  nationality: string;
  isSaResident: boolean;
  passportNumber: string;
  passportCountry: string;
  representativeName: string;
  representativeCapacity: string;
  beneficialOwnerDetails: string;
  sourceOfFunds: string;
  fica: FicaStatus;
  sanctionsScreened: boolean;
  riskRating: "Low" | "Medium" | "High";
  isProminentPerson: boolean;
  isVatVendor: boolean;
  popiaConsent: boolean;
}

export interface DealCaptureForm {
  address: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  legalDescription: string;
  deedsOffice: string;
  erfNumber: string;
  titleDeedNumber: string;
  propertyType:
    | "Freehold House"
    | "Sectional Title"
    | "Estate House"
    | "Townhouse"
    | "Vacant Land"
    | "Farm"
    | "Commercial"
    | "Industrial"
    | "Other";
  propertyUse: string;
  isImproved: boolean;
  transferSharePercent: string;
  beds: number;
  baths: number;
  garages: number;
  floorSize: number;
  erfSize: number;
  sellerAcquiredOn: string;
  sellerOriginalPurchasePrice: string;
  mandateType: "Sole" | "Joint" | "Open";
  listingPrice: string;
  commissionBps: string;
  mandateSigned: string;
  mandateExpiry: string;
  sellers: DealPartyInput[];
  purchasers: DealPartyInput[];
  salePrice: string;
  effectiveDate: string;
  offerExpiresOn: string;
  isVatSale: boolean;
  vatInclusive: boolean;
  saleMethod: string;
  partiesConnected: boolean;
  sellerIsNonResident: boolean;
  depositAmount: string;
  depositDueOn: string;
  depositHolder: string;
  balancePaymentMethod: string;
  occupationDate: string;
  occupationalRent: string;
  conveyancer: string;
  conveyancerReference: string;
  agentId: string;
  bondRequired: boolean;
  bondAmount: string;
  bondDueDate: string;
  subjectToSale: boolean;
  subjectToSaleDesc: string;
  subjectToSaleDueDate: string;
  ficaRequired: boolean;
  ficaDueDate: string;
  fixturesIncluded: string;
  fixturesExcluded: string;
  specialConditions: string;
  propertyDisclosureCompleted: boolean;
  disclosureDefects: string;
}

const dateValue = (daysFromNow = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
};

export function createEmptyParty(): DealPartyInput {
  return {
    name: "",
    sharePercent: "100",
    entityType: "Natural Person",
    idNumber: "",
    email: "",
    mobile: "",
    taxNumber: "",
    dateOfBirth: "",
    maritalStatus: "Single",
    nationality: "South African",
    isSaResident: true,
    passportNumber: "",
    passportCountry: "",
    representativeName: "",
    representativeCapacity: "",
    beneficialOwnerDetails: "",
    sourceOfFunds: "",
    fica: "Not Started",
    sanctionsScreened: false,
    riskRating: "Medium",
    isProminentPerson: false,
    isVatVendor: false,
    popiaConsent: false,
  };
}

export function createInitialDealCapture(): DealCaptureForm {
  return {
    address: "",
    suburb: "",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "",
    legalDescription: "",
    deedsOffice: "",
    erfNumber: "",
    titleDeedNumber: "",
    propertyType: "Freehold House",
    propertyUse: "Primary residence",
    isImproved: true,
    transferSharePercent: "100",
    beds: 3,
    baths: 2,
    garages: 2,
    floorSize: 180,
    erfSize: 500,
    sellerAcquiredOn: "",
    sellerOriginalPurchasePrice: "",
    mandateType: "Sole",
    listingPrice: "",
    commissionBps: "500",
    mandateSigned: dateValue(),
    mandateExpiry: dateValue(90),
    sellers: [createEmptyParty()],
    purchasers: [createEmptyParty()],
    salePrice: "",
    effectiveDate: dateValue(),
    offerExpiresOn: "",
    isVatSale: false,
    vatInclusive: true,
    saleMethod: "Private treaty",
    partiesConnected: false,
    sellerIsNonResident: false,
    depositAmount: "0",
    depositDueOn: "",
    depositHolder: "Conveyancer trust account",
    balancePaymentMethod: "Bond and/or bank guarantee",
    occupationDate: "",
    occupationalRent: "0",
    conveyancer: "",
    conveyancerReference: "",
    agentId: "",
    bondRequired: true,
    bondAmount: "",
    bondDueDate: dateValue(21),
    subjectToSale: false,
    subjectToSaleDesc: "",
    subjectToSaleDueDate: dateValue(30),
    ficaRequired: true,
    ficaDueDate: dateValue(7),
    fixturesIncluded: "",
    fixturesExcluded: "",
    specialConditions: "",
    propertyDisclosureCompleted: false,
    disclosureDefects: "",
  };
}

const positiveMoney = (value: string) => Number.isFinite(Number(value)) && Number(value) > 0;

function validateParty(party: DealPartyInput, label: string, salePrice: number) {
  const errors: string[] = [];
  if (!party.name.trim()) errors.push(`${label}: full legal name is required.`);
  if (!party.idNumber.trim())
    errors.push(`${label}: ID, passport, or registration number is required.`);
  if (!party.email.trim() && !party.mobile.trim()) {
    errors.push(`${label}: an email address or mobile number is required.`);
  }
  if (!party.sanctionsScreened) {
    errors.push(`${label}: targeted-financial-sanctions screening must be completed.`);
  }
  if (!(Number(party.sharePercent) > 0 && Number(party.sharePercent) <= 100)) {
    errors.push(`${label}: ownership share must be above 0% and at most 100%.`);
  }
  if (party.entityType === "Natural Person") {
    if (!party.dateOfBirth) errors.push(`${label}: date of birth is required.`);
    if (!party.maritalStatus) errors.push(`${label}: marital status is required.`);
    if (!party.isSaResident && (!party.passportNumber.trim() || !party.passportCountry.trim())) {
      errors.push(`${label}: passport number and issuing country are required for a non-resident.`);
    }
    if (salePrice >= 2_000_000 && !party.taxNumber.trim()) {
      errors.push(
        `${label}: SARS income-tax number is required for a transaction of R2 million or more.`,
      );
    }
  } else {
    if (!party.taxNumber.trim()) errors.push(`${label}: entity income-tax number is required.`);
    if (!party.representativeName.trim() || !party.representativeCapacity.trim()) {
      errors.push(`${label}: authorised representative and capacity are required.`);
    }
    if (!party.beneficialOwnerDetails.trim()) {
      errors.push(`${label}: beneficial-owner details are required for FICA.`);
    }
  }
  return errors;
}

export function validateDealStep(form: DealCaptureForm, step: number): string[] {
  const errors: string[] = [];
  const salePrice = Number(form.salePrice);

  if (step === 1) {
    if (!form.address.trim() || !form.suburb.trim() || !form.city.trim() || !form.province) {
      errors.push("Physical address, suburb, city, and province are required.");
    }
    if (!form.legalDescription.trim())
      errors.push("The deeds-search legal description is required.");
    if (!form.titleDeedNumber.trim()) errors.push("The current title deed number is required.");
    if (!positiveMoney(form.listingPrice)) errors.push("Enter a valid listing price.");
    const share = Number(form.transferSharePercent);
    if (!(share > 0 && share <= 100))
      errors.push("The ownership share must be above 0% and at most 100%.");
    if (!form.mandateSigned || !form.mandateExpiry)
      errors.push("Mandate signature and expiry dates are required.");
    if (form.mandateSigned && form.mandateExpiry && form.mandateExpiry < form.mandateSigned) {
      errors.push("Mandate expiry cannot be before its signature date.");
    }
  }

  if (step === 2) {
    if (form.sellers.length === 0) errors.push("At least one seller is required.");
    if (form.purchasers.length === 0) errors.push("At least one purchaser is required.");
    const sellerShare = form.sellers.reduce(
      (total, party) => total + Number(party.sharePercent),
      0,
    );
    const purchaserShare = form.purchasers.reduce(
      (total, party) => total + Number(party.sharePercent),
      0,
    );
    if (Math.abs(sellerShare - 100) > 0.001)
      errors.push("Seller ownership shares must total 100%.");
    if (Math.abs(purchaserShare - 100) > 0.001)
      errors.push("Purchaser ownership shares must total 100%.");
    form.sellers.forEach((party, index) =>
      errors.push(...validateParty(party, `Seller ${index + 1}`, salePrice)),
    );
    form.purchasers.forEach((party, index) => {
      errors.push(...validateParty(party, `Purchaser ${index + 1}`, salePrice));
      if (!party.sourceOfFunds.trim()) {
        errors.push(
          `Purchaser ${index + 1}: source of funds is required for FICA risk assessment.`,
        );
      }
    });
  }

  if (step === 3) {
    if (!positiveMoney(form.salePrice)) errors.push("Enter a valid agreed sale price.");
    if (!form.effectiveDate) errors.push("The agreement effective date is required.");
    if (form.offerExpiresOn && form.effectiveDate && form.offerExpiresOn < form.effectiveDate) {
      errors.push("Offer expiry cannot be before the agreement effective date.");
    }
    if (Number(form.depositAmount) > 0 && (!form.depositDueOn || !form.depositHolder.trim())) {
      errors.push("Deposit due date and stakeholder are required when a deposit is payable.");
    }
    if (form.occupationDate && Number(form.occupationalRent) < 0) {
      errors.push("Occupational rent cannot be negative.");
    }
    if (!form.balancePaymentMethod.trim())
      errors.push("The balance payment or guarantee method is required.");
    if (!form.agentId) errors.push("Select the lead property practitioner.");
    if (form.isVatSale && !form.sellers.some((seller) => seller.isVatVendor)) {
      errors.push("A VAT sale requires at least one seller to be recorded as a VAT vendor.");
    }
  }

  if (step === 4) {
    if (form.bondRequired && (!positiveMoney(form.bondAmount) || !form.bondDueDate)) {
      errors.push("Bond amount and approval deadline are required for a financed sale.");
    }
    if (form.subjectToSale && (!form.subjectToSaleDesc.trim() || !form.subjectToSaleDueDate)) {
      errors.push("Describe the purchaser's property and capture the sale-condition deadline.");
    }
    if (form.ficaRequired && !form.ficaDueDate) errors.push("Capture the FICA clearance deadline.");
  }

  if (step === 5 && !form.propertyDisclosureCompleted) {
    errors.push("Confirm that the statutory PPRA property condition disclosure was completed.");
  }

  return errors;
}

export function validateDealCapture(form: DealCaptureForm) {
  return [1, 2, 3, 4, 5].flatMap((step) => validateDealStep(form, step));
}
