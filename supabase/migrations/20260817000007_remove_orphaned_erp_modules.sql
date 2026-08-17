-- Migration: Remove orphaned/never-wired ERP modules
-- Description: A stale-feature audit found several database modules that were
-- scaffolded (tables, RLS, and in some cases a SECURITY DEFINER RPC) but never
-- had any consumer in src/ — no route, component, or data hook ever queried
-- them, confirmed via exhaustive grep across the whole application. Verified
-- via reverse-FK search that nothing else in the schema depends on any of
-- these objects. Per explicit product decision, these are being removed
-- outright rather than having UI built for them:
--
-- - WhatsApp Gateway: `whatsapp_queue` was written to by a real deal-stage
--   trigger and a cron job, but no dispatch function ever existed anywhere in
--   the schema — queued messages sat at status='pending' forever. The
--   `/admin/whatsapp` monitoring page (now removed from src/) additionally
--   rendered a hardcoded "Gateway Active" badge regardless of this, which was
--   actively misleading. `whatsapp_message_log` is a second, entirely
--   unwritten table from an earlier, abandoned design of the same feature.
-- - Tiered/sliding-scale commission engine (`commission_tier_rule`,
--   `calculate_tiered_commission_splits()`) and Commission Disbursement
--   Authorization (`commission_disbursement_instruction`) — Module 3 of the
--   original schema comments, never consumed by any screen.
-- - OFX bank-statement reconciliation (`bank_statement_import`), GL/accounting
--   sync (`accounting_sync_log`), EFT payout batching (`eft_payout_batch`) —
--   Module 5, same pattern.
-- - Property portal syndication + buyer matching (`portal_syndication_feed`,
--   `buyer_criteria_profile`, `match_buyers_for_mandate()`) — Module 2, same
--   pattern.
-- - CRM drip marketing (`drip_campaign`, `drip_campaign_step`) — no processor
--   (cron or otherwise) ever consumed campaign steps either.
-- - Smart-form document merge tokens (`document_field_token`) — superseded in
--   practice by the actually-used `generate_document_from_template()` RPC.
-- - Inbound portal-lead webhook log (`portal_lead_webhook_log`) — its client
--   handler (`portalWebhookService.ts`) was already deleted in an earlier
--   cleanup commit; this table is what was left behind.
-- - `register_new_agent(text, text, text, text)` — revoked from every role in
--   20260729000005_operational_hardening.sql, never re-granted, no caller
--   anywhere. Superseded by the invitation-based registration flow.
-- - `is_principal_or_admin()` — its only caller (a policy on public.deal) was
--   dropped by 20260729000005_operational_hardening.sql and replaced with
--   can_access_deal(); unreachable ever since.
--
-- NOT touched: Section 86 trust accounting (`trust_account_ledger`,
-- `record_trust_transaction()`, `process_monthly_section_86_4_interest_allocation()`)
-- is real, working, PPRA-mandated functionality — only its admin UI page was
-- removed from src/ (product decision, not a staleness finding), the backend
-- stays intact and the monthly cron keeps running.

-- 1. WhatsApp Gateway
drop trigger if exists trg_deal_stage_whatsapp on public.deal;
drop function if exists public.trigger_deal_stage_whatsapp_notification();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'queue_tenant_rent_reminders') then
    perform cron.unschedule('queue_tenant_rent_reminders');
  end if;
exception
  when undefined_table or invalid_schema_name or undefined_function then
    null;
end $$;
drop function if exists public.queue_tenant_rent_reminders();

drop table if exists public.whatsapp_queue;
drop table if exists public.whatsapp_message_log;

-- 2. Tiered commission engine & CDA
drop function if exists public.calculate_tiered_commission_splits(uuid);
drop table if exists public.commission_disbursement_instruction;
drop table if exists public.commission_tier_rule;

-- 3. Bank reconciliation, GL sync, EFT payouts
drop table if exists public.bank_statement_import;
drop table if exists public.accounting_sync_log;
drop table if exists public.eft_payout_batch;

-- 4. Property syndication & buyer matching
drop function if exists public.match_buyers_for_mandate(uuid);
drop table if exists public.buyer_criteria_profile;
drop table if exists public.portal_syndication_feed;

-- 5. CRM drip marketing
drop table if exists public.drip_campaign_step;
drop table if exists public.drip_campaign;

-- 6. Smart-form document merge tokens
drop table if exists public.document_field_token;

-- 7. Inbound portal-lead webhook log
drop table if exists public.portal_lead_webhook_log;

-- 8. Dead registration RPC
drop function if exists public.register_new_agent(text, text, text, text);

-- 9. Dead RLS helper: its only caller (a policy on public.deal) was dropped by
-- 20260729000005_operational_hardening.sql, replaced by can_access_deal().
drop function if exists public.is_principal_or_admin();
