import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, GlassCard, TableSkeleton } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
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
import { useAuth } from "@/lib/auth";
import { getR2FileUrl } from "@/lib/storage";
import { useDocuments, useUploadDocument } from "@/data/documents";
import { usePipelineDeals } from "@/data/deals";
import { useGeneratePdfDocument } from "@/data/pdf-generate";
import { getPdfDocumentType } from "@/lib/pdf-document-types";
import { dateFmt, dateTimeFmt } from "@/lib/format";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents | Dream Supreme Properties" }] }),
  component: DocumentsPage,
});

const categories = [
  "mandate",
  "otp",
  "fica_id",
  "fica_proof_of_address",
  "title_deed",
  "municipal_account",
  "bond_grant_letter",
  "compliance_electrical",
  "commission_statement",
  "other",
];

async function download(storageKey: string, filename: string) {
  try {
    const url = await getR2FileUrl(storageKey);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Download failed");
  }
}

// The only PDF document type that's fully mergeable from the lightweight
// pipeline-deal data available on this page — the others (Offer to Purchase,
// Mandate Agreement) need seller/purchaser/mandate fields this query doesn't
// fetch, and generating a document with those left blank would be worse than
// not offering it here at all.
const GENERATABLE_DOCUMENT_TYPE = "deal_registration_certificate";

function DocumentsPage() {
  const { activeAccount, isReadOnly } = useAuth();
  const dealsQuery = usePipelineDeals();
  const [dealId, setDealId] = useState("");
  const [category, setCategory] = useState("other");
  const fileInput = useRef<HTMLInputElement>(null);
  const documentsQuery = useDocuments(dealId || undefined);
  const upload = useUploadDocument();
  const generatePdf = useGeneratePdfDocument();
  const deals = dealsQuery.data ?? [];
  const selectedDeal = deals.find((deal) => deal.id === dealId);
  const generatableDoc = getPdfDocumentType(GENERATABLE_DOCUMENT_TYPE)!;

  async function uploadFile(file: File) {
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to upload documents.");
    if (!activeAccount?.agencyId || !dealId) return toast.error("Select a deal first.");
    try {
      await upload.mutateAsync({ file, dealId, category, agencyId: activeAccount.agencyId });
      toast.success(`${file.name} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function generate() {
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to generate documents.");
    if (!selectedDeal) return toast.error("Select a deal first.");
    const filename = `deal_registration_certificate_${selectedDeal.ref}.pdf`;
    try {
      await generatePdf.mutateAsync({
        documentType: GENERATABLE_DOCUMENT_TYPE,
        dealId: selectedDeal.id,
        filename,
        inputs: {
          dealReference: selectedDeal.ref,
          propertyAddress: selectedDeal.property.address,
          salePrice: `R ${(selectedDeal.salePrice / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`,
          registrationDate: dateFmt(new Date().toISOString()),
          agentName: selectedDeal.agent.name,
        },
      });
      toast.success(`${filename} generated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate the document.");
    }
  }

  return (
    <AppShell title="Documents" description="Files stored securely against live deals.">
      <GlassCard className="mb-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
          <Select value={dealId} onValueChange={setDealId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a deal" />
            </SelectTrigger>
            <SelectContent>
              {deals.map((deal) => (
                <SelectItem key={deal.id} value={deal.id}>
                  {deal.ref} — {deal.property.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((item) => (
                <SelectItem key={item} value={item}>
                  {item.replaceAll("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileInput}
            className="hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
              event.target.value = "";
            }}
          />
          <Button
            disabled={!dealId || upload.isPending || isReadOnly}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="size-4" />{" "}
            {isReadOnly ? "Upload (Read-Only)" : upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </GlassCard>

      {!dealId ? (
        <GlassCard>
          <EmptyState title="Select a deal" message="Documents are isolated by deal and agency." />
        </GlassCard>
      ) : documentsQuery.isLoading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : documentsQuery.isError ? (
        <GlassCard>
          <EmptyState
            title="Documents unavailable"
            message={
              documentsQuery.error instanceof Error
                ? documentsQuery.error.message
                : "Could not load documents."
            }
          />
        </GlassCard>
      ) : (documentsQuery.data ?? []).length === 0 ? (
        <GlassCard>
          <EmptyState title="No documents" message="Upload the first file for this deal." />
        </GlassCard>
      ) : (
        <GlassCard className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(documentsQuery.data ?? []).map((document: any) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">
                    <FileText className="mr-2 inline size-4" />
                    {document.name}
                  </TableCell>
                  <TableCell>{document.category.replaceAll("_", " ")}</TableCell>
                  <TableCell>v{document.version}</TableCell>
                  <TableCell>
                    {dateTimeFmt(document.uploadedAt)} · {document.uploadedBy}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void download(document.storageKey, document.name)}
                    >
                      <Download className="size-4" /> Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCard>
      )}

      <GlassCard className="mt-6">
        <h2 className="font-display text-base font-semibold">Generate from template</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Rendered from the admin-designed PDF template for this document type, uploaded to private
          storage, and recorded as a document.
        </p>
        <div className="rounded-lg border p-3 sm:max-w-xs">
          <p className="font-medium">{generatableDoc.label}</p>
          <p className="text-xs text-muted-foreground">{generatableDoc.description}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            disabled={!dealId || generatePdf.isPending || isReadOnly}
            onClick={() => void generate()}
          >
            {isReadOnly
              ? "Generate (Read-Only)"
              : generatePdf.isPending
                ? "Generating…"
                : "Generate and store"}
          </Button>
        </div>
      </GlassCard>
    </AppShell>
  );
}
