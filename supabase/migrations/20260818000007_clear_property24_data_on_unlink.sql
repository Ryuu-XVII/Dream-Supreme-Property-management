-- Migration: Clear cached Property24 data when an agent's link is removed
-- Description: Removing an agent's `property24_url` previously left their
-- synced listings and cached profile behind, so an unlinked agent's stock kept
-- appearing on the Listings and admin Property Portfolio pages indefinitely.
--
-- This cannot be done from the browser: `agent_property24_listing` carries a
-- select-only policy on purpose, so that nothing other than the sync Worker's
-- service role can write listings. Rather than open up a delete policy — which
-- would let any authenticated user delete listing rows directly — the cleanup
-- runs as a trigger, which also means it cannot be forgotten by a future
-- caller that clears the URL some other way.

create or replace function public.clear_property24_data_on_unlink()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only when the link is actually being removed, not on every profile save.
  if new.property24_url is null and old.property24_url is not null then
    delete from public.agent_property24_listing where user_account_id = old.id;
    new.property24_profile := null;
    new.property24_synced_at := null;
    new.property24_sync_error := null;
  end if;
  return new;
end;
$$;

-- BEFORE so the cleared columns are part of the same write rather than a
-- second update, and scoped to `property24_url` so unrelated profile updates
-- do not pay for the check.
drop trigger if exists clear_property24_data_on_unlink on public.user_account;
create trigger clear_property24_data_on_unlink
  before update of property24_url on public.user_account
  for each row execute function public.clear_property24_data_on_unlink();
