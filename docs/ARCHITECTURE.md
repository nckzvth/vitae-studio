# Architecture

Vitae Studio is a static, local-first React application. The browser owns CSV parsing, project editing, IndexedDB storage, preview rendering, and PDF generation. No application server is required on GitHub Pages.

The canonical `Project` model is the only shared state boundary. CSV files are normalized into it; the editor updates it; preview and PDF render from it; project backups serialize it. Content records never contain layout HTML. Theme and layout tokens are independent, so a preset can be switched without touching content.

The current preview uses conservative entry-count pagination. The target design introduces a measurement pass that produces backend-neutral page fragments for both the DOM preview and PDF renderer. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the phased migration.
