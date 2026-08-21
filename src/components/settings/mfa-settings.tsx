import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import type { Factor } from "@supabase/supabase-js";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

// Real Supabase TOTP enrollment/challenge, per SECURITY.md: "The UI must not
// claim MFA is active unless Supabase MFA enrollment and challenge
// verification are implemented and enabled." There is no fake/demo code path
// here — every factor shown or removed here is a real one Supabase verifies.
export function MfaSettings() {
  const { isReadOnly } = useAuth();
  const [loading, setLoading] = useState(true);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadFactors = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(errorMessage(error, "Could not load two-factor authentication status."));
      setLoading(false);
      return;
    }
    setFactor(data.totp[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void loadFactors();
  }, []);

  const startEnroll = async () => {
    if (isReadOnly)
      return toast.info("Read-only mode: exit impersonation to change security settings.");
    setStarting(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator (${new Date().toLocaleDateString()})`,
      });
      if (error) throw error;
      setPendingFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    } catch (error) {
      toast.error(errorMessage(error, "Could not start two-factor enrollment."));
    } finally {
      setStarting(false);
    }
  };

  const cancelEnroll = async () => {
    const factorId = pendingFactorId;
    setPendingFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    // Drop the unverified factor Supabase created for this attempt so it
    // doesn't linger as a dead "unverified" row a user could get confused by.
    if (factorId) void supabase.auth.mfa.unenroll({ factorId });
  };

  const verifyEnroll = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingFactorId || code.trim().length !== 6) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pendingFactorId,
        code: code.trim(),
      });
      if (error) throw error;
      toast.success("Two-factor authentication enabled");
      setPendingFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode("");
      await loadFactors();
    } catch (error) {
      toast.error(errorMessage(error, "That code didn't verify. Try again."));
    } finally {
      setVerifying(false);
    }
  };

  const removeFactor = async () => {
    if (!factor) return;
    if (isReadOnly)
      return toast.info("Read-only mode: exit impersonation to change security settings.");
    if (
      !confirm(
        "Turn off two-factor authentication? Signing in will only require your password afterwards.",
      )
    )
      return;
    setRemoving(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) throw error;
      toast.success("Two-factor authentication disabled");
      await loadFactors();
    } catch (error) {
      toast.error(errorMessage(error, "Could not disable two-factor authentication."));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <GlassCard className="lg:col-span-3">
      <h2 className="mb-1 flex items-center gap-2 font-display text-base font-semibold">
        <ShieldCheck className="size-4 text-primary" /> Two-factor authentication
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Require a 6-digit code from an authenticator app in addition to your password when signing
        in.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Checking status…</p>
      ) : pendingFactorId ? (
        <form onSubmit={verifyEnroll} className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {qrCode && (
            <img
              src={`data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`}
              alt="Scan this QR code with your authenticator app"
              className="size-40 shrink-0 rounded-lg border border-border bg-white p-2"
            />
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs text-muted-foreground">
              Scan the QR code with an authenticator app (e.g. Google Authenticator, Authy), or
              enter this key manually:
            </p>
            {secret && (
              <code className="block break-all rounded-md bg-muted px-2 py-1.5 text-xs">
                {secret}
              </code>
            )}
            <div>
              <Label htmlFor="mfa-code">6-digit code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                className="mt-1 max-w-40 font-mono tracking-widest"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={verifying || code.length !== 6}>
                {verifying ? "Verifying…" : "Verify & enable"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void cancelEnroll()}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      ) : factor ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Authenticator app enabled</p>
              <p className="text-xs text-muted-foreground">{factor.friendly_name}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => void removeFactor()}
            disabled={removing || isReadOnly}
          >
            <ShieldOff className="mr-1 size-3.5" />
            {removing ? "Removing…" : "Turn off"}
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => void startEnroll()} disabled={starting || isReadOnly}>
          {starting ? "Starting…" : "Enable two-factor authentication"}
        </Button>
      )}
    </GlassCard>
  );
}
