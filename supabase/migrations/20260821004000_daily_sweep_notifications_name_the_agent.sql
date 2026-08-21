-- Same fix as notify_agency_admins(): condition and mandate deadline sweeps
-- sent admins the identical body an agent got, with no indication of which
-- agent's deal it concerned. Append "Agent: <name>" for admin/admin_agent
-- recipients only. The FFC expiry sweep already names the agent (it's their
-- own certificate), so it's untouched.
create or replace function public.run_daily_sweeps()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_count integer := 0;
  v_inserted integer := 0;
begin
  insert into public.notification(agency_id, user_account_id, channel, subject, body, related_entity_type, related_entity_id, scheduled_for)
  select distinct d.agency_id, recipient.id, 'in_app',
    case when c.due_on < current_date then 'Condition overdue' else 'Condition deadline approaching' end,
    d.reference || ': ' || coalesce(c.description, c.condition_type::text) || ' is due ' || to_char(c.due_on, 'DD Mon YYYY') ||
    case when recipient.role in ('admin', 'admin_agent') and agents.names is not null
      then ' — Agent: ' || agents.names else '' end,
    'suspensive_condition', c.id, now()
  from public.suspensive_condition c
  join public.deal d on d.id = c.deal_id
  join public.user_account recipient on recipient.agency_id = d.agency_id and recipient.status = 'active'
  left join lateral (
    select string_agg(distinct u.full_name, ', ' order by u.full_name) as names
    from public.deal_participant dp
    join public.user_account u on u.id = dp.user_account_id
    where dp.deal_id = d.id and dp.is_external = false
  ) agents on true
  where c.status in ('pending', 'extended')
    and (c.due_on - current_date in (14, 7, 3, 1) or c.due_on < current_date)
    and (recipient.role in ('admin', 'admin_agent') or exists (
      select 1 from public.deal_participant dp where dp.deal_id = d.id and dp.user_account_id = recipient.id
    ))
    and not exists (
      select 1 from public.notification n where n.user_account_id = recipient.id
        and n.related_entity_id = c.id and n.subject = case when c.due_on < current_date then 'Condition overdue' else 'Condition deadline approaching' end
        and n.created_at >= current_date
    );
  get diagnostics v_count = row_count;

  insert into public.notification(agency_id, user_account_id, channel, subject, body, related_entity_type, related_entity_id, scheduled_for)
  select distinct d.agency_id, recipient.id, 'in_app',
    case when m.expires_on < current_date then 'Mandate expired' else 'Mandate expiry approaching' end,
    d.reference || ': mandate expires ' || to_char(m.expires_on, 'DD Mon YYYY') ||
    case when recipient.role in ('admin', 'admin_agent') and agents.names is not null
      then ' — Agent: ' || agents.names else '' end,
    'mandate', m.id, now()
  from public.mandate m
  join public.deal d on d.mandate_id = m.id and d.status = 'active'
  join public.user_account recipient on recipient.agency_id = d.agency_id and recipient.status = 'active'
  left join lateral (
    select string_agg(distinct u.full_name, ', ' order by u.full_name) as names
    from public.deal_participant dp
    join public.user_account u on u.id = dp.user_account_id
    where dp.deal_id = d.id and dp.is_external = false
  ) agents on true
  where m.status = 'active'
    and (m.expires_on - current_date in (30, 14, 7, 3, 1) or m.expires_on < current_date)
    and (recipient.role in ('admin', 'admin_agent') or exists (
      select 1 from public.deal_participant dp where dp.deal_id = d.id and dp.user_account_id = recipient.id
    ))
    and not exists (
      select 1 from public.notification n where n.user_account_id = recipient.id
        and n.related_entity_id = m.id
        and n.subject = case when m.expires_on < current_date then 'Mandate expired' else 'Mandate expiry approaching' end
        and n.created_at >= current_date
    );
  get diagnostics v_inserted = row_count;
  v_count := v_count + v_inserted;

  insert into public.notification(agency_id, user_account_id, channel, subject, body, related_entity_type, related_entity_id, scheduled_for)
  select u.agency_id, recipient.id, 'in_app',
    case when f.expires_on < current_date then 'FFC expired' else 'FFC expiry approaching' end,
    u.full_name || ': FFC ' || f.certificate_number || ' expires ' || to_char(f.expires_on, 'DD Mon YYYY'),
    'ffc_certificate', f.id, now()
  from public.ffc_certificate f
  join public.user_account u on u.id = f.user_account_id and u.status = 'active'
  join public.user_account recipient on recipient.agency_id = u.agency_id and recipient.status = 'active'
  where (f.expires_on - current_date in (60, 30, 14, 7, 3, 1) or f.expires_on < current_date)
    and (recipient.id = u.id or recipient.role in ('admin', 'admin_agent'))
    and not exists (
      select 1 from public.notification n where n.user_account_id = recipient.id
        and n.related_entity_id = f.id
        and n.subject = case when f.expires_on < current_date then 'FFC expired' else 'FFC expiry approaching' end
        and n.created_at >= current_date
    );
  get diagnostics v_inserted = row_count;
  v_count := v_count + v_inserted;
  return v_count;
end;
$function$;
