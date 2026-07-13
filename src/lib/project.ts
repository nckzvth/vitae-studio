import type {
  CVEntry,
  CVSection,
  Project,
  ProjectFile,
} from "@/src/model/types";

export const PROJECT_STORAGE_KEY = "vitae-studio-active-project";

export function safeFilename(value: string, extension: string) {
  const base =
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "cv";
  return `${base}.${extension.replace(/^\./, "")}`;
}

export function createEntry(): CVEntry {
  return { id: crypto.randomUUID(), title: "New entry", bullets: [] };
}

export function createSection(title = "Custom section"): CVSection {
  return {
    id: crypto.randomUUID(),
    title,
    kind: "custom",
    entries: [createEntry()],
  };
}

export function toProjectFile(project: Project): ProjectFile {
  return {
    format: "vitae-studio-project",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project,
  };
}

export function parseProjectFile(text: string): Project {
  const parsed = JSON.parse(text) as Partial<ProjectFile>;
  if (
    parsed.format !== "vitae-studio-project" ||
    parsed.schemaVersion !== 1 ||
    !parsed.project
  ) {
    throw new Error("This file is not a supported Vitae Studio project.");
  }
  return parsed.project;
}

export function moveItem<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function paginateSections(sections: CVSection[], entriesPerPage = 6) {
  const pages: CVSection[][] = [[]];
  let used = 0;
  sections
    .filter((section) => !section.hidden)
    .forEach((section) => {
      const visibleEntries = section.entries.filter((entry) => !entry.hidden);
      if (!visibleEntries.length) return;
      let cursor = 0;
      while (cursor < visibleEntries.length) {
        const room = Math.max(1, entriesPerPage - used);
        const slice = visibleEntries.slice(cursor, cursor + room);
        pages[pages.length - 1].push({ ...section, entries: slice });
        cursor += slice.length;
        used += slice.length;
        if (used >= entriesPerPage && cursor < visibleEntries.length) {
          pages.push([]);
          used = 0;
        }
      }
      if (used >= entriesPerPage) {
        pages.push([]);
        used = 0;
      }
    });
  return pages.filter((page) => page.length);
}
