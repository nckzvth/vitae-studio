export type FieldValue = string | string[] | boolean | undefined;

export interface ContactItem {
  id: string;
  label: string;
  value: string;
  href?: string;
}

export interface CVEntry {
  id: string;
  title: string;
  organization?: string;
  location?: string;
  date?: string;
  summary?: string;
  bullets: string[];
  hidden?: boolean;
  metadata?: Record<string, FieldValue>;
  sourceFingerprint?: string;
}

export interface CVSection {
  id: string;
  title: string;
  kind: string;
  hidden?: boolean;
  note?: string;
  entries: CVEntry[];
}

export type ThemeId = "academic" | "modern" | "editorial" | "technical";
export type PaperSize = "letter" | "a4";
export type LayoutMode = "single" | "date-rail" | "two-column";

export interface ThemeSettings {
  preset: ThemeId;
  accent: string;
  text: string;
  muted: string;
  paper: string;
  headingFont: string;
  bodyFont: string;
  bodySize: number;
  headingSize: number;
  lineHeight: number;
  sectionGap: number;
  ruleWidth: number;
}

export interface LayoutSettings {
  paper: PaperSize;
  mode: LayoutMode;
  margin: number;
  showGuides: boolean;
  showPageNumbers: boolean;
}

export interface ImportSource {
  id: string;
  filename: string;
  importedAt: string;
  rowCount: number;
  mapping: Record<string, string>;
}

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  profile: {
    fullName: string;
    professionalTitle: string;
    summary?: string;
    contacts: ContactItem[];
  };
  sections: CVSection[];
  theme: ThemeSettings;
  layout: LayoutSettings;
  imports: ImportSource[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  format: "vitae-studio-project";
  schemaVersion: 1;
  exportedAt: string;
  project: Project;
}

export interface CsvImportDraft {
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  confidence: Record<string, number>;
  errors: string[];
}
