import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/commission/")({
  head: () => ({ meta: [{ title: "Commission | Dream Supreme Properties" }] }),
  component: CommissionIndex,
});

/**
 * Commission rule sets are configured in the Admin Console
 * (/admin/commission-rules), not the agent portal.
 *
 * This route used to render the rule editor for anyone `canAccessAdmin`
 * allowed, which meant an Admin & Agent saw "New Rule Set" while working in
 * the agent portal — and a plain agent saw a "Rules Configuration" tab that
 * only bounced them away. Commission is administrator-only (enforced by
 * enforce_admin_only_commission_rate and the guard in
 * save_commission_rule_set), so the agent portal simply opens on earnings.
 */
function CommissionIndex() {
  return <Navigate to="/commission/earnings" replace />;
}
