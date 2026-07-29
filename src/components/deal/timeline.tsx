import { GlassCard, EmptyState } from "@/components/ui-kit";
import { auditEvents, type Deal } from "@/data/mock";
import { dateTimeFmt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, History } from "lucide-react";

export function DealTimelineTab({ deal }: { deal: Deal }) {
  const relatedAudit = auditEvents.filter((a) => a.entityRef === deal.ref);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <GlassCard>
        <h3 className="mb-4 font-display text-base font-semibold">Stage timeline</h3>
        {deal.timeline.length === 0 ? (
          <EmptyState title="No timeline events" message="This deal has no recorded stage transitions yet." />
        ) : (
          <ol className="relative space-y-5 border-l border-border pl-5">
            {deal.timeline.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[26px] top-1 size-2.5 rounded-full bg-primary" />
                <p className="text-xs text-muted-foreground">{dateTimeFmt(t.at)}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {t.from && (
                    <>
                      <Badge variant="outline" className="text-[10px]">{t.from}</Badge>
                      <ArrowRight className="size-3 text-muted-foreground" />
                    </>
                  )}
                  {t.to && <Badge variant="outline" className="text-[10px]">{t.to}</Badge>}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t.action} · {t.actor}</p>
                {t.reason && <p className="mt-0.5 text-xs italic text-muted-foreground">"{t.reason}"</p>}
              </li>
            ))}
          </ol>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">
          <History className="size-4 text-primary" /> Audit feed
        </h3>
        {relatedAudit.length === 0 ? (
          <EmptyState title="No audit events" message="No audit trail entries reference this deal yet." />
        ) : (
          <div className="space-y-3">
            {relatedAudit.map((a) => (
              <div key={a.id} className="rounded-lg border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">{a.action}</Badge>
                  <span className="text-[11px] text-muted-foreground">{dateTimeFmt(a.at)}</span>
                </div>
                <p className="mt-1 text-sm">{a.summary}</p>
                <p className="text-xs text-muted-foreground">{a.user}</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
