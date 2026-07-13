import { describe, expect, it } from "vitest";
import { moveItem, paginateProject, safeFilename } from "@/src/lib/project";
import { createDemoProject } from "@/src/model/demo";
import { themePresets } from "@/src/model/demo";
import type { LayoutMode, ThemeId } from "@/src/model/types";
import type { CVSection } from "@/src/model/types";

describe("project utilities", () => {
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
    expect(
      pages[0].reduce((total, section) => total + section.entries.length, 0),
    ).toBe(10);
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
      expect(
        pages.reduce(
          (pageTotal, page) =>
            pageTotal +
            page.reduce((total, section) => total + section.entries.length, 0),
          0,
        ),
      ).toBe(10);
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
          expect(pages.every((page) => page.length > 0)).toBe(true);
          expect(
            pages
              .flatMap((page) => page)
              .reduce((total, section) => total + section.entries.length, 0),
          ).toBe(10);
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
    expect(
      pages.flatMap((page) => page.flatMap((item) => item.entries)),
    ).toHaveLength(14);
    expect(pages[1][0].title).toBe("Experience");
  });
});
