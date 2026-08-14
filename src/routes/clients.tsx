import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  createInitialClientCapture,
  validateClientCapture,
  type ClientCaptureForm,
  type ClientEntityType,
  type ClientRole,
} from "@/lib/client-onboarding";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, EmptyState, TableSkeleton } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { QuickDealModal } from "@/components/deal/quick-deal-modal";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "Client CRM Directory | Dream Supreme Properties" },
      {
        name: "description",
        content: "Manage client contacts, onboarding, FICA readiness, and POPIA records.",
      },
    ],
  }),
  component: ClientsPage,
});

const roleOptions: Array<{ value: ClientRole; label: string }> = [
  { value: "seller", label: "Seller" },
  { value: "purchaser", label: "Purchaser" },
  { value: "landlord", label: "Landlord" },
  { value: "tenant", label: "Tenant" },
  { value: "referrer", label: "Referrer" },
];

const entityOptions: Array<{ value: ClientEntityType; label: string }> = [
  { value: "natural_person", label: "Natural person" },
  { value: "company", label: "Company" },
  { value: "close_corporation", label: "Close corporation" },
  { value: "trust", label: "Trust" },
  { value: "deceased_estate", label: "Deceased estate" },
];

const titleCase = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

interface ClientParty {
  id: string;
  name: string;
  roles: ClientRole[];
  entityType: ClientEntityType;
  email: string;
  mobile: string;
  ficaStatus: "Complete" | "Partial" | "Not Started" | "Expired";
  privacyNoticeDelivered: boolean;
  marketingConsent: boolean;
  assignedToName: string;
}

interface Practitioner {
  id: string;
  full_name: string;
}

function FieldErrorSummary({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
      <p className="mb-1 font-semibold">Please correct the following:</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

function ClientsPage() {
  const { isReadOnly } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ficaFilter, setFicaFilter] = useState("all");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [newForm, setNewForm] = useState<ClientCaptureForm>(createInitialClientCapture);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["clients-crm"],
    queryFn: async () => {
      const [clientsResult, usersResult] = await Promise.all([
        supabase
          .from("party")
          .select(
            "id, full_name, party_type, client_roles, entity_type, email, mobile, fica_status, privacy_notice_delivered_at, direct_marketing_consent_at, assigned_to",
          )
          .is("archived_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("user_account")
          .select("id, full_name")
          .eq("status", "active")
          .in("role", ["admin", "agent"])
          .order("full_name"),
      ]);
      if (clientsResult.error) throw clientsResult.error;
      if (usersResult.error) throw usersResult.error;
      const practitioners = (usersResult.data ?? []) as Practitioner[];
      const practitionerNames = new Map(practitioners.map((user) => [user.id, user.full_name]));
      const clients = (clientsResult.data ?? []).map((party): ClientParty => ({
        id: party.id,
        name: party.full_name,
        roles:
          party.client_roles && party.client_roles.length > 0
            ? (party.client_roles as ClientRole[])
            : [party.party_type as ClientRole],
        entityType: party.entity_type as ClientEntityType,
        email: party.email || "—",
        mobile: party.mobile || "—",
        ficaStatus:
          party.fica_status === "complete"
            ? "Complete"
            : party.fica_status === "partial"
              ? "Partial"
              : party.fica_status === "expired"
                ? "Expired"
                : "Not Started",
        privacyNoticeDelivered: Boolean(party.privacy_notice_delivered_at),
        marketingConsent: Boolean(party.direct_marketing_consent_at),
        assignedToName: practitionerNames.get(party.assigned_to ?? "") || "Unassigned",
      }));
      return { clients, practitioners };
    },
  });

  const filteredClients = useMemo(() => {
    const clients = data?.clients ?? [];
    return clients.filter((client) => {
      const needle = search.toLowerCase();
      if (
        needle &&
        !client.name.toLowerCase().includes(needle) &&
        !client.email.toLowerCase().includes(needle) &&
        !client.mobile.toLowerCase().includes(needle)
      ) {
        return false;
      }
      if (typeFilter !== "all" && !client.roles.includes(typeFilter as ClientRole)) return false;
      if (
        ficaFilter !== "all" &&
        client.ficaStatus.toLowerCase().replace(" ", "_") !== ficaFilter
      ) {
        return false;
      }
      return true;
    });
  }, [data?.clients, search, typeFilter, ficaFilter]);

  const updateForm = <K extends keyof ClientCaptureForm>(key: K, value: ClientCaptureForm[K]) => {
    setNewForm((current) => ({ ...current, [key]: value }));
    setFormErrors([]);
  };

  const toggleRole = (role: ClientRole, checked: boolean) => {
    updateForm(
      "roles",
      checked
        ? [...new Set([...newForm.roles, role])]
        : newForm.roles.filter((item) => item !== role),
    );
  };

  const toggleMarketingChannel = (
    channel: ClientCaptureForm["directMarketingChannels"][number],
    checked: boolean,
  ) => {
    updateForm(
      "directMarketingChannels",
      checked
        ? [...new Set([...newForm.directMarketingChannels, channel])]
        : newForm.directMarketingChannels.filter((item) => item !== channel),
    );
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setNewForm(createInitialClientCapture());
    setFormErrors([]);
  };

  const handleAddClient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to add clients.");
    const errors = validateClientCapture(newForm);
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setIsSubmitting(true);
    toast.loading("Saving client securely…", { id: "add-client" });
    try {
      const { error } = await supabase.rpc("create_client", { p_payload: newForm });
      if (error) throw error;
      await refetch();
      closeAddModal();
      toast.success(
        newForm.startFica
          ? "Client saved; FICA onboarding is in progress."
          : "Client contact saved.",
        {
          id: "add-client",
        },
      );
    } catch (error) {
      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "The client could not be saved.";
      toast.error(message, { id: "add-client" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      title="Client CRM Directory"
      description="Capture client relationships with staged POPIA and FICA onboarding controls."
      crumbs={[{ label: "Clients" }]}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or mobile…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-35">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleOptions.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ficaFilter} onValueChange={setFicaFilter}>
            <SelectTrigger className="w-37.5">
              <SelectValue placeholder="FICA status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All FICA</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="partial">In progress</SelectItem>
              <SelectItem value="not_started">Not started</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={isReadOnly}
          onClick={() => setAddModalOpen(true)}
          className="gap-1.5 font-semibold"
        >
          <Plus className="size-4" /> {isReadOnly ? "Add Client (Read-Only)" : "Add Client"}
        </Button>
      </div>

      <GlassCard>
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : filteredClients.length === 0 ? (
          <EmptyState title="No clients found" message="No client contacts match your filters." />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>FICA</TableHead>
                  <TableHead>Privacy</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-semibold">{client.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {titleCase(client.entityType)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-48 flex-wrap gap-1">
                        {client.roles.map((role) => (
                          <Badge key={role} variant="outline" className="text-xs">
                            {titleCase(role)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="space-y-0.5 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="size-3" /> {client.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3" /> {client.mobile}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{client.assignedToName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          client.ficaStatus === "Complete"
                            ? "bg-success/15 text-success border-success/30"
                            : client.ficaStatus === "Partial"
                              ? "bg-warning/15 text-warning border-warning/30"
                              : "bg-muted text-muted-foreground"
                        }
                      >
                        {client.ficaStatus === "Partial" ? "In Progress" : client.ficaStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {client.privacyNoticeDelivered ? (
                        <div className="space-y-0.5 text-xs">
                          <span className="flex items-center gap-1 text-success font-medium">
                            <CheckCircle2 className="size-3.5" /> Notice delivered
                          </span>
                          <span className="text-muted-foreground">
                            Marketing: {client.marketingConsent ? "opted in" : "not opted in"}
                          </span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="size-3.5" /> Notice missing
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => {
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

      <Dialog
        open={addModalOpen}
        onOpenChange={(open) => (open ? setAddModalOpen(true) : closeAddModal())}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add client</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Capture a minimal contact, or start compliant FICA onboarding when a business
              relationship is being established.
            </p>
          </DialogHeader>
          <form onSubmit={handleAddClient} className="space-y-5">
            <FieldErrorSummary errors={formErrors} />

            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Client and relationship</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Full legal or registered name *</Label>
                  <Input
                    value={newForm.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Entity type *</Label>
                  <Select
                    value={newForm.entityType}
                    onValueChange={(value) => updateForm("entityType", value as ClientEntityType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {entityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Acquisition source</Label>
                  <Input
                    placeholder="Referral, portal, walk-in…"
                    value={newForm.acquisitionSource}
                    onChange={(event) => updateForm("acquisitionSource", event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Client role(s) *</Label>
                  <div className="flex flex-wrap gap-4">
                    {roleOptions.map((role) => (
                      <label key={role.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={newForm.roles.includes(role.value)}
                          onCheckedChange={(checked) => toggleRole(role.value, checked === true)}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Assigned practitioner</Label>
                  <Select
                    value={newForm.assignedTo || "self"}
                    onValueChange={(value) =>
                      updateForm("assignedTo", value === "self" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">Me</SelectItem>
                      {data?.practitioners.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Contact language</Label>
                  <Input
                    value={newForm.contactLanguage}
                    onChange={(event) => updateForm("contactLanguage", event.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">Contact preferences</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newForm.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Mobile</Label>
                  <Input
                    placeholder="+27…"
                    value={newForm.mobile}
                    onChange={(event) => updateForm("mobile", event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Preferred contact</Label>
                  <Select
                    value={newForm.preferredContactChannel}
                    onValueChange={(value) =>
                      updateForm(
                        "preferredContactChannel",
                        value as ClientCaptureForm["preferredContactChannel"],
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold">POPIA record</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Reason for processing *</Label>
                  <Select
                    value={newForm.processingBasis}
                    onValueChange={(value) =>
                      updateForm("processingBasis", value as ClientCaptureForm["processingBasis"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="requested_service">Service requested by client</SelectItem>
                      <SelectItem value="mandate_contract">Mandate or contract</SelectItem>
                      <SelectItem value="legal_obligation">Legal obligation / FICA</SelectItem>
                      <SelectItem value="consent">Client consent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
                  <Checkbox
                    checked={newForm.privacyNoticeDelivered}
                    onCheckedChange={(checked) =>
                      updateForm("privacyNoticeDelivered", checked === true)
                    }
                  />
                  <span>
                    <strong className="block">Privacy notice delivered *</strong>
                    <span className="text-xs text-muted-foreground">
                      Records notification separately from marketing consent.
                    </span>
                  </span>
                </label>
              </div>
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Direct-marketing opt-in</Label>
                    <p className="text-xs text-muted-foreground">
                      Optional. Leave off for ordinary service communications.
                    </p>
                  </div>
                  <Switch
                    checked={newForm.directMarketingConsent}
                    onCheckedChange={(checked) => {
                      updateForm("directMarketingConsent", checked);
                      if (!checked) updateForm("directMarketingChannels", []);
                    }}
                  />
                </div>
                {newForm.directMarketingConsent && (
                  <div className="mt-3 flex flex-wrap gap-4">
                    {(["email", "sms", "whatsapp", "phone"] as const).map((channel) => (
                      <label key={channel} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={newForm.directMarketingChannels.includes(channel)}
                          onCheckedChange={(checked) =>
                            toggleMarketingChannel(channel, checked === true)
                          }
                        />
                        {titleCase(channel)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-4 rounded-md border border-primary/20 bg-primary/5 p-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="size-4 text-primary" /> Start FICA onboarding
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Collect enhanced identity data only when client take-on requires it. New records
                    remain “In Progress” until documents are verified.
                  </p>
                </div>
                <Switch
                  checked={newForm.startFica}
                  onCheckedChange={(checked) => updateForm("startFica", checked)}
                />
              </div>
              {newForm.startFica && (
                <div className="space-y-4 rounded-md border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>
                        {newForm.entityType === "natural_person"
                          ? "SA ID / passport number"
                          : "Registration / trust number"}{" "}
                        *
                      </Label>
                      <Input
                        value={newForm.idNumber}
                        onChange={(event) => updateForm("idNumber", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tax number</Label>
                      <Input
                        value={newForm.taxNumber}
                        onChange={(event) => updateForm("taxNumber", event.target.value)}
                      />
                    </div>
                    {newForm.entityType === "natural_person" ? (
                      <>
                        <div className="space-y-1">
                          <Label>Date of birth *</Label>
                          <Input
                            type="date"
                            value={newForm.dateOfBirth}
                            onChange={(event) => updateForm("dateOfBirth", event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Nationality *</Label>
                          <Input
                            value={newForm.nationality}
                            onChange={(event) => updateForm("nationality", event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Marital status</Label>
                          <Input
                            value={newForm.maritalStatus}
                            onChange={(event) => updateForm("maritalStatus", event.target.value)}
                          />
                        </div>
                        <label className="flex items-center gap-3 pt-6 text-sm">
                          <Switch
                            checked={newForm.isSaResident}
                            onCheckedChange={(checked) => updateForm("isSaResident", checked)}
                          />{" "}
                          South African resident
                        </label>
                        {!newForm.isSaResident && (
                          <>
                            <div className="space-y-1">
                              <Label>Passport number *</Label>
                              <Input
                                value={newForm.passportNumber}
                                onChange={(event) =>
                                  updateForm("passportNumber", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Issuing country *</Label>
                              <Input
                                value={newForm.passportCountry}
                                onChange={(event) =>
                                  updateForm("passportCountry", event.target.value)
                                }
                              />
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <Label>Authorised representative *</Label>
                          <Input
                            value={newForm.representativeName}
                            onChange={(event) =>
                              updateForm("representativeName", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Representative capacity *</Label>
                          <Input
                            placeholder="Trustee, director, executor…"
                            value={newForm.representativeCapacity}
                            onChange={(event) =>
                              updateForm("representativeCapacity", event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label>Beneficial owners / controlling persons *</Label>
                          <Textarea
                            value={newForm.beneficialOwnerDetails}
                            onChange={(event) =>
                              updateForm("beneficialOwnerDetails", event.target.value)
                            }
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Residential / registered address *</Label>
                      <Input
                        value={newForm.addressLine}
                        onChange={(event) => updateForm("addressLine", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Suburb</Label>
                      <Input
                        value={newForm.suburb}
                        onChange={(event) => updateForm("suburb", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>City *</Label>
                      <Input
                        value={newForm.city}
                        onChange={(event) => updateForm("city", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Province *</Label>
                      <Input
                        value={newForm.province}
                        onChange={(event) => updateForm("province", event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Postal code</Label>
                      <Input
                        value={newForm.postalCode}
                        onChange={(event) => updateForm("postalCode", event.target.value)}
                      />
                    </div>
                    {newForm.roles.includes("purchaser") && (
                      <div className="space-y-1 sm:col-span-2">
                        <Label>Purchaser source of funds *</Label>
                        <Textarea
                          placeholder="Deposit source, bond, sale proceeds, gift…"
                          value={newForm.sourceOfFunds}
                          onChange={(event) => updateForm("sourceOfFunds", event.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label>Client risk rating *</Label>
                      <Select
                        value={newForm.riskRating}
                        onValueChange={(value) =>
                          updateForm("riskRating", value as ClientCaptureForm["riskRating"])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 pt-1">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={newForm.sanctionsScreened}
                          onCheckedChange={(checked) =>
                            updateForm("sanctionsScreened", checked === true)
                          }
                        />{" "}
                        TFS screening completed — no match *
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={newForm.prominentPersonScreened}
                          onCheckedChange={(checked) =>
                            updateForm("prominentPersonScreened", checked === true)
                          }
                        />{" "}
                        Prominent-person screening completed *
                      </label>
                      <label className="flex items-center gap-2 pl-6 text-sm">
                        <Checkbox
                          checked={newForm.isProminentPerson}
                          onCheckedChange={(checked) =>
                            updateForm("isProminentPerson", checked === true)
                          }
                        />{" "}
                        Screening identified a prominent person
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <div className="space-y-1">
              <Label>Internal onboarding notes</Label>
              <Textarea
                value={newForm.onboardingNotes}
                onChange={(event) => updateForm("onboardingNotes", event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAddModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isReadOnly}>
                {isSubmitting
                  ? "Saving…"
                  : newForm.startFica
                    ? "Save & Start FICA"
                    : "Save Contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <QuickDealModal open={dealModalOpen} onOpenChange={setDealModalOpen} />
    </AppShell>
  );
}
