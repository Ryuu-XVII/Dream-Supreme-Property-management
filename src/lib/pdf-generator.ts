import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  periodText?: string;
  agencyName?: string;
  summaryKpis?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

/**
 * Generates a clean, professional B2B Real Estate PDF Document with official agency letterhead,
 * executive KPI summary cards, structured data tables, and PPRA regulatory signature blocks.
 */
export function generateProfessionalPdf(options: PdfReportOptions): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const agency = options.agencyName || "DREAM SUPREME PROPERTIES";
  const title = options.title.toUpperCase();
  const period = options.periodText || `Generated on ${new Date().toLocaleDateString("en-ZA")}`;

  // Palette
  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [14, 116, 144]; // Cyan 700
  const mutedColor = [100, 116, 139]; // Slate 500

  // --- 1. LETTERHEAD & HEADER ---
  // Top Decorative Bar
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, 210, 5, "F");

  // Agency Brand Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(agency, 14, 18);

  // Subtitle / License
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
  doc.text("B2B Real Estate Operations & Trust Account Management Platform", 14, 23);
  doc.text("Registered with the Property Practitioners Regulatory Authority (PPRA)", 14, 27);

  // Date / Period Right-Aligned
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(period, 196, 18, { align: "right" });

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 31, 196, 31);

  // --- 2. REPORT TITLE BANNER ---
  let currentY = 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(title, 14, currentY);

  currentY += 4;
  if (options.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text(options.subtitle, 14, currentY);
    currentY += 6;
  } else {
    currentY += 4;
  }

  // --- 3. EXECUTIVE KPI CARDS (If provided) ---
  if (options.summaryKpis && options.summaryKpis.length > 0) {
    const kpiCount = options.summaryKpis.length;
    const cardGap = 4;
    const cardWidth = (182 - (kpiCount - 1) * cardGap) / kpiCount;
    const cardHeight = 16;

    options.summaryKpis.forEach((kpi, index) => {
      const xPos = 14 + index * (cardWidth + cardGap);
      // Card Background
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.roundedRect(xPos, currentY, cardWidth, cardHeight, 2, 2, "FD");

      // Label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text(kpi.label.toUpperCase(), xPos + 4, currentY + 5);

      // Value
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(kpi.value, xPos + 4, currentY + 12);
    });

    currentY += cardHeight + 8;
  }

  // --- 4. DATA TABLE ---
  autoTable(doc, {
    startY: currentY,
    head: [options.headers],
    body: options.rows as any[][],
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      // Footer on every page
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text(
        `Page ${data.pageNumber} of ${doc.getNumberOfPages()}  |  Confidential B2B Operational Document`,
        14,
        pageHeight - 10,
      );
      doc.text("Authorized Signature Required for Final Disbursement", 196, pageHeight - 10, {
        align: "right",
      });
    },
  });

  // --- 5. SIGNATURE & APPROVAL BLOCK (Final Page) ---
  const finalY = (doc as any).lastAutoTable
    ? (doc as any).lastAutoTable.finalY + 15
    : currentY + 30;

  if (finalY < 250) {
    doc.setDrawColor(203, 213, 225);
    doc.line(14, finalY, 80, finalY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Principal Property Practitioner", 14, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("Date & Section 86 Authorization Stamp", 14, finalY + 8);

    doc.line(130, finalY, 196, finalY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Managing Agency Auditor", 130, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
    doc.text("Audit Log Verified", 130, finalY + 8);
  }

  // Trigger browser file download
  doc.save(options.filename);
}
