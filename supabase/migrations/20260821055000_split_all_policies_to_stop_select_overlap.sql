-- Static, explicit replacement for the 22 tables where an "ALL" policy
-- overlapped its sibling SELECT policy (see verification notes in this
-- session). Each ALL policy becomes 3 command-specific policies with the
-- identical USING/WITH CHECK, leaving the existing SELECT policy alone.

-- commission_advance: "Managers manage advances"
create policy "Managers manage advances (insert)" on public.commission_advance for insert with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Managers manage advances (update)" on public.commission_advance for update using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))) with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Managers manage advances (delete)" on public.commission_advance for delete using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
drop policy "Managers manage advances" on public.commission_advance;

-- commission_allocation: "Managers manage allocations"
create policy "Managers manage allocations (insert)" on public.commission_allocation for insert with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_allocation.calculation_id) AND (d.agency_id = get_current_agency_id()))))));
create policy "Managers manage allocations (update)" on public.commission_allocation for update using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_allocation.calculation_id) AND (d.agency_id = get_current_agency_id())))))) with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_allocation.calculation_id) AND (d.agency_id = get_current_agency_id()))))));
create policy "Managers manage allocations (delete)" on public.commission_allocation for delete using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_allocation.calculation_id) AND (d.agency_id = get_current_agency_id()))))));
drop policy "Managers manage allocations" on public.commission_allocation;

-- commission_calculation: "Managers manage commission calculations"
create policy "Managers manage commission calculations (insert)" on public.commission_calculation for insert with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND can_access_deal(deal_id)));
create policy "Managers manage commission calculations (update)" on public.commission_calculation for update using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND can_access_deal(deal_id))) with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND can_access_deal(deal_id)));
create policy "Managers manage commission calculations (delete)" on public.commission_calculation for delete using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND can_access_deal(deal_id)));
drop policy "Managers manage commission calculations" on public.commission_calculation;

-- commission_clawback: "Managers manage clawbacks"
create policy "Managers manage clawbacks (insert)" on public.commission_clawback for insert with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_clawback.calculation_id) AND (d.agency_id = get_current_agency_id()))))));
create policy "Managers manage clawbacks (update)" on public.commission_clawback for update using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_clawback.calculation_id) AND (d.agency_id = get_current_agency_id())))))) with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_clawback.calculation_id) AND (d.agency_id = get_current_agency_id()))))));
create policy "Managers manage clawbacks (delete)" on public.commission_clawback for delete using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM (commission_calculation cc JOIN deal d ON ((d.id = cc.deal_id))) WHERE ((cc.id = commission_clawback.calculation_id) AND (d.agency_id = get_current_agency_id()))))));
drop policy "Managers manage clawbacks" on public.commission_clawback;

-- commission_rule_line: "Managers manage commission rules"
create policy "Managers manage commission rules (insert)" on public.commission_rule_line for insert with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM commission_rule_set rs WHERE ((rs.id = commission_rule_line.rule_set_id) AND (rs.agency_id = get_current_agency_id()))))));
create policy "Managers manage commission rules (update)" on public.commission_rule_line for update using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM commission_rule_set rs WHERE ((rs.id = commission_rule_line.rule_set_id) AND (rs.agency_id = get_current_agency_id())))))) with check (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM commission_rule_set rs WHERE ((rs.id = commission_rule_line.rule_set_id) AND (rs.agency_id = get_current_agency_id()))))));
create policy "Managers manage commission rules (delete)" on public.commission_rule_line for delete using (((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM commission_rule_set rs WHERE ((rs.id = commission_rule_line.rule_set_id) AND (rs.agency_id = get_current_agency_id()))))));
drop policy "Managers manage commission rules" on public.commission_rule_line;

-- commission_rule_set: "Managers manage commission rule sets"
create policy "Managers manage commission rule sets (insert)" on public.commission_rule_set for insert with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Managers manage commission rule sets (update)" on public.commission_rule_set for update using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))) with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Managers manage commission rule sets (delete)" on public.commission_rule_set for delete using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
drop policy "Managers manage commission rule sets" on public.commission_rule_set;

-- compliance_review_queue: "Compliance review manageable by admins"
create policy "Compliance review manageable by admins (insert)" on public.compliance_review_queue for insert with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Compliance review manageable by admins (update)" on public.compliance_review_queue for update using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))) with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Compliance review manageable by admins (delete)" on public.compliance_review_queue for delete using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
drop policy "Compliance review manageable by admins" on public.compliance_review_queue;

-- config_transfer_duty: "Managers manage transfer duty configuration"
create policy "Managers manage transfer duty configuration (insert)" on public.config_transfer_duty for insert with check ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])));
create policy "Managers manage transfer duty configuration (update)" on public.config_transfer_duty for update using ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))) with check ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])));
create policy "Managers manage transfer duty configuration (delete)" on public.config_transfer_duty for delete using ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])));
drop policy "Managers manage transfer duty configuration" on public.config_transfer_duty;

-- conveyancing_stage_tracker: "Conveyancing stage manageable by agency users"
create policy "Conveyancing stage manageable by agency users (insert)" on public.conveyancing_stage_tracker for insert with check ((agency_id = get_current_agency_id()));
create policy "Conveyancing stage manageable by agency users (update)" on public.conveyancing_stage_tracker for update using ((agency_id = get_current_agency_id())) with check ((agency_id = get_current_agency_id()));
create policy "Conveyancing stage manageable by agency users (delete)" on public.conveyancing_stage_tracker for delete using ((agency_id = get_current_agency_id()));
drop policy "Conveyancing stage manageable by agency users" on public.conveyancing_stage_tracker;

-- deal_contingency_tracker: "Contingency tracker manageable by agency users"
create policy "Contingency tracker manageable by agency users (insert)" on public.deal_contingency_tracker for insert with check ((agency_id = get_current_agency_id()));
create policy "Contingency tracker manageable by agency users (update)" on public.deal_contingency_tracker for update using ((agency_id = get_current_agency_id())) with check ((agency_id = get_current_agency_id()));
create policy "Contingency tracker manageable by agency users (delete)" on public.deal_contingency_tracker for delete using ((agency_id = get_current_agency_id()));
drop policy "Contingency tracker manageable by agency users" on public.deal_contingency_tracker;

-- deposit_ledger: "Lease managers can manage ledger"
create policy "Lease managers can manage ledger (insert)" on public.deposit_ledger for insert with check (can_edit_lease(lease_id));
create policy "Lease managers can manage ledger (update)" on public.deposit_ledger for update using (can_edit_lease(lease_id)) with check (can_edit_lease(lease_id));
create policy "Lease managers can manage ledger (delete)" on public.deposit_ledger for delete using (can_edit_lease(lease_id));
drop policy "Lease managers can manage ledger" on public.deposit_ledger;

-- email_template: "Admins manage email templates"
create policy "Admins manage email templates (insert)" on public.email_template for insert with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Admins manage email templates (update)" on public.email_template for update using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))) with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Admins manage email templates (delete)" on public.email_template for delete using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
drop policy "Admins manage email templates" on public.email_template;

-- esign_envelope: "Envelopes manageable by agency users"
create policy "Envelopes manageable by agency users (insert)" on public.esign_envelope for insert with check ((agency_id = get_current_agency_id()));
create policy "Envelopes manageable by agency users (update)" on public.esign_envelope for update using ((agency_id = get_current_agency_id())) with check ((agency_id = get_current_agency_id()));
create policy "Envelopes manageable by agency users (delete)" on public.esign_envelope for delete using ((agency_id = get_current_agency_id()));
drop policy "Envelopes manageable by agency users" on public.esign_envelope;

-- ffc_certificate: "Users manage own or managers manage agency FFCs"
create policy "Users manage own or managers manage agency FFCs (insert)" on public.ffc_certificate for insert with check (((user_account_id = get_current_user_account_id()) OR ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM user_account u WHERE ((u.id = ffc_certificate.user_account_id) AND (u.agency_id = get_current_agency_id())))))));
create policy "Users manage own or managers manage agency FFCs (update)" on public.ffc_certificate for update using (((user_account_id = get_current_user_account_id()) OR ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM user_account u WHERE ((u.id = ffc_certificate.user_account_id) AND (u.agency_id = get_current_agency_id()))))))) with check (((user_account_id = get_current_user_account_id()) OR ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM user_account u WHERE ((u.id = ffc_certificate.user_account_id) AND (u.agency_id = get_current_agency_id())))))));
create policy "Users manage own or managers manage agency FFCs (delete)" on public.ffc_certificate for delete using (((user_account_id = get_current_user_account_id()) OR ((get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])) AND (EXISTS ( SELECT 1 FROM user_account u WHERE ((u.id = ffc_certificate.user_account_id) AND (u.agency_id = get_current_agency_id())))))));
drop policy "Users manage own or managers manage agency FFCs" on public.ffc_certificate;

-- inspection: "Lease managers can manage inspections"
create policy "Lease managers can manage inspections (insert)" on public.inspection for insert with check (can_edit_lease(lease_id));
create policy "Lease managers can manage inspections (update)" on public.inspection for update using (can_edit_lease(lease_id)) with check (can_edit_lease(lease_id));
create policy "Lease managers can manage inspections (delete)" on public.inspection for delete using (can_edit_lease(lease_id));
drop policy "Lease managers can manage inspections" on public.inspection;

-- landlord_statement: "Lease managers can manage statements"
create policy "Lease managers can manage statements (insert)" on public.landlord_statement for insert with check (can_edit_lease(lease_id));
create policy "Lease managers can manage statements (update)" on public.landlord_statement for update using (can_edit_lease(lease_id)) with check (can_edit_lease(lease_id));
create policy "Lease managers can manage statements (delete)" on public.landlord_statement for delete using (can_edit_lease(lease_id));
drop policy "Lease managers can manage statements" on public.landlord_statement;

-- lead_capture: "Leads manageable by agency users"
create policy "Leads manageable by agency users (insert)" on public.lead_capture for insert with check ((agency_id = get_current_agency_id()));
create policy "Leads manageable by agency users (update)" on public.lead_capture for update using ((agency_id = get_current_agency_id())) with check ((agency_id = get_current_agency_id()));
create policy "Leads manageable by agency users (delete)" on public.lead_capture for delete using ((agency_id = get_current_agency_id()));
drop policy "Leads manageable by agency users" on public.lead_capture;

-- lease_escalation_schedule: "Escalation schedule manageable by lease managers"
create policy "Escalation schedule manageable by lease managers (insert)" on public.lease_escalation_schedule for insert with check ((EXISTS ( SELECT 1 FROM lease l WHERE ((l.id = lease_escalation_schedule.lease_id) AND (l.agency_id = get_current_agency_id()) AND ((l.managed_by = get_current_user_account_id()) OR (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))))));
create policy "Escalation schedule manageable by lease managers (update)" on public.lease_escalation_schedule for update using ((EXISTS ( SELECT 1 FROM lease l WHERE ((l.id = lease_escalation_schedule.lease_id) AND (l.agency_id = get_current_agency_id()) AND ((l.managed_by = get_current_user_account_id()) OR (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))))))) with check ((EXISTS ( SELECT 1 FROM lease l WHERE ((l.id = lease_escalation_schedule.lease_id) AND (l.agency_id = get_current_agency_id()) AND ((l.managed_by = get_current_user_account_id()) OR (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))))));
create policy "Escalation schedule manageable by lease managers (delete)" on public.lease_escalation_schedule for delete using ((EXISTS ( SELECT 1 FROM lease l WHERE ((l.id = lease_escalation_schedule.lease_id) AND (l.agency_id = get_current_agency_id()) AND ((l.managed_by = get_current_user_account_id()) OR (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))))));
drop policy "Escalation schedule manageable by lease managers" on public.lease_escalation_schedule;

-- lease_invoice: "Lease managers can manage invoices"
create policy "Lease managers can manage invoices (insert)" on public.lease_invoice for insert with check (can_edit_lease(lease_id));
create policy "Lease managers can manage invoices (update)" on public.lease_invoice for update using (can_edit_lease(lease_id)) with check (can_edit_lease(lease_id));
create policy "Lease managers can manage invoices (delete)" on public.lease_invoice for delete using (can_edit_lease(lease_id));
drop policy "Lease managers can manage invoices" on public.lease_invoice;

-- maintenance_job: "Lease managers can manage maintenance"
create policy "Lease managers can manage maintenance (insert)" on public.maintenance_job for insert with check (can_edit_lease(lease_id));
create policy "Lease managers can manage maintenance (update)" on public.maintenance_job for update using (can_edit_lease(lease_id)) with check (can_edit_lease(lease_id));
create policy "Lease managers can manage maintenance (delete)" on public.maintenance_job for delete using (can_edit_lease(lease_id));
drop policy "Lease managers can manage maintenance" on public.maintenance_job;

-- maintenance_ticket: "Maintenance tickets manageable by agency users"
create policy "Maintenance tickets manageable by agency users (insert)" on public.maintenance_ticket for insert with check ((agency_id = get_current_agency_id()));
create policy "Maintenance tickets manageable by agency users (update)" on public.maintenance_ticket for update using ((agency_id = get_current_agency_id())) with check ((agency_id = get_current_agency_id()));
create policy "Maintenance tickets manageable by agency users (delete)" on public.maintenance_ticket for delete using ((agency_id = get_current_agency_id()));
drop policy "Maintenance tickets manageable by agency users" on public.maintenance_ticket;

-- pdf_template: "Admins manage pdf templates"
create policy "Admins manage pdf templates (insert)" on public.pdf_template for insert with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Admins manage pdf templates (update)" on public.pdf_template for update using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role])))) with check (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
create policy "Admins manage pdf templates (delete)" on public.pdf_template for delete using (((agency_id = get_current_agency_id()) AND (get_current_role() = ANY (ARRAY['admin'::user_role, 'admin_agent'::user_role]))));
drop policy "Admins manage pdf templates" on public.pdf_template;
