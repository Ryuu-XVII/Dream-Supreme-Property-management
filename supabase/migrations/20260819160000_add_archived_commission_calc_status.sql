-- calculate_deal_commission has, since 20260731000000_cascading_commissions.sql,
-- superseded a deal's prior provisional commission calculation with:
--   update public.commission_calculation set status = 'archived' ...
-- but commission_calc_status was only ever defined as
-- ('provisional', 'confirmed', 'reversed') -- 'archived' was never a member.
-- Any deal being recalculated (e.g. advancing to 'registered' a second time,
-- or after an FFC/rule-set fix) that already had a provisional calculation
-- row hit "invalid input value for enum commission_calc_status: archived"
-- and the whole stage transition failed. Add the missing value.

alter type public.commission_calc_status add value if not exists 'archived';
