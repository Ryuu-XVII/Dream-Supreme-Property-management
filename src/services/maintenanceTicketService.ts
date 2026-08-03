import { supabase } from "@/lib/supabase";

export interface MaintenanceTicketPayload {
  leaseId: string;
  propertyId: string;
  title: string;
  category: "plumbing" | "electrical" | "structural" | "appliance" | "general";
  severity?: "low" | "medium" | "high" | "emergency";
  contractorName?: string;
  quotedAmountCents?: number;
}

/**
 * Creates new maintenance ticket.
 */
export async function createMaintenanceTicket(payload: MaintenanceTicketPayload) {
  const { data, error } = await supabase
    .from("maintenance_ticket")
    .insert({
      lease_id: payload.leaseId,
      property_id: payload.propertyId,
      title: payload.title,
      category: payload.category,
      severity: payload.severity || "medium",
      contractor_name: payload.contractorName || null,
      quoted_amount_cents: payload.quotedAmountCents || 0,
      status: "open",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create maintenance ticket: ${error.message}`);
  }

  return data;
}

/**
 * Invokes public.approve_maintenance_work_order RPC via Supabase.
 */
export async function approveMaintenanceWorkOrder(ticketId: string, contractorAmountCents: number) {
  const { data, error } = await supabase.rpc("approve_maintenance_work_order", {
    p_ticket_id: ticketId,
    p_contractor_amount_cents: contractorAmountCents,
  });

  if (error) {
    throw new Error(`Failed to approve maintenance work order: ${error.message}`);
  }

  return data;
}
