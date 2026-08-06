import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { canAccessAdmin, isActiveAccount } from "@/lib/auth-routing";

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
  const { refreshAccount, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const form = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmitCredentials = form.handleSubmit(async ({ email, password }) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      const nextAccount = await refreshAccount();
      if (!isActiveAccount(nextAccount)) {
        await signOut();
        throw new Error("This account is not active or has not been provisioned.");
      }

      toast.success("Signed in successfully");
      navigate({ to: canAccessAdmin(nextAccount) ? "/admin" : "/" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
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
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-2xl border border-border/60 p-8 shadow-xl">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground">
              DS
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Dream Supreme Properties</h1>
              <p className="text-sm text-muted-foreground">Agency management platform</p>
            </div>
          </div>

          <div className="overflow-hidden">
            <motion.form
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={onSubmitCredentials}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@dreamsupreme.co.za"
                    className="pl-9"
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    {...form.register("password")}
                  />
                </div>
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => void onForgotPassword()}
                  disabled={resettingPassword}
                >
                  {resettingPassword ? "Sending…" : "Forgot password?"}
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Signing in…" : "Sign in"}
              </Button>
            </motion.form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
