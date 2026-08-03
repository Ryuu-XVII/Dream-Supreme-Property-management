import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import {
  agency,
  branches as initialBranches,
  conveyancerFirms as initialFirms,
  transferDutyBrackets as initialBrackets,
} from "@/data/mock";
import { dateFmt } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Archive, Building2, Scale, Percent, Landmark } from "lucide-react";

export const Route = createFileRoute("/settings/agency")({
  head: () => ({
    meta: [
      { title: "Agency Profile | Dream Supreme Properties" },
      {
        name: "description",
        content: "Manage agency details, branches, conveyancer firms and transfer duty brackets.",
      },
      { property: "og:title", content: "Agency Profile | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Manage agency details, branches, conveyancer firms and transfer duty brackets.",
      },
    ],
  }),
  component: AgencyProfilePage,
});

const agencySchema = z.object({
  name: z.string().min(2, "Required"),
  registration: z.string().min(2, "Required"),
  ppra: z.string().min(2, "Required"),
  vatNumber: z.string().min(2, "Required"),
  vatVendor: z.boolean(),
  address: z.string().min(5, "Required"),
});

type AgencyForm = z.infer<typeof agencySchema>;

interface Branch {
  id: string;
  name: string;
  address: string;
  archived?: boolean;
}

interface Firm {
  id: string;
  name: string;
  contact: string;
  email: string;
  tel: string;
  preferred: boolean;
}

interface Bracket {
  id: string;
  from: number;
  to: number | null;
  rate: number;
}

function AgencyProfilePage() {
  const [logo, setLogo] = useState<string | null>(null);
  const [branchList, setBranchList] = useState<Branch[]>(
    initialBranches.map((b) => ({ ...b, archived: false })),
  );
  const [firmList, setFirmList] = useState<Firm[]>(initialFirms);
  const [brackets, setBrackets] = useState<Bracket[]>(
    initialBrackets.map((b, i) => ({ id: `br${i}`, from: b.from, to: b.to, rate: b.rate })),
  );
  const [effectiveDate, setEffectiveDate] = useState("2026-03-01");

  const form = useForm<AgencyForm>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      name: agency.name,
      registration: agency.registration,
      ppra: agency.ppra,
      vatNumber: agency.vatNumber,
      vatVendor: agency.vatVendor,
      address: agency.address,
    },
  });

  function onSubmit(values: AgencyForm) {
    toast.success("Agency profile updated", { description: `${values.name} details saved.` });
  }

  function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <AppShell
      title="Settings"
      description="Agency profile, branches, conveyancers and transfer duty configuration."
    >
      <SettingsTabs />
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <GlassCard>
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Agency Details</h2>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex items-center gap-4 sm:col-span-2">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                      {logo ? (
                        <img src={logo} alt="Agency logo" className="size-full object-cover" />
                      ) : (
                        <Building2 className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <Label htmlFor="logo-upload" className="text-xs font-medium">
                        Agency Logo
                      </Label>
                      <Input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogo}
                        className="mt-1 max-w-xs"
                      />
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agency Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="registration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl>
                          <Input {...field} className="money" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ppra"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PPRA Reference</FormLabel>
                        <FormControl>
                          <Input {...field} className="money" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vatNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VAT Number</FormLabel>
                        <FormControl>
                          <Input {...field} className="money" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vatVendor"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <FormLabel className="mb-0">Registered VAT Vendor</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Physical Address</FormLabel>
                        <FormControl>
                          <Textarea rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Save Agency Details</Button>
                </div>
              </form>
            </Form>
          </GlassCard>
        </motion.div>

        <BranchSection branchList={branchList} setBranchList={setBranchList} />
        <ConveyancerSection firmList={firmList} setFirmList={setFirmList} />
        <TransferDutySection
          brackets={brackets}
          setBrackets={setBrackets}
          effectiveDate={effectiveDate}
          setEffectiveDate={setEffectiveDate}
        />
      </div>
    </AppShell>
  );
}

function BranchSection({
  branchList,
  setBranchList,
}: {
  branchList: Branch[];
  setBranchList: React.Dispatch<React.SetStateAction<Branch[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  function startAdd() {
    setEditing(null);
    setName("");
    setAddress("");
    setOpen(true);
  }
  function startEdit(b: Branch) {
    setEditing(b);
    setName(b.name);
    setAddress(b.address);
    setOpen(true);
  }
  function save() {
    if (!name.trim() || !address.trim()) {
      toast.error("Branch name and address are required.");
      return;
    }
    if (editing) {
      setBranchList((prev) => prev.map((b) => (b.id === editing.id ? { ...b, name, address } : b)));
      toast.success("Branch updated", { description: name });
    } else {
      setBranchList((prev) => [...prev, { id: `b${Date.now()}`, name, address }]);
      toast.success("Branch added", { description: name });
    }
    setOpen(false);
  }
  function toggleArchive(b: Branch) {
    setBranchList((prev) => prev.map((x) => (x.id === b.id ? { ...x, archived: !x.archived } : x)));
    toast.success(b.archived ? "Branch restored" : "Branch archived", { description: b.name });
  }

  return (
    <GlassCard>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <h2 className="min-w-0 truncate font-display text-lg font-semibold">Branch Management</h2>
        <Button size="sm" onClick={startAdd} className="shrink-0">
          <Plus className="mr-1 size-4" /> Add Branch
        </Button>
      </div>
      {branchList.length === 0 ? (
        <EmptyState title="No branches" message="Add your first branch to get started." />
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchList.map((b) => (
                <TableRow key={b.id} className={b.archived ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.address}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        b.archived
                          ? "bg-muted text-muted-foreground"
                          : "border-success/30 bg-success/10 text-success"
                      }
                    >
                      {b.archived ? "Archived" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(b)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => toggleArchive(b)}>
                      <Archive className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Branch Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add Branch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}

function ConveyancerSection({
  firmList,
  setFirmList,
}: {
  firmList: Firm[];
  setFirmList: React.Dispatch<React.SetStateAction<Firm[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Firm | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    contact: "",
    email: "",
    tel: "",
    preferred: false,
  });

  function startAdd() {
    setEditing(null);
    setDraft({ name: "", contact: "", email: "", tel: "", preferred: false });
    setOpen(true);
  }
  function startEdit(f: Firm) {
    setEditing(f);
    setDraft({
      name: f.name,
      contact: f.contact,
      email: f.email,
      tel: f.tel,
      preferred: f.preferred,
    });
    setOpen(true);
  }
  function save() {
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.error("Firm name and email are required.");
      return;
    }
    if (editing) {
      setFirmList((prev) => prev.map((f) => (f.id === editing.id ? { ...f, ...draft } : f)));
      toast.success("Conveyancer firm updated", { description: draft.name });
    } else {
      setFirmList((prev) => [...prev, { id: `cf${Date.now()}`, ...draft }]);
      toast.success("Conveyancer firm added", { description: draft.name });
    }
    setOpen(false);
  }

  return (
    <GlassCard>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Scale className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-lg font-semibold">Conveyancer Firms</h2>
        </div>
        <Button size="sm" onClick={startAdd} className="shrink-0">
          <Plus className="mr-1 size-4" /> Add Firm
        </Button>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firm</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telephone</TableHead>
              <TableHead>Preferred</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {firmList.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>{f.contact}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{f.email}</TableCell>
                <TableCell className="money text-sm">{f.tel}</TableCell>
                <TableCell>
                  {f.preferred && (
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      Preferred
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(f)}>
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Firm" : "Add Conveyancer Firm"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Firm Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Contact Person</Label>
              <Input
                value={draft.contact}
                onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  value={draft.email}
                  onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Telephone</Label>
                <Input
                  value={draft.tel}
                  onChange={(e) => setDraft((d) => ({ ...d, tel: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label className="mb-0">Preferred Firm</Label>
              <Switch
                checked={draft.preferred}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, preferred: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add Firm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}

function TransferDutySection({
  brackets,
  setBrackets,
  effectiveDate,
  setEffectiveDate,
}: {
  brackets: Bracket[];
  setBrackets: React.Dispatch<React.SetStateAction<Bracket[]>>;
  effectiveDate: string;
  setEffectiveDate: (d: string) => void;
}) {
  function update(id: string, patch: Partial<Bracket>) {
    setBrackets((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }
  function addBracket() {
    setBrackets((prev) => [...prev, { id: `br${Date.now()}`, from: 0, to: null, rate: 0 }]);
  }
  function removeBracket(id: string) {
    setBrackets((prev) => prev.filter((b) => b.id !== id));
  }
  function saveBrackets() {
    toast.success("Transfer duty brackets saved", {
      description: `Effective ${dateFmt(effectiveDate)}`,
    });
  }

  return (
    <GlassCard>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Landmark className="size-4 shrink-0 text-primary" />
          <h2 className="truncate font-display text-lg font-semibold">Transfer Duty Brackets</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Label className="text-xs text-muted-foreground">Effective from</Label>
          <Select value={effectiveDate} onValueChange={setEffectiveDate}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2025-03-01">01 Mar 2025</SelectItem>
              <SelectItem value="2026-03-01">01 Mar 2026</SelectItem>
              <SelectItem value="2027-03-01">01 Mar 2027</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>From (R)</TableHead>
              <TableHead>To (R)</TableHead>
              <TableHead>
                <span className="inline-flex items-center gap-1">
                  <Percent className="size-3" /> Rate
                </span>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brackets.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <Input
                    type="number"
                    className="money w-32"
                    value={b.from / 100}
                    onChange={(e) =>
                      update(b.id, { from: Math.round(Number(e.target.value) * 100) })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="money w-32"
                    placeholder="No limit"
                    value={b.to != null ? b.to / 100 : ""}
                    onChange={(e) =>
                      update(b.id, {
                        to: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    className="money w-20"
                    value={b.rate}
                    onChange={(e) => update(b.id, { rate: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => removeBracket(b.id)}>
                    <Archive className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" onClick={addBracket}>
          <Plus className="mr-1 size-4" /> Add Bracket
        </Button>
        <Button size="sm" onClick={saveBrackets}>
          Save Brackets
        </Button>
      </div>
    </GlassCard>
  );
}
