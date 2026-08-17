import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Only genuinely public, crawlable pages belong here — everything else in the
// app requires authentication and would just redirect a crawler to /login.
// Kept in sync with PUBLIC_ROUTE_PREFIXES in src/lib/auth-routing.ts, minus
// /conveyancer and /sign, which are per-record token links with no canonical
// listing page to crawl.
const entries: SitemapEntry[] = [
  { path: "/calculators/bond", changefreq: "monthly", priority: "0.8" },
  { path: "/calculators/transfer", changefreq: "monthly", priority: "0.8" },
  { path: "/calculators/affordability", changefreq: "monthly", priority: "0.8" },
  { path: "/calculators/yield", changefreq: "monthly", priority: "0.8" },
  { path: "/login", changefreq: "monthly", priority: "0.3" },
  { path: "/register", changefreq: "monthly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const baseUrl = new URL(request.url).origin;

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${baseUrl}${e.path}</loc>`,
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
