import { createFileRoute } from "@tanstack/react-router";
import { ReconciliationContent } from "@/components/commission/reconciliation-content";

export const Route = createFileRoute("/admin/recon")({
  component: ReconciliationContent,
});
