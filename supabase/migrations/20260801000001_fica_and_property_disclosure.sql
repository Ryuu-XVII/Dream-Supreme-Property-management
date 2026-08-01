-- =============================================================================
-- ENHANCED FICA, POPIA, AND PROPERTY DISCLOSURE SCHEMA
-- Migration: 20260801000001_fica_and_property_disclosure.sql
-- =============================================================================

-- 1. Add SARS tax clearance, PEP/PIP screening timestamps to Party
alter table public.party
  add column if not exists sars_tax_clearance_number text,
  add column if not exists source_of_wealth_description text,
  add column if not exists fica_verified_by uuid references public.user_account(id) on delete set null,
  add column if not exists fica_verified_at timestamptz;

-- 2. Add PPRA Section 67 Property Condition Disclosure & Municipal Details to Property
alter table public.property
  add column if not exists section_67_disclosure_signed boolean not null default false,
  add column if not exists section_67_disclosure_document_id uuid references public.document(id) on delete set null,
  add column if not exists municipal_rates_account_number text,
  add column if not exists electricity_meter_number text,
  add column if not exists water_meter_number text,
  add column if not exists sectional_title_exclusive_use_areas text,
  add column if not exists body_corporate_managing_agent text;

-- 3. Add Deposit Stakeholder Routing to Deal
alter table public.deal
  add column if not exists deposit_stakeholder text check (deposit_stakeholder in ('Agency Trust', 'Conveyancer Trust', 'Landlord', 'Other')),
  add column if not exists section_35a_applicable boolean not null default false;
