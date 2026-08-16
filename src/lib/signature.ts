import { useEffect, useRef } from "react";
import SignaturePad from "signature_pad";

/**
 * Thin wrapper around signature_pad for the click-to-sign flow. The signer
 * on /sign has no Supabase Auth session (they arrive via a one-time token),
 * so the captured signature can't go through uploadFileToR2 — that helper
 * requires an active auth session (src/lib/storage.ts). Instead the drawn
 * signature is serialized to SVG and sent straight to submit_esign_signature,
 * which stores it in esign_audit_log.signature_svg.
 */
export function useSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const pad = new SignaturePad(canvasRef.current, {
      backgroundColor: "rgba(255, 255, 255, 0)",
    });
    padRef.current = pad;
    return () => pad.off();
  }, []);

  return {
    canvasRef,
    clear: () => padRef.current?.clear(),
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toSVG: () => padRef.current?.toSVG() ?? "",
  };
}
