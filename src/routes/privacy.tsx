import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/ui-kit";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy | Dream Supreme Properties" }] }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="ambient-mesh min-h-screen bg-background text-foreground">
      <header className="border-b border-white/20 bg-background/50 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
            DS
          </div>
          <p className="font-display text-sm font-semibold sm:text-base">
            Dream Supreme Properties
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <GlassCard className="space-y-6 p-6 sm:p-8">
          <div>
            <h1 className="font-display text-2xl font-semibold">Privacy Policy</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How Dream Supreme Properties collects, uses, and protects your personal information,
              in line with the Protection of Personal Information Act (POPIA).
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Who we are</h2>
            <p className="text-sm text-muted-foreground">
              Dream Supreme Properties is a South African property practitioner. This policy covers
              the personal information we collect through our public calculators, lead enquiry
              forms, and client onboarding process.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">What we collect, and why</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Enquiry details</strong> (name, email,
                telephone) submitted through our calculators or contact forms, used solely to
                respond to your enquiry and follow up on the property matter you asked about.
              </li>
              <li>
                <strong className="text-foreground">Identity and FICA information</strong> (ID
                number, proof of address, source-of-funds details) collected only from buyers,
                sellers, landlords, and tenants entering a transaction with us, as required by the
                Financial Intelligence Centre Act (FICA).
              </li>
              <li>
                <strong className="text-foreground">Transaction records</strong> (mandates, offers,
                commission, trust account entries) created and retained for the property
                transactions we facilitate on your behalf.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              We do not collect more than is needed for these purposes, and we do not sell your
              information to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Who we share it with</h2>
            <p className="text-sm text-muted-foreground">
              We share personal information only where a transaction requires it — for example, with
              conveyancing attorneys, bond originators, or the Property Practitioners Regulatory
              Authority (PPRA) where legally required — and with our infrastructure providers
              (database and document storage) acting strictly as processors on our instruction.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Marketing</h2>
            <p className="text-sm text-muted-foreground">
              We will only contact you for direct marketing if you separately opt in during
              onboarding. You may withdraw that consent at any time by contacting us using the
              details below.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">How long we keep it</h2>
            <p className="text-sm text-muted-foreground">
              FICA requires us to retain identity and transaction records for five years after a
              business relationship ends. Records are never permanently deleted before then; our
              systems are built so that records cannot be hard-deleted, protecting against premature
              loss of data we're legally required to keep.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Your rights</h2>
            <p className="text-sm text-muted-foreground">
              Under POPIA, you can ask us what personal information we hold about you, request
              corrections, or request erasure of your identity details (subject to our FICA
              retention obligations above). To exercise any of these rights, contact us using the
              details below and we will respond within a reasonable time.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Security</h2>
            <p className="text-sm text-muted-foreground">
              Personal information is protected with encryption in transit and at rest, strict
              per-agency access controls, and private document storage accessible only via
              short-lived, authenticated links. Every access to identity and financial records is
              logged.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold">Contact us</h2>
            <p className="text-sm text-muted-foreground">
              For any privacy question, access request, or complaint, contact our Information
              Officer at{" "}
              <a href="mailto:privacy@dreamsupreme.co.za" className="text-primary hover:underline">
                privacy@dreamsupreme.co.za
              </a>
              . You may also lodge a complaint with the Information Regulator of South Africa.
            </p>
          </section>

          <p className="text-xs text-muted-foreground">Last updated 19 August 2026.</p>

          <div className="border-t border-white/10 pt-4">
            <Link to="/" className="text-sm text-primary hover:underline">
              Back to home
            </Link>
          </div>
        </GlassCard>
      </main>
    </div>
  );
}
