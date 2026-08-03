import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  conditionStatusFromDb,
  conditionTypeFromDb,
  entityTypeFromDb,
  stageFromDb,
} from "@/lib/domain";

export interface PipelineDeal {
  id: string;
  ref: string;
  stage: string;
  status: string;
  salePrice: number;
  stageSince: string;
  property: {
    address: string;
    suburb: string;
    city: string;
  };
  agent: {
    id: string;
    name: string;
  };
  daysInStage: number;
  cancelled: { reason: string; at: string } | null;
  conditions: any[]; // To be expanded later
}

export function usePipelineDeals() {
  const { activeAccount } = useAuth();

  return useQuery({
    queryKey: ["pipeline-deals", activeAccount?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal")
        .select(
          `
          id,
          reference,
          stage,
          status,
          sale_price_cents,
          updated_at,
          cancellation_reason,
          cancelled_on,
          property:property_id ( address_line, suburb, city ),
          participants:deal_participant ( 
            role, 
            user:user_account_id ( id, full_name ) 
          ),
          conditions:suspensive_condition ( status, due_on )
        `,
        )
        .order("updated_at", { ascending: false });

      if (error) throw error;

      let filteredData = data as any[];
      if (activeAccount && (activeAccount.role === "agent" || activeAccount.role === "candidate")) {
        filteredData = filteredData.filter((d) =>
          d.participants?.some((p: any) => p.user?.id === activeAccount.id),
        );
      }

      return filteredData.map((d): PipelineDeal => {
        const agentParticipant =
          d.participants?.find((p: any) => p.role === "listing_agent") || d.participants?.[0];
        const agent = agentParticipant?.user || { id: "unknown", name: "Unassigned" };
        const stageSince = d.updated_at;
        const daysInStage = Math.round((Date.now() - new Date(stageSince).getTime()) / 86400000);

        return {
          id: d.id,
          ref: d.reference,
          stage: d.stage,
          status: d.status,
          salePrice: d.sale_price_cents, // Should be divided by 100 for display, handled in format.ts if it expects cents? wait, mock has salePrice. zar() divides by 100? No, zar(cents) takes cents. So salePrice is cents.
          stageSince,
          daysInStage,
          property: {
            address: d.property?.address_line || "Unknown Address",
            suburb: d.property?.suburb || "",
            city: d.property?.city || "",
          },
          agent: {
            id: agent.id,
            name: agent.full_name,
          },
          cancelled:
            d.status === "cancelled"
              ? { reason: d.cancellation_reason || "Other", at: d.cancelled_on }
              : null,
          conditions: d.conditions || [],
        };
      });
    },
  });
}

export function useDealDetail(dealId: string) {
  return useQuery({
    queryKey: ["deal", dealId],
    queryFn: async () => {
      // For now, to unblock the UI refactoring, we'll fetch the core deal data.
      // We will expand this to fetch offers, timeline, commission, etc. as we update those tabs.
      const { data: d, error } = await supabase
        .from("deal")
        .select(
          `
          id,
          reference,
          stage,
          status,
          sale_price_cents,
          mandate_id,
          otp_signed_on,
          occupation_date,
          occupational_rent_cents,
          registration_date,
          cancellation_reason,
          cancelled_on,
          created_at,
          updated_at,
          conveyancer:conveyancer_firm_id ( name, email ),
          mandate:mandate_id ( mandate_type, listing_price_cents, commission_rate_bps, signed_on, expires_on ),
          bond:bond_application ( status, institution, applied_on, status_updated_on ),
          property:property_id ( id, address_line, suburb, city, property_type, bedrooms, bathrooms, garages, erf_size_sqm, floor_size_sqm ),
          participants:deal_participant ( 
            role, 
            split_value,
            is_external,
            user:user_account_id ( id, full_name, email, mobile ) 
          ),
          parties:deal_party (
            role,
            party:party_id ( id, full_name, entity_type, email, mobile, id_or_reg_number, fica_status, popia_consent_at )
          ),
          conditions:suspensive_condition ( 
            id, condition_type, description, due_on, original_due_on, status, responsible_party 
          ),
          offers:offer ( id, offer_price_cents, deposit_cents, bond_amount_cents, expires_on, status, purchaser_party_id ),
          timeline:deal_stage_history ( id, from_stage, to_stage, reason, occurred_at, changed_by_external_email, user:changed_by ( full_name ) ),
          documents:document ( id, category, filename, storage_key, size_bytes, version, uploaded_at, user:uploaded_by ( full_name ) )
        `,
        )
        .eq("id", dealId)
        .single();

      if (error) throw error;
      return d;
    },
    enabled: !!dealId,
  });
}

export async function createDeal(formData: any) {
  const propertyTypes: Record<string, string> = {
    "Freehold House": "house",
    "Sectional Title": "apartment",
    "Estate House": "house",
    Townhouse: "townhouse",
    "Vacant Land": "vacant_land",
    Farm: "farm",
    Commercial: "commercial",
    Industrial: "industrial",
    Other: "other",
  };
  const entityTypes: Record<string, string> = {
    "Natural Person": "natural_person",
    Company: "company",
    "Close Corporation": "close_corporation",
    Trust: "trust",
    "Deceased Estate": "deceased_estate",
  };
  const ficaStatus = (value: string | undefined) =>
    value?.toLowerCase().replaceAll(" ", "_") || "not_started";
  const toCents = (value: string | number | undefined) => Math.round((Number(value) || 0) * 100);

  const conditions = [];
  if (formData.bondRequired && formData.bondDueDate) {
    conditions.push({
      type: "bond_approval",
      description: "Bond approval required",
      dueOn: formData.bondDueDate,
      responsibleParty: "Purchaser",
    });
  }
  if (formData.ficaRequired && formData.ficaDueDate) {
    conditions.push({
      type: "fica_clearance",
      description: "FICA clearance required",
      dueOn: formData.ficaDueDate,
      responsibleParty: "Purchaser",
    });
  }
  if (formData.subjectToSale && formData.subjectToSaleDueDate) {
    conditions.push({
      type: "sale_of_property",
      description: formData.subjectToSaleDesc || "Sale of purchaser's existing property",
      dueOn: formData.subjectToSaleDueDate,
      responsibleParty: "Purchaser",
    });
  }
  if (Number(formData.depositAmount) > 0 && formData.depositDueOn) {
    conditions.push({
      type: "other",
      description: `Deposit of R${Number(formData.depositAmount).toLocaleString("en-ZA")} payable to ${formData.depositHolder}`,
      dueOn: formData.depositDueOn,
      responsibleParty: "Purchaser",
    });
  }

  const partyPayload = (party: any) => ({
    name: party.name,
    sharePercent: Number(party.sharePercent),
    email: party.email,
    mobile: party.mobile,
    idNumber: party.idNumber,
    entityType: entityTypes[party.entityType] || "natural_person",
    maritalStatus: party.maritalStatus,
    isVatVendor: !!party.isVatVendor,
    ficaStatus: ficaStatus(party.fica),
    sanctionsScreened: !!party.sanctionsScreened,
    riskRating: String(party.riskRating || "medium").toLowerCase(),
    isProminentPerson: !!party.isProminentPerson,
    popiaConsent: !!party.popiaConsent,
    taxNumber: party.taxNumber,
    dateOfBirth: party.dateOfBirth,
    nationality: party.nationality,
    isSaResident: !!party.isSaResident,
    passportNumber: party.passportNumber,
    passportCountry: party.passportCountry,
    representativeName: party.representativeName,
    representativeCapacity: party.representativeCapacity,
    beneficialOwnerDetails: party.beneficialOwnerDetails,
    sourceOfFunds: party.sourceOfFunds,
  });

  const payload = {
    address: formData.address,
    suburb: formData.suburb,
    city: formData.city,
    province: formData.province || "Gauteng",
    postalCode: formData.postalCode,
    legalDescription: formData.legalDescription,
    deedsOffice: formData.deedsOffice,
    erfNumber: formData.erfNumber,
    titleDeedNumber: formData.titleDeedNumber,
    propertyType: propertyTypes[formData.propertyType] || "other",
    isSectionalTitle: formData.propertyType === "Sectional Title",
    bedrooms: Number(formData.beds) || 0,
    bathrooms: Number(formData.baths) || 0,
    garages: Number(formData.garages) || 0,
    erfSizeSqm: Number(formData.erfSize) || 0,
    floorSizeSqm: Number(formData.floorSize) || 0,
    propertyUse: formData.propertyUse,
    isImproved: !!formData.isImproved,
    sellerAcquiredOn: formData.sellerAcquiredOn,
    sellerOriginalPurchasePriceCents: toCents(formData.sellerOriginalPurchasePrice),
    mandateType: String(formData.mandateType || "sole").toLowerCase(),
    listingPriceCents: toCents(formData.listingPrice),
    commissionRateBps: Number(formData.commissionBps) || 0,
    mandateSignedOn: formData.mandateSigned,
    mandateExpiresOn: formData.mandateExpiry,
    salePriceCents: toCents(formData.salePrice),
    effectiveDate: formData.effectiveDate,
    offerExpiresOn: formData.offerExpiresOn,
    occupationDate: formData.occupationDate,
    conveyancer: formData.conveyancer,
    conveyancerReference: formData.conveyancerReference,
    branchId: formData.branchId,
    leadAgentId: formData.agentId,
    isVatSale: !!formData.isVatSale,
    vatInclusive: !!formData.vatInclusive,
    saleMethod: formData.saleMethod,
    transferSharePercent: Number(formData.transferSharePercent),
    partiesConnected: !!formData.partiesConnected,
    sellerIsNonResident:
      !!formData.sellerIsNonResident ||
      (formData.sellers || []).some((seller: any) => !seller.isSaResident),
    depositCents: toCents(formData.depositAmount),
    depositDueOn: formData.depositDueOn,
    depositHolder: formData.depositHolder,
    balancePaymentMethod: formData.balancePaymentMethod,
    occupationalRentCents: toCents(formData.occupationalRent),
    bondAmountCents: toCents(formData.bondAmount),
    propertyDisclosureCompleted: !!formData.propertyDisclosureCompleted,
    disclosureDefects: formData.disclosureDefects,
    fixturesIncluded: formData.fixturesIncluded,
    fixturesExcluded: formData.fixturesExcluded,
    specialConditions: formData.specialConditions,
    sellers: (formData.sellers || []).map(partyPayload),
    purchasers: (formData.purchasers || []).map(partyPayload),
    conditions,
  };

  const { data, error } = await supabase.rpc("create_deal", { p_payload: payload });
  if (error) throw error;
  if (!data) throw new Error("The deal could not be created.");
  return data as string;
}

export function useMyEarnings() {
  return useQuery({
    queryKey: ["my-earnings"],
    queryFn: async () => {
      const userRes = await supabase.auth.getUser();
      const authUserId = userRes.data.user?.id;
      if (!authUserId)
        return {
          ytdEarnings: 0,
          pendingPipeline: 0,
          dealsYtd: 0,
          avgPerDeal: 0,
          dealRows: [],
          agentName: "Agent",
        };

      const { data: userAcc } = await supabase
        .from("user_account")
        .select("id, full_name")
        .eq("auth_user_id", authUserId)
        .single();

      const userAccountId = userAcc?.id;
      if (!userAccountId)
        return {
          ytdEarnings: 0,
          pendingPipeline: 0,
          dealsYtd: 0,
          avgPerDeal: 0,
          dealRows: [],
          agentName: "Agent",
        };

      const { data: deals, error } = await supabase
        .from("deal")
        .select(
          `
          id, sale_price_cents, commission_rate_bps, status, stage, registration_date,
          property:property_id ( address_line ),
          participants:deal_participant ( user_account_id, role, split_value )
        `,
        )
        .eq("participants.user_account_id", userAccountId);

      if (error) throw error;

      const myDeals = (deals as any[]).filter((d) =>
        d.participants.some((p: any) => p.user_account_id === userAccountId),
      );

      let ytdEarnings = 0;
      let pendingPipeline = 0;
      let registeredCount = 0;
      const dealRows: any[] = [];

      for (const d of myDeals) {
        const myParticipant = d.participants.find((p: any) => p.user_account_id === userAccountId);
        const splitPct = myParticipant?.split_value || 0;
        const grossComm = (d.sale_price_cents * (d.commission_rate_bps || 0)) / 10000;
        const netComm = Math.round((grossComm * splitPct) / 100);

        if (d.stage === "registered" || d.stage === "commission_paid") {
          ytdEarnings += netComm;
          registeredCount++;
          dealRows.push({
            deal: {
              id: d.id,
              ref: d.id,
              registeredAt: d.registration_date,
              salePrice: d.sale_price_cents,
            },
            property: { address: d.property?.address_line, suburb: "" },
            commission: netComm,
          });
        } else if (d.status !== "cancelled") {
          pendingPipeline += Math.round(netComm * 0.5);
        }
      }

      const avgPerDeal = registeredCount > 0 ? Math.round(ytdEarnings / registeredCount) : 0;

      return {
        ytdEarnings,
        pendingPipeline,
        dealsYtd: registeredCount,
        avgPerDeal,
        dealRows,
        agentName: userAcc?.full_name,
      };
    },
  });
}
