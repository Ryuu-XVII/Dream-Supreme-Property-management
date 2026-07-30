import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { zar, dateFmt } from "@/lib/format";
import { FileText, Wrench, Wallet } from "lucide-react";

export const Route = createFileRoute("/rentals/$leaseId")({
  component: LeaseDetail,
});

function LeaseDetail() {
  const { leaseId } = Route.useParams();
  const { account } = useAuth();

  const leaseQuery = useQuery({
    queryKey: ["lease", leaseId],
    enabled: !!account,
    queryFn: async () => {
      const [leaseRes, invoicesRes, maintRes] = await Promise.all([
        supabase
          .from("lease")
          .select(`
            *,
            property:property_id(address, suburb)
          `)
          .eq("id", leaseId)
          .single(),
        supabase.from("lease_invoice").select("*").eq("lease_id", leaseId).order("due_date", { ascending: false }),
        supabase.from("maintenance_job").select("*").eq("lease_id", leaseId).order("created_at", { ascending: false })
      ]);

      if (leaseRes.error) throw leaseRes.error;
      
      return {
        lease: leaseRes.data,
        invoices: invoicesRes.data || [],
        maintenance: maintRes.data || []
      };
    },
  });

  if (leaseQuery.isLoading) {
    return (
      <AppShell title="Loading Lease..." description="Fetching lease details...">
        <div className="flex h-32 items-center justify-center">Loading...</div>
      </AppShell>
    );
  }

  const { lease, invoices, maintenance } = leaseQuery.data!;
  const isManager = lease.managed_by === account?.id || account?.role === "principal";

  return (
    <AppShell
      title={`Lease: ${lease.tenant_name}`}
      description={(lease.property as any)?.address}
    >
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">
            <FileText className="mr-2 size-4" />
            Lease Details
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <Wallet className="mr-2 size-4" />
            Ledger & Invoices
            <Badge variant="secondary" className="ml-2">
              {invoices.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Wrench className="mr-2 size-4" />
            Maintenance
            <Badge variant="secondary" className="ml-2">
              {maintenance.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <GlassCard>
            <h3 className="mb-4 text-lg font-semibold">Terms & Conditions</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <div className="font-medium capitalize">{lease.status}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Monthly Rent</div>
                <div className="font-medium">{zar(lease.rent_amount_cents / 100)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Start Date</div>
                <div className="font-medium">{dateFmt(lease.start_date)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">End Date</div>
                <div className="font-medium">{dateFmt(lease.end_date)}</div>
              </div>
            </div>
            
            {!isManager && (
              <div className="mt-8 rounded-md bg-amber-500/10 p-4 text-amber-600 border border-amber-500/20">
                You are viewing this lease in read-only mode because you are not the assigned managing agent.
              </div>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="ledger">
          <GlassCard>
            <h3 className="mb-4 text-lg font-semibold">Invoices</h3>
            {invoices.length === 0 ? (
              <p className="text-muted-foreground">No invoices generated for this lease yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{inv.invoice_type} Invoice</div>
                      <div className="text-sm text-muted-foreground">Due: {dateFmt(inv.due_date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{zar(inv.amount_cents / 100)}</div>
                      <Badge variant={inv.status === 'paid' ? 'default' : 'outline'}>{inv.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="maintenance">
          <GlassCard>
            <h3 className="mb-4 text-lg font-semibold">Maintenance Tickets</h3>
            {maintenance.length === 0 ? (
              <p className="text-muted-foreground">No maintenance jobs logged.</p>
            ) : (
              <div className="space-y-4">
                {maintenance.map((job) => (
                  <div key={job.id} className="rounded-md border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-semibold">{job.title}</h4>
                      <Badge variant="outline">{job.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{job.description}</p>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Reported: {dateFmt(job.reported_date)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
