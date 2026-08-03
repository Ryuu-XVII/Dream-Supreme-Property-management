import { supabase } from "@/lib/supabase";

export interface PortalLeadWebhookPayload {
  portalSource: string;
  leadName: string;
  leadEmail?: string;
  leadPhone?: string;
  rawPayload: Record<string, unknown>;
}

/**
 * Process incoming portal lead webhook payload.
 */
export async function processPortalLeadWebhook(payload: PortalLeadWebhookPayload) {
  // 1. Ingest lead into lead_capture
  const { data: lead, error: leadError } = await supabase
    .from("lead_capture")
    .insert({
      lead_name: payload.leadName,
      lead_email: payload.leadEmail || null,
      lead_phone: payload.leadPhone || null,
      source: "portal_feed",
      status: "new",
    })
    .select()
    .single();

  if (leadError) {
    throw new Error(`Failed to ingest portal lead: ${leadError.message}`);
  }

  // 2. Trigger round robin assignment
  const { data: assignment } = await supabase.rpc("assign_lead_round_robin", {
    p_lead_id: lead.id,
  });

  return { lead, assignment };
}
