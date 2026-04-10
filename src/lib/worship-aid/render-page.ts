/**
 * Renders the inner HTML content for a single worship-aid page.
 * Used by build-pages.ts (server) and the API route for live re-renders.
 *
 * The output is injected into an iframe srcdoc — no full <html> wrapper needed.
 * Imports here must be plain TypeScript (no server-only Node modules).
 */

import type { CoverPageData, ReadingPageData, SongPageData, LinkItem } from "./types";

// ─── Constants ──────────────────────────────────────────────────────────────────

const ONELICENSE_FOOTER = `
  <div class="onelicense-footer">
    MUSIC INSERTS USED WITH PERMISSION: ONELICENSE.NET #A706128; C.C.L.I. #2935115.
    <br />
    <span class="onelicense-contact">
      CONTACT MUSIC@STMONICA.NET FOR A COMPLETE LIST OF COPYRIGHTS CONTAINED HEREIN.
    </span>
  </div>
`;

const GIVING_BLOCK = `
  <div class="giving-block">
    <div class="giving-qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?data=https://stmonica.net/give&size=80x80" alt="QR code to give" />
    </div>
    <div class="giving-text">
      <p class="giving-headline">Give online at <strong>stmonica.net/give</strong></p>
      <p class="giving-body">Your generosity brings new life to our parish. Thank you for your support of our community.</p>
    </div>
  </div>
`;

// ─── HTML escape ────────────────────────────────────────────────────────────────

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Reading type labels ────────────────────────────────────────────────────────

const READING_TYPE_LABELS: Record<string, string> = {
  first: "First Reading",
  psalm: "Responsorial Psalm",
  second: "Second Reading",
  gospel_verse: "Gospel Acclamation Verse",
  gospel: "Gospel",
  custom: "Reading",
};

// ─── Links renderer ─────────────────────────────────────────────────────────────

function renderLinks(links: LinkItem[]): string {
  if (!links || links.length === 0) return "";
  const items = links
    .map(
      (l) => `
    <li class="custom-link-item">
      <span class="custom-link-icon">${l.icon ?? "✚"}</span>
      <a href="${esc(l.url)}" class="custom-link-label">${esc(l.label)}</a>
    </li>`
    )
    .join("");
  return `<ul class="custom-links">${items}</ul>`;
}

// ─── Page renderers ─────────────────────────────────────────────────────────────

function renderCoverContent(data: CoverPageData): string {
  const coverBg = data.coverArtUrl
    ? `<img class="cover-art" src="${esc(data.coverArtUrl)}" alt="" />`
    : "";
  const logo = data.logoUrl
    ? `<img class="parish-logo" src="${esc(data.logoUrl)}" alt="${esc(data.parishName)} logo" />`
    : "";

  return `
    <div class="cover-page" style="border-top: 6px solid ${data.seasonColor};">
      ${coverBg}
      <div class="cover-inner">
        ${logo}
        <p class="parish-name">${esc(data.parishName)}</p>
        <div class="cover-divider" style="background:${data.seasonColor};"></div>
        <h1 class="occasion-name">${esc(data.occasionName)}</h1>
        ${data.seasonLabel ? `<p class="season-label">${esc(data.seasonLabel)}</p>` : ""}
        ${data.date ? `<p class="occasion-date">${esc(data.date)}</p>` : ""}
      </div>
    </div>
  `.trim();
}

function renderReadingContent(data: ReadingPageData): string {
  const typeLabels = READING_TYPE_LABELS;
  const items = data.readings
    .filter((r) => r.type !== "gospel_verse")
    .map(
      (r) => `
      <div class="reading-item">
        <p class="reading-label">${esc(typeLabels[r.type] ?? r.type)}</p>
        <p class="reading-citation">${esc(r.citation)}</p>
        ${r.summary ? `<p class="reading-summary">${esc(r.summary)}</p>` : ""}
      </div>`
    )
    .join("\n");

  return `
    <div class="readings-page">
      <h2>Liturgy of the Word</h2>
      ${items}
    </div>
  `.trim();
}

function renderSongContent(
  data: SongPageData,
  cropTop: number,
  customLinks: LinkItem[],
  givingBlock: boolean
): string {
  let resourceHtml: string;

  if (data.reprintUrl) {
    const cropStyle = cropTop > 0 ? ` style="margin-top: -${cropTop}%;"` : "";
    resourceHtml = `
      <div class="resource-image-wrap">
        <img src="${esc(data.reprintUrl)}" alt="Sheet music for ${esc(data.title)}"${cropStyle} />
      </div>`;
  } else if (data.lyrics) {
    resourceHtml = `<div class="lyrics-block"><pre class="lyrics-text">${esc(data.lyrics)}</pre></div>`;
  } else {
    resourceHtml = `
      <div class="placeholder-block">
        <p>Sheet music not yet available.</p>
        <p class="placeholder-note">No reprint resource found in database.</p>
      </div>`;
  }

  const linksHtml = renderLinks(customLinks);
  const givingHtml = givingBlock ? GIVING_BLOCK : "";

  return `
    <div class="song-page">
      <div class="song-header">
        <div>
          <p class="position-label">${esc(data.positionLabel)}</p>
          <h2 class="song-title">${esc(data.title)}</h2>
          ${data.composer ? `<p class="song-composer">${esc(data.composer)}</p>` : ""}
        </div>
      </div>
      ${resourceHtml}
      ${linksHtml}
      ${givingHtml}
      ${ONELICENSE_FOOTER}
    </div>
  `.trim();
}

// ─── Main export ────────────────────────────────────────────────────────────────

export interface RenderPageOptions {
  type: "cover" | "reading" | "song";
  coverData?: CoverPageData;
  readingData?: ReadingPageData;
  songData?: SongPageData;
  cropTop: number;
  customLinks: LinkItem[];
  givingBlock: boolean;
}

export function renderPageContent(opts: RenderPageOptions): string {
  switch (opts.type) {
    case "cover":
      return opts.coverData ? renderCoverContent(opts.coverData) : "";
    case "reading":
      return opts.readingData ? renderReadingContent(opts.readingData) : "";
    case "song":
      return opts.songData
        ? renderSongContent(opts.songData, opts.cropTop, opts.customLinks, opts.givingBlock)
        : "";
    default:
      return "";
  }
}
