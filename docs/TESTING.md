# Testing

Run the full local validation with:

```bash
npm run validate
```

Individual commands are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run build:pages`.

Unit tests currently cover CSV parsing/mapping, stable import fingerprints, filename generation, ordering, and conservative pagination. Planned coverage includes component accessibility, IndexedDB migrations, revised-import reconciliation, browser end-to-end flows, Pages base paths, and preview/PDF visual regression.
