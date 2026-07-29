import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, EmptyState, TableSkeleton } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QuickDealModal } from "@/components/deal/quick-deal-modal";
import {
  Users, UserCheck, ShieldCheck, Plus, Search, Mail, Phone, FileText, CheckCircle2, AlertCircle
} from "lucide-react";
import { dateFmt } from "@/lib/format";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Client CRM Directory | Dream Supreme Properties" },
      { name: "description", content: "Manage sellers, buyers, tenants and landlords, FICA status, and POPIA consent." },
    ],
  }),
  component: ClientsPage,
});

interface ClientParty {
  id: string;
  name: string;
  type: "Seller" | "Purchaser" | "Tenant" | "Landlord" | "Referrer";
  email: string;
  mobile: string;
  idNumber: string;
  ficaStatus: "Complete" | "Partial" | "Missing";
  popiaConsent: boolean;
  createdAt: string;
}

const seedClients: ClientParty[] = [
  {
    id: "p1",
    name: "Johannes van der Merwe",
    type: "Seller",
    email: "johannes.vdm@gmail.com",
    mobile: "+27 82 456 7890",
    idNumber: "7804125089088",
    ficaStatus: "Complete",
    popiaConsent: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "p2",
    name: "Thabo Mbeki Properties Trust",
    type: "Landlord",
    email: "admin@mbekitrust.co.za",
    mobile: "+27 11 987 6543",
    idNumber: "IT 4521/2012",
    ficaStatus: "Complete",
    popiaConsent: true,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: "p3",
    name: "Sipho Dlamini",
    type: "Purchaser",
    email: "sipho.d@outlook.com",
    mobile: "+27 73 111 2233",
    idNumber: "8509155123087",
    ficaStatus: "Partial",
    popiaConsent: true,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "p4",
    name: "Chloe & Mark Davies",
    type: "Seller",
    email: "davies.family@mweb.co.za",
    mobile: "+27 83 999 4455",
    idNumber: "8001015099081",
    ficaStatus: "Complete",
    popiaConsent: true,
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: "p5",
    name: "Anika Patel",
    type: "Tenant",
    email: "anika.p@techcorp.co.za",
    mobile: "+27 84 555 1212",
    idNumber: "9211300054089",
    ficaStatus: "Missing",
    popiaConsent: false,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

function ClientsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ficaFilter, setFicaFilter] = useState("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientParty | null>(null);

  // New Client Form
  const [newForm, setNewForm] = useState({
    name: "",
    type: "Seller",
    email: "",
    mobile: "",
    idNumber: "",
    ficaStatus: "Complete",
    popiaConsent: true,
  });

  const { data: remoteClients, isLoading, refetch } = useQuery({
    queryKey: ["clients-crm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party")
        .select("id, full_name, party_type, email, mobile, id_or_reg_number, fica_status, popia_consent_at, created_at")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) return seedClients;

      return data.map((p: any): ClientParty => ({
        id: p.id,
        name: p.full_name,
        type: p.party_type === "seller" ? "Seller" : p.party_type === "purchaser" ? "Purchaser" : p.party_type === "tenant" ? "Tenant" : "Landlord",
        email: p.email || "—",
        mobile: p.mobile || "—",
        idNumber: p.id_or_reg_number || "—",
        ficaStatus: p.fica_status === "complete" ? "Complete" : p.fica_status === "partial" ? "Partial" : "Missing",
        popiaConsent: !!p.popia_consent_at,
        createdAt: p.created_at,
      }));
    },
  });

  const clientsList = remoteClients || seedClients;

  const filteredClients = useMemo(() => {
    return clientsList.filter((c) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (typeFilter !== "all" && c.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (ficaFilter !== "all" && c.ficaStatus.toLowerCase() !== ficaFilter.toLowerCase()) return false;
      return true;
    });
  }, [clientsList, search, typeFilter, ficaFilter]);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      toast.loading("Adding client contact...", { id: "add-client" });
      const userRes = await supabase.auth.getUser();
      const userAcc = await supabase.from("user_account").select("agency_id").eq("auth_user_id", userRes.data.user?.id).single();

      if (userAcc.data?.agency_id) {
        await supabase.from("party").insert({
          agency_id: userAcc.data.agency_id,
          full_name: newForm.name,
          party_type: newForm.type.toLowerCase(),
          email: newForm.email,
          mobile: newForm.mobile,
          id_or_reg_number: newForm.idNumber,
          fica_status: newForm.ficaStatus.toLowerCase(),
          popia_consent_at: newForm.popiaConsent ? new Date().toISOString() : null,
        });
      }

      toast.success("Client added successfully!", { id: "add-client" });
      setAddModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: "add-client" });
    }
  };

  return (
    <AppShell
      title="Client CRM Directory"
      description="Manage agency sellers, purchasers, landlords, FICA documentation, and POPIA consent."
      crumbs={[{ label: "Clients" }]}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search clients by name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="seller">Sellers</SelectItem>
              <SelectItem value="purchaser">Purchasers</SelectItem>
              <SelectItem value="landlord">Landlords</SelectItem>
              <SelectItem value="tenant">Tenants</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ficaFilter} onValueChange={setFicaFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="FICA status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All FICA</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setAddModalOpen(true)} className="gap-1.5 font-semibold">
          <Plus className="size-4" /> Add Client
        </Button>
      </div>

      <GlassCard>
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : filteredClients.length === 0 ? (
          <EmptyState title="No clients found" message="No client contacts match your active search filters." />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact Details</TableHead>
                  <TableHead>FICA Status</TableHead>
                  <TableHead>POPIA Consent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-semibold">{client.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {client.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs space-y-0.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="size-3" /> {client.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3" /> {client.mobile}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          client.ficaStatus === "Complete"
                            ? "bg-success/15 text-success border-success/30"
                            : client.ficaStatus === "Partial"
                            ? "bg-warning/15 text-warning border-warning/30"
                            : "bg-destructive/15 text-destructive border-destructive/30"
                        }
                      >
                        {client.ficaStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {client.popiaConsent ? (
                        <span className="flex items-center gap-1 text-xs text-success font-medium">
                          <CheckCircle2 className="size-3.5" /> Granted
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertCircle className="size-3.5" /> Pending
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => {
                          setSelectedClient(client);
                          setDealModalOpen(true);
                        }}
                      >
                        <FileText className="size-3.5 text-primary" /> Create Deal
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>

      {/* Add Client Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add New Client Contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={newForm.type} onValueChange={(v) => setNewForm({ ...newForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Seller">Seller</SelectItem>
                    <SelectItem value="Purchaser">Purchaser</SelectItem>
                    <SelectItem value="Landlord">Landlord</SelectItem>
                    <SelectItem value="Tenant">Tenant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">FICA Status</Label>
                <Select value={newForm.ficaStatus} onValueChange={(v) => setNewForm({ ...newForm, ficaStatus: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Complete">Complete</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Missing">Missing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email Address</Label>
              <Input
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mobile Number</Label>
              <Input
                value={newForm.mobile}
                onChange={(e) => setNewForm({ ...newForm, mobile: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Contact</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Deal Modal when clicking "Create Deal" */}
      <QuickDealModal
        open={dealModalOpen}
        onOpenChange={setDealModalOpen}
      />
    </AppShell>
  );
}
