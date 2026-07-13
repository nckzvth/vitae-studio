import Papa from "papaparse";
import type {
  ContactItem,
  CsvImportDraft,
  CVEntry,
  CVSection,
  ImportSource,
  Project,
} from "@/src/model/types";

export const canonicalFields = [
  "skip",
  "section",
  "sectionNote",
  "title",
  "organization",
  "location",
  "date",
  "summary",
  "bullets",
  "fullName",
  "professionalTitle",
  "email",
  "phone",
  "address",
  "website",
] as const;

export type CanonicalField = (typeof canonicalFields)[number];

const aliases: Record<Exclude<CanonicalField, "skip">, string[]> = {
  section: ["section", "category", "type", "group"],
  sectionNote: ["section note", "legend", "annotation", "section annotation"],
  title: [
    "title",
    "role",
    "position",
    "job title",
    "degree",
    "award",
    "conference",
    "publication",
    "name",
  ],
  organization: [
    "organization",
    "organisation",
    "employer",
    "institution",
    "university",
    "issuer",
    "company",
    "school",
  ],
  location: ["location", "city", "place", "venue", "city state"],
  date: [
    "date",
    "dates",
    "year",
    "date range",
    "start date",
    "end date",
    "period",
  ],
  summary: [
    "description",
    "details",
    "summary",
    "responsibilities",
    "notes",
    "narrative",
  ],
  bullets: [
    "bullets",
    "bullet points",
    "achievements",
    "accomplishments",
    "highlights",
  ],
  fullName: ["full name", "person name", "candidate name", "profile name"],
  professionalTitle: [
    "professional title",
    "headline",
    "profile title",
    "professional headline",
  ],
  email: ["email", "email address", "e mail"],
  phone: ["phone", "phone number", "telephone", "mobile"],
  address: ["address", "mailing address", "street address"],
  website: ["website", "portfolio", "profile link", "personal website"],
};

export const canonicalFieldLabels: Record<CanonicalField, string> = {
  skip: "Skip this column",
  section: "Section",
  sectionNote: "Section note / legend",
  title: "Title or role",
  organization: "Organization",
  location: "Location",
  date: "Date",
  summary: "Summary / details",
  bullets: "Bullet points",
  fullName: "Profile: full name",
  professionalTitle: "Profile: professional title",
  email: "Profile: email",
  phone: "Profile: phone",
  address: "Profile: address",
  website: "Profile: website",
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

export function suggestField(header: string): {
  field: CanonicalField;
  confidence: number;
} {
  const normalized = normalize(header);
  for (const [field, values] of Object.entries(aliases)) {
    if (values.includes(normalized))
      return { field: field as CanonicalField, confidence: 0.98 };
  }
  for (const [field, values] of Object.entries(aliases)) {
    if (
      values.some(
        (alias) => normalized.includes(alias) || alias.includes(normalized),
      )
    ) {
      return { field: field as CanonicalField, confidence: 0.72 };
    }
  }
  return { field: "skip", confidence: 0.25 };
}

export function parseCsv(text: string, filename: string): CsvImportDraft {
  const result = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    },
  );
  const headers = result.meta.fields ?? [];
  const mapping: Record<string, string> = {};
  const confidence: Record<string, number> = {};
  headers.forEach((header) => {
    const suggestion = suggestField(header);
    mapping[header] = suggestion.field;
    confidence[header] = suggestion.confidence;
  });
  return {
    filename,
    headers,
    rows: result.data.filter((row) =>
      Object.values(row).some((value) => value?.trim()),
    ),
    mapping,
    confidence,
    errors: result.errors.map(
      (error) => `Row ${error.row ?? "?"}: ${error.message}`,
    ),
  };
}

const getMapped = (
  row: Record<string, string>,
  mapping: Record<string, string>,
  field: CanonicalField,
) =>
  Object.entries(mapping)
    .filter(([, mapped]) => mapped === field)
    .map(([header]) => row[header]?.trim())
    .filter(Boolean)
    .join(" · ");

export function rowsToSections(
  draft: CsvImportDraft,
  fallbackSection = "Imported",
) {
  const groups = new Map<string, { entries: CVEntry[]; note?: string }>();
  const profileContacts: ContactItem[] = [];
  let profile: Partial<Project["profile"]> | undefined;
  draft.rows.forEach((row) => {
    const sectionName =
      getMapped(row, draft.mapping, "section") || fallbackSection;
    const normalizedSection = normalize(sectionName);
    const fullName = getMapped(row, draft.mapping, "fullName");
    const professionalTitle = getMapped(
      row,
      draft.mapping,
      "professionalTitle",
    );
    const profileValues = {
      Email: getMapped(row, draft.mapping, "email"),
      Phone: getMapped(row, draft.mapping, "phone"),
      Address: getMapped(row, draft.mapping, "address"),
      Website: getMapped(row, draft.mapping, "website"),
    };
    const hasProfileFields =
      Boolean(fullName || professionalTitle) ||
      Object.values(profileValues).some(Boolean);
    const isProfileRow =
      ["profile", "personal", "contact", "identity"].includes(
        normalizedSection,
      ) || hasProfileFields;

    if (isProfileRow) {
      Object.entries(profileValues).forEach(([label, value]) => {
        if (!value) return;
        profileContacts.push({
          id: crypto.randomUUID(),
          label,
          value,
          href:
            label === "Email"
              ? `mailto:${value}`
              : label === "Website"
                ? value
                : undefined,
        });
      });
      const summary = getMapped(row, draft.mapping, "summary");
      profile = {
        ...profile,
        fullName:
          fullName ||
          getMapped(row, draft.mapping, "title") ||
          profile?.fullName,
        professionalTitle: professionalTitle || profile?.professionalTitle,
        summary: summary || profile?.summary,
        contacts: profileContacts,
      };
      return;
    }

    const bulletsText = getMapped(row, draft.mapping, "bullets");
    const entry: CVEntry = {
      id: crypto.randomUUID(),
      title: getMapped(row, draft.mapping, "title") || "Untitled entry",
      organization: getMapped(row, draft.mapping, "organization") || undefined,
      location: getMapped(row, draft.mapping, "location") || undefined,
      date: getMapped(row, draft.mapping, "date") || undefined,
      summary: getMapped(row, draft.mapping, "summary") || undefined,
      bullets: bulletsText
        ? bulletsText
            .split(/(?:\r?\n|\s*[;|•]\s*)/)
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
      sourceFingerprint: stableFingerprint(row),
      metadata: Object.fromEntries(
        Object.entries(row).filter(
          ([header]) => draft.mapping[header] === "skip",
        ),
      ),
    };
    const existing = groups.get(sectionName) ?? { entries: [] };
    groups.set(sectionName, {
      entries: [...existing.entries, entry],
      note:
        existing.note ||
        getMapped(row, draft.mapping, "sectionNote") ||
        undefined,
    });
  });
  const sections: CVSection[] = [...groups.entries()].map(([title, group]) => ({
    id: crypto.randomUUID(),
    title,
    kind: normalize(title).replace(/\s+/g, "-"),
    note: group.note,
    entries: group.entries,
  }));
  const source: ImportSource = {
    id: crypto.randomUUID(),
    filename: draft.filename,
    importedAt: new Date().toISOString(),
    rowCount: draft.rows.length,
    mapping: draft.mapping,
  };
  return { sections, source, profile };
}

export function stableFingerprint(row: Record<string, string>) {
  const value = Object.entries(row)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${normalize(key)}:${normalize(item ?? "")}`)
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
