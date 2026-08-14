import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { ComplianceTabs } from "@/components/compliance/compliance-tabs";
import { EmptyState, GlassCard, TableSkeleton } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/compliance/fica")({ component: FicaPage });

function FicaPage() {
  const query = useQuery({
    queryKey: ["fica-parties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_party")
        .select(
          "role, deal:deal_id(id, reference), party:party_id(id, full_name, entity_type, email, fica_status)",
        );
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        role: row.role,
        dealId: row.deal?.id,
        reference: row.deal?.reference,
        id: row.party?.id,
        name: row.party?.full_name,
        entityType: row.party?.entity_type,
        email: row.party?.email,
        status: row.party?.fica_status,
      }));
    },
  });
  const rows = query.data ?? [];
  return (
    <AppShell title="Compliance" description="Live FICA status for parties on visible deals.">
      <ComplianceTabs />
      {query.isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : query.isError ? (
        <GlassCard>
          <EmptyState
            title="FICA data unavailable"
            message={
              query.error instanceof Error ? query.error.message : "Could not load party records."
            }
          />
        </GlassCard>
      ) : rows.length === 0 ? (
        <GlassCard>
          <EmptyState title="No party records" message="Parties added to deals will appear here." />
        </GlassCard>
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Deal</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.id}-${row.dealId}`}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.role}</TableCell>
                  <TableCell>{row.entityType?.replaceAll("_", " ")}</TableCell>
                  <TableCell>
                    {row.dealId ? (
                      <Link
                        className="font-mono text-primary hover:underline"
                        to="/deals/$dealId"
                        params={{ dealId: row.dealId }}
                      >
                        {row.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{row.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {row.status?.replaceAll("_", " ") ?? "not started"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}
    </AppShell>
  );
}
