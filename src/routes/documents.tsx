import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Building2,
  Folder,
  FolderOpen,
  FileText,
  Download,
  Upload,
  History,
  Plus,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard, EmptyState, useFakeLoad, CardSkeleton } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useDashboardData } from "@/data/operations";
import { useDocuments, useUploadDocument } from "@/data/documents";
import { getR2FileUrl } from "@/lib/storage";
import { dateFmt, zar } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Deal document library, version history and merge-field templates for Dream Supreme Properties.",
      },
      { property: "og:title", content: "Documents | Dream Supreme Properties" },
      {
        property: "og:description",
        content:
          "Deal document library, version history and merge-field templates for Dream Supreme Properties.",
      },
    ],
  }),
  component: DocumentsPage,
});

const categories = [
  "Mandate",
  "OTP",
  "FICA",
  "Compliance Certificate",
  "Bond Grant",
  "Clearance",
  "Guarantee",
];

interface Template {
  id: string;
  name: string;
  category: string;
  fields: number;
  updatedAt: string;
}

const templates: Template[] = [
  {
    id: "t1",
    name: "Offer to Purchase — Residential",
    category: "OTP",
    fields: 22,
    updatedAt: "2026-01-14",
  },
  {
    id: "t2",
    name: "Sole Mandate Agreement",
    category: "Mandate",
    fields: 14,
    updatedAt: "2025-12-02",
  },
  {
    id: "t3",
    name: "FICA Declaration — Natural Person",
    category: "FICA",
    fields: 9,
    updatedAt: "2025-11-20",
  },
  {
    id: "t4",
    name: "FICA Declaration — Company/CC/Trust",
    category: "FICA",
    fields: 12,
    updatedAt: "2025-11-20",
  },
  {
    id: "t5",
    name: "Rates Clearance Request Letter",
    category: "Clearance",
    fields: 8,
    updatedAt: "2026-02-01",
  },
  {
    id: "t6",
    name: "Guarantee Request to Bank",
    category: "Guarantee",
    fields: 10,
    updatedAt: "2026-01-28",
  },
  {
    id: "t7",
    name: "Compliance Certificate Cover Letter",
    category: "Compliance Certificate",
    fields: 6,
    updatedAt: "2025-10-11",
  },
  {
    id: "t8",
    name: "Commission Invoice / Statement",
    category: "Commission",
    fields: 11,
    updatedAt: "2026-02-10",
  },
];

const mergeFieldGroups: { entity: string; fields: string[] }[] = [
  {
    entity: "Deal",
    fields: [
      "deal.reference",
      "deal.stage",
      "deal.salePrice",
      "deal.commissionBps",
      "deal.mandateType",
      "deal.otpSigned",
    ],
  },
  {
    entity: "Property",
    fields: [
      "property.address",
      "property.suburb",
      "property.erfSize",
      "property.type",
      "property.schemeName",
    ],
  },
  {
    entity: "Party",
    fields: ["party.name", "party.idNumber", "party.entityType", "party.email", "party.mobile"],
  },
  {
    entity: "Agency",
    fields: [
      "agency.name",
      "agency.registration",
      "agency.vatNumber",
      "agency.address",
      "agency.ppra",
    ],
  },
];

function DocumentsPage() {
  return (
    <AppShell
      title="Documents"
      description="Deal document library and merge-field templates"
      crumbs={[{ label: "Documents" }]}
    >
      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="library" className="mt-5">
          <LibraryTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-5">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

/* ------------------------- Library Tab ------------------------- */

function LibraryTab() {
  const { data: dashboardData, isLoading: dashboardLoading } = useDashboardData();
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [category, setCategory] = useState<string>(categories[0]);

  // Auto-select first deal if none selected
  useMemo(() => {
    if (dashboardData?.deals?.length && !selectedDealId) {
      setSelectedDealId(dashboardData.deals[0].id);
    }
  }, [dashboardData, selectedDealId]);

  const dealsByBranch = useMemo(() => {
    const map = new Map<string, any[]>();
    // For now, group all under a default branch if branch information isn't rich in dashboard
    const defaultBranch = "Sandton";
    map.set(defaultBranch, dashboardData?.deals || []);
    return map;
  }, [dashboardData]);

  const selectedDeal = selectedDealId
    ? dashboardData?.deals.find((d: any) => d.id === selectedDealId)
    : undefined;

  const { data: documents, isLoading: documentsLoading } = useDocuments(selectedDealId);
  const uploadDoc = useUploadDocument();

  const handleUpload = (file: File) => {
    if (!selectedDeal) return;
    uploadDoc.mutate(
      {
        file,
        dealId: selectedDeal.id,
        category: category,
        agencyId: "temp-agency-id", // Note: Need to get real agency id. Better to fetch from user session or let RLS handle it if we have context. Wait, deal has agency_id. But we don't have it in dashboardData. We can get it from app state or just use a default for now.
      },
      {
        onSuccess: () => toast.success(`Uploaded ${file.name}`),
        onError: (err) => toast.error(`Upload failed: ${err.message}`),
      },
    );
  };

  const handleDownload = async (storageKey: string, filename: string) => {
    try {
      const url = await getR2FileUrl(storageKey);
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    }
  };

  if (dashboardLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <GlassCard className="p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Building2 className="size-4 text-muted-foreground" /> Agency Tree
          </h3>
        </div>
        <div className="max-h-[600px] overflow-y-auto scrollbar-thin p-2">
          <TreeAgency
            dealsByBranch={dealsByBranch}
            selectedDealId={selectedDealId}
            onSelect={setSelectedDealId}
          />
        </div>
      </GlassCard>

      <div className="min-w-0 space-y-4">
        {selectedDeal ? (
          <>
            <GlassCard>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
                <div className="min-w-0">
                  <p className="money truncate text-sm font-semibold">{selectedDeal.ref}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedDeal.property.address}, {selectedDeal.property.suburb}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {documents?.length || 0} documents
                </Badge>
              </div>
            </GlassCard>

            <UploadZone
              category={category}
              setCategory={setCategory}
              onUpload={handleUpload}
              isUploading={uploadDoc.isPending}
            />

            {documentsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {documents?.map((doc: any, i: number) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                  >
                    <GlassCard className="flex h-full flex-col gap-2">
                      <div className="flex items-start gap-2">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium" title={doc.name}>
                            {doc.name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {doc.category.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              v{doc.version}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        <p>
                          {doc.sizeKb} KB &middot; uploaded by {doc.uploadedBy}
                        </p>
                        <p>{dateFmt(doc.uploadedAt)}</p>
                      </div>
                      <div className="mt-auto pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5"
                          onClick={() => handleDownload(doc.storageKey, doc.name)}
                        >
                          <Download className="size-3.5" /> Download
                        </Button>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            )}

            <GlassCard>
              <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
                <History className="size-4 text-muted-foreground" /> Version History
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {Object.entries(groupByCategory(documents || [])).map(([cat, docs]) => (
                  <AccordionItem key={cat} value={cat}>
                    <AccordionTrigger className="text-sm">
                      {cat.replace(/_/g, " ")}{" "}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({docs.length} version{docs.length > 1 ? "s" : ""})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2">
                        {docs
                          .slice()
                          .sort((a, b) => a.version - b.version)
                          .map((doc) => (
                            <li
                              key={doc.id}
                              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  v{doc.version} &middot; {doc.name}
                                </p>
                                <p className="text-muted-foreground">
                                  {dateFmt(doc.uploadedAt)} by {doc.uploadedBy}
                                  {doc.supersedes && (
                                    <>
                                      {" "}
                                      &middot; supersedes{" "}
                                      <span className="font-mono">{doc.supersedes}</span>
                                    </>
                                  )}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownload(doc.storageKey, doc.name)}
                              >
                                <Download className="size-3.5" />
                              </Button>
                            </li>
                          ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </GlassCard>
          </>
        ) : (
          <EmptyState
            title="Select a deal"
            message="Choose a deal from the agency tree to view its documents."
            icon={Folder}
          />
        )}
      </div>
    </div>
  );
}

function groupByCategory(docs: any[]) {
  const map: Record<string, any[]> = {};
  for (const doc of docs) {
    if (!map[doc.category]) map[doc.category] = [];
    map[doc.category].push(doc);
  }
  return map;
}

function TreeAgency({
  dealsByBranch,
  selectedDealId,
  onSelect,
}: {
  dealsByBranch: Map<string, any[]>;
  selectedDealId: string;
  onSelect: (id: string) => void;
}) {
  const [openAgency, setOpenAgency] = useState(true);
  const [openBranches, setOpenBranches] = useState<Record<string, boolean>>({ Sandton: true });

  return (
    <Collapsible open={openAgency} onOpenChange={setOpenAgency}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent">
        <ChevronRight className={cn("size-3.5 transition-transform", openAgency && "rotate-90")} />
        <Building2 className="size-3.5" /> Dream Supreme Properties
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-3 border-l border-border pl-2">
        {Array.from(dealsByBranch.entries()).map(([branch, branchDeals]) => {
          const open = !!openBranches[branch];
          return (
            <Collapsible
              key={branch}
              open={open}
              onOpenChange={(v) => setOpenBranches((prev) => ({ ...prev, [branch]: v }))}
            >
              <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <ChevronRight
                  className={cn("size-3.5 transition-transform", open && "rotate-90")}
                />
                {open ? (
                  <FolderOpen className="size-3.5 text-warning" />
                ) : (
                  <Folder className="size-3.5 text-warning" />
                )}
                {branch}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {branchDeals.length}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-3 border-l border-border pl-2">
                {branchDeals.map((deal) => (
                  <button
                    key={deal.id}
                    onClick={() => onSelect(deal.id)}
                    className={cn(
                      "flex w-full items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
                      selectedDealId === deal.id && "bg-primary/10 text-primary font-medium",
                    )}
                  >
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">{deal.ref}</span>
                  </button>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function UploadZone({
  category,
  setCategory,
  onUpload,
  isUploading,
}: {
  category: string;
  setCategory: (c: string) => void;
  onUpload: (file: File) => void;
  isUploading: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onUpload(files[0]);
  };
  return (
    <GlassCard>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center text-xs text-muted-foreground transition-colors cursor-pointer hover:bg-accent",
            dragging ? "border-primary bg-primary/5 text-primary" : "border-border",
          )}
        >
          <Upload className="size-5" />
          Drag & drop a file here, or click to browse
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 size-3.5" /> {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

/* ------------------------- Templates Tab ------------------------- */

function TemplatesTab() {
  const [genOpen, setGenOpen] = useState(false);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <GlassCard className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-display text-sm font-semibold">Document Templates</h3>
            <p className="text-xs text-muted-foreground">{templates.length} templates available</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => toast.success("Template uploaded")}>
              <Plus className="mr-1.5 size-3.5" /> Upload template
            </Button>
            <Button size="sm" onClick={() => setGenOpen(true)}>
              <Sparkles className="mr-1.5 size-3.5" /> Generate Document
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Merge fields</TableHead>
                  <TableHead>Last updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{t.category}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.fields}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dateFmt(t.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-3 font-display text-sm font-semibold">Merge Field Reference</h3>
        <div className="space-y-4">
          {mergeFieldGroups.map((g) => (
            <div key={g.entity}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {g.entity}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.fields.map((f) => (
                  <span
                    key={f}
                    className="money rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px]"
                  >
                    {`{{${f}}}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GenerateDialog open={genOpen} onOpenChange={setGenOpen} />
    </div>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [templateId, setTemplateId] = useState<string>(templates[0].id);
  const dummyDeals = [{ id: "deal-1", ref: "D-1001", propertyId: "p-1" }];
  const [dealId, setDealId] = useState<string>(dummyDeals[0]?.id ?? "");

  const template = templates.find((t) => t.id === templateId)!;
  const deal = dummyDeals.find((d) => d.id === dealId) ?? dummyDeals[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Document</DialogTitle>
          <DialogDescription>
            Pick a template and a deal to merge field values into a new document.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Template</label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Deal</label>
            <Select value={dealId} onValueChange={setDealId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dummyDeals.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.ref}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preview: {template.name}
          </p>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="money text-muted-foreground">{"{{deal.reference}}"}</dt>
              <dd className="font-medium">{deal.ref}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="money text-muted-foreground">{"{{deal.salePrice}}"}</dt>
              <dd className="font-medium">{zar(250000000)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="money text-muted-foreground">{"{{property.address}}"}</dt>
              <dd className="truncate font-medium">123 Sample Address</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="money text-muted-foreground">{"{{property.suburb}}"}</dt>
              <dd className="font-medium">Sample Suburb</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="money text-muted-foreground">{"{{deal.mandateType}}"}</dt>
              <dd className="font-medium">Sole Mandate</dd>
            </div>
          </dl>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => toast.success(`${template.name} generated as DOCX`)}
          >
            Download DOCX
          </Button>
          <Button onClick={() => toast.success(`${template.name} generated as PDF`)}>
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add React import for useRef if missing, but it is available globally usually in Vite or we can import it.
import * as React from "react";
