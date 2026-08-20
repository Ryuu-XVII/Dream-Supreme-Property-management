import type { ReactNode } from "react";
import { m as motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Sidebar, MobileNav } from "./sidebar";
import { Header } from "./header";
import { ImpersonationBanner } from "./impersonation-banner";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

export function AppShell({
  children,
  title,
  description,
  crumbs,
  actions,
}: {
  children: ReactNode;
  title?: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="ambient-mesh flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ImpersonationBanner />
        <Header />
        <main className="flex min-h-0 flex-1 flex-col px-3 pb-24 pt-5 sm:px-6 md:pb-10">
          {crumbs && crumbs.length > 0 && (
            <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {crumbs.map((c, i) => (
                <span key={c.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3" />}
                  {c.to ? (
                    <Link to={c.to} className="hover:text-foreground">
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-foreground">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          {(title || actions) && (
            <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
              <div className="min-w-0">
                {title && <h1 className="truncate text-2xl font-semibold sm:text-3xl">{title}</h1>}
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </div>
              {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
              )}
            </div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {children}
          </motion.div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
