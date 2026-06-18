import type { ResumeSpec } from "@/types";

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[&]/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/[{}]/g, (match) => (match === "{" ? "\\{" : "\\}"))
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function escapeLatexUrl(url: string): string {
  return url.replace(/%/g, "\\%").replace(/#/g, "\\#");
}

function formatLinkedinUrl(handle: string): string {
  // If it's already a full URL, use it; otherwise construct one
  if (handle.startsWith("http")) return escapeLatexUrl(handle);
  // If it looks like a handle (starts with /in/ or is just a username)
  const clean = handle.replace(/^\/+/, "").replace(/^in\//, "");
  return `https://linkedin.com/in/${clean}`;
}

export function generateLatexSource(spec: ResumeSpec): string {
  const lines: string[] = [];

  // ─── Preamble ─────────────────────────────────────────────
  lines.push("\\documentclass[10pt,letterpaper]{article}");
  lines.push("");
  lines.push("% ─── Encoding & Fonts ───");
  lines.push("\\usepackage[utf8]{inputenc}");
  lines.push("\\usepackage[T1]{fontenc}");
  lines.push("\\usepackage{libertine}");
  lines.push("\\usepackage{inconsolata}");
  lines.push("");
  lines.push("% ─── Layout ───");
  lines.push("\\usepackage[margin=0.6in,top=0.55in,bottom=0.5in]{geometry}");
  lines.push("\\usepackage{titlesec}");
  lines.push("\\usepackage{enumitem}");
  lines.push("\\usepackage{tabularx}");
  lines.push("\\usepackage{hyperref}");
  lines.push("\\usepackage{xcolor}");
  lines.push("");
  lines.push("% ─── Colors ───");
  lines.push("\\definecolor{headline}{HTML}{1E293B}");
  lines.push("\\definecolor{bodytext}{HTML}{334155}");
  lines.push("\\definecolor{accent}{HTML}{475569}");
  lines.push("\\definecolor{ruledark}{HTML}{94A3B8}");
  lines.push("");
  lines.push("% ─── Spacing ───");
  lines.push("\\setlength{\\parindent}{0pt}");
  lines.push("\\setlength{\\parskip}{0pt}");
  lines.push("\\setlength{\\topskip}{0pt}");
  lines.push("\\setlength{\\parsep}{0pt}");
  lines.push("\\renewcommand{\\baselinestretch}{1.02}");
  lines.push("");
  lines.push("% ─── Section Formatting ───");
  lines.push("\\titleformat{\\section}");
  lines.push("  {\\Large\\bfseries\\color{headline}}");
  lines.push("  {}");
  lines.push("  {0em}");
  lines.push("  {}");
  lines.push("  [\\vspace{-4pt}\\textcolor{ruledark}{\\rule{\\textwidth}{0.4pt}}\\vspace{2pt}]");
  lines.push("\\titlespacing*{\\section}{0pt}{10pt}{6pt}");
  lines.push("");
  lines.push("% ─── List Formatting ───");
  lines.push("\\setlist{");
  lines.push("  nosep,");
  lines.push("  leftmargin=1.4em,");
  lines.push("  itemsep=0pt,");
  lines.push("  parsep=0pt,");
  lines.push("  topsep=1pt,");
  lines.push("  partopsep=0pt,");
  lines.push("  label=\\textcolor{accent}{\\textbullet}");
  lines.push("}");
  lines.push("");
  lines.push("% ─── Hyperlinks ───");
  lines.push("\\hypersetup{");
  lines.push("  colorlinks=true,");
  lines.push("  linkcolor=headline,");
  lines.push("  urlcolor=accent,");
  lines.push("  pdfborder={0 0 0},");
  lines.push("}");
  lines.push("");
  lines.push("\\begin{document}");
  lines.push("");

  // ─── Header / Contact ────────────────────────────────────
  const { meta } = spec;
  lines.push("% ─── Header ───");
  lines.push("\\begin{center}");
  lines.push(`  {\\huge\\bfseries\\color{headline}${escapeLatex(meta.name)}\\par}`);
  lines.push("  \\vspace{3pt}");

  // Build contact line
  const contactItems: string[] = [];
  if (meta.email) {
    contactItems.push(
      `\\href{mailto:${escapeLatexUrl(meta.email)}}{\\texttt{${escapeLatex(meta.email)}}}`
    );
  }
  if (meta.phone) {
    contactItems.push(`\\texttt{${escapeLatex(meta.phone)}}`);
  }
  if (meta.linkedin) {
    const linkedinUrl = formatLinkedinUrl(meta.linkedin);
    const displayHandle = meta.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "");
    contactItems.push(
      `\\href{${linkedinUrl}}{\\texttt{linkedin.com/in/${escapeLatex(displayHandle)}}}`
    );
  }
  if (meta.portfolio) {
    const portfolioDisplay = meta.portfolio.replace(/^https?:\/\//, "");
    contactItems.push(
      `\\href{${escapeLatexUrl(meta.portfolio)}}{\\texttt{${escapeLatex(portfolioDisplay)}}}`
    );
  }

  if (contactItems.length > 0) {
    lines.push(
      `  {\\small\\color{bodytext}${contactItems.join(" \\,$\\\vert$\\, ")}\\par}`
    );
  }

  if (meta.targetRole) {
    lines.push(
      `  \\vspace{1pt}{\\small\\color{accent}\\textit{${escapeLatex(meta.targetRole)}}\\par}`
    );
  }
  lines.push("\\end{center}");
  lines.push("");

  // ─── Summary ─────────────────────────────────────────────
  lines.push("% ─── Summary ───");
  lines.push("\\section{Summary}");
  lines.push(`{\\color{bodytext}${escapeLatex(spec.summary.text)}\\par}`);
  lines.push("");

  // ─── Experience ──────────────────────────────────────────
  if (spec.experience.length > 0) {
    lines.push("% ─── Experience ───");
    lines.push("\\section{Experience}");

    for (const exp of spec.experience) {
      lines.push("\\vspace{2pt}");
      lines.push(
        `{\\bfseries\\color{headline}${escapeLatex(exp.role)}${
          exp.company ? ` \\textnormal{\\color{accent}\\normalfont|\\ }${escapeLatex(exp.company)}` : ""
        }\\hfill{\\small\\color{accent}\\normalfont${escapeLatex(exp.dates)}}\\par}`
      );
      lines.push("\\vspace{1pt}");

      if (exp.bullets.length > 0) {
        lines.push("\\begin{itemize}");
        for (const bullet of exp.bullets) {
          lines.push(`  \\item {\\color{bodytext}${escapeLatex(bullet)}\\par}`);
        }
        lines.push("\\end{itemize}");
      }
    }
    lines.push("");
  }

  // ─── Projects ────────────────────────────────────────────
  if (spec.projects.length > 0) {
    lines.push("% ─── Projects ───");
    lines.push("\\section{Projects}");

    for (const proj of spec.projects) {
      lines.push("\\vspace{2pt}");
      lines.push(
        `{\\bfseries\\color{headline}${escapeLatex(proj.name)}\\par}`
      );
      lines.push("\\vspace{1pt}");

      if (proj.bullets.length > 0) {
        lines.push("\\begin{itemize}");
        for (const bullet of proj.bullets) {
          lines.push(`  \\item {\\color{bodytext}${escapeLatex(bullet)}\\par}`);
        }
        lines.push("\\end{itemize}");
      }
    }
    lines.push("");
  }

  // ─── Skills ──────────────────────────────────────────────
  if (spec.skills.categories.length > 0) {
    lines.push("% ─── Skills ───");
    lines.push("\\section{Skills}");

    for (const cat of spec.skills.categories) {
      lines.push("\\vspace{1pt}");
      lines.push(
        `{\\bfseries\\color{headline}${escapeLatex(cat.name)}:} {\\color{bodytext}${escapeLatex(cat.items.join(", "))}\\par}`
      );
    }
    lines.push("");
  }

  // ─── Education ───────────────────────────────────────────
  if (spec.education.length > 0) {
    lines.push("% ─── Education ───");
    lines.push("\\section{Education}");

    for (const edu of spec.education) {
      const degreeField = [edu.degree, edu.field].filter(Boolean).join(" in ");
      const rightSide = escapeLatex(edu.year);
      const leftSide = [degreeField ? `\\textbf{${escapeLatex(degreeField)}}` : "", edu.institution ? escapeLatex(edu.institution) : ""].filter(Boolean).join(", ");

      lines.push("\\vspace{2pt}");
      lines.push(
        `{\\color{bodytext}${leftSide}\\hfill{\\small\\color{accent}${rightSide}}\\par}`
      );
    }
    lines.push("");
  }

  // ─── Optional Sections ───────────────────────────────────
  if (spec.optionalSections && spec.optionalSections.length > 0) {
    for (const opt of spec.optionalSections) {
      lines.push(`% ─── ${escapeLatex(opt.heading)} ───`);
      lines.push(`\\section{${escapeLatex(opt.heading)}}`);

      if (opt.items.length > 0) {
        lines.push("\\begin{itemize}");
        for (const item of opt.items) {
          lines.push(`  \\item {\\color{bodytext}${escapeLatex(item)}\\par}`);
        }
        lines.push("\\end{itemize}");
      }
      lines.push("");
    }
  }

  // ─── End Document ────────────────────────────────────────
  lines.push("\\end{document}");

  return lines.join("\n");
}

export {
  escapeLatex,
  escapeLatexUrl,
  formatLinkedinUrl,
};
