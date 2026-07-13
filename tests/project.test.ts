import { describe, expect, it } from "vitest";
import { moveItem, paginateSections, safeFilename } from "@/src/lib/project";
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

  it("keeps section identity while splitting entries across pages", () => {
    const section: CVSection = {
      id: "s1",
      title: "Experience",
      kind: "experience",
      entries: Array.from({ length: 7 }, (_, index) => ({
        id: String(index),
        title: `Role ${index}`,
        bullets: [],
      })),
    };
    const pages = paginateSections([section], 4);
    expect(pages).toHaveLength(2);
    expect(pages[0][0].entries).toHaveLength(4);
    expect(pages[1][0].title).toBe("Experience");
  });
});
