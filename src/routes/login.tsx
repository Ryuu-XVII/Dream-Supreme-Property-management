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
import { agency } from "@/data/state";
import { supabase } from "@/lib/supabase";

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
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: CredentialsForm) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        const pendingRaw = localStorage.getItem("dsp-pending-invitation");
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw) as {
              token: string;
              fullName: string;
              mobile: string;
            };
            const { error: acceptError } = await supabase.rpc("accept_user_invitation", {
              p_token: pending.token,
              p_full_name: pending.fullName,
              p_mobile: pending.mobile,
              p_avatar_key: null,
            });
            if (acceptError) throw acceptError;
            localStorage.removeItem("dsp-pending-invitation");
          } catch (invitationError) {
            await supabase.auth.signOut();
            toast.error(
              invitationError instanceof Error
                ? invitationError.message
                : "Your company invitation could not be accepted.",
            );
            return;
          }
        }
        toast.success("Signed in successfully");
        navigate({ to: "/" });
      }
    } finally {
      setLoading(false);
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
              <h1 className="font-display text-xl font-semibold">{agency.name}</h1>
              <p className="text-sm text-muted-foreground">Agency management platform</p>
            </div>
          </div>

          <div className="overflow-hidden">
            <motion.form
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              onSubmit={form.handleSubmit(onSubmit)}
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
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
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
                  onClick={() => toast.info("Password reset link sent (demo)")}
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Continue"}
              </Button>

              <p className="pt-2 text-center text-xs text-muted-foreground">
                New team members register through an invitation from the principal or administrator.
              </p>
            </motion.form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
