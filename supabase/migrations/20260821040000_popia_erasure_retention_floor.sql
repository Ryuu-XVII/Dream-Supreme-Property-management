-- Closes Gap 2 from documentation/technical/COMPLIANCE_AUDIT_2026-08-19.md:
-- popia_erase_party_data could redact a party's identity fields immediately,
-- including before FICA's 5-year retention window (COMPLIANCE.md §3, from
-- the date the business relationship terminated or the transaction
-- concluded) had elapsed. A party still on an open deal or lease hasn't
-- reached "terminated" at all; one whose most recent deal/lease concluded
-- less than 5 years ago is still inside the statutory window. Only a party
-- who never actually transacted, or whose last relationship concluded more
-- than 5 years ago, can now be erased. Only the guard changes — the rest of
-- the function body is unchanged from what is live today.
create or replace function public.popia_erase_party_data(
  p_party_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_party public.party%rowtype;
  v_active_deals int;
  v_active_leases int;
  v_last_concluded date;
  v_retention_floor date;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
    raise exception 'Only managers can erase POPIA subject data.';
  end if;

  select * into v_party from public.party where id = p_party_id and agency_id = v_agency_id for update;
  if v_party.id is null then raise exception 'Party not found in this agency.'; end if;

  select count(*) into v_active_deals
  from public.deal_party dp
  join public.deal d on d.id = dp.deal_id
  where dp.party_id = p_party_id and d.status = 'active';

  select count(*) into v_active_leases
  from public.lease
  where (landlord_party_id = p_party_id or tenant_party_id = p_party_id)
    and status = 'active';

  if v_active_deals > 0 or v_active_leases > 0 then
    raise exception 'This party is on an active deal or lease and cannot be erased.';
  end if;

  select greatest(
    (select max(coalesce(d.registration_date, d.cancelled_on, d.updated_at::date))
     from public.deal_party dp
     join public.deal d on d.id = dp.deal_id
     where dp.party_id = p_party_id),
    (select max(l.end_on) from public.lease l
     where l.landlord_party_id = p_party_id or l.tenant_party_id = p_party_id)
  ) into v_last_concluded;

  if v_last_concluded is not null then
    v_retention_floor := (v_last_concluded + interval '5 years')::date;
    if current_date < v_retention_floor then
      raise exception
        'FICA requires this party''s records be retained until % (5 years after their last concluded deal/lease).',
        v_retention_floor;
    end if;
  end if;

  update public.party set
    full_name = 'REDACTED',
    email = null,
    mobile = null,
    id_or_reg_number = null
  where id = p_party_id;

  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (
    v_agency_id, public.get_current_user_account_id(), 'party', p_party_id, 'popia_erasure',
    jsonb_build_object('full_name', v_party.full_name, 'email', v_party.email),
    jsonb_build_object('erased_at', now())
  );

  return jsonb_build_object('erased', true);
end;
$$;
