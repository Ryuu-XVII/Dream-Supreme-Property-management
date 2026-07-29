export type ClientRole = "seller" | "purchaser" | "landlord" | "tenant" | "referrer";

export type ClientEntityType =
  "natural_person" | "company" | "close_corporation" | "trust" | "deceased_estate";

export interface ClientCaptureForm {
  name: string;
  roles: ClientRole[];
  entityType: ClientEntityType;
  email: string;
  mobile: string;
  preferredContactChannel: "email" | "phone" | "whatsapp";
  contactLanguage: string;
  acquisitionSource: string;
  assignedTo: string;
  processingBasis: "requested_service" | "mandate_contract" | "legal_obligation" | "consent";
  privacyNoticeDelivered: boolean;
  directMarketingConsent: boolean;
  directMarketingChannels: Array<"email" | "sms" | "whatsapp" | "phone">;
  onboardingNotes: string;
  startFica: boolean;
  idNumber: string;
  taxNumber: string;
  dateOfBirth: string;
  maritalStatus: string;
  nationality: string;
  isSaResident: boolean;
  passportNumber: string;
  passportCountry: string;
  addressLine: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  representativeName: string;
  representativeCapacity: string;
  beneficialOwnerDetails: string;
  sourceOfFunds: string;
  sanctionsScreened: boolean;
  riskRating: "low" | "medium" | "high";
  prominentPersonScreened: boolean;
  isProminentPerson: boolean;
}

export function createInitialClientCapture(): ClientCaptureForm {
  return {
    name: "",
    roles: ["seller"],
    entityType: "natural_person",
    email: "",
    mobile: "",
    preferredContactChannel: "phone",
    contactLanguage: "English",
    acquisitionSource: "",
    assignedTo: "",
    processingBasis: "requested_service",
    privacyNoticeDelivered: false,
    directMarketingConsent: false,
    directMarketingChannels: [],
    onboardingNotes: "",
    startFica: false,
    idNumber: "",
    taxNumber: "",
    dateOfBirth: "",
    maritalStatus: "",
    nationality: "South African",
    isSaResident: true,
    passportNumber: "",
    passportCountry: "",
    addressLine: "",
    suburb: "",
    city: "",
    province: "Gauteng",
    postalCode: "",
    representativeName: "",
    representativeCapacity: "",
    beneficialOwnerDetails: "",
    sourceOfFunds: "",
    sanctionsScreened: false,
    riskRating: "medium",
    prominentPersonScreened: false,
    isProminentPerson: false,
  };
}

export function validateClientCapture(form: ClientCaptureForm): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("Full legal name or registered entity name is required.");
  if (form.roles.length === 0) errors.push("Select at least one client role.");
  if (!form.email.trim() && !form.mobile.trim()) {
    errors.push("An email address or mobile number is required.");
  }
  if (form.preferredContactChannel === "email" && !form.email.trim()) {
    errors.push("An email address is required when email is the preferred contact method.");
  }
  if (
    (form.preferredContactChannel === "phone" || form.preferredContactChannel === "whatsapp") &&
    !form.mobile.trim()
  ) {
    errors.push("A mobile number is required for phone or WhatsApp contact.");
  }
  if (!form.privacyNoticeDelivered) {
    errors.push("Confirm that the POPIA privacy notice was delivered to the client.");
  }
  if (form.directMarketingConsent && form.directMarketingChannels.length === 0) {
    errors.push("Select at least one consented direct-marketing channel.");
  }

  if (!form.startFica) return errors;

  if (!form.idNumber.trim())
    errors.push("ID, passport, trust, or registration number is required.");
  if (!form.addressLine.trim() || !form.city.trim() || !form.province.trim()) {
    errors.push("Residential or registered address, city, and province are required for FICA.");
  }
  if (!form.sanctionsScreened) {
    errors.push("Targeted-financial-sanctions screening must be completed at client take-on.");
  }
  if (!form.prominentPersonScreened) {
    errors.push("Domestic/foreign prominent-person screening must be completed at client take-on.");
  }
  if (form.entityType === "natural_person") {
    if (!form.dateOfBirth) errors.push("Date of birth is required for a natural person.");
    if (!form.nationality.trim()) errors.push("Nationality is required for a natural person.");
    if (!form.isSaResident && (!form.passportNumber.trim() || !form.passportCountry.trim())) {
      errors.push("Passport number and issuing country are required for a non-resident.");
    }
  } else {
    if (!form.representativeName.trim() || !form.representativeCapacity.trim()) {
      errors.push("Authorised representative and capacity are required for an entity.");
    }
    if (!form.beneficialOwnerDetails.trim()) {
      errors.push("Beneficial-owner details are required for an entity.");
    }
  }
  if (form.roles.includes("purchaser") && !form.sourceOfFunds.trim()) {
    errors.push("Source of funds is required when onboarding a purchaser.");
  }
  return errors;
}
