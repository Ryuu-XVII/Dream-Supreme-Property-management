# Legal & Compliance Audit — 2026-08-19

**Scope:** Does the platform's actual implementation meet the legal/regulatory
requirements expected of South African real estate agency software — FICA,
POPIA, the Property Practitioners Act (PPRA/EAAB trust accounting), ECTA, and
general consumer-facing data-collection obligations. This is a code-grounded
technical audit, not a legal opinion — statute citations and adequacy
judgments below should still be confirmed by a South African attorney before
relying on them (see `LEGAL_REVIEW_PACKAGE.md`).

**Method:** cross-referenced `documentation/technical/COMPLIANCE.md` and
`SECURITY.md`'s stated requirements against the live schema, RLS policies,
and RPCs on the production Supabase project, plus the client and public-facing
routes that collect personal information.

---

## 1. FICA (AML/KYC) — Compliant

- Identity + address capture, per-party FICA status (`Pending`/`Verified`/
  `Rejected`), and deal-stage gating on FICA completeness are implemented
  (`src/lib/deal-capture.ts`, `src/routes/compliance/fica.tsx`).
- FICA approval/rejection is written to `public.audit_log` with actor and
  timestamp — status changes are traceable.
- Risk rating (Low/Medium/High), PEP/DPIP flags, and source-of-funds capture
  exist on the party record.
- No hard-delete path exists for identity records (see §2), so FICA's
  document-retention obligation is structurally satisfied.

**Residual risk:** the risk-rating criteria and required-document list were
built from an internal requirements doc, not signed off by a compliance
officer. Worth a substantive review, not just a technical one.

## 2. POPIA — Partially Compliant, 3 concrete gaps

**Implemented:**
- Consent is captured separately from contact data, with direct-marketing
  consent tracked independently (`src/lib/client-onboarding.ts`).
- A subject-access/erasure workflow exists (`/compliance/popia`,
  `popia_lookup_party` / `popia_erase_party_data`), restricted to
  `admin`/`admin_agent`, and every erasure is logged.
- Hard deletes are blocked platform-wide by a `prevent_hard_delete()` trigger
  — no app code path can destroy a record outside the audited paths.
- RLS enforces agency-level data minimization: an agent's queries are scoped
  to their own agency and, per role, their own deals.

**Gap 1 — No privacy notice on public data collection.** The public
calculators (`src/components/calculators/calculator-shell.tsx`) collect name,
email, and phone via `submit_public_lead` with no consent checkbox, no
privacy-notice text, and no link to a privacy policy anywhere in the app —
there is no `/privacy` route at all. POPIA §18 requires a data subject be told
the purpose of collection, whether it's voluntary, and who will receive the
data, at or before the point of collection (unless they're already aware from
a public source, which doesn't apply here). This is the most concrete,
immediately actionable gap in this audit.

**Gap 2 — Erasure has no retention-floor check.** `popia_erase_party_data` can
redact a party's identity fields at any time, including before the FICA
5-year retention window has elapsed, with no guard against that. Either add a
time check or get written confirmation that the audit-log snapshot is treated
as the retained record of truth.

**Gap 3 — No destruction schedule.** Since hard deletes are disabled
everywhere, nothing currently *destroys* data once its retention purpose has
lapsed — POPIA's requirement to destroy/de-identify data once no longer
needed has no automated enforcement path today. Safe by default, but an
open compliance question for aged records.

**Worth confirming, not necessarily a defect:** the Supabase project
(`eu-west-3`, Paris) and Cloudflare's storage layer process South African
data subjects' PII outside South Africa. POPIA §72 permits cross-border
transfer where the receiving jurisdiction has adequate protection (the EU's
GDPR regime is generally treated as meeting that bar) or under a data
processing agreement. This is very likely fine in substance, but it should be
an explicit, documented decision — confirm a DPA is in place with Supabase
Inc. and Cloudflare, and note the basis for transfer in a privacy policy once
one exists (see Gap 1).

## 3. Property Practitioners Act — Trust Accounting & FFC — Compliant

- Commission calculation (`calculate_deal_commission`) hard-blocks on invalid
  Fidelity Fund Certificates — a deal cannot pay out commission to a
  practitioner without a currently-valid FFC on file.
- Trust transactions (`record_trust_transaction`) are restricted to
  `admin`/`admin_agent`, matching the "principal approval" requirement for
  trust account authorisation.
- The monthly interest-allocation job splits trust interest and logs every
  transaction to `audit_log`.

**Needs legal confirmation, not a code defect:** the exact statutory citation
used in code/comments (`process_monthly_section_86_4_interest_allocation`)
should be verified against the current Property Practitioners Act and its
regulations by counsel — getting a section number wrong in a comment doesn't
change the actual math being correct, but it's worth confirming the citation
is accurate before it appears in anything client-facing.

## 4. ECTA (Electronic Signatures) — Correctly Fail-Closed

- The native e-sign screen cannot yet issue a real signature: no server-side
  OTP, no cryptographic hashing of the signed artefact. This matches
  `RELEASE_READINESS.md`'s explicit "deliberately unavailable" list — it's an
  intentional gap, not an oversight, and there's no live legal exposure while
  it stays inert.
- The UI does **not** yet distinguish "standard e-sign OK" documents
  (mandates, leases) from Offers to Purchase, which under the Alienation of
  Land Act need an accredited Advanced Electronic Signature or wet ink. This
  distinction needs to be built before e-signing is turned on for OTP-adjacent
  document types — already tracked in `LEGAL_REVIEW_PACKAGE.md`.

## 5. Documentation drift found and fixed

`SECURITY.md` still described the RBAC model as `principal`/`admin`/`agent`/
`candidate` — the two roles that were removed from live use in commit history
(`20260817000006_remove_principal_candidate_roles.sql`). Since this document
is what a reviewer would read to understand the access-control model
underpinning the POPIA/FICA claims above, a stale role list undermines the
audit trail. Corrected to `admin`/`agent`/`admin_agent` in this pass.

---

## Priority order for remediation

1. **Add a privacy policy + consent notice to the public lead-capture forms**
   (Gap 1) — concrete, low-effort, and the only item here with live exposure
   today (the calculators are already public and collecting emails).
2. Decide the POPIA erasure-vs-retention policy (Gap 2) — a policy decision
   more than an engineering one; implement the guard once decided.
3. Get counsel to confirm the cross-border processing basis and statute
   citations — paperwork, not code.
4. Everything else in this report is either already correctly implemented or
   already tracked as a known, deliberate gap in `RELEASE_READINESS.md` /
   `LEGAL_REVIEW_PACKAGE.md`.
