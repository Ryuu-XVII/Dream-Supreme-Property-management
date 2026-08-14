# Form Input Validation Audit — 2026-08-14

**Scope:** Every user-facing form in the app — both react-hook-form/zod forms and the more numerous hand-rolled `useState`-driven forms — checked for client-side validation coverage, whether validation runs before the write reaches Supabase, and whether the database has a constraint backstopping what the client misses. Also checked file-upload sites and scanned for classic injection vectors (`dangerouslySetInnerHTML`, string-built queries).

**Method:** Static analysis of `src/routes/**`, `src/components/**`, `src/lib/**`, and `supabase/migrations/**/*.sql`. No live database or runtime testing was performed.

---

## Headline findings

1. **No South African ID number validation anywhere in the codebase** — client or database. Every ID-number field is a freeform text input checked only for non-emptiness. There is no 13-digit length check, no Luhn checksum, and no cross-validation against captured date of birth. For a FICA/PPRA-regulated platform, this is the single most consequential gap: fabricated or malformed ID numbers can be recorded as "verified" party identity on multi-million-rand transactions.
2. **`createDeal()` has three call sites with wildly different validation rigor.** The full deal-capture wizard (`deals/new.tsx`) enforces a real validator module; the quick-deal modal and the standalone mandate form call the _same_ backend function but skip nearly all of it — including required ID numbers, sanctions screening, and share-percentage totals. Which checks apply depends entirely on which UI the agent happened to use.
3. **`commission_rule_set` rate fields have no bound anywhere**, client or database. A negative or >100% commission rate can be saved through the admin commission-rules editor and will corrupt every downstream commission calculation for the agency.
4. **Two file-upload surfaces bypass the hardened upload path entirely**, using raw `FileReader.readAsDataURL()` instead of `uploadFileToR2()` — meaning no size cap, no MIME check, no magic-byte signature check.
5. **The standalone mandate-creation form silently drops the documents it tells the user are required** — captured into component state, never uploaded, never persisted.
6. **No email or phone format validation exists in JavaScript anywhere in the app** — only presence checks and unreliable HTML5 `type="email"` browser hints, which don't fire once a submit handler calls `preventDefault()` first (as every form here does) and are trivially bypassed by any non-browser client.
7. **Monetary and percentage fields generally lack upper-bound sanity checks.** Most enforce "not negative" at best; several (commission rate, escalation rate, management fee) have no ceiling at all, client or server.

**Not found:** no `dangerouslySetInnerHTML` usage anywhere in `src/`, and no string-concatenated/dynamically-built Supabase queries — React's JSX escaping and the Supabase query builder/RPC pattern rule out classic XSS and SQL-injection vectors across the forms reviewed.

---

## Form-by-form findings

### Auth

**`src/routes/login.tsx`** — zod + react-hook-form

- Email: `z.string().email()`. Password: `min(6)`. Runs before submit.
- Gaps: password minimum is weaker than registration's (6 vs 8 chars); no client-side lockout/rate-limit signal. The hard-coded master-admin password comparison (`login.tsx:66`) ships a plaintext credential string in the browser bundle — a credential-exposure issue, not strictly a validation one, but worth a follow-up decision (already known and intentionally kept per earlier direction; noting it here since it lives in the same form).

**`src/routes/register.tsx`** — zod + react-hook-form

- Fields: firstName, lastName, email, phone, password, avatar.
- `phone: z.string().min(10, ...)` — length only, no SA format/prefix pattern. `"0000000000"` and 10 `a`s both pass.
- No max-length cap on any text field.
- Avatar upload correctly routes through `uploadFileToR2` — size/MIME/signature all enforced. ✅

**`src/routes/reset-password.tsx`** — manual

- `password.length < 8` and confirmation-match check, both before the Supabase call. ✅ structurally, but no complexity requirement (`"aaaaaaaa"` passes).

**`src/routes/settings/profile.tsx`** — manual

- Profile section: only checks `fullName`/`email` are non-empty. **No email format check in JS** — a programmatic submit or relaxed-validation browser lets malformed email straight into `user_account.update`. Mobile field has no format check at all.
- Password section: length + match + current-password re-verification via `signInWithPassword`, all pre-submit. ✅

### Deal / mandate capture

**`src/routes/deals/new.tsx` + `src/lib/deal-capture.ts`** — the most rigorous form in the app

- `validateDealStep()` runs on every "Next"; `validateDealCapture()` runs again before the final insert. Validation is genuinely pre-submit throughout.
- Enforced: required-field presence, `positiveMoney()` on listing/sale price, share percentages in (0, 100] summing to 100 across parties, date ordering (mandate expiry ≥ signed, offer expiry ≥ effective date), conditional requirements (tax number if sale ≥ R2m, passport for non-residents, bond fields if bond required).
- **Not enforced anywhere in this module:**
  - ID/passport number — presence only, no 13-digit or checksum validation.
  - Email — presence only (email OR mobile required), no format check.
  - Mobile — no format check.
  - Sale/listing price — only `> 0`; no upper bound. `toCents()` does a bare `Math.round(Number(value) * 100)`.
  - Commission BPS — no bound in the client; a negative or >10000 (>100%) rate reaches `createDeal()` unchecked.
  - Tax number — no SA reference-number format check.
  - No length caps on any free-text field (address, legal description, special conditions, disclosure defects).
- Baseline document uploads correctly route through `uploadFileToR2` with quota tracking. ✅

**`src/components/deal/quick-deal-modal.tsx`** — manual, minimal validation

- Only `address`, `sellerName`, and (if a deal) `buyerName` are required. None of `deal-capture.ts`'s ID/sanctions/share-percent/date-ordering checks apply, even though this calls the same `createDeal()`.
- `sellerIdNumber` / `buyerIdNumber`: freeform, not even required.
- `sellerEmail`: `type="email"` but not `required`, no JS regex.
- `listingPrice`/`salePrice`: no positivity check in JS. A negative sale price would be caught by the DB's `sale_price_cents > 0` constraint (raw Postgres error surfaced to the user), but listing price has no equivalent DB constraint at all.
- `agreedCommissionPct`: free numeric input, no bound.
- **Photo upload bypasses `uploadFileToR2` entirely** — `FileReader.readAsDataURL()` directly into state, no size/type/signature check. The resulting `photos` array is also never sent to `createDeal()` — dead code today, but the unguarded read path is live.

**`src/routes/mandates/new.tsx`** — manual, same pattern as quick-deal-modal

- Only `address`, `(listingPrice && mandateExpiryDate)`, and `sellerName` are required — presence-only.
- `sellerIdNumber`, `sellerEmail`, `sellerMobile`: freeform, unvalidated.
- `listingPrice`: `required` HTML attribute only, no positivity/range check in JS.
- **Mandate document and seller ID document are captured but never uploaded.** `handleSubmit` never calls `uploadFileToR2` or inserts a `document` row for them — the files the UI describes as required are silently discarded. This is a lost-data bug as much as a validation gap.

### Client CRM

**`src/routes/clients.tsx` + `src/lib/client-onboarding.ts`** — same structure/rigor as deal-capture.ts

- `validateClientCapture()` runs before the `create_client` RPC. ✅ pre-submit.
- Same gap pattern: ID number (presence only, no format check), email (presence only), mobile (presence only), no length caps on free-text fields.
- Otherwise solid: FICA-conditional requirements, sanctions/prominent-person screening, entity-type-specific requirements all enforced before submission.

### Commission engine

**`src/components/commission/commission-rules-content.tsx`** — no validation at all

- `saveEditing()` calls `save_commission_rule_set` with:
  - `name` — can be empty.
  - `defaultBps` — no bound; negative or >10000 (>100%) accepted.
  - `officeSharePct` — the one protected field, clamped 0–100 in the UI.
  - Deduction line `bps`/`fixed`/`payee` — unvalidated; a negative deduction `bps` would silently _increase_ an agent's payout instead of deducting.
  - `effectiveFrom`/`effectiveTo` — no ordering check.
- **Database confirms there is no backstop**: `commission_rule_set.default_commission_rate_bps` and `office_share_bps`, and `commission_rule_line.rate_bps`/`fixed_amount_cents`, have no `CHECK` constraint (`20260729000000_init_mandate_schema.sql:285-318`) — unlike the structurally similar `user_settings.default_commission_rate_bps`, which _is_ bounded 0–10000 (`20260806000003_user_settings.sql:3`).

### Agency / admin settings

**`src/routes/admin/agency.tsx`** — zod for the top section, manual for sub-sections

- Agency-details zod schema: `name`/`registration`/`ppra`/`vatNumber`/`address` are all just `min(2)` or `min(5)`. **No SA VAT number format check** (should be exactly 10 digits) and no PPRA reference format check.
- Branch section: non-empty checks only, no length cap.
- Conveyancer section: **email presence only, no format validation** — a malformed conveyancer contact email is stored and will silently fail whenever the app tries to send to it.
- Transfer duty bracket editor: **no validation at all** — `from`/`to`/`rate` can be negative, out of order, or absurd (e.g. rate = 500), and are written straight to `config_transfer_duty`, which drives every calculator's transfer-duty math app-wide.
- Logo upload: `FileReader.readAsDataURL()` directly — no size/type/signature check. Not currently persisted server-side (preview only, per an in-code comment), but an arbitrarily large file is still read client-side unguarded.

**`src/routes/admin/users.tsx`** — manual

- `save()`: name/email non-empty only, **no email format check**, before either the account update or the invitation RPC.
- `commissionPct`: has HTML `min={0} max={100}` on the input, but the change handler does a bare `Number(e.target.value)` with no clamp/NaN guard — HTML min/max don't block invalid values from a non-native submit path, they only affect native `:invalid` styling.
- `storageLimitBytes`: correctly clamped. ✅

**`src/routes/admin/settings.tsx`** — manual

- Storage/security/maintenance number fields (`globalQuotaMb`, `maxFileMb`, `sessionTimeout`, `idleDays`, `archiveDays`, `recycleRetentionDays`): `Number(e.target.value)` with no client-side range/NaN check. Database `CHECK (... > 0)` constraints exist for all of these (`20260811000001_system_governance_settings.sql:5-17`), so bad values are rejected — but as a raw Postgres error surfaced via `toast.error`, not a friendly validation message — and there is no upper-bound sanity check anywhere.
- `allowedDomains`: comma-separated free text, no format validation before it's saved and later used to gate registration.

**`src/routes/admin/trust.tsx`** — manual

- Transaction recording: positive-amount and required-field checks run before the mutation. ✅
- Interest split (`clientPct`/`ppraPct`): no check that they sum to 100, no range clamp.

**`src/routes/admin/compliance/ffc.tsx`** — manual

- Certificate upload dialog: required-field checks before upload; upload correctly routes through `uploadFileToR2` with quota tracking and rollback on RPC failure. ✅ No date-ordering check (expiry before issued isn't rejected).

### Rentals

**`src/components/rentals/lease-onboarding-wizard.tsx`** — manual

- Presence-only checks for property/landlord/tenant IDs and start/end date/rent amount, run pre-submit.
- No check that `endDate > startDate`.
- `rentAmount`, `depositAmount`, `procurementFeeRand`, `adminFeeRand`, `managementFeePct`, `escalationRatePct`: plain number inputs, no positivity/range checks in JS — a negative rent or a >100% escalation rate reaches `createLeaseMutation` unchecked.

---

## File upload validation — site by site

`uploadFileToR2()` (`src/lib/storage.ts`) is the properly hardened path: 20MB size cap, MIME allow-list (JPEG/PNG/PDF/DOC/DOCX), and a magic-byte signature check that catches renamed/mislabeled files.

| Upload site                                    | Routes through `uploadFileToR2`? | Notes                                                                                                                      |
| ---------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `register.tsx` avatar                          | ✅ Yes                           | Correct.                                                                                                                   |
| `deals/new.tsx` baseline documents             | ✅ Yes                           | Correct.                                                                                                                   |
| `data/documents.ts` deal documents tab         | ✅ Yes                           | Correct.                                                                                                                   |
| `admin/compliance/ffc.tsx` certificate upload  | ✅ Yes                           | Correct, with rollback on failure.                                                                                         |
| `deal/quick-deal-modal.tsx` property photos    | ❌ No                            | Raw `FileReader.readAsDataURL()`; no size/type/signature check. Also dead code — never sent to `createDeal`.               |
| `admin/agency.tsx` agency logo                 | ❌ No                            | Raw `FileReader.readAsDataURL()`; no checks. Preview-only, not persisted, but still reads arbitrary large files unguarded. |
| `mandates/new.tsx` mandate doc / seller ID doc | N/A                              | Captured in state, **never uploaded at all** — silently discarded on submit.                                               |

---

## Database-layer constraints (defense-in-depth check)

What the database catches even when the client doesn't:

| Table / field                                                     | Constraint                                                                      | Backstops                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `deal_party.share_percent`, `mandate/deal.transfer_share_percent` | `> 0 and <= 100`                                                                | Matches `deal-capture.ts`'s check                                                    |
| `deal.sale_price_cents`                                           | `> 0` (added `NOT VALID`, so pre-existing rows unaffected)                      | The _only_ thing stopping a negative sale price from quick-deal-modal / mandates/new |
| `deal.deposit_cents`, `occupational_rent_cents`                   | `>= 0`                                                                          | —                                                                                    |
| `party` (client onboarding)                                       | enum-like allow-lists for contact channel, processing basis, marketing channels | Matches the `<Select>`-driven fields                                                 |
| `user_settings.default_commission_rate_bps`                       | `between 0 and 10000`                                                           | A _different_ table from `commission_rule_set` — has the bound that table lacks      |
| `system_governance_settings` (quota/timeout/retention fields)     | all `> 0`                                                                       | Backstops `admin/settings.tsx`'s unchecked number inputs                             |
| `financial_engine_and_cda_schema` split/fee percentages           | `between 0 and 100`                                                             | —                                                                                    |

**No `CHECK` constraints exist anywhere for:** ID/passport number format, VAT number format, PPRA reference format, phone/mobile format, email format (columns are plain `text`), or upper bounds on any monetary column (`listing_price_cents`, `commission_rate_bps` on `mandate`, transfer-duty bracket fields, lease escalation rate/rent amounts). And confirmed absent: `commission_rule_set.default_commission_rate_bps`, `office_share_bps`, `commission_rule_line.rate_bps`/`fixed_amount_cents` — nothing in the stack, client or database, prevents a negative or >100% commission rate from being saved.

All identity/contact/format validation in this application exists **only** as optional, inconsistent client-side presence checks — there is no server-side safety net for any of it.

---

## Recommended priority order

1. **Add SA ID number validation** (13-digit format + Luhn checksum) as a shared utility, applied everywhere an ID number is captured — this is the highest compliance exposure given FICA/PPRA obligations.
2. **Unify deal creation behind one validated path.** Either route `quick-deal-modal.tsx` and `mandates/new.tsx` through the same `validateDealCapture`-equivalent checks that `deals/new.tsx` uses, or explicitly scope those two UIs to a reduced field set and enforce that reduced set server-side too.
3. **Add `CHECK` constraints to `commission_rule_set`/`commission_rule_line`** mirroring the bound already used on `user_settings.default_commission_rate_bps` (0–10000 bps), plus a client-side clamp in the rules editor.
4. **Route the two `FileReader`-based upload sites through `uploadFileToR2`** (or explicitly document why they're exempt, if the logo/photo features are genuinely preview-only and will stay that way).
5. **Fix `mandates/new.tsx`'s dropped document uploads** — either wire them to `uploadFileToR2` + a `document` insert, or remove the "required" framing from the UI if that's not the intended flow.
6. **Add a shared email/phone format validator** and apply it consistently — a single small utility used across all the forms above would close most of the presence-only gaps at once.
7. **Add upper-bound sanity checks to monetary and percentage fields** app-wide (sale/listing price, commission rate, escalation rate, management fee, interest split) — even a generous ceiling catches fat-fingered entries and prevents obviously corrupt data from ever reaching the database.

This document reflects a static-analysis pass only; no live testing (submitting malformed data through each form and observing the actual result) was performed. Treat the "backstops" noted above as a strong signal, not a substitute for direct verification if the team wants to close these gaps.
