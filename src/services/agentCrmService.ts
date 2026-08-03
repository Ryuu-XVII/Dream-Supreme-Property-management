import { supabase } from "@/lib/supabase";

export interface ContactActivityEntry {
  partyId: string;
  activityType: "call" | "sms" | "email" | "meeting" | "property_view" | "note";
  summary: string;
  details?: string;
}

/**
 * Log activity timeline item for contact.
 */
export async function logContactActivity(entry: ContactActivityEntry) {
  const { data, error } = await supabase
    .from("contact_activity_timeline")
    .insert({
      party_id: entry.partyId,
      activity_type: entry.activityType,
      summary: entry.summary,
      details: entry.details || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log contact activity: ${error.message}`);
  }

  return data;
}

/**
 * Invokes public.assign_lead_round_robin RPC via Supabase.
 */
export async function assignLeadRoundRobin(leadId: string) {
  const { data, error } = await supabase.rpc("assign_lead_round_robin", {
    p_lead_id: leadId,
  });

  if (error) {
    throw new Error(`Failed to assign lead round robin: ${error.message}`);
  }

  return data;
}
