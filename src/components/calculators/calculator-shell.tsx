import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Calculator } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { agency } from "@/data/state";

const calculators = [
  { to: "/calculators/bond", label: "Bond Repayment" },
  { to: "/calculators/transfer", label: "Transfer Cost" },
  { to: "/calculators/affordability", label: "Affordability" },
  { to: "/calculators/yield", label: "Rental Yield" },
] as const;

const contactSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  telephone: z.string().min(10, "Enter a valid telephone number"),
});
type ContactForm = z.infer<typeof contactSchema>;

export function CalculatorShell({
  name,
  description,
  currentPath,
  children,
}: {
  name: string;
  description: string;
  currentPath: (typeof calculators)[number]["to"];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", telephone: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const calcName = name.replace(" Calculator", "");
      const agencySlug = import.meta.env.VITE_PUBLIC_AGENCY_SLUG || "dream-supreme-properties";
      const { error } = await supabase.rpc("submit_public_lead", {
        p_agency_slug: agencySlug,
        p_source: calcName,
        p_full_name: values.name,
        p_email: values.email,
        p_mobile: values.telephone,
        p_payload: { calculator: calcName, path: currentPath },
      });
      if (error) throw error;
      toast.success("Your request has been received", {
        description: `An agent will follow up with ${values.email}.`,
      });
    } catch (err: any) {
      toast.error(err.message || "We could not save your request. Please try again.");
      return;
    }
    form.reset();
    setOpen(false);
  });

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ background: "var(--gradient-hero)" }}
    >
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
              DS
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold sm:text-base">
                {agency.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">{name}</p>
            </div>
          </div>
          <nav className="flex shrink-0 flex-wrap gap-1">
            {calculators
              .filter((c) => c.to !== currentPath)
              .map((c) => (
                <Link
                  key={c.to}
                  to={c.to}
                  className="rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {c.label}
                </Link>
              ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-6 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Calculator className="size-4" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-semibold sm:text-2xl">{name}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          {children}

          <div className="mt-8 flex justify-center">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  <Mail className="size-4" />
                  Email My Results
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Email my results</DialogTitle>
                  <DialogDescription>
                    Leave your details and one of our consultants will email you a full breakdown of
                    this calculation.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" placeholder="Jane Dlamini" {...form.register("name")} />
                    {form.formState.errors.name && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jane@example.com"
                      {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telephone">Telephone</Label>
                    <Input
                      id="telephone"
                      placeholder="082 445 1120"
                      {...form.register("telephone")}
                    />
                    {form.formState.errors.telephone && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.telephone.message}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="submit" className="w-full sm:w-auto">
                      Send my results
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium text-foreground">Mandate</span>
      </footer>
    </div>
  );
}
