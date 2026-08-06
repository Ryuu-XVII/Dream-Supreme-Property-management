import { supabase } from "@/lib/supabase";

export interface WhatsAppMessagePayload {
  phone: string;
  templateName: string;
  params: Record<string, string>;
}

/**
 * Format phone number to international E.164 format.
 */
export function formatE164Phone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    return `27${cleaned.slice(1)}`; // Default SA country code
  }
  return cleaned;
}

/**
 * Send WhatsApp Business API notification payload.
 */
export async function sendWhatsAppMessage(payload: WhatsAppMessagePayload) {
  const formattedPhone = formatE164Phone(payload.phone);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Authentication required to queue a WhatsApp message.");
  const { data: account, error: accountError } = await supabase
    .from("user_account")
    .select("agency_id")
    .eq("auth_user_id", auth.user.id)
    .single();
  if (accountError || !account)
    throw new Error(accountError?.message || "Agency account not found.");

  const { data, error } = await supabase
    .from("whatsapp_queue")
    .insert({
      agency_id: account.agency_id,
      recipient_phone: formattedPhone,
      template_name: payload.templateName,
      template_data: payload.params,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to queue WhatsApp message: ${error.message}`);
  }

  return data;
}
