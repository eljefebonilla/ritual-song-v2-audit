/**
 * HTML renderer for the Worship Aid Builder.
 * Produces a full Paged.js document from a WorshipAid object.
 *
 * Design system: Crimson Pro + Source Sans 3 (output only, not the admin UI).
 * Page dimensions: 7" × 8.5" (half-letter landscape / hymnal format).
 * Margins: Van de Graaf adjusted (inner 0.80", outer 1.20", top 0.75", bottom 1.05").
 */

import type { WorshipAid, WorshipAidPage } from "./types";

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');
`;

const PAGE_CSS = `
  @page {
    size: 7in 8.5in;
    margin-top: 0.75in;
    margin-bottom: 1.05in;
    margin-left: 0.80in;
    margin-right: 1.20in;
  }
  @page :left {
    margin-left: 1.20in;
    margin-right: 0.80in;
  }
`;

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Crimson Pro', 'Palatino Linotype', Georgia, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1c1917;
    background: white;
  }

  /* ── Page shells ───────────────────────────────────────────────────── */
  .wa-page {
    page-break-after: always;
    break-after: page;
    min-height: 100%;
    position: relative;
  }
  .wa-page:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }

  /* ── Cover ─────────────────────────────────────────────────────────── */
  .cover-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 6.5in;
    padding-top: 0.5in;
  }
  .cover-inner {
    max-width: 5in;
  }
  .parish-logo {
    max-height: 1.2in;
    margin-bottom: 0.4in;
  }
  .parish-name {
    font-family: 'Source Sans 3', sans-serif;
    font-weight: 300;
    font-size: 11pt;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #57534e;
    margin-bottom: 0.25in;
  }
  .cover-divider {
    height: 3px;
    width: 2in;
    margin: 0.2in auto;
    border-radius: 2px;
  }
  .occasion-name {
    font-size: 28pt;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 0.15in;
  }
  .season-label {
    font-size: 11pt;
    font-style: italic;
    color: #78716c;
    margin-bottom: 0.1in;
  }
  .occasion-date {
    font-family: 'Source Sans 3', sans-serif;
    font-size: 10pt;
    color: #78716c;
    margin-top: 0.15in;
  }

  /* ── Readings ─────────────────────────────────────────────────────── */
  .readings-page h2 {
    font-size: 14pt;
    font-weight: 600;
    border-bottom: 1px solid #e7e5e4;
    padding-bottom: 0.1in;
    margin-bottom: 0.2in;
  }
  .reading-item {
    margin-bottom: 0.2in;
    break-inside: avoid;
  }
  .reading-label {
    font-family: 'Source Sans 3', sans-serif;
    font-size: 8pt;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #78716c;
    margin-bottom: 2pt;
  }
  .reading-citation {
    font-size: 12pt;
    font-weight: 600;
  }
  .reading-summary {
    font-size: 10.5pt;
    color: #57534e;
    font-style: italic;
    margin-top: 2pt;
  }

  /* ── Song pages ───────────────────────────────────────────────────── */
  .song-page {}
  .song-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #e7e5e4;
    padding-bottom: 0.1in;
    margin-bottom: 0.15in;
  }
  .position-label {
    font-family: 'Source Sans 3', sans-serif;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #a8a29e;
    margin-bottom: 3pt;
  }
  .song-title {
    font-size: 17pt;
    font-weight: 600;
    line-height: 1.2;
  }
  .song-composer {
    font-size: 10.5pt;
    font-style: italic;
    color: #57534e;
    margin-top: 2pt;
  }

  /* ── Sheet music resource image ───────────────────────────────────── */
  .resource-image-wrap {
    overflow: hidden;
    margin-top: 0.1in;
  }
  .resource-image-wrap img {
    width: 100%;
    display: block;
  }
  .fit-page .resource-image-wrap {
    max-height: 5.5in;
  }
  .fit-page .resource-image-wrap img {
    height: 100%;
    object-fit: contain;
    object-position: top;
  }

  /* ── Placeholder block ────────────────────────────────────────────── */
  .placeholder-block {
    margin-top: 0.3in;
    padding: 0.25in;
    border: 1.5px dashed #d6d3d1;
    border-radius: 4px;
    color: #a8a29e;
    font-size: 10.5pt;
    font-style: italic;
  }
  .placeholder-note {
    font-size: 9pt;
    margin-top: 0.05in;
    color: #c4b5b0;
  }

  /* ── Resource meta note (shown in HTML, hidden in print) ─────────── */
  .resource-note {
    font-size: 8pt;
    color: #a8a29e;
    margin-top: 4pt;
    font-style: italic;
  }
  @media print {
    .resource-note { display: none; }
  }
`;

// ─── Page renderers ────────────────────────────────────────────────────────────

function renderPage(page: WorshipAidPage, layout: "fit-page" | "flow"): string {
  const layoutClass = layout === "fit-page" ? " fit-page" : "";

  // Build the resource image HTML if we have a path
  let resourceHtml = "";
  if (page.resourcePath && page.resourceType !== "placeholder") {
    const cropStyle =
      page.cropTop && page.cropTop > 0
        ? ` style="margin-top: -${page.cropTop}%;"`
        : "";
    // Use file:// protocol for local paths
    const src = page.resourcePath.startsWith("/")
      ? `file://${page.resourcePath}`
      : page.resourcePath;

    resourceHtml = `
      <div class="resource-image-wrap">
        <img src="${src}" alt="Sheet music for ${escapeHtml(page.title)}"${cropStyle} />
      </div>
    `;
  }

  // Inject resource image into content
  const enhancedContent = resourceHtml
    ? page.content.replace(
        /<div class="song-resource"[^>]*>[\s\S]*?<\/div>/,
        `<div class="song-resource">${resourceHtml}</div>`
      )
    : page.content;

  return `
  <div class="wa-page${layoutClass}" data-page-id="${page.id}" data-page-type="${page.type}">
    ${enhancedContent}
  </div>`;
}

// ─── HTML escape ───────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Main renderer ─────────────────────────────────────────────────────────────

export function renderHtml(worshipAid: WorshipAid): string {
  const { config, pages } = worshipAid;
  const layout = config.layout ?? "fit-page";

  const pagesHtml = pages.map((p) => renderPage(p, layout)).join("\n");

  const title = `${config.occasionId} — ${config.parishName}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    ${FONTS}
    ${PAGE_CSS}
    ${BASE_CSS}
  </style>
</head>
<body>
${pagesHtml}
  <script src="https://unpkg.com/pagedjs/dist/paged.polyfill.js"><\/script>
</body>
</html>`;
}
