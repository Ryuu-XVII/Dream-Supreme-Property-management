# Deal capture requirements

This implementation targets a South African residential sale that has reached signed Offer to Purchase stage. It captures enough structured information to operate the pipeline and prepare a conveyancer instruction, while leaving final legal and tax verification to the appointed conveyancer and the agency's approved FICA process.

## Implemented field matrix

| Area                   | Captured at deal creation                                                                                                                                                                | Why                                                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Property               | Physical address, province, full deeds-search description, deeds office, current title deed number, erf/unit reference, property type/use, improved status, sizes, ownership share       | SARS requires the current title deed number and full property description for the transfer-duty declaration.                                                                                                          |
| Mandate                | Type, listing price, commission rate, signed date, expiry, signed document                                                                                                               | Establishes the practitioner's authority and the commercial basis of the transaction.                                                                                                                                 |
| Sellers and purchasers | Multiple party records, per-party ownership share, legal/entity name, ID/passport/registration number, contact details, tax number, date of birth, marital status, nationality/residency | SARS allows multiple transferor/transferee containers and requires identity, share, tax, marital, and capacity particulars according to party type.                                                                   |
| Entity parties         | Authorised representative, capacity, beneficial-owner details, authority/resolution checklist                                                                                            | FICA customer due diligence extends to beneficial owners and persons acting for a client; authority must be established.                                                                                              |
| FICA                   | Status, risk rating, prominent-person flag, sanctions-screening confirmation, POPIA acknowledgement, purchaser source of funds, separate seller/purchaser evidence categories            | Property practitioners are accountable institutions and must apply customer due diligence, sanctions screening, record keeping, and a risk-based approach. Source of funds is a material property-sector risk factor. |
| Agreement              | Sale price, effective/last-signature date, offer expiry, sale method, fixtures, exclusions, special conditions                                                                           | Preserves the signed agreement's operative terms and dates used downstream.                                                                                                                                           |
| Funding                | Deposit amount/due date/stakeholder, balance payment method, bond amount/deadline, purchaser source of funds                                                                             | Drives condition monitoring and conveyancer handoff.                                                                                                                                                                  |
| Occupation             | Occupation date and occupational rent                                                                                                                                                    | SARS transfer-duty capture includes occupational rent or interest where occupation and registration differ.                                                                                                           |
| Tax and risk flags     | VAT sale and price treatment, connected parties, non-resident seller, seller acquisition date/original price                                                                             | Drives transfer-duty/VAT treatment, valuation evidence, and section 35A review.                                                                                                                                       |
| Disclosure             | Completion flag, disclosed-defect notes, signed PPRA condition-report upload                                                                                                             | Section 67 of the Property Practitioners Act requires the prescribed disclosure to be obtained before accepting a mandate and attached to a sale or lease agreement.                                                  |
| Documents              | Signed mandate, signed OTP, PPRA disclosure required at creation; FICA, title deed, municipal, entity, valuation, and section 35A checklist items generated conditionally                | Separates creation gates from the broader completion checklist while making missing evidence visible.                                                                                                                 |

## Validation policy

- A deal cannot be created without a formal property description, current title deed number, valid price, effective date, lead practitioner, at least one seller and purchaser, and confirmed PPRA disclosure.
- Every party needs a legal name, identifying number, and at least one contact channel.
- Natural persons require date of birth and marital status. Non-residents require passport details.
- Income-tax numbers are required for entities and for natural-person transactions of R2 million or more, matching the current SARS transfer-duty guide.
- Entity parties require representative, capacity, and beneficial-owner details.
- Every purchaser requires a source-of-funds description.
- Every party requires a recorded targeted-financial-sanctions screen; risk and prominent-person flags are persisted for the agency's enhanced due-diligence workflow.
- Deposit details, bond details, subject-to-sale details, and non-resident/entity evidence are conditional.
- The signed mandate, signed OTP, and signed PPRA property-condition disclosure are upload gates. Other required evidence remains visible on the generated deal checklist.

## Authoritative sources reviewed

- [Property Practitioners Act 22 of 2019, section 67](https://www.gov.za/documents/acts/property-practitioners-act-22-2019-english-tshivenda-03-oct-2019)
- [Property Practitioners Regulations, 2022 — prescribed immovable property condition report](https://www.gov.za/sites/default/files/gcis_document/202201/45735pr47.pdf)
- [SARS Guide for Transfer Duty via eFiling](https://www.sars.gov.za/guide-for-transfer-duty-via-efiling/)
- [SARS transfer-duty supporting-document checklist](https://www.sars.gov.za/wp-content/uploads/Docs/TransferDuty/Supporting-documents-for-Transfer-Duty-transactions-%E2%80%93-October-2024.pdf)
- [FIC Guidance Note 3A — customer identification and verification](https://www.fic.gov.za/wp-content/uploads/2023/09/2005.07-Guidance-Guidance-Note-3A-Accountable-institutions-and-CDD.pdf)
- [FIC revised property-sector risk assessment](https://www.fic.gov.za/document/sector-risk-assessment-revised-assessment-of-the-property-sector/)
- [FIC guidance on sanctions screening for estate agents](https://www.fic.gov.za/2025/08/05/estate-agents-and-tfs/)

## Release boundary

This field set is an operational capture model, not a substitute for the agency's approved OTP template, RMCP, conveyancer instruction sheet, or legal advice. Before production, the agency's conveyancer and FICA compliance officer must approve required/conditional rules, wording, evidence types, and retention periods.
