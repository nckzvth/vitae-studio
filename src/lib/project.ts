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

const PAPER_DIMENSIONS = {
  letter: { width: 816, height: 1056 },
  a4: { width: 794, height: 1123 },
};

function wrappedLines(value: string | undefined, charactersPerLine: number) {
  if (!value) return 0;
  return value.split(/\r?\n/).reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / charactersPerLine));
  }, 0);
}

function estimateEntryHeight(entry: CVEntry, project: Project) {
  const { width } = PAPER_DIMENSIONS[project.layout.paper];
  const fullWidth = width - project.layout.margin * 2;
  const contentWidth =
    project.layout.mode === "date-rail"
      ? fullWidth - 117
      : project.layout.mode === "two-column"
        ? (fullWidth - 28) / 2
        : fullWidth;
  const charactersPerLine = Math.max(
    24,
    Math.floor(contentWidth / (project.theme.bodySize * 0.52)),
  );
  const lineHeight = project.theme.bodySize * project.theme.lineHeight;
  const titleHeight =
    wrappedLines(entry.title, charactersPerLine) *
    (project.theme.bodySize + 0.7) *
    1.25;
  const organization = [entry.organization, entry.location]
    .filter(Boolean)
    .join(" · ");
  const organizationHeight =
    wrappedLines(organization, charactersPerLine) * lineHeight;
  const summaryHeight =
    wrappedLines(entry.summary, charactersPerLine) * lineHeight;
  const bulletHeight = entry.bullets.reduce((total, bullet) => {
    return (
      total +
      wrappedLines(bullet, Math.max(20, charactersPerLine - 4)) * lineHeight +
      2
    );
  }, 0);
  const stackedDateHeight =
    project.layout.mode === "date-rail" || !entry.date ? 0 : lineHeight;

  return (
    7 +
    titleHeight +
    organizationHeight +
    summaryHeight +
    bulletHeight +
    stackedDateHeight +
    (entry.summary ? 6 : 0) +
    (entry.bullets.length ? 5 : 0)
  );
}

function estimateSectionHeadingHeight(section: CVSection, project: Project) {
  const { width } = PAPER_DIMENSIONS[project.layout.paper];
  const fullWidth = width - project.layout.margin * 2;
  const contentWidth =
    project.layout.mode === "two-column" ? (fullWidth - 28) / 2 : fullWidth;
  const headingCharactersPerLine = Math.max(
    18,
    Math.floor(contentWidth / (project.theme.headingSize * 0.62)),
  );
  const noteCharactersPerLine = Math.max(
    24,
    Math.floor(contentWidth / (project.theme.bodySize * 0.52)),
  );
  const headingLineHeight = project.theme.headingSize * 1.45;
  const noteLineHeight = project.theme.bodySize * project.theme.lineHeight;
  const noteHeight = section.note
    ? wrappedLines(section.note, noteCharactersPerLine) * noteLineHeight + 7
    : 0;
  return (
    wrappedLines(section.title, headingCharactersPerLine) * headingLineHeight +
    15 +
    noteHeight
  );
}

function estimateHeaderHeight(project: Project) {
  const { width } = PAPER_DIMENSIONS[project.layout.paper];
  const fullWidth = width - project.layout.margin * 2;
  const charactersPerLine = Math.max(
    30,
    Math.floor(fullWidth / (project.theme.bodySize * 0.52)),
  );
  const lineHeight = project.theme.bodySize * project.theme.lineHeight;
  const contactText = project.profile.contacts
    .map((contact) => contact.value)
    .join(" · ");
  const contactsHeight = Math.max(
    12,
    wrappedLines(contactText, charactersPerLine) * 12,
  );
  const summaryHeight = project.profile.summary
    ? wrappedLines(project.profile.summary, charactersPerLine) * lineHeight + 13
    : 0;
  return 29 + 29 + contactsHeight + summaryHeight + 23;
}

/**
 * Produces paper-sized fragments using the same typography and spacing tokens
 * as the preview. The estimate is deliberately slightly conservative, but it
 * is based on content height rather than an arbitrary entry count.
 */
export function paginateProject(project: Project) {
  const { height } = PAPER_DIMENSIONS[project.layout.paper];
  const columnCount = project.layout.mode === "two-column" ? 2 : 1;
  const singleColumnCapacity =
    height -
    project.layout.margin * 2 -
    (project.layout.showPageNumbers ? 34 : 12);
  const pageCapacity = singleColumnCapacity * columnCount;
  const pages: CVSection[][] = [[]];
  let pageIndex = 0;
  // The identity header spans every column, so its height consumes the same
  // vertical space from each column's independent capacity.
  let used = estimateHeaderHeight(project) * columnCount;

  const beginPage = () => {
    pages.push([]);
    pageIndex += 1;
    used = 0;
  };

  project.sections
    .filter((section) => !section.hidden)
    .forEach((section) => {
      const entries = section.entries.filter((entry) => !entry.hidden);
      if (!entries.length) return;

      const headingHeight = estimateSectionHeadingHeight(section, project);
      let fragment: CVSection | null = null;

      entries.forEach((entry) => {
        const entryHeight = estimateEntryHeight(entry, project);
        const requiredHeight = entryHeight + (fragment ? 0 : headingHeight);
        const pageHasDocumentContent = pages[pageIndex].length > 0;

        if (used + requiredHeight > pageCapacity && pageHasDocumentContent) {
          beginPage();
          fragment = null;
        }

        if (!fragment) {
          fragment = { ...section, entries: [] };
          pages[pageIndex].push(fragment);
          used += headingHeight;
        }

        fragment.entries.push(entry);
        used += entryHeight;
      });

      used += project.theme.sectionGap;
    });

  return pages.filter((page) => page.length > 0);
}
