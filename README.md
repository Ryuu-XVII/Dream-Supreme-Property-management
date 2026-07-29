# Dream Supreme Properties Platform

Build a complete multi-page React + TypeScript SaaS application called "Dream Supreme Properties" — an estate agency operations platform for South African property agencies. This is a UI-only build with mock data. No real backend.

TECH REQUIREMENTS:

- React + TypeScript + Vite

- shadcn/ui components with Tailwind CSS

- React Router for routing

- Lucide React icons

- Recharts for charts

- Framer Motion for animations

- React Hook Form + Zod for form validation

- date-fns for date handling

- Sonner for toast notifications

- Google Fonts: Inter (body) and Outfit (headings)

DESIGN SYSTEM:

- Dark sidebar (navy hsl(222, 47%, 11%)) with white content area

- Primary color: deep navy hsl(222, 47%, 31%)

- Accent green: hsl(142, 71%, 45%) for success states and money

- Warning amber: hsl(38, 92%, 50%) for approaching deadlines

- Destructive red: hsl(0, 84%, 60%) for overdue/lapsed items

- Premium, modern, professional look — this is a financial/legal SaaS product

- Glassmorphism effects on cards, subtle shadows, smooth micro-animations

- Dark mode support with system preference detection and manual toggle

- Fully responsive down to 380px width

- Monospace font (JetBrains Mono) for all financial figures and reference numbers

GLOBAL LAYOUT:

- Collapsible sidebar navigation with: Dashboard, Pipeline, Countdown Board, Commission, Compliance, Documents, Calculators, Leads, Reports, Settings

- Header bar with: agency name/logo area, global search (Cmd+K command palette), notification bell with unread count badge, user avatar dropdown

- Breadcrumbs on detail pages

- On mobile (≤768px): bottom tab bar with hamburger menu for secondary items

MOCK DATA:

Create realistic mock data for a fictional South African estate agency called "Dream Supreme Properties" in Johannesburg. Include:

- 4 agents (2 senior, 1 mid-level, 1 candidate practitioner), 1 principal, 1 admin

- 12-15 active deals at various pipeline stages

- 8-10 properties (mix of freehold houses, sectional title apartments, estate houses)

- Suspensive conditions with realistic due dates (some overdue, some approaching, some safe)

- Commission data with realistic South African property prices (R800,000 to R5,500,000)

- Use realistic South African addresses, suburbs (Sandton, Fourways, Midrand, Bryanston, Centurion)

- FFC certificates with various expiry states

=== PAGES TO BUILD ===

PAGE 1: LOGIN

- Clean centered login card with agency logo placeholder

- Email and password fields

- TOTP code input (6-digit) that appears after email/password validation

- "Forgot password" link

- Subtle gradient background

- Mock login: any email/password works, TOTP accepts "123456"

PAGE 2: DASHBOARD

- KPI cards row: Active Deals (with trend arrow), Pipeline Value (formatted as ZAR), Registering This Month, Overdue Conditions (red if >0), Commission MTD

- Pipeline summary mini bar chart showing deal count per stage

- Urgent conditions widget: top 5 most urgent conditions with countdown timers, color-coded (red/amber/green)

- FFC alert widget: practitioners with expiring/expired certificates

- Recent activity timeline: last 10 stage transitions and events

- Revenue forecast: bar chart showing projected commission by month

- All cards have subtle hover effects and glassmorphism

PAGE 3: DEAL PIPELINE (KANBAN BOARD)

- Horizontal scrolling Kanban board with 13 columns representing stages:

  1. Mandate Signed, 2. Listed/Marketing, 3. Offer Received, 4. OTP Signed,

  2. Conditions Pending, 6. Conveyancer Instructed, 7. Compliance Certs,

  3. Transfer Duty, 9. Rates & Levy Clearance, 10. Documents & Guarantees,

  4. Lodged, 12. Registered, 13. Commission Released

- Plus a "Cancelled/Lapsed" section at the bottom

- Deal cards show: property address (truncated), sale price (ZAR formatted), agent avatar, days-in-stage badge, condition status dot (green/amber/red pulsing)

- Filter bar at top: Agent dropdown, Branch dropdown, Price range slider, Status filter, Date range

- Cards have subtle shadow and hover lift effect

- Clicking a card navigates to deal detail

- Stage column headers show count badge

- Pipeline list view toggle (table view alternative)

PAGE 4: DEAL DETAIL

- Tabbed interface with: Overview, Conditions, Documents, Commission, Offers, Timeline

- Overview tab:

  - Header: deal reference, large stage badge with stage name, status, days-in-stage, action buttons (Advance Stage, Revert, Cancel)

  - Property card with full details (address, type, bedrooms, bathrooms, garages, sizes)

  - Parties section: seller and purchaser cards with FICA status badges (complete/incomplete/pending)

  - Practitioners section: participating agents with role, split %, external flag

  - Financial summary: sale price, commission rate, gross commission estimate

- Conditions tab:

  - Table of suspensive conditions: type icon, description, due date, countdown badge (days remaining), status badge, responsible party

  - Color coding: red ≤3 days or lapsed, amber 4-7 days, green >7 days

  - Quick action buttons: Fulfill, Extend, Waive, Fail

  - Extension modal: new date picker, reason textarea (required), shows original date

  - Bond application status card: dropdown enum (Not applied, Submitted, Declined, Approved in principle, Formally granted), institution, dates

- Documents tab:

  - Auto-generated checklist based on property type with checkboxes and upload slots

  - Document list with: filename, category, version, uploaded by, date

  - Drag-and-drop upload zone

  - In-browser PDF preview panel

- Commission tab:

  - Visual waterfall/stepped breakdown: Gross → Less VAT → Net → Less Franchise Fee → Less Referral Fee → Distributable Pool → Office Share → Agent Pool → Per-Agent splits → Less Desk Fee → Less Advance Recovery → Net Payable

  - Each step shows the calculation formula and amount in ZAR

  - Per-practitioner allocation table

  - FFC validation warning banner (red) if any practitioner's FFC is expired

  - Reconciliation error if splits don't total

- Offers tab (if multiple):

  - Cards for each offer with price, deposit, bond amount, expiry, status

  - Side-by-side comparison toggle: table comparing all offers across key fields

  - "Seller Presentation" button that opens a clean printable comparison view

- Timeline tab:

  - Vertical timeline of all stage transitions with: date, from→to stage, actor (name or attorney email), reason if any

  - Activity feed of all changes (audit events) for this deal

PAGE 5: DEAL CREATE/EDIT FORM

- Multi-step form wizard with progress indicator:

  Step 1: Property (search existing or create new — address, type, attributes)

  Step 2: Mandate (type selector: Sole/Joint/Open, listing price, commission rate, signed date, expiry date, document upload)

  Step 3: Parties (add sellers/purchasers, entity type: Natural Person/Company/CC/Trust/Deceased Estate, basic details, FICA toggle)

  Step 4: Practitioners (add participating agents from agency users, split type toggle: Percentage/Fixed, split values with validation that percentages total 100%)

  Step 5: OTP Details (purchase price, signed date, occupation date)

  Step 6: Conditions (add suspensive conditions: type dropdown, description, due date, responsible party)

  Step 7: Review & Submit (summary of all captured data, edit buttons per section)

- All money inputs formatted as ZAR with thousand separators

- Form validation with inline error messages using Zod schemas

PAGE 6: SUSPENSIVE CONDITION COUNTDOWN BOARD

- Full-page view — this is the PRIMARY SALES DEMO screen, make it visually stunning

- Large countdown cards or table rows showing ALL open conditions across the agency

- Sorted by urgency (most urgent first)

- Each row/card: deal reference (link), property address, condition type icon, condition description, responsible agent (avatar + name), due date, countdown display

- Countdown display: "X days remaining" with large number, or "LAPSED - X days overdue" in red

- Color coding: Red pulsing glow for ≤3 days or lapsed, amber for 4-7 days, green for >7 days

- Summary bar at top: total conditions, overdue count (red), due this week (amber), on track (green)

- Quick action buttons on each: Mark Fulfilled, Extend, Waive

- Filter bar: agent, condition type, status

- This page should feel urgent and alive — subtle animations on countdowns, pulsing red indicators

PAGE 7: COMMISSION RULES CONFIGURATION

- Rule set list page: table with name, effective dates, default badge, edit/duplicate/archive actions

- Rule set editor (modal or separate page):

  - General: name, effective from/to dates, VAT treatment toggle (inclusive/exclusive), default commission rate (BPS input with % display), rounding mode

  - Deduction lines: drag-orderable list of deductions:

    - Type dropdown: Franchise Fee, Referral Fee, Marketing Recovery, Co-mandate Share, Desk Fee

    - Calculation basis: percentage or fixed amount

    - Rate (BPS) or Fixed Amount (cents with ZAR display)

    - Payee description

    - Add/remove line buttons

  - Office share percentage slider/input

  - Preview section: shows a worked example with a mock R2,500,000 sale applying the current rules (matching the spec's §7.3 worked example format)

- Template rule sets: cards for "Standard Independent Agency", "RE/MAX Franchise", "Keller Williams", "Seeff" — clicking one pre-fills the form

PAGE 8: MONTHLY COMMISSION RECONCILIATION

- Period selector: month/year picker with previous/next arrows

- Status banner: "Draft" (amber) or "Approved" (green) or "Not Started" (grey)

- Registered deals table: all deals registered in the selected month with columns: reference, property, sale price, gross commission, net commission, agents

- Per-practitioner summary section: grouped cards or table showing each agent's total: gross allocation, desk fees, advance recoveries, clawbacks, NET PAYABLE (large, bold)

- Clawback entries: separate section showing cancelled deals with clawback amounts (red)

- Totals row: total commission, total VAT, total franchise fees, total office share, total agent payouts

- Action buttons: "Approve Run" (principal only — confirms with modal), "Export CSV", "Export PDF"

- All amounts in monospace ZAR formatting

PAGE 9: AGENT EARNINGS DASHBOARD

- Personal earnings view (each agent sees their own)

- Large hero number: YTD Total Earnings (ZAR formatted)

- Secondary metrics: pending commission in pipeline, deals registered YTD, average commission per deal

- Monthly trend bar chart (Recharts) showing earnings per month

- Deal breakdown table: each registered deal with date, property, sale price, commission earned

- Advances section: table of outstanding advances with amount, date, deal reference, recovery status

- Tier progress (if applicable): visual progress bar showing YTD earnings toward next tier threshold with current and next split rate

PAGE 10: COMPLIANCE — FFC REGISTER

- Practitioner table with columns: name, role, certificate number, issued date, expiry date, days until expiry, status badge

- Status badges: Valid (green), Expiring Soon ≤30 days (amber), Expired (red), Missing (grey)

- Each row has: view certificate button, upload new certificate button

- Summary cards at top: total practitioners, valid count, expiring count, expired count

- FFC upload modal: certificate number, issued date, expiry date, file upload

PAGE 11: COMPLIANCE — FICA REGISTER

- Party list table: name, party type (seller/purchaser/landlord/tenant), entity type, FICA status, POPIA consent status

- FICA status: Complete (green), Partial (amber), Not Started (red)

- Expandable row showing FICA checklist per party: ID document, proof of address, source of funds, etc. — with checkboxes and upload buttons

- POPIA consent section: consent toggle, purpose description, timestamp

PAGE 12: COMPLIANCE — AUDIT LOG

- Searchable, filterable table with columns: timestamp, user, entity type, entity reference, action (Created/Updated/Stage Changed/Calculated/Deleted), changes summary

- Filters: date range, user dropdown, entity type, action type

- Click row to expand: full before/after JSON diff view with syntax highlighting

- Export button (CSV)

- Pagination with configurable page size

PAGE 13: DOCUMENT LIBRARY

- Split view: left panel is deal/entity tree browser, right panel shows documents for selected context

- Document cards: filename, category badge, version, size, uploaded by, date, download button

- Version history accordion: shows version chain with "supersedes" links

- Upload zone: drag-and-drop with category selector

- Template management tab:

  - Template list with: name, category, merge fields count, last updated

  - Upload template button

  - Merge field reference panel showing available fields grouped by entity (Deal, Property, Party, Agency)

  - "Generate Document" button: opens modal to select template + deal → shows preview of merged fields → download DOCX/PDF

PAGE 14: ELECTRONIC SIGNING PAGE

- Clean, focused layout (no sidebar — standalone page accessed via link)

- Document preview (PDF viewer) on left/top

- Signing panel on right/bottom:

  - Tabs: "Draw Signature" (canvas) / "Type Signature" (styled text input)

  - Email OTP verification: input field with "Send OTP" button

  - Legal attestation checkbox

  - "Sign Document" button

- Warning banner (amber) for document categories excluded from electronic signature under the ECT Act, showing "This document requires a wet-ink signature. Please print, sign, and upload a scanned copy."

- Success confirmation with: signature image preview, timestamp, document hash

PAGE 15: PUBLIC CALCULATORS (4 separate pages, no sidebar, unauthenticated, embeddable)

Each calculator page has:

- Clean branded header with agency logo placeholder and calculator name

- Modern card-based layout with inputs on left, results on right (stacked on mobile)

- Real-time calculation as inputs change (no submit button)

- "Email My Results" CTA at bottom: modal with name, email, telephone fields

- Subtle brand color theming

- Footer: "Powered by Mandate" link

a) BOND REPAYMENT CALCULATOR:

Inputs: Loan amount (slider + number input, R100k–R10M), Interest rate % (slider + input, 7-15%), Term years (slider + input, 5-30)

Outputs: Monthly instalment (large ZAR number), Total interest over term, Total repayment, Amortisation schedule toggle (line chart showing principal vs interest over time)

b) TRANSFER COST CALCULATOR:

Inputs: Purchase price (slider + number input), Bond amount, "Seller is VAT vendor" toggle

Outputs: Transfer duty (with bracket breakdown table), Conveyancing fees estimate, Deeds office fees, Postage/petties, Total transfer costs, VAT note if VAT sale selected (showing "No transfer duty payable — sale is subject to VAT")

c) AFFORDABILITY CALCULATOR:

Inputs: Gross monthly income, Total monthly expenses/debt, Interest rate %, Term years

Outputs: Maximum monthly instalment, Maximum loan amount, Maximum purchase price, Debt-to-income ratio gauge (with 30% guideline marker)

d) RENTAL YIELD CALCULATOR:

Inputs: Purchase price, Monthly rental income, Monthly costs (rates, levy, insurance, maintenance)

Outputs: Gross yield %, Net yield %, Monthly cash flow, Annual cash flow, Simple payback period

PAGE 16: CONVEYANCER STATUS UPDATE PAGE (unauthenticated, no sidebar)

- Minimal, clean, branded page

- Agency logo and "Deal Status Update" heading

- Read-only info card showing: deal reference, property address, current stage (large badge), next expected stage

- Single date input field labeled with the relevant action (e.g., "Lodgement Date" or "Registration Date")

- Large "Submit Update" button

- Success state: green confirmation card "Status updated successfully. Thank you."

- Expired state: grey card "This link has expired. Please contact the agency for a new link."

- Loading state with skeleton

PAGE 17: LEAD MANAGEMENT

- Table view: name, email, mobile, source (calculator type badge: Bond/Transfer/Affordability/Yield), assigned agent (avatar), status (New/Contacted/Qualified/Converted/Closed), created date

- Lead detail slide-over panel: contact info, calculator payload (what they calculated — formatted nicely, e.g., "Calculated bond repayment for R2,500,000 loan at 11.5%"), assignment dropdown, status dropdown, notes textarea

- Quick actions: assign to agent, change status

- Filters: status, source, date range, assigned agent

PAGE 18: REPORTS HUB

- Card grid linking to different reports:

  a) Pipeline Report: deals by stage (stacked bar), avg days-in-stage (horizontal bar), stage-to-stage conversion rates (funnel chart)

  b) Fall-Through Report: cancellations by reason (pie chart using Appendix C taxonomy: Bond declined, Purchaser withdrew, etc.), monthly trend line

  c) Commission Report: monthly earnings by agent (grouped bar), cumulative YTD line, total agency commission per month

  d) Compliance Report: FFC status summary (donut), FICA completion rate (progress bars per party type)

- Each report page has: date range filter, agent/branch filter, chart + supporting data table below, Export buttons (CSV, PDF)

PAGE 19: SETTINGS — AGENCY PROFILE

- Form: agency name, registration number, PPRA reference, VAT number, VAT vendor toggle, physical address, logo upload with preview

- Branch management: table with add/edit/archive. Each branch: name, address

- Conveyancer firms: table with add/edit. Columns: firm name, contact person, email, telephone, preferred toggle

- Transfer duty rate configuration: bracket editor showing: value range, rate %. Add/edit brackets. Effective date selector

PAGE 20: SETTINGS — NOTIFICATION PREFERENCES

- Matrix table: rows are notification types (from Appendix B: Condition due, Condition failed, Stage advanced, Deal registered, Deal cancelled, FFC expiring, Mandate expiring, Deal stale, Commission issued, Conveyancer status request, New lead)

- Columns: Email (toggle), In-App (toggle), Recipients (multi-select: Agent, Principal, Admin)

- Save button

PAGE 21: SETTINGS — USER MANAGEMENT

- User table: full name, email, role badge (Principal/Agent/Candidate/Admin), branch, FFC status, active/archived status

- Add user modal: full name, email, mobile, role dropdown, branch dropdown, PPRA reference, candidate practitioner toggle (shows supervisor dropdown when on)

- Edit user: same fields

- Archive user (no delete — soft archive only)

PAGE 22: ONBOARDING WIZARD

- Full-screen wizard (no sidebar), progress steps indicator at top

- Step 1: Agency Details (name, registration, PPRA, VAT, address, logo upload)

- Step 2: Commission Setup (select template rule set or build custom — reuse rule set editor component)

- Step 3: Branches (add branches — name, address)

- Step 4: Team (add practitioners — name, email, role, branch)

- Step 5: FFC Certificates (upload FFC for each practitioner)

- Step 6: Review & Launch (summary of everything configured, "Launch Mandate" button with confetti animation)

- Each step has: back/next buttons, step validation before proceeding, skip option for optional steps

PAGE 23: CSV IMPORT

- Step 1: Select import type (Practitioners, Properties, Parties, Deals)

- Step 2: File upload (drag-and-drop CSV)

- Step 3: Column mapping: left column shows CSV headers, right column shows system fields with dropdowns. Auto-map where headers match. Highlight unmapped required fields in red

- Step 4: Dry-run validation report: table showing row-by-row validation results with error/warning icons and descriptions. Summary: X rows valid, Y rows with errors, Z rows with warnings

- Step 5: Confirm import or go back to fix

- Progress bar during import with row count

ADDITIONAL REQUIREMENTS:

- All monetary values displayed in South African Rand (R) format with thousand separators: R 2,500,000.00

- Use monospace font for all financial figures

- All date displays in DD MMM YYYY format (e.g., 29 Jul 2026)

- Skeleton loading states on every page/component that would fetch data

- Empty states with illustrations and helpful messages on every list/table

- 404 page with "Deal not found" messaging and navigation back

- Toast notifications (Sonner) for all actions: success (green), error (red), info (blue)

- Smooth page transitions with Framer Motion

- All tables should have: sorting, pagination (25/50/100 rows), column visibility toggles

- Command palette (Cmd+K): search deals by reference/address, navigate to any page

- Persistent sidebar collapse state

- Role-based mock: add a role switcher in the header (for demo purposes) that toggles between Principal/Agent/Candidate/Admin views, showing/hiding elements per the permission matrix

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
