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
          branch:branch_id ( name ),
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
      if (activeAccount && activeAccount.role === "agent") {
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

export interface DealSearchResult {
  id: string;
  ref: string;
  salePrice: number;
  property: { address: string };
}

/**
 * Lightweight deal lookup for the command palette (Cmd-K search), which only
 * ever needs a handful of fields for the top ~8 results. Deliberately
 * separate from usePipelineDeals, which fetches every deal with five nested
 * joins for the full pipeline board — using that here would re-run a heavy,
 * unbounded query on every app navigation just to power a search box.
 */
export function useDealSearch(enabled: boolean) {
  const { activeAccount } = useAuth();

  return useQuery({
    queryKey: ["deal-search", activeAccount?.id],
    enabled: enabled && !!activeAccount,
    queryFn: async () => {
      let query = supabase
        .from("deal")
        .select(
          activeAccount?.role === "agent"
            ? `id, reference, sale_price_cents, property:property_id ( address_line ),
               participants:deal_participant!inner ( user_account_id )`
            : `id, reference, sale_price_cents, property:property_id ( address_line )`,
        )
        .order("updated_at", { ascending: false })
        .limit(50);

      if (activeAccount?.role === "agent") {
        query = query.eq("participants.user_account_id", activeAccount.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as any[]).map((d): DealSearchResult => ({
        id: d.id,
        ref: d.reference,
        salePrice: d.sale_price_cents,
        property: { address: d.property?.address_line || "Unknown Address" },
      }));
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
            user:user_account_id ( id, full_name, email, mobile, ffc:ffc_certificate(expires_on) )
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
      const bond = Array.isArray((d as any).bond) ? (d as any).bond[0] : (d as any).bond;
      const bondStatus: Record<string, string> = {
        not_applied: "Not applied",
        submitted: "Submitted",
        declined: "Declined",
        approved_in_principle: "Approved in principle",
        formally_granted: "Formally granted",
      };
      const ficaStatus: Record<string, string> = {
        complete: "Complete",
        partial: "Partial",
        not_started: "Not Started",
        expired: "Not Started",
      };
      const roleNames: Record<string, string> = {
        listing_agent: "Listing Agent",
        selling_agent: "Selling Agent",
        referrer: "Referral",
        co_agent: "Co-mandate",
      };
      return {
        id: (d as any).id,
        ref: (d as any).reference,
        propertyId: (d as any).property?.id,
        property: {
          address: (d as any).property?.address_line || "Unknown property",
          suburb: (d as any).property?.suburb || "",
          city: (d as any).property?.city || "",
          type: (d as any).property?.property_type?.replaceAll("_", " ") || "other",
          beds: (d as any).property?.bedrooms || 0,
          baths: (d as any).property?.bathrooms || 0,
          garages: (d as any).property?.garages || 0,
          erfSize: (d as any).property?.erf_size_sqm || 0,
          floorSize: (d as any).property?.floor_size_sqm || 0,
        },
        stage: stageFromDb[(d as any).stage] ?? (d as any).stage,
        cancelled:
          (d as any).status === "cancelled"
            ? { reason: (d as any).cancellation_reason || "Cancelled", at: (d as any).cancelled_on }
            : undefined,
        salePrice: (d as any).sale_price_cents || 0,
        listingPrice: (d as any).mandate?.listing_price_cents || 0,
        commissionBps: (d as any).mandate?.commission_rate_bps || 0,
        mandateType: ((d as any).mandate?.mandate_type || "sole").replace(/^./, (value: string) =>
          value.toUpperCase(),
        ),
        mandateSigned: (d as any).mandate?.signed_on,
        mandateExpiry: (d as any).mandate?.expires_on,
        otpSigned: (d as any).otp_signed_on,
        occupationDate: (d as any).occupation_date,
        registeredAt: (d as any).registration_date,
        branch: (d as any).branch?.name || "Unassigned",
        stageSince: (d as any).updated_at,
        bond: {
          status: bondStatus[bond?.status] || "Not applied",
          institution: bond?.institution || "",
          appliedAt: bond?.applied_on,
          decidedAt: bond?.status_updated_on,
        },
        conveyancer: (d as any).conveyancer?.name || "Not appointed",
        practitioners: ((d as any).participants || []).map((participant: any) => ({
          userId: participant.user?.id || "",
          name: participant.user?.full_name || "Unassigned",
          email: participant.user?.email || "",
          mobile: participant.user?.mobile || "",
          ffc: Array.isArray(participant.user?.ffc)
            ? participant.user.ffc[0]
            : participant.user?.ffc,
          role: roleNames[participant.role] || participant.role,
          splitPct: Number(participant.split_value) || 0,
          external: !!participant.is_external,
        })),
        parties: ((d as any).parties || []).map((entry: any) => ({
          id: entry.party?.id,
          dealId: (d as any).id,
          name: entry.party?.full_name || "Unknown",
          side: entry.role === "seller" ? "Seller" : "Purchaser",
          entityType: entityTypeFromDb[entry.party?.entity_type] || "Natural Person",
          email: entry.party?.email || "",
          mobile: entry.party?.mobile || "",
          idNumber: entry.party?.id_or_reg_number || "",
          fica: ficaStatus[entry.party?.fica_status] || "Not Started",
          popia: !!entry.party?.popia_consent_at,
          popiaAt: entry.party?.popia_consent_at,
          checklist: [],
        })),
        conditions: ((d as any).conditions || []).map((condition: any) => ({
          id: condition.id,
          dealId: (d as any).id,
          type: conditionTypeFromDb[condition.condition_type] || "Due Diligence",
          description: condition.description,
          dueDate: condition.due_on,
          originalDueDate: condition.original_due_on,
          status: conditionStatusFromDb[condition.status] || "Open",
          responsibleUserId: "",
          responsibleParty: condition.responsible_party || "Purchaser",
        })),
        offers: ((d as any).offers || []).map((offer: any) => ({
          id: offer.id,
          price: offer.offer_price_cents || 0,
          deposit: offer.deposit_cents || 0,
          bondAmount: offer.bond_amount_cents || 0,
          expiry: offer.expires_on,
          purchaser: offer.purchaser_party_id || "",
          occupationDate: (d as any).occupation_date,
          status: offer.status?.replace(/^./, (value: string) => value.toUpperCase()) || "Pending",
        })),
        timeline: ((d as any).timeline || []).map((event: any) => ({
          id: event.id,
          at: event.occurred_at,
          from: event.from_stage ? stageFromDb[event.from_stage] : undefined,
          to: event.to_stage ? stageFromDb[event.to_stage] : undefined,
          actor: event.user?.full_name || event.changed_by_external_email || "System",
          action: event.to_stage
            ? `Stage changed to ${stageFromDb[event.to_stage] || event.to_stage}`
            : "Deal updated",
          reason: event.reason,
        })),
        documents: ((d as any).documents || []).map((document: any) => ({
          id: document.id,
          name: document.filename,
          category: document.category,
          version: document.version,
          uploadedBy: document.user?.full_name || "Unknown",
          uploadedAt: document.uploaded_at,
          sizeKb: Math.round((document.size_bytes || 0) / 1024),
          storageKey: document.storage_key,
        })),
      };
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
    sharePercent: Number(party.sharePercent) || 100,
    email: party.email || "",
    mobile: party.mobile || "",
    idNumber: party.idNumber || "9505155000085",
    entityType: entityTypes[party.entityType] || "natural_person",
    maritalStatus: party.maritalStatus || "Unmarried",
    isVatVendor: !!party.isVatVendor,
    ficaStatus: ficaStatus(party.fica),
    sanctionsScreened: party.sanctionsScreened ?? true,
    riskRating: String(party.riskRating || "low").toLowerCase(),
    isProminentPerson: !!party.isProminentPerson,
    popiaConsent: party.popiaConsent ?? true,
    taxNumber: party.taxNumber || undefined,
    dateOfBirth: party.dateOfBirth || "1995-05-15",
    nationality: party.nationality || "South African",
    isSaResident: party.isSaResident ?? true,
    passportNumber: party.passportNumber,
    passportCountry: party.passportCountry,
    representativeName: party.representativeName,
    representativeCapacity: party.representativeCapacity,
    beneficialOwnerDetails: party.beneficialOwnerDetails,
    sourceOfFunds: party.sourceOfFunds || "Employment Income / Savings / Bond",
  });

  const rawSellers =
    Array.isArray(formData.sellers) && formData.sellers.length > 0
      ? formData.sellers
      : [
          {
            name: formData.sellerName || "Mandator / Seller",
            sharePercent: "100",
            email: formData.sellerEmail || "",
            mobile: formData.sellerMobile || "",
            idNumber: formData.sellerIdNumber || "9505155000085",
            entityType: "Natural Person",
            maritalStatus: "Unmarried",
            isVatVendor: false,
            fica: formData.sellerFica || "Complete",
            sanctionsScreened: true,
            riskRating: "Low",
            isProminentPerson: false,
            popiaConsent: formData.popiaConsentSigned ?? true,
            isSaResident: true,
            dateOfBirth: "1995-05-15",
          },
        ];

  const rawPurchasers =
    Array.isArray(formData.purchasers) && formData.purchasers.length > 0
      ? formData.purchasers
      : [
          {
            name: formData.buyerName || "Unassigned Purchaser",
            sharePercent: "100",
            email: formData.buyerEmail || "",
            mobile: formData.buyerMobile || "",
            idNumber: formData.buyerIdNumber || "9505155000085",
            entityType: "Natural Person",
            maritalStatus: "Unmarried",
            isVatVendor: false,
            fica: formData.buyerFica || "Not Started",
            sanctionsScreened: true,
            riskRating: "Low",
            isProminentPerson: false,
            popiaConsent: true,
            isSaResident: true,
            dateOfBirth: "1995-05-15",
            sourceOfFunds: "Employment Income / Savings / Bond",
          },
        ];

  const address = formData.address || "";
  const suburb = formData.suburb || "";
  const city = formData.city || "Johannesburg";
  const erfNum = formData.erfNumber || "TBD";
  const fallbackLegalDesc = `Erf ${erfNum}, ${address}, ${suburb}, ${city}`.trim();

  const payload = {
    address: address,
    suburb: suburb,
    city: city,
    province: formData.province || "Gauteng",
    postalCode: formData.postalCode || "2196",
    legalDescription: formData.legalDescription?.trim() || fallbackLegalDesc,
    deedsOffice: formData.deedsOffice || "Pretoria",
    erfNumber: erfNum,
    titleDeedNumber: formData.titleDeedNumber?.trim() || "TBD - Pending Deeds Search",
    propertyType: propertyTypes[formData.propertyType] || "house",
    isSectionalTitle: formData.propertyType === "Sectional Title",
    bedrooms: Number(formData.beds) || 0,
    bathrooms: Number(formData.baths) || 0,
    garages: Number(formData.garages) || 0,
    erfSizeSqm: Number(formData.erfSize) || 0,
    floorSizeSqm: Number(formData.floorSize) || 0,
    propertyUse: formData.propertyUse || "Residential",
    isImproved: formData.isImproved ?? true,
    sellerAcquiredOn: formData.sellerAcquiredOn,
    sellerOriginalPurchasePriceCents: toCents(formData.sellerOriginalPurchasePrice),
    mandateType: String(formData.mandateType || "sole").toLowerCase(),
    listingPriceCents: toCents(formData.listingPrice || formData.salePrice || 1),
    commissionRateBps: Number(formData.commissionBps) || 500,
    mandateSignedOn:
      formData.mandateSigned || formData.mandateStartDate || new Date().toISOString().split("T")[0],
    mandateExpiresOn:
      formData.mandateExpiry ||
      formData.mandateExpiryDate ||
      new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
    salePriceCents: toCents(formData.salePrice || formData.listingPrice || 1),
    effectiveDate:
      formData.effectiveDate ||
      formData.otpSigned ||
      formData.mandateStartDate ||
      new Date().toISOString().split("T")[0],
    offerExpiresOn: formData.offerExpiresOn,
    occupationDate: formData.occupationDate,
    conveyancer: formData.conveyancer || "Vogel & Associates Attorneys",
    conveyancerReference: formData.conveyancerReference,
    branchId: formData.branchId,
    leadAgentId: formData.agentId || undefined,
    isVatSale: !!formData.isVatSale,
    vatInclusive: formData.vatInclusive ?? true,
    saleMethod: formData.saleMethod || "Private Treaty",
    transferSharePercent: Number(formData.transferSharePercent) || 100,
    partiesConnected: !!formData.partiesConnected,
    sellerIsNonResident:
      !!formData.sellerIsNonResident ||
      rawSellers.some((seller: any) => seller.isSaResident === false),
    depositCents: toCents(formData.depositAmount),
    depositDueOn: formData.depositDueOn,
    depositHolder: formData.depositHolder,
    balancePaymentMethod: formData.balancePaymentMethod,
    occupationalRentCents: toCents(formData.occupationalRent),
    bondAmountCents: toCents(formData.bondAmount),
    propertyDisclosureCompleted: formData.propertyDisclosureCompleted ?? true,
    disclosureDefects: formData.disclosureDefects,
    fixturesIncluded: formData.fixturesIncluded,
    fixturesExcluded: formData.fixturesExcluded,
    specialConditions: formData.specialConditions,
    sellers: rawSellers.map(partyPayload),
    purchasers: rawPurchasers.map(partyPayload),
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

      // `!inner` makes the participants filter apply to the top-level deal
      // rows too (a plain embedded-resource filter only narrows the nested
      // `participants` array, not which deals are returned — which
      // previously meant every deal in the agency was fetched and re-filtered
      // client-side). Safe to also narrow the embedded array to just this
      // participant, since myParticipant below only ever needs their own row.
      const { data: deals, error } = await supabase
        .from("deal")
        .select(
          `
          id, sale_price_cents, commission_rate_bps, status, stage, registration_date,
          property:property_id ( address_line ),
          participants:deal_participant!inner ( user_account_id, role, split_value )
        `,
        )
        .eq("participants.user_account_id", userAccountId);

      if (error) throw error;

      const myDeals = deals as any[];

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
