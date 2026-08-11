import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export interface AgencySystemSettings {
  globalStorageQuotaMb: number;
  maxFileUploadMb: number;
  sessionTimeoutMinutes: number;
  enforceMfa: boolean;
  requireAdminApproval: boolean;
  allowedDomains: string;
  notifyDealStages: boolean;
  notifyFfcWarnings: boolean;
  notifyFicaUploads: boolean;
  notifyCommissionRecon: boolean;
  idleAgentDays: number;
  dealArchiveDays: number;
  recycleBinRetentionDays: number;
}

export const defaultSystemSettings: AgencySystemSettings = {
  globalStorageQuotaMb: 1024,
  maxFileUploadMb: 50,
  sessionTimeoutMinutes: 60,
  enforceMfa: true,
  requireAdminApproval: true,
  allowedDomains: "dreamsupreme.co.za, dreamproperty.co.za",
  notifyDealStages: true,
  notifyFfcWarnings: true,
  notifyFicaUploads: true,
  notifyCommissionRecon: true,
  idleAgentDays: 90,
  dealArchiveDays: 365,
  recycleBinRetentionDays: 30,
};

export function useAgencySystemSettings() {
  const { account } = useAuth();
  return useQuery({
    queryKey: ["agency-system-settings", account?.agencyId],
    enabled: !!account?.agencyId,
    queryFn: async (): Promise<AgencySystemSettings> => {
      const { data, error } = await supabase
        .from("agency_system_setting")
        .select("*")
        .eq("agency_id", account!.agencyId)
        .maybeSingle();

      if (error) {
        console.warn("Failed to load agency_system_setting, using default:", error.message);
        return defaultSystemSettings;
      }
      if (!data) return defaultSystemSettings;

      return {
        globalStorageQuotaMb: data.global_storage_quota_mb ?? 1024,
        maxFileUploadMb: data.max_file_upload_mb ?? 50,
        sessionTimeoutMinutes: data.session_timeout_minutes ?? 60,
        enforceMfa: data.enforce_mfa ?? true,
        requireAdminApproval: data.require_admin_approval ?? true,
        allowedDomains: data.allowed_domains ?? "dreamsupreme.co.za, dreamproperty.co.za",
        notifyDealStages: data.notify_deal_stages ?? true,
        notifyFfcWarnings: data.notify_ffc_warnings ?? true,
        notifyFicaUploads: data.notify_fica_uploads ?? true,
        notifyCommissionRecon: data.notify_commission_recon ?? true,
        idleAgentDays: data.idle_agent_days ?? 90,
        dealArchiveDays: data.deal_archive_days ?? 365,
        recycleBinRetentionDays: data.recycle_bin_retention_days ?? 30,
      };
    },
  });
}

export function useSaveAgencySystemSettings() {
  const { account } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<AgencySystemSettings>) => {
      if (!account?.agencyId) throw new Error("Authentication required");

      const payload = {
        agency_id: account.agencyId,
        ...(settings.globalStorageQuotaMb !== undefined && {
          global_storage_quota_mb: settings.globalStorageQuotaMb,
        }),
        ...(settings.maxFileUploadMb !== undefined && {
          max_file_upload_mb: settings.maxFileUploadMb,
        }),
        ...(settings.sessionTimeoutMinutes !== undefined && {
          session_timeout_minutes: settings.sessionTimeoutMinutes,
        }),
        ...(settings.enforceMfa !== undefined && { enforce_mfa: settings.enforceMfa }),
        ...(settings.requireAdminApproval !== undefined && {
          require_admin_approval: settings.requireAdminApproval,
        }),
        ...(settings.allowedDomains !== undefined && {
          allowed_domains: settings.allowedDomains,
        }),
        ...(settings.notifyDealStages !== undefined && {
          notify_deal_stages: settings.notifyDealStages,
        }),
        ...(settings.notifyFfcWarnings !== undefined && {
          notify_ffc_warnings: settings.notifyFfcWarnings,
        }),
        ...(settings.notifyFicaUploads !== undefined && {
          notify_fica_uploads: settings.notifyFicaUploads,
        }),
        ...(settings.notifyCommissionRecon !== undefined && {
          notify_commission_recon: settings.notifyCommissionRecon,
        }),
        ...(settings.idleAgentDays !== undefined && {
          idle_agent_days: settings.idleAgentDays,
        }),
        ...(settings.dealArchiveDays !== undefined && {
          deal_archive_days: settings.dealArchiveDays,
        }),
        ...(settings.recycleBinRetentionDays !== undefined && {
          recycle_bin_retention_days: settings.recycleBinRetentionDays,
        }),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("agency_system_setting")
        .upsert(payload, { onConflict: "agency_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-system-settings", account?.agencyId] });
    },
  });
}
