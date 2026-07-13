# Testing

Run the full local validation with:

```bash
npm run validate
```

Individual commands are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:pages`.

Unit tests currently cover CSV parsing/mapping, complete profile/contact imports, section-note preservation, stable import fingerprints, filename generation, ordering, orphan-heading protection, optional continuation headings, lossless oversized-entry splitting, and pagination across every preset, layout mode, paper size, and formatting extreme. Planned coverage includes component accessibility, IndexedDB migrations, revised-import reconciliation, Pages base paths, and automated preview/PDF raster comparisons.
