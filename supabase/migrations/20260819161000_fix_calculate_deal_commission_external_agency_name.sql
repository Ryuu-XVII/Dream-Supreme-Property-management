-- calculate_deal_commission's participant loop reads
-- v_participant.external_payee_name, but public.deal_participant has no
-- such column -- it's external_agency_name (the target table,
-- commission_allocation, does have an external_payee_name column, which is
-- what the insert is populating; only the source read was wrong). Every
-- attempt to calculate commission on a deal with an external participant --
-- or, since %rowtype resolves the field at call time regardless of whether
-- any row is external, on any deal at all -- failed with
-- `record "v_participant" has no field "external_payee_name"`. Only that one
-- reference changes in each overload; the rest of each body is unchanged
-- from what is live today.

create or replace function public.calculate_deal_commission(
  p_deal_id uuid,
  p_rule_set_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_mandate public.mandate%rowtype;
  v_rule public.commission_rule_set%rowtype;
  v_calc_id uuid;
  v_gross bigint;
  v_vat bigint;
  v_net bigint;
  v_franchise_fee bigint := 0;
  v_pool bigint;
  v_office bigint;
  v_agent_pool bigint;
  v_line public.commission_rule_line%rowtype;
  v_participant public.deal_participant%rowtype;
  v_allocation bigint;
  v_advance bigint;
  v_allocated bigint := 0;
  v_invalid_ffc text;
  v_branch_fee_pct numeric(5,2) := 0;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then raise exception 'Only an administrator can calculate commission.'; end if;
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;

  select * into v_deal from public.deal where id = p_deal_id;
  select * into v_mandate from public.mandate where id = v_deal.mandate_id;

  if p_rule_set_id is not null then
    select * into v_rule from public.commission_rule_set where id = p_rule_set_id and agency_id = v_deal.agency_id;
  else
    -- Tier 1: Default rule set covering registration date
    select * into v_rule from public.commission_rule_set
    where agency_id = v_deal.agency_id and is_default
      and effective_from <= coalesce(v_deal.registration_date, current_date)
      and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
    order by effective_from desc limit 1;

    -- Tier 2: Any rule set covering registration date
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
        and effective_from <= coalesce(v_deal.registration_date, current_date)
        and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
      order by is_default desc, effective_from desc limit 1;
    end if;

    -- Tier 3: Any default rule set for the agency
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id and is_default
      order by effective_from desc limit 1;
    end if;

    -- Tier 4: Most recent rule set for the agency
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
      order by is_default desc, effective_from desc limit 1;
    end if;
  end if;

  if v_rule.id is null then
    raise exception 'No applicable commission rule set exists. Please create a rule set under Admin > Commission Rules.';
  end if;

  select string_agg(u.full_name, ', ') into v_invalid_ffc
  from public.deal_participant dp
  join public.user_account u on u.id = dp.user_account_id
  where dp.deal_id = p_deal_id and not dp.is_external
    and not exists (
      select 1 from public.ffc_certificate f
      where f.user_account_id = u.id
        and f.issued_on <= coalesce(v_deal.registration_date, current_date)
        and f.expires_on >= coalesce(v_deal.registration_date, current_date)
    );
  if v_invalid_ffc is not null then raise exception 'Valid FFC required for: %', v_invalid_ffc; end if;

  if (select coalesce(sum(split_value), 0) from public.deal_participant where deal_id = p_deal_id and split_type = 'percentage') <> 100 then
    raise exception 'Practitioner percentage splits must total 100.';
  end if;

  v_gross := round(v_deal.sale_price_cents::numeric * coalesce(nullif(v_mandate.commission_rate_bps, 0), v_rule.default_commission_rate_bps) / 10000)::bigint;

  if v_rule.vat_treatment = 'inclusive' then
    v_net := round(v_gross::numeric / (1 + public.get_vat_rate()))::bigint;
    v_vat := v_gross - v_net;
  elsif v_rule.vat_treatment = 'exclusive' then
    v_net := v_gross;
    v_vat := round(v_gross::numeric * public.get_vat_rate())::bigint;
  else
    v_net := v_gross;
    v_vat := 0;
  end if;

  -- Calculate Franchise Fee
  if v_deal.branch_id is not null then
    select coalesce(franchise_fee_pct, 0) into v_branch_fee_pct from public.branch where id = v_deal.branch_id;
    if v_branch_fee_pct > 0 then
      v_franchise_fee := round(v_net::numeric * (v_branch_fee_pct / 100))::bigint;
    end if;
  end if;

  -- Distributable pool is Net minus Franchise Fee
  v_pool := v_net - v_franchise_fee;

  for v_line in select * from public.commission_rule_line where rule_set_id = v_rule.id and line_type <> 'office_share' order by sequence loop
    if v_line.calculation_basis = 'fixed' then
      v_pool := v_pool - v_line.fixed_amount_cents;
    elsif v_line.calculation_basis = 'percentage_of_remaining' then
      v_pool := v_pool - round(v_pool::numeric * v_line.rate_bps / 10000)::bigint;
    else
      -- Default to percentage of base net commission
      v_pool := v_pool - round(v_net::numeric * v_line.rate_bps / 10000)::bigint;
    end if;
  end loop;

  v_office := round(v_pool::numeric * v_rule.office_share_bps / 10000)::bigint;
  v_agent_pool := v_pool - v_office;

  update public.commission_calculation set status = 'archived' where deal_id = p_deal_id and status = 'provisional';

  insert into public.commission_calculation (deal_id, rule_set_id, calculated_by, gross_cents, vat_cents, net_cents, franchise_fee_cents, distributable_pool_cents, office_share_cents, agent_pool_cents, input_snapshot_json, status)
  values (
    p_deal_id, v_rule.id, public.get_current_user_account_id(),
    v_gross, v_vat, v_net, v_franchise_fee, v_pool, v_office, v_agent_pool,
    jsonb_build_object(
      'sale_price', v_deal.sale_price_cents,
      'comm_rate_bps', coalesce(nullif(v_mandate.commission_rate_bps, 0), v_rule.default_commission_rate_bps),
      'vat_treatment', v_rule.vat_treatment,
      'franchise_fee_pct', v_branch_fee_pct,
      'office_share_bps', v_rule.office_share_bps,
      'rule_lines', coalesce((select jsonb_agg(to_jsonb(line) order by line.sequence) from public.commission_rule_line line where line.rule_set_id = v_rule.id), '[]'::jsonb)),
    'provisional'
  ) returning id into v_calc_id;

  for v_participant in select * from public.deal_participant where deal_id = p_deal_id order by is_external desc, created_at asc loop
    if v_participant.split_type = 'percentage' then
      v_allocation := round(v_agent_pool::numeric * v_participant.split_value / 100)::bigint;
    else
      v_allocation := v_participant.split_value;
    end if;
    v_advance := 0;
    if not v_participant.is_external then
      select coalesce(sum(amount_cents), 0) into v_advance from public.commission_advance where user_account_id = v_participant.user_account_id and deal_id = p_deal_id;
    end if;
    insert into public.commission_allocation (calculation_id, user_account_id, external_payee_name, allocation_type, gross_allocation_cents, desk_fee_cents, advance_recovery_cents, net_payable_cents)
    values (v_calc_id, v_participant.user_account_id, v_participant.external_agency_name, 'primary_split', v_allocation, 0, v_advance, v_allocation - v_advance);
    v_allocated := v_allocated + v_allocation;
  end loop;

  if v_allocated > v_agent_pool then raise exception 'Allocations (%) exceed the agent pool (%). Check fixed allocations.', v_allocated, v_agent_pool; end if;
  return v_calc_id;
end;
$$;

create or replace function public.calculate_deal_commission(
  p_deal_id uuid,
  p_rule_set_id uuid default null,
  p_override boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_mandate public.mandate%rowtype;
  v_rule public.commission_rule_set%rowtype;
  v_calc_id uuid;
  v_gross bigint;
  v_vat bigint;
  v_net bigint;
  v_franchise_fee bigint := 0;
  v_pool bigint;
  v_office bigint;
  v_agent_pool bigint;
  v_line public.commission_rule_line%rowtype;
  v_participant public.deal_participant%rowtype;
  v_allocation bigint;
  v_advance bigint;
  v_allocated bigint := 0;
  v_invalid_ffc text;
  v_branch_fee_pct numeric(5,2) := 0;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then raise exception 'Only an administrator can calculate commission.'; end if;
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;

  select * into v_deal from public.deal where id = p_deal_id;
  select * into v_mandate from public.mandate where id = v_deal.mandate_id;

  if p_rule_set_id is not null then
    select * into v_rule from public.commission_rule_set where id = p_rule_set_id and agency_id = v_deal.agency_id;
  else
    -- Tier 1: Default rule set covering registration date
    select * into v_rule from public.commission_rule_set
    where agency_id = v_deal.agency_id and is_default
      and effective_from <= coalesce(v_deal.registration_date, current_date)
      and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
    order by effective_from desc limit 1;

    -- Tier 2: Any rule set covering registration date
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
        and effective_from <= coalesce(v_deal.registration_date, current_date)
        and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
      order by is_default desc, effective_from desc limit 1;
    end if;

    -- Tier 3: Any default rule set for the agency
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id and is_default
      order by effective_from desc limit 1;
    end if;

    -- Tier 4: Most recent rule set for the agency
    if v_rule.id is null then
      select * into v_rule from public.commission_rule_set
      where agency_id = v_deal.agency_id
      order by is_default desc, effective_from desc limit 1;
    end if;
  end if;

  if v_rule.id is null then
    raise exception 'No applicable commission rule set exists. Please create a rule set under Admin > Commission Rules.';
  end if;

  -- FFC Validation (bypassed if admin override is explicitly set)
  if not coalesce(p_override, false) then
    select string_agg(u.full_name, ', ') into v_invalid_ffc
    from public.deal_participant dp
    join public.user_account u on u.id = dp.user_account_id
    where dp.deal_id = p_deal_id and not dp.is_external
      and not (
        -- 1. Direct or correlated active FFC Certificate
        exists (
          select 1 from public.ffc_certificate f
          where (f.user_account_id = u.id or f.user_account_id in (
            select u2.id from public.user_account u2
            where u2.agency_id = u.agency_id and (lower(u2.email) = lower(u.email) or lower(u2.full_name) = lower(u.full_name))
          ))
          and (f.expires_on is null or f.expires_on >= coalesce(v_deal.registration_date, current_date))
        )
        -- 2. Any FFC Certificate on record
        or exists (
          select 1 from public.ffc_certificate f
          where f.user_account_id = u.id or f.user_account_id in (
            select u2.id from public.user_account u2
            where u2.agency_id = u.agency_id and (lower(u2.email) = lower(u.email) or lower(u2.full_name) = lower(u.full_name))
          )
        )
        -- 3. Uploaded compliance document
        or exists (
          select 1 from public.document d
          where (
            d.user_account_id = u.id or d.uploaded_by = u.id or d.user_account_id in (
              select u2.id from public.user_account u2
              where u2.agency_id = u.agency_id and (lower(u2.email) = lower(u.email) or lower(u2.full_name) = lower(u.full_name))
            )
          )
          and d.category = 'ffc_certificate'::public.document_category
        )
        -- 4. User account or alias has PPRA reference
        or (u.ppra_reference is not null and trim(u.ppra_reference) <> '')
        or exists (
          select 1 from public.user_account u3
          where u3.agency_id = u.agency_id
            and (lower(u3.email) = lower(u.email) or lower(u3.full_name) = lower(u.full_name))
            and u3.ppra_reference is not null and trim(u3.ppra_reference) <> ''
        )
      );
    if v_invalid_ffc is not null then raise exception 'Valid FFC required for: %', v_invalid_ffc; end if;
  end if;

  if (select coalesce(sum(split_value), 0) from public.deal_participant where deal_id = p_deal_id and split_type = 'percentage') <> 100 then
    raise exception 'Practitioner percentage splits must total 100.';
  end if;

  v_gross := round(v_deal.sale_price_cents::numeric * coalesce(nullif(v_mandate.commission_rate_bps, 0), v_rule.default_commission_rate_bps) / 10000)::bigint;

  if v_rule.vat_treatment = 'inclusive' then
    v_net := round(v_gross::numeric / (1 + public.get_vat_rate()))::bigint;
    v_vat := v_gross - v_net;
  elsif v_rule.vat_treatment = 'exclusive' then
    v_net := v_gross;
    v_vat := round(v_gross::numeric * public.get_vat_rate())::bigint;
  else
    v_net := v_gross;
    v_vat := 0;
  end if;

  -- Calculate Franchise Fee
  if v_deal.branch_id is not null then
    select coalesce(franchise_fee_pct, 0) into v_branch_fee_pct from public.branch where id = v_deal.branch_id;
    if v_branch_fee_pct > 0 then
      v_franchise_fee := round(v_net::numeric * (v_branch_fee_pct / 100))::bigint;
    end if;
  end if;

  -- Distributable pool is Net minus Franchise Fee
  v_pool := v_net - v_franchise_fee;

  for v_line in select * from public.commission_rule_line where rule_set_id = v_rule.id and line_type <> 'office_share' order by sequence loop
    if v_line.calculation_basis = 'fixed' then
      v_pool := v_pool - v_line.fixed_amount_cents;
    elsif v_line.calculation_basis = 'percentage_of_remaining' then
      v_pool := v_pool - round(v_pool::numeric * v_line.rate_bps / 10000)::bigint;
    else
      -- Default to percentage of base net commission
      v_pool := v_pool - round(v_net::numeric * v_line.rate_bps / 10000)::bigint;
    end if;
  end loop;

  v_office := round(v_pool::numeric * v_rule.office_share_bps / 10000)::bigint;
  v_agent_pool := v_pool - v_office;

  update public.commission_calculation set status = 'archived' where deal_id = p_deal_id and status = 'provisional';

  insert into public.commission_calculation (deal_id, rule_set_id, calculated_by, gross_cents, vat_cents, net_cents, franchise_fee_cents, distributable_pool_cents, office_share_cents, agent_pool_cents, input_snapshot_json, status)
  values (
    p_deal_id, v_rule.id, public.get_current_user_account_id(),
    v_gross, v_vat, v_net, v_franchise_fee, v_pool, v_office, v_agent_pool,
    jsonb_build_object(
      'sale_price', v_deal.sale_price_cents,
      'comm_rate_bps', coalesce(nullif(v_mandate.commission_rate_bps, 0), v_rule.default_commission_rate_bps),
      'vat_treatment', v_rule.vat_treatment,
      'franchise_fee_pct', v_branch_fee_pct,
      'office_share_bps', v_rule.office_share_bps,
      'rule_lines', coalesce((select jsonb_agg(to_jsonb(line) order by line.sequence) from public.commission_rule_line line where line.rule_set_id = v_rule.id), '[]'::jsonb)),
    'provisional'
  ) returning id into v_calc_id;

  for v_participant in select * from public.deal_participant where deal_id = p_deal_id order by is_external desc, created_at asc loop
    if v_participant.split_type = 'percentage' then
      v_allocation := round(v_agent_pool::numeric * v_participant.split_value / 100)::bigint;
    else
      v_allocation := v_participant.split_value;
    end if;
    v_advance := 0;
    if not v_participant.is_external then
      select coalesce(sum(amount_cents), 0) into v_advance from public.commission_advance where user_account_id = v_participant.user_account_id and deal_id = p_deal_id;
    end if;
    insert into public.commission_allocation (calculation_id, user_account_id, external_payee_name, allocation_type, gross_allocation_cents, desk_fee_cents, advance_recovery_cents, net_payable_cents)
    values (v_calc_id, v_participant.user_account_id, v_participant.external_agency_name, 'primary_split', v_allocation, 0, v_advance, v_allocation - v_advance);
    v_allocated := v_allocated + v_allocation;
  end loop;

  if v_allocated > v_agent_pool then raise exception 'Allocations (%) exceed the agent pool (%). Check fixed allocations.', v_allocated, v_agent_pool; end if;
  return v_calc_id;
end;
$$;
