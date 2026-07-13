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

describe("print-to-PDF export", () => {
  it("uses the rendered CV pages instead of a second PDF renderer", () => {
    expect(studioSource).toContain("window.print()");
    expect(studioSource).toContain("Exact preview styling, selectable text");
    expect(studioSource).not.toContain("downloadPdf");
    expect(packageJson.dependencies).not.toHaveProperty("jspdf");
  });

  it("defines exact Letter and A4 print pages with preserved colors", () => {
    expect(cssSource).toContain("@page vitae-letter");
    expect(cssSource).toContain("size: 8.5in 11in");
    expect(cssSource).toContain("@page vitae-a4");
    expect(cssSource).toContain("size: 210mm 297mm");
    expect(cssSource).toContain("print-color-adjust: exact");
  });
});
