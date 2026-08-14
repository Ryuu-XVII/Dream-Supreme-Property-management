-- Migration: Add missing 'progress_note_added' audit_action enum value
-- Description: notify_agency_admins() compares NEW.action = 'progress_note_added'
-- on every AFTER INSERT on public.audit_log (trg_notify_deal_notes). Since
-- audit_log.action is typed public.audit_action and 'progress_note_added' was
-- never added as a member of that enum, Postgres has to fail casting the
-- literal to the enum type before it can even evaluate the comparison — which
-- broke EVERY audit_log insert application-wide (deal creation, mandate
-- creation, stage transitions, etc. all write to audit_log), not just an
-- actual progress-note event. Adding the value lets the comparison type-check
-- for all rows again; no feature currently inserts this action, but the
-- notify_agency_admins() branch was clearly written to expect it.

alter type public.audit_action add value if not exists 'progress_note_added';
