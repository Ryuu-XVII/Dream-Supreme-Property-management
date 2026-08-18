-- Fix: Cast string literals in vat_treatment and rounding_mode CASE statements to their respective ENUM types.
-- Without this cast, Postgres raises: column "vat_treatment" is of type vat_treatment but expression is of type text

create or replace function public.save_commission_rule_set(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_rule_set_id uuid;
  v_line jsonb;
begin
  if public.get_current_role() not in ('admin', 'admin_agent') then raise exception 'Only an administrator can change commission rules.'; end if;
  if nullif(trim(p_payload->>'name'), '') is null then raise exception 'Rule-set name is required.'; end if;
  begin
    v_rule_set_id := nullif(p_payload->>'id', '')::uuid;
  exception when invalid_text_representation then
    v_rule_set_id := null;
  end;
  if coalesce((p_payload->>'isDefault')::boolean, false) then
    update public.commission_rule_set set is_default = false where agency_id = v_agency_id;
  end if;
  if v_rule_set_id is null then
    insert into public.commission_rule_set(
      agency_id, name, effective_from, effective_to, is_default, vat_treatment,
      default_commission_rate_bps, office_share_bps, rounding_mode, created_by
    ) values (
      v_agency_id, trim(p_payload->>'name'), (p_payload->>'effectiveFrom')::date,
      nullif(p_payload->>'effectiveTo', '')::date,
      coalesce((p_payload->>'isDefault')::boolean, false),
      (case when coalesce((p_payload->>'vatInclusive')::boolean, true) then 'inclusive' else 'exclusive' end)::public.vat_treatment,
      (p_payload->>'defaultBps')::int, round((p_payload->>'officeSharePct')::numeric * 100)::int,
      coalesce(nullif(p_payload->>'roundingMode', '')::public.rounding_mode, 'half_up'::public.rounding_mode),
      public.get_current_user_account_id()
    ) returning id into v_rule_set_id;
  else
    update public.commission_rule_set set
      name = trim(p_payload->>'name'), effective_from = (p_payload->>'effectiveFrom')::date,
      effective_to = nullif(p_payload->>'effectiveTo', '')::date,
      is_default = coalesce((p_payload->>'isDefault')::boolean, false),
      vat_treatment = (case when coalesce((p_payload->>'vatInclusive')::boolean, true) then 'inclusive' else 'exclusive' end)::public.vat_treatment,
      default_commission_rate_bps = (p_payload->>'defaultBps')::int,
      office_share_bps = round((p_payload->>'officeSharePct')::numeric * 100)::int,
      rounding_mode = coalesce(nullif(p_payload->>'roundingMode', '')::public.rounding_mode, 'half_up'::public.rounding_mode)
    where id = v_rule_set_id and agency_id = v_agency_id;
    if not found then raise exception 'Commission rule set not found.'; end if;
    delete from public.commission_rule_line where rule_set_id = v_rule_set_id;
  end if;
  for v_line in select value from jsonb_array_elements(coalesce(p_payload->'deductions', '[]'::jsonb)) loop
    insert into public.commission_rule_line(
      rule_set_id, sequence, line_type, calculation_basis, rate_bps,
      fixed_amount_cents, payee_type, description
    ) values (
      v_rule_set_id, coalesce((v_line->>'sequence')::int, 0),
      (v_line->>'lineType')::public.commission_line_type,
      coalesce(v_line->>'basis', 'percentage'), coalesce((v_line->>'rateBps')::int, 0),
      coalesce((v_line->>'fixedCents')::bigint, 0), v_line->>'payee', v_line->>'description'
    );
  end loop;
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (v_agency_id, public.get_current_user_account_id(), 'commission_rule_set', v_rule_set_id,
    'update', jsonb_build_object('name', p_payload->>'name', 'is_default', p_payload->>'isDefault'));
  return v_rule_set_id;
end;
$$;

revoke all on function public.save_commission_rule_set(jsonb) from public, anon;
grant execute on function public.save_commission_rule_set(jsonb) to authenticated;
