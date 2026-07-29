# Mandate — Estate Agency Operations Platform
## Product & Technical Specification, Version 1.0

---

### Document control

| Field | Value |
|---|---|
| Document title | Mandate — Product & Technical Specification |
| Version | 1.0 (Draft) |
| Status | For internal review |
| Owner | Sam Muchenje, Chief ICT Architect |
| Organisation | FOCI Group (Pty) Ltd |
| Date | 29 July 2026 |
| Classification | Confidential — Internal |

**Revision history**

| Version | Date | Author | Summary |
|---|---|---|---|
| 1.0 | 2026-07-29 | S. Muchenje | Initial specification. MVP scope, lean-cost architecture, data model, commission rules. |

---

## 1. Executive summary

Mandate is a multi-tenant SaaS platform for South African estate agencies. It manages the full lifecycle of a property transaction from mandate to registration, tracks residential rental portfolios, and calculates agent commission with full auditability.

The platform addresses three distinct administrative failures common to independent agencies and franchise offices:

1. **No visibility of deal progression.** Between signature of the Offer to Purchase and registration in the Deeds Office, a transaction passes through roughly a dozen dependent steps controlled by third parties. Agencies track this on WhatsApp and spreadsheets, which means suspensive condition deadlines lapse unnoticed and principals cannot forecast income.
2. **Rental administration is fragmented.** Leases, escalations, deposits, inspections, arrears and landlord payouts are managed across disconnected tools.
3. **Commission is calculated manually.** Splits across multiple practitioners, franchise fees, referral fees and VAT are computed by hand each month, producing disputes and rework.

The commercial thesis is that existing vendors own listings and CRM (Base/Entegral, Prop Data) or rental payments (PayProp, WeconnectU), but no incumbent owns **deal progression plus commission**. Agencies buy a CRM and still run a spreadsheet for exactly that gap. Mandate enters through the gap.

**Design constraint governing this version:** the platform must operate without per-transaction third-party costs. No AI inference APIs, no metered messaging, no paid data subscriptions, no payment gateway. All such capability is either replaced by structured manual capture or deferred behind an adapter interface to be implemented when a paying client funds it. Target operating cost before revenue is under R1,000 per month.

---

## 2. Scope

### 2.1 In scope — Release 1 (MVP)

| # | Module | Summary |
|---|---|---|
| M1 | Deal pipeline | Sales transactions modelled as a stage machine reflecting SA conveyancing practice |
| M2 | Suspensive condition engine | Deadline tracking with automated escalating alerts |
| M3 | Commission engine | Configurable rule-based calculation, splits, statements, reconciliation |
| M4 | Compliance register | Fidelity Fund Certificates, FICA records, mandate documents, audit trail |
| M5 | Document store & generation | Template merge to DOCX/PDF, versioned storage per deal |
| M6 | Public calculators | Bond repayment, transfer duty, affordability — embeddable, lead capture |
| M7 | Platform services | Tenancy, authentication, RBAC, notifications, reporting, import/export |

### 2.2 In scope — Release 2

Rentals management: lease register, escalations, deposits, inspections, maintenance job cards, arrears, landlord statements and EFT batch payout files.

### 2.3 In scope — Release 3

CMA report builder, portal lead ingestion, conveyancer performance analytics, franchise roll-up reporting.

### 2.4 Explicitly out of scope

| Item | Rationale |
|---|---|
| Trust accounting | Regulated, audited, high liability. Integrate with the agency's accounting system instead. |
| Holding or moving client funds | No payment gateway, no PCI scope, no trust exposure. The platform produces instructions and statements only. |
| Property listing syndication | Portals are already served by incumbents. Considered post-Release 3. |
| Bond origination | Status is captured manually against the relevant condition. |
| Deeds Office or SARS system integration | No public transactional API available to agencies. |
| Native mobile applications | Responsive web only in Release 1. |

---

## 3. Users and roles

| Role | Description | Primary need |
|---|---|---|
| **Principal** | Licensed principal practitioner, owns the agency | Portfolio-wide visibility, revenue forecast, compliance assurance |
| **Agent** | Full-status practitioner | Own pipeline, own earnings forecast, low-friction capture |
| **Candidate practitioner** | Intern under supervision | Same as agent, plus supervision constraints and logbook |
| **Administrator** | Deal secretary / bookkeeper | Document control, commission reconciliation, data quality |
| **Rental portfolio manager** | Manages leases (Release 2) | Lease lifecycle, arrears, landlord reporting |
| **Landlord** (external, read-only) | Release 2 | Statements, maintenance visibility |
| **Conveyancer** (external, unauthenticated) | Attorney firm | Provide a status update in one click without an account |

### 3.1 Permission matrix (Release 1)

| Capability | Principal | Agent | Candidate | Admin |
|---|---|---|---|---|
| View all deals in agency | Yes | No — own only | No — own only | Yes |
| Create / edit deal | Yes | Own | Own, supervised | Yes |
| Advance deal stage | Yes | Own | Own | Yes |
| View agency-wide commission | Yes | No | No | Yes |
| View own commission | Yes | Yes | Yes | Yes |
| Configure commission rules | Yes | No | No | No |
| Approve commission run | Yes | No | No | No |
| Manage users and FFCs | Yes | No | No | Yes |
| Delete records | No — archive only | No | No | No |

**Rule:** no hard delete anywhere in the system. All destructive actions are soft-delete with retention, to preserve the audit trail.

---

## 4. Domain glossary

| Term | Definition |
|---|---|
| **Mandate** | The agency's written authority to market a property. Sole, joint or open. |
| **OTP** | Offer to Purchase. The written agreement of sale. |
| **Suspensive condition** | A condition that must be fulfilled by a stated date for the sale to become binding; failure causes the agreement to lapse. |
| **Bond approval** | Formal grant of finance to the purchaser. The most common suspensive condition. |
| **Conveyancer** | The attorney appointed to effect transfer of ownership. |
| **Transfer duty** | Tax payable to SARS on acquisition of property, unless the sale is subject to VAT. |
| **Rates clearance certificate** | Municipal certificate confirming outstanding amounts are settled. Required for lodgement. |
| **Levy clearance certificate** | Equivalent for sectional title and HOA properties. |
| **Compliance certificates** | Electrical, gas, beetle, plumbing and electric fence certificates as applicable. |
| **Lodgement** | Submission of the transfer documents to the Deeds Office. |
| **Registration** | Deeds Office registration of transfer. The trigger event for commission. |
| **Occupational rent / interest** | Amount payable where occupation is taken before or given after registration. |
| **FFC** | Fidelity Fund Certificate, issued by the PPRA. A practitioner may not earn remuneration without a valid one. |
| **PPRA** | Property Practitioners Regulatory Authority. |
| **Procurement fee** | Once-off rental commission for placing a tenant, conventionally one month's rent. |
| **Management fee** | Recurring rental commission, a percentage of monthly rent collected. |

---

## 5. Module M1 — Deal pipeline

### 5.1 Stage model

The pipeline is a **directed stage machine**, not a free-form board. Stages are ordered; a deal may be advanced, reverted with a reason, or terminated. Gate conditions may block advancement.

| # | Stage | Owner | Gate condition to leave stage |
|---|---|---|---|
| 1 | Mandate signed | Agent | Signed mandate document uploaded; mandate expiry recorded |
| 2 | Listed / marketing | Agent | — |
| 3 | Offer received | Agent | Offer record captured with price and expiry |
| 4 | OTP signed | Agent | Purchase price, parties, all suspensive conditions and dates captured |
| 5 | Suspensive conditions pending | Agent | All conditions marked Fulfilled or Waived |
| 6 | Conveyancer instructed | Admin | Attorney firm and reference recorded |
| 7 | Compliance certificates | Seller / Agent | All applicable certificates uploaded |
| 8 | Transfer duty / VAT | Conveyancer | SARS receipt recorded |
| 9 | Rates & levy clearance | Conveyancer | Clearance figures recorded |
| 10 | Documents signed & guarantees | Conveyancer | Confirmation recorded |
| 11 | Lodged | Conveyancer | Lodgement date recorded |
| 12 | **Registered** | Conveyancer | Registration date recorded — triggers commission |
| 13 | Commission released | Admin | Payment received from trust |
| — | **Cancelled / Lapsed** | Any | Terminal. Reason mandatory. Triggers clawback where applicable. |

### 5.2 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-M1-01 | System shall record a deal with property, parties, participating practitioners, price and dates | Must |
| FR-M1-02 | System shall enforce stage order and prevent advancement where a gate condition is unmet, with an explicit override recorded against the user | Must |
| FR-M1-03 | System shall record entry and exit timestamps per stage and compute days-in-stage | Must |
| FR-M1-04 | System shall present a board view grouped by stage, filterable by agent, branch, value and status | Must |
| FR-M1-05 | System shall support multiple participating practitioners per deal, including practitioners from a co-mandating agency | Must |
| FR-M1-06 | System shall support multiple competing offers against one listing, with side-by-side comparison and a seller presentation view | Should |
| FR-M1-07 | System shall record cancellation with a categorised reason for fall-through analytics | Must |
| FR-M1-08 | System shall generate a per-deal document checklist derived from property type and transaction attributes | Must |
| FR-M1-09 | System shall provide an unauthenticated single-field status update page reachable by signed magic link, for conveyancer use | Must |
| FR-M1-10 | System shall calculate occupational interest on a daily accrual basis between occupation date and registration date | Should |
| FR-M1-11 | System shall track mandate expiry and alert on approaching lapse | Should |
| FR-M1-12 | System shall compute days on market from listing date | Should |

### 5.3 Conveyancer update mechanism

Attorneys will not adopt a new system. The mechanism must therefore require no account and no application.

1. The system emails the attorney a status request containing a signed, expiring URL scoped to a single deal.
2. The page presents the current stage, the next expected stage, and one date field.
3. Submission writes a stage transition attributed to the attorney's email address and closes the loop.
4. Where email is unproductive, the agent sends the same link via their own WhatsApp using a `wa.me` deep link generated by the system. The message originates from the agent's personal number, which materially improves response rates and costs nothing.

---

## 6. Module M2 — Suspensive condition engine

The highest-value component of the MVP. A lapsed bond approval deadline is the single most common cause of collapsed transactions.

### 6.1 Condition types

Bond approval; sale of purchaser's existing property; FICA clearance; due diligence or inspection; body corporate consent; subdivision or rezoning approval; other (free text).

### 6.2 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-M2-01 | Each condition shall carry a type, description, due date, responsible party and status (Pending, Fulfilled, Waived, Failed, Extended) | Must |
| FR-M2-02 | System shall support extension of a due date with the prior value retained in history and a reason captured | Must |
| FR-M2-03 | A scheduled job shall evaluate all pending conditions daily and issue notifications at 14, 7, 3 and 1 days before due date, and daily after lapse | Must |
| FR-M2-04 | Notification recipients shall be the responsible practitioner, the principal and the administrator, configurable per agency | Must |
| FR-M2-05 | A deal with any condition within 3 days of due, or lapsed, shall be flagged Red on all board and dashboard views | Must |
| FR-M2-06 | Failure of any condition shall prompt cancellation of the deal or recording of a waiver, and shall not silently pass | Must |
| FR-M2-07 | Bond application status shall be recorded as a manual enumeration: Not applied, Submitted, Declined, Approved in principle, Formally granted | Must |
| FR-M2-08 | System shall provide a countdown board listing every open condition across the agency ordered by urgency | Must |

The countdown board is the primary sales demonstration artefact. A principal viewing four deals turning red across their office is a stronger proof of value than any automated data capture, and it carries no running cost.

---

## 7. Module M3 — Commission engine

### 7.1 Calculation order of operations

Commission is computed as a deterministic sequence. Each step is persisted so that any figure on a statement can be traced to its inputs.

```
STEP 1  Determine gross commission
        Sale:    gross = sale_price × commission_rate      (or fixed amount)
        Rental:  procurement = monthly_rent × procurement_multiplier
                 management  = monthly_rent × management_rate   (recurring)

STEP 2  Resolve VAT
        If agency is a VAT vendor:
            if rate is VAT-inclusive:  net = gross ÷ (1 + vat_rate)
                                       vat = gross − net
            if rate is VAT-exclusive:  net = gross
                                       vat = gross × vat_rate
        Else: net = gross, vat = 0
        All subsequent steps operate on the VAT-exclusive net.

STEP 3  Apply off-the-top deductions, in configured order
        − Franchise / royalty fee        (% of net)
        − Referral fee                   (% or fixed, to a named payee)
        − Marketing recovery             (fixed)
        − Co-mandate share to external agency (% of net)
        = distributable_pool

STEP 4  Apply principal / office share
        office_share = distributable_pool × office_rate
        agent_pool   = distributable_pool − office_share

STEP 5  Split agent_pool across participating practitioners
        By percentage (must total 100%) or fixed amounts (must total agent_pool)

STEP 6  Apply per-practitioner adjustments
        − Desk fee
        − Advance recovery (outstanding advances against this deal)
        + Tier uplift where YTD threshold reached
        = practitioner_net

STEP 7  Validate
        BLOCK if any participating practitioner has no valid FFC at registration date
        BLOCK if splits do not reconcile to the pool
        WARN  if practitioner_net is negative
```

### 7.2 Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-M3-01 | Commission rules shall be configurable per agency, with per-deal override permitted by the principal only | Must |
| FR-M3-02 | System shall support tiered split rates keyed to a practitioner's year-to-date registered commission | Should |
| FR-M3-03 | System shall support co-mandate arrangements where an external agency takes a share | Must |
| FR-M3-04 | System shall block commission calculation where any participating practitioner lacks a valid, unexpired FFC on the registration date | Must |
| FR-M3-05 | System shall produce a commission statement per practitioner per deal as PDF | Must |
| FR-M3-06 | System shall produce a monthly reconciliation grouping all registered deals for payroll handoff, exportable as CSV | Must |
| FR-M3-07 | System shall track advances paid against pending registrations and net them automatically at payout | Should |
| FR-M3-08 | Cancellation of a deal after provisional recognition shall generate a clawback entry against the affected practitioners | Must |
| FR-M3-09 | All monetary amounts shall be stored as integer cents in ZAR. No floating point arithmetic anywhere in the calculation path | Must |
| FR-M3-10 | Rounding shall be applied once, at the final per-practitioner amount, half-up. Residual cents from rounding shall be allocated to the office share | Must |
| FR-M3-11 | Every calculation shall persist a full input snapshot so historical statements remain reproducible after rule changes | Must |

### 7.3 Worked example

Sale price R2,500,000. Agency is a VAT vendor. Commission 5% VAT-inclusive. Franchise fee 6%. Office share 50%. Two agents splitting 60/40. Agent B has a R15,000 advance outstanding.

| Step | Calculation | Amount (R) |
|---|---|---|
| Gross commission | 2,500,000 × 5% | 125,000.00 |
| Less VAT (15%) | 125,000 ÷ 1.15 | 108,695.65 net |
| VAT portion | | 16,304.35 |
| Less franchise fee | 108,695.65 × 6% | (6,521.74) |
| Distributable pool | | 102,173.91 |
| Office share | × 50% | 51,086.96 |
| Agent pool | | 51,086.95 |
| Agent A | × 60% | 30,652.17 |
| Agent B | × 40% | 20,434.78 |
| Agent B advance recovery | | (15,000.00) |
| **Agent B payable** | | **5,434.78** |

Note the residual cent in the pool split, allocated to office share per FR-M3-10.

---

## 8. Module M4 — Compliance register

South African estate agencies are accountable institutions under FICA and regulated practitioners under the Property Practitioners Act. Compliance is both a genuine liability and a strong selling point.

| ID | Requirement | Priority |
|---|---|---|
| FR-M4-01 | System shall maintain an FFC register per practitioner with issue date, expiry date and certificate document | Must |
| FR-M4-02 | System shall alert the principal at 60, 30 and 7 days before FFC expiry, and daily after expiry | Must |
| FR-M4-03 | System shall record FICA / customer due diligence records against buyers, sellers, tenants and landlords, with a document checklist and completion state | Must |
| FR-M4-04 | System shall record POPIA consent capture per data subject, with purpose and timestamp | Must |
| FR-M4-05 | System shall maintain an immutable audit log of all create, update, stage transition and calculation events, recording user, timestamp, before and after values | Must |
| FR-M4-06 | System shall retain transaction records for a minimum of five years and prevent deletion within that period | Must |
| FR-M4-07 | System shall maintain a candidate practitioner logbook with supervised activity entries and supervisor sign-off | Should |
| FR-M4-08 | System shall track CPD points per practitioner per cycle | Could |

---

## 9. Module M5 — Documents

| ID | Requirement | Priority |
|---|---|---|
| FR-M5-01 | System shall store documents against a deal, property, party or practitioner, with version history | Must |
| FR-M5-02 | System shall generate documents from agency-owned templates using merge fields from the deal record, output DOCX and PDF | Must |
| FR-M5-03 | Templates shall be uploadable and editable by the agency without developer involvement | Should |
| FR-M5-04 | System shall provide an in-house electronic signing page for documents permitted to be signed electronically, capturing a drawn or typed signature, email one-time-pin verification, IP address, user agent, timestamp and a SHA-256 hash of the signed artefact | Should |
| FR-M5-05 | System shall present a warning on any document category excluded from electronic signature under the Electronic Communications and Transactions Act, and require wet-ink upload instead | Must |

**Legal note.** Agreements for the alienation of immovable property fall within the exclusions in Schedule 1 of the ECT Act, so an Offer to Purchase requires a handwritten signature. Leases and mandates may generally be signed electronically. This distinction is encoded in the template configuration and must be confirmed with the agency's conveyancer before release.

### 9.1 Document generation approach

DOCX templates are unpacked, merge fields substituted in `document.xml`, and repacked — the same automation pattern already in use internally at FOCI. PDF output is produced by headless rendering locally rather than by a conversion service. Where a template originates from Microsoft 365 with Aptos fonts, PDF conversion via LibreOffice is unreliable and the DOCX should be treated as the primary artefact.

All generated tables use the **All Borders** setting only. No individual border options are applied.

---

## 10. Module M6 — Public calculators

Embeddable, unauthenticated, branded per agency. Static formulas only, no data feeds, no running cost. Functions as the top-of-funnel lead capture.

| Calculator | Inputs | Output |
|---|---|---|
| Bond repayment | Loan amount, interest rate, term | Monthly instalment, total interest |
| Transfer cost | Purchase price, bond amount | Transfer duty, conveyancing fees estimate, deeds office fees, total |
| Affordability | Gross income, expenses, interest rate, term | Maximum loan and purchase price |
| Rental yield | Purchase price, monthly rent, costs | Gross and net yield |

Each calculator offers to email the result, capturing name, email and telephone into the agency's lead table.

**Transfer duty rates.** Rates are held as configuration data, versioned by effective date, and must be reviewed against the current SARS table at each Budget. The bracket structure is:

| Value of property | Duty |
|---|---|
| Up to threshold 1 | Nil |
| Threshold 1 to 2 | Rate A of value above threshold 1 |
| Threshold 2 to 3 | Fixed amount + rate B of value above threshold 2 |
| Threshold 3 to 4 | Fixed amount + rate C of value above threshold 3 |
| Threshold 4 to 5 | Fixed amount + rate D of value above threshold 4 |
| Above threshold 5 | Fixed amount + rate E of value above threshold 5 |

Seed the table from the SARS transfer duty schedule current at build time and verify before each release. Where the seller is a VAT vendor and the sale is subject to VAT, no transfer duty is payable — the calculator must expose this as a toggle.

---

## 11. Data model

Amounts are `bigint` cents. Identifiers are UUID. All tenant-scoped tables carry `agency_id` and are protected by row-level security.

### 11.1 Core entities

**agency**
`id, name, registration_number, ppra_reference, vat_number, is_vat_vendor, address, logo_key, created_at, archived_at`

**branch**
`id, agency_id, name, address`

**user_account**
`id, agency_id, branch_id, full_name, email, mobile, role, status, ppra_reference, is_candidate, supervisor_id, created_at, archived_at`

**ffc_certificate**
`id, user_account_id, certificate_number, issued_on, expires_on, document_id, created_at`

**property**
`id, agency_id, address_line, suburb, city, province, postal_code, erf_number, title_deed_number, property_type, is_sectional_title, bedrooms, bathrooms, garages, erf_size_sqm, floor_size_sqm, created_at`

**party**
`id, agency_id, party_type, entity_type, full_name, id_or_reg_number, email, mobile, marital_status, is_vat_vendor, fica_status, fica_completed_on, popia_consent_at`
*party_type: seller, purchaser, landlord, tenant, referrer.*
*entity_type: natural_person, company, close_corporation, trust, deceased_estate.*

**mandate**
`id, agency_id, property_id, mandate_type, listing_price_cents, commission_rate_bps, signed_on, expires_on, document_id, status`

**deal**
`id, agency_id, branch_id, property_id, mandate_id, deal_type, reference, stage, status, sale_price_cents, otp_signed_on, occupation_date, transfer_date, registration_date, conveyancer_firm_id, conveyancer_reference, is_vat_sale, cancellation_reason, cancelled_on, created_by, created_at`
*deal_type: sale, rental.*
*status: active, registered, cancelled, lapsed.*

**deal_participant**
`id, deal_id, user_account_id, external_agency_name, role, split_type, split_value, is_external`

**deal_stage_history**
`id, deal_id, from_stage, to_stage, changed_by, changed_by_external_email, reason, occurred_at`

**suspensive_condition**
`id, deal_id, condition_type, description, due_on, original_due_on, responsible_party, status, fulfilled_on, extension_reason, created_at`

**bond_application**
`id, deal_id, institution, originator, applied_on, status, approved_amount_cents, status_updated_on`

**offer**
`id, deal_id, property_id, purchaser_party_id, offer_price_cents, deposit_cents, bond_amount_cents, expires_on, status, notes`

**checklist_item**
`id, deal_id, category, label, is_required, is_complete, document_id, completed_on, completed_by`

**document**
`id, agency_id, deal_id, party_id, user_account_id, category, filename, storage_key, mime_type, size_bytes, version, supersedes_id, uploaded_by, uploaded_at`

**signature_record**
`id, document_id, signer_party_id, signer_email, signature_image_key, otp_verified_at, ip_address, user_agent, document_hash, signed_at`

### 11.2 Commission entities

**commission_rule_set**
`id, agency_id, name, effective_from, effective_to, is_default, vat_treatment, default_commission_rate_bps, franchise_fee_bps, office_share_bps, rounding_mode, created_by`

**commission_rule_line**
`id, rule_set_id, sequence, line_type, calculation_basis, rate_bps, fixed_amount_cents, payee_type, description`
*line_type: franchise_fee, referral_fee, marketing_recovery, comandate_share, office_share, desk_fee.*

**commission_calculation**
`id, deal_id, rule_set_id, calculated_at, calculated_by, gross_cents, vat_cents, net_cents, distributable_pool_cents, office_share_cents, agent_pool_cents, input_snapshot_json, status`
*status: provisional, confirmed, reversed.*

**commission_allocation**
`id, calculation_id, user_account_id, external_payee_name, allocation_type, gross_allocation_cents, desk_fee_cents, advance_recovery_cents, net_payable_cents`

**commission_advance**
`id, agency_id, user_account_id, deal_id, amount_cents, advanced_on, recovered_cents, status`

**commission_clawback**
`id, calculation_id, user_account_id, amount_cents, reason, raised_on, recovered_on`

### 11.3 Supporting entities

**conveyancer_firm** — `id, agency_id, name, contact_name, email, telephone, is_preferred`
**status_request_token** — `id, deal_id, recipient_email, token_hash, expires_at, used_at`
**notification** — `id, agency_id, user_account_id, channel, subject, body, related_entity_type, related_entity_id, scheduled_for, sent_at, read_at`
**lead** — `id, agency_id, source, full_name, email, mobile, message, calculator_payload_json, assigned_to, status, created_at`
**audit_log** — `id, agency_id, actor_id, entity_type, entity_id, action, before_json, after_json, ip_address, occurred_at`
**config_transfer_duty** — `id, effective_from, brackets_json`

### 11.4 Rental entities (Release 2, defined for forward compatibility)

**lease** — `id, agency_id, property_id, landlord_party_id, tenant_party_id, start_on, end_on, monthly_rent_cents, escalation_rate_bps, escalation_month, deposit_cents, deposit_held_by, procurement_fee_cents, management_fee_bps, status`
**lease_invoice** — `id, lease_id, period_start, period_end, rent_cents, other_charges_cents, total_cents, due_on, paid_cents, paid_on, status`
**deposit_ledger** — `id, lease_id, entry_type, amount_cents, interest_cents, occurred_at, notes`
**inspection** — `id, lease_id, inspection_type, conducted_on, conducted_by, findings_json, tenant_signature_id`
**maintenance_job** — `id, lease_id, reported_on, description, priority, contractor_name, quoted_cents, approved_by, approved_on, completed_on, status`
**landlord_statement** — `id, lease_id, period_start, period_end, rent_collected_cents, management_fee_cents, deductions_cents, net_payout_cents, document_id, generated_on`

---

## 12. Architecture

### 12.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Database | PostgreSQL 16 with row-level security | Multi-tenancy enforced at the data layer, not the application layer |
| Backend | Node.js / TypeScript, REST | Consistent with existing FOCI platform work |
| Frontend | React + Vite + TypeScript | As per existing internal standard |
| Object storage | Cloudflare R2 | No egress charges; effectively free at this volume |
| Email | SMTP or a free-tier transactional provider | Thousands of sends at no cost |
| Scheduling | System cron invoking a signed internal endpoint | No managed scheduler dependency |
| PDF rendering | Headless Chromium or WeasyPrint, locally | No conversion API |
| Hosting | Single VPS, containerised, with an in-country option available for data residency | R300–R600 per month |
| Authentication | First-party sessions, argon2id password hashing, TOTP second factor for principals | No identity provider subscription |

Target infrastructure cost before revenue: **under R1,000 per month**, predominantly hosting and domain.

### 12.2 Multi-tenancy

Single database, shared schema, `agency_id` discriminator on every tenant-scoped table, enforced by row-level security policies keyed to a session variable set at connection time from the authenticated claim. No query in application code is trusted to filter by tenant on its own.

### 12.3 Adapter interfaces

Every capability deferred on cost grounds is defined as an interface with a manual implementation in Release 1. When a client funds an integration, only a new implementation is written; no calling code changes.

| Interface | Release 1 implementation | Future implementation |
|---|---|---|
| `BondStatusProvider` | Manual status enumeration on the deal | Originator feed |
| `TenantScreeningProvider` | Result pasted and stored against the party | TPN API |
| `ComparablesProvider` | Comparables captured manually by the agent | Lightstone / Windeed, on the client's own subscription |
| `MessagingProvider` | Email plus generated `wa.me` deep links | WhatsApp Business API |
| `SignatureProvider` | In-house signing page | Third-party e-signature |
| `PaymentProvider` | EFT batch file export and bank statement CSV import with reference matching | Payment gateway |
| `DocumentExtractionProvider` | Structured fast-capture form with computed default dates | Local `pdftotext` plus template regex; inference API only if ever justified |
| `LeadIngestionProvider` | Catch-all mailbox with parsers for the two portal email formats | Portal APIs |

### 12.4 Scheduled jobs

| Job | Frequency | Function |
|---|---|---|
| Condition sweep | Daily 05:00 SAST | Evaluate due dates, raise notifications, set deal flags |
| FFC expiry sweep | Daily 05:05 | Alert on approaching and lapsed certificates |
| Mandate expiry sweep | Daily 05:10 | Alert on approaching mandate lapse |
| Stale deal sweep | Weekly | Flag deals exceeding configured days-in-stage thresholds |
| Occupational interest accrual | Daily | Accrue where occupation precedes registration |
| Notification dispatch | Every 15 minutes | Send queued notifications |
| Backup | Daily, retained 30 days | Encrypted off-site database dump |

---

## 13. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Page load under 2 seconds on a 3G connection for the agent pipeline view |
| NFR-02 | Support 50 concurrent users per agency and 200 agencies on the Release 1 infrastructure |
| NFR-03 | 99.5% monthly availability target, excluding announced maintenance |
| NFR-04 | Daily encrypted backups, 30-day retention, restore tested quarterly |
| NFR-05 | All traffic over TLS 1.3; HSTS enforced |
| NFR-06 | Passwords hashed with argon2id; TOTP second factor mandatory for principal and administrator roles |
| NFR-07 | Personal information encrypted at rest; document storage server-side encrypted |
| NFR-08 | Full audit log retained for the greater of five years or the applicable statutory period |
| NFR-09 | Responsive interface usable on a mobile browser; the agent pipeline and condition board must be fully functional at 380px width |
| NFR-10 | Data export in open formats (CSV, JSON, PDF) available to the agency at any time without charge |
| NFR-11 | POPIA: data subject access, correction and deletion requests supported, subject to statutory retention overrides |
| NFR-12 | Information officer contact and processing register maintained per agency |

---

## 14. Migration and onboarding

Every prospect arrives with a spreadsheet and often a legacy CRM. Onboarding friction is the primary cause of lost deals in this segment.

| ID | Requirement | Priority |
|---|---|---|
| FR-ON-01 | CSV import for practitioners, properties, parties, active deals and leases, with column mapping and a dry-run validation report | Must |
| FR-ON-02 | Import shall be idempotent and reversible within 24 hours | Must |
| FR-ON-03 | A guided setup wizard shall capture agency details, commission rule set, branches, users and FFCs in under 30 minutes | Must |
| FR-ON-04 | Template commission rule sets shall be provided for common franchise structures and for independent agencies | Should |

Target: a 15-agent agency fully onboarded within one working day.

---

## 15. Commercial model

| Element | Approach |
|---|---|
| Core platform | Per-practitioner per month, plus a small office base fee |
| Rentals module | Per unit under management per month |
| CMA builder | Included from Release 3 |
| Public calculators | Free — top-of-funnel acquisition |
| Onboarding | Once-off implementation fee, waived on annual commitment |
| Contract | Monthly, no lock-in; annual paid upfront at a discount |

---

## 16. Delivery plan

| Release | Content | Indicative duration |
|---|---|---|
| **R1.0 MVP** | M1 pipeline, M2 conditions, M3 commission, M4 compliance, M5 documents, M6 calculators, platform services, import tooling | 12–16 weeks |
| **R1.1** | Multiple offers, occupational interest, conveyancer scorecard, advances and clawbacks refinement | 4 weeks |
| **R2.0 Rentals** | Lease register, escalations, deposits, invoicing, arrears, inspections, maintenance, landlord statements, EFT batch export | 10–12 weeks |
| **R3.0 Growth** | CMA builder, portal lead ingestion, analytics, franchise roll-up, candidate logbook | 8 weeks |
| **R4.0 Integrations** | Adapter implementations funded by client demand | Per contract |

**Pilot approach.** Secure one anchor agency in Gauteng before R1.0 completion. Run them free through the pilot in exchange for weekly feedback and a reference. The commission engine cannot be validated against theory alone — it must be reconciled against three months of their actual payouts before it is trusted.

---

## 17. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | Conveyancers do not provide status updates, leaving the pipeline stale | High | Zero-friction magic-link page; agent-sent WhatsApp links; automated reminder cadence; the scorecard creates peer pressure |
| 2 | Commission rules vary so widely that each client needs custom code | High | Rules engine configurable from day one; no hard-coded agency logic; validate against five real agencies before R1.0 |
| 3 | Scope creep into trust accounting | High | Explicit exclusion; integrate rather than build; restate at every scope review |
| 4 | Agent non-adoption — data goes stale, product looks broken | High | Personal earnings forecast is the hook; agents maintain data to see their own money. Capture must be under two minutes |
| 5 | POPIA breach involving identity documents and financial records | High | Encryption at rest, RLS, audit logging, least privilege, retention policy, incident response plan |
| 6 | Regulatory change (transfer duty, PPRA rules, VAT rate) | Medium | All rates and thresholds held as versioned configuration, never as code constants |
| 7 | Incumbent adds deal progression and commission to an existing CRM | Medium | Depth of SA-specific process modelling is the moat; move to an anchor client and reference quickly |
| 8 | Manual capture perceived as inferior to competitors' automation | Medium | Demonstrate the countdown board, not the capture form. Sell the outcome, not the input method |
| 9 | Single VPS failure | Medium | Daily off-site backups, tested restore, documented rebuild procedure, migration path to managed infrastructure once revenue supports it |

---

## 18. Open decisions

| # | Decision required | Options | Recommendation |
|---|---|---|---|
| 1 | Sales-first or rentals-first | Sales / Rentals | **Sales.** Higher pain, smaller build, clearer competitive gap |
| 2 | Single-tenant or multi-tenant from day one | Single / Multi | **Multi-tenant.** Retrofitting tenancy is expensive; RLS costs little now |
| 3 | FOCI product or anchor-client funded build | Product / Bespoke | **Product with an anchor pilot.** Retain IP, use the pilot for validation not for requirements capture |
| 4 | Data residency | In-country / Any region | In-country if it is a material objection in sales conversations; otherwise defer |
| 5 | Working product name | Mandate / Deedflow / Other | To be confirmed; check trademark and domain availability |
| 6 | Electronic signature scope | Confirm which document categories may be signed electronically | Obtain written confirmation from a conveyancer before R1.0 |

---

## Appendix A — Deal document checklist

Generated per deal according to property type and transaction attributes.

**Always required:** signed mandate; signed OTP; FICA on seller; FICA on purchaser; copy of title deed; municipal account.

**Conditional:**

| Condition | Additional documents |
|---|---|
| Sectional title | Levy clearance certificate; body corporate consent; participation quota schedule |
| Estate or HOA property | HOA clearance certificate; architectural approval where applicable |
| Bond finance | Bond grant letter; bond cancellation figures on the seller's existing bond |
| Married in community of property | Spousal consent |
| Married by foreign law | Foreign marriage certificate; legal opinion where required |
| Deceased estate seller | Letters of executorship; Master's consent |
| Trust seller | Trust deed; trustee resolution; letters of authority |
| Company or CC seller | CIPC documents; company resolution |
| Non-resident seller | Section 35A withholding tax calculation |
| VAT-registered seller | VAT registration confirmation; VAT invoice |
| All residential sales | Electrical compliance certificate; beetle certificate (coastal regions and where contractually required); gas certificate where gas is installed; electric fence certificate where installed; plumbing certificate where the municipality requires it |

---

## Appendix B — Notification schedule

| Trigger | Recipients | Timing |
|---|---|---|
| Suspensive condition due | Responsible agent, principal, admin | 14, 7, 3, 1 days before; daily after lapse |
| Condition failed | Agent, principal | Immediate |
| Stage advanced | Agent, principal | Immediate |
| Deal registered | Agent, principal, admin | Immediate |
| Deal cancelled | Agent, principal, admin | Immediate |
| FFC expiring | Practitioner, principal | 60, 30, 7 days before; daily after |
| Mandate expiring | Agent, principal | 30, 14, 7 days before |
| Deal stale in stage | Agent, principal | On threshold breach, then weekly |
| Commission statement issued | Practitioner | On approval of the monthly run |
| Conveyancer status request | Conveyancer | On instruction, then every 7 days while the deal is open |
| New lead captured | Assigned agent | Immediate |

---

## Appendix C — Cancellation reason taxonomy

Used for fall-through analytics.

Bond declined; bond not applied for in time; sale of purchaser's property failed; purchaser withdrew; seller withdrew; property defect discovered; compliance certificate failure; price renegotiation failed; purchaser death or insolvency; seller death or insolvency; deceased estate or trust complication; title or boundary defect; municipal or clearance obstruction; other (mandatory free text).

---

*End of specification.*
