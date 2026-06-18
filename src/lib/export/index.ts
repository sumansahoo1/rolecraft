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
  spec: ResumeSpec,
  _filename?: string
): Promise<{ blob: Blob; finalY: number; pageHeight: number; marginBottom: number }> {
  // ─── Calculate content density ───
  const totalBullets =
    spec.experience.reduce((sum, e) => sum + e.bullets.length, 0) +
    spec.projects.reduce((sum, p) => sum + p.bullets.length, 0) +
    (spec.optionalSections?.reduce((sum, o) => sum + o.items.length, 0) ?? 0);

  const totalBulletLines = totalBullets; // rough: 1 bullet = 1 line (some wrap)
  const summaryLines = spec.summary.text
    ? Math.ceil(spec.summary.text.length / 110)
    : 0;
  const expCount = spec.experience.length;
  const projCount = spec.projects.length;
  const skillCategories = spec.skills.categories.length;
  const eduCount = spec.education.length;
  const optSectionCount = spec.optionalSections?.length ?? 0;

  // Density score: higher = more content to squeeze
  const densityScore =
    totalBulletLines * 1.2 +
    summaryLines * 0.8 +
    expCount * 3 +
    projCount * 2 +
    skillCategories * 1.5 +
    eduCount * 1 +
    optSectionCount * 2;

  // Select font preset based on density
  let bodySize: number;
  let bulletSize: number;
  let lineSpacing: number;
  let headSize: number;
  let sectionSize: number;
  let nameSize: number;

  if (densityScore < 35) {
    // Light: comfortable spacing
    bodySize = 9;
    bulletSize = 9;
    lineSpacing = 12.5;
    headSize = 9.5;
    sectionSize = 10.5;
    nameSize = 17;
  } else if (densityScore < 55) {
    // Medium: standard
    bodySize = 8.5;
    bulletSize = 8.5;
    lineSpacing = 11;
    headSize = 9;
    sectionSize = 10;
    nameSize = 16;
  } else if (densityScore < 75) {
    // Heavy: compact
    bodySize = 8;
    bulletSize = 8;
    lineSpacing = 10;
    headSize = 8.5;
    sectionSize = 9.5;
    nameSize = 15;
  } else {
    // Very heavy: tight with trimming
    bodySize = 7.5;
    bulletSize = 7.5;
    lineSpacing = 9;
    headSize = 8;
    sectionSize = 9;
    nameSize = 14;
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

  // Track overflow
  let overflowed = false;

  const willFit = (needed: number): boolean => y + needed <= maxY;

  const addLine = (pts: number) => {
    y += pts;
  };

  // ─── Section heading ───
  const sectionHeading = (text: string) => {
    if (!willFit(20)) { overflowed = true; return; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionSize);
    doc.setTextColor(30, 41, 59);
    doc.text(text.toUpperCase(), marginX, y);
    y += sectionSize + 4;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  };

  // ─── Body paragraph ───
  const bodyLine = (text: string, indent: number = 0) => {
    const x = marginX + indent;
    const splitLines = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of splitLines) {
      if (!willFit(lineSpacing)) { overflowed = true; return; }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodySize);
      doc.setTextColor(51, 65, 85);
      doc.text(line as string, x, y);
      addLine(lineSpacing);
    }
  };

  // ─── Bullet point ───
  const bulletLine = (text: string) => {
    const bulletX = marginX + 3;
    const textX = marginX + 13;
    const splitLines = doc.splitTextToSize(text, maxWidth - 13);
    for (let i = 0; i < splitLines.length; i++) {
      if (!willFit(lineSpacing)) { overflowed = true; return; }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bulletSize);
      doc.setTextColor(51, 65, 85);
      if (i === 0) {
        doc.setFontSize(bulletSize - 1);
        doc.setTextColor(100, 116, 139);
        doc.text("•", bulletX, y);
      }
      doc.setFontSize(bulletSize);
      doc.setTextColor(51, 65, 85);
      doc.text(splitLines[i] as string, textX, y);
      addLine(lineSpacing);
    }
  };

  // ─── Header ───
  const { meta } = spec;

  if (!meta.name || !meta.email) {
    // Still render what we have; verification will catch missing fields
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(nameSize);
  doc.setTextColor(30, 41, 59);
  doc.text(meta.name || "NAME MISSING", pageWidth / 2, y, { align: "center" });
  y += nameSize + 4;

  // Contact line
  const contactParts: string[] = [];
  if (meta.email) contactParts.push(meta.email);
  if (meta.phone) contactParts.push(meta.phone);
  if (meta.location) contactParts.push(meta.location);
  if (meta.linkedin) {
    const handle = meta.linkedin
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")
      .replace(/\/$/, "");
    contactParts.push(`linkedin.com/in/${handle}`);
  }
  if (meta.github) {
    const handle = meta.github
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/$/, "");
    contactParts.push(`github.com/${handle}`);
  }
  if (meta.portfolio) {
    contactParts.push(meta.portfolio.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  }

  if (contactParts.length > 0) {
    const contactText = contactParts.join("  |  ");
    // Check if contact line wraps — split if needed
    const contactLines = doc.splitTextToSize(contactText, maxWidth);
    for (const cl of contactLines) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(cl as string, pageWidth / 2, y, { align: "center" });
      y += 11;
    }
    y += 2;
  }

  if (meta.targetRole) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(meta.targetRole, pageWidth / 2, y, { align: "center" });
    y += 11;
  }

  y += 3;

  // ─── Summary ───
  if (spec.summary.text) {
    sectionHeading("Summary");
    bodyLine(spec.summary.text);
    y += 2;
  }

  // ─── Experience ───
  if (spec.experience.length > 0) {
    sectionHeading("Experience");
    for (const exp of spec.experience) {
      const roleCompany = exp.company
        ? `${exp.role}  |  ${exp.company}`
        : exp.role;
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
        bulletLine(bullet);
      }
      y += 2;
    }
  }

  // ─── Projects ───
  if (spec.projects.length > 0) {
    sectionHeading("Projects");
    for (const proj of spec.projects) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(headSize);
      doc.setTextColor(30, 41, 59);
      doc.text(proj.name, marginX, y);
      y += headSize + 2;

      for (const bullet of proj.bullets) {
        bulletLine(bullet);
      }
      y += 2;
    }
  }

  // ─── Skills ───
  if (spec.skills.categories.length > 0) {
    sectionHeading("Skills");
    for (const cat of spec.skills.categories) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(bodySize);
      doc.setTextColor(30, 41, 59);
      const catLabel = `${cat.name}: `;
      const catLabelWidth = doc.getTextWidth(catLabel);
      doc.text(catLabel, marginX, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      const itemsText = cat.items.join(", ");
      const itemsSplit = doc.splitTextToSize(itemsText, maxWidth - catLabelWidth);
      doc.text(itemsSplit[0] as string, marginX + catLabelWidth, y);
      for (let i = 1; i < itemsSplit.length; i++) {
        if (!willFit(lineSpacing)) { overflowed = true; break; }
        y += lineSpacing;
        doc.text(itemsSplit[i] as string, marginX + 4, y);
      }
      y += lineSpacing;
    }
  }

  // ─── Education ───
  if (spec.education.length > 0) {
    sectionHeading("Education");
    for (const edu of spec.education) {
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

  // ─── Optional Sections (trim if overflowing) ───
  if (spec.optionalSections && spec.optionalSections.length > 0) {
    for (const opt of spec.optionalSections) {
      if (!willFit(30)) { overflowed = true; break; }
      sectionHeading(opt.heading);
      for (const item of opt.items) {
        if (!willFit(lineSpacing)) { overflowed = true; break; }
        bulletLine(item);
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
  const { blob } = await generateSpecPdfBlob(spec, filename);
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
