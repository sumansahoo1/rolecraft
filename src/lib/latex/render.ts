import type { ResumeSpec } from "@/types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderResumeHtml(spec: ResumeSpec): string {
  const { meta } = spec;

  const parts: string[] = [];

  // Document shell + print styles
  parts.push(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Libre Baskerville', 'Times New Roman', serif;
    font-size: 8.5pt;
    line-height: 1.18;
    color: #1e293b;
    background: white;
    max-width: 8.5in;
    margin: 0 auto;
    padding: 0.47in 0.5in 0.42in 0.5in;
  }

  /* ─── Print / PDF ─── */
  @page {
    size: letter;
    margin: 0;
  }
  @media print {
    body {
      padding: 0.47in 0.5in 0.42in 0.5in;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }

  /* ─── Header ─── */
  .header {
    text-align: center;
    margin-bottom: 10pt;
  }
  .header .name {
    font-size: 16pt;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: 0.3pt;
    margin-bottom: 1pt;
  }
  .header .contact {
    font-size: 7.5pt;
    color: #475569;
    font-family: 'Inter', sans-serif;
  }
  .header .contact a {
    color: #475569;
    text-decoration: none;
  }
  .header .contact span.sep {
    margin: 0 3pt;
    color: #94a3b8;
  }
  .header .role {
    font-size: 7.5pt;
    color: #64748b;
    font-style: italic;
    margin-top: 1pt;
    font-family: 'Inter', sans-serif;
  }

  /* ─── Sections ─── */
  .section {
    margin-bottom: 4pt;
  }
  .section-heading {
    font-size: 9pt;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: 0.4pt;
    text-transform: uppercase;
    border-bottom: 0.4pt solid #94a3b8;
    padding-bottom: 1pt;
    margin-bottom: 3pt;
  }

  /* ─── Summary ─── */
  .summary-text {
    color: #334155;
    line-height: 1.2;
  }

  /* ─── Experience ─── */
  .exp-entry {
    margin-bottom: 3pt;
  }
  .exp-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5pt;
  }
  .exp-role {
    font-weight: 700;
    color: #1e293b;
    font-size: 8.5pt;
  }
  .exp-company {
    font-weight: 400;
    color: #475569;
    font-size: 8pt;
  }
  .exp-dates {
    font-size: 7.5pt;
    color: #64748b;
    font-family: 'Inter', sans-serif;
    white-space: nowrap;
  }
  .exp-bullets {
    list-style: none;
    padding-left: 0;
  }
  .exp-bullets li {
    position: relative;
    padding-left: 9pt;
    margin-bottom: 0pt;
    color: #334155;
    font-size: 8.5pt;
    line-height: 1.18;
  }
  .exp-bullets li::before {
    content: "•";
    position: absolute;
    left: 1pt;
    color: #64748b;
    font-size: 7pt;
  }

  /* ─── Projects ─── */
  .proj-entry {
    margin-bottom: 3pt;
  }
  .proj-name {
    font-weight: 700;
    color: #1e293b;
    font-size: 8.5pt;
    margin-bottom: 0.5pt;
  }
  .proj-bullets {
    list-style: none;
    padding-left: 0;
  }
  .proj-bullets li {
    position: relative;
    padding-left: 9pt;
    margin-bottom: 0pt;
    color: #334155;
    font-size: 8.5pt;
    line-height: 1.18;
  }
  .proj-bullets li::before {
    content: "•";
    position: absolute;
    left: 1pt;
    color: #64748b;
    font-size: 7pt;
  }

  /* ─── Skills ─── */
  .skills-line {
    margin-bottom: 0.5pt;
    font-size: 8.5pt;
  }
  .skills-cat {
    font-weight: 700;
    color: #1e293b;
  }
  .skills-items {
    color: #334155;
  }

  /* ─── Education ─── */
  .edu-entry {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5pt;
    font-size: 8.5pt;
    color: #334155;
  }
  .edu-details {
    font-weight: 600;
  }
  .edu-year {
    color: #64748b;
    font-family: 'Inter', sans-serif;
    font-size: 7.5pt;
  }

  /* ─── Optional Sections ─── */
  .opt-bullets {
    list-style: none;
    padding-left: 0;
  }
  .opt-bullets li {
    position: relative;
    padding-left: 9pt;
    margin-bottom: 0pt;
    color: #334155;
    font-size: 8.5pt;
    line-height: 1.18;
  }
  .opt-bullets li::before {
    content: "•";
    position: absolute;
    left: 1pt;
    color: #64748b;
    font-size: 7pt;
  }
</style>
</head>
<body>
`);

  // ─── Header ───
  parts.push('<div class="header">');
  parts.push(`<div class="name">${escapeHtml(meta.name)}</div>`);

  const contactItems: string[] = [];
  if (meta.email) {
    contactItems.push(
      `<a href="mailto:${escapeHtml(meta.email)}">${escapeHtml(meta.email)}</a>`
    );
  }
  if (meta.phone) {
    contactItems.push(escapeHtml(meta.phone));
  }
  if (meta.location) {
    contactItems.push(escapeHtml(meta.location));
  }
  if (meta.linkedin) {
    const handle = meta.linkedin
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")
      .replace(/\/$/, "");
    contactItems.push(
      `<a href="https://linkedin.com/in/${escapeHtml(handle)}" target="_blank">linkedin.com/in/${escapeHtml(handle)}</a>`
    );
  }
  if (meta.github) {
    const handle = meta.github
      .replace(/^https?:\/\/(www\.)?github\.com\//, "")
      .replace(/\/$/, "");
    contactItems.push(
      `<a href="https://github.com/${escapeHtml(handle)}" target="_blank">github.com/${escapeHtml(handle)}</a>`
    );
  }
  if (meta.portfolio) {
    const display = meta.portfolio.replace(/^https?:\/\//, "").replace(/\/$/, "");
    contactItems.push(
      `<a href="${escapeHtml(meta.portfolio)}" target="_blank">${escapeHtml(display)}</a>`
    );
  }
  if (contactItems.length > 0) {
    parts.push(
      `<div class="contact">${contactItems.join('<span class="sep">|</span>')}</div>`
    );
  }
  if (meta.targetRole) {
    parts.push(`<div class="role">${escapeHtml(meta.targetRole)}</div>`);
  }
  parts.push("</div>");

  // ─── Summary ───
  if (spec.summary.text) {
    parts.push('<div class="section">');
    parts.push('<div class="section-heading">Summary</div>');
    parts.push(`<p class="summary-text">${escapeHtml(spec.summary.text)}</p>`);
    parts.push("</div>");
  }

  // ─── Experience ───
  if (spec.experience.length > 0) {
    parts.push('<div class="section">');
    parts.push('<div class="section-heading">Experience</div>');
    for (const exp of spec.experience) {
      parts.push('<div class="exp-entry">');
      parts.push('<div class="exp-header">');
      parts.push(
        `<span><span class="exp-role">${escapeHtml(exp.role)}</span>` +
          (exp.company
            ? ` <span class="exp-company">| ${escapeHtml(exp.company)}</span>`
            : "") +
          `</span>`
      );
      parts.push(
        `<span class="exp-dates">${escapeHtml(exp.dates)}</span>`
      );
      parts.push("</div>");
      if (exp.bullets.length > 0) {
        parts.push('<ul class="exp-bullets">');
        for (const bullet of exp.bullets) {
          parts.push(`<li>${escapeHtml(bullet)}</li>`);
        }
        parts.push("</ul>");
      }
      parts.push("</div>");
    }
    parts.push("</div>");
  }

  // ─── Projects ───
  if (spec.projects.length > 0) {
    parts.push('<div class="section">');
    parts.push('<div class="section-heading">Projects</div>');
    for (const proj of spec.projects) {
      parts.push('<div class="proj-entry">');
      parts.push(`<div class="proj-name">${escapeHtml(proj.name)}</div>`);
      if (proj.bullets.length > 0) {
        parts.push('<ul class="proj-bullets">');
        for (const bullet of proj.bullets) {
          parts.push(`<li>${escapeHtml(bullet)}</li>`);
        }
        parts.push("</ul>");
      }
      parts.push("</div>");
    }
    parts.push("</div>");
  }

  // ─── Skills ───
  if (spec.skills.categories.length > 0) {
    parts.push('<div class="section">');
    parts.push('<div class="section-heading">Skills</div>');
    for (const cat of spec.skills.categories) {
      parts.push('<div class="skills-line">');
      parts.push(
        `<span class="skills-cat">${escapeHtml(cat.name)}:</span> ` +
          `<span class="skills-items">${escapeHtml(cat.items.join(", "))}</span>`
      );
      parts.push("</div>");
    }
    parts.push("</div>");
  }

  // ─── Education ───
  if (spec.education.length > 0) {
    parts.push('<div class="section">');
    parts.push('<div class="section-heading">Education</div>');
    for (const edu of spec.education) {
      const degreeField = [edu.degree, edu.field].filter(Boolean).join(" in ");
      const left = [degreeField, edu.institution].filter(Boolean).join(", ");
      parts.push('<div class="edu-entry">');
      parts.push(`<span class="edu-details">${escapeHtml(left)}</span>`);
      parts.push(`<span class="edu-year">${escapeHtml(edu.year)}</span>`);
      parts.push("</div>");
    }
    parts.push("</div>");
  }

  // ─── Optional Sections ───
  if (spec.optionalSections && spec.optionalSections.length > 0) {
    for (const opt of spec.optionalSections) {
      parts.push('<div class="section">');
      parts.push(
        `<div class="section-heading">${escapeHtml(opt.heading)}</div>`
      );
      if (opt.items.length > 0) {
        parts.push('<ul class="opt-bullets">');
        for (const item of opt.items) {
          parts.push(`<li>${escapeHtml(item)}</li>`);
        }
        parts.push("</ul>");
      }
      parts.push("</div>");
    }
  }

  parts.push("</body></html>");
  return parts.join("\n");
}

/**
 * Extract plain text from ResumeSpec for copy/paste.
 */
export function renderResumeText(spec: ResumeSpec): string {
  const lines: string[] = [];

  // Header
  lines.push(spec.meta.name.toUpperCase());
  const contact = [
    spec.meta.email,
    spec.meta.phone,
    spec.meta.linkedin,
    spec.meta.portfolio,
  ]
    .filter(Boolean)
    .join(" | ");
  if (contact) lines.push(contact);
  lines.push("");

  // Summary
  if (spec.summary.text) {
    lines.push("SUMMARY");
    lines.push(spec.summary.text);
    lines.push("");
  }

  // Experience
  if (spec.experience.length > 0) {
    lines.push("EXPERIENCE");
    for (const exp of spec.experience) {
      lines.push(`${exp.role} | ${exp.company} | ${exp.dates}`);
      for (const b of exp.bullets) {
        lines.push(`  • ${b}`);
      }
      lines.push("");
    }
  }

  // Projects
  if (spec.projects.length > 0) {
    lines.push("PROJECTS");
    for (const proj of spec.projects) {
      lines.push(proj.name);
      for (const b of proj.bullets) {
        lines.push(`  • ${b}`);
      }
      lines.push("");
    }
  }

  // Skills
  if (spec.skills.categories.length > 0) {
    lines.push("SKILLS");
    for (const cat of spec.skills.categories) {
      lines.push(`${cat.name}: ${cat.items.join(", ")}`);
    }
    lines.push("");
  }

  // Education
  if (spec.education.length > 0) {
    lines.push("EDUCATION");
    for (const edu of spec.education) {
      const parts = [
        [edu.degree, edu.field].filter(Boolean).join(" in "),
        edu.institution,
        edu.year,
      ].filter(Boolean);
      lines.push(parts.join(", "));
    }
    lines.push("");
  }

  // Optional
  if (spec.optionalSections) {
    for (const opt of spec.optionalSections) {
      lines.push(opt.heading.toUpperCase());
      for (const item of opt.items) {
        lines.push(`  • ${item}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
