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
  const contentBottom =
    height - margin - (project.layout.showPageNumbers ? 10 : 0);

  const setBody = (bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(project.theme.bodySize + (bold ? 0.5 : 0));
    pdf.setTextColor(textR, textG, textB);
  };

  const setMuted = (italic = false) => {
    pdf.setFont("helvetica", italic ? "italic" : "normal");
    pdf.setFontSize(project.theme.bodySize);
    pdf.setTextColor(mutedR, mutedG, mutedB);
  };

  const footer = () => {
    if (!project.layout.showPageNumbers) return;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(mutedR, mutedG, mutedB);
    pdf.text(String(page), width / 2, height - 22, { align: "center" });
  };

  const ensure = (needed: number) => {
    if (y + needed <= contentBottom) return;
    footer();
    pdf.addPage();
    page += 1;
    y = margin;
  };

  const writeLines = (
    lines: string[],
    options: {
      x: number;
      lineHeight: number;
      style: () => void;
      onFirstLine?: () => void;
    },
  ) => {
    lines.forEach((line, index) => {
      ensure(options.lineHeight + 2);
      if (index === 0) options.onFirstLine?.();
      options.style();
      pdf.text(line, options.x, y);
      y += options.lineHeight;
    });
  };

  pdf.setProperties({
    title: project.name,
    subject: "Curriculum vitae",
    creator: "Vitae Studio",
  });
  pdf.setTextColor(textR, textG, textB);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  const nameLines = pdf.splitTextToSize(
    project.profile.fullName,
    maxWidth,
  ) as string[];
  nameLines.forEach((line) => {
    ensure(28);
    pdf.setTextColor(textR, textG, textB);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text(line, margin, y + 20);
    y += 28;
  });
  y += 2;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(mutedR, mutedG, mutedB);
  pdf.text(project.profile.professionalTitle, margin, y);
  y += 16;
  const contactLine = project.profile.contacts
    .map((contact) => contact.value)
    .join("  ·  ");
  const contactLines = pdf.splitTextToSize(contactLine, maxWidth) as string[];
  if (contactLines.length) {
    writeLines(contactLines, {
      x: margin,
      lineHeight: 12,
      style: () => setMuted(),
    });
  }
  y += 10;
  if (project.profile.summary) {
    const summaryLines = pdf.splitTextToSize(
      project.profile.summary,
      maxWidth,
    ) as string[];
    writeLines(summaryLines, {
      x: margin,
      lineHeight: 12,
      style: () => setBody(),
    });
    y += 10;
  }

  const renderSection = (section: CVSection) => {
    const entries = section.entries.filter((entry) => !entry.hidden);
    if (!entries.length) return;
    const headingLines = pdf.splitTextToSize(
      section.title.toUpperCase(),
      maxWidth,
    ) as string[];
    const noteLines = section.note
      ? (pdf.splitTextToSize(section.note, maxWidth) as string[])
      : [];
    // Keep the section heading with the beginning of its first entry.
    ensure(headingLines.length * 15 + noteLines.length * 11 + 34);
    writeLines(headingLines, {
      x: margin,
      lineHeight: 15,
      style: () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(project.theme.headingSize);
        pdf.setTextColor(accentR, accentG, accentB);
      },
    });
    if (project.theme.ruleWidth > 0) {
      pdf.setDrawColor(accentR, accentG, accentB);
      pdf.setLineWidth(project.theme.ruleWidth);
      pdf.line(margin, y, width - margin, y);
    }
    y += 8;
    if (noteLines.length) {
      writeLines(noteLines, {
        x: margin,
        lineHeight: 11,
        style: () => setMuted(true),
      });
      y += 5;
    }
    entries.forEach((entry) => {
      ensure(34);
      setBody(true);
      const title = pdf.splitTextToSize(
        entry.title,
        maxWidth - 110,
      ) as string[];
      writeLines(title, {
        x: margin,
        lineHeight: 13,
        style: () => setBody(true),
        onFirstLine: () => {
          if (!entry.date) return;
          setMuted();
          pdf.text(entry.date, width - margin, y, { align: "right" });
        },
      });
      if (entry.organization || entry.location) {
        const org = `${entry.organization ?? ""}${entry.organization && entry.location ? ` · ` : ""}${entry.location ?? ""}`;
        const organizationLines = pdf.splitTextToSize(
          org,
          maxWidth,
        ) as string[];
        writeLines(organizationLines, {
          x: margin,
          lineHeight: 12,
          style: () => setMuted(true),
        });
      }
      if (entry.summary) {
        const lines = pdf.splitTextToSize(entry.summary, maxWidth) as string[];
        writeLines(lines, {
          x: margin,
          lineHeight: 12,
          style: () => setBody(),
        });
        y += 3;
      }
      entry.bullets.forEach((bullet) => {
        const lines = pdf.splitTextToSize(bullet, maxWidth - 18) as string[];
        writeLines(lines, {
          x: margin + 14,
          lineHeight: 12,
          style: () => setBody(),
          onFirstLine: () => {
            setBody();
            pdf.circle(margin + 3, y - 3, 1.3, "F");
          },
        });
        y += 2;
      });
      y += 9;
    });
    y += project.theme.sectionGap / 2;
  };

  project.sections.filter((section) => !section.hidden).forEach(renderSection);
  footer();
  pdf.save(safeFilename(project.profile.fullName || project.name, "pdf"));
}
