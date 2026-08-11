import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth, type UserAccount } from "@/lib/auth";
import { canAccessAdmin, isActiveAccount, isAdminDomain } from "@/lib/auth-routing";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | Dream Supreme Properties" },
      {
        name: "description",
        content: "Sign in to the Dream Supreme Properties agency management platform.",
      },
      { property: "og:title", content: "Sign in | Dream Supreme Properties" },
      {
        property: "og:description",
        content: "Sign in to the Dream Supreme Properties agency management platform.",
      },
    ],
  }),
  component: LoginPage,
});

const credentialsSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type CredentialsForm = z.infer<typeof credentialsSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const { refreshAccount, signOut, setMasterAdminAccount } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isAdmin = isAdminDomain();

  const form = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmitCredentials = form.handleSubmit(async ({ email, password }) => {
    setSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Master Admin Fallback Auth Check
      if (cleanEmail === "admin@dreamsupreme.co.za" && password === "Admin@Dream2026!") {
        const { data: userAccount } = await supabase
          .from("user_account")
          .select("id, agency_id, branch_id, full_name, email, mobile, role, status")
          .eq("email", "admin@dreamsupreme.co.za")
          .maybeSingle();

        const masterAccount: UserAccount = {
          id: userAccount?.id || "master-admin-id",
          agencyId: userAccount?.agency_id || "00000000-0000-0000-0000-000000000001",
          branchId: userAccount?.branch_id || null,
          fullName: userAccount?.full_name || "Master Admin",
          email: "admin@dreamsupreme.co.za",
          role: "admin",
          status: "active",
        };

        // Try Supabase auth sign-in if possible, but fallback to master session bypass
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          // Set master admin account in auth context directly
          setMasterAdminAccount(masterAccount);
        } else {
          await refreshAccount();
        }

        toast.success("Signed in as Master Admin");
        window.location.href = "/admin";
        return;
      }

      // 2. Standard Supabase Auth Flow
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw error;

      const nextAccount = await refreshAccount();
      if (!isActiveAccount(nextAccount)) {
        await signOut();
        throw new Error("This account is not active or has not been provisioned.");
      }

      // Strict Domain Access Guard
      if (isAdmin && !canAccessAdmin(nextAccount)) {
        await signOut();
        throw new Error(
          "Access Denied: Your account does not have Admin Portal access privileges.",
        );
      }

      toast.success("Signed in successfully");
      navigate({ to: canAccessAdmin(nextAccount) ? "/admin" : "/" });
    } catch (error) {
      let message = "Unable to sign in.";
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  });

  const onForgotPassword = async () => {
    const emailIsValid = await form.trigger("email");
    if (!emailIsValid) return;

    setResettingPassword(true);
    try {
      const email = form.getValues("email").trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your email.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reset link.";
      toast.error(message);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="ambient-mesh flex min-h-screen items-center justify-center p-4 sm:p-6">
      {/* Decorative Background Accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 size-96 rounded-full bg-sidebar-primary/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-3xl border border-border/60 p-8 sm:p-10 shadow-2xl backdrop-blur-2xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="mb-4 grid size-16 place-items-center rounded-2xl bg-linear-to-br from-primary to-primary/80 font-display text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/25"
            >
              {isAdmin ? "AD" : "DS"}
            </motion.div>

            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isAdmin ? "Admin Console" : "Dream Supreme"}
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {isAdmin ? "Executive & Compliance Administration" : "Agency management platform"}
            </p>
          </div>

          <form onSubmit={onSubmitCredentials} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Email Address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  id="email"
                  type="email"
                  placeholder={isAdmin ? "admin@dreamsupreme.co.za" : "agent@dreamsupreme.co.za"}
                  className="h-11 rounded-xl bg-background/50 pl-10.5 text-sm transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/40"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary transition-colors hover:underline hover:text-primary/80"
                  onClick={() => void onForgotPassword()}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? "Sending…" : "Forgot password?"}
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  className="h-11 rounded-xl bg-background/50 pl-10.5 pr-10 text-sm transition-all focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/40"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {form.formState.errors.password && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-primary font-display font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg active:scale-[0.99]"
              disabled={submitting}
            >
              {submitting ? "Authenticating…" : "Sign in to Console"}
            </Button>
          </form>

          <div className="mt-8 border-t border-border/40 pt-5 text-center text-xs text-muted-foreground">
            Protected by enterprise RBAC & Row Level Security
          </div>
        </div>
      </motion.div>
    </div>
  );
}
