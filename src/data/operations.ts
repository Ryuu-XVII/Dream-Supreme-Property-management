import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { conditionStatusFromDb, conditionTypeFromDb, stageFromDb } from "@/lib/domain";

import { useAuth } from "@/lib/auth";

export function useDashboardData() {
  const { activeAccount } = useAuth();
  return useQuery({
    queryKey: ["dashboard", activeAccount?.id],
    queryFn: async () => {
      const isAgent = activeAccount?.role === "agent";

      // Agents only see their own deals. Rather than fetching every deal in
      // the agency and filtering client-side (which both over-fetches and
      // briefly exposes other agents' deal data to the browser before the
      // filter runs), resolve the agent's own deal IDs first and scope the
      // deal query server-side with `.in("id", ...)`. Run this lookup
      // alongside the user/audit queries rather than blocking on it.
      const dealIdsPromise: Promise<string[] | null> = isAgent
        ? Promise.resolve(
            supabase
              .from("deal_participant")
              .select("deal_id")
              .eq("user_account_id", activeAccount!.id),
          ).then(({ data, error }) => {
            if (error) throw error;
            return [...new Set((data ?? []).map((p: any) => p.deal_id))];
          })
        : Promise.resolve(null);

      const [dealIds, userResult, auditResult] = await Promise.all([
        dealIdsPromise,
        supabase
          .from("user_account")
          .select(
            "id, full_name, email, role, ppra_reference, is_candidate, ffc:ffc_certificate(id, certificate_number, issued_on, expires_on, document:document_id(storage_key))",
          ),
        supabase
          .from("audit_log")
          .select(
            "id, occurred_at, entity_type, entity_id, action, before_json, after_json, actor:actor_id(full_name)",
          )
          .order("occurred_at", { ascending: false })
          .limit(10),
      ]);
      if (userResult.error) throw userResult.error;

      let dealQuery = supabase.from("deal").select(`
            id, reference, stage, status, sale_price_cents, registration_date, updated_at,
            property:property_id(id, address_line, suburb, city),
            mandate:mandate_id(commission_rate_bps),
            conditions:suspensive_condition(id, condition_type, description, due_on, original_due_on, status, responsible_party),
            participants:deal_participant(user:user_account_id(id, full_name))
          `);
      if (dealIds) {
        dealQuery = dealQuery.in("id", dealIds);
      }
      const dealResult = await dealQuery;
      if (dealResult.error) throw dealResult.error;

      const filteredDealsData = dealResult.data || [];

      const deals = filteredDealsData.map((deal: any) => ({
        id: deal.id,
        ref: deal.reference,
        propertyId: deal.property?.id,
        stage: stageFromDb[deal.stage] ?? "Mandate Signed",
        cancelled:
          deal.status === "cancelled" ? { reason: "Cancelled", at: deal.updated_at } : undefined,
        salePrice: deal.sale_price_cents,
        commissionBps: deal.mandate?.commission_rate_bps ?? 0,
        registeredAt: deal.registration_date,
        stageSince: deal.updated_at,
        property: {
          address: deal.property?.address_line || "Unknown property",
          suburb: deal.property?.suburb || "",
          city: deal.property?.city || "",
        },
      }));

      const dealById = new Map(deals.map((deal) => [deal.id, deal]));
      const openConditions = filteredDealsData.flatMap((deal: any) =>
        (deal.conditions || [])
          .filter(
            (condition: any) => condition.status === "pending" || condition.status === "extended",
          )
          .map((condition: any) => ({
            id: condition.id,
            dealId: deal.id,
            deal: dealById.get(deal.id),
            type: conditionTypeFromDb[condition.condition_type] ?? "Due Diligence",
            description: condition.description,
            dueDate: condition.due_on,
            originalDueDate: condition.original_due_on,
            status: conditionStatusFromDb[condition.status] ?? "Open",
            responsibleParty: condition.responsible_party || "Purchaser",
            responsibleUserId: deal.participants?.[0]?.user?.id || "",
            agent: {
              id: deal.participants?.[0]?.user?.id || "",
              name: deal.participants?.[0]?.user?.full_name || "Unassigned",
              colour: "#1f7a52",
            },
          })),
      );

      const rawUsers = userResult.data || [];
      const users = rawUsers.map((user: any) => {
        const primaryFfc = Array.isArray(user.ffc) ? user.ffc[0] : user.ffc;
        const role = user.role === "admin" ? "Admin" : "Agent";
        return {
          id: user.id,
          name: user.full_name,
          email: user.email,
          role: role as "Agent" | "Admin",
          seniority: (user.role === "admin" ? "Admin" : "Senior") as
            "Senior" | "Mid-level" | "Admin",
          colour: "#1f7a52",
          ppra: user.ppra_reference || "Not captured",
          ffc: primaryFfc
            ? {
                id: primaryFfc.id,
                number: primaryFfc.certificate_number,
                issued: primaryFfc.issued_on,
                expiry: primaryFfc.expires_on,
                storageKey: primaryFfc.document?.storage_key,
              }
            : null,
        };
      });

      const auditEvents = auditResult.error
        ? []
        : (auditResult.data || []).map((event: any) => ({
            id: event.id,
            at: event.occurred_at,
            user: event.actor?.full_name || "System",
            entityType: event.entity_type,
            entityRef: event.entity_id,
            action: event.action,
            summary: event.after_json?.reason || event.action,
            before: event.before_json || {},
            after: event.after_json || {},
          }));

      return { deals, openConditions, users, auditEvents };
    },
  });
}

export function useCountdownData() {
  const dashboard = useDashboardData();
  return {
    ...dashboard,
    data: dashboard.data
      ? { conditions: dashboard.data.openConditions, users: dashboard.data.users }
      : undefined,
  };
}

export function useAuditData() {
  return useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const [auditResult, usersResult] = await Promise.all([
        supabase
          .from("audit_log")
          .select(
            "id, occurred_at, entity_type, entity_id, action, before_json, after_json, actor:actor_id(full_name)",
          )
          .order("occurred_at", { ascending: false })
          .limit(1000),
        supabase.from("user_account").select("id, full_name").order("full_name"),
      ]);
      if (auditResult.error) throw auditResult.error;
      if (usersResult.error) throw usersResult.error;
      const actionNames: Record<string, string> = {
        create: "Created",
        update: "Updated",
        delete: "Deleted",
        stage_transition: "Stage Changed",
        calculation: "Calculated",
        login: "Updated",
        export: "Updated",
      };
      return {
        users: (usersResult.data || []).map((user: any) => ({ id: user.id, name: user.full_name })),
        events: (auditResult.data || []).map((event: any) => ({
          id: event.id,
          at: event.occurred_at,
          user: event.actor?.full_name || "System",
          entityType: event.entity_type,
          entityRef: event.entity_id,
          action: actionNames[event.action] || "Updated",
          summary:
            event.after_json?.reason ||
            event.after_json?.reference ||
            actionNames[event.action] ||
            event.action,
          before: event.before_json || {},
          after: event.after_json || {},
        })),
      };
    },
  });
}
