import { BLANK_A4_PDF } from "@pdfme/common";
import type { Template } from "@pdfme/common";
import type { PdfDocumentTypeDef } from "@/lib/pdf-document-types";

// Shared visual language for every default template: a navy/gold palette
// that reads as formal agency paperwork rather than app UI, since these are
// printed/signed documents, not screens. All positions are in millimeters
// on an A4 page (210 x 297mm, matching BLANK_A4_PDF's 10mm padding).
const COLOR = {
  navy: "#1E3A5F",
  navyDark: "#152A46",
  gold: "#B08A3D",
  ink: "#111827",
  muted: "#6B7280",
  border: "#D9D9D9",
  white: "#FFFFFF",
  cream: "#F7F4EE",
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

interface TextOptions {
  fontSize?: number;
  fontColor?: string;
  alignment?: "left" | "center" | "right" | "justify";
  characterSpacing?: number;
  lineHeight?: number;
  /**
   * @pdfme/generator only ever reads a text schema's static `content` when
   * `readOnly` is true; otherwise it reads exclusively from `inputs[name]`
   * and renders empty if that key is absent (see generator/dist/index.js:361
   * — `schema.readOnly ? content : input[name] || ""`). Every label, title,
   * and other decorative text in these layouts must stay `readOnly: true`
   * (the default here) since it's never included in `inputs`. Only the four
   * merge-field call sites below pass `readOnly: false` explicitly, so
   * @pdfme/generator's caller-supplied `inputs[name]` actually reaches them.
   */
  readOnly?: boolean;
}

function text(
  name: string,
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: TextOptions = {},
) {
  return {
    name,
    type: "text",
    content,
    position: { x, y },
    width,
    height,
    fontSize: opts.fontSize ?? 10,
    alignment: opts.alignment ?? "left",
    verticalAlignment: "top" as const,
    lineHeight: opts.lineHeight ?? 1.3,
    characterSpacing: opts.characterSpacing ?? 0,
    fontColor: opts.fontColor ?? COLOR.ink,
    backgroundColor: "",
    readOnly: opts.readOnly ?? true,
  };
}

function shape(
  type: "rectangle" | "ellipse",
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { borderWidth?: number; borderColor?: string; color?: string } = {},
) {
  return {
    name,
    type,
    content: "",
    position: { x, y },
    width,
    height,
    borderWidth: opts.borderWidth ?? 0,
    borderColor: opts.borderColor ?? COLOR.border,
    color: opts.color ?? "",
  };
}

function rect(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { borderWidth?: number; borderColor?: string; color?: string } = {},
) {
  return shape("rectangle", name, x, y, width, height, opts);
}

function ellipse(
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { borderWidth?: number; borderColor?: string; color?: string } = {},
) {
  return shape("ellipse", name, x, y, width, height, opts);
}

function hline(name: string, x: number, y: number, width: number, color = COLOR.border) {
  return {
    name,
    type: "line",
    content: "",
    position: { x, y },
    width,
    height: 0.6,
    color,
  };
}

let staticId = 0;
function staticName(prefix: string) {
  staticId += 1;
  return `_${prefix}_${staticId}`;
}

function header(doc: PdfDocumentTypeDef, height = 32) {
  return [
    rect(staticName("hdr_bg"), 0, 0, PAGE_WIDTH, height, { color: COLOR.navyDark }),
    text(staticName("hdr_brand"), "DREAM SUPREME PROPERTIES", MARGIN, 9, CONTENT_WIDTH, 6, {
      fontSize: 9.5,
      fontColor: COLOR.white,
      characterSpacing: 2,
    }),
    text(staticName("hdr_title"), doc.label, MARGIN, 16, CONTENT_WIDTH, 12, {
      fontSize: 19,
      fontColor: COLOR.white,
    }),
    rect(staticName("hdr_rule"), 0, height, PAGE_WIDTH, 1.2, { color: COLOR.gold }),
  ];
}

function buildBarChart(
  entries: { label: string; value: number }[],
  x: number,
  y: number,
  width: number,
  height: number,
  opts: { formatValue?: (v: number) => string; barColor?: string } = {},
) {
  if (entries.length === 0) return [];

  const gap = 4;
  const barWidth = (width - gap * (entries.length - 1)) / entries.length;
  const labelHeight = 12;
  const valueHeight = 6;
  const plotHeight = height - labelHeight - valueHeight;
  const baseline = y + valueHeight + plotHeight;
  const maxValue = Math.max(...entries.map((e) => e.value), 1);
  const formatValue = opts.formatValue ?? ((v: number) => String(v));
  const barColor = opts.barColor ?? COLOR.navy;

  const schemas: Record<string, unknown>[] = [
    hline(staticName("chart_axis"), x, baseline, width, COLOR.border),
  ];

  entries.forEach((entry, index) => {
    const barX = x + index * (barWidth + gap);
    const barHeight = (entry.value / maxValue) * plotHeight;
    const barY = baseline - barHeight;
    if (barHeight > 0.5) {
      schemas.push(
        rect(staticName(`bar_${index}`), barX, barY, barWidth, barHeight, { color: barColor }),
      );
    }
    schemas.push(
      text(
        staticName(`bar_value_${index}`),
        formatValue(entry.value),
        barX,
        Math.max(y, barY - valueHeight),
        barWidth,
        valueHeight,
        { fontSize: 7, fontColor: COLOR.navy, alignment: "center" },
      ),
    );
    schemas.push(
      text(
        staticName(`bar_label_${index}`),
        entry.label,
        barX,
        baseline + 2,
        barWidth,
        labelHeight,
        { fontSize: 6.5, fontColor: COLOR.muted, alignment: "center", lineHeight: 1.15 },
      ),
    );
  });

  return schemas;
}

function footer(note: string) {
  return [
    hline(staticName("ftr_rule"), MARGIN, PAGE_HEIGHT - 16, CONTENT_WIDTH, COLOR.border),
    text(staticName("ftr_note"), note, MARGIN, PAGE_HEIGHT - 13, CONTENT_WIDTH, 8, {
      fontSize: 7.5,
      fontColor: COLOR.muted,
      alignment: "center",
    }),
  ];
}

/**
 * Two-party contract layout: header band, a labelled field grid (each
 * sampleInput key becomes one merge-field text schema, name === key, so
 * @pdfme/generator's `inputs` can target it directly), and a signature block.
 * Used for Offer to Purchase, Mandate Agreement, and Lease Agreement.
 */
export function buildLegalTemplate(doc: PdfDocumentTypeDef): Template {
  const fields = Object.entries(doc.sampleInput);
  const rowHeight = 18;
  const colWidth = (CONTENT_WIDTH - 10) / 2;
  const gridTop = 46;

  const fieldSchemas = fields.flatMap(([key, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + col * (colWidth + 10);
    const y = gridTop + row * rowHeight;
    return [
      text(staticName(`lbl_${key}`), humanize(key).toUpperCase(), x, y, colWidth, 4, {
        fontSize: 7.5,
        fontColor: COLOR.gold,
        characterSpacing: 1,
      }),
      text(key, value, x, y + 4.5, colWidth, 8, {
        fontSize: 11.5,
        fontColor: COLOR.ink,
        readOnly: false,
      }),
    ];
  });

  const rows = Math.ceil(fields.length / 2);
  const notesY = gridTop + rows * rowHeight + 10;
  const notesHeight = 46;
  const signatureY = notesY + notesHeight + 26;

  return {
    basePdf: BLANK_A4_PDF,
    schemas: [
      [
        ...header(doc),
        text(
          staticName("intro"),
          "This document is auto-generated from live deal data and reflects the terms captured in the platform at the time of generation.",
          MARGIN,
          38,
          CONTENT_WIDTH,
          8,
          { fontSize: 8.5, fontColor: COLOR.muted },
        ),
        ...fieldSchemas,
        text(
          staticName("notes_title"),
          "ADDITIONAL NOTES / SPECIAL CONDITIONS",
          MARGIN,
          notesY,
          CONTENT_WIDTH,
          4,
          { fontSize: 7.5, fontColor: COLOR.gold, characterSpacing: 1 },
        ),
        rect(staticName("notes_box"), MARGIN, notesY + 5, CONTENT_WIDTH, notesHeight, {
          borderWidth: 0.5,
          borderColor: COLOR.border,
        }),
        hline(staticName("sig_rule"), MARGIN, signatureY - 12, CONTENT_WIDTH, COLOR.border),
        text(staticName("sig_title"), "SIGNATURES", MARGIN, signatureY - 8, CONTENT_WIDTH, 5, {
          fontSize: 8,
          fontColor: COLOR.gold,
          characterSpacing: 1.5,
        }),
        hline(staticName("sig_line_1"), MARGIN, signatureY + 14, colWidth, COLOR.ink),
        text(
          staticName("sig_label_1"),
          "Seller / Landlord — Signature & Date",
          MARGIN,
          signatureY + 16,
          colWidth,
          5,
          { fontSize: 8, fontColor: COLOR.muted },
        ),
        hline(
          staticName("sig_line_2"),
          MARGIN + colWidth + 10,
          signatureY + 14,
          colWidth,
          COLOR.ink,
        ),
        text(
          staticName("sig_label_2"),
          "Purchaser / Tenant — Signature & Date",
          MARGIN + colWidth + 10,
          signatureY + 16,
          colWidth,
          5,
          { fontSize: 8, fontColor: COLOR.muted },
        ),
        ...footer("Generated by Dream Supreme Properties · This is a system-generated document."),
      ],
    ],
  } as Template;
}

/**
 * Formal certificate layout: decorative double border, centered title and
 * seal, field list centered in a single column. Used for the Deal
 * Registration Certificate and the FFC Certificate cover sheet.
 */
export function buildCertificateTemplate(doc: PdfDocumentTypeDef): Template {
  const fields = Object.entries(doc.sampleInput);
  const listTop = 100;
  const rowHeight = 14;
  const colX = 45;
  const colWidth = PAGE_WIDTH - colX * 2;

  const fieldSchemas = fields.flatMap(([key, value], index) => {
    const y = listTop + index * rowHeight;
    return [
      text(staticName(`lbl_${key}`), humanize(key).toUpperCase(), colX, y, colWidth, 4, {
        fontSize: 7.5,
        fontColor: COLOR.gold,
        alignment: "center",
        characterSpacing: 1.5,
      }),
      text(key, value, colX, y + 4.5, colWidth, 8, {
        fontSize: 12,
        fontColor: COLOR.ink,
        alignment: "center",
        readOnly: false,
      }),
    ];
  });

  const sealY = listTop + fields.length * rowHeight + 16;

  return {
    basePdf: BLANK_A4_PDF,
    schemas: [
      [
        rect(staticName("frame_outer"), 8, 8, PAGE_WIDTH - 16, PAGE_HEIGHT - 16, {
          borderWidth: 1.4,
          borderColor: COLOR.gold,
        }),
        rect(staticName("frame_inner"), 12, 12, PAGE_WIDTH - 24, PAGE_HEIGHT - 24, {
          borderWidth: 0.5,
          borderColor: COLOR.navy,
        }),
        text(staticName("eyebrow"), "DREAM SUPREME PROPERTIES", 30, 32, PAGE_WIDTH - 60, 6, {
          fontSize: 9.5,
          fontColor: COLOR.muted,
          alignment: "center",
          characterSpacing: 2.5,
        }),
        text(staticName("title"), doc.label.toUpperCase(), 25, 44, PAGE_WIDTH - 50, 20, {
          fontSize: 21,
          fontColor: COLOR.navy,
          alignment: "center",
          characterSpacing: 1,
        }),
        rect(staticName("rule_l"), 60, 70, 30, 0.8, { color: COLOR.gold }),
        rect(staticName("rule_r"), PAGE_WIDTH - 90, 70, 30, 0.8, { color: COLOR.gold }),
        text(
          staticName("caption"),
          "This certifies the details recorded below on the Dream Supreme Properties platform.",
          35,
          80,
          PAGE_WIDTH - 70,
          10,
          { fontSize: 9, fontColor: COLOR.muted, alignment: "center" },
        ),
        ...fieldSchemas,
        ellipse(staticName("seal"), PAGE_WIDTH / 2 - 12, sealY, 24, 24, {
          borderWidth: 1,
          borderColor: COLOR.gold,
          color: COLOR.cream,
        }),
        text(staticName("seal_text"), "DS", PAGE_WIDTH / 2 - 12, sealY + 7, 24, 10, {
          fontSize: 13,
          fontColor: COLOR.gold,
          alignment: "center",
        }),
        text(
          staticName("issued"),
          "Issued by Dream Supreme Properties — this is a system-generated certificate.",
          25,
          PAGE_HEIGHT - 26,
          PAGE_WIDTH - 50,
          8,
          { fontSize: 7.5, fontColor: COLOR.muted, alignment: "center" },
        ),
      ],
    ],
  } as Template;
}

// Fixed geometry shared between buildReportTemplate (building the default
// layout) and useDownloadPdfFromTemplate/useGeneratePdfDocument (which need
// to know exactly where the chart region sits in order to replace it with
// real data at generate time, even inside a template an admin customized).
export const REPORT_TILES_TOP = 52;
export const REPORT_TILE_HEIGHT = 32;
export const REPORT_CHART_SECTION_Y = REPORT_TILES_TOP + REPORT_TILE_HEIGHT + 12;

function reportValueFormat(v: number): string {
  return v >= 1000 ? `R ${(v / 1000).toFixed(0)}k` : v.toLocaleString();
}

/**
 * The "Breakdown" title plus its bar chart, at the fixed position reports
 * always place it. Every schema name here starts with `_chart_` or `_bar_`
 * so callers can find and strip a previous instance of this section (e.g.
 * the sample data baked into a saved template) before inserting a fresh one
 * built from real data — see stripReportChartSchemas below.
 */
export function buildReportBreakdownSchemas(chartData: { label: string; value: number }[]) {
  if (chartData.length === 0) return [];
  return [
    text(
      staticName("chart_section"),
      "Breakdown",
      MARGIN,
      REPORT_CHART_SECTION_Y,
      CONTENT_WIDTH,
      6,
      {
        fontSize: 12,
        fontColor: COLOR.navy,
      },
    ),
    ...buildBarChart(chartData, MARGIN, REPORT_CHART_SECTION_Y + 10, CONTENT_WIDTH, 70, {
      formatValue: reportValueFormat,
    }),
  ];
}

// Removes any existing "Breakdown" title/bars from a report template's first
// page — whether the sample ones baked in by buildReportTemplate or ones an
// admin left in place while customizing — so real chart data can replace
// them without leaving stale sample bars behind.
export function stripReportChartSchemas<T extends { name: string }>(schemas: T[]): T[] {
  return schemas.filter((s) => !s.name.startsWith("_chart_") && !s.name.startsWith("_bar_"));
}

// pdfme's Designer lets an admin freely rename or delete a schema's `name`
// on the canvas. generate()'s `inputs` bag is keyed by those exact names
// (see the TextOptions.readOnly comment above), so if a merge field's name
// stops matching one of `doc.sampleInput`'s keys, that field silently stops
// getting real data at generate time — it just renders blank, with nothing
// to surface the mistake. Called before save so the admin finds out then,
// not the next time someone generates a document.
export function findMissingMergeFields(doc: PdfDocumentTypeDef, template: Template): string[] {
  const presentNames = new Set(
    template.schemas.flatMap((page) => page.map((schema) => schema.name)),
  );
  return Object.keys(doc.sampleInput).filter((key) => !presentNames.has(key));
}

/**
 * Executive-summary cover layout for the analytics reports: header band with
 * the generated date pinned top-right, then the remaining sample fields as
 * KPI stat tiles. Used for the four Reports document types.
 */
export function buildReportTemplate(doc: PdfDocumentTypeDef): Template {
  const entries = Object.entries(doc.sampleInput);
  const generatedEntry = entries.find(([key]) => key === "generatedOn");
  const tileEntries = entries.filter(([key]) => key !== "generatedOn");

  const tileGap = 8;
  const tileWidth = (CONTENT_WIDTH - tileGap * 2) / 3;
  const tileHeight = REPORT_TILE_HEIGHT;
  const tilesTop = REPORT_TILES_TOP;

  const tileSchemas = tileEntries.flatMap(([key, value], index) => {
    const x = MARGIN + index * (tileWidth + tileGap);
    const y = tilesTop;
    return [
      rect(staticName(`tile_${key}`), x, y, tileWidth, tileHeight, {
        borderWidth: 0.75,
        borderColor: COLOR.border,
      }),
      rect(staticName(`tile_accent_${key}`), x, y, tileWidth, 1.5, { color: COLOR.gold }),
      text(key, value, x + 5, y + 8, tileWidth - 10, 14, {
        fontSize: 15,
        fontColor: COLOR.navy,
        readOnly: false,
      }),
      text(
        staticName(`tile_label_${key}`),
        humanize(key).toUpperCase(),
        x + 5,
        y + tileHeight - 10,
        tileWidth - 10,
        6,
        { fontSize: 6.5, fontColor: COLOR.muted, characterSpacing: 0.6 },
      ),
    ];
  });

  return {
    basePdf: BLANK_A4_PDF,
    schemas: [
      [
        ...header(doc, 30),
        ...(generatedEntry
          ? [
              text(
                staticName("generated_lbl"),
                "GENERATED ON",
                PAGE_WIDTH - MARGIN - 80,
                8,
                80,
                4,
                { fontSize: 7, fontColor: COLOR.gold, alignment: "right", characterSpacing: 1 },
              ),
              text(generatedEntry[0], generatedEntry[1], PAGE_WIDTH - MARGIN - 80, 12, 80, 6, {
                fontSize: 9.5,
                fontColor: COLOR.white,
                alignment: "right",
                readOnly: false,
              }),
            ]
          : []),
        text(staticName("section"), "Executive Summary", MARGIN, 40, CONTENT_WIDTH, 6, {
          fontSize: 12,
          fontColor: COLOR.navy,
        }),
        ...tileSchemas,
        ...buildReportBreakdownSchemas(doc.chartData ?? []),
        text(
          staticName("body_note"),
          "The full itemized breakdown follows on subsequent pages when exported from Reports.",
          MARGIN,
          tilesTop + tileHeight + (doc.chartData && doc.chartData.length > 0 ? 104 : 12),
          CONTENT_WIDTH,
          10,
          { fontSize: 9, fontColor: COLOR.muted },
        ),
        ...footer("Generated by Dream Supreme Properties · Report cover sheet"),
      ],
    ],
  } as Template;
}
