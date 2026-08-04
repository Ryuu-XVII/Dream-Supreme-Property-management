import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { agency } from "@/data/mock";

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
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

  const form = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmitCredentials = form.handleSubmit(() => {
    setStep("totp");
  });

  const onVerifyOtp = () => {
    if (otp.length !== 6) {
      toast.error("Enter the full 6-digit code");
      return;
    }
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      if (otp === "123456") {
        toast.success("Signed in successfully");
        navigate({ to: "/" });
      } else {
        toast.error("Incorrect authentication code");
        setOtp("");
      }
    }, 500);
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
            <AnimatePresence mode="wait" initial={false}>
              {step === "credentials" ? (
                <motion.form
                  key="credentials"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
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
                      <p className="text-xs text-destructive">
                        {form.formState.errors.email.message}
                      </p>
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
                      onClick={() => toast.info("Password reset link sent (demo)")}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className="w-full">
                    Continue
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="totp"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStep("credentials");
                      setOtp("");
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </button>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <KeyRound className="size-5" />
                    </span>
                    <h2 className="font-display text-base font-semibold">
                      Two-factor authentication
                    </h2>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      Enter the 6-digit code from your authenticator app to finish signing in.
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button className="w-full" onClick={onVerifyOtp} disabled={verifying}>
                    {verifying ? "Verifying…" : "Verify & sign in"}
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground">Demo code: 123456</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
