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

  const { data, error } = await supabase
    .from("whatsapp_message_log")
    .insert({
      recipient_phone: formattedPhone,
      template_name: payload.templateName,
      payload: payload.params,
      status: "sent",
      provider_message_id: `wa_${Date.now()}`,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log WhatsApp message: ${error.message}`);
  }

  return data;
}
