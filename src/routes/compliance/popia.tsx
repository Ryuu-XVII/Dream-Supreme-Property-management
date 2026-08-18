import { useState } from "react";
import { Navigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { canAccessAdmin, isAdminDomain } from "@/lib/auth-routing";
import { toast } from "sonner";
import { Download, Lock, Search, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";
import { GlassCard, TableSkeleton, EmptyState } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePopiaLookup, usePopiaExport, usePopiaErase, type PopiaPartyMatch } from "@/data/popia";

export const Route = createFileRoute("/compliance/popia")({
  component: PopiaRequestsRoute,
  head: () => ({
    meta: [
      { title: "POPIA Requests | Dream Supreme Properties" },
      {
        name: "description",
        content: "Look up, export, or anonymize a party's personal information on request.",
      },
    ],
  }),
});

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PartyRow({ party }: { party: PopiaPartyMatch }) {
  const exportMutation = usePopiaExport();
  const eraseMutation = usePopiaErase();

  async function handleExport() {
    try {
      const data = await exportMutation.mutateAsync(party.id);
      downloadJson(`popia-export-${party.id}.json`, data);
      toast.success("Data export downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  }

  async function handleErase() {
    try {
      await eraseMutation.mutateAsync(party.id);
      toast.success("Party data anonymized");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erasure failed");
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{party.fullName}</TableCell>
      <TableCell>{party.email ?? "—"}</TableCell>
      <TableCell>{party.mobile ?? "—"}</TableCell>
      <TableCell>{party.idOrRegNumber ?? "—"}</TableCell>
      <TableCell>
        <Badge variant="outline">
          {party.documentCount} docs · {party.signatureCount} signatures · {party.leadCount} leads
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={exportMutation.isPending}
            onClick={handleExport}
          >
            <Download className="size-3.5" /> Export
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" className="gap-1.5">
                <ShieldAlert className="size-3.5" /> Anonymize
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Anonymize {party.fullName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This immediately redacts the party&apos;s name, email, mobile number, and
                  ID/registration number. Deal, commission, and audit history linked to this party
                  is kept intact for legal and tax retention. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleErase}>Anonymize</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

function PopiaRequestsRoute() {
  // POPIA data-subject requests export and erase a person's data across the
  // whole agency — an administrator responsibility, not an individual agent's.
  const { activeAccount } = useAuth();
  if (!isAdminDomain() || !canAccessAdmin(activeAccount))
    return <Navigate to="/compliance/ffc" replace />;
  return <PopiaRequests />;
}

function PopiaRequests() {
  const [search, setSearch] = useState("");
  const lookup = usePopiaLookup(search);
  const parties = lookup.data ?? [];

  return (
    <AppShell
      title="POPIA Requests"
      description="Look up a data subject to export or anonymize their personal information on request."
      crumbs={[{ label: "Compliance" }, { label: "POPIA Requests" }]}
    >
      <ComplianceTabs />

      <GlassCard className="mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or ID/registration number…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </GlassCard>

      <GlassCard className="p-0">
        {search.trim().length < 2 ? (
          <div className="p-8">
            <EmptyState
              icon={Lock}
              title="Search for a data subject"
              message="Enter at least 2 characters of a name, email, or ID number to look up a party."
            />
          </div>
        ) : lookup.isLoading ? (
          <div className="p-5">
            <TableSkeleton rows={4} cols={6} />
          </div>
        ) : parties.length === 0 ? (
          <div className="p-8">
            <EmptyState title="No matches found" message="Try a different search term." />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>ID / Reg. number</TableHead>
                  <TableHead>Linked records</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parties.map((party) => (
                  <PartyRow key={party.id} party={party} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </AppShell>
  );
}
