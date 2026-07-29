import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
        .select(`
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
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      return (data as any[]).map((d): PipelineDeal => {
        const agentParticipant = d.participants?.find((p: any) => p.role === 'listing_agent') || d.participants?.[0];
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
          cancelled: d.status === 'cancelled' ? { reason: d.cancellation_reason || "Other", at: d.cancelled_on } : null,
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
        .select(`
          id,
          reference,
          stage,
          status,
          sale_price_cents,
          listing_price_cents,
          commission_rate_bps,
          mandate_id,
          otp_signed_on,
          occupation_date,
          registration_date,
          cancellation_reason,
          cancelled_on,
          created_at,
          updated_at,
          conveyancer:conveyancer_firm_id ( name ),
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
          documents:document ( id, category, filename, size_bytes, version, uploaded_at, user:uploaded_by ( full_name ) )
        `)
        .eq("id", dealId)
        .single();

      if (error) throw error;
      return mapSupabaseDealToMockDeal(d);
    },
    enabled: !!dealId,
  });
}

function mapSupabaseDealToMockDeal(d: any): any {
  // Maps the fetched Supabase deal (d) to the Deal type from mock.ts
  const STAGES = [
    "Mandate Signed", "Listed/Marketing", "Offer Received", "OTP Signed", 
    "Conditions Pending", "Conveyancer Instructed", "Compliance Certs", 
    "Transfer Duty", "Rates & Levy Clearance", "Documents & Guarantees", 
    "Lodged", "Registered", "Commission Released"
  ];
  const stage = d.stage.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  let mappedStage = STAGES.find(s => s.toLowerCase().includes(stage.toLowerCase())) || STAGES[0];
  if (d.stage === 'listed_marketing') mappedStage = "Listed/Marketing";
  if (d.stage === 'otp_signed') mappedStage = "OTP Signed";
  if (d.stage === 'suspensive_conditions_pending') mappedStage = "Conditions Pending";
  if (d.stage === 'compliance_certificates') mappedStage = "Compliance Certs";

  return {
    id: d.id,
    ref: d.reference,
    propertyId: d.property?.id || "",
    stage: mappedStage,
    cancelled: d.status === 'cancelled' ? { reason: d.cancellation_reason || "Other", at: d.cancelled_on } : undefined,
    salePrice: d.sale_price_cents,
    listingPrice: d.listing_price_cents,
    commissionBps: d.commission_rate_bps,
    mandateType: "Sole", // from mandate if joined
    mandateSigned: d.created_at,
    mandateExpiry: d.created_at,
    otpSigned: d.otp_signed_on,
    occupationDate: d.occupation_date,
    registeredAt: d.registration_date,
    branch: "", // Need branch
    stageSince: d.updated_at,
    bond: { status: "Not applied", institution: "—" }, // Mocked for now
    conveyancer: d.conveyancer?.name || "Unassigned",
    practitioners: (d.participants || []).map((p: any) => ({
      userId: p.user?.id || "unknown",
      role: p.role,
      splitPct: p.split_value,
      external: p.is_external
    })),
    parties: (d.parties || []).map((p: any) => ({
      id: p.party?.id,
      dealId: d.id,
      name: p.party?.full_name,
      side: p.role === 'seller' ? "Seller" : "Purchaser",
      entityType: p.party?.entity_type,
      email: p.party?.email,
      mobile: p.party?.mobile,
      idNumber: p.party?.id_or_reg_number,
      fica: "Not Started",
      popia: !!p.party?.popia_consent_at
    })),
    conditions: (d.conditions || []).map((c: any) => ({
      id: c.id,
      dealId: d.id,
      type: c.condition_type,
      description: c.description,
      dueDate: c.due_on,
      originalDueDate: c.original_due_on,
      status: c.status === 'pending' ? "Open" : c.status === 'fulfilled' ? "Fulfilled" : "Failed",
      responsibleParty: "Purchaser"
    })),
    offers: (d.offers || []).map((o: any) => ({
      id: o.id,
      price: o.offer_price_cents,
      deposit: o.deposit_cents,
      bondAmount: o.bond_amount_cents,
      expiry: o.expires_on,
      status: o.status
    })),
    timeline: (d.timeline || []).map((t: any) => ({
      id: t.id,
      at: t.occurred_at,
      from: t.from_stage,
      to: t.to_stage,
      actor: t.user?.full_name || t.changed_by_external_email,
      reason: t.reason
    })),
    documents: (d.documents || []).map((doc: any) => ({
      id: doc.id,
      title: doc.filename,
      date: doc.uploaded_at,
      size: doc.size_bytes,
      status: "Approved",
      version: doc.version
    })),
  };
}

export async function createDeal(formData: any) {
  // First fetch the current user's agency_id from their user_account
  const { data: userAcc, error: userErr } = await supabase
    .from("user_account")
    .select("id, agency_id")
    .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (userErr || !userAcc) {
    throw new Error("Could not find user account. Are you logged in?");
  }

  const agencyId = userAcc.agency_id;
  const userAccountId = userAcc.id;

  // 1. Insert Property
  const { data: prop, error: propErr } = await supabase
    .from("property")
    .insert({
      agency_id: agencyId,
      address_line: formData.address,
      suburb: formData.suburb,
      city: formData.city,
      property_type: formData.propertyType.toLowerCase().replace(' ', '_'),
      bedrooms: parseInt(formData.beds) || 0,
      bathrooms: parseInt(formData.baths) || 0,
      garages: parseInt(formData.garages) || 0,
      erf_size_sqm: parseInt(formData.erfSize) || 0,
      floor_size_sqm: parseInt(formData.floorSize) || 0,
      postal_code: formData.postalCode,
      erf_number: formData.erfNumber,
      title_deed_number: formData.titleDeedNumber,
    })
    .select("id")
    .single();
  if (propErr) throw propErr;

  // 2. Insert Parties
  const { data: seller, error: sellerErr } = await supabase
    .from("party")
    .insert({
      agency_id: agencyId,
      party_type: "seller",
      full_name: formData.sellerName,
      email: formData.sellerEmail,
      mobile: formData.sellerMobile,
      fica_status: formData.sellerFica.toLowerCase().replace(' ', '_'),
      id_number: formData.sellerIdNumber,
      entity_type: formData.sellerEntityType,
      marital_status: formData.sellerMaritalStatus,
      is_vat_vendor: formData.sellerIsVatVendor
    })
    .select("id")
    .single();
  if (sellerErr) throw sellerErr;

  const { data: buyer, error: buyerErr } = await supabase
    .from("party")
    .insert({
      agency_id: agencyId,
      party_type: "purchaser",
      full_name: formData.buyerName,
      email: formData.buyerEmail,
      mobile: formData.buyerMobile,
      fica_status: formData.buyerFica.toLowerCase().replace(' ', '_'),
      id_number: formData.buyerIdNumber,
      entity_type: formData.buyerEntityType,
      marital_status: formData.buyerMaritalStatus,
      is_vat_vendor: formData.buyerIsVatVendor
    })
    .select("id")
    .single();
  if (buyerErr) throw buyerErr;

  // 3. Insert Mandate
  const { data: mandate, error: mandateErr } = await supabase
    .from("mandate")
    .insert({
      agency_id: agencyId,
      property_id: prop.id,
      mandate_type: formData.mandateType.toLowerCase(),
      listing_price_cents: parseInt(formData.listingPrice) || 0,
      commission_rate_bps: parseInt(formData.commissionBps) || 0,
      signed_on: new Date().toISOString(),
      status: "active"
    })
    .select("id")
    .single();
  if (mandateErr) throw mandateErr;

  // 4. Create Deal
  const dealRef = 'D' + new Date().toISOString().slice(2, 7).replace('-', '') + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: deal, error: dealErr } = await supabase
    .from("deal")
    .insert({
      agency_id: agencyId,
      property_id: prop.id,
      mandate_id: mandate.id,
      deal_type: "sale",
      reference: dealRef,
      stage: "otp_signed",
      status: "active",
      sale_price_cents: parseInt(formData.salePrice) || 0,
      is_vat_sale: formData.isVatSale,
      otp_signed_on: formData.otpSigned,
      occupation_date: formData.occupationDate,
      created_by: userAccountId
    })
    .select("id")
    .single();
  if (dealErr) throw dealErr;

  const dealId = deal.id;

  // 5. Participants & Parties
  await supabase.from("deal_participant").insert({
    deal_id: dealId,
    user_account_id: userAccountId,
    role: "listing_agent",
    split_value: 100
  });

  await supabase.from("deal_party").insert([
    { deal_id: dealId, party_id: seller.id, role: "seller" },
    { deal_id: dealId, party_id: buyer.id, role: "purchaser" }
  ]);

  // 6. Suspensive Conditions
  if (formData.bondRequired && formData.bondDueDate) {
    await supabase.from("suspensive_condition").insert({
      deal_id: dealId,
      condition_type: "bond_approval",
      description: "Bond approval required",
      due_on: formData.bondDueDate,
      original_due_on: formData.bondDueDate,
      status: "pending"
    });
  }

  if (formData.ficaRequired && formData.ficaDueDate) {
    await supabase.from("suspensive_condition").insert({
      deal_id: dealId,
      condition_type: "fica_clearance",
      description: "FICA clearance required",
      due_on: formData.ficaDueDate,
      original_due_on: formData.ficaDueDate,
      status: "pending"
    });
  }

  if (formData.subjectToSale && formData.subjectToSaleDueDate) {
    await supabase.from("suspensive_condition").insert({
      deal_id: dealId,
      condition_type: "subject_to_sale",
      description: formData.subjectToSaleDesc || "Subject to sale of existing property",
      due_on: formData.subjectToSaleDueDate,
      original_due_on: formData.subjectToSaleDueDate,
      status: "pending"
    });
  }

  return dealId;
}

export function useMyEarnings() {
  return useQuery({
    queryKey: ["my-earnings"],
    queryFn: async () => {
      const userRes = await supabase.auth.getUser();
      const authUserId = userRes.data.user?.id;
      if (!authUserId) return { ytdEarnings: 0, pendingPipeline: 0, dealsYtd: 0, avgPerDeal: 0, dealRows: [], agentName: "Agent" };

      const { data: userAcc } = await supabase
        .from("user_account")
        .select("id, full_name")
        .eq("auth_user_id", authUserId)
        .single();
      
      const userAccountId = userAcc?.id;
      if (!userAccountId) return { ytdEarnings: 0, pendingPipeline: 0, dealsYtd: 0, avgPerDeal: 0, dealRows: [], agentName: "Agent" };

      const { data: deals, error } = await supabase
        .from("deal")
        .select(`
          id, sale_price_cents, commission_rate_bps, status, stage, registration_date,
          property:property_id ( address_line ),
          participants:deal_participant ( user_account_id, role, split_value )
        `)
        .eq("participants.user_account_id", userAccountId);
        
      if (error) throw error;
      
      const myDeals = (deals as any[]).filter(d => d.participants.some((p: any) => p.user_account_id === userAccountId));

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
            deal: { id: d.id, ref: d.id, registeredAt: d.registration_date, salePrice: d.sale_price_cents },
            property: { address: d.property?.address_line, suburb: "" },
            commission: netComm
          });
        } else if (d.status !== "cancelled") {
          pendingPipeline += Math.round(netComm * 0.5);
        }
      }

      const avgPerDeal = registeredCount > 0 ? Math.round(ytdEarnings / registeredCount) : 0;

      return { ytdEarnings, pendingPipeline, dealsYtd: registeredCount, avgPerDeal, dealRows, agentName: userAcc?.full_name };
    }
  });
}
