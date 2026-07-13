import { describe, expect, it } from "vitest";
import { moveItem, paginateProject, safeFilename } from "@/src/lib/project";
import { createDemoProject } from "@/src/model/demo";
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
