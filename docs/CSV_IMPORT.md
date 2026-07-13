# CSV import guide

Vitae Studio does not require one CSV schema. It recognizes aliases such as `role`, `position`, `job title`, `employer`, `institution`, `year`, `date range`, `details`, and `responsibilities`. The mapping screen always lets the user correct suggestions.

The downloadable universal template includes profile/contact columns as well as document-entry columns:

```csv
section,section_note,title,organization,location,date,summary,bullets,full_name,professional_title,email,phone,address,website
Profile,,,,,,"Optional profile summary",,Avery Morgan,Researcher,avery@example.com,"(555) 010-2040","Boston, MA",https://example.com
Experience,,Research Fellow,Northbridge Institute,Boston,2024 - Present,Study summary,"First bullet;Second bullet",,,,,,
```

Use one `Profile` row for the document header. `section_note` preserves legends or annotations such as author-marker explanations. The remaining rows become ordered CV sections and entries.

Section-specific files may omit `section`; imported entries are placed in an Imported section and can be renamed or moved. Multiple imports append safely. The current release never overwrites existing entries automatically. Revised-import comparison and conflict resolution are planned.

Fictional templates are available in `public/templates/`.
