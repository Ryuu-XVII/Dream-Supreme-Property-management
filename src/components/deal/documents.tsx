import { useRef, useState } from "react";
import { Download, FileText, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { GlassCard, EmptyState } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Deal } from "@/types";
import { useDocuments, useUploadDocument } from "@/data/documents";
import { useAuth } from "@/lib/auth";
import { getR2FileUrl } from "@/lib/storage";
import { dateFmt } from "@/lib/format";

const categories = [
  "mandate",
  "otp",
  "fica_id",
  "fica_proof_of_address",
  "title_deed",
  "municipal_account",
  "bond_grant_letter",
  "compliance_electrical",
  "other",
];

export function DealDocumentsTab({ deal }: { deal: Deal }) {
  const { account } = useAuth();
  const documents = useDocuments(deal.id);
  const upload = useUploadDocument();
  const [category, setCategory] = useState("other");
  const input = useRef<HTMLInputElement>(null);
  async function uploadFile(file: File) {
    if (!account) return;
    try {
      await upload.mutateAsync({ file, dealId: deal.id, category, agencyId: account.agencyId });
      toast.success(`${file.name} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }
  async function download(key: string, filename: string) {
    try {
      const url = await getR2FileUrl(key);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      anchor.click();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  }
  const rows = documents.data ?? [];
  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Deal documents</h3>
          <p className="text-xs text-muted-foreground">
            Files are uploaded to private storage and recorded against this deal.
          </p>
        </div>
        <Badge variant="outline">{rows.length} files</Badge>
      </div>
      <div className="mb-5 grid gap-2 sm:grid-cols-[220px_auto]">
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
          ref={input}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadFile(file);
            event.target.value = "";
          }}
        />
        <Button disabled={upload.isPending} onClick={() => input.current?.click()}>
          <UploadCloud className="size-4" /> {upload.isPending ? "Uploading…" : "Upload document"}
        </Button>
      </div>
      {documents.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : documents.isError ? (
        <EmptyState
          title="Documents unavailable"
          message={
            documents.error instanceof Error ? documents.error.message : "Could not load documents."
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No documents" message="Upload the first document for this deal." />
      ) : (
        <div className="space-y-2">
          {rows.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  <FileText className="mr-2 inline size-4 text-primary" />
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.category.replaceAll("_", " ")} · v{item.version} ·{" "}
                  {dateFmt(item.uploadedAt)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void download(item.storageKey, item.name)}
              >
                <Download className="size-4" /> Download
              </Button>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
