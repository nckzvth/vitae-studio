# Architecture

Vitae Studio is a static, local-first React application. The browser owns CSV parsing, project editing, IndexedDB storage, preview rendering, and PDF generation. No application server is required on GitHub Pages.

The canonical `Project` model is the only shared state boundary. CSV files are normalized into it; the editor updates it; preview and PDF render from it; project backups serialize it. Content records never contain layout HTML. Theme and layout tokens are independent, so a preset can be switched without touching content.

The preview measures the rendered header, section headings, and entries using the active paper size, margins, typography, and layout width. A compact paginator fills each page or column, moves a heading only when it would be orphaned, and can split oversized summaries and bullets into lossless continuation fragments. Continuation headings are optional and disabled by default. PDF export prints these exact semantic HTML pages with named Letter/A4 print rules; there is no separate renderer that can drift from the preview.
