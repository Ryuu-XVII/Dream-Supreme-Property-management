# Agency Onboarding & Configuration Guide

Welcome to Dream Supreme Property Management! As an Agency Principal or Master Admin, you have full control over how your agency operates on the platform. This guide walks you through the essential setup steps.

## 1. Initial Agency Settings

Upon your first login, navigate to the **Settings > Agency Profile** section.
- **Agency Details**: Fill in your registered business name, VAT number (if applicable), and upload your agency logo. This logo will appear on all client-facing documents and commission statements.
- **Trust Account Details**: Enter your Section 86(2) and Section 86(4) banking details if you plan on using our Trust Reconciliation module.

## 2. Commission Rule Sets

Dream Supreme automates commission splits, but it needs to know your rules first.
- Navigate to **Admin > Commission Rules**.
- Define your **Default Office Share** (e.g., 50/50).
- Add any **Franchise Royalty Fees** (e.g., 6% deducted off the top).
- Add any standard **Desk Fees** or **Marketing Deductions**.
- *Note: You can override these default rules for specific agents later in their individual profiles.*

## 3. Document Templates

You can automate the generation of Mandates, OTPs, and Leases using our Template Engine.
- Navigate to **Admin > Document Templates**.
- Create a new template using Markdown. You can use variables like `{{buyer_name}}`, `{{property_address}}`, and `{{selling_price}}`. 
- When an agent clicks "Generate OTP" on a deal, the system will automatically inject the live deal data into your template.

## 4. Inviting Your Team

Once your rules are configured, you can invite your agents.
- Go to **Admin > Team Management**.
- Enter an email address, select a role (`Admin` or `Agent`), and click "Send Invite". 
- The system will dispatch a secure magic link to their inbox, allowing them to register and join your agency workspace.
