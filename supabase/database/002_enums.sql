-- =============================================================================
-- 002_enums.sql
-- Custom enum types used across the schema
-- =============================================================================

-- User roles (§3)
create type public.user_role as enum (
  'principal',
  'agent',
  'candidate',
  'admin'
);

-- User status
create type public.user_status as enum (
  'active',
  'suspended',
  'archived'
);

-- Deal type (§5)
create type public.deal_type as enum (
  'sale',
  'rental'
);

-- Deal status (§5.1)
create type public.deal_status as enum (
  'active',
  'registered',
  'cancelled',
  'lapsed'
);

-- Deal stages — 13 stages per the directed stage machine (§5.1)
create type public.deal_stage as enum (
  'mandate_signed',
  'listed_marketing',
  'offer_received',
  'otp_signed',
  'suspensive_conditions_pending',
  'conveyancer_instructed',
  'compliance_certificates',
  'transfer_duty_vat',
  'rates_levy_clearance',
  'documents_signed_guarantees',
  'lodged',
  'registered',
  'commission_released'
);

-- Mandate type
create type public.mandate_type as enum (
  'sole',
  'joint',
  'open'
);

-- Mandate status
create type public.mandate_status as enum (
  'active',
  'expired',
  'cancelled'
);

-- Party type (§11.1)
create type public.party_type as enum (
  'seller',
  'purchaser',
  'landlord',
  'tenant',
  'referrer'
);

-- Entity type (§11.1)
create type public.entity_type as enum (
  'natural_person',
  'company',
  'close_corporation',
  'trust',
  'deceased_estate'
);

-- FICA status
create type public.fica_status as enum (
  'not_started',
  'partial',
  'complete',
  'expired'
);

-- Suspensive condition type (§6.1)
create type public.condition_type as enum (
  'bond_approval',
  'sale_of_property',
  'fica_clearance',
  'due_diligence',
  'body_corporate_consent',
  'subdivision_rezoning',
  'other'
);

-- Condition status (§6.2)
create type public.condition_status as enum (
  'pending',
  'fulfilled',
  'waived',
  'failed',
  'extended'
);

-- Bond application status (§6.2 FR-M2-07)
create type public.bond_app_status as enum (
  'not_applied',
  'submitted',
  'declined',
  'approved_in_principle',
  'formally_granted'
);

-- Offer status
create type public.offer_status as enum (
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
  'expired',
  'countered'
);

-- Participant role in a deal
create type public.participant_role as enum (
  'listing_agent',
  'selling_agent',
  'co_agent',
  'referrer'
);

-- Split type for commission allocation
create type public.split_type as enum (
  'percentage',
  'fixed'
);

-- Commission calculation status (§11.2)
create type public.commission_calc_status as enum (
  'provisional',
  'confirmed',
  'reversed'
);

-- Commission rule line type (§11.2)
create type public.commission_line_type as enum (
  'franchise_fee',
  'referral_fee',
  'marketing_recovery',
  'comandate_share',
  'office_share',
  'desk_fee'
);

-- VAT treatment on commission rules
create type public.vat_treatment as enum (
  'inclusive',
  'exclusive',
  'not_applicable'
);

-- Commission advance status
create type public.advance_status as enum (
  'outstanding',
  'partially_recovered',
  'fully_recovered'
);

-- Notification channel
create type public.notification_channel as enum (
  'email',
  'in_app',
  'whatsapp_link'
);

-- Lead status
create type public.lead_status as enum (
  'new',
  'contacted',
  'qualified',
  'converted',
  'closed'
);

-- Document category
create type public.document_category as enum (
  'mandate',
  'otp',
  'fica_id',
  'fica_proof_of_address',
  'fica_bank_statement',
  'title_deed',
  'municipal_account',
  'levy_clearance',
  'body_corporate_consent',
  'bond_grant_letter',
  'spousal_consent',
  'compliance_electrical',
  'compliance_beetle',
  'compliance_gas',
  'compliance_plumbing',
  'compliance_electric_fence',
  'ffc_certificate',
  'commission_statement',
  'template',
  'other'
);

-- Audit log action
create type public.audit_action as enum (
  'create',
  'update',
  'delete',
  'stage_transition',
  'calculation',
  'login',
  'export'
);

-- Property type
create type public.property_type as enum (
  'house',
  'townhouse',
  'apartment',
  'vacant_land',
  'farm',
  'commercial',
  'industrial',
  'other'
);

-- Cancellation reason taxonomy (Appendix C)
create type public.cancellation_reason as enum (
  'bond_declined',
  'bond_not_applied_in_time',
  'sale_of_purchasers_property_failed',
  'purchaser_withdrew',
  'seller_withdrew',
  'property_defect',
  'compliance_certificate_failure',
  'price_renegotiation_failed',
  'purchaser_death_or_insolvency',
  'seller_death_or_insolvency',
  'deceased_estate_or_trust_complication',
  'title_or_boundary_defect',
  'municipal_or_clearance_obstruction',
  'other'
);

-- Rounding mode for commission
create type public.rounding_mode as enum (
  'half_up',
  'half_down',
  'bankers'
);
