import type { CVSection, Project } from "@/src/model/types";
import { safeFilename } from "./project";

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((part) => part + part)
          .join("")
      : value;
  return [0, 2, 4].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16),
  ) as [number, number, number];
}

export async function downloadPdf(project: Project) {
  const { jsPDF } = await import("jspdf");
  const letter = project.layout.paper === "letter";
  const pdf = new jsPDF({
    unit: "pt",
    format: letter ? "letter" : "a4",
    compress: true,
  });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = project.layout.margin;
  const maxWidth = width - margin * 2;
  const [textR, textG, textB] = hexToRgb(project.theme.text);
  const [accentR, accentG, accentB] = hexToRgb(project.theme.accent);
  const [mutedR, mutedG, mutedB] = hexToRgb(project.theme.muted);
  let y = margin;
  let page = 1;

  const footer = () => {
    if (!project.layout.showPageNumbers) return;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(mutedR, mutedG, mutedB);
    pdf.text(String(page), width / 2, height - 22, { align: "center" });
  };

  const ensure = (needed: number) => {
    if (y + needed < height - margin) return;
    footer();
    pdf.addPage();
    page += 1;
    y = margin;
  };

  pdf.setProperties({
    title: project.name,
    subject: "Curriculum vitae",
    creator: "Vitae Studio",
  });
  pdf.setTextColor(textR, textG, textB);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.text(project.profile.fullName, margin, y + 20);
  y += 30;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(mutedR, mutedG, mutedB);
  pdf.text(project.profile.professionalTitle, margin, y);
  y += 16;
  const contactLine = project.profile.contacts
    .map((contact) => contact.value)
    .join("  ·  ");
  const contactLines = pdf.splitTextToSize(contactLine, maxWidth) as string[];
  pdf.text(contactLines, margin, y);
  y += contactLines.length * 12 + 14;

  const renderSection = (section: CVSection) => {
    ensure(42);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(project.theme.headingSize);
    pdf.setTextColor(accentR, accentG, accentB);
    pdf.text(section.title.toUpperCase(), margin, y);
    y += 5;
    if (project.theme.ruleWidth > 0) {
      pdf.setDrawColor(accentR, accentG, accentB);
      pdf.setLineWidth(project.theme.ruleWidth);
      pdf.line(margin, y, width - margin, y);
    }
    y += 15;
    section.entries
      .filter((entry) => !entry.hidden)
      .forEach((entry) => {
        ensure(58);
        pdf.setTextColor(textR, textG, textB);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(project.theme.bodySize + 0.5);
        const title = pdf.splitTextToSize(
          entry.title,
          maxWidth - 110,
        ) as string[];
        pdf.text(title, margin, y);
        if (entry.date) {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(mutedR, mutedG, mutedB);
          pdf.text(entry.date, width - margin, y, { align: "right" });
        }
        y += title.length * 13;
        if (entry.organization) {
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(mutedR, mutedG, mutedB);
          const org = `${entry.organization}${entry.location ? ` · ${entry.location}` : ""}`;
          pdf.text(pdf.splitTextToSize(org, maxWidth), margin, y);
          y += 13;
        }
        if (entry.summary) {
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(textR, textG, textB);
          const lines = pdf.splitTextToSize(
            entry.summary,
            maxWidth,
          ) as string[];
          ensure(lines.length * 12 + 10);
          pdf.text(lines, margin, y);
          y += lines.length * 12 + 3;
        }
        entry.bullets.forEach((bullet) => {
          const lines = pdf.splitTextToSize(bullet, maxWidth - 18) as string[];
          ensure(lines.length * 12 + 4);
          pdf.circle(margin + 3, y - 3, 1.3, "F");
          pdf.text(lines, margin + 14, y);
          y += lines.length * 12 + 2;
        });
        y += 9;
      });
    y += project.theme.sectionGap / 2;
  };

  project.sections.filter((section) => !section.hidden).forEach(renderSection);
  footer();
  pdf.save(safeFilename(project.profile.fullName || project.name, "pdf"));
}
