import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eraser,
  CheckCircle2,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard } from "@/components/ui-kit";
import { dateTimeFmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/sign")({
  head: () => ({
    meta: [
      { title: "Sign Document | Dream Supreme Properties" },
      { name: "description", content: "Review and electronically sign your Offer to Purchase document." },
      { property: "og:title", content: "Sign Document | Dream Supreme Properties" },
      { property: "og:description", content: "Review and electronically sign your Offer to Purchase document." },
    ],
  }),
  component: SignPage,
});

const restrictedCategories = [
  "Offer to Purchase Agreement",
  "Alienation of Land Agreement",
  "Antenuptial Contract",
  "Will / Testamentary Document",
];

function fakeHash() {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 64; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function SignPage() {
  const [category, setCategory] = useState<string>("Offer to Purchase Agreement");
  const restricted = category === "Alienation of Land Agreement";

  const [tab, setTab] = useState("draw");
  const [typedName, setTypedName] = useState("");
  const [hasDrawing, setHasDrawing] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [attested, setAttested] = useState(false);
  const [signed, setSigned] = useState(false);
  const [page, setPage] = useState(1);
  const [signedAt, setSignedAt] = useState<string>("");
  const [hash] = useState(fakeHash);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "currentColor";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawing(true);
  }

  function end() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  const hasSignature = tab === "draw" ? hasDrawing : typedName.trim().length > 1;
  const otpValid = /^\d{6}$/.test(otp);
  const canSign = !restricted && hasSignature && otpSent && otpValid && attested;

  function sendOtp() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setOtpSent(true);
    toast.success(`OTP sent to ${email}`);
  }

  function handleSign() {
    setSignedAt(new Date().toISOString());
    setSigned(true);
    toast.success("Document signed successfully");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Home className="size-4" />
            </span>
            <span className="font-display text-sm font-semibold">Dream Supreme Properties</span>
          </Link>
          <span className="text-xs text-muted-foreground">Secure Signing Session</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">Review & Sign Document</h1>
            <p className="mt-1 text-sm text-muted-foreground">DSP-2026-0141 &middot; Offer to Purchase</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">Demo: category</span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {restrictedCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {restricted && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold">Wet-ink signature required</p>
              <p className="mt-0.5 text-xs">
                Under the Electronic Communications and Transactions Act, "{category}" is an excluded category and
                cannot be signed electronically. This document requires a wet-ink signature. Please print, sign, and
                upload a scanned copy.
              </p>
            </div>
          </div>
        )}

        {signed ? (
          <SuccessCard
            signatureDataUrl={tab === "draw" ? canvasRef.current?.toDataURL() : undefined}
            typedName={tab === "type" ? typedName : undefined}
            signedAt={signedAt}
            hash={hash}
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <DocumentPreview page={page} setPage={setPage} />

            <GlassCard className={cn(restricted && "pointer-events-none opacity-50")}>
              <h2 className="mb-3 font-display text-base font-semibold">Your Signature</h2>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="draw">Draw Signature</TabsTrigger>
                  <TabsTrigger value="type">Type Signature</TabsTrigger>
                </TabsList>
                <TabsContent value="draw" className="mt-3">
                  <div className="rounded-lg border border-border bg-card text-foreground">
                    <canvas
                      ref={canvasRef}
                      width={480}
                      height={160}
                      className="h-40 w-full cursor-crosshair touch-none rounded-lg"
                      onMouseDown={start}
                      onMouseMove={move}
                      onMouseUp={end}
                      onMouseLeave={end}
                      onTouchStart={start}
                      onTouchMove={move}
                      onTouchEnd={end}
                    />
                  </div>
                  <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={clearCanvas}>
                    <Eraser className="size-3.5" /> Clear
                  </Button>
                </TabsContent>
                <TabsContent value="type" className="mt-3">
                  <Input
                    placeholder="Type your full name"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                  />
                  <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-border bg-muted/40 px-4">
                    <p style={{ fontFamily: "cursive" }} className="truncate text-3xl text-foreground">
                      {typedName || "Your signature"}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <div>
                  <Label htmlFor="email" className="text-xs">Email address</Label>
                  <div className="mt-1 flex gap-2">
                    <Input id="email" type="email" placeholder="you@example.co.za" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Button variant="outline" onClick={sendOtp} className="shrink-0">Send OTP</Button>
                  </div>
                </div>
                {otpSent && (
                  <div>
                    <Label htmlFor="otp" className="text-xs">Enter 6-digit OTP</Label>
                    <Input id="otp" inputMode="numeric" maxLength={6} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} className="mt-1 font-mono tracking-widest" />
                  </div>
                )}
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={attested} onCheckedChange={(v) => setAttested(!!v)} className="mt-0.5" />
                  <span>
                    I confirm that I have read and understood this document and intend this electronic signature to
                    be my legally binding signature, in accordance with the ECT Act 25 of 2002.
                  </span>
                </label>
              </div>

              <Button className="mt-4 w-full gap-2" size="lg" disabled={!canSign} onClick={handleSign}>
                <ShieldCheck className="size-4" /> Sign Document
              </Button>
            </GlassCard>
          </div>
        )}
      </main>
    </div>
  );
}

function DocumentPreview({ page, setPage }: { page: number; setPage: (n: number) => void }) {
  const totalPages = 4;
  return (
    <GlassCard className="flex flex-col">
      <div className="mx-auto w-full max-w-md rounded-md border border-border bg-card p-8 shadow-sm" style={{ aspectRatio: "1 / 1.41" }}>
        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">Dream Supreme Properties</p>
        <h2 className="mt-4 text-center font-display text-lg font-bold">Offer to Purchase</h2>
        <p className="mt-1 text-center text-xs text-muted-foreground">Immovable Property — Sectional / Freehold</p>
        <div className="mt-6 space-y-3 text-[11px] leading-relaxed text-foreground/80">
          <p><span className="font-semibold">1. Parties.</span> The undersigned Purchaser hereby offers to purchase from the Seller the property known as 12 Aloe Ridge Close, Bryanston, Johannesburg, on the terms set out below.</p>
          <p><span className="font-semibold">2. Purchase Price.</span> The purchase price shall be R 4,250,000.00 (Four Million Two Hundred and Fifty Thousand Rand) payable as set out in clause 3.</p>
          <p><span className="font-semibold">3. Deposit.</span> A deposit of R 850,000.00 shall be paid into the trust account of the conveyancing attorneys within 7 (seven) days of acceptance.</p>
          <p><span className="font-semibold">4. Occupation.</span> Occupation shall be given and taken on registration of transfer, alternatively as agreed in writing between the parties.</p>
          <p><span className="font-semibold">5. Conditions.</span> This offer is subject to the Purchaser obtaining a mortgage bond in the amount of R 3,400,000.00 within 20 (twenty) business days.</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-dashed border-border pt-4 text-[10px] text-muted-foreground">
          <div>
            <p className="mb-6">Seller signature:</p>
            <div className="h-px bg-border" />
          </div>
          <div>
            <p className="mb-6">Purchaser signature:</p>
            <div className="h-px bg-border" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-center gap-3">
        <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
        <Button size="icon" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </GlassCard>
  );
}

function SuccessCard({
  signatureDataUrl,
  typedName,
  signedAt,
  hash,
}: {
  signatureDataUrl?: string;
  typedName?: string;
  signedAt: string;
  hash: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <GlassCard className="mx-auto max-w-lg border-success/30 bg-success/5 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <h2 className="mt-3 font-display text-xl font-semibold">Document Signed</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your electronic signature has been recorded and applied to the document.</p>

        <div className="mx-auto mt-4 flex h-20 max-w-xs items-center justify-center rounded-lg border border-border bg-card">
          {signatureDataUrl ? (
            <img src={signatureDataUrl} alt="Your signature" className="h-full object-contain" />
          ) : (
            <p style={{ fontFamily: "cursive" }} className="text-2xl">{typedName}</p>
          )}
        </div>

        <dl className="mt-4 space-y-1.5 text-left text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Signed at</dt>
            <dd className="money font-medium">{dateTimeFmt(signedAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Document hash (SHA-256)</dt>
            <dd className="money max-w-[220px] truncate font-medium" title={hash}>{hash}</dd>
          </div>
        </dl>
      </GlassCard>
    </motion.div>
  );
}
