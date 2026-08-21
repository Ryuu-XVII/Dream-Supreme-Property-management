-- Further advisor cleanup: these RPCs are all agent/admin actions (create a
-- deal, invite a user, approve a work order, assign a lead, review a
-- compliance item, adjust storage usage, log an audit event) that only ever
-- make sense from an authenticated session, but had EXECUTE granted to
-- `anon` as well. Each already resolves its own identity via
-- get_current_agency_id()/get_current_user_account_id()/auth.uid(), which
-- is NULL for an anon caller, so every one of them already rejects an
-- anonymous call today (verified by reading each function body before
-- writing this migration) — this isn't closing a live exploit the way the
-- earlier advisor-triage migrations did, just removing exposure that never
-- needed to exist.
revoke all on function public.create_user_invitation(text, public.user_role, public.agent_seniority, text) from anon;
revoke all on function public.review_compliance_item(uuid, text, text) from anon;
revoke all on function public.approve_maintenance_work_order(uuid, bigint) from anon;
revoke all on function public.assign_lead_round_robin(uuid) from anon;
revoke all on function public.adjust_user_storage_usage(uuid, bigint) from anon;
revoke all on function public.log_audit_event(text, uuid, text, text, jsonb) from anon;
revoke all on function public.create_deal_full(
  text, text, text, text, integer, integer, integer, numeric, numeric,
  text, bigint, integer, text, text, text, text, text, text, text, text,
  bigint, date, date, text, text, bigint, date, date
) from anon;
revoke all on function public.create_deal_full(
  text, text, text, public.property_type, smallint, smallint, smallint, numeric, numeric,
  public.mandate_type, bigint, integer, text, text, text, public.fica_status, text, text, text, public.fica_status,
  bigint, date, date, text, uuid, bigint, date, date
) from anon;
