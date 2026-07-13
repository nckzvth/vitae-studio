import { describe, expect, it } from "vitest";
import {
  parseCsv,
  rowsToSections,
  stableFingerprint,
  suggestField,
} from "@/src/lib/csv";

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

  it("preserves profile contacts and section legends from the universal template", () => {
    const draft = parseCsv(
      [
        "section,section_note,title,full_name,email,phone,address",
        'Profile,,,Avery Morgan,avery@example.com,"(555) 010-2040","Boston, MA"',
        'Research Experience,"* Student; ** Faculty",Research Fellow,,,,',
      ].join("\n"),
      "complete-cv.csv",
    );
    const imported = rowsToSections(draft);
    expect(imported.profile?.fullName).toBe("Avery Morgan");
    expect(imported.profile?.contacts?.map((item) => item.label)).toEqual([
      "Email",
      "Phone",
      "Address",
    ]);
    expect(imported.sections[0].note).toBe("* Student; ** Faculty");
    expect(imported.sections[0].entries[0].title).toBe("Research Fellow");
  });

  it("combines multiple profile rows without erasing earlier identity fields", () => {
    const draft = parseCsv(
      [
        "section,full_name,professional_title,email,phone",
        "Profile,Avery Morgan,Researcher,avery@example.com,",
        'Contact,,, ,"(555) 010-2040"',
      ].join("\n"),
      "profile.csv",
    );
    const { profile } = rowsToSections(draft);
    expect(profile?.fullName).toBe("Avery Morgan");
    expect(profile?.professionalTitle).toBe("Researcher");
    expect(profile?.contacts?.map((item) => item.label)).toEqual([
      "Email",
      "Phone",
    ]);
  });
});
