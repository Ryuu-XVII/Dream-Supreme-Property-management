-- RLS cross-tenant/cross-deal isolation tests.
--
-- Exists because two real access-control bugs sat live in this schema
-- undetected until a manual advisor-triage pass this session found them —
-- exactly the class of bug `supabase db lint` and the rest of CI cannot
-- catch, since both were internally-consistent policies that simply forgot
-- to scope by agency/deal. See
-- documentation/technical/DATABASE_SCHEMA_AND_RLS.md §30 for the full
-- writeup of each. This file encodes both as regression tests so they can
-- never silently reopen:
--   1. commission_allocation / commission_clawback had NO agency scoping
--      at all — any admin at any agency could read/write any other
--      agency's commission payouts and clawbacks
--      (20260821051000_fix_commission_allocation_clawback_agency_leak.sql).
--   2. bond_application carried a leftover, broader policy alongside the
--      can_access_deal()-scoped one meant to replace it, reopening
--      cross-deal visibility for any agent in the agency
--      (20260821050000_fix_advisor_warnings.sql).
--
-- Every assertion here was run manually against the live project first
-- (via the postgres role, wrapped in BEGIN/ROLLBACK, switching to
-- `authenticated` + mocking auth.uid() via request.jwt.claim.sub for the
-- actual read) to confirm the exact expected counts before being encoded
-- here, rather than writing pgTAP blind.
--
-- Run with: supabase test db
BEGIN;
SELECT plan(6);

-- ── Fixture: two agencies, each with one deal, one commission
-- calculation, one commission_allocation, and one commission_clawback row
-- belonging to Agency A. Agency B has one admin and no data of its own —
-- everything below asserts what Agency B's admin can and cannot see of
-- Agency A's data, and what Agency A's own admin can see of it.
DO $$
DECLARE
  v_agency_a uuid;
  v_agency_b uuid;
  v_property_a uuid;
  v_deal_a uuid;
  v_ruleset_a uuid;
  v_calc_a uuid;
  v_agent_a uuid := gen_random_uuid();
  v_agent_a_account uuid;
  v_admin_a uuid := gen_random_uuid();
  v_admin_b uuid := gen_random_uuid();
  v_deal_bond uuid;
  v_agent_on_deal uuid := gen_random_uuid();
  v_agent_on_deal_account uuid;
  v_agent_off_deal uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id)
    VALUES (v_agent_a), (v_admin_a), (v_admin_b), (v_agent_on_deal), (v_agent_off_deal);

  INSERT INTO public.agency(name) VALUES ('pgTAP Agency A') RETURNING id INTO v_agency_a;
  INSERT INTO public.agency(name) VALUES ('pgTAP Agency B') RETURNING id INTO v_agency_b;

  INSERT INTO public.property(agency_id, address_line)
    VALUES (v_agency_a, '1 pgTAP St') RETURNING id INTO v_property_a;
  INSERT INTO public.deal(agency_id, property_id, reference, sale_price_cents)
    VALUES (v_agency_a, v_property_a, 'PGTAP-COMMISSION-1', 100000000) RETURNING id INTO v_deal_a;

  INSERT INTO public.commission_rule_set(agency_id, name, effective_from)
    VALUES (v_agency_a, 'pgTAP Rules A', current_date) RETURNING id INTO v_ruleset_a;
  INSERT INTO public.commission_calculation(deal_id, rule_set_id)
    VALUES (v_deal_a, v_ruleset_a) RETURNING id INTO v_calc_a;

  INSERT INTO public.user_account(auth_user_id, agency_id, full_name, email, role, status)
    VALUES (v_agent_a, v_agency_a, 'pgTAP Agent A', 'pgtap-agent-a@example.com', 'agent', 'active')
    RETURNING id INTO v_agent_a_account;
  INSERT INTO public.user_account(auth_user_id, agency_id, full_name, email, role, status)
    VALUES (v_admin_a, v_agency_a, 'pgTAP Admin A', 'pgtap-admin-a@example.com', 'admin', 'active');
  INSERT INTO public.user_account(auth_user_id, agency_id, full_name, email, role, status)
    VALUES (v_admin_b, v_agency_b, 'pgTAP Admin B', 'pgtap-admin-b@example.com', 'admin', 'active');

  INSERT INTO public.commission_allocation(calculation_id, gross_allocation_cents, net_payable_cents)
    VALUES (v_calc_a, 100000, 100000);
  INSERT INTO public.commission_clawback(calculation_id, user_account_id, amount_cents, reason, raised_on)
    VALUES (v_calc_a, v_agent_a_account, 50000, 'pgTAP test', current_date);

  -- Second deal, same agency, for the bond_application deal-level (not
  -- agency-level) isolation check: one agent is a participant, one isn't.
  INSERT INTO public.deal(agency_id, property_id, reference, sale_price_cents)
    VALUES (v_agency_a, v_property_a, 'PGTAP-BOND-1', 100000000) RETURNING id INTO v_deal_bond;
  INSERT INTO public.user_account(auth_user_id, agency_id, full_name, email, role, status)
    VALUES (v_agent_on_deal, v_agency_a, 'pgTAP Agent On Deal', 'pgtap-agent-on@example.com', 'agent', 'active')
    RETURNING id INTO v_agent_on_deal_account;
  INSERT INTO public.user_account(auth_user_id, agency_id, full_name, email, role, status)
    VALUES (v_agent_off_deal, v_agency_a, 'pgTAP Agent Off Deal', 'pgtap-agent-off@example.com', 'agent', 'active');
  INSERT INTO public.deal_participant(deal_id, user_account_id, role)
    VALUES (v_deal_bond, v_agent_on_deal_account, 'listing_agent');
  INSERT INTO public.bond_application(deal_id, institution) VALUES (v_deal_bond, 'pgTAP Test Bank');

  PERFORM set_config('test.calc_a', v_calc_a::text, false);
  PERFORM set_config('test.admin_a', v_admin_a::text, false);
  PERFORM set_config('test.admin_b', v_admin_b::text, false);
  PERFORM set_config('test.deal_bond', v_deal_bond::text, false);
  PERFORM set_config('test.agent_on', v_agent_on_deal::text, false);
  PERFORM set_config('test.agent_off', v_agent_off_deal::text, false);
END $$;

-- commission_allocation: Agency A's own admin sees their agency's row.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.admin_a'), true);
SELECT is(
  (SELECT count(*)::int FROM public.commission_allocation WHERE calculation_id = current_setting('test.calc_a')::uuid),
  1,
  'Agency A admin can see Agency A''s commission_allocation'
);

-- commission_allocation: Agency B's admin must NOT see Agency A's row —
-- the exact cross-tenant leak fixed by 20260821051000.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.admin_b'), true);
SELECT is(
  (SELECT count(*)::int FROM public.commission_allocation WHERE calculation_id = current_setting('test.calc_a')::uuid),
  0,
  'Agency B admin cannot see Agency A''s commission_allocation'
);

-- commission_clawback: same cross-tenant leak, same fix, same table shape.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.admin_b'), true);
SELECT is(
  (SELECT count(*)::int FROM public.commission_clawback WHERE calculation_id = current_setting('test.calc_a')::uuid),
  0,
  'Agency B admin cannot see Agency A''s commission_clawback'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.admin_a'), true);
SELECT is(
  (SELECT count(*)::int FROM public.commission_clawback WHERE calculation_id = current_setting('test.calc_a')::uuid),
  1,
  'Agency A admin can see Agency A''s commission_clawback'
);

-- bond_application: an agent who IS a participant on the deal can see it.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.agent_on'), true);
SELECT is(
  (SELECT count(*)::int FROM public.bond_application WHERE deal_id = current_setting('test.deal_bond')::uuid),
  1,
  'Agent on the deal can see its bond_application'
);

-- bond_application: an agent in the SAME agency but NOT a deal participant
-- must NOT see it — the leftover-broad-policy leak fixed by 20260821050000.
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.agent_off'), true);
SELECT is(
  (SELECT count(*)::int FROM public.bond_application WHERE deal_id = current_setting('test.deal_bond')::uuid),
  0,
  'Agent in the same agency but not on the deal cannot see its bond_application'
);

SELECT * FROM finish();
ROLLBACK;
