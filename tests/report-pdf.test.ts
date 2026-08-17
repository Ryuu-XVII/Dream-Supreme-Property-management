import { describe, it, expect } from "vitest";
import { buildReportPdf } from "../src/lib/report-pdf";

describe("Report PDF generation", () => {
  it("produces a valid multi-section PDF with header, KPIs, chart, and table", () => {
    const doc = buildReportPdf({
      title: "Commission Report",
      subtitle: "Live database records",
      filename: "test.pdf",
      kpis: [
        { label: "Records", value: "3" },
        { label: "Total exposure", value: "R 450,000.00" },
      ],
      chart: {
        title: "Gross commission by agent",
        series: [
          { label: "Jane Smith", value: 250000 },
          { label: "John Doe", value: 200000 },
        ],
        valueFormatter: (v) => `R ${(v / 100).toFixed(0)}`,
      },
      table: {
        columns: ["Reference", "Agent", "Gross commission"],
        rows: [
          ["DSP-2026-00001", "Jane Smith", "R 2,500.00"],
          ["DSP-2026-00002", "John Doe", "R 2,000.00"],
        ],
      },
    });

    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));

    // A structurally valid PDF always starts with this magic header and is
    // non-trivial in size once a header band, KPI boxes, a bar chart, and an
    // autoTable have actually been drawn onto it.
    expect(header).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(2000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("handles an empty table without throwing and still renders a valid PDF", () => {
    const doc = buildReportPdf({
      title: "Fall-through Report",
      filename: "empty.pdf",
      table: { columns: ["Reference"], rows: [] },
    });

    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));
    expect(header).toBe("%PDF-");
  });

  it("renders correctly with no optional sections at all", () => {
    const doc = buildReportPdf({ title: "Reports Overview", filename: "bare.pdf" });
    const bytes = doc.output("arraybuffer") as ArrayBuffer;
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));
    expect(header).toBe("%PDF-");
  });
});
