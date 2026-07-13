# Vitae Studio implementation plan

## Product and repository

**Application name:** Vitae Studio  
**Repository:** `vitae-studio`  
**Positioning:** A private, local-first document studio that turns flexible CSV data into polished, editable CVs without accounts or uploads.

The name is specific enough to be memorable without implying a rigid template generator. The repository is public and the production branch is `main`.

## Technology decisions

- **React 19 + TypeScript + Next App Router:** a typed component model with a static-export path for GitHub Pages. The app is deliberately client-side and has no production API routes.
- **CSS custom properties:** semantic document tokens make presets and granular overrides use the same rendering surface.
- **Papa Parse:** mature in-browser CSV delimiter, header, quoting, and multiline parsing.
- **IndexedDB via idb-keyval:** local autosave without sending CV content to a service.
- **jsPDF:** client-side, searchable vector-text PDFs that work from static hosting. The MVP renderer shares project content and design tokens with the preview; a richer shared pagination engine is a later phase.
- **Vitest + ESLint + TypeScript + Prettier:** fast unit validation and reproducible CI gates.
- **GitHub Actions + Pages artifact deployment:** validation runs before the static export is uploaded, so a failed build cannot replace production.

This stack favors privacy, static-hosting compatibility, and maintainability. A large UI kit is intentionally avoided so the workspace can remain typographic, quiet, and document-centered.

## Hosting and repository strategy

Next's static export runs with a repository-aware `basePath` and `assetPrefix` in CI. The app uses a single route, avoiding GitHub Pages deep-link fallback problems. Relative runtime assets and client-side PDF generation avoid worker and cross-origin dependencies. The workflow is custom-domain ready: setting `NEXT_PUBLIC_BASE_PATH` to an empty value and adding a `CNAME` file is sufficient for a future domain.

## Architecture

```text
CSV / project file
       │
       ▼
parser + alias mapper ──► canonical Project model ──► IndexedDB autosave
                                      │
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
                 content editor   paper preview   PDF renderer
                                      ▲              ▲
                                      └── theme/layout tokens ──┘
```

Modules are split into model/types, built-in fictional data, import normalization, persistence, PDF output, and the UI. CSV rows never become layout-specific HTML.

## Canonical data model

The versioned `Project` root contains identity, document sections, theme, layout/page rules, import sources, and revision metadata. Sections and entries use stable IDs. Entry fields are flexible records plus rich text blocks, bullets, annotations, notes, structured/free-form dates, and arbitrary metadata. Layout and theme remain independent from content. The project-file envelope records a schema version and export timestamp so migrations can be introduced without breaking older files.

## CSV import architecture

Papa Parse handles delimiters, quoted multiline cells, and header detection. A normalized alias registry suggests canonical fields with confidence scores. The import screen shows raw rows and editable column mappings before applying changes. Universal and section-specific CSVs work in the MVP; downloadable templates demonstrate both. Imported rows receive source fingerprints for later comparison. Wide-profile and multi-file workflows use the same canonical normalizer.

Revised-import conflict reconciliation is post-MVP. Until it ships, additional imports append and never silently replace edited records.

## Editor UX

The desktop studio has three coordinated regions: structure/content navigation, a paginated paper canvas, and a contextual inspector. A narrow mode rail switches between content, design, and export without replacing the document canvas. Mobile uses mode switching and keeps review/basic editing usable. Reorder buttons accompany drag affordances so keyboard users are not blocked.

## Visual system

The application uses warm neutral surfaces, ink typography, a restrained moss accent, hairline separators, and almost no decorative containers. Typography and whitespace carry hierarchy. Controls are compact and contextual, with visible focus states and reduced-motion support. The document itself has separate semantic tokens so user theme choices never compromise the editor chrome.

## Theme and layout architecture

Presets are complete token bundles, not accent swaps. Theme tokens cover font stacks, sizes, weights, colors, rules, spacing, margins, and heading treatment. Layout rules cover paper size, columns, header composition, page numbers, margin guides, and density. Applying a theme changes only theme/layout state. Custom themes can be exported inside the project; a standalone theme library is planned.

## Preview, pagination, and PDF

The MVP preview uses fixed Letter/A4 page surfaces, shared tokens, measured content grouping, page boundaries, zoom, fit controls, and print-safe CSS. Entries are assigned to pages conservatively and headings remain attached to their first entry.

Options considered:

| Approach                    | Decision                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| Browser print CSS           | Useful fallback and QA surface, but inconsistent dialog settings make it insufficient alone.           |
| HTML-to-canvas/PDF          | Rejected because full-page rasterization harms selection, links, and accessibility.                    |
| Paged-media polyfill        | Promising, but adds layout/runtime complexity and browser-specific risk.                               |
| React-PDF                   | Strong structured renderer, but duplicates DOM layout and increases bundle/font complexity.            |
| PDFKit                      | Viable but relatively heavy for browser use.                                                           |
| jsPDF                       | Selected for MVP: static-host friendly, selectable vector text, links, and deterministic page control. |
| Hybrid shared layout engine | Target architecture: shared line measurement and break decisions feeding both DOM and PDF backends.    |

The first release uses jsPDF with shared model and design tokens. Phase 4 replaces conservative chunking with a true shared pagination engine and adds preview/PDF visual regression.

## Persistence and privacy

Projects autosave to IndexedDB. CSV parsing, editing, project import/export, and PDF generation happen in the browser. No account, analytics, backend, or document upload is required. Users can explicitly delete local data and export a versioned JSON backup. The repository contains only fictional demo content.

## Source structure

```text
app/                    application shell, UI, styles, metadata
src/model/              canonical types and fictional project data
src/lib/                CSV, persistence, PDF, and shared utilities
public/templates/       fictional starter CSVs
tests/                  unit and static-render checks
docs/                   architecture, schema, privacy, testing, deployment
.github/workflows/      validation and Pages release
```

## Accessibility

The target is WCAG 2.2 AA for application chrome: semantic buttons/inputs, consistent labels, keyboard equivalents for reordering, visible focus, non-color status cues, live announcements, reduced motion, responsive zoom, and contrast warnings for user-selected document colors. The canvas is backed by semantic HTML rather than an image.

## Testing and continuous delivery

Unit tests cover alias resolution, CSV normalization, model migration boundaries, filename safety, and pagination helpers. CI runs format checking, linting, type checking, unit tests, the production Sites build, and the GitHub Pages static export. Only the validated `out/` artifact is deployed to Pages. Later phases add Testing Library, browser E2E, accessibility automation, and PDF raster comparisons.

Performance targets for the supported MVP are: first interactive load under 2.5 seconds on a mid-tier laptop, edits reflected within 100 ms, a 5,000-row CSV preview within 2 seconds, and a ten-page PDF generated within 5 seconds. Pagination work is debounced and advanced panels are loaded only when selected.

## Roadmap

1. **Foundation and first deployment:** repository, static shell, quality gates, CI, documentation.
2. **Local projects and canonical model:** project creation, IndexedDB autosave, backups, migrations, undo/redo.
3. **CSV import:** robust parsing, aliases, mapping preview, validation, templates, append-safe imports.
4. **Structured editor:** section/entry editing, ordering, visibility, custom sections, search, basic rich text.
5. **Rendering and pagination:** shared measurement engine, safe splits, manual breaks, overflow diagnostics.
6. **Theme/layout studio:** richer presets, per-section variants, columns, header composer, reusable themes.
7. **PDF production:** font embedding, hyperlinks, metadata, preview/PDF regression, export review.
8. **Production polish:** accessibility audit, performance profiling, recovery flows, onboarding, wider international support.

Every phase ends with validation and a GitHub Pages deployment.

## Scope boundaries

**Initial production MVP:** fictional demo/blank starts, CSV parsing and mapping, canonical projects, structured editing, section ordering and visibility, theme presets and key design controls, Letter/A4 paper preview, searchable PDF export, project backup/restore, IndexedDB autosave, responsive workspace, and Pages CI.

**Post-MVP:** revised-import conflict UI, custom schema builder, nested rich-text editing, fine-grained per-section layout overrides, reusable standalone theme library, accurate widow/orphan control, embedded licensed web fonts, complete keyboard drag-and-drop, and visual PDF regression.

**Deferred:** accounts/cloud sync, collaboration, arbitrary CSS, server rendering, AI content generation, right-to-left composition, landscape output, and user asset hosting.

## Main risks

- DOM and PDF font metrics can diverge; mitigate with a shared layout engine and embedded fonts.
- Browser PDF libraries increase bundle size; dynamically import jsPDF only for export.
- Complex multi-column pagination is difficult; ship conservative single-column rules first and validate each new layout.
- User-selected colors or sizes can create inaccessible documents; provide warnings without restricting intentional choices.
- IndexedDB can be cleared by the browser; keep backup export prominent and never imply cloud storage.
- GitHub Pages base paths are easy to break; build and exercise the repository-prefixed artifact in CI.

## Blocking decisions

None for the initial release. The brief supplies enough direction to infer the name, local-first architecture, public MIT-licensed repository, default visual direction, and a safe phased boundary. A custom domain and font licensing choices can be made later without invalidating the foundation.
