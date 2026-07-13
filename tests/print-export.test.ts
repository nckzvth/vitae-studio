import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

const studioSource = readFileSync(
  new URL("../app/studio/Studio.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const pdfSource = readFileSync(
  new URL("../src/lib/pdf.ts", import.meta.url),
  "utf8",
);

describe("direct PDF export", () => {
  it("downloads the rendered CV pages without invoking browser printing", () => {
    expect(studioSource).toContain(
      "downloadRenderedPdf(project, renderedPages)",
    );
    expect(studioSource).toContain(":scope > .paper:not(.measurement-paper)");
    expect(studioSource).not.toContain("window.print");
    expect(studioSource).not.toContain("Save as PDF in the print dialog");
    expect(packageJson.dependencies).toHaveProperty("html2canvas");
    expect(packageJson.dependencies).toHaveProperty("jspdf");
  });

  it("uses exact page images plus an invisible searchable text layer", () => {
    expect(pdfSource).toContain("html2canvas(pageElement");
    expect(pdfSource).toContain('pdf.addImage(\n      canvas,\n      "PNG"');
    expect(pdfSource).toContain("new GState({ opacity: 0 })");
    expect(pdfSource).toContain("pdf.link(");
    expect(pdfSource).toContain("letter: { width: 215.9, height: 279.4 }");
    expect(pdfSource).toContain("a4: { width: 210, height: 297 }");
  });

  it("removes editor-only decoration during capture", () => {
    expect(cssSource).toContain(".exporting-pdf .paper-stack");
    expect(cssSource).toContain(".exporting-pdf .selected-element");
    expect(cssSource).toContain(".exporting-pdf .paper.show-guides::after");
  });
});
