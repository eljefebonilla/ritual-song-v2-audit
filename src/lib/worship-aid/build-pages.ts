/**
 * Page builder for the Worship Aid Builder.
 * Loads an occasion, finds the matching music plan, resolves resources,
 * and assembles the full WorshipAid object.
 *
 * SERVER-SIDE ONLY — reads from the local filesystem.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveResource } from "./resolve-resource";
import type {
  WorshipAidConfig,
  WorshipAidPage,
  WorshipAid,
  MusicPlan,
  MusicPlanEntry,
  ResourceTier,
} from "./types";

const OCCASIONS_DIR = path.join(process.cwd(), "src/data/occasions");

// ─── Occasion loader ───────────────────────────────────────────────────────────

function loadOccasion(occasionId: string): Record<string, unknown> {
  const filePath = path.join(OCCASIONS_DIR, `${occasionId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Occasion not found: ${occasionId}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ─── Season colors ─────────────────────────────────────────────────────────────

const SEASON_COLORS: Record<string, string> = {
  advent: "#6B21A8",
  christmas: "#B45309",
  lent: "#7C3AED",
  easter: "#D97706",
  "ordinary-time": "#166534",
  ordinary: "#166534",
};

function seasonColor(season: string): string {
  return SEASON_COLORS[season?.toLowerCase() ?? ""] ?? "#1C1917";
}

// ─── Date formatter ────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Cover page ────────────────────────────────────────────────────────────────

function buildCoverPage(
  occasion: Record<string, unknown>,
  config: WorshipAidConfig,
  displayDate: string
): WorshipAidPage {
  const season = (occasion.season as string) ?? "";
  const accentColor = seasonColor(season);
  const seasonLabel = (occasion.seasonLabel as string) ?? "";
  const occasionName = (occasion.name as string) ?? config.occasionId;

  const content = `
    <div class="cover-page" style="border-top: 6px solid ${accentColor};">
      <div class="cover-inner">
        ${config.parishLogo ? `<img src="${config.parishLogo}" alt="${config.parishName} logo" class="parish-logo" />` : ""}
        <p class="parish-name">${config.parishName}</p>
        <div class="cover-divider" style="background:${accentColor};"></div>
        <h1 class="occasion-name">${occasionName}</h1>
        ${seasonLabel ? `<p class="season-label">${seasonLabel}</p>` : ""}
        ${displayDate ? `<p class="occasion-date">${displayDate}</p>` : ""}
      </div>
    </div>
  `.trim();

  return {
    id: randomUUID(),
    type: "cover",
    title: occasionName,
    subtitle: displayDate,
    content,
    position: "cover",
    editable: false,
  };
}

// ─── Reading page ──────────────────────────────────────────────────────────────

function buildReadingPage(
  readings: Array<Record<string, unknown>>
): WorshipAidPage {
  const typeLabels: Record<string, string> = {
    first: "First Reading",
    second: "Second Reading",
    psalm: "Responsorial Psalm",
    gospel_verse: "Gospel Verse",
    gospel: "Gospel",
  };

  const items = readings
    .filter((r) => r.type !== "gospel_verse")
    .map((r) => {
      const label = typeLabels[r.type as string] ?? String(r.type);
      return `
        <div class="reading-item">
          <p class="reading-label">${label}</p>
          <p class="reading-citation">${r.citation ?? ""}</p>
          ${r.summary ? `<p class="reading-summary">${r.summary}</p>` : ""}
        </div>
      `;
    })
    .join("\n");

  const content = `<div class="readings-page"><h2>Scripture Readings</h2>${items}</div>`;

  return {
    id: randomUUID(),
    type: "reading",
    title: "Scripture Readings",
    content,
    position: "readings",
    editable: false,
  };
}

// ─── Song page ─────────────────────────────────────────────────────────────────

function resourceTypeFromTier(tier: ResourceTier): WorshipAidPage["resourceType"] {
  const map: Record<ResourceTier, WorshipAidPage["resourceType"]> = {
    "ocp-gif": "gif",
    "wa-gif": "gif",
    "tiff": "tiff",
    "pdf": "pdf",
    "placeholder": "placeholder",
  };
  return map[tier];
}

async function buildSongPage(
  position: string,
  positionLabel: string,
  entry: MusicPlanEntry
): Promise<WorshipAidPage> {
  const resource = await resolveResource({
    title: entry.title,
    composer: entry.composer,
  });

  // OCP GIFs need 12% top crop to remove publisher header
  const cropTop = resource.tier === "ocp-gif" ? 12 : undefined;

  // Build a web-accessible URL for the resource so it works in both the
  // browser preview (iframe) and the final rendered HTML (no file:// URLs).
  const resourceApiUrl = resource.path && resource.tier !== "placeholder"
    ? `/api/worship-aids/resource?path=${encodeURIComponent(resource.path)}`
    : null;

  let content: string;
  if (resourceApiUrl) {
    const cropStyle = cropTop && cropTop > 0
      ? ` style="margin-top: -${cropTop}%;"`
      : "";
    const imgHtml = `<div class="resource-image-wrap">
          <img src="${resourceApiUrl}" alt="Sheet music for ${entry.title}"${cropStyle} />
        </div>`;
    content = `
      <div class="song-page">
        <div class="song-header">
          <div>
            <p class="position-label">${positionLabel}</p>
            <h2 class="song-title">${entry.title}</h2>
            ${entry.composer ? `<p class="song-composer">${entry.composer}</p>` : ""}
          </div>
        </div>
        <div class="song-resource" data-resource-path="${resource.path}" data-crop-top="${cropTop ?? 0}">
          <p class="resource-note">Sheet music: ${resource.tier} (${resource.confidence} confidence)</p>
          ${imgHtml}
        </div>
      </div>
    `.trim();
  } else {
    content = `
      <div class="song-page song-placeholder">
        <div class="song-header">
          <div>
            <p class="position-label">${positionLabel}</p>
            <h2 class="song-title">${entry.title}</h2>
            ${entry.composer ? `<p class="song-composer">${entry.composer}</p>` : ""}
          </div>
        </div>
        <div class="placeholder-block">
          <p>Sheet music not yet available.</p>
          <p class="placeholder-note">${resource.reason}</p>
        </div>
      </div>
    `.trim();
  }

  return {
    id: randomUUID(),
    type: "song",
    title: entry.title,
    subtitle: entry.composer,
    content,
    resourcePath: resource.path ?? undefined,
    resourceType: resourceTypeFromTier(resource.tier),
    position,
    editable: true,
    cropTop,
  };
}

// ─── Position label map ────────────────────────────────────────────────────────

const POSITION_LABELS: Record<string, string> = {
  gathering: "Gathering Song",
  penitentialAct: "Penitential Act",
  psalm: "Responsorial Psalm",
  gospelAcclamation: "Gospel Acclamation",
  offertory: "Preparation of the Gifts",
  communion_1: "Communion Song",
  communion_2: "Communion Song",
  communion_3: "Communion Song",
  sending: "Sending Forth",
};

// ─── Main builder ──────────────────────────────────────────────────────────────

export async function buildPages(config: WorshipAidConfig): Promise<WorshipAid> {
  const occasion = loadOccasion(config.occasionId);

  // Find the matching music plan for the requested ensemble
  const musicPlans = (occasion.musicPlans as MusicPlan[]) ?? [];
  const plan = musicPlans.find(
    (p) => (p.communityId ?? p.ensembleId) === config.ensembleId
  );

  // Resolve display date from occasion dates array
  const today = new Date().toISOString().slice(0, 10);
  const dates = (occasion.dates as Array<{ date: string }>) ?? [];
  const upcomingDates = dates
    .map((d) => d.date)
    .filter((d) => typeof d === "string" && d >= today)
    .sort();
  const displayDate = upcomingDates[0]
    ? formatDate(upcomingDates[0])
    : "";

  const pages: WorshipAidPage[] = [];

  // 1. Cover
  pages.push(buildCoverPage(occasion, config, displayDate));

  // 2. Readings (optional)
  if (config.includeReadings) {
    const readings = (occasion.readings as Array<Record<string, unknown>>) ?? [];
    if (readings.length > 0) {
      pages.push(buildReadingPage(readings));
    }
  }

  // 3. Song pages (only if we have a plan)
  if (plan && config.includeMusicalNotation) {
    // Gathering
    if (plan.gathering) {
      pages.push(await buildSongPage("gathering", POSITION_LABELS.gathering, plan.gathering));
    }

    // Psalm
    if (plan.responsorialPsalm?.setting) {
      const psalmTitle = plan.responsorialPsalm.setting.split("•")[0].trim();
      pages.push(
        await buildSongPage("psalm", POSITION_LABELS.psalm, { title: psalmTitle })
      );
    }

    // Gospel Acclamation
    if (plan.gospelAcclamation) {
      pages.push(
        await buildSongPage("gospelAcclamation", POSITION_LABELS.gospelAcclamation, plan.gospelAcclamation)
      );
    }

    // Offertory
    if (plan.offertory) {
      pages.push(await buildSongPage("offertory", POSITION_LABELS.offertory, plan.offertory));
    }

    // Communion songs
    const communionSongs = plan.communionSongs ?? [];
    for (let i = 0; i < communionSongs.length; i++) {
      const pos = `communion_${i + 1}`;
      const label = POSITION_LABELS[pos] ?? "Communion Song";
      pages.push(await buildSongPage(pos, label, communionSongs[i]));
    }

    // Sending
    if (plan.sending) {
      pages.push(await buildSongPage("sending", POSITION_LABELS.sending, plan.sending));
    }
  }

  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    config,
    pages,
    createdAt: now,
    updatedAt: now,
  };
}
