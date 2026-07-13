"use client";

import {
  ArrowDown,
  ArrowUp,
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
  LayoutTemplate,
  Minus,
  Palette,
  PanelLeftClose,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canonicalFields, parseCsv, rowsToSections } from "@/src/lib/csv";
import { downloadPdf } from "@/src/lib/pdf";
import { deleteProject, loadProject, saveProject } from "@/src/lib/persistence";
import {
  createEntry,
  createSection,
  moveItem,
  paginateProject,
  parseProjectFile,
  safeFilename,
  toProjectFile,
} from "@/src/lib/project";
import {
  createBlankProject,
  createDemoProject,
  themePresets,
} from "@/src/model/demo";
import type {
  CsvImportDraft,
  CVEntry,
  CVSection,
  Project,
  ThemeId,
} from "@/src/model/types";

type StudioMode = "content" | "design" | "export";
type Selection =
  { profile: true } | { sectionId: string; entryId?: string } | null;

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
  const { sections, source } = rowsToSections(draft);
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
  const csvInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);

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

  const commit = useCallback(
    (updater: (current: Project) => Project) => {
      if (!project) return;
      setHistory((items) => [...items.slice(-39), project]);
      setFuture([]);
      setProject({
        ...updater(project),
        updatedAt: new Date().toISOString(),
      });
    },
    [project],
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
  const pages = useMemo(
    () => (project ? paginateProject(project) : []),
    [project],
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
    if (!project) return;
    setIsExporting(true);
    try {
      await downloadPdf(project);
      setToast("PDF created — your project remains private");
    } catch {
      setToast("PDF generation failed. Your project is still safe.");
    } finally {
      setIsExporting(false);
    }
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
            <Download size={16} /> {isExporting ? "Preparing…" : "Export PDF"}
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
                {visibleSections.map((section, index) => (
                  <div
                    key={section.id}
                    className={`section-row ${selectedSectionId === section.id && !selectedEntryId ? "selected" : ""}`}
                  >
                    <button
                      className="section-main"
                      onClick={() => setSelection({ sectionId: section.id })}
                    >
                      <GripVertical size={14} className="grip" />
                      <span>{section.title}</span>
                      <small>{section.entries.length}</small>
                    </button>
                    <div className="row-tools">
                      <button
                        aria-label={`Move ${section.title} up`}
                        disabled={index === 0}
                        onClick={() =>
                          commit((current) => ({
                            ...current,
                            sections: moveItem(
                              current.sections,
                              index,
                              index - 1,
                            ),
                          }))
                        }
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        aria-label={`Move ${section.title} down`}
                        disabled={index === project.sections.length - 1}
                        onClick={() =>
                          commit((current) => ({
                            ...current,
                            sections: moveItem(
                              current.sections,
                              index,
                              index + 1,
                            ),
                          }))
                        }
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                    {section.entries.map((entry) => (
                      <button
                        key={entry.id}
                        className={`entry-row ${selectedEntryId === entry.id ? "selected" : ""}`}
                        onClick={() =>
                          setSelection({
                            sectionId: section.id,
                            entryId: entry.id,
                          })
                        }
                      >
                        <span className="entry-line" />
                        <span>{entry.title}</span>
                        {entry.hidden && <EyeOff size={12} />}
                      </button>
                    ))}
                    <button
                      className="add-entry"
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
              <button className="active">Pages</button>
              <button
                aria-pressed={printPreview}
                onClick={() => setPrintPreview(true)}
              >
                Print view
              </button>
            </div>
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
                  sections={page}
                  pageNumber={pageIndex + 1}
                  selection={selection}
                  setSelection={setSelection}
                />
              ))}
            </div>
          </div>
          <div className="print-preview-actions">
            <button
              className="secondary compact"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Print
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

function PaperPage({
  project,
  sections,
  pageNumber,
  selection,
  setSelection,
}: {
  project: Project;
  sections: CVSection[];
  pageNumber: number;
  selection: Selection;
  setSelection: (value: Selection) => void;
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
      className={`paper ${project.layout.paper} ${project.layout.mode} ${project.layout.showGuides ? "show-guides" : ""}`}
      style={pageStyle}
    >
      {pageNumber === 1 && (
        <header
          className={`cv-header ${profileSelected ? "selected-element" : ""}`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) {
              event.preventDefault();
            }
            setSelection({ profile: true });
          }}
        >
          <h1>{project.profile.fullName}</h1>
          <p>{project.profile.professionalTitle}</p>
          <div className="contact-line">
            {project.profile.contacts.map((contact) =>
              contact.href ? (
                <a key={contact.id} href={contact.href}>
                  {contact.value}
                </a>
              ) : (
                <span key={contact.id}>{contact.value}</span>
              ),
            )}
          </div>
          {project.profile.summary && (
            <div className="profile-summary">{project.profile.summary}</div>
          )}
        </header>
      )}
      <div className="cv-sections">
        {sections.map((section) => (
          <section
            key={section.id}
            className={`cv-section ${selectedSectionId === section.id && !selectedEntryId ? "selected-element" : ""}`}
            onClick={() => setSelection({ sectionId: section.id })}
          >
            <h2>{section.title}</h2>
            {section.note && <p className="section-note">{section.note}</p>}
            {section.entries.map((entry) => (
              <article
                key={entry.id}
                className={`cv-entry ${selectedEntryId === entry.id ? "selected-element" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelection({ sectionId: section.id, entryId: entry.id });
                }}
              >
                <div className="entry-date">{entry.date}</div>
                <div className="entry-content">
                  <h3>{entry.title}</h3>
                  {(entry.organization || entry.location) && (
                    <p className="entry-org">
                      {entry.organization}
                      {entry.organization && entry.location ? " · " : ""}
                      {entry.location}
                    </p>
                  )}
                  {entry.summary && <p>{entry.summary}</p>}
                  {!!entry.bullets.length && (
                    <ul>
                      {entry.bullets.map((bullet, index) => (
                        <li key={index}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
      {project.layout.showPageNumbers && (
        <footer className="page-number">{pageNumber}</footer>
      )}
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
        <Field label="Full name">
          <input
            value={project.profile.fullName}
            onChange={(event) =>
              updateProfile({ fullName: event.target.value })
            }
          />
        </Field>
        <Field label="Professional title">
          <input
            value={project.profile.professionalTitle}
            onChange={(event) =>
              updateProfile({ professionalTitle: event.target.value })
            }
          />
        </Field>
        <Field label="Profile summary">
          <textarea
            rows={4}
            value={project.profile.summary ?? ""}
            onChange={(event) => updateProfile({ summary: event.target.value })}
            placeholder="Optional short positioning statement"
          />
        </Field>
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
                <label>
                  <span>Value</span>
                  <input
                    aria-label={`Value for ${contact.label}`}
                    value={contact.value}
                    onChange={(event) =>
                      updateContact(contact.id, { value: event.target.value })
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
          Header arrangement and alignment follow the selected design preset.
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
        <Field label="Heading">
          <input
            value={section.title}
            onChange={(event) => updateSection({ title: event.target.value })}
          />
        </Field>
        <Field label="Section note">
          <textarea
            rows={3}
            value={section.note ?? ""}
            onChange={(event) => updateSection({ note: event.target.value })}
            placeholder="Optional legend or note"
          />
        </Field>
        <div className="inspector-group">
          <span className="group-label">Entries</span>
          <p className="helper">
            {section.entries.length} entries in this section. Use the arrows in
            Structure to change section order.
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
      <Field label="Title or role">
        <input
          value={entry.title}
          onChange={(event) => updateEntry({ title: event.target.value })}
        />
      </Field>
      <Field label="Organization">
        <input
          value={entry.organization ?? ""}
          onChange={(event) =>
            updateEntry({ organization: event.target.value })
          }
        />
      </Field>
      <div className="field-grid">
        <Field label="Date">
          <input
            value={entry.date ?? ""}
            onChange={(event) => updateEntry({ date: event.target.value })}
          />
        </Field>
        <Field label="Location">
          <input
            value={entry.location ?? ""}
            onChange={(event) => updateEntry({ location: event.target.value })}
          />
        </Field>
      </div>
      <Field label="Summary">
        <textarea
          rows={4}
          value={entry.summary ?? ""}
          onChange={(event) => updateEntry({ summary: event.target.value })}
        />
      </Field>
      <Field label="Bullets" hint="One per line">
        <textarea
          rows={6}
          value={entry.bullets.join("\n")}
          onChange={(event) =>
            updateEntry({
              bullets: event.target.value.split("\n").filter(Boolean),
            })
          }
        />
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
  exportPdf: () => void;
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
          <strong>{isExporting ? "Preparing PDF…" : "Download PDF"}</strong>
          <small>Searchable, selectable text</small>
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
                    {field === "skip"
                      ? "Skip this column"
                      : field[0].toUpperCase() + field.slice(1)}
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
