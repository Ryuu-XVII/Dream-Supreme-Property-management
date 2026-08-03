import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { GlassCard } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/whatsapp")({
  component: WhatsAppDashboard,
});

function WhatsAppDashboard() {
  const { account } = useAuth();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["whatsapp-queue", account?.agencyId],
    enabled: !!account,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_queue")
        .select("*")
        .eq("agency_id", account!.agencyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <AdminPageHeader
        title="WhatsApp Gateway"
        description="Monitor outgoing automated WhatsApp messages to buyers, sellers, and tenants."
        actions={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10 py-1.5"
            >
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Gateway Active
            </Badge>
          </div>
        }
      />

      <GlassCard className="p-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MessageSquare className="size-5 text-emerald-500" />
            Message Queue
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created At</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Loading queue...
                </TableCell>
              </TableRow>
            ) : !messages || messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No messages in the queue.
                </TableCell>
              </TableRow>
            ) : (
              messages.map((msg) => (
                <TableRow key={msg.id}>
                  <TableCell>{format(new Date(msg.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                  <TableCell className="font-medium text-sm">{msg.recipient_phone}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{msg.template_name}</Badge>
                  </TableCell>
                  <TableCell>{msg.attempts}</TableCell>
                  <TableCell>
                    {msg.status === "sent" ? (
                      <div className="flex items-center text-emerald-500 text-sm">
                        <CheckCircle2 className="size-4 mr-1" /> Sent
                      </div>
                    ) : msg.status === "failed" ? (
                      <div className="flex items-center text-red-500 text-sm">
                        <AlertCircle className="size-4 mr-1" /> Failed
                      </div>
                    ) : (
                      <div className="flex items-center text-amber-500 text-sm">
                        <Clock className="size-4 mr-1" /> Pending
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>
    </>
  );
}
