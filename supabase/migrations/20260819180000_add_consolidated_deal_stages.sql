-- Consolidates the 13-stage deal pipeline down to 7, without losing any
-- legally/financially meaningful gate. See DATABASE_SCHEMA_AND_RLS.md for
-- the full rationale. Two new enum values replace clusters of stages that
-- were never really sequential decision points:
--   listing_negotiation  <- mandate_signed, listed_marketing, offer_received
--   conveyancing          <- conveyancer_instructed, compliance_certificates,
--                            transfer_duty_vat, rates_levy_clearance,
--                            documents_signed_guarantees
-- otp_signed, suspensive_conditions_pending, lodged, registered, and
-- commission_released are untouched -- each is a real, distinct legal or
-- financial milestone.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as a
-- statement that references the new value, so this migration only adds the
-- values; the data backfill and function rewrites are a separate migration
-- (20260819180100). The 8 superseded enum values are intentionally left in
-- the type (Postgres cannot cheaply drop enum values) -- they remain valid
-- for existing deal_stage_history rows, which are never rewritten so the
-- audit trail stays accurate to what actually happened at each point in
-- time. They are simply never written to deal.stage going forward.

alter type public.deal_stage add value if not exists 'listing_negotiation';
alter type public.deal_stage add value if not exists 'conveyancing';
