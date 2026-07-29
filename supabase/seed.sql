insert into public.agency (
  id, name, public_slug, registration_number, ppra_reference, vat_number,
  is_vat_vendor, address
) values (
  '10000000-0000-0000-0000-000000000001',
  'Dream Supreme Properties',
  'dream-supreme-properties',
  '2020/123456/07',
  'PPRA-DSP-001',
  '4123456789',
  true,
  'Johannesburg, Gauteng'
)
on conflict (id) do update set
  name = excluded.name,
  public_slug = excluded.public_slug;

insert into public.branch(id, agency_id, name, address)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Johannesburg', 'Johannesburg, Gauteng'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Midrand', 'Midrand, Gauteng')
on conflict (id) do update set name = excluded.name, address = excluded.address;

insert into public.commission_rule_set(
  id, agency_id, name, effective_from, is_default, vat_treatment,
  default_commission_rate_bps, franchise_fee_bps, office_share_bps, rounding_mode
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Dream Supreme Standard',
  '2026-01-01',
  true,
  'inclusive',
  500,
  0,
  5000,
  'half_up'
)
on conflict (id) do update set is_default = true;

insert into public.config_transfer_duty(id, effective_from, brackets_json)
values (
  '40000000-0000-0000-0000-000000000001',
  '2026-04-01',
  '[
    {"from": 0, "to": 121000000, "rate": 0, "base": 0},
    {"from": 121000000, "to": 166380000, "rate": 3, "base": 0},
    {"from": 166380000, "to": 232930000, "rate": 6, "base": 1361400},
    {"from": 232930000, "to": 299480000, "rate": 8, "base": 5354400},
    {"from": 299480000, "to": 1331000000, "rate": 11, "base": 10678400},
    {"from": 1331000000, "to": null, "rate": 13, "base": 124145600}
  ]'::jsonb
)
on conflict (id) do update set effective_from = excluded.effective_from, brackets_json = excluded.brackets_json;
