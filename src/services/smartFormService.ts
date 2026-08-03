import { supabase } from "@/lib/supabase";

export interface SmartFormFieldMap {
  [key: string]: string | number;
}

export interface EsignAuditEntry {
  envelopeId: string;
  recipientEmail: string;
  signerRole: string;
  action: "sent" | "viewed" | "signed" | "declined";
  ipAddress?: string;
  userAgent?: string;
  signatureSvg?: string;
}

/**
 * Replaces form field tokens (e.g. {{seller_name}}, {{purchase_price}})
 * in template content using data mapping dictionary.
 */
export function populateSmartFormTokens(
  templateContent: string,
  fieldMap: SmartFormFieldMap,
): string {
  let populated = templateContent;
  for (const [key, value] of Object.entries(fieldMap)) {
    const tokenRegex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    populated = populated.replace(tokenRegex, String(value));
  }
  return populated;
}

/**
 * Calculates SHA-256 string checksum for document payload tamper audit trails.
 */
export async function computeDocumentSha256(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Invokes public.review_compliance_item RPC via Supabase.
 */
export async function reviewComplianceItem(
  checklistId: string,
  status: "approved" | "rejected",
  rejectionNotes?: string,
) {
  const { data, error } = await supabase.rpc("review_compliance_item", {
    p_checklist_id: checklistId,
    p_status: status,
    p_rejection_notes: rejectionNotes || null,
  });

  if (error) {
    throw new Error(`Failed to review compliance item: ${error.message}`);
  }

  return data;
}
