import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sign")({
  head: () => ({ meta: [{ title: "Secure Document Signing | Dream Supreme Properties" }] }),
  component: SignPage,
});

function SignPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-8">
        <Link to="/" className="mx-auto flex max-w-2xl items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="size-4" />
          </span>
          <span className="font-display text-sm font-semibold">Dream Supreme Properties</span>
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-8">
        <GlassCard className="text-center">
          <ShieldAlert className="mx-auto size-12 text-warning" />
          <h1 className="mt-4 font-display text-2xl font-semibold">
            Electronic signing is temporarily unavailable
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Signing has been disabled until recipient identity, one-time codes, document integrity,
            and the tamper-evident audit trail can all be verified by the server. No signature has
            been recorded.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/login">Return to sign in</Link>
          </Button>
        </GlassCard>
      </main>
    </div>
  );
}
