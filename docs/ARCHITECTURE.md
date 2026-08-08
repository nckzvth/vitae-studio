# Architecture

Vitae Studio is a static, local-first React application. The browser owns CSV parsing, project editing, IndexedDB storage, preview rendering, and PDF generation. No application server is required on GitHub Pages.

The canonical `Project` model is the only shared state boundary. CSV files are normalized into it; the editor updates it; preview and PDF render from it; project backups serialize it. Direct document editing stores sanitized semantic text spans rather than layout HTML, while mirrored plain text keeps search, CSV compatibility, and pagination deterministic. Theme and layout tokens are independent, so a preset can be switched without touching content.

The preview measures the rendered header, section headings, and entries using the active paper size, margins, typography, and layout width. A compact paginator fills each page or column, moves a heading only when it would be orphaned, and can split oversized summaries and bullets into lossless continuation fragments. Continuation headings are optional and disabled by default. PDF export captures each exact `.paper` element as the visual page, adds an invisible searchable text layer and clickable link annotations, and downloads a Letter/A4 PDF directly. It never invokes the browser print dialog, so browser titles, URLs, timestamps, margins, and page counters cannot enter the document.
