import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Designer } from "@pdfme/ui";
import type { Template } from "@pdfme/common";
import { PDF_PLUGINS } from "@/lib/pdf-plugins";

export interface PdfTemplateDesignerHandle {
  getTemplate: () => Template;
}

// Wraps pdfme's vanilla-JS Designer class (it mounts imperatively to a DOM
// node, it isn't a React component) in a ref-driven React component. The
// designer is created once per mount and torn down on unmount; `template`
// is only read at mount time (not re-applied on prop changes) — callers
// that need a fresh template should remount via a `key` change instead of
// relying on this component to react to prop updates.
export const PdfTemplateDesigner = forwardRef<PdfTemplateDesignerHandle, { template: Template }>(
  function PdfTemplateDesigner({ template }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const designerRef = useRef<Designer | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;
      const designer = new Designer({
        domContainer: containerRef.current,
        template,
        plugins: PDF_PLUGINS,
      });
      designerRef.current = designer;
      return () => {
        designer.destroy();
        designerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      getTemplate: () => {
        if (!designerRef.current) throw new Error("Designer is not ready yet.");
        return designerRef.current.getTemplate() as Template;
      },
    }));

    return (
      <div
        ref={containerRef}
        className="h-[75vh] w-full overflow-hidden rounded-lg border border-border"
      />
    );
  },
);
