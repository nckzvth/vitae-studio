# Project file format

Editable backups use JSON with the extension `.vitae.json`.

```json
{
  "format": "vitae-studio-project",
  "schemaVersion": 1,
  "exportedAt": "2026-07-12T00:00:00.000Z",
  "project": {}
}
```

`project` contains a stable project ID, profile/contact items, ordered sections and entries, theme tokens, layout/page settings, import metadata, and revision timestamps. Layout settings include compact page flow and optional repeated continuation headings; older version 1 files default to compact flow with repetition disabled. Sections and entries have stable IDs so future reconciliation and undo systems can refer to them after reordering.

Version 1 files are validated by their format and schema markers. Future versions will add pure migration functions that transform older data before it enters application state.
