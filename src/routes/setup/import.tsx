import { createFileRoute, Link } from "@tanstack/react-router";
import { DatabaseZap, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/setup/import")({ component: ImportPage });

function ImportPage() {
  return (
    <AppShell title="Data Import" description="Bulk migration tools">
      <GlassCard className="mx-auto max-w-2xl text-center">
        <ShieldAlert className="mx-auto size-12 text-warning" />
        <h1 className="mt-4 font-display text-xl font-semibold">Bulk import is unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The previous screen only parsed a CSV locally and did not write or reverse records. Import
          is disabled until a transactional, validated server-side import and rollback job is
          deployed.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">
            <DatabaseZap className="size-4" /> Return to dashboard
          </Link>
        </Button>
      </GlassCard>
    </AppShell>
  );
}
