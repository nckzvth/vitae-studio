"use client";

import {
  ArrowDown,
  Bold,
  Check,
  CircleAlert,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FilePlus2,
  FileSpreadsheet,
  FolderOpen,
  GripVertical,
  Italic,
  LayoutTemplate,
  List,
  Minus,
  Palette,
  PanelLeftClose,
  Plus,
  Redo2,
  RemoveFormatting,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Strikethrough,
  Trash2,
  Undo2,
  Underline,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  canonicalFieldLabels,
  canonicalFields,
  parseCsv,
  rowsToSections,
} from "@/src/lib/csv";
import { downloadRenderedPdf } from "@/src/lib/pdf";
import { deleteProject, loadProject, saveProject } from "@/src/lib/persistence";
import {
  normalizeRichText,
  plainToRichText,
  richTextForDisplay,
  richTextToPlain,
} from "@/src/lib/rich-text";
import {
  createEntry,
  createSection,
  moveEntry,
  moveItem,
  paginateProject,
  parseProjectFile,
  safeFilename,
  toProjectFile,
} from "@/src/lib/project";
import type {
  PaginatedEntry,
  PaginatedPage,
  PaginationMeasurements,
} from "@/src/lib/project";
import {
  createBlankProject,
  createDemoProject,
  themePresets,
} from "@/src/model/demo";
import type {
  CsvImportDraft,
  BulletStyle,
  CVEntry,
  CVSection,
  Project,
  RichTextSpan,
  RichTextValue,
  ThemeId,
} from "@/src/model/types";

type StudioMode = "content" | "design" | "export";
type Selection =
  { profile: true } | { sectionId: string; entryId?: string } | null;

type RichTextTarget =
  | {
      kind: "profile";
      field: "fullName" | "professionalTitle" | "summary";
    }
  | { kind: "contact"; contactId: string }
  | { kind: "section"; sectionId: string; field: "title" | "note" }
  | {
      kind: "entry";
      sectionId: string;
      entryId: string;
      field: "title" | "organization" | "location" | "date" | "summary";
    };

type DragItem =
  | { kind: "section"; sectionId: string }
  | { kind: "entry"; sectionId: string; entryId: string };

function applyRichText(
  project: Project,
  target: RichTextTarget,
  plain: string,
  formatted: RichTextValue,
) {
  if (target.kind === "contact") {
    return {
      ...project,
      profile: {
        ...project.profile,
        contacts: project.profile.contacts.map((contact) =>
          contact.id === target.contactId
            ? { ...contact, value: plain, formatting: formatted }
            : contact,
        ),
      },
    };
  }
  if (target.kind === "profile") {
    return {
      ...project,
      profile: {
        ...project.profile,
        [target.field]: plain,
        formatting: {
          ...project.profile.formatting,
          [target.field]: formatted,
        },
      },
    };
  }
  return {
    ...project,
    sections: project.sections.map((section) => {
      if (section.id !== target.sectionId) return section;
      if (target.kind === "section") {
        return {
          ...section,
          [target.field]: plain,
          formatting: {
            ...section.formatting,
            [target.field]: formatted,
          },
        };
      }
      return {
        ...section,
        entries: section.entries.map((entry) =>
          entry.id === target.entryId
            ? {
                ...entry,
                [target.field]: plain,
                formatting: {
                  ...entry.formatting,
                  [target.field]: formatted,
                },
              }
            : entry,
        ),
      };
    }),
  };
}

const themeNames: Record<ThemeId, { name: string; description: string }> = {
  academic: {
    name: "Scholar",
    description: "Classic serif with a measured date rail",
  },
  modern: { name: "Signal", description: "Clean, direct, and contemporary" },
  editorial: {
    name: "Review",
    description: "Expressive hierarchy and open rhythm",
  },
  technical: {
    name: "Index",
    description: "Compact density for detailed careers",
  },
};

function downloadText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function mergeImported(project: Project, draft: CsvImportDraft) {
  const { sections, source, profile } = rowsToSections(draft);
  const nextSections = [...project.sections];
  sections.forEach((incoming) => {
    const existingIndex = nextSections.findIndex(
      (section) => section.title.toLowerCase() === incoming.title.toLowerCase(),
    );
    if (existingIndex >= 0) {
      nextSections[existingIndex] = {
        ...nextSections[existingIndex],
        entries: [...nextSections[existingIndex].entries, ...incoming.entries],
      };
    } else {
      nextSections.push(incoming);
    }
  });
  return {
    ...project,
    profile:
      profile && project.profile.fullName === "Your name"
        ? {
            ...project.profile,
            ...profile,
            professionalTitle: profile.professionalTitle ?? "",
            contacts: profile.contacts ?? project.profile.contacts,
          }
        : project.profile,
    sections: nextSections,
    imports: [...project.imports, source],
    updatedAt: new Date().toISOString(),
  };
}

export function Studio() {
  const [project, setProject] = useState<Project | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<StudioMode>("content");
  const [selection, setSelection] = useState<Selection>(null);
  const [zoom, setZoom] = useState(78);
  const [search, setSearch] = useState("");
  const [importDraft, setImportDraft] = useState<CsvImportDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [printPreview, setPrintPreview] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"controls" | "canvas">(
    "canvas",
  );
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const directHistoryKey = useRef<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const measurementPaper = useRef<HTMLElement>(null);
  const paperStack = useRef<HTMLDivElement>(null);
  const [paginationMeasurements, setPaginationMeasurements] =
    useState<PaginationMeasurements | null>(null);

  useEffect(() => {
    loadProject()
      .then((saved) => {
        if (saved) {
          setProject(saved);
          setStarted(true);
          setSelection(
            saved.sections[0] ? { sectionId: saved.sections[0].id } : null,
          );
        }
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !project || !started) return;
    const timer = window.setTimeout(() => {
      saveProject(project).then(() => setToast("Saved on this device"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [project, ready, started]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const commit = useCallback((updater: (current: Project) => Project) => {
    setProject((current) => {
      if (!current) return current;
      setHistory((items) => [...items.slice(-39), current]);
      setFuture([]);
      return {
        ...updater(current),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const commitDirect = useCallback(
    (fieldKey: string, updater: (current: Project) => Project) => {
      setProject((current) => {
        if (!current) return current;
        if (directHistoryKey.current !== fieldKey) {
          setHistory((items) => [...items.slice(-39), current]);
          setFuture([]);
          directHistoryKey.current = fieldKey;
        }
        return {
          ...updater(current),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [],
  );

  const undo = () => {
    const previous = history.at(-1);
    if (!previous || !project) return;
    setFuture((items) => [project, ...items]);
    setHistory((items) => items.slice(0, -1));
    setProject(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next || !project) return;
    setHistory((items) => [...items, project]);
    setFuture((items) => items.slice(1));
    setProject(next);
  };

  const selectedSectionId =
    selection && "sectionId" in selection ? selection.sectionId : undefined;
  const selectedEntryId =
    selection && "sectionId" in selection ? selection.entryId : undefined;
  const profileSelected = Boolean(selection && "profile" in selection);
  const selectedSection = project?.sections.find(
    (section) => section.id === selectedSectionId,
  );
  const selectedEntry = selectedSection?.entries.find(
    (entry) => entry.id === selectedEntryId,
  );
  const visibleSections = useMemo(() => {
    if (!project) return [];
    const query = search.trim().toLowerCase();
    if (!query) return project.sections;
    return project.sections.filter(
      (section) =>
        section.title.toLowerCase().includes(query) ||
        section.entries.some((entry) =>
          `${entry.title} ${entry.organization ?? ""}`
            .toLowerCase()
            .includes(query),
        ),
    );
  }, [project, search]);

  useLayoutEffect(() => {
    const root = measurementPaper.current;
    if (!project || !root) return;

    const measure = () => {
      const header = root.querySelector<HTMLElement>("[data-measure-header]");
      const sectionHeadings: Record<string, number> = {};
      const entries: Record<string, number> = {};

      root
        .querySelectorAll<HTMLElement>("[data-section-heading]")
        .forEach((element) => {
          sectionHeadings[element.dataset.sectionHeading ?? ""] =
            element.getBoundingClientRect().height;
        });
      root
        .querySelectorAll<HTMLElement>("[data-entry-id]")
        .forEach((element) => {
          const margin = Number.parseFloat(
            getComputedStyle(element).marginBottom,
          );
          entries[element.dataset.entryId ?? ""] =
            element.getBoundingClientRect().height +
            (Number.isFinite(margin) ? margin : 0);
        });

      setPaginationMeasurements({
        revision: project.updatedAt,
        headerHeight: header?.getBoundingClientRect().height ?? 0,
        sectionHeadings,
        entries,
      });
    };

    measure();
    void document.fonts?.ready.then(measure);
  }, [project]);

  const pages = useMemo(
    () =>
      project
        ? paginateProject(project, paginationMeasurements ?? undefined)
        : [],
    [paginationMeasurements, project],
  );

  const startProject = (next: Project) => {
    setProject(next);
    setStarted(true);
    setSelection(next.sections[0] ? { sectionId: next.sections[0].id } : null);
  };

  const readCsvFile = async (file: File) => {
    const text = await file.text();
    const draft = parseCsv(text, file.name);
    setImportDraft(draft);
    if (!project) startProject(createBlankProject());
  };

  const readProjectFile = async (file: File) => {
    try {
      const next = parseProjectFile(await file.text());
      startProject(next);
      setToast("Project restored");
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "The project could not be opened",
      );
    }
  };

  const updateSection = (updates: Partial<CVSection>) => {
    if (!selectedSection) return;
    commit((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === selectedSection.id
          ? { ...section, ...updates }
          : section,
      ),
    }));
  };

  const updateEntry = (updates: Partial<CVEntry>) => {
    if (!selectedSection || !selectedEntry) return;
    commit((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === selectedSection.id
          ? {
              ...section,
              entries: section.entries.map((entry) =>
                entry.id === selectedEntry.id
                  ? { ...entry, ...updates }
                  : entry,
              ),
            }
          : section,
      ),
    }));
  };

  const updateRichText = (
    target: RichTextTarget,
    plain: string,
    formatted: RichTextValue,
  ) =>
    commitDirect(JSON.stringify(target), (current) =>
      applyRichText(current, target, plain, formatted),
    );

  const updateBullets = (
    sectionId: string,
    entryId: string,
    bullets: string[],
    formatting: RichTextValue[],
  ) =>
    commitDirect(`bullets:${sectionId}:${entryId}`, (current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              entries: section.entries.map((entry) =>
                entry.id === entryId
                  ? {
                      ...entry,
                      bullets,
                      formatting: { ...entry.formatting, bullets: formatting },
                    }
                  : entry,
              ),
            }
          : section,
      ),
    }));

  const handleEditingChange = (label: string | null) => {
    if (!label) directHistoryKey.current = null;
    setEditingLabel(label);
  };

  const applyImport = () => {
    if (!importDraft) return;
    const base = project ?? createBlankProject();
    const next = mergeImported(base, importDraft);
    if (project) commit(() => next);
    else startProject(next);
    setImportDraft(null);
    setStarted(true);
    setToast(`${importDraft.rows.length} rows added safely`);
  };

  const exportProject = () => {
    if (!project) return;
    downloadText(
      JSON.stringify(toProjectFile(project), null, 2),
      safeFilename(project.name, "vitae.json"),
      "application/json",
    );
  };

  const exportPdf = async () => {
    if (!project || isExporting) return;
    const renderedPages = Array.from(
      paperStack.current?.querySelectorAll<HTMLElement>(
        ":scope > .paper:not(.measurement-paper)",
      ) ?? [],
    );
    if (!renderedPages.length) {
      setToast("PDF export could not find the rendered CV pages");
      return;
    }

    setIsExporting(true);
    setToast("Rendering the exact CV pages…");
    document.documentElement.classList.add("exporting-pdf");
    try {
      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => resolve()),
        );
      });
      await downloadRenderedPdf(project, renderedPages);
      setToast("PDF downloaded — no browser headers or footers");
    } catch (error) {
      console.error("PDF export failed", error);
      setToast("PDF export failed. Your project is still safe.");
    } finally {
      document.documentElement.classList.remove("exporting-pdf");
      setIsExporting(false);
    }
  };

  const formatSelection = (command: string) => {
    const active = document.activeElement as HTMLElement | null;
    if (!active?.isContentEditable) return;
    document.execCommand(command, false);
    active.dispatchEvent(new InputEvent("input", { bubbles: true }));
  };

  if (!ready)
    return (
      <div className="launch-loading" role="status">
        Preparing your private studio…
      </div>
    );

  if (!started || !project) {
    return (
      <main className="start-screen">
        <header className="start-header">
          <Logo />
          <span className="privacy-note">
            <span className="privacy-dot" /> Your data stays in this browser
          </span>
        </header>
        <section className="start-hero">
          <p className="eyebrow">A private document studio</p>
          <h1>
            Your experience,
            <br />
            <em>beautifully composed.</em>
          </h1>
          <p className="hero-copy">
            Turn flexible CSV data into a polished CV. Refine every detail,
            preview real pages, and export a searchable PDF — without an account
            or an upload.
          </p>
          <div className="start-actions">
            <button
              className="primary large"
              onClick={() => csvInput.current?.click()}
            >
              <FileSpreadsheet size={18} /> Create from CSV
            </button>
            <button
              className="secondary large"
              onClick={() => startProject(createBlankProject())}
            >
              <FilePlus2 size={18} /> Start blank
            </button>
          </div>
          <div className="quiet-actions">
            <button onClick={() => startProject(createDemoProject())}>
              <Sparkles size={15} /> Explore a fictional example
            </button>
            <button onClick={() => projectInput.current?.click()}>
              <FolderOpen size={15} /> Open saved project
            </button>
            <a href="templates/universal-cv-template.csv" download>
              <FileDown size={15} /> Download CSV template
            </a>
          </div>
        </section>
        <section className="start-preview" aria-label="Product preview">
          <div className="preview-nav">
            <span />
            <span />
            <span />
          </div>
          <div className="mini-structure">
            <span className="mini-label">Structure</span>
            {[58, 76, 68, 82, 52].map((width, index) => (
              <i key={index} style={{ width: `${width}%` }} />
            ))}
          </div>
          <div className="mini-paper">
            <b>DR. MAYA CHEN</b>
            <small>ENVIRONMENTAL DATA SCIENTIST</small>
            <hr />
            {[70, 88, 62, 92, 77, 54, 86].map((width, index) => (
              <i key={index} style={{ width: `${width}%` }} />
            ))}
          </div>
          <div className="mini-inspector">
            <span className="mini-label">Design</span>
            <div className="mini-swatches">
              <i />
              <i />
              <i />
            </div>
            {[82, 64, 72, 54].map((width, index) => (
              <i key={index} style={{ width: `${width}%` }} />
            ))}
          </div>
        </section>
        <input
          ref={csvInput}
          className="sr-only"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) =>
            event.target.files?.[0] && readCsvFile(event.target.files[0])
          }
        />
        <input
          ref={projectInput}
          className="sr-only"
          type="file"
          accept=".json,.vitae.json,application/json"
          onChange={(event) =>
            event.target.files?.[0] && readProjectFile(event.target.files[0])
          }
        />
        {importDraft && (
          <ImportDialog
            draft={importDraft}
            setDraft={setImportDraft}
            onClose={() => setImportDraft(null)}
            onApply={applyImport}
          />
        )}
      </main>
    );
  }

  return (
    <main className={`studio-shell ${printPreview ? "print-preview" : ""}`}>
      <header className="studio-header">
        <Logo compact />
        <div className="document-title">
          <input
            aria-label="Project name"
            value={project.name}
            onChange={(event) =>
              commit((current) => ({ ...current, name: event.target.value }))
            }
          />
          <span>
            <Check size={12} /> Private autosave
          </span>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Undo"
            disabled={!history.length}
            onClick={undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={17} />
          </button>
          <span className="header-divider" />
          <button className="secondary compact" onClick={exportProject}>
            <FileDown size={16} /> Back up
          </button>
          <button
            className="primary compact"
            onClick={exportPdf}
            disabled={isExporting}
          >
            <Download size={16} />
            {isExporting ? "Rendering PDF…" : "Export PDF"}
          </button>
        </div>
      </header>

      <div className="studio-body">
        <nav className="mode-rail" aria-label="Studio modes">
          <button
            className={mode === "content" ? "active" : ""}
            onClick={() => {
              setMode("content");
              setMobilePanel("controls");
            }}
          >
            <PanelLeftClose size={20} />
            <span>Content</span>
          </button>
          <button
            className={mode === "design" ? "active" : ""}
            onClick={() => {
              setMode("design");
              setMobilePanel("controls");
            }}
          >
            <Palette size={20} />
            <span>Design</span>
          </button>
          <button
            className={mode === "export" ? "active" : ""}
            onClick={() => {
              setMode("export");
              setMobilePanel("controls");
            }}
          >
            <FileDown size={20} />
            <span>Export</span>
          </button>
        </nav>

        <aside
          className={`structure-panel ${mobilePanel === "canvas" ? "mobile-hidden" : ""}`}
        >
          {mode === "content" && (
            <>
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Document</span>
                  <h2>Structure</h2>
                </div>
                <button
                  className="icon-button"
                  aria-label="Import CSV"
                  onClick={() => csvInput.current?.click()}
                >
                  <Upload size={17} />
                </button>
              </div>
              <label className="search-box">
                <Search size={15} />
                <span className="sr-only">Search sections</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find anything"
                />
              </label>
              <button
                className={`profile-structure ${profileSelected ? "selected" : ""}`}
                onClick={() => setSelection({ profile: true })}
              >
                <span className="profile-icon">
                  <UserRound size={16} />
                </span>
                <span>
                  <strong>Profile &amp; contact</strong>
                  <small>{project.profile.fullName}</small>
                </span>
                <small>Header</small>
              </button>
              <div className="section-list">
                {visibleSections.map((section) => (
                  <div
                    key={section.id}
                    className={`section-row ${selectedSectionId === section.id && !selectedEntryId ? "selected" : ""} ${dropTarget === `section-${section.id}` ? "drop-target" : ""}`}
                    draggable
                    onDragStart={(event) => {
                      setDragItem({ kind: "section", sectionId: section.id });
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", section.id);
                    }}
                    onDragEnd={() => {
                      setDragItem(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (dragItem?.kind === "section") {
                        setDropTarget(`section-${section.id}`);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragItem?.kind !== "section") return;
                      commit((current) => {
                        const from = current.sections.findIndex(
                          (item) => item.id === dragItem.sectionId,
                        );
                        const to = current.sections.findIndex(
                          (item) => item.id === section.id,
                        );
                        return {
                          ...current,
                          sections: moveItem(current.sections, from, to),
                        };
                      });
                      setDragItem(null);
                      setDropTarget(null);
                    }}
                  >
                    <button
                      className="section-main"
                      onClick={() => setSelection({ sectionId: section.id })}
                      aria-label={`${section.title}. Drag to reorder section.`}
                      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                      onKeyDown={(event) => {
                        if (
                          !event.altKey ||
                          !["ArrowUp", "ArrowDown"].includes(event.key)
                        ) {
                          return;
                        }
                        event.preventDefault();
                        commit((current) => {
                          const index = current.sections.findIndex(
                            (item) => item.id === section.id,
                          );
                          const target =
                            index + (event.key === "ArrowUp" ? -1 : 1);
                          return {
                            ...current,
                            sections: moveItem(current.sections, index, target),
                          };
                        });
                      }}
                    >
                      <GripVertical size={14} className="grip" />
                      <span>{section.title}</span>
                      <small>{section.entries.length}</small>
                    </button>
                    {section.entries.map((entry) => (
                      <button
                        key={entry.id}
                        className={`entry-row ${selectedEntryId === entry.id ? "selected" : ""} ${dropTarget === `entry-${entry.id}` ? "drop-target" : ""}`}
                        draggable
                        onClick={() =>
                          setSelection({
                            sectionId: section.id,
                            entryId: entry.id,
                          })
                        }
                        onDragStart={(event) => {
                          event.stopPropagation();
                          setDragItem({
                            kind: "entry",
                            sectionId: section.id,
                            entryId: entry.id,
                          });
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", entry.id);
                        }}
                        onDragEnd={() => {
                          setDragItem(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(event) => {
                          if (dragItem?.kind !== "entry") return;
                          event.preventDefault();
                          event.stopPropagation();
                          setDropTarget(`entry-${entry.id}`);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (dragItem?.kind !== "entry") return;
                          commit((current) => ({
                            ...current,
                            sections: moveEntry(
                              current.sections,
                              dragItem.sectionId,
                              dragItem.entryId,
                              section.id,
                              entry.id,
                            ),
                          }));
                          setDragItem(null);
                          setDropTarget(null);
                        }}
                        aria-label={`${entry.title}. Drag to reorder entry.`}
                        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                        onKeyDown={(event) => {
                          if (
                            !event.altKey ||
                            !["ArrowUp", "ArrowDown"].includes(event.key)
                          ) {
                            return;
                          }
                          event.preventDefault();
                          commit((current) => ({
                            ...current,
                            sections: current.sections.map((item) => {
                              if (item.id !== section.id) return item;
                              const index = item.entries.findIndex(
                                (candidate) => candidate.id === entry.id,
                              );
                              const target =
                                index + (event.key === "ArrowUp" ? -1 : 1);
                              return {
                                ...item,
                                entries: moveItem(item.entries, index, target),
                              };
                            }),
                          }));
                        }}
                      >
                        <GripVertical size={12} className="grip" />
                        <span>{entry.title}</span>
                        {entry.hidden && <EyeOff size={12} />}
                      </button>
                    ))}
                    <button
                      className={`add-entry ${dropTarget === `entry-end-${section.id}` ? "drop-target" : ""}`}
                      onDragOver={(event) => {
                        if (dragItem?.kind !== "entry") return;
                        event.preventDefault();
                        event.stopPropagation();
                        setDropTarget(`entry-end-${section.id}`);
                      }}
                      onDrop={(event) => {
                        if (dragItem?.kind !== "entry") return;
                        event.preventDefault();
                        event.stopPropagation();
                        commit((current) => ({
                          ...current,
                          sections: moveEntry(
                            current.sections,
                            dragItem.sectionId,
                            dragItem.entryId,
                            section.id,
                          ),
                        }));
                        setDragItem(null);
                        setDropTarget(null);
                      }}
                      onClick={() => {
                        const entry = createEntry();
                        commit((current) => ({
                          ...current,
                          sections: current.sections.map((item) =>
                            item.id === section.id
                              ? { ...item, entries: [...item.entries, entry] }
                              : item,
                          ),
                        }));
                        setSelection({
                          sectionId: section.id,
                          entryId: entry.id,
                        });
                      }}
                    >
                      <Plus size={13} /> Add entry
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="add-section"
                onClick={() => {
                  const section = createSection();
                  commit((current) => ({
                    ...current,
                    sections: [...current.sections, section],
                  }));
                  setSelection({ sectionId: section.id });
                }}
              >
                <Plus size={15} /> New custom section
              </button>
              <a
                className="template-download"
                href="templates/universal-cv-template.csv"
                download
              >
                <FileDown size={14} /> Download CSV template
              </a>
            </>
          )}
          {mode === "design" && (
            <DesignPresets project={project} commit={commit} />
          )}
          {mode === "export" && (
            <ExportPanel
              project={project}
              exportProject={exportProject}
              exportPdf={exportPdf}
              isExporting={isExporting}
              onOpen={() => projectInput.current?.click()}
              onDelete={async () => {
                await deleteProject();
                setProject(null);
                setStarted(false);
              }}
            />
          )}
        </aside>

        <section
          className={`canvas-area ${mobilePanel === "controls" ? "mobile-hidden" : ""}`}
          aria-label="Document preview"
        >
          <div className="canvas-toolbar">
            <div className="view-switch">
              <button
                className={!printPreview ? "active" : ""}
                onClick={() => setPrintPreview(false)}
              >
                Pages
              </button>
              <button
                className={printPreview ? "active" : ""}
                aria-pressed={printPreview}
                onClick={() => setPrintPreview(true)}
              >
                Clean view
              </button>
            </div>
            {mode === "content" && (
              <div className="format-toolbar" aria-label="Text formatting">
                <span className="format-status">
                  {editingLabel
                    ? `Editing ${editingLabel}`
                    : "Click text to edit"}
                </span>
                {[
                  ["bold", "Bold", Bold],
                  ["italic", "Italic", Italic],
                  ["underline", "Underline", Underline],
                  ["strikeThrough", "Strikethrough", Strikethrough],
                  ["removeFormat", "Clear formatting", RemoveFormatting],
                ].map(([command, label, Icon]) => (
                  <button
                    key={String(command)}
                    type="button"
                    disabled={!editingLabel}
                    aria-label={String(label)}
                    title={String(label)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => formatSelection(String(command))}
                  >
                    <Icon size={14} />
                  </button>
                ))}
                {selectedEntry && (
                  <>
                    <span className="format-divider" />
                    <List size={14} aria-hidden="true" />
                    {(
                      [
                        ["disc", "•"],
                        ["circle", "◦"],
                        ["square", "▪"],
                        ["dash", "—"],
                        ["none", "None"],
                      ] as [BulletStyle, string][]
                    ).map(([style, symbol]) => (
                      <button
                        key={style}
                        type="button"
                        className={
                          (selectedEntry.bulletStyle ?? "disc") === style
                            ? "active"
                            : ""
                        }
                        aria-label={`${style} list style`}
                        title={`${style} list style`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => updateEntry({ bulletStyle: style })}
                      >
                        {symbol}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
            <div className="zoom-controls">
              <button
                aria-label="Zoom out"
                onClick={() => setZoom((value) => Math.max(45, value - 5))}
              >
                <Minus size={14} />
              </button>
              <span>{zoom}%</span>
              <button
                aria-label="Zoom in"
                onClick={() => setZoom((value) => Math.min(120, value + 5))}
              >
                <Plus size={14} />
              </button>
              <button onClick={() => setZoom(78)}>Fit</button>
            </div>
          </div>
          <div className="paper-scroll">
            <div
              ref={paperStack}
              className="paper-stack"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              {pages.map((page, pageIndex) => (
                <PaperPage
                  key={pageIndex}
                  project={project}
                  page={page}
                  pageNumber={pageIndex + 1}
                  selection={selection}
                  setSelection={setSelection}
                  editable={mode === "content" && !printPreview}
                  onRichTextChange={updateRichText}
                  onBulletsChange={updateBullets}
                  onEditingChange={handleEditingChange}
                />
              ))}
            </div>
            <PaperPage
              measurement
              measureRef={measurementPaper}
              project={project}
              page={{
                columns: [
                  project.sections.filter((section) => !section.hidden),
                ],
              }}
              pageNumber={1}
              selection={null}
              setSelection={() => undefined}
              editable={false}
              onRichTextChange={() => undefined}
              onBulletsChange={() => undefined}
              onEditingChange={() => undefined}
            />
          </div>
          <div className="print-preview-actions">
            <button
              className="secondary compact"
              onClick={exportPdf}
              disabled={isExporting}
            >
              <Download size={15} />
              {isExporting ? "Rendering…" : "Download PDF"}
            </button>
            <button
              className="primary compact"
              onClick={() => setPrintPreview(false)}
            >
              <X size={15} /> Exit preview
            </button>
          </div>
        </section>

        <aside
          className={`inspector-panel ${mobilePanel === "canvas" ? "mobile-hidden" : ""}`}
        >
          {mode === "content" && (
            <ContentInspector
              project={project}
              commit={commit}
              profileSelected={profileSelected}
              section={selectedSection}
              entry={selectedEntry}
              updateSection={updateSection}
              updateEntry={updateEntry}
              setSelection={setSelection}
            />
          )}
          {mode === "design" && (
            <DesignInspector project={project} commit={commit} />
          )}
          {mode === "export" && <ExportInspector project={project} />}
        </aside>
      </div>

      <div className="mobile-switch" role="group" aria-label="Mobile view">
        <button
          className={mobilePanel === "controls" ? "active" : ""}
          onClick={() => setMobilePanel("controls")}
        >
          <Settings2 size={16} /> Controls
        </button>
        <button
          className={mobilePanel === "canvas" ? "active" : ""}
          onClick={() => setMobilePanel("canvas")}
        >
          <Eye size={16} /> Preview
        </button>
      </div>
      <input
        ref={csvInput}
        className="sr-only"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) =>
          event.target.files?.[0] && readCsvFile(event.target.files[0])
        }
      />
      <input
        ref={projectInput}
        className="sr-only"
        type="file"
        accept=".json,.vitae.json,application/json"
        onChange={(event) =>
          event.target.files?.[0] && readProjectFile(event.target.files[0])
        }
      />
      {importDraft && (
        <ImportDialog
          draft={importDraft}
          setDraft={setImportDraft}
          onClose={() => setImportDraft(null)}
          onApply={applyImport}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} /> {toast}
        </div>
      )}
    </main>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? "compact-logo" : ""}`}>
      <span>V</span>
      <strong>Vitae</strong>
      {!compact && <em>Studio</em>}
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function richTextToHtml(value: RichTextValue) {
  return value.spans
    .map((span) => {
      let html = escapeHtml(span.text).replaceAll("\n", "<br>");
      if (span.bold) html = `<strong>${html}</strong>`;
      if (span.italic) html = `<em>${html}</em>`;
      if (span.underline) html = `<u>${html}</u>`;
      if (span.strikethrough) html = `<s>${html}</s>`;
      return html;
    })
    .join("");
}

function richTextFromElement(element: HTMLElement) {
  const spans: RichTextSpan[] = [];
  const append = (text: string, marks: Omit<RichTextSpan, "text">) => {
    if (!text) return;
    spans.push({ text, ...marks });
  };
  const visit = (node: Node, marks: Omit<RichTextSpan, "text">) => {
    if (node.nodeType === Node.TEXT_NODE) {
      append(node.textContent ?? "", marks);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      append("\n", marks);
      return;
    }
    const tag = node.tagName.toLowerCase();
    const style = node.style;
    const nextMarks = {
      ...marks,
      ...(["b", "strong"].includes(tag) ||
      style.fontWeight === "bold" ||
      Number.parseInt(style.fontWeight, 10) >= 600
        ? { bold: true }
        : {}),
      ...(["i", "em"].includes(tag) || style.fontStyle === "italic"
        ? { italic: true }
        : {}),
      ...(tag === "u" || style.textDecoration.includes("underline")
        ? { underline: true }
        : {}),
      ...(["s", "strike"].includes(tag) ||
      style.textDecoration.includes("line-through")
        ? { strikethrough: true }
        : {}),
    };
    if (
      ["div", "p"].includes(tag) &&
      spans.length > 0 &&
      !spans.at(-1)?.text.endsWith("\n")
    ) {
      append("\n", marks);
    }
    node.childNodes.forEach((child) => visit(child, nextMarks));
  };
  element.childNodes.forEach((node) => visit(node, {}));
  const normalized = normalizeRichText({ spans });
  return /^\n*$/.test(richTextToPlain(normalized))
    ? plainToRichText("")
    : normalized;
}

function RichTextDisplay({ value }: { value: RichTextValue }) {
  return value.spans.map((span, index) => {
    let content: React.ReactNode = span.text.split("\n").map((part, line) => (
      <span key={line}>
        {line}
        {line < span.text.split("\n").length - 1 && <br />}
      </span>
    ));
    if (span.bold) content = <strong>{content}</strong>;
    if (span.italic) content = <em>{content}</em>;
    if (span.underline) content = <u>{content}</u>;
    if (span.strikethrough) content = <s>{content}</s>;
    return <span key={index}>{content}</span>;
  });
}

function DirectText({
  as,
  value,
  formatted,
  editable,
  label,
  placeholder,
  wrapperClassName = "",
  onChange,
  onEditingChange,
}: {
  as: "div" | "h1" | "h2" | "h3" | "p" | "span";
  value: string;
  formatted?: RichTextValue;
  editable: boolean;
  label: string;
  placeholder?: string;
  wrapperClassName?: string;
  onChange: (plain: string, formatted: RichTextValue) => void;
  onEditingChange: (label: string | null) => void;
}) {
  const editorRef = useRef<HTMLElement>(null);
  const snapshot = useRef<RichTextValue>(plainToRichText(value));
  const lastEmitted = useRef("");
  const [active, setActive] = useState(false);
  const displayValue = richTextForDisplay(formatted, value);
  const serialized = JSON.stringify(displayValue);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || serialized === lastEmitted.current) return;
    editor.innerHTML = richTextToHtml(displayValue) || "<br>";
    lastEmitted.current = serialized;
  }, [displayValue, serialized]);

  if (!editable) {
    return createElement(
      as,
      wrapperClassName ? { className: wrapperClassName } : undefined,
      <RichTextDisplay value={displayValue} />,
    );
  }

  const Shell = as === "span" ? "span" : "div";
  return (
    <Shell className={`inline-editor-shell ${wrapperClassName}`.trim()}>
      {createElement(as, {
        ref: editorRef,
        className: "direct-text-editor",
        contentEditable: true,
        suppressContentEditableWarning: true,
        spellCheck: true,
        role: "textbox",
        "aria-label": `Edit ${label} directly in the document`,
        "data-placeholder": placeholder,
        "data-empty": value.length === 0 || undefined,
        onFocus: () => {
          snapshot.current = richTextFromElement(editorRef.current!);
          setActive(true);
          onEditingChange(label);
        },
        onBlur: () => {
          setActive(false);
          onEditingChange(null);
        },
        onInput: (event: React.FormEvent<HTMLElement>) => {
          const next = richTextFromElement(event.currentTarget);
          lastEmitted.current = JSON.stringify(next);
          onChange(richTextToPlain(next), next);
        },
        onPaste: (event: React.ClipboardEvent<HTMLElement>) => {
          event.preventDefault();
          const pastedHtml = event.clipboardData.getData("text/html");
          if (pastedHtml) {
            const temporary = document.createElement("div");
            temporary.innerHTML = pastedHtml;
            document.execCommand(
              "insertHTML",
              false,
              richTextToHtml(richTextFromElement(temporary)),
            );
          } else {
            document.execCommand(
              "insertText",
              false,
              event.clipboardData.getData("text/plain"),
            );
          }
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
          if (event.key === "Escape") event.currentTarget.blur();
        },
      })}
      {active && (
        <button
          type="button"
          className="field-revert"
          aria-label={`Undo changes to ${label}`}
          title={`Undo changes to ${label}`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            const next = snapshot.current;
            if (editorRef.current) {
              editorRef.current.innerHTML = richTextToHtml(next) || "<br>";
            }
            lastEmitted.current = JSON.stringify(next);
            onChange(richTextToPlain(next), next);
          }}
        >
          <RotateCcw size={11} />
        </button>
      )}
    </Shell>
  );
}

function BulletListEditor({
  bullets,
  formatting,
  continuations,
  style,
  editable,
  label,
  onChange,
  onEditingChange,
}: {
  bullets: string[];
  formatting: RichTextValue[];
  continuations?: boolean[];
  style: BulletStyle;
  editable: boolean;
  label: string;
  onChange: (bullets: string[], formatting: RichTextValue[]) => void;
  onEditingChange: (label: string | null) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const snapshot = useRef(formatting);
  const lastEmitted = useRef("");
  const [active, setActive] = useState(false);
  const serialized = JSON.stringify(formatting);

  const fillList = useCallback(
    (values: RichTextValue[]) => {
      const list = listRef.current;
      if (!list) return;
      list.replaceChildren();
      (values.length ? values : [plainToRichText("")]).forEach(
        (formattedBullet, index) => {
          const item = document.createElement("li");
          if (continuations?.[index]) item.className = "bullet-continuation";
          item.innerHTML = richTextToHtml(formattedBullet) || "<br>";
          list.append(item);
        },
      );
    },
    [continuations],
  );

  useLayoutEffect(() => {
    if (serialized === lastEmitted.current) return;
    fillList(formatting);
    lastEmitted.current = serialized;
  }, [fillList, formatting, serialized]);

  if (!editable) {
    return (
      <ul className={`bullet-style-${style}`}>
        {bullets.map((bullet, index) => (
          <li
            className={
              continuations?.[index] ? "bullet-continuation" : undefined
            }
            key={index}
          >
            <RichTextDisplay
              value={formatting[index] ?? plainToRichText(bullet)}
            />
          </li>
        ))}
      </ul>
    );
  }

  const readList = (list: HTMLUListElement) => {
    const values = Array.from(
      list.querySelectorAll<HTMLLIElement>(":scope > li"),
    )
      .map((item) => richTextFromElement(item))
      .filter((item) => richTextToPlain(item).trim().length > 0);
    return {
      values,
      bullets: values.map(richTextToPlain),
    };
  };

  return (
    <div className="bullet-editor-shell">
      <ul
        ref={listRef}
        className={`direct-bullet-editor bullet-style-${style}`}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-label="Edit bullet list directly in the document"
        data-empty={bullets.length === 0 || undefined}
        onFocus={() => {
          snapshot.current = readList(listRef.current!).values;
          setActive(true);
          onEditingChange(label);
        }}
        onBlur={() => {
          setActive(false);
          onEditingChange(null);
        }}
        onInput={(event) => {
          const next = readList(event.currentTarget);
          lastEmitted.current = JSON.stringify(next.values);
          onChange(next.bullets, next.values);
        }}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
      />
      {active && (
        <button
          type="button"
          className="field-revert"
          aria-label="Undo changes to bullet list"
          title="Undo changes to bullet list"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            fillList(snapshot.current);
            lastEmitted.current = JSON.stringify(snapshot.current);
            onChange(snapshot.current.map(richTextToPlain), snapshot.current);
          }}
        >
          <RotateCcw size={11} />
        </button>
      )}
    </div>
  );
}

function PaperPage({
  project,
  page,
  pageNumber,
  selection,
  setSelection,
  measurement = false,
  measureRef,
  editable,
  onRichTextChange,
  onBulletsChange,
  onEditingChange,
}: {
  project: Project;
  page: PaginatedPage;
  pageNumber: number;
  selection: Selection;
  setSelection: (value: Selection) => void;
  measurement?: boolean;
  measureRef?: React.Ref<HTMLElement>;
  editable: boolean;
  onRichTextChange: (
    target: RichTextTarget,
    plain: string,
    formatted: RichTextValue,
  ) => void;
  onBulletsChange: (
    sectionId: string,
    entryId: string,
    bullets: string[],
    formatting: RichTextValue[],
  ) => void;
  onEditingChange: (label: string | null) => void;
}) {
  const theme = project.theme;
  const selectedSectionId =
    selection && "sectionId" in selection ? selection.sectionId : undefined;
  const selectedEntryId =
    selection && "sectionId" in selection ? selection.entryId : undefined;
  const profileSelected = Boolean(selection && "profile" in selection);
  const pageStyle = {
    "--doc-accent": theme.accent,
    "--doc-text": theme.text,
    "--doc-muted": theme.muted,
    "--doc-paper": theme.paper,
    "--doc-heading-font": theme.headingFont,
    "--doc-body-font": theme.bodyFont,
    "--doc-body-size": `${theme.bodySize}px`,
    "--doc-heading-size": `${theme.headingSize}px`,
    "--doc-line-height": theme.lineHeight,
    "--doc-section-gap": `${theme.sectionGap}px`,
    "--doc-rule-width": `${theme.ruleWidth}px`,
    "--doc-margin": `${project.layout.margin}px`,
  } as React.CSSProperties;
  return (
    <article
      ref={measureRef}
      className={`paper ${measurement ? "measurement-paper" : ""} ${project.layout.paper} ${project.layout.mode} ${project.layout.showGuides && !measurement ? "show-guides" : ""}`}
      style={pageStyle}
      aria-hidden={measurement || undefined}
    >
      {pageNumber === 1 && (
        <header
          data-measure-header={measurement || undefined}
          className={`cv-header ${profileSelected ? "selected-element" : ""}`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) {
              event.preventDefault();
            }
            setSelection({ profile: true });
          }}
        >
          <DirectText
            as="h1"
            value={project.profile.fullName}
            formatted={project.profile.formatting?.fullName}
            editable={editable}
            label="name"
            placeholder="Your name"
            onEditingChange={onEditingChange}
            onChange={(plain, formatted) =>
              onRichTextChange(
                { kind: "profile", field: "fullName" },
                plain,
                formatted,
              )
            }
          />
          <DirectText
            as="p"
            value={project.profile.professionalTitle}
            formatted={project.profile.formatting?.professionalTitle}
            editable={editable}
            label="professional title"
            placeholder="Professional title"
            onEditingChange={onEditingChange}
            onChange={(plain, formatted) =>
              onRichTextChange(
                { kind: "profile", field: "professionalTitle" },
                plain,
                formatted,
              )
            }
          />
          <div className="contact-line">
            {project.profile.contacts
              .filter(
                (contact) => contact.value || (editable && profileSelected),
              )
              .map((contact) =>
                contact.href ? (
                  <a key={contact.id} href={contact.href}>
                    <DirectText
                      as="span"
                      value={contact.value}
                      formatted={contact.formatting}
                      editable={editable}
                      label={contact.label.toLowerCase()}
                      placeholder={contact.label}
                      onEditingChange={onEditingChange}
                      onChange={(plain, formatted) =>
                        onRichTextChange(
                          { kind: "contact", contactId: contact.id },
                          plain,
                          formatted,
                        )
                      }
                    />
                  </a>
                ) : (
                  <DirectText
                    key={contact.id}
                    as="span"
                    value={contact.value}
                    formatted={contact.formatting}
                    editable={editable}
                    label={contact.label.toLowerCase()}
                    placeholder={contact.label}
                    onEditingChange={onEditingChange}
                    onChange={(plain, formatted) =>
                      onRichTextChange(
                        { kind: "contact", contactId: contact.id },
                        plain,
                        formatted,
                      )
                    }
                  />
                ),
              )}
          </div>
          {(project.profile.summary || (editable && profileSelected)) && (
            <DirectText
              as="div"
              wrapperClassName="profile-summary"
              value={project.profile.summary ?? ""}
              formatted={project.profile.formatting?.summary}
              editable={editable}
              label="profile summary"
              onEditingChange={onEditingChange}
              onChange={(plain, formatted) =>
                onRichTextChange(
                  { kind: "profile", field: "summary" },
                  plain,
                  formatted,
                )
              }
            />
          )}
        </header>
      )}
      <div className="cv-sections">
        {page.columns.map((sections, columnIndex) => (
          <div className="cv-column" key={columnIndex}>
            {sections.map((section, sectionIndex) => (
              <section
                key={`${section.id}-${sectionIndex}`}
                className={`cv-section ${section.continuation ? "section-continuation" : ""} ${selectedSectionId === section.id && !selectedEntryId ? "selected-element" : ""}`}
                onClick={() => setSelection({ sectionId: section.id })}
              >
                {section.showHeading !== false && (
                  <div
                    className="section-heading"
                    data-section-heading={measurement ? section.id : undefined}
                  >
                    <DirectText
                      as="h2"
                      value={section.title}
                      formatted={section.formatting?.title}
                      editable={editable}
                      label={`${section.title} heading`}
                      placeholder="Section heading"
                      onEditingChange={onEditingChange}
                      onChange={(plain, formatted) =>
                        onRichTextChange(
                          {
                            kind: "section",
                            sectionId: section.id,
                            field: "title",
                          },
                          plain,
                          formatted,
                        )
                      }
                    />
                    {(section.note ||
                      (editable &&
                        selectedSectionId === section.id &&
                        !selectedEntryId)) && (
                      <DirectText
                        as="p"
                        wrapperClassName="section-note"
                        value={section.note ?? ""}
                        formatted={section.formatting?.note}
                        editable={editable}
                        label={`${section.title} note`}
                        onEditingChange={onEditingChange}
                        onChange={(plain, formatted) =>
                          onRichTextChange(
                            {
                              kind: "section",
                              sectionId: section.id,
                              field: "note",
                            },
                            plain,
                            formatted,
                          )
                        }
                      />
                    )}
                  </div>
                )}
                {section.entries.map((entry, entryIndex) => (
                  <CVEntryView
                    entry={entry}
                    entryIndex={entryIndex}
                    key={`${entry.id}-${entryIndex}`}
                    measurement={measurement}
                    sectionId={section.id}
                    selected={selectedEntryId === entry.id}
                    setSelection={setSelection}
                    editable={editable}
                    onRichTextChange={onRichTextChange}
                    onBulletsChange={onBulletsChange}
                    onEditingChange={onEditingChange}
                  />
                ))}
              </section>
            ))}
          </div>
        ))}
      </div>
      {project.layout.showPageNumbers && !measurement && (
        <footer className="page-number">{pageNumber}</footer>
      )}
    </article>
  );
}

function CVEntryView({
  entry,
  entryIndex,
  measurement,
  sectionId,
  selected,
  setSelection,
  editable,
  onRichTextChange,
  onBulletsChange,
  onEditingChange,
}: {
  entry: PaginatedEntry;
  entryIndex: number;
  measurement: boolean;
  sectionId: string;
  selected: boolean;
  setSelection: (value: Selection) => void;
  editable: boolean;
  onRichTextChange: (
    target: RichTextTarget,
    plain: string,
    formatted: RichTextValue,
  ) => void;
  onBulletsChange: (
    sectionId: string,
    entryId: string,
    bullets: string[],
    formatting: RichTextValue[],
  ) => void;
  onEditingChange: (label: string | null) => void;
}) {
  const showIdentity = entry.showIdentity !== false;
  const canEdit = editable && !entry.fragmented;
  const entryTarget = (
    field: "title" | "organization" | "location" | "date" | "summary",
  ): RichTextTarget => ({
    kind: "entry",
    sectionId,
    entryId: entry.id,
    field,
  });
  return (
    <article
      data-entry-id={measurement ? entry.id : undefined}
      className={`cv-entry ${entry.continuation ? "entry-continuation" : ""} ${selected ? "selected-element" : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        setSelection({ sectionId, entryId: entry.id });
      }}
    >
      <div className="entry-date">
        {showIdentity && (entry.date || (selected && canEdit)) && (
          <DirectText
            as="div"
            value={entry.date ?? ""}
            formatted={entry.formatting?.date}
            editable={canEdit}
            label="date"
            placeholder="Date"
            onEditingChange={onEditingChange}
            onChange={(plain, formatted) =>
              onRichTextChange(entryTarget("date"), plain, formatted)
            }
          />
        )}
      </div>
      <div className="entry-content">
        {showIdentity && (
          <DirectText
            as="h3"
            value={entry.title}
            formatted={entry.formatting?.title}
            editable={canEdit}
            label="title or role"
            placeholder="Title or role"
            onEditingChange={onEditingChange}
            onChange={(plain, formatted) =>
              onRichTextChange(entryTarget("title"), plain, formatted)
            }
          />
        )}
        {showIdentity &&
          (entry.organization || entry.location || (selected && canEdit)) && (
            <div className="entry-org">
              {(Boolean(entry.organization) || (selected && canEdit)) && (
                <DirectText
                  as="span"
                  value={entry.organization ?? ""}
                  formatted={entry.formatting?.organization}
                  editable={canEdit}
                  label="organization"
                  placeholder="Organization"
                  onEditingChange={onEditingChange}
                  onChange={(plain, formatted) =>
                    onRichTextChange(
                      entryTarget("organization"),
                      plain,
                      formatted,
                    )
                  }
                />
              )}
              {entry.organization && entry.location ? " · " : ""}
              {(Boolean(entry.location) || (selected && canEdit)) && (
                <DirectText
                  as="span"
                  value={entry.location ?? ""}
                  formatted={entry.formatting?.location}
                  editable={canEdit}
                  label="location"
                  placeholder="Location"
                  onEditingChange={onEditingChange}
                  onChange={(plain, formatted) =>
                    onRichTextChange(entryTarget("location"), plain, formatted)
                  }
                />
              )}
            </div>
          )}
        {(entry.summary || (selected && canEdit)) && (
          <DirectText
            as="p"
            value={entry.summary ?? ""}
            formatted={richTextForDisplay(
              entry.formatting?.summary,
              entry.summary,
            )}
            editable={canEdit}
            label="summary"
            onEditingChange={onEditingChange}
            onChange={(plain, formatted) =>
              onRichTextChange(entryTarget("summary"), plain, formatted)
            }
          />
        )}
        {(entry.bullets.length > 0 || (selected && canEdit)) && (
          <BulletListEditor
            key={`${entry.id}-${entryIndex}`}
            bullets={entry.bullets}
            formatting={entry.bullets.map((bullet, index) =>
              richTextForDisplay(
                entry.formatting?.bullets?.[
                  entry.bulletSourceIndexes?.[index] ?? index
                ],
                bullet,
              ),
            )}
            continuations={entry.bulletContinuations}
            style={entry.bulletStyle ?? "disc"}
            editable={canEdit}
            label="bullet list"
            onEditingChange={onEditingChange}
            onChange={(bullets, formatting) =>
              onBulletsChange(sectionId, entry.id, bullets, formatting)
            }
          />
        )}
      </div>
    </article>
  );
}

function ContentInspector({
  project,
  commit,
  profileSelected,
  section,
  entry,
  updateSection,
  updateEntry,
  setSelection,
}: {
  project: Project;
  commit: (updater: (project: Project) => Project) => void;
  profileSelected: boolean;
  section?: CVSection;
  entry?: CVEntry;
  updateSection: (updates: Partial<CVSection>) => void;
  updateEntry: (updates: Partial<CVEntry>) => void;
  setSelection: (selection: Selection) => void;
}) {
  if (profileSelected) {
    const updateProfile = (updates: Partial<Project["profile"]>) =>
      commit((current) => ({
        ...current,
        profile: { ...current.profile, ...updates },
      }));
    const updateContact = (
      id: string,
      updates: Partial<Project["profile"]["contacts"][number]>,
    ) =>
      updateProfile({
        contacts: project.profile.contacts.map((contact) =>
          contact.id === id ? { ...contact, ...updates } : contact,
        ),
      });

    return (
      <div className="inspector-content">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Person header</span>
            <h2>Profile &amp; contact</h2>
          </div>
          <UserRound size={19} className="heading-icon" />
        </div>
        <div className="direct-edit-callout">
          <strong>Edit on the page</strong>
          <p>
            Click your name, title, summary, or contact text in the CV. Select
            any words to format them, just like a document editor.
          </p>
        </div>
        <div className="inspector-group contact-group">
          <div className="contact-group-heading">
            <span className="group-label">Contact details</span>
            <button
              onClick={() =>
                updateProfile({
                  contacts: [
                    ...project.profile.contacts,
                    {
                      id: crypto.randomUUID(),
                      label: "Contact",
                      value: "",
                    },
                  ],
                })
              }
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {project.profile.contacts.length === 0 && (
            <p className="helper">Add email, location, phone, or web links.</p>
          )}
          {project.profile.contacts.map((contact) => (
            <div className="contact-editor" key={contact.id}>
              <div className="contact-editor-row">
                <label>
                  <span>Label</span>
                  <input
                    aria-label={`Label for ${contact.value || "contact"}`}
                    value={contact.label}
                    onChange={(event) =>
                      updateContact(contact.id, { label: event.target.value })
                    }
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label={`Remove ${contact.label}`}
                  onClick={() =>
                    updateProfile({
                      contacts: project.profile.contacts.filter(
                        (item) => item.id !== contact.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <label className="contact-link-field">
                <span>Link or mailto (optional)</span>
                <input
                  aria-label={`Link for ${contact.label}`}
                  value={contact.href ?? ""}
                  placeholder="https://… or mailto:…"
                  onChange={(event) =>
                    updateContact(contact.id, {
                      href: event.target.value || undefined,
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
        <p className="helper">
          Contact labels and links stay here; edit the visible text directly on
          the page. The small rollback button restores the active field in one
          click.
        </p>
      </div>
    );
  }
  if (!section) {
    return (
      <div className="empty-inspector">
        <LayoutTemplate size={24} />
        <h3>Select something</h3>
        <p>Choose a section or entry to edit its content and page behavior.</p>
      </div>
    );
  }
  if (!entry) {
    return (
      <div className="inspector-content">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Section</span>
            <h2>{section.title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label={section.hidden ? "Show section" : "Hide section"}
            onClick={() => updateSection({ hidden: !section.hidden })}
          >
            {section.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <div className="direct-edit-callout">
          <strong>Edit on the page</strong>
          <p>
            Click the section heading or its optional note in the CV and type
            where the text appears.
          </p>
        </div>
        <div className="inspector-group">
          <span className="group-label">Entries</span>
          <p className="helper">
            {section.entries.length} entries in this section. Drag sections and
            entries by their grip handles to reorder them.
          </p>
        </div>
        <button
          className="danger-text"
          onClick={() => {
            commit((current) => ({
              ...current,
              sections: current.sections.filter(
                (item) => item.id !== section.id,
              ),
            }));
            setSelection(null);
          }}
        >
          <Trash2 size={15} /> Delete section
        </button>
      </div>
    );
  }
  return (
    <div className="inspector-content">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Entry</span>
          <h2>Edit content</h2>
        </div>
        <button
          className="icon-button"
          aria-label={entry.hidden ? "Show entry" : "Hide entry"}
          onClick={() => updateEntry({ hidden: !entry.hidden })}
        >
          {entry.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      <div className="direct-edit-callout">
        <strong>Edit on the page</strong>
        <p>
          Click any visible field in this entry. Press Enter for a new line or a
          new bullet, and select text before using bold, italic, underline, or
          clear-format controls above the page.
        </p>
      </div>
      <Field label="Bullet marker">
        <select
          value={entry.bulletStyle ?? "disc"}
          onChange={(event) =>
            updateEntry({ bulletStyle: event.target.value as BulletStyle })
          }
        >
          <option value="disc">Filled circle</option>
          <option value="circle">Open circle</option>
          <option value="square">Square</option>
          <option value="dash">Dash</option>
          <option value="none">No marker</option>
        </select>
      </Field>
      <button
        className="danger-text"
        onClick={() => {
          commit((current) => ({
            ...current,
            sections: current.sections.map((item) =>
              item.id === section.id
                ? {
                    ...item,
                    entries: item.entries.filter(
                      (candidate) => candidate.id !== entry.id,
                    ),
                  }
                : item,
            ),
          }));
          setSelection({ sectionId: section.id });
        }}
      >
        <Trash2 size={15} /> Delete entry
      </button>
    </div>
  );
}

function DesignPresets({
  project,
  commit,
}: {
  project: Project;
  commit: (updater: (project: Project) => Project) => void;
}) {
  return (
    <div className="design-presets">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Starting points</span>
          <h2>Presets</h2>
        </div>
      </div>
      <p className="panel-intro">
        Presets change the composition, never your content.
      </p>
      {(Object.keys(themePresets) as ThemeId[]).map((id) => (
        <button
          key={id}
          className={`preset-row ${project.theme.preset === id ? "selected" : ""}`}
          onClick={() =>
            commit((current) => ({
              ...current,
              theme: { ...themePresets[id] },
              layout: {
                ...current.layout,
                mode:
                  id === "academic"
                    ? "date-rail"
                    : id === "technical"
                      ? "two-column"
                      : "single",
              },
            }))
          }
        >
          <span className={`preset-swatch ${id}`}>
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>{themeNames[id].name}</strong>
            <small>{themeNames[id].description}</small>
          </span>
          {project.theme.preset === id && <Check size={16} />}
        </button>
      ))}
    </div>
  );
}

function DesignInspector({
  project,
  commit,
}: {
  project: Project;
  commit: (updater: (project: Project) => Project) => void;
}) {
  const setTheme = (updates: Partial<Project["theme"]>) =>
    commit((current) => ({
      ...current,
      theme: { ...current.theme, ...updates },
    }));
  const setLayout = (updates: Partial<Project["layout"]>) =>
    commit((current) => ({
      ...current,
      layout: { ...current.layout, ...updates },
    }));
  return (
    <div className="inspector-content">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Theme</span>
          <h2>Fine tune</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Reset preset"
          onClick={() => setTheme(themePresets[project.theme.preset])}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <div className="inspector-group">
        <span className="group-label">Color</span>
        <div className="color-row">
          <label>
            <input
              type="color"
              value={project.theme.accent}
              onChange={(event) => setTheme({ accent: event.target.value })}
            />
            <span>Accent</span>
          </label>
          <label>
            <input
              type="color"
              value={project.theme.text}
              onChange={(event) => setTheme({ text: event.target.value })}
            />
            <span>Text</span>
          </label>
          <label>
            <input
              type="color"
              value={project.theme.paper}
              onChange={(event) => setTheme({ paper: event.target.value })}
            />
            <span>Paper</span>
          </label>
        </div>
      </div>
      <Field label="Layout">
        <select
          value={project.layout.mode}
          onChange={(event) =>
            setLayout({ mode: event.target.value as Project["layout"]["mode"] })
          }
        >
          <option value="single">One column</option>
          <option value="date-rail">Date rail</option>
          <option value="two-column">Two column</option>
        </select>
      </Field>
      <Field label="Paper">
        <div className="segmented">
          <button
            className={project.layout.paper === "letter" ? "active" : ""}
            onClick={() => setLayout({ paper: "letter" })}
          >
            Letter
          </button>
          <button
            className={project.layout.paper === "a4" ? "active" : ""}
            onClick={() => setLayout({ paper: "a4" })}
          >
            A4
          </button>
        </div>
      </Field>
      <RangeField
        label="Body size"
        value={project.theme.bodySize}
        min={8}
        max={14}
        step={0.5}
        suffix="pt"
        onChange={(value) => setTheme({ bodySize: value })}
      />
      <RangeField
        label="Line height"
        value={project.theme.lineHeight}
        min={1.2}
        max={1.8}
        step={0.05}
        onChange={(value) => setTheme({ lineHeight: value })}
      />
      <RangeField
        label="Margins"
        value={project.layout.margin}
        min={28}
        max={72}
        step={2}
        suffix="px"
        onChange={(value) => setLayout({ margin: value })}
      />
      <RangeField
        label="Section spacing"
        value={project.theme.sectionGap}
        min={8}
        max={36}
        step={1}
        suffix="px"
        onChange={(value) => setTheme({ sectionGap: value })}
      />
      <div className="toggle-row">
        <span>
          <strong>Compact page flow</strong>
          <small>Fill pages; move only orphaned headings</small>
        </span>
        <button
          role="switch"
          aria-label="Compact page flow"
          aria-checked={project.layout.compactPageFlow !== false}
          className={
            project.layout.compactPageFlow !== false ? "switch on" : "switch"
          }
          onClick={() =>
            setLayout({
              compactPageFlow: project.layout.compactPageFlow === false,
            })
          }
        >
          <span />
        </button>
      </div>
      <div className="toggle-row">
        <span>
          <strong>Repeat section headings</strong>
          <small>Show headings again on continuation pages</small>
        </span>
        <button
          role="switch"
          aria-label="Repeat section headings"
          aria-checked={project.layout.repeatSectionHeadings === true}
          className={
            project.layout.repeatSectionHeadings === true
              ? "switch on"
              : "switch"
          }
          onClick={() =>
            setLayout({
              repeatSectionHeadings:
                project.layout.repeatSectionHeadings !== true,
            })
          }
        >
          <span />
        </button>
      </div>
      <div className="toggle-row">
        <span>
          <strong>Margin guides</strong>
          <small>Show the print-safe boundary</small>
        </span>
        <button
          role="switch"
          aria-checked={project.layout.showGuides}
          className={project.layout.showGuides ? "switch on" : "switch"}
          onClick={() => setLayout({ showGuides: !project.layout.showGuides })}
        >
          <span />
        </button>
      </div>
      <div className="toggle-row">
        <span>
          <strong>Page numbers</strong>
          <small>Centered below document content</small>
        </span>
        <button
          role="switch"
          aria-checked={project.layout.showPageNumbers}
          className={project.layout.showPageNumbers ? "switch on" : "switch"}
          onClick={() =>
            setLayout({ showPageNumbers: !project.layout.showPageNumbers })
          }
        >
          <span />
        </button>
      </div>
    </div>
  );
}

function ExportPanel({
  project,
  exportProject,
  exportPdf,
  isExporting,
  onOpen,
  onDelete,
}: {
  project: Project;
  exportProject: () => void;
  exportPdf: () => Promise<void>;
  isExporting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="export-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Finish</span>
          <h2>Export</h2>
        </div>
      </div>
      <p className="panel-intro">
        Everything is created on this device. No CV data is uploaded.
      </p>
      <button
        className="export-action primary"
        onClick={exportPdf}
        disabled={isExporting}
      >
        <Download size={18} />
        <span>
          <strong>{isExporting ? "Rendering PDF…" : "Download PDF"}</strong>
          <small>Exact CV pages, no browser print decorations</small>
        </span>
      </button>
      <button className="export-action secondary" onClick={exportProject}>
        <FileDown size={18} />
        <span>
          <strong>Back up project</strong>
          <small>Editable .vitae.json file</small>
        </span>
      </button>
      <button className="export-action secondary" onClick={onOpen}>
        <FolderOpen size={18} />
        <span>
          <strong>Open project</strong>
          <small>Restore an exported backup</small>
        </span>
      </button>
      <div className="project-facts">
        <span>
          <strong>{project.sections.length}</strong> sections
        </span>
        <span>
          <strong>
            {project.sections.reduce(
              (sum, section) => sum + section.entries.length,
              0,
            )}
          </strong>{" "}
          entries
        </span>
        <span>
          <strong>{project.layout.paper.toUpperCase()}</strong> paper
        </span>
      </div>
      <button className="danger-text" onClick={onDelete}>
        <Trash2 size={15} /> Delete local project
      </button>
    </div>
  );
}

function ExportInspector({ project }: { project: Project }) {
  const warnings = [
    !project.profile.fullName.trim() && "Add a name before exporting",
    project.sections.every((section) => section.hidden) &&
      "Every section is hidden",
  ].filter(Boolean);
  return (
    <div className="inspector-content">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Review</span>
          <h2>Ready check</h2>
        </div>
      </div>
      {warnings.length ? (
        warnings.map((warning) => (
          <div key={String(warning)} className="warning">
            <CircleAlert size={16} />
            {warning}
          </div>
        ))
      ) : (
        <div className="ready-state">
          <span>
            <Check size={18} />
          </span>
          <h3>Ready to export</h3>
          <p>Your document has visible content and a valid page size.</p>
        </div>
      )}
      <div className="review-list">
        <span>
          <Check size={14} /> Searchable vector text
        </span>
        <span>
          <Check size={14} /> Page numbers{" "}
          {project.layout.showPageNumbers ? "included" : "hidden"}
        </span>
        <span>
          <Check size={14} /> No data leaves this browser
        </span>
      </div>
      <p className="helper">
        PDF typography uses reliable built-in fonts in this release. Web-font
        embedding and exact preview metric matching are on the roadmap.
      </p>
    </div>
  );
}

function ImportDialog({
  draft,
  setDraft,
  onClose,
  onApply,
}: {
  draft: CsvImportDraft;
  setDraft: (draft: CsvImportDraft) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
      >
        <header>
          <div>
            <span className="eyebrow">Import & map</span>
            <h2 id="import-title">Make sense of {draft.filename}</h2>
            <p>
              We found {draft.rows.length} rows. Confirm what each column means
              before anything is added.
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close import"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        {draft.errors.length > 0 && (
          <div className="warning">
            <CircleAlert size={16} />
            {draft.errors[0]}
          </div>
        )}
        <div className="mapping-grid">
          {draft.headers.map((header) => (
            <label key={header} className="mapping-item">
              <span>
                <strong>{header || "Unnamed column"}</strong>
                <small>
                  {draft.confidence[header] > 0.8
                    ? "High-confidence match"
                    : draft.mapping[header] === "skip"
                      ? "Not mapped"
                      : "Please confirm"}
                </small>
              </span>
              <select
                value={draft.mapping[header]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    mapping: { ...draft.mapping, [header]: event.target.value },
                  })
                }
              >
                {canonicalFields.map((field) => (
                  <option value={field} key={field}>
                    {canonicalFieldLabels[field]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {draft.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.rows.slice(0, 4).map((row, index) => (
                <tr key={index}>
                  {draft.headers.map((header) => (
                    <td key={header}>{row[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer>
          <span>
            Imports append safely; existing edits are never overwritten.
          </span>
          <div>
            <button className="secondary compact" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary compact"
              disabled={!Object.values(draft.mapping).includes("title")}
              onClick={onApply}
            >
              Add {draft.rows.length} rows <ArrowDown size={15} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-field">
      <span>
        <strong>{label}</strong>
        <output>
          {Number(value.toFixed(2))}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
