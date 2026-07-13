# Testing

Run the full local validation with:

```bash
npm run validate
```

Individual commands are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:pages`.

Unit tests currently cover CSV parsing/mapping, complete profile/contact imports, section-note preservation, stable import fingerprints, filename generation, ordering, orphan-heading protection, optional continuation headings, lossless oversized-entry splitting, pagination across every preset, layout mode, paper size, and formatting extreme, and the direct rendered-page PDF architecture.

Every PDF-export release must also generate actual files from the running app for Scholar, Signal, Review, and Index; include both Letter and A4; and include a long entry that continues onto another page. Use `pdfinfo` to verify page dimensions and metadata, `pdftotext` to confirm searchable content, and Poppler `pdftoppm` rendering for page-by-page visual inspection. Reject the release if the rendered PDF contains browser titles, dates, URLs, browser page counters, shifted page surfaces, editor highlights, margin guides, clipping, or unexpected gaps.

Planned coverage includes component accessibility, IndexedDB migrations, revised-import reconciliation, Pages base paths, and automated preview/PDF pixel comparisons.
