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

function estimateEntryParts(entry: CVEntry, project: Project) {
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
    wrappedLines(entry.summary, charactersPerLine) * lineHeight +
    (entry.summary ? 6 : 0);
  const bulletHeights = entry.bullets.map(
    (bullet) =>
      wrappedLines(bullet, Math.max(20, charactersPerLine - 4)) * lineHeight +
      2,
  );
  const stackedDateHeight =
    project.layout.mode === "date-rail" || !entry.date ? 0 : lineHeight;

  return {
    identity: 7 + titleHeight + organizationHeight + stackedDateHeight,
    summary: summaryHeight,
    bullets: bulletHeights,
    bulletLead: entry.bullets.length ? 5 : 0,
    lineHeight,
  };
}

function estimateEntryHeight(entry: CVEntry, project: Project) {
  const parts = estimateEntryParts(entry, project);
  return (
    parts.identity +
    parts.summary +
    parts.bulletLead +
    parts.bullets.reduce((total, value) => total + value, 0)
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

export interface PaginationMeasurements {
  revision: string;
  headerHeight: number;
  sectionHeadings: Record<string, number>;
  entries: Record<string, number>;
}

export interface PaginatedEntry extends CVEntry {
  continuation?: boolean;
  showIdentity?: boolean;
  bulletContinuations?: boolean[];
}

export interface PaginatedSection extends Omit<CVSection, "entries"> {
  entries: PaginatedEntry[];
  continuation?: boolean;
  showHeading?: boolean;
}

export interface PaginatedPage {
  columns: PaginatedSection[][];
}

function splitAtWord(value: string, fraction: number) {
  const target = Math.max(
    1,
    Math.min(value.length - 1, Math.floor(value.length * fraction)),
  );
  const before = value.lastIndexOf(" ", target);
  const after = value.indexOf(" ", target);
  const split =
    before >= Math.min(20, target) ? before : after > 0 ? after : target;
  return [value.slice(0, split).trim(), value.slice(split).trim()] as const;
}

/**
 * Produces paper-sized fragments using the same typography and spacing tokens
 * as the preview. The estimate is deliberately slightly conservative, but it
 * is based on content height rather than an arbitrary entry count.
 */
export function paginateProject(
  project: Project,
  measurements?: PaginationMeasurements,
): PaginatedPage[] {
  const { height } = PAPER_DIMENSIONS[project.layout.paper];
  const columnCount = project.layout.mode === "two-column" ? 2 : 1;
  const singleColumnCapacity =
    height -
    project.layout.margin * 2 -
    (project.layout.showPageNumbers ? 12 : 0);
  const measured = measurements?.revision === project.updatedAt;
  const headerHeight = measured
    ? measurements.headerHeight
    : estimateHeaderHeight(project);
  const pages: PaginatedPage[] = [
    { columns: Array.from({ length: columnCount }, () => []) },
  ];
  let pageIndex = 0;
  let columnIndex = 0;
  let used = headerHeight;

  const currentColumn = () => pages[pageIndex].columns[columnIndex];
  const baseUsage = () => (pageIndex === 0 ? headerHeight : 0);

  const advanceColumn = () => {
    if (columnIndex + 1 < columnCount) {
      columnIndex += 1;
      used = baseUsage();
      return;
    }
    pages.push({
      columns: Array.from({ length: columnCount }, () => []),
    });
    pageIndex += 1;
    columnIndex = 0;
    used = 0;
  };

  const headingHeight = (section: CVSection) =>
    measured
      ? (measurements.sectionHeadings[section.id] ??
        estimateSectionHeadingHeight(section, project))
      : estimateSectionHeadingHeight(section, project);
  const entryHeight = (entry: CVEntry) =>
    measured
      ? (measurements.entries[entry.id] ?? estimateEntryHeight(entry, project))
      : estimateEntryHeight(entry, project);

  project.sections
    .filter((section) => !section.hidden)
    .forEach((section) => {
      const entries = section.entries.filter((entry) => !entry.hidden);
      if (!entries.length) return;

      const sectionHeadingHeight = headingHeight(section);
      const entryHeights = entries.map(entryHeight);
      const sectionHeight =
        sectionHeadingHeight +
        entryHeights.reduce((total, value) => total + value, 0) +
        project.theme.sectionGap;
      const emptyColumnCapacity = singleColumnCapacity - baseUsage();
      const remaining = singleColumnCapacity - used;

      if (
        project.layout.compactPageFlow === false &&
        sectionHeight <= emptyColumnCapacity &&
        sectionHeight > remaining &&
        currentColumn().length > 0
      ) {
        advanceColumn();
      }

      const firstEntryParts = estimateEntryParts(entries[0], project);
      const firstEntryEstimate = estimateEntryHeight(entries[0], project);
      const firstEntryScale =
        firstEntryEstimate > 0 ? entryHeights[0] / firstEntryEstimate : 1;
      const firstEntryContent =
        firstEntryParts.summary || firstEntryParts.bullets[0] || 0;
      const compactEntryStartHeight =
        firstEntryParts.identity * firstEntryScale +
        Math.min(
          firstEntryContent * firstEntryScale,
          firstEntryParts.lineHeight * 2,
        );
      const firstBlockHeight =
        sectionHeadingHeight +
        (project.layout.compactPageFlow === false
          ? entryHeights[0]
          : compactEntryStartHeight);
      if (
        used + firstBlockHeight > singleColumnCapacity &&
        currentColumn().length > 0
      ) {
        advanceColumn();
      }

      let fragment: PaginatedSection = {
        ...section,
        entries: [],
        continuation: false,
        showHeading: true,
      };
      currentColumn().push(fragment);
      used += sectionHeadingHeight;

      entries.forEach((entry, entryIndex) => {
        const nextEntryHeight = entryHeights[entryIndex];
        const repeatHeading = project.layout.repeatSectionHeadings === true;
        const continuationCapacity =
          singleColumnCapacity - (repeatHeading ? sectionHeadingHeight : 0);

        const continueSection = () => {
          advanceColumn();
          const showHeading = repeatHeading;
          fragment = {
            ...section,
            entries: [],
            continuation: true,
            showHeading,
          };
          currentColumn().push(fragment);
          if (showHeading) used += sectionHeadingHeight;
        };

        if (used + nextEntryHeight <= singleColumnCapacity) {
          fragment.entries.push(entry);
          used += nextEntryHeight;
          return;
        }

        if (
          project.layout.compactPageFlow === false &&
          nextEntryHeight <= continuationCapacity
        ) {
          continueSection();
          fragment.entries.push(entry);
          used += nextEntryHeight;
          return;
        }

        // An entry taller than a fresh column must be split internally. Keep
        // its identity together, then flow summaries and bullets forward.
        const estimatedParts = estimateEntryParts(entry, project);
        const estimatedTotal = estimateEntryHeight(entry, project);
        const scale = estimatedTotal > 0 ? nextEntryHeight / estimatedTotal : 1;
        const identityHeight = estimatedParts.identity * scale;
        const summaryHeight = estimatedParts.summary * scale;
        const bulletHeights = estimatedParts.bullets.map(
          (value) => value * scale,
        );
        const bulletLead = estimatedParts.bulletLead * scale;
        const minimumContentHeight = Math.min(
          summaryHeight || bulletHeights[0] || 0,
          estimatedParts.lineHeight * 2,
        );

        if (
          used + identityHeight + minimumContentHeight > singleColumnCapacity &&
          fragment.entries.length > 0
        ) {
          continueSection();
        }

        let entryFragment: PaginatedEntry = {
          ...entry,
          summary: undefined,
          bullets: [],
          bulletContinuations: [],
          continuation: false,
          showIdentity: true,
        };
        fragment.entries.push(entryFragment);
        used += identityHeight;

        const continueEntry = () => {
          continueSection();
          entryFragment = {
            ...entry,
            summary: undefined,
            bullets: [],
            bulletContinuations: [],
            continuation: true,
            showIdentity: false,
          };
          fragment.entries.push(entryFragment);
        };

        const placeText = (
          text: string,
          height: number,
          kind: "summary" | "bullet",
          bulletContinuation = false,
        ) => {
          let remainingText = text;
          let remainingHeight = height;
          let continuesBullet = bulletContinuation;

          while (remainingText) {
            let available = singleColumnCapacity - used - 6;
            if (available < estimatedParts.lineHeight * 1.5) {
              continueEntry();
              available = singleColumnCapacity - used - 6;
            }

            if (remainingHeight <= available) {
              if (kind === "summary") entryFragment.summary = remainingText;
              else {
                entryFragment.bullets.push(remainingText);
                entryFragment.bulletContinuations?.push(continuesBullet);
              }
              used += remainingHeight;
              return;
            }

            const fraction = Math.max(
              0.08,
              Math.min(0.82, (available / remainingHeight) * 0.82),
            );
            const [piece, rest] = splitAtWord(remainingText, fraction);
            if (!piece || !rest) {
              if (kind === "summary") entryFragment.summary = remainingText;
              else {
                entryFragment.bullets.push(remainingText);
                entryFragment.bulletContinuations?.push(continuesBullet);
              }
              used += Math.min(remainingHeight, available);
              return;
            }
            const pieceFraction = piece.length / remainingText.length;
            const pieceHeight = Math.min(
              available,
              Math.max(
                estimatedParts.lineHeight,
                remainingHeight * pieceFraction + estimatedParts.lineHeight,
              ),
            );
            if (kind === "summary") entryFragment.summary = piece;
            else {
              entryFragment.bullets.push(piece);
              entryFragment.bulletContinuations?.push(continuesBullet);
            }
            used += pieceHeight;
            remainingText = rest;
            remainingHeight = Math.max(
              estimatedParts.lineHeight,
              remainingHeight - pieceHeight,
            );
            continuesBullet = kind === "bullet";
            continueEntry();
          }
        };

        if (entry.summary) {
          placeText(entry.summary, summaryHeight, "summary");
        }
        entry.bullets.forEach((bullet, bulletIndex) => {
          placeText(
            bullet,
            bulletHeights[bulletIndex] + (bulletIndex === 0 ? bulletLead : 0),
            "bullet",
          );
        });
      });

      used += project.theme.sectionGap;
    });

  return pages.filter((page) =>
    page.columns.some((column) => column.length > 0),
  );
}
