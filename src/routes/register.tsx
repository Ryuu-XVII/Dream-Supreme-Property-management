import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, Mail, User, Phone, Upload, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { uploadFileToR2, recordStorageUsageDelta } from "@/lib/storage";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Agent Registration | Dream Supreme Properties" },
      { name: "description", content: "Register as an agent with Dream Supreme Properties." },
    ],
  }),
  component: RegisterPage,
});

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Surname is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterForm = z.infer<typeof registerSchema>;

function RegisterPage() {
  const navigate = useNavigate();
  const { refreshAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Extract URL parameters passed in invitation link
  const urlParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const initialEmail = urlParams?.get("email") || "";
  const initialToken = urlParams?.get("token") || "";

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: initialEmail,
      phone: "",
      password: "",
    },
  });

  useEffect(() => {
    // Clear any existing session so the form renders in an unauthenticated state.
    // We await signOut to prevent a race with AuthProvider's onAuthStateChange.
    supabase.auth.signOut().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: RegisterForm) => {
    try {
      setLoading(true);
      toast.loading("Creating your agent account...", { id: "register" });

      const invitationToken = new URLSearchParams(window.location.search).get("token") || "";
      if (!invitationToken) {
        throw new Error("A company invitation link is required to register.");
      }

      // Step 1: Validate invitation AND clean up any orphan auth user server-side.
      // This RPC deletes orphan auth.users rows from previous failed attempts,
      // so the subsequent signUp call will always succeed for valid invitations.
      const { data: prepResult, error: prepError } = await supabase.rpc(
        "prepare_invited_registration",
        { p_token: invitationToken, p_email: data.email },
      );
      if (prepError) throw new Error(prepError.message);
      if (!prepResult?.valid) {
        throw new Error(prepResult?.reason || "This invitation is invalid or expired.");
      }

      // Step 2: Create the Supabase Auth user with the agent's chosen password.
      let avatarKey: string | null = null;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) throw new Error(authError.message);

      const authUser = authData.user;
      let session = authData.session;

      if (!authUser) {
        throw new Error("Registration failed. Please try again.");
      }

      // Step 3: Ensure we have an active session.
      // If email confirmation is required, signUp may not return a session.
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signInError) {
          // Email confirmation is pending — store details for later acceptance.
          localStorage.setItem(
            "dsp-pending-invitation",
            JSON.stringify({
              token: invitationToken,
              fullName: `${data.firstName.trim()} ${data.lastName.trim()}`,
              mobile: data.phone,
            }),
          );
          toast.success("Account created! Please check your email to confirm registration.", {
            id: "register",
          });
          navigate({ to: "/login" });
          return;
        }
        session = signInData.session;
      }

      // Step 4: Accept the invitation and create the user_account profile.
      // This must happen before any storage upload: the storage RLS policies scope
      // access by the caller's agency_id via get_current_agency_id(), which resolves
      // from the user_account row created here. Uploading first (as this used to do,
      // keyed by authUser.id) meant get_current_agency_id() was still NULL and every
      // avatar upload during registration was silently rejected by RLS.
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
      const { error: rpcError } = await supabase.rpc("accept_user_invitation", {
        p_token: invitationToken,
        p_full_name: fullName,
        p_mobile: data.phone,
        p_avatar_key: null,
      });

      if (rpcError) throw rpcError;
      localStorage.removeItem("dsp-pending-invitation");
      const createdAccount = await refreshAccount();
      if (!createdAccount || createdAccount.status !== "active") {
        throw new Error(
          "Your profile was created but could not be activated. Please sign in again.",
        );
      }

      // Step 5: Now that the agent's user_account exists, upload the avatar under
      // their agency's storage path and attach it to the profile.
      if (avatarFile && session) {
        const fileExt = avatarFile.name.split(".").pop();
        const storagePath = `${createdAccount.agencyId}/avatars/${authUser.id}/${crypto.randomUUID()}.${fileExt}`;
        avatarKey = await uploadFileToR2(avatarFile, storagePath);
        await recordStorageUsageDelta(createdAccount.id, avatarFile.size);
        const { error: avatarUpdateError } = await supabase
          .from("user_account")
          .update({ avatar_key: avatarKey })
          .eq("id", createdAccount.id);
        if (avatarUpdateError) throw avatarUpdateError;
      }

      toast.success("Welcome to Dream Supreme Properties!", { id: "register" });
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Failed to register account", { id: "register" });
    } finally {
      setLoading(false);
    }
  };

  // Don't render the form until any stale session has been cleared
  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4 py-10"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="animate-pulse text-muted-foreground text-sm">Loading registration…</div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--gradient-hero)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="glass rounded-2xl border border-border/60 p-8 shadow-xl">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground">
              DS
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Agent Registration</h1>
              <p className="text-sm text-muted-foreground">
                Join the Dream Supreme Properties team
              </p>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center justify-center space-y-2">
              <Label>Profile Picture</Label>
              <div className="relative group size-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/40 hover:bg-muted/60 transition-colors">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <Upload className="size-6 text-muted-foreground group-hover:scale-110 transition-transform" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-xs text-muted-foreground">Click to upload photo (Cloudflare R2)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="firstName"
                    placeholder="John"
                    className="pl-9"
                    {...form.register("firstName")}
                  />
                </div>
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lastName">Surname</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    className="pl-9"
                    {...form.register("lastName")}
                  />
                </div>
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john.doe@dreamsupreme.co.za"
                  readOnly={!!initialEmail}
                  className={`pl-9${initialEmail ? " bg-muted/60 cursor-not-allowed opacity-70" : ""}`}
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone / Mobile Number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+27 82 123 4567"
                  className="pl-9"
                  {...form.register("phone")}
                />
              </div>
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
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
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Registering..." : "Register Account"}
            </Button>

            <div className="text-center text-xs text-muted-foreground pt-2">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
