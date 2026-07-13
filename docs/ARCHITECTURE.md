# Architecture

Vitae Studio is a static, local-first React application. The browser owns CSV parsing, project editing, IndexedDB storage, preview rendering, and PDF generation. No application server is required on GitHub Pages.

The canonical `Project` model is the only shared state boundary. CSV files are normalized into it; the editor updates it; preview and PDF render from it; project backups serialize it. Content records never contain layout HTML. Theme and layout tokens are independent, so a preset can be switched without touching content.

The preview uses content-height-aware pagination derived from the active paper size, margins, typography, layout width, headings, notes, and wrapped entry content. This prevents arbitrary entry-count breaks and avoids leaving usable paper empty. The target design replaces estimation with a browser measurement pass that produces backend-neutral page fragments for both the DOM preview and PDF renderer. See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the phased migration.
