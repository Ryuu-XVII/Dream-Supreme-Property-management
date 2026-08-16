import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, FileText, Home, ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useSignaturePad } from "@/lib/signature";

interface SigningEnvelope {
  envelopeStatus: string;
  recipientEmail: string;
  signerRole: string;
  documentFilename: string;
  payloadSha256: string;
}

export const Route = createFileRoute("/sign")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Secure Document Signing | Dream Supreme Properties" }] }),
  component: SignPage,
});

function SignPage() {
  const { token } = Route.useSearch();
  const [envelope, setEnvelope] = useState<SigningEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<"signed" | "declined" | null>(null);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const { canvasRef, clear, isEmpty, toSVG } = useSignaturePad();

  useEffect(() => {
    let active = true;
    async function loadEnvelope() {
      if (!token) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_esign_envelope_for_signing", {
        p_token: token,
        p_user_agent: navigator.userAgent,
      });
      if (!active) return;
      setEnvelope(error || !data ? null : (data as unknown as SigningEnvelope));
      setLoading(false);
    }
    void loadEnvelope();
    return () => {
      active = false;
    };
  }, [token]);

  async function submitSignature() {
    if (!token || !envelope) return;
    if (!typedName.trim()) {
      toast.error("Type your full name to sign.");
      return;
    }
    if (isEmpty()) {
      toast.error("Draw your signature in the box above.");
      return;
    }
    if (!agreed) {
      toast.error("Confirm that you agree to sign electronically.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("submit_esign_signature", {
        p_token: token,
        p_typed_name: typedName.trim(),
        p_signature_svg: toSVG(),
        p_document_hash: envelope.payloadSha256,
        p_user_agent: navigator.userAgent,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setOutcome("signed");
      setEnvelope(null);
      toast.success("Document signed");
    } finally {
      setSubmitting(false);
    }
  }

  async function declineSignature() {
    if (!token) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("decline_esign_envelope", { p_token: token });
      if (error) {
        toast.error(error.message);
        return;
      }
      setOutcome("declined");
      setEnvelope(null);
      toast.success("Signing declined");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-8">
        <Link to="/" className="mx-auto flex max-w-2xl items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold">Dream Supreme Properties</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-8">
        <h1 className="mb-1 text-xl font-semibold sm:text-2xl">Secure Document Signing</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          This single-use link records your electronic signature against a document already sent to
          you for review.
        </p>

        {loading && (
          <GlassCard className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full" />
          </GlassCard>
        )}

        {!loading && outcome === "signed" && (
          <GlassCard className="border-success/30 bg-success/5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-success" />
            <h2 className="mt-3 font-display text-lg font-semibold">
              Document signed successfully.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A tamper-evident record of your signature has been saved. This link cannot be used
              again.
            </p>
          </GlassCard>
        )}

        {!loading && outcome === "declined" && (
          <GlassCard className="border-warning/30 bg-warning/5 text-center">
            <ShieldAlert className="mx-auto size-12 text-warning" />
            <h2 className="mt-3 font-display text-lg font-semibold">Signing declined.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The agency has been notified. This link cannot be used again.
            </p>
          </GlassCard>
        )}

        {!loading && !outcome && !envelope && (
          <GlassCard className="bg-muted/30 text-center">
            <ShieldAlert className="mx-auto size-10 text-destructive" />
            <p className="mt-3 font-display text-lg font-semibold">Invalid or expired link</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This link is missing, expired, or has already been used. Contact the agency for a new
              link.
            </p>
          </GlassCard>
        )}

        {!loading && !outcome && envelope && (
          <div className="space-y-5">
            <GlassCard>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <dt className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="size-3.5" /> Document
                  </dt>
                  <dd className="max-w-[65%] text-right font-medium">
                    {envelope.documentFilename}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Signing as</dt>
                  <dd className="font-medium">
                    {envelope.recipientEmail} ({envelope.signerRole})
                  </dd>
                </div>
              </dl>
            </GlassCard>
            <GlassCard>
              <Label htmlFor="typed-name">Full name</Label>
              <Input
                id="typed-name"
                className="mb-4 mt-1"
                placeholder="Type your full name"
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
              />
              <Label>Draw your signature</Label>
              <div className="mt-1 overflow-hidden rounded-lg border border-border bg-white">
                <canvas ref={canvasRef} className="h-40 w-full touch-none" />
              </div>
              <Button variant="ghost" size="sm" className="mt-1" onClick={clear} type="button">
                Clear
              </Button>
              <label className="mt-4 flex items-start gap-2 text-sm">
                <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                <span className="text-muted-foreground">
                  I have reviewed the document referenced above and agree to sign it electronically.
                </span>
              </label>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={submitting}
                  onClick={declineSignature}
                  type="button"
                >
                  Decline
                </Button>
                <Button
                  className="flex-1"
                  disabled={submitting}
                  onClick={submitSignature}
                  type="button"
                >
                  {submitting ? "Submitting…" : "Sign Document"}
                </Button>
              </div>
            </GlassCard>
          </div>
        )}
      </main>
    </div>
  );
}
