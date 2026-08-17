import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Shared brand template for every generated report PDF, so every export
// looks like it came from the same document family regardless of which
// report screen produced it.
const BRAND_GOLD: [number, number, number] = [235, 179, 45];
const INK: [number, number, number] = [26, 32, 44];
const MUTED: [number, number, number] = [107, 114, 128];
const LINE: [number, number, number] = [225, 225, 230];
const SUCCESS: [number, number, number] = [16, 185, 129];
const DANGER: [number, number, number] = [239, 68, 68];

const PAGE_WIDTH = 595.28; // A4 at 72dpi (pt)
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface ReportPdfKpi {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}

export interface ReportPdfChartSeries {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
}

export interface ReportPdfChart {
  title: string;
  series: ReportPdfChartSeries[];
  valueFormatter?: (value: number) => string;
}

export interface ReportPdfTable {
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportPdfOptions {
  title: string;
  subtitle?: string;
  kpis?: ReportPdfKpi[];
  chart?: ReportPdfChart;
  table?: ReportPdfTable;
  filename: string;
}

function toneColor(tone: "default" | "success" | "danger" | undefined): [number, number, number] {
  if (tone === "success") return SUCCESS;
  if (tone === "danger") return DANGER;
  return BRAND_GOLD;
}

function drawHeader(doc: jsPDF, title: string, subtitle: string | undefined) {
  doc.setFillColor(...BRAND_GOLD);
  doc.rect(0, 0, PAGE_WIDTH, 84, "F");

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("DREAM SUPREME PROPERTIES", MARGIN, 30);

  doc.setFontSize(19);
  doc.text(title, MARGIN, 54);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const generated = `Generated ${new Date().toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  doc.text(generated, PAGE_WIDTH - MARGIN, 30, { align: "right" });
  if (subtitle) {
    doc.text(subtitle, PAGE_WIDTH - MARGIN, 44, { align: "right", maxWidth: 220 });
  }

  return 104; // next content y
}

function drawKpis(doc: jsPDF, kpis: ReportPdfKpi[], y: number): number {
  const gap = 12;
  const boxWidth = (CONTENT_WIDTH - gap * (kpis.length - 1)) / kpis.length;
  const boxHeight = 54;

  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (boxWidth + gap);
    doc.setFillColor(247, 247, 249);
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, y, boxWidth, boxHeight, 4, 4, "FD");

    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(kpi.label.toUpperCase(), x + 10, y + 18, { maxWidth: boxWidth - 20 });

    doc.setTextColor(...toneColor(kpi.tone));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(kpi.value, x + 10, y + 40, { maxWidth: boxWidth - 20 });
  });

  return y + boxHeight + 28;
}

function drawChart(doc: jsPDF, chart: ReportPdfChart, y: number): number {
  const formatValue = chart.valueFormatter ?? ((v: number) => String(v));
  const series = chart.series.slice(0, 10);
  if (series.length === 0) return y;

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(chart.title, MARGIN, y);
  y += 18;

  const chartHeight = 150;
  const chartTop = y;
  const chartBottom = y + chartHeight;
  const maxValue = Math.max(...series.map((s) => s.value), 1);

  doc.setDrawColor(...LINE);
  doc.line(MARGIN, chartBottom, MARGIN + CONTENT_WIDTH, chartBottom);

  const gap = 10;
  const barWidth = (CONTENT_WIDTH - gap * (series.length - 1)) / series.length;

  series.forEach((s, i) => {
    const barHeight = Math.max((s.value / maxValue) * (chartHeight - 24), 2);
    const x = MARGIN + i * (barWidth + gap);
    const barY = chartBottom - barHeight;

    doc.setFillColor(...toneColor(s.tone));
    doc.rect(x, barY, barWidth, barHeight, "F");

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(formatValue(s.value), x + barWidth / 2, barY - 4, {
      align: "center",
      maxWidth: barWidth + gap,
    });

    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const label = s.label.length > 14 ? `${s.label.slice(0, 13)}…` : s.label;
    doc.text(label, x + barWidth / 2, chartTop + chartHeight + 12, {
      align: "center",
      maxWidth: barWidth + gap,
    });
  });

  return chartBottom + 34;
}

function drawFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.line(MARGIN, PAGE_HEIGHT - 36, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 36);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Dream Supreme Properties — Confidential", MARGIN, PAGE_HEIGHT - 22);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 22, {
      align: "right",
    });
  }
}

// Builds the PDF document without triggering a browser download, so the
// layout logic can be exercised in tests (jsPDF's save() reaches for browser
// APIs that don't exist under Node).
export function buildReportPdf(opts: ReportPdfOptions): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  let y = drawHeader(doc, opts.title, opts.subtitle);

  if (opts.kpis && opts.kpis.length > 0) {
    y = drawKpis(doc, opts.kpis, y);
  }

  if (opts.chart && opts.chart.series.length > 0) {
    y = drawChart(doc, opts.chart, y);
  }

  if (opts.table && opts.table.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [opts.table.columns],
      body: opts.table.rows,
      styles: { fontSize: 8.5, cellPadding: 6, textColor: INK, lineColor: LINE },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 249, 251] },
    });
  } else if (opts.table) {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("No matching records for this report.", MARGIN, y);
  }

  drawFooters(doc);
  return doc;
}

export function generateReportPdf(opts: ReportPdfOptions): void {
  const doc = buildReportPdf(opts);
  doc.save(opts.filename);
}
