# Vitae Studio

Vitae Studio is a private, local-first web app for turning flexible CSV data into a polished, editable CV. Import without a rigid schema, refine content visually, choose a distinct design direction, preview real paper, and export a searchable PDF — all in the browser.

[Open the live app](https://nckzvth.github.io/vitae-studio/)

## What ships in the first release

- Blank and fictional demonstration projects
- Flexible CSV parsing with profile/contact fields, section notes, aliases, mapping confidence, raw preview, and append-safe import
- Downloadable universal CSV template for starting a complete CV from scratch
- Structured sections and entries with ordering, visibility, custom sections, notes, and bullets
- Four meaningfully different presets plus color, typography, spacing, margin, paper, and layout controls, with cross-preset pagination regression coverage
- Letter and A4 paper preview with zoom, page numbers, margin guides, and responsive mode switching
- Print-to-PDF export from the exact styled preview, with selectable text
- IndexedDB autosave and versioned `.vitae.json` backup/restore
- A static, repository-base-path-aware GitHub Pages build

All included example data is fictional.

## Local development

Requires Node.js 22.13 or later.

```bash
npm ci
npm run dev
```

The development server prints its local URL. For focused checks:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run build:pages
```

Run every release gate with `npm run validate`.

## Architecture

The client-side React application converts every CSV import into a versioned, layout-independent `Project` model. The editor, measured document preview, IndexedDB persistence, JSON backup, and print-to-PDF output all consume the same rendered pages. Theme and layout tokens stay separate from content so a design can change without data loss.

See:

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Project format](docs/PROJECT_FORMAT.md)
- [CSV import guide](docs/CSV_IMPORT.md)
- [Testing](docs/TESTING.md)
- [Deployment](docs/DEPLOYMENT.md)

## Deployment

Changes pushed to `main` run formatting, linting, type checking, unit tests, and a production static build before GitHub Pages is updated. A failed validation does not replace the working site. See [deployment documentation](docs/DEPLOYMENT.md).

## Privacy

CV data can be sensitive. Vitae Studio parses, stores, edits, and exports documents in the browser; it has no account requirement or document backend. Autosaves use IndexedDB for the current site origin. Users should export backups because browser storage can be cleared. Read the full [privacy explanation](docs/PRIVACY.md).

## Known limitations

- Preview pagination uses live browser measurements, protects section headings from becoming orphans, and splits unusually long entries without losing content. The Design panel can opt into conservative section flow or repeated continuation headings.
- PDF output currently uses reliable built-in fonts instead of embedding every preview font.
- Revised CSV imports append safely but do not yet provide field-by-field conflict reconciliation.
- Rich inline formatting, custom schema construction, standalone theme import/export, image assets, and full keyboard drag-and-drop remain post-MVP.
- Right-to-left composition, landscape output, accounts, and cloud collaboration are deferred.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Vitae Studio is available under the [MIT License](LICENSE).
