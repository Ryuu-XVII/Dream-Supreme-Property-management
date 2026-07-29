import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// TODO: replace with your project URL once a project name or custom domain is set.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/login", changefreq: "monthly", priority: "0.4" },
          { path: "/pipeline", changefreq: "daily", priority: "0.9" },
          { path: "/countdown", changefreq: "daily", priority: "0.9" },
          { path: "/commission", changefreq: "weekly", priority: "0.7" },
          { path: "/commission/reconciliation", changefreq: "weekly", priority: "0.7" },
          { path: "/commission/earnings", changefreq: "weekly", priority: "0.7" },
          { path: "/compliance/ffc", changefreq: "weekly", priority: "0.6" },
          { path: "/compliance/fica", changefreq: "weekly", priority: "0.6" },
          { path: "/compliance/audit", changefreq: "weekly", priority: "0.5" },
          { path: "/documents", changefreq: "weekly", priority: "0.6" },
          { path: "/leads", changefreq: "daily", priority: "0.7" },
          { path: "/reports", changefreq: "weekly", priority: "0.6" },
          { path: "/calculators/bond", changefreq: "monthly", priority: "0.8" },
          { path: "/calculators/transfer", changefreq: "monthly", priority: "0.8" },
          { path: "/calculators/affordability", changefreq: "monthly", priority: "0.8" },
          { path: "/calculators/yield", changefreq: "monthly", priority: "0.8" },
          { path: "/settings/agency", changefreq: "monthly", priority: "0.4" },
          { path: "/settings/notifications", changefreq: "monthly", priority: "0.4" },
          { path: "/settings/users", changefreq: "monthly", priority: "0.4" },
          { path: "/onboarding", changefreq: "monthly", priority: "0.5" },
          { path: "/import", changefreq: "monthly", priority: "0.4" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
