import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Navigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/lib/app-state";
import { AuthProvider, useAuth } from "@/lib/auth";
import { isActiveAccount, isPublicPathname } from "@/lib/auth-routing";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

const loadMotionFeatures = () => import("framer-motion").then((mod) => mod.domMax);

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-mono text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Deal not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The deal, page or record you're looking for doesn't exist, was archived, or the reference
          is incorrect.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Back to dashboard
          </Link>
          <Link
            to="/pipeline"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            View pipeline
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dream Supreme Properties — Estate Agency Operations" },
      {
        name: "description",
        content:
          "Deal pipeline, suspensive condition countdowns, commission reconciliation and compliance for South African estate agencies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const isAdminDomain =
      hostname.startsWith("admin.") ||
      hostname.startsWith("admin-") ||
      hostname === "admin.localhost" ||
      (import.meta.env.VITE_ADMIN_DOMAIN &&
        (window.location.origin === import.meta.env.VITE_ADMIN_DOMAIN ||
          window.location.hostname === import.meta.env.VITE_ADMIN_DOMAIN));

    // Public paths that must NOT be redirected to /admin (e.g. invitation registration)
    const isPublicPath = isPublicPathname(pathname);
    const isImpersonating =
      typeof window !== "undefined" && !!sessionStorage.getItem("ds_impersonated_session_account");

    if (isAdminDomain && !pathname.startsWith("/admin") && !isPublicPath && !isImpersonating) {
      window.location.replace("/admin" + (pathname === "/" ? "" : pathname));
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          {/* Every framer-motion usage in the app imports `m` (not the full `motion`
              proxy) and relies on this LazyMotion provider for animation features.
              `features` is a dynamic import so the animation engine loads as its
              own async chunk instead of being bundled into the critical, never-
              code-split root chunk that loads on every single page — passing the
              feature set directly (e.g. `features={domMax}`) measurably regressed
              the main bundle here (confirmed via `vite build` output) because it
              forces an eager, synchronous import at the app root. domMax (not the
              smaller domAnimation) is required because the sidebars' active-item
              indicator uses layoutId shared-layout animation. Also respects the
              OS-level "reduce motion" accessibility setting for every animation
              instead of forcing motion on everyone regardless of that preference. */}
          <LazyMotion features={loadMotionFeatures}>
            <MotionConfig reducedMotion="user">
              <AuthenticatedOutlet />
              <Toaster position="top-right" richColors closeButton />
            </MotionConfig>
          </LazyMotion>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedOutlet() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { activeAccount, loading } = useAuth();

  if (isPublicPathname(pathname)) return <Outlet />;

  if (!isActiveAccount(activeAccount)) {
    if (loading) {
      return (
        <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
          Verifying session…
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
