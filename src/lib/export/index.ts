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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
