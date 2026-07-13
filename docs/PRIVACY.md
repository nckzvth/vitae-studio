# Privacy

Vitae Studio is local-first. CSV parsing, editing, autosave, project-file import/export, and PDF generation happen in the browser. The production application has no document API, account system, or analytics pipeline.

Autosaved projects live in the browser's IndexedDB storage for the site. Browser data can be cleared by the browser, operating system, or user, so exported `.vitae.json` backups remain important. Deleting the local project removes the application's active IndexedDB record.

Do not commit personal CV files or generated documents to the repository. All included example data is fictional.
