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
  const { data, error } = await supabase.rpc('create_deal_full', {
    p_address_line: formData.address,
    p_suburb: formData.suburb,
    p_city: formData.city,
    p_property_type: formData.propertyType.toLowerCase().replace(' ', '_'),
    p_beds: parseInt(formData.beds) || 0,
    p_baths: parseInt(formData.baths) || 0,
    p_garages: parseInt(formData.garages) || 0,
    p_erf_size_sqm: parseInt(formData.erfSize) || 0,
    p_floor_size_sqm: parseInt(formData.floorSize) || 0,
    
    p_mandate_type: formData.mandateType.toLowerCase(),
    p_listing_price_cents: parseInt(formData.listingPrice) || 0,
    p_commission_rate_bps: parseInt(formData.commissionBps) || 0,
    
    p_seller_name: formData.sellerName,
    p_seller_email: formData.sellerEmail,
    p_seller_mobile: formData.sellerMobile,
    p_seller_fica: formData.sellerFica.toLowerCase().replace(' ', '_'),
  
    p_buyer_name: formData.buyerName,
    p_buyer_email: formData.buyerEmail,
    p_buyer_mobile: formData.buyerMobile,
    p_buyer_fica: formData.buyerFica.toLowerCase().replace(' ', '_'),
  
    p_sale_price_cents: parseInt(formData.salePrice) || 0,
    p_otp_signed_on: formData.otpSigned,
    p_occupation_date: formData.occupationDate,
    p_conveyancer_name: formData.conveyancer,
    p_agent_id: formData.agentId,
    
    p_bond_amount_cents: formData.bondRequired ? (parseInt(formData.bondAmount) || 0) : 0,
    p_bond_due_date: formData.bondRequired ? formData.bondDueDate : null,
    p_fica_due_date: formData.ficaRequired ? formData.ficaDueDate : null
  });

  if (error) {
    throw error;
  }
  
  return data;
}
