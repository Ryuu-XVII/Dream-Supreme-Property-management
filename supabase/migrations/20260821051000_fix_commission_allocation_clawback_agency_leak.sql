-- CRITICAL cross-tenant fix, found while triaging the Supabase advisor's
-- multiple_permissive_policies warnings for commission_allocation and
-- commission_clawback: neither table has an `agency_id` column, and neither
-- table's RLS policies scoped by agency through the join chain either
-- (calculation_id -> commission_calculation.deal_id -> deal.agency_id).
-- "Managers manage allocations"/"Managers manage clawbacks" only checked
-- `get_current_role() = ANY ('admin','admin_agent')` — true for ANY admin
-- at ANY agency — so any agency's admin could read, insert, update, or
-- delete any OTHER agency's commission payouts and clawbacks. The sibling
-- SELECT policies had the identical gap. commission_calculation itself
-- (the parent table) was correctly scoped via `can_access_deal(deal_id)`;
-- this closes the same gap on its two child tables.
alter policy "Authorized allocations are readable" on public.commission_allocation
  using (
    (
      user_account_id = public.get_current_user_account_id()
      or public.get_current_role() = any (array['admin'::public.user_role, 'admin_agent'::public.user_role])
    )
    and exists (
      select 1 from public.commission_calculation cc
      join public.deal d on d.id = cc.deal_id
      where cc.id = commission_allocation.calculation_id
        and d.agency_id = public.get_current_agency_id()
    )
  );

alter policy "Managers manage allocations" on public.commission_allocation
  using (
    public.get_current_role() = any (array['admin'::public.user_role, 'admin_agent'::public.user_role])
    and exists (
      select 1 from public.commission_calculation cc
      join public.deal d on d.id = cc.deal_id
      where cc.id = commission_allocation.calculation_id
        and d.agency_id = public.get_current_agency_id()
    )
  )
  with check (
    public.get_current_role() = any (array['admin'::public.user_role, 'admin_agent'::public.user_role])
    and exists (
      select 1 from public.commission_calculation cc
      join public.deal d on d.id = cc.deal_id
      where cc.id = commission_allocation.calculation_id
        and d.agency_id = public.get_current_agency_id()
    )
  );

alter policy "Authorized clawbacks are readable" on public.commission_clawback
  using (
    (
      user_account_id = public.get_current_user_account_id()
      or public.get_current_role() = any (array['admin'::public.user_role, 'admin_agent'::public.user_role])
    )
    and exists (
      select 1 from public.commission_calculation cc
      join public.deal d on d.id = cc.deal_id
      where cc.id = commission_clawback.calculation_id
        and d.agency_id = public.get_current_agency_id()
    )
  );

alter policy "Managers manage clawbacks" on public.commission_clawback
  using (
    public.get_current_role() = any (array['admin'::public.user_role, 'admin_agent'::public.user_role])
    and exists (
      select 1 from public.commission_calculation cc
      join public.deal d on d.id = cc.deal_id
      where cc.id = commission_clawback.calculation_id
        and d.agency_id = public.get_current_agency_id()
    )
  )
  with check (
    public.get_current_role() = any (array['admin'::public.user_role, 'admin_agent'::public.user_role])
    and exists (
      select 1 from public.commission_calculation cc
      join public.deal d on d.id = cc.deal_id
      where cc.id = commission_clawback.calculation_id
        and d.agency_id = public.get_current_agency_id()
    )
  );
