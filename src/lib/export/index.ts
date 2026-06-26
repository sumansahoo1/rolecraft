"use client";

import { toast } from "sonner";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  convertInchesToTwip,
} from "docx";
import { jsPDF } from "jspdf";
import type { ResumeSpec } from "@/types";
import { renderResumeHtml } from "@/lib/latex/render";
import { measureHtmlPageFit } from "@/lib/latex/measure";

export interface ResumeSection {
  heading: string;
  content: string[];
}

const HEADING_PATTERNS = [
  /^(SUMMARY|PROFESSIONAL\s+SUMMARY|PROFILE|PROFESSIONAL\s+PROFILE)$/i,
  /^(EXPERIENCE|WORK\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|EMPLOYMENT|EMPLOYMENT\s+HISTORY)$/i,
  /^(EDUCATION|ACADEMIC\s+BACKGROUND|ACADEMIC\s+HISTORY)$/i,
  /^(SKILLS|TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|TECHNOLOGIES)$/i,
  /^(PROJECTS|PERSONAL\s+PROJECTS|SIDE\s+PROJECTS)$/i,
  /^(CERTIFICATIONS|CERTIFICATES|LICENSURE)$/i,
  /^(ACHIEVEMENTS|AWARDS|HONORS|AWARDS\s+&\s+HONORS)$/i,
  /^(OPEN\s+SOURCE|OPEN\s+SOURCE\s+CONTRIBUTIONS)$/i,
  /^(PUBLICATIONS|PUBLICATIONS\s+&\s+PRESENTATIONS)$/i,
  /^(LANGUAGES)$/i,
  /^(VOLUNTEER|VOLUNTEERING|VOLUNTEER\s+EXPERIENCE)$/i,
  /^(CONTACT|CONTACT\s+INFORMATION)$/i,
];

export function parseResumeSections(text: string): ResumeSection[] {
  const rawLines = text.split("\n");
  const lines = rawLines.filter((l) => l.trim() !== "");
  const sections: ResumeSection[] = [];

  let currentHeading = "";
  let currentContent: string[] = [];
  let firstSection = true;

  for (const line of lines) {
    const trimmed = line.trim();

    const isHeading =
      HEADING_PATTERNS.some((p) => p.test(trimmed)) ||
      (/^[A-Z][A-Z &/()\-]{3,}$/.test(trimmed) && trimmed.length < 40);

    if (isHeading) {
      if (currentContent.length > 0 || firstSection) {
        if (currentHeading || currentContent.length > 0) {
          sections.push({
            heading: currentHeading || "Header",
            content: currentContent,
          });
        }
      }
      currentHeading = trimmed;
      currentContent = [];
      firstSection = false;
    } else {
      currentContent.push(trimmed);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading || "Header",
      content: currentContent,
    });
  }

  if (sections.length === 0) {
    sections.push({ heading: "", content: lines });
  }

  return sections;
}

/** Build resume filename: {name}_{company}_{role}_{DDMMYYYY}_Resume.ext */
export function buildResumeFilename(
  ext: string,
  opts?: {
    name?: string | null;
    company?: string | null;
    role?: string | null;
  }
): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const date = `${dd}${mm}${yyyy}`;

  const parts = [
    opts?.name?.trim(),
    opts?.company?.trim(),
    opts?.role?.trim(),
    date,
  ].filter((p): p is string => Boolean(p));

  return `${parts.join("_")}_Resume.${ext}`;
}

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

export function downloadTxt(
  resume: string,
  filename: string = "rolecraft-resume.txt"
): void {
  const blob = new Blob([resume], { type: "text/plain" });
  triggerDownload(blob, filename);
  toast.success("Downloaded as .txt");
}

export async function downloadDocx(
  resume: string,
  filename: string = "rolecraft-resume.docx"
): Promise<void> {
  const blob = await generateDocxBlob(resume);
  triggerDownload(blob, filename);
  toast.success("Downloaded as .docx");
}

export async function downloadPdf(
  resume: string,
  filename: string = "rolecraft-resume.pdf"
): Promise<void> {
  const blob = await generatePdfBlob(resume);
  triggerDownload(blob, filename);
  toast.success("Downloaded as .pdf");
}

export async function generateDocxBlob(resume: string): Promise<Blob> {
  const sections = parseResumeSections(resume);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: sections.flatMap((section, sectionIndex) => {
          const paragraphs: Paragraph[] = [];

          if (section.heading) {
            paragraphs.push(
              new Paragraph({
                spacing: {
                  before: sectionIndex > 0 ? 300 : 100,
                  after: 120,
                },
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 1,
                    color: "999999",
                    space: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: section.heading,
                    bold: true,
                    size: 28,
                    font: "Calibri",
                  }),
                ],
              })
            );
          }

          for (const line of section.content) {
            paragraphs.push(
              new Paragraph({
                spacing: { after: 60, line: 276 },
                children: [
                  new TextRun({
                    text: line,
                    font: "Calibri",
                    size: 22,
                  }),
                ],
              })
            );
          }

          return paragraphs;
        }),
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export async function generatePdfBlob(resume: string): Promise<Blob> {
  const sections = parseResumeSections(resume);
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;

  let y = margin;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (section.heading) {
      checkPageBreak(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(51, 65, 85);
      doc.text(section.heading, margin, y);
      y += 20;

      doc.setDrawColor(153, 153, 153);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;
    }

    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);

    for (const line of section.content) {
      const splitLines = doc.splitTextToSize(line, maxWidth);
      for (const l of splitLines) {
        checkPageBreak(14);
        doc.text(l as string, margin, y);
        y += 14;
      }
    }

    y += 8;
  }

  return doc.output("blob");
}

/**
 * Generate a compact, single-page PDF from ResumeSpec using jsPDF.
 * Automatically adjusts font sizes to fit content on 1 page.
 * Returns the generated blob and the final y position for verification.
 */
export async function generateSpecPdfBlob(
  spec: ResumeSpec
): Promise<{ blob: Blob; finalY: number; pageHeight: number; marginBottom: number }> {
  // ─── Measure content density via iframe ───
  // Render HTML at default sizing (body 8.5pt, matching the "medium" jsPDF preset)
  // and measure actual overflow via the browser layout engine.
  let bodySize: number;
  let lineSpacing: number;
  let headSize: number;
  let sectionSize: number;
  let nameSize: number;

  try {
    const html = renderResumeHtml(spec);
    const fit = await measureHtmlPageFit(html);
    const ratio =
      fit.pageHeight > 0
        ? (fit.scrollHeight - fit.pageHeight) / fit.pageHeight
        : 0;

    if (ratio <= 0) {
      // Fits comfortably — light
      bodySize = 9; lineSpacing = 12; headSize = 9.5; sectionSize = 10.5; nameSize = 17;
    } else if (ratio < 0.15) {
      // Barely over — medium
      bodySize = 8.5; lineSpacing = 11; headSize = 9; sectionSize = 10; nameSize = 16;
    } else if (ratio < 0.35) {
      // Moderately over — snug
      bodySize = 8; lineSpacing = 10; headSize = 8.5; sectionSize = 9.5; nameSize = 15;
    } else if (ratio < 0.6) {
      // Significantly over — tight
      bodySize = 7.5; lineSpacing = 9; headSize = 8; sectionSize = 9; nameSize = 14;
    } else {
      // Severely over — very tight
      bodySize = 7; lineSpacing = 8.5; headSize = 7.5; sectionSize = 8.5; nameSize = 13;
    }
  } catch {
    // Fallback: measurement failed (iframe unavailable), use medium preset
    bodySize = 8.5; lineSpacing = 11; headSize = 9; sectionSize = 10; nameSize = 16;
  }

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.width; // 612pt
  const pageH = doc.internal.pageSize.height; // 792pt
  const marginX = 42;
  const marginTop = 38;
  const mBottom = 34;
  const maxWidth = pageWidth - marginX * 2;
  let y = marginTop;
  const maxY = pageH - mBottom;

  // Global overflow guard — once tripped, stop rendering body content
  let overflowed = false;

  const willFit = (needed: number): boolean => {
    if (overflowed) return false;
    if (y + needed > maxY) {
      overflowed = true;
      return false;
    }
    return true;
  };

  // ─── Section heading ───
  const sectionHeading = (text: string) => {
    if (overflowed || !willFit(sectionSize + 14)) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionSize);
    doc.setTextColor(30, 41, 59);
    doc.text(text.toUpperCase(), marginX, y);
    y += sectionSize + 4;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 7;
  };

  // ─── Body paragraph ───
  const bodyText = (text: string, indent: number = 0) => {
    if (overflowed) return;
    const x = marginX + indent;
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      if (!willFit(lineSpacing)) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      doc.setTextColor(51, 65, 85);
      doc.text(line as string, x, y);
      y += lineSpacing;
    }
  };

  // ─── Bullet point ───
  const bulletText = (text: string) => {
    if (overflowed) return;
    const bulletX = marginX + 3;
    const textX = marginX + 13;
    const lines = doc.splitTextToSize(text, maxWidth - 13);
    for (let i = 0; i < lines.length; i++) {
      if (!willFit(lineSpacing)) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      doc.setTextColor(51, 65, 85);
      if (i === 0) {
        doc.setFontSize(bodySize - 1);
        doc.setTextColor(100, 116, 139);
        doc.text("•", bulletX, y);
        doc.setFontSize(bodySize);
        doc.setTextColor(51, 65, 85);
      }
      doc.text(lines[i] as string, textX, y);
      y += lineSpacing;
    }
  };

  // ─── Header ───
  const { meta } = spec;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize);
  doc.setTextColor(30, 41, 59);
  doc.text(meta.name || "", pageWidth / 2, y, { align: "center" });
  y += nameSize + 4;

  // Contact line
  const contactParts: string[] = [];
  if (meta.email) contactParts.push(meta.email);
  if (meta.phone) contactParts.push(meta.phone);
  if (meta.location) contactParts.push(meta.location);
  if (meta.linkedin) {
    const h = meta.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "");
    contactParts.push(`linkedin.com/in/${h}`);
  }
  if (meta.github) {
    const h = meta.github.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "");
    contactParts.push(`github.com/${h}`);
  }
  if (meta.portfolio) {
    contactParts.push(meta.portfolio.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  }

  if (contactParts.length > 0) {
    const contactText = contactParts.join("  |  ");
    const contactLines = doc.splitTextToSize(contactText, maxWidth);
    for (const cl of contactLines) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(cl as string, pageWidth / 2, y, { align: "center" });
      y += 10;
    }
  } else {
    y += 4;
  }

  if (meta.targetRole) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(meta.targetRole, pageWidth / 2, y, { align: "center" });
    y += 10;
  }

  y += 4;

  // ─── Summary ───
  if (spec.summary.text && !overflowed) {
    sectionHeading("Summary");
    bodyText(spec.summary.text);
    y += 2;
  }

  // ─── Experience ───
  if (spec.experience.length > 0 && !overflowed) {
    sectionHeading("Experience");
    for (const exp of spec.experience) {
      if (overflowed) break;
      const roleCompany = exp.company
        ? `${exp.role}  |  ${exp.company}`
        : exp.role;
      if (!willFit(headSize + 4)) break;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headSize);
      doc.setTextColor(30, 41, 59);
      doc.text(roleCompany, marginX, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(exp.dates, pageWidth - marginX, y, { align: "right" });
      y += headSize + 3;

      for (const bullet of exp.bullets) {
        if (overflowed) break;
        bulletText(bullet);
      }
      y += 2;
    }
  }

  // ─── Projects ───
  if (spec.projects.length > 0 && !overflowed) {
    sectionHeading("Projects");
    for (const proj of spec.projects) {
      if (overflowed) break;
      if (!willFit(headSize + 3)) break;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headSize);
      doc.setTextColor(30, 41, 59);
      doc.text(proj.name, marginX, y);
      y += headSize + 2;

      for (const bullet of proj.bullets) {
        if (overflowed) break;
        bulletText(bullet);
      }
      y += 2;
    }
  }

  // ─── Skills ───
  if (spec.skills.categories.length > 0 && !overflowed) {
    sectionHeading("Skills");
    for (const cat of spec.skills.categories) {
      if (overflowed) break;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(bodySize);
      doc.setTextColor(30, 41, 59);
      const catLabel = `${cat.name}: `;
      const labelW = doc.getTextWidth(catLabel);
      doc.text(catLabel, marginX, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      const itemsText = cat.items.join(", ");
      const itemsLines = doc.splitTextToSize(itemsText, maxWidth - labelW);
      doc.text(itemsLines[0] as string, marginX + labelW, y);
      for (let i = 1; i < itemsLines.length; i++) {
        if (!willFit(lineSpacing)) break;
        y += lineSpacing;
        doc.text(itemsLines[i] as string, marginX + 4, y);
      }
      y += lineSpacing;
    }
  }

  // ─── Education ───
  if (spec.education.length > 0 && !overflowed) {
    sectionHeading("Education");
    for (const edu of spec.education) {
      if (overflowed) break;
      if (!willFit(lineSpacing)) break;
      const degreeField = [edu.degree, edu.field].filter(Boolean).join(" in ");
      const left = [degreeField, edu.institution].filter(Boolean).join(", ");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      doc.setTextColor(51, 65, 85);
      doc.text(left, marginX, y);

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(edu.year, pageWidth - marginX, y, { align: "right" });
      y += lineSpacing;
    }
  }

  // ─── Optional Sections ───
  if (spec.optionalSections && spec.optionalSections.length > 0 && !overflowed) {
    for (const opt of spec.optionalSections) {
      if (overflowed || !willFit(sectionSize + 20)) break;
      sectionHeading(opt.heading);
      for (const item of opt.items) {
        if (overflowed || !willFit(lineSpacing)) break;
        bulletText(item);
      }
    }
  }

  return {
    blob: doc.output("blob"),
    finalY: y,
    pageHeight: pageH,
    marginBottom: mBottom,
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadLatexPdf(
  spec: ResumeSpec,
  filename: string = "rolecraft-resume.pdf"
): Promise<void> {
  const { blob } = await generateSpecPdfBlob(spec);
  triggerDownload(blob, filename);
  toast.success("Downloaded as PDF");
}

export function downloadTex(
  tex: string,
  filename: string = "rolecraft-resume.tex"
): void {
  const blob = new Blob([tex], { type: "application/x-tex" });
  triggerDownload(blob, filename);
  toast.success("Downloaded as .tex");
}
