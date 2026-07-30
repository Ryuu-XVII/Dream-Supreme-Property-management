import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, UploadCloud, X, Check } from "lucide-react";
import { GlassCard } from "@/components/ui-kit";
import type { Deal, DocumentRec } from "@/types";
import { uploadFileToR2, getR2FileUrl } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { dateFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DOCUMENT_CATEGORIES = [
  { value: "mandate", label: "Signed Mandate Agreement" },
  { value: "otp", label: "Signed Offer to Purchase" },
  { value: "fica_id", label: "FICA - Identity Document" },
  { value: "fica_proof_of_address", label: "FICA - Proof of Address" },
  { value: "fica_bank_statement", label: "FICA - Bank Statement" },
  { value: "title_deed", label: "Copy of Title Deed" },
  { value: "municipal_account", label: "Municipal Account" },
  { value: "compliance_electrical", label: "Electrical Compliance Cert" },
  { value: "compliance_gas", label: "Gas Compliance Cert" },
  { value: "levy_clearance", label: "Rates and Levy Clearance" },
  { value: "other", label: "Other Document" },
];

const CHECKLIST_REQUIREMENTS = [
  { label: "Signed mandate agreement", categories: ["mandate"] },
  { label: "Signed offer to purchase", categories: ["otp"] },
  { label: "FICA — seller", categories: ["fica_id", "fica_proof_of_address"], requiresPartySide: "Seller" },
  { label: "FICA — purchaser", categories: ["fica_id", "fica_proof_of_address"], requiresPartySide: "Purchaser" },
  { label: "Copy of title deed", categories: ["title_deed"] },
  { label: "Municipal account", categories: ["municipal_account"] },
  { label: "Applicable compliance certificates", categories: ["compliance_electrical", "compliance_gas"] },
  { label: "Rates and levy clearance", categories: ["levy_clearance"] },
];

interface StagedFile {
  id: string;
  file: File;
  category: string;
  partyId?: string;
}

export function DealDocumentsTab({ deal }: { deal: Deal }) {
  const { account } = useAuth();
  const [documents, setDocuments] = useState<DocumentRec[]>(deal.documents || []);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const stageFiles = (files: FileList | File[]) => {
    const newStaged = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      category: "other",
    }));
    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateStagedFile = (id: string, updates: Partial<StagedFile>) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const commitUploads = async () => {
    if (!account) return toast.error("Your company profile is still loading.");
    if (stagedFiles.length === 0) return;
    
    for (const staged of stagedFiles) {
      if (staged.category.startsWith("fica_") && !staged.partyId) {
        return toast.error(`Please select a party for the FICA document: ${staged.file.name}`);
      }
      if (staged.file.size > 20 * 1024 * 1024) {
         return toast.error(`${staged.file.name} exceeds 20MB.`);
      }
    }

    setUploading(true);
    try {
      for (const staged of stagedFiles) {
        const file = staged.file;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const key = `${account.agencyId}/deals/${deal.id}/${crypto.randomUUID()}-${safeName}`;
        await uploadFileToR2(file, key);
        const { data, error } = await supabase
          .from("document")
          .insert({
            agency_id: account.agencyId,
            deal_id: deal.id,
            category: staged.category,
            party_id: staged.partyId || null,
            filename: file.name,
            storage_key: key,
            mime_type: file.type,
            size_bytes: file.size,
            uploaded_by: account.id,
          })
          .select("id, filename, category, version, uploaded_at, size_bytes")
          .single();
        if (error) throw error;
        setDocuments((current) => [
          ...current,
          {
            id: data.id,
            name: data.filename,
            category: data.category,
            version: data.version,
            uploadedBy: account.fullName,
            uploadedAt: data.uploaded_at,
            sizeKb: Math.round((data.size_bytes || 0) / 1024),
            url: key,
            partyId: staged.partyId,
          },
        ]);
      }
      toast.success("Document upload completed.");
      setStagedFiles([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const preview = async (document: DocumentRec) => {
    if (!document.url) return toast.error("This legacy document has no storage key.");
    try {
      setPreviewUrl(await getR2FileUrl(document.url));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preview could not be opened.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <GlassCard>
        <h3 className="mb-3 font-display text-base font-semibold">Required documents</h3>
        <div className="space-y-2">
          {CHECKLIST_REQUIREMENTS.map((req) => {
            const complete = documents.some((doc) => {
               if (!req.categories.includes(doc.category)) return false;
               if (req.requiresPartySide) {
                  const party = deal.parties?.find(p => p.id === doc.partyId);
                  if (!party || party.side !== req.requiresPartySide) return false;
               }
               return true;
            });
            return (
              <div key={req.label} className="flex items-center justify-between gap-2 text-sm">
                <span>{req.label}</span>
                <Badge variant="outline" className={complete ? "border-success/30 bg-success/10 text-success" : ""}>
                  {complete ? "Uploaded" : "Required"}
                </Badge>
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
        
        {/* Upload Area */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            stageFiles(event.dataTransfer.files);
          }}
          className="mb-4 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 hover:bg-muted/30"
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Drop files or click to browse"}
          </span>
          <span className="text-xs text-muted-foreground">PDF, DOCX and images up to 20MB</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              stageFiles(event.target.files);
              event.target.value = ''; 
            }
          }}
        />

        {/* Staging Area */}
        {stagedFiles.length > 0 && (
          <div className="mb-6 rounded-lg border border-border bg-muted/20 p-4">
             <h4 className="mb-3 text-sm font-semibold">Pending Uploads ({stagedFiles.length})</h4>
             <div className="space-y-3">
               {stagedFiles.map((staged) => (
                 <div key={staged.id} className="flex flex-col gap-2 rounded border border-border bg-background p-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                       <FileText className="size-4 shrink-0 text-primary" />
                       <span className="truncate text-sm font-medium">{staged.file.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Select
                         value={staged.category}
                         onValueChange={(val) => updateStagedFile(staged.id, { category: val })}
                       >
                         <SelectTrigger className="h-8 w-45 text-xs">
                           <SelectValue placeholder="Category" />
                         </SelectTrigger>
                         <SelectContent>
                           {DOCUMENT_CATEGORIES.map(c => (
                             <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>

                       {staged.category.startsWith("fica_") && (
                         <Select
                           value={staged.partyId || ""}
                           onValueChange={(val) => updateStagedFile(staged.id, { partyId: val })}
                         >
                           <SelectTrigger className="h-8 w-40 text-xs">
                             <SelectValue placeholder="Select Party" />
                           </SelectTrigger>
                           <SelectContent>
                             {deal.parties?.map(p => (
                               <SelectItem key={p.id} value={p.id} className="text-xs">
                                 {p.name} ({p.side})
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       )}
                       <Button
                         variant="ghost"
                         size="icon"
                         className="size-8 text-muted-foreground hover:text-destructive"
                         onClick={() => removeStagedFile(staged.id)}
                       >
                         <X className="size-4" />
                       </Button>
                    </div>
                 </div>
               ))}
             </div>
             <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setStagedFiles([])} disabled={uploading}>
                   Cancel
                </Button>
                <Button size="sm" onClick={() => void commitUploads()} disabled={uploading}>
                   {uploading ? "Uploading..." : "Upload files"}
                </Button>
             </div>
          </div>
        )}

        {/* Existing Documents List */}
        <div className="space-y-2">
          {documents.length === 0 && stagedFiles.length === 0 && (
             <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
          )}
          {documents.map((document) => {
            const categoryLabel = DOCUMENT_CATEGORIES.find(c => c.value === document.category)?.label || document.category;
            const partyLabel = document.partyId ? deal.parties?.find(p => p.id === document.partyId)?.name : null;
            
            return (
              <button
                type="button"
                key={document.id}
                onClick={() => void preview(document)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/30"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{document.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {categoryLabel} {partyLabel && `· ${partyLabel}`} · v{document.version} · {dateFmt(document.uploadedAt)}
                    </span>
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{document.sizeKb} KB</span>
              </button>
            );
          })}
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
