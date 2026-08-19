-- Supabase security advisor flagged these functions as having a mutable
-- search_path, which lets a caller who can create objects in a schema ahead
-- of `public` on their session search_path shadow unqualified references
-- inside the function body. Pinning search_path closes that off.

alter function public.admin_archive_old_deals(uuid) set search_path = public;
alter function public.adjust_user_storage_usage(uuid, bigint) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.prevent_hard_delete() set search_path = public;
alter function public.enforce_deal_workflow() set search_path = public;
alter function public.get_current_user_account_id() set search_path = public;
alter function public.log_audit_event(text, uuid, text, text, jsonb) set search_path = public;
alter function public.get_vat_rate() set search_path = public;
alter function public.admin_bulk_retire_users(uuid[]) set search_path = public;
alter function public.get_current_user_role() set search_path = public;
alter function public.update_user_storage_quota(uuid, bigint) set search_path = public;
alter function public.admin_deactivate_idle_agents(uuid) set search_path = public;
alter function public.admin_empty_recycle_bin(uuid) set search_path = public;
alter function public.admin_bulk_reset_commission(uuid[]) set search_path = public;
alter function public.generate_daily_notification_digests() set search_path = public;

alter function public.create_deal_full(
  text, text, text, text, integer, integer, integer, numeric, numeric,
  text, bigint, integer, text, text, text, text, text, text, text, text,
  bigint, date, date, text, text, bigint, date, date
) set search_path = public;

alter function public.create_deal_full(
  text, text, text, property_type, smallint, smallint, smallint, numeric, numeric,
  mandate_type, bigint, integer, text, text, text, fica_status, text, text, text, fica_status,
  bigint, date, date, text, uuid, bigint, date, date
) set search_path = public;
