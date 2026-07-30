# Client onboarding capture policy

Reviewed 29 July 2026. This is a product-control matrix, not a substitute for the agency's approved risk management and compliance programme (RMCP) or legal advice.

## Why capture is staged

POPIA section 10 requires collected information to be adequate, relevant, and not excessive for its purpose. A person asking for a valuation or viewing therefore does not automatically justify collecting a complete identity pack. FICA customer due diligence becomes relevant when establishing a business relationship or entering a single transaction, and its depth is risk-based.

The client form consequently has two explicit stages:

| Stage                 | Required capture                                                                                                                                                        | Product result                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Contact / prospect    | Legal or known name, one or more relationship roles, email or mobile, preferred contact method, processing reason, privacy-notice delivery                              | `fica_status = not_started`; no identity number is required or implied to be verified |
| Start FICA onboarding | Identity/registration number, residential or registered address, entity-specific identity details, risk rating, prominent-person declaration and recorded TFS screening | `fica_status = partial`; completion remains a later evidence-verification step        |

The form never lets an operator declare a newly typed record FICA complete. Completion must follow document and independent-source verification under the agency's RMCP.

## Field matrix

### All contacts

- Full legal or registered name.
- One or more roles: seller, purchaser, landlord, tenant, or referrer. Roles are multi-valued because the same party may have more than one relationship with the agency.
- Entity type: natural person, company, close corporation, trust, or deceased estate.
- At least one reachable channel, with the chosen preferred method validated against it.
- Assigned practitioner, acquisition source, and language as operational CRM details.
- Processing reason and a timestamp proving the privacy notice was delivered.
- Direct-marketing opt-in and channels as a separate, optional record. Ordinary service communication does not silently create marketing consent.

### FICA onboarding

- Natural person: identity/passport number, date of birth, nationality, residence status, and passport details for non-residents.
- Entity or legal arrangement: registration/trust number, authorised representative and capacity, plus beneficial owners or controlling persons.
- Residential or registered address.
- Client risk rating, a recorded domestic/foreign prominent-person determination, and its result.
- A recorded targeted-financial-sanctions screening event with no match at take-on. A potential match must be escalated under the RMCP rather than represented as cleared.
- Purchaser source of funds; the transaction capture collects this again in its deal-specific context.
- Tax number, marital status, acquisition source, notes, and postal details remain available but are not universally forced at contact stage. The agency's RMCP or the transaction may make them mandatory later.

## Enforcement and auditability

- Browser validation gives immediate guidance; `create_client(jsonb)` repeats material validation in PostgreSQL.
- The function derives agency and actor from the authenticated account, restricts assignment by non-managers, checks the assignee belongs to the company, and rejects duplicate identity/registration numbers within the company.
- A client create audit event records roles, entity type, assignment, capture version, whether FICA was started, and whether marketing consent was recorded. Sensitive identity particulars are not copied into the audit payload.
- Existing `popia_consent_at` data is retained for compatibility, but new capture uses distinct privacy-notice and direct-marketing timestamps.

## Primary sources

- [FIC Revised Guidance Note 7A](https://www.fic.gov.za/document/revised-guidance-note-7a/) — risk-based customer identification and verification, representatives, beneficial ownership, prominent persons, and ongoing due diligence.
- [FIC compliance obligations](https://www.fic.gov.za/Compliance/) — CDD, beneficial ownership, risk rating, prominent-person determination, record keeping, and TFS screening at client take-on.
- [FIC property-sector risk assessment](https://www.fic.gov.za/document/sector-risk-assessment-revised-assessment-of-the-property-sector/) — client/entity risks and source-of-funds indicators in property transactions.
- [FIC estate-agent TFS guidance](https://www.fic.gov.za/2025/08/05/estate-agents-and-tfs/) — screening clients, beneficial owners, representatives, represented persons, and transaction parties regardless of risk rating.
- [Information Regulator POPIA conditions](https://inforegulator.org.za/knowledge-base/category/popia/chapter-3-conditions-for-lawful-processing/) — minimality, justification, direct collection, notification, and information quality.
- [Information Regulator direct-marketing guidance](https://inforegulator.org.za/guidance-notes/) — separate controls for direct marketing and electronic communications.
