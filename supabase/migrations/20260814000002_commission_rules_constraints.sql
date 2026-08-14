-- Add database CHECK constraints on commission_rule_set and commission_rule_line
-- Prevents negative or unconstrained rates from being stored in the database.

ALTER TABLE public.commission_rule_set
  ADD CONSTRAINT commission_rule_set_default_rate_check
  CHECK (default_commission_rate_bps >= 0 AND default_commission_rate_bps <= 10000);

ALTER TABLE public.commission_rule_set
  ADD CONSTRAINT commission_rule_set_office_share_check
  CHECK (office_share_bps >= 0 AND office_share_bps <= 10000);

ALTER TABLE public.commission_rule_line
  ADD CONSTRAINT commission_rule_line_rate_check
  CHECK (rate_bps >= 0 AND rate_bps <= 10000);

ALTER TABLE public.commission_rule_line
  ADD CONSTRAINT commission_rule_line_fixed_amount_check
  CHECK (fixed_amount_cents >= 0);
