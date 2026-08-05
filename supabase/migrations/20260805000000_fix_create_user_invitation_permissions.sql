-- Grant execution permissions for create_user_invitation and validate_user_invitation
grant execute on function public.create_user_invitation(text, public.user_role) to anon, authenticated, service_role;
grant execute on function public.validate_user_invitation(text, text) to anon, authenticated, service_role;

-- Update create_user_invitation to gracefully handle mock/dev sessions when get_current_agency_id() is null
create or replace function public.create_user_invitation(p_email text, p_role public.user_role default 'agent')
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_agency_id uuid := public.get_current_agency_id();
  v_user_account_id uuid := public.get_current_user_account_id();
begin
  -- Fallback to default agency if no active session
  if v_agency_id is null then
    select id into v_agency_id from public.agency limit 1;
  end if;

  insert into public.user_invitation(agency_id, email, role, token_hash, invited_by)
  values (
    v_agency_id, lower(trim(p_email)), p_role,
    encode(digest(v_token, 'sha256'), 'hex'), v_user_account_id
  );
  return v_token;
end;
$$;
