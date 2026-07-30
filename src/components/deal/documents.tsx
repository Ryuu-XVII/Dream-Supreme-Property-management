import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, UploadCloud } from "lucide-react";
import { GlassCard } from "@/components/ui-kit";
import type { Deal, DocumentRec } from "@/types";
import { useDocuments, useUploadDocument } from "@/data/documents";
import { getR2FileUrl } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { dateFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const CHECKLIST = [
  "Signed mandate agreement",
  "Signed offer to purchase",
  "FICA — seller",
  "FICA — purchaser",
  "Copy of title deed",
  "Municipal account",
  "Applicable compliance certificates",
  "Rates and levy clearance",
  "Transfer duty receipt or VAT confirmation",
  "Guarantees",
];

export function DealDocumentsTab({ deal }: { deal: Deal }) {
  const { account } = useAuth();
  const { data: documents = [], isLoading } = useDocuments(deal.id);
  const uploadDoc = useUploadDocument();
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!account) return toast.error("Your company profile is still loading.");

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 20MB.`);
        continue;
      }

      uploadDoc.mutate(
        {
          file,
          dealId: deal.id,
          category: "other",
          agencyId: account.agencyId,
        },
        {
          onSuccess: () => toast.success(`Uploaded ${file.name}`),
          onError: (err) => toast.error(`Failed to upload ${file.name}: ${err.message}`),
        },
      );
    }
  };

  const preview = async (document: any) => {
    if (!document.storageKey && !document.url)
      return toast.error("This legacy document has no storage key.");
    try {
      setPreviewUrl(await getR2FileUrl(document.storageKey || document.url));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview could not be opened.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Required documents</h3>
        <div className="space-y-2">
          {CHECKLIST.map((label) => {
            const complete = documents.some((document) =>
              document.name.toLowerCase().includes(label.split(" ")[0].toLowerCase()),
            );
            return (
              <div key={label} className="flex items-center justify-between gap-2 text-sm">
                <span>{label}</span>
                <Badge variant="outline">{complete ? "Uploaded" : "Required"}</Badge>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Deal documents</h3>
          <Badge variant="outline">{documents.length} files</Badge>
        </div>
        <button
          type="button"
          disabled={uploadDoc.isPending}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void uploadFiles(event.dataTransfer.files);
          }}
          className="mb-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8"
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            {uploadDoc.isPending ? "Uploading…" : "Drop files or click to browse"}
          </span>
          <span className="text-xs text-muted-foreground">PDF, DOCX and images up to 20MB</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(event) => event.target.files && void uploadFiles(event.target.files)}
        />
        <div className="space-y-2">
          {documents.map((document) => (
            <button
              type="button"
              key={document.id}
              onClick={() => void preview(document)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{document.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {document.category} · v{document.version} · {dateFmt(document.uploadedAt)}
                  </span>
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{document.sizeKb} KB</span>
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-3">
        <h3 className="mb-3 font-display text-base font-semibold">Secure preview</h3>
        {previewUrl ? (
          <iframe
            title="Document preview"
            src={previewUrl}
            className="h-[70vh] w-full rounded-lg border border-border"
          />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Select a document to open a five-minute signed preview.
          </p>
        )}
      </GlassCard>
    </div>
  );
}
