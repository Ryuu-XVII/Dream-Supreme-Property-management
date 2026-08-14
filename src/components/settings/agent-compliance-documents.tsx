import { useState } from "react";
import { toast } from "sonner";
import {
  Award,
  FileCheck2,
  FileText,
  UploadCloud,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  HardDrive,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { GlassCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useUserComplianceDocuments,
  useUploadUserComplianceDocument,
  useDeleteUserComplianceDocument,
  type UserComplianceDocumentRecord,
} from "@/data/documents";
import { useAuth } from "@/lib/auth";
import { getR2FileUrl } from "@/lib/storage";
import { dateFmt, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RequiredDocConfig {
  id: string;
  category: string;
  title: string;
  description: string;
  requirement:
    "Mandatory (PPA Act)" | "Mandatory (FICA)" | "Required (Disbursements)" | "Regulatory";
  isFfc?: boolean;
}

const REQUIRED_DOCUMENTS: RequiredDocConfig[] = [
  {
    id: "ffc",
    category: "ffc_certificate",
    title: "Fidelity Fund Certificate (FFC)",
    description: "PPRA-issued certificate authorizing property practice (PPA Section 48).",
    requirement: "Mandatory (PPA Act)",
    isFfc: true,
  },
  {
    id: "fica_id",
    category: "fica_id",
    title: "Certified National ID / Passport",
    description:
      "Certified copy of South African ID card/book or valid Passport (FICA verification).",
    requirement: "Mandatory (FICA)",
  },
  {
    id: "fica_address",
    category: "fica_proof_of_address",
    title: "Proof of Residential Address",
    description: "Utility bill, municipal statement, or bank letter less than 3 months old.",
    requirement: "Mandatory (FICA)",
  },
  {
    id: "bank_confirmation",
    category: "fica_bank_statement",
    title: "Bank Account Confirmation Letter",
    description: "Official bank-stamped letter for commission EFT release and trust disbursements.",
    requirement: "Required (Disbursements)",
  },
  {
    id: "tax_clearance",
    category: "other",
    title: "SARS Tax Number / Clearance PIN",
    description: "SARS Notice of Registration or Tax Compliance Status PIN document.",
    requirement: "Regulatory",
  },
  {
    id: "pde_qualifications",
    category: "other",
    title: "Qualifications / PDE Logbook",
    description: "NQF4 Real Estate Certificate, PDE4 exam results, or Candidate Logbook.",
    requirement: "Regulatory",
  },
];

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function AgentComplianceDocuments() {
  const { account, isReadOnly } = useAuth();
  const userId = account?.id;
  const agencyId = account?.agencyId;

  const { data, isLoading } = useUserComplianceDocuments(userId);
  const uploadMutation = useUploadUserComplianceDocument();
  const deleteMutation = useDeleteUserComplianceDocument();

  const [activeUploadDoc, setActiveUploadDoc] = useState<RequiredDocConfig | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ffcNumber, setFfcNumber] = useState("");
  const [ffcIssued, setFfcIssued] = useState("");
  const [ffcExpiry, setFfcExpiry] = useState("");
  const [ppraRef, setPpraRef] = useState("");
  const [viewingUrl, setViewingUrl] = useState<string | null>(null);

  const openUploadModal = (docConfig: RequiredDocConfig) => {
    setActiveUploadDoc(docConfig);
    setSelectedFile(null);
    if (docConfig.isFfc) {
      setFfcNumber(data?.ffc?.certificateNumber || "");
      setFfcIssued(data?.ffc?.issuedOn || "");
      setFfcExpiry(data?.ffc?.expiresOn || "");
      setPpraRef(data?.ppraReference || "");
    }
  };

  const handleDownload = async (doc: UserComplianceDocumentRecord) => {
    try {
      const url = await getR2FileUrl(doc.storageKey);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.filename;
      link.rel = "noopener";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      toast.error(err.message || "Failed to download file");
    }
  };

  const handleDelete = async (doc: UserComplianceDocumentRecord) => {
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to delete files.");
    if (!userId) return;
    if (!confirm(`Are you sure you want to remove "${doc.filename}"?`)) return;

    try {
      await deleteMutation.mutateAsync({
        documentId: doc.id,
        storageKey: doc.storageKey,
        sizeBytes: doc.sizeBytes,
        userId,
      });
      toast.success("Document removed successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document");
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return toast.info("Read-only mode: exit impersonation to upload files.");
    if (!userId || !agencyId || !activeUploadDoc) return;
    if (!selectedFile) return toast.error("Please select a file to upload.");

    if (activeUploadDoc.isFfc) {
      if (!ffcNumber.trim()) return toast.error("Certificate number is required.");
      if (!ffcIssued || !ffcExpiry) return toast.error("Issued and expiry dates are required.");
      if (ffcExpiry < ffcIssued) return toast.error("Expiry date cannot be before issued date.");
    }

    try {
      await uploadMutation.mutateAsync({
        file: selectedFile,
        userId,
        agencyId,
        category: activeUploadDoc.category,
        ffcDetails: activeUploadDoc.isFfc
          ? {
              certificateNumber: ffcNumber,
              issuedOn: ffcIssued,
              expiresOn: ffcExpiry,
            }
          : undefined,
        ppraReference: activeUploadDoc.isFfc ? ppraRef : undefined,
      });

      toast.success(`${activeUploadDoc.title} uploaded successfully`);
      setActiveUploadDoc(null);
      setSelectedFile(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    }
  };

  const docsByCategory = new Map<string, UserComplianceDocumentRecord>();
  (data?.documents || []).forEach((doc) => {
    if (!docsByCategory.has(doc.category)) {
      docsByCategory.set(doc.category, doc);
    }
  });

  const mandatoryDocs = REQUIRED_DOCUMENTS.filter((d) => d.requirement.startsWith("Mandatory"));
  const uploadedMandatoryCount = mandatoryDocs.filter((d) => docsByCategory.has(d.category)).length;

  return (
    <GlassCard className="lg:col-span-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-semibold">
            <FileCheck2 className="size-4 text-primary" /> Required Agent Compliance Documents
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Statutory Property Practitioners Regulatory Authority (PPRA) and FICA compliance
            records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "px-3 py-1 text-xs font-medium gap-1.5",
              uploadedMandatoryCount === mandatoryDocs.length
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            {uploadedMandatoryCount === mandatoryDocs.length ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <AlertCircle className="size-3.5" />
            )}
            {uploadedMandatoryCount} of {mandatoryDocs.length} Mandatory Uploaded
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {REQUIRED_DOCUMENTS.map((docConfig) => {
            const uploadedDoc = docsByCategory.get(docConfig.category);
            const isFfc = docConfig.isFfc;
            const ffcData = data?.ffc;

            let statusLabel = "Missing";
            let statusVariant: "success" | "warning" | "destructive" | "muted" = "muted";

            if (isFfc) {
              if (!uploadedDoc && !ffcData) {
                statusLabel = "Missing";
                statusVariant = "muted";
              } else if (ffcData?.expiresOn) {
                const days = daysUntil(ffcData.expiresOn);
                if (days < 0) {
                  statusLabel = "Expired";
                  statusVariant = "destructive";
                } else if (days <= 30) {
                  statusLabel = `Expiring (${days}d)`;
                  statusVariant = "warning";
                } else {
                  statusLabel = "Valid & Active";
                  statusVariant = "success";
                }
              } else if (uploadedDoc) {
                statusLabel = "Uploaded";
                statusVariant = "success";
              }
            } else if (uploadedDoc) {
              statusLabel = "Uploaded";
              statusVariant = "success";
            }

            return (
              <div
                key={docConfig.id}
                className="flex flex-col justify-between rounded-xl border border-border/70 bg-card/40 p-4 transition hover:border-primary/30"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{docConfig.title}</span>
                        {isFfc && <Award className="size-3.5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{docConfig.description}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] whitespace-nowrap shrink-0",
                        statusVariant === "success" &&
                          "border-success/30 bg-success/10 text-success",
                        statusVariant === "warning" &&
                          "border-warning/30 bg-warning/10 text-warning",
                        statusVariant === "destructive" &&
                          "border-destructive/30 bg-destructive/10 text-destructive",
                        statusVariant === "muted" && "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {statusLabel}
                    </Badge>
                  </div>

                  {isFfc && ffcData && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase">
                          FFC Number
                        </span>
                        <span className="font-mono font-medium">{ffcData.certificateNumber}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase">
                          Expires On
                        </span>
                        <span className="font-medium">{dateFmt(ffcData.expiresOn)}</span>
                      </div>
                      {data?.ppraReference && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground block text-[10px] uppercase">
                            PPRA Reference
                          </span>
                          <span className="font-mono font-medium">{data.ppraReference}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {uploadedDoc && (
                    <div className="mt-3 flex items-center justify-between text-xs bg-background/50 p-2 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <FileText className="size-4 shrink-0 text-primary" />
                        <span className="truncate font-medium">{uploadedDoc.filename}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          ({formatBytes(uploadedDoc.sizeBytes)})
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {dateFmt(uploadedDoc.uploadedAt)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {docConfig.requirement}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {uploadedDoc && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => handleDownload(uploadedDoc)}
                          title="View / Download Document"
                        >
                          <Eye className="size-3.5" /> View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(uploadedDoc)}
                          disabled={isReadOnly || deleteMutation.isPending}
                          title="Remove Document"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant={uploadedDoc ? "outline" : "default"}
                      size="sm"
                      className={cn(
                        "h-7 px-2.5 text-xs gap-1",
                        !uploadedDoc && "bg-primary text-primary-foreground",
                      )}
                      onClick={() => openUploadModal(docConfig)}
                      disabled={isReadOnly}
                    >
                      <UploadCloud className="size-3.5" /> {uploadedDoc ? "Replace" : "Upload"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={!!activeUploadDoc} onOpenChange={(open) => !open && setActiveUploadDoc(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload {activeUploadDoc?.title}</DialogTitle>
            <DialogDescription>{activeUploadDoc?.description}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadSubmit} className="space-y-4 py-2">
            {activeUploadDoc?.isFfc && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="modal-ppra-ref">PPRA Reference Number</Label>
                  <Input
                    id="modal-ppra-ref"
                    placeholder="e.g. F1234567"
                    value={ppraRef}
                    onChange={(e) => setPpraRef(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modal-ffc-num">FFC Certificate Number *</Label>
                  <Input
                    id="modal-ffc-num"
                    placeholder="e.g. 2026/000123"
                    value={ffcNumber}
                    onChange={(e) => setFfcNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="modal-ffc-issued">Issued Date *</Label>
                    <Input
                      id="modal-ffc-issued"
                      type="date"
                      value={ffcIssued}
                      onChange={(e) => setFfcIssued(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="modal-ffc-expiry">Expiry Date *</Label>
                    <Input
                      id="modal-ffc-expiry"
                      type="date"
                      value={ffcExpiry}
                      onChange={(e) => setFfcExpiry(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="modal-file-input">Select Document File (.pdf, .jpg, .png) *</Label>
              <Input
                id="modal-file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                required
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveUploadDoc(null)}
                disabled={uploadMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!selectedFile || uploadMutation.isPending || isReadOnly}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" /> Uploading…
                  </>
                ) : (
                  "Confirm & Upload"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}
