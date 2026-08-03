-- WhatsApp Queue Schema and Automated Triggers

-- 1. Create the WhatsApp Queue table
create table if not exists public.whatsapp_queue (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  recipient_phone text not null,
  template_name text not null,
  template_data jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.whatsapp_queue enable row level security;

create policy "whatsapp queue viewable by agency" on public.whatsapp_queue
  for select using (agency_id = public.get_current_agency_id());

create index if not exists idx_whatsapp_queue_status_attempts 
  on public.whatsapp_queue (status, attempts, created_at);
create index if not exists idx_whatsapp_queue_agency 
  on public.whatsapp_queue (agency_id);

-- 2. Deal Stage Notification Trigger function
create or replace function public.trigger_deal_stage_whatsapp_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  v_buyer_phone text;
  v_seller_phone text;
begin
  -- Only trigger on specific stage changes
  if new.stage is distinct from old.stage and new.stage in ('bond_approved', 'registered') then
    
    -- Extract buyer and seller phones from deal_party
    select email_phone_number(p) into v_buyer_phone
    from public.deal_party dp
    join public.party p on dp.party_id = p.id
    where dp.deal_id = new.id and dp.role = 'buyer'
    limit 1;
    
    select email_phone_number(p) into v_seller_phone
    from public.deal_party dp
    join public.party p on dp.party_id = p.id
    where dp.deal_id = new.id and dp.role = 'seller'
    limit 1;

    -- Note: email_phone_number function doesn't exist out of the box unless we define it.
    -- Assuming `party` table has `phone` or `mobile`. Let's correct this directly from the table.
    select p.phone into v_buyer_phone
    from public.deal_party dp
    join public.party p on dp.party_id = p.id
    where dp.deal_id = new.id and dp.role = 'buyer'
    limit 1;
    
    select p.phone into v_seller_phone
    from public.deal_party dp
    join public.party p on dp.party_id = p.id
    where dp.deal_id = new.id and dp.role = 'seller'
    limit 1;

    -- Queue for buyer
    if v_buyer_phone is not null then
      insert into public.whatsapp_queue (agency_id, recipient_phone, template_name, template_data)
      values (
        new.agency_id, 
        v_buyer_phone, 
        'deal_stage_' || new.stage::text, 
        jsonb_build_object('deal_id', new.id, 'property_address', new.address, 'stage', new.stage)
      );
    end if;

    -- Queue for seller
    if v_seller_phone is not null then
      insert into public.whatsapp_queue (agency_id, recipient_phone, template_name, template_data)
      values (
        new.agency_id, 
        v_seller_phone, 
        'deal_stage_' || new.stage::text, 
        jsonb_build_object('deal_id', new.id, 'property_address', new.address, 'stage', new.stage)
      );
    end if;

  end if;
  return new;
end;
$$;

-- Create the trigger
drop trigger if exists trg_deal_stage_whatsapp on public.deal;
create trigger trg_deal_stage_whatsapp
after update of stage on public.deal
for each row
execute function public.trigger_deal_stage_whatsapp_notification();

-- 3. Rent Reminders Cron Function
create or replace function public.queue_tenant_rent_reminders()
returns void
language plpgsql
security definer
as $$
declare
  r record;
begin
  for r in
    select 
      li.id as invoice_id,
      l.agency_id,
      p.phone as tenant_phone,
      p.full_name as tenant_name,
      li.due_on,
      li.amount_cents
    from public.lease_invoice li
    join public.lease l on li.lease_id = l.id
    join public.party p on l.tenant_party_id = p.id
    where li.status in ('issued', 'draft') 
      and li.due_on = (current_date + interval '3 days')::date
      and p.phone is not null
  loop
    insert into public.whatsapp_queue (agency_id, recipient_phone, template_name, template_data)
    values (
      r.agency_id, 
      r.tenant_phone, 
      'rent_reminder', 
      jsonb_build_object(
        'invoice_id', r.invoice_id, 
        'tenant_name', r.tenant_name,
        'due_on', r.due_on,
        'amount_cents', r.amount_cents
      )
    );
  end loop;
end;
$$;

-- 4. Schedule via pg_cron
do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.schedule('queue_tenant_rent_reminders', '0 9 * * *', 'select public.queue_tenant_rent_reminders()');
  end if;
end
$$;
