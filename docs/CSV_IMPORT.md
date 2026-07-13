# CSV import guide

Vitae Studio does not require one CSV schema. It recognizes aliases such as `role`, `position`, `job title`, `employer`, `institution`, `year`, `date range`, `details`, and `responsibilities`. The mapping screen always lets the user correct suggestions.

The simplest universal format is:

```csv
section,title,organization,location,date,summary,bullets
Experience,Research Fellow,Northbridge Institute,Boston,2024 — Present,Study summary,"First bullet;Second bullet"
```

Section-specific files may omit `section`; imported entries are placed in an Imported section and can be renamed or moved. Multiple imports append safely. The current release never overwrites existing entries automatically. Revised-import comparison and conflict resolution are planned.

Fictional templates are available in `public/templates/`.
