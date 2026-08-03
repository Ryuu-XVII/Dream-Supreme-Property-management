import { useState } from "react";
import { toast } from "sonner";
import { GlassCard } from "@/components/ui-kit";
import { propertyById, type Deal } from "@/data/mock";
import { dateFmt } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, FileText, File } from "lucide-react";

const BASE_CHECKLIST = [
  "Signed mandate agreement",
  "Signed offer to purchase",
  "FICA — seller",
  "FICA — purchaser",
  "Compliance certificates (electrical, gas, plumbing)",
  "Rates & taxes clearance certificate",
  "Transfer duty receipt / exemption",
  "Bond guarantee (if applicable)",
];

const SECTIONAL_EXTRAS = [
  "Body corporate consent to transfer",
  "Levy clearance certificate",
  "Conduct rules acknowledgement",
];

export function DealDocumentsTab({ deal }: { deal: Deal }) {
  const property = propertyById(deal.propertyId);
  const checklist =
    property?.type === "Sectional Title"
      ? [...BASE_CHECKLIST, ...SECTIONAL_EXTRAS]
      : BASE_CHECKLIST;
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(checklist.map((item, i) => [item, i < 3])),
  );
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Document checklist</h3>
        <div className="space-y-2.5">
          {checklist.map((item) => (
            <label key={item} className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                checked={!!checked[item]}
                onCheckedChange={(v) => setChecked((c) => ({ ...c, [item]: !!v }))}
                className="mt-0.5"
              />
              <span className={checked[item] ? "text-muted-foreground line-through" : ""}>
                {item}
              </span>
            </label>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold">Uploaded documents</h3>
          <Badge variant="outline">{deal.documents.length} files</Badge>
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            toast.success(`${e.dataTransfer.files?.length || 1} file(s) queued for upload`);
          }}
          className={`mb-4 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop documents here</p>
          <p className="text-xs text-muted-foreground">
            or click to browse — PDF, DOCX, JPG up to 20MB
          </p>
        </div>
        <div className="space-y-2">
          {deal.documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.category} · v{doc.version} · {doc.uploadedBy} · {dateFmt(doc.uploadedAt)}
                  </p>
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{doc.sizeKb} KB</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="lg:col-span-3">
        <h3 className="mb-3 font-display text-base font-semibold">Preview</h3>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 py-16 text-center">
          <File className="size-12 text-muted-foreground" />
          <p className="text-sm font-medium">{deal.documents[0]?.name ?? "No document selected"}</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Select a document from the list above to preview it here. PDF rendering is simulated in
            this demo environment.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
