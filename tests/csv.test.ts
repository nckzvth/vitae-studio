import { describe, expect, it } from "vitest";
import { parseCsv, stableFingerprint, suggestField } from "@/src/lib/csv";

describe("CSV detection and mapping", () => {
  it("recognizes common plain-language aliases", () => {
    expect(suggestField("Job Title")).toEqual({
      field: "title",
      confidence: 0.98,
    });
    expect(suggestField("University").field).toBe("organization");
    expect(suggestField("Responsibilities").field).toBe("summary");
  });

  it("parses alternate delimiters and quoted multiline cells", () => {
    const draft = parseCsv(
      'Role;Employer;Details\nResearcher;Northbridge;"First line\nSecond line"',
      "research.csv",
    );
    expect(draft.rows).toHaveLength(1);
    expect(draft.mapping.Role).toBe("title");
    expect(draft.mapping.Employer).toBe("organization");
    expect(draft.rows[0].Details).toContain("Second line");
  });

  it("creates stable fingerprints independent of column order", () => {
    expect(stableFingerprint({ Role: "Fellow", Year: "2025" })).toBe(
      stableFingerprint({ Year: "2025", Role: "Fellow" }),
    );
  });
});
