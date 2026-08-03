import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/lib/app-state";

import appCss from "../styles.css?url";

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
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
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

import { AuthProvider, useAuth } from "@/lib/auth";

function AuthGuard({ children }: { children: ReactNode }) {
  const { session, account, loading, signOut } = useAuth();
  const router = useRouter();

  const isPublicPath = (path: string) =>
    path === "/login" ||
    path === "/register" ||
    path === "/sitemap.xml" ||
    path.startsWith("/calculators/") ||
    path.startsWith("/sign") ||
    path.startsWith("/conveyancer");

  useEffect(() => {
    if (!loading && !session) {
      const path = window.location.pathname;
      if (!isPublicPath(path)) {
        router.navigate({ to: "/login", replace: true });
      }
    } else if (!loading && session && account) {
      const path = window.location.pathname;
      const isAdminPath = path.startsWith("/admin");

      // Admins are locked strictly to the admin portal
      if (account.role === "admin" && !isAdminPath && !isPublicPath(path)) {
        router.navigate({ to: "/admin", replace: true });
      }
      // Agents and Candidates are locked strictly to the main app
      else if ((account.role === "agent" || account.role === "candidate") && isAdminPath) {
        router.navigate({ to: "/", replace: true });
      }
      // Principals have access to both, so no restrictive redirect needed for them
    }
  }, [session, account, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading secure session…
      </div>
    );
  }

  if (session && !account) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
        <div className="max-w-sm space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Account Not Found</h2>
          <p className="text-sm text-muted-foreground">
            We found your login session, but your agency profile is missing. This usually happens if
            the database was reset.
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              await signOut();
            } catch (e) {
              console.error(e);
              // Force clear everything if supabase signout fails
              localStorage.clear();
              sessionStorage.clear();
            } finally {
              window.location.href = "/login";
            }
          }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Clear Session & Sign In Again
        </button>
      </div>
    );
  }

  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  const publicPath = isPublicPath(currentPath);
  if (!session && !publicPath) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Redirecting to sign in…
      </div>
    );
  }
  return <>{children}</>;
}

import { MotionConfig } from "framer-motion";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppProvider>
            <AuthGuard>
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
            </AuthGuard>
            <Toaster position="top-right" richColors closeButton />
          </AppProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}
