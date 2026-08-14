import { createFileRoute } from "@tanstack/react-router";
import { CommissionRulesContent } from "@/components/commission/commission-rules-content";

export const Route = createFileRoute("/admin/commission-rules")({
  head: () => ({
    meta: [
      { title: "Commission Rules | Dream Supreme Properties" },
      {
        name: "description",
        content:
          "Configure commission rule sets, VAT treatment, deduction lines and office share for Dream Supreme Properties.",
      },
      { property: "og:title", content: "Commission Rules | Dream Supreme Properties" },
      {
        property: "og:description",
        content:
          "Configure commission rule sets, VAT treatment, deduction lines and office share for Dream Supreme Properties.",
      },
    ],
  }),
  component: CommissionRulesContent,
});
