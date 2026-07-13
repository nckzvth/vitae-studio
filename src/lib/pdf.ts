import type { PaperSize, Project } from "@/src/model/types";
import { safeFilename } from "./project";

interface TextRun {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

interface LinkRegion {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderedPageGeometry {
  width: number;
  height: number;
  textRuns: TextRun[];
  links: LinkRegion[];
}

const PAPER_SIZE_MM: Record<PaperSize, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
};

function geometryFor(element: HTMLElement): RenderedPageGeometry {
  const pageRect = element.getBoundingClientRect();
  const textRuns: TextRun[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    const value = node.textContent ?? "";
    if (!parent || !value.trim()) continue;

    const style = getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden") continue;

    for (const match of value.matchAll(/\S+/g)) {
      if (match.index === undefined) continue;
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      textRuns.push({
        text: match[0],
        x: rect.left - pageRect.left,
        y: rect.bottom - pageRect.top,
        fontSize: Number.parseFloat(style.fontSize) || 10,
      });
    }
  }

  const links = Array.from(
    element.querySelectorAll<HTMLAnchorElement>("a[href]"),
  )
    .map((anchor) => {
      const rect = anchor.getBoundingClientRect();
      return {
        href: anchor.href,
        x: rect.left - pageRect.left,
        y: rect.top - pageRect.top,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((link) => link.width > 0 && link.height > 0);

  return {
    width: pageRect.width,
    height: pageRect.height,
    textRuns,
    links,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadRenderedPdf(
  project: Project,
  pageElements: HTMLElement[],
) {
  if (!pageElements.length) {
    throw new Error("No rendered CV pages were available for export.");
  }

  const [{ default: html2canvas }, { GState, jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const paper = PAPER_SIZE_MM[project.layout.paper];
  const pdf = new jsPDF({
    unit: "mm",
    format: [paper.width, paper.height],
    orientation: "portrait",
    compress: true,
    putOnlyUsedFonts: true,
  });

  pdf.setProperties({
    title: project.profile.fullName || project.name,
    subject: "Curriculum vitae",
    author: project.profile.fullName,
    creator: "Vitae Studio",
  });

  for (const [index, pageElement] of pageElements.entries()) {
    if (index > 0) pdf.addPage([paper.width, paper.height], "portrait");

    const geometry = geometryFor(pageElement);
    const canvas = await html2canvas(pageElement, {
      backgroundColor:
        getComputedStyle(pageElement).backgroundColor || "#ffffff",
      logging: false,
      removeContainer: true,
      scale: 2,
      useCORS: true,
      width: pageElement.offsetWidth,
      height: pageElement.offsetHeight,
      windowWidth: pageElement.offsetWidth,
      windowHeight: pageElement.offsetHeight,
    });

    pdf.addImage(
      canvas,
      "PNG",
      0,
      0,
      paper.width,
      paper.height,
      `vitae-page-${index + 1}`,
      "FAST",
    );

    const xScale = paper.width / geometry.width;
    const yScale = paper.height / geometry.height;
    pdf.saveGraphicsState();
    pdf.setGState(new GState({ opacity: 0 }));
    pdf.setFont("helvetica", "normal");
    for (const run of geometry.textRuns) {
      pdf.setFontSize(Math.max(1, run.fontSize * 0.75));
      pdf.text(`${run.text} `, run.x * xScale, run.y * yScale, {
        baseline: "bottom",
      });
    }
    pdf.restoreGraphicsState();

    for (const link of geometry.links) {
      pdf.link(
        link.x * xScale,
        link.y * yScale,
        link.width * xScale,
        link.height * yScale,
        { url: link.href },
      );
    }

    canvas.width = 1;
    canvas.height = 1;
  }

  downloadBlob(
    pdf.output("blob"),
    safeFilename(project.profile.fullName || project.name, "pdf"),
  );
}
