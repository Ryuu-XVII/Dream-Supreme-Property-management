import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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
  return useQuery({
    queryKey: ["pipeline-deals"],
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

      return (data as any[]).map((d): PipelineDeal => {
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
      return mapSupabaseDealToMockDeal(d);
    },
    enabled: !!dealId,
  });
}

function mapSupabaseDealToMockDeal(d: any): any {
  const mandate = Array.isArray(d.mandate) ? d.mandate[0] : d.mandate;
  const bond = Array.isArray(d.bond) ? d.bond[0] : d.bond;
  return {
    id: d.id,
    ref: d.reference,
    propertyId: d.property?.id || "",
    property: {
      address: d.property?.address_line || "Address not available",
      suburb: d.property?.suburb || "",
      city: d.property?.city || "",
      type: d.property?.property_type,
      beds: d.property?.bedrooms || 0,
      baths: d.property?.bathrooms || 0,
      garages: d.property?.garages || 0,
      erfSize: d.property?.erf_size_sqm || 0,
      floorSize: d.property?.floor_size_sqm || 0,
    },
    stage: stageFromDb[d.stage] ?? "Mandate Signed",
    cancelled:
      d.status === "cancelled"
        ? { reason: d.cancellation_reason || "Other", at: d.cancelled_on }
        : undefined,
    salePrice: d.sale_price_cents,
    listingPrice: mandate?.listing_price_cents ?? 0,
    commissionBps: mandate?.commission_rate_bps ?? 0,
    mandateType:
      mandate?.mandate_type === "joint"
        ? "Joint"
        : mandate?.mandate_type === "open"
          ? "Open"
          : "Sole",
    mandateSigned: mandate?.signed_on ?? d.created_at,
    mandateExpiry: mandate?.expires_on ?? "",
    otpSigned: d.otp_signed_on,
    occupationDate: d.occupation_date,
    registeredAt: d.registration_date,
    branch: "",
    stageSince: d.updated_at,
    bond: {
      status:
        bond?.status === "approved_in_principle"
          ? "Approved in principle"
          : bond?.status === "formally_granted"
            ? "Formally granted"
            : bond?.status === "submitted"
              ? "Submitted"
              : bond?.status === "declined"
                ? "Declined"
                : "Not applied",
      institution: bond?.institution || "—",
      appliedAt: bond?.applied_on,
      decidedAt: bond?.status_updated_on,
    },
    conveyancer: d.conveyancer?.name || "Unassigned",
    conveyancerEmail: d.conveyancer?.email || "",
    practitioners: (d.participants || []).map((p: any) => ({
      userId: p.user?.id || "unknown",
      name: p.user?.full_name || p.external_agency_name || "Practitioner",
      role:
        p.role === "selling_agent"
          ? "Selling Agent"
          : p.role === "co_agent"
            ? "Co-mandate"
            : p.role === "referrer"
              ? "Referral"
              : "Listing Agent",
      splitPct: p.split_value,
      external: p.is_external,
    })),
    parties: (d.parties || []).map((p: any) => ({
      id: p.party?.id,
      dealId: d.id,
      name: p.party?.full_name,
      side: p.role === "seller" ? "Seller" : "Purchaser",
      entityType: entityTypeFromDb[p.party?.entity_type] ?? "Natural Person",
      email: p.party?.email,
      mobile: p.party?.mobile,
      idNumber: p.party?.id_or_reg_number,
      fica:
        p.party?.fica_status === "complete"
          ? "Complete"
          : p.party?.fica_status === "partial"
            ? "Partial"
            : "Not Started",
      popia: !!p.party?.popia_consent_at,
      checklist: [],
    })),
    conditions: (d.conditions || []).map((c: any) => ({
      id: c.id,
      dealId: d.id,
      type: conditionTypeFromDb[c.condition_type] ?? "Due Diligence",
      description: c.description,
      dueDate: c.due_on,
      originalDueDate: c.original_due_on,
      status: conditionStatusFromDb[c.status] ?? "Open",
      responsibleParty: c.responsible_party || "Purchaser",
      responsibleUserId: "",
    })),
    offers: (d.offers || []).map((o: any) => ({
      id: o.id,
      price: o.offer_price_cents,
      deposit: o.deposit_cents,
      bondAmount: o.bond_amount_cents,
      expiry: o.expires_on,
      purchaser: "Purchaser",
      occupationDate: d.occupation_date,
      status:
        o.status === "accepted"
          ? "Accepted"
          : o.status === "rejected"
            ? "Rejected"
            : o.status === "expired"
              ? "Expired"
              : "Pending",
    })),
    timeline: (d.timeline || []).map((t: any) => ({
      id: t.id,
      at: t.occurred_at,
      from: t.from_stage ? stageFromDb[t.from_stage] : undefined,
      to: stageFromDb[t.to_stage],
      actor: t.user?.full_name || t.changed_by_external_email || "System",
      action: `Stage changed to ${stageFromDb[t.to_stage] ?? t.to_stage}`,
      reason: t.reason,
    })),
    documents: (d.documents || []).map((doc: any) => ({
      id: doc.id,
      name: doc.filename,
      category: doc.category,
      uploadedAt: doc.uploaded_at,
      uploadedBy: doc.user?.full_name || "System",
      sizeKb: Math.round((doc.size_bytes || 0) / 1024),
      version: doc.version,
      url: doc.storage_key,
    })),
  };
}

export async function createDeal(formData: any) {
  const propertyTypes: Record<string, string> = {
    "Freehold House": "house",
    "Sectional Title": "apartment",
    "Estate House": "house",
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

  const payload = {
    address: formData.address,
    suburb: formData.suburb,
    city: formData.city,
    province: formData.province || "Gauteng",
    postalCode: formData.postalCode,
    erfNumber: formData.erfNumber,
    titleDeedNumber: formData.titleDeedNumber,
    propertyType: propertyTypes[formData.propertyType] || "other",
    isSectionalTitle: formData.propertyType === "Sectional Title",
    bedrooms: Number(formData.beds) || 0,
    bathrooms: Number(formData.baths) || 0,
    garages: Number(formData.garages) || 0,
    erfSizeSqm: Number(formData.erfSize) || 0,
    floorSizeSqm: Number(formData.floorSize) || 0,
    mandateType: String(formData.mandateType || "sole").toLowerCase(),
    listingPriceCents: toCents(formData.listingPrice),
    commissionRateBps: Number(formData.commissionBps) || 0,
    mandateSignedOn: formData.mandateSigned,
    mandateExpiresOn: formData.mandateExpiry,
    salePriceCents: toCents(formData.salePrice),
    otpSignedOn: formData.otpSigned,
    occupationDate: formData.occupationDate,
    conveyancer: formData.conveyancer,
    conveyancerReference: formData.conveyancerReference,
    branchId: formData.branchId,
    leadAgentId: formData.agentId,
    isVatSale: !!formData.isVatSale,
    seller: {
      name: formData.sellerName,
      email: formData.sellerEmail,
      mobile: formData.sellerMobile,
      idNumber: formData.sellerIdNumber,
      entityType: entityTypes[formData.sellerEntityType] || "natural_person",
      maritalStatus: formData.sellerMaritalStatus,
      isVatVendor: !!formData.sellerIsVatVendor,
      ficaStatus: ficaStatus(formData.sellerFica),
      popiaConsent: !!formData.sellerPopia,
    },
    purchaser: {
      name: formData.buyerName,
      email: formData.buyerEmail,
      mobile: formData.buyerMobile,
      idNumber: formData.buyerIdNumber,
      entityType: entityTypes[formData.buyerEntityType] || "natural_person",
      maritalStatus: formData.buyerMaritalStatus,
      isVatVendor: !!formData.buyerIsVatVendor,
      ficaStatus: ficaStatus(formData.buyerFica),
      popiaConsent: !!formData.buyerPopia,
    },
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
