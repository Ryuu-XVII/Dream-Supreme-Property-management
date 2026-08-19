-- Same CRLF issue as 20260819170000, found afterward on one more function
-- that a broader scan of prosrc for embedded CR bytes turned up.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
