import { describe, expect, it } from "vitest";
import { moveItem, paginateProject, safeFilename } from "@/src/lib/project";
import { createDemoProject } from "@/src/model/demo";
import { themePresets } from "@/src/model/demo";
import type { LayoutMode, ThemeId } from "@/src/model/types";
import type { CVSection } from "@/src/model/types";

describe("project utilities", () => {
  const pageEntries = (pages: ReturnType<typeof paginateProject>) =>
    pages.flatMap((page) =>
      page.columns.flatMap((column) =>
        column.flatMap((section) => section.entries),
      ),
    );

  it("produces portable filenames", () => {
    expect(safeFilename("Dr. Maya Chén — CV", "pdf")).toBe(
      "dr-maya-chen-cv.pdf",
    );
    expect(safeFilename("", ".json")).toBe("cv.json");
  });

  it("moves an item without mutating the source", () => {
    const source = ["a", "b", "c"];
    expect(moveItem(source, 2, 0)).toEqual(["c", "a", "b"]);
    expect(source).toEqual(["a", "b", "c"]);
  });

  it("uses available paper height instead of forcing the demo onto two pages", () => {
    const project = createDemoProject();
    const pages = paginateProject(project);
    expect(pages).toHaveLength(1);
    expect(pageEntries(pages)).toHaveLength(10);
  });

  it.each([
    ["academic", "date-rail", 1],
    ["modern", "single", 2],
    ["editorial", "single", 2],
    ["technical", "two-column", 1],
  ] satisfies [ThemeId, LayoutMode, number][])(
    "uses the expected compact page flow in the %s preset",
    (preset, mode, expectedPages) => {
      const project = createDemoProject();
      project.theme = { ...themePresets[preset] };
      project.layout = { ...project.layout, mode };
      const pages = paginateProject(project);
      expect(pages).toHaveLength(expectedPages);
      expect(pageEntries(pages)).toHaveLength(10);
    },
  );

  it.each(
    (Object.keys(themePresets) as ThemeId[]).flatMap((preset) =>
      (["single", "date-rail", "two-column"] as LayoutMode[]).map(
        (mode) => [preset, mode] as const,
      ),
    ),
  )(
    "preserves every entry under extreme %s/%s formatting changes",
    (preset, mode) => {
      for (const paper of ["letter", "a4"] as const) {
        for (const bodySize of [8, 14]) {
          const project = createDemoProject();
          project.theme = {
            ...themePresets[preset],
            bodySize,
            lineHeight: bodySize === 8 ? 1.2 : 1.8,
            sectionGap: bodySize === 8 ? 8 : 36,
          };
          project.layout = {
            ...project.layout,
            mode,
            paper,
            margin: bodySize === 8 ? 28 : 72,
          };
          const pages = paginateProject(project);
          expect(
            pages.every((page) =>
              page.columns.some((column) => column.length > 0),
            ),
          ).toBe(true);
          expect(pageEntries(pages)).toHaveLength(10);
        }
      }
    },
  );

  it("keeps section identity while splitting tall content across pages", () => {
    const section: CVSection = {
      id: "s1",
      title: "Experience",
      kind: "experience",
      entries: Array.from({ length: 14 }, (_, index) => ({
        id: String(index),
        title: `Role ${index}`,
        organization: "Northbridge Institute of Technology",
        summary:
          "A detailed description that takes measurable vertical space in the document preview.",
        bullets: [
          "A substantial accomplishment with enough detail to exercise line wrapping and page capacity.",
        ],
      })),
    };
    const project = { ...createDemoProject(), sections: [section] };
    const pages = paginateProject(project);
    expect(pages.length).toBeGreaterThan(1);
    expect(pageEntries(pages)).toHaveLength(14);
    expect(pages[1].columns[0][0].title).toBe("Experience");
    expect(pages[1].columns[0][0].showHeading).toBe(false);
  });

  it("never strands a section heading without content", () => {
    const project = createDemoProject();
    project.theme = { ...project.theme, bodySize: 14, lineHeight: 1.8 };
    project.layout = { ...project.layout, margin: 72 };
    const pages = paginateProject(project);
    const headedFragments = pages.flatMap((page) =>
      page.columns.flatMap((column) =>
        column.filter((section) => section.showHeading !== false),
      ),
    );
    expect(headedFragments.every((section) => section.entries.length > 0)).toBe(
      true,
    );
  });

  it("repeats continuation headings only when explicitly enabled", () => {
    const project = createDemoProject();
    project.sections = [
      {
        id: "long-section",
        title: "Honors and Awards",
        kind: "honors",
        entries: Array.from({ length: 80 }, (_, index) => ({
          id: `award-${index}`,
          title: `Award ${index}`,
          bullets: [],
        })),
      },
    ];
    const compactPages = paginateProject(project);
    expect(
      compactPages
        .slice(1)
        .flatMap((page) => page.columns.flat())
        .every((section) => section.showHeading === false),
    ).toBe(true);

    project.layout.repeatSectionHeadings = true;
    const repeatedPages = paginateProject(project);
    expect(
      repeatedPages
        .slice(1)
        .flatMap((page) => page.columns.flat())
        .some((section) => section.showHeading === true),
    ).toBe(true);
  });

  it("splits exceptionally long entries without losing their content", () => {
    const longBullet = Array.from(
      { length: 900 },
      (_, index) => `word${index}`,
    ).join(" ");
    const project = createDemoProject();
    project.sections = [
      {
        id: "long-entry-section",
        title: "Professional Experience",
        kind: "experience",
        entries: [
          {
            id: "long-entry",
            title: "Exceptionally detailed role",
            organization: "Example University",
            summary: "A complete role whose details must continue safely.",
            bullets: [longBullet],
          },
        ],
      },
    ];
    const pages = paginateProject(project);
    const fragments = pageEntries(pages);
    expect(pages.length).toBeGreaterThan(1);
    expect(
      fragments.filter((entry) => entry.showIdentity !== false),
    ).toHaveLength(1);
    expect(
      fragments
        .flatMap((entry) => entry.bullets)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    ).toBe(longBullet);
  });
});
