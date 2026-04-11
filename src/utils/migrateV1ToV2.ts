/**
 * Convert v1 WorshipAidPage (HTML blobs + structured data) to v2 EditorPage (element model).
 * Used when the user switches from Preview mode to Editor v2.
 */

import type { WorshipAidPage } from "@/lib/worship-aid/types";
import type { EditorPage, EditorDocument, PageElement, TextElement, ImageElement } from "@/types/schema";
import { PAGE_SIZES } from "@/types/schema";
import { FONT_FAMILIES, FONT_SIZES, FONT_WEIGHTS, LINE_HEIGHTS, LETTER_SPACING } from "@/core/design-system/tokens/typography";
import { MARGINS, SEASON_BAR, COPYRIGHT_ZONE } from "@/core/design-system/tokens/spacing";

const PAGE = PAGE_SIZES["half-letter"];
const LX = MARGINS.inner;
const LW = PAGE.width - MARGINS.inner - MARGINS.outer;

let idCounter = 0;
function uid(): string {
  return `migrated-${Date.now()}-${++idCounter}`;
}

type Geo4 = { x: number; y: number; width: number; height: number };
type TextOverrides = Omit<Partial<TextElement>, "id" | "type" | "geometry"> & {
  geometry: Geo4;
  content: string;
};

function textEl(o: TextOverrides): TextElement {
  return {
    id: uid(),
    type: "text",
    zIndex: o.zIndex ?? 0,
    locked: o.locked ?? false,
    visible: o.visible ?? true,
    fontSize: o.fontSize ?? FONT_SIZES.body,
    fontFamily: o.fontFamily ?? FONT_FAMILIES.body,
    fontWeight: o.fontWeight ?? FONT_WEIGHTS.regular,
    color: o.color ?? "#1A1A1A",
    textAlign: o.textAlign ?? "left",
    lineHeight: o.lineHeight ?? LINE_HEIGHTS.normal,
    letterSpacing: o.letterSpacing ?? LETTER_SPACING.normal,
    textTransform: o.textTransform,
    geometry: { ...o.geometry, rotation: 0 },
    content: o.content,
  };
}

type ImageOverrides = Omit<Partial<ImageElement>, "id" | "type" | "geometry"> & {
  geometry: Geo4;
  src: string;
};

function imageEl(o: ImageOverrides): ImageElement {
  return {
    id: uid(),
    type: "image",
    zIndex: o.zIndex ?? 0,
    locked: o.locked ?? false,
    visible: o.visible ?? true,
    objectFit: o.objectFit ?? "contain",
    cropTop: o.cropTop ?? 0,
    cropLeft: o.cropLeft ?? 0,
    cropWidth: o.cropWidth ?? 1,
    cropHeight: o.cropHeight ?? 1,
    opacity: o.opacity ?? 1,
    geometry: { ...o.geometry, rotation: 0 },
    src: o.src,
  };
}

function migrateCoverPage(v1: WorshipAidPage): PageElement[] {
  const cover = v1.coverData;
  if (!cover) return [];

  const elements: PageElement[] = [];
  let z = 0;

  // Season bar top
  elements.push({
    id: uid(), type: "shape", zIndex: z++, locked: false, visible: true,
    geometry: { x: 0, y: 0, width: PAGE.width, height: SEASON_BAR.height, rotation: 0 },
    subType: "rectangle", fill: cover.seasonColor || "#186420", stroke: "transparent", strokeWidth: 0,
  });

  // Logo
  if (cover.logoUrl) {
    const scale = cover.logoScale ?? 1;
    const logoW = 85 * scale;
    const logoH = 50 * scale;
    const offsetY = cover.logoOffsetY ?? 0;
    elements.push(imageEl({
      geometry: { x: LX + (LW - logoW) / 2, y: 30 + offsetY * 0.5, width: logoW, height: logoH },
      src: cover.logoUrl,
      zIndex: z++,
    }));
  }

  // Cover art (background image below text)
  if (cover.coverArtUrl) {
    elements.push(imageEl({
      geometry: { x: LX, y: MARGINS.top + 5, width: LW, height: 120 },
      src: cover.coverArtUrl,
      objectFit: "cover",
      opacity: 0.15,
      zIndex: z++,
    }));
  }

  // Parish name
  elements.push(textEl({
    geometry: { x: LX, y: 88, width: LW, height: 12 },
    content: cover.parishName || "St. Monica Catholic Church",
    fontSize: FONT_SIZES.h3,
    fontFamily: FONT_FAMILIES.heading,
    fontWeight: FONT_WEIGHTS.semibold,
    textAlign: "center",
    letterSpacing: LETTER_SPACING.wide,
    textTransform: "uppercase",
    color: cover.seasonColor || "#1A1A1A",
    zIndex: z++,
  }));

  // Occasion title
  elements.push(textEl({
    geometry: { x: LX, y: 110, width: LW, height: 20 },
    content: cover.occasionName || v1.title,
    fontSize: FONT_SIZES.h1,
    fontFamily: FONT_FAMILIES.body,
    textAlign: "center",
    lineHeight: LINE_HEIGHTS.tight,
    zIndex: z++,
  }));

  // Subtitle
  if (cover.occasionSubtitle) {
    elements.push(textEl({
      geometry: { x: LX, y: 132, width: LW, height: 8 },
      content: cover.occasionSubtitle,
      fontSize: FONT_SIZES.body,
      fontFamily: FONT_FAMILIES.heading,
      fontWeight: FONT_WEIGHTS.light,
      textAlign: "center",
      color: "#57534E",
      zIndex: z++,
    }));
  }

  // Date
  elements.push(textEl({
    geometry: { x: LX, y: 145, width: LW, height: 8 },
    content: cover.date || "",
    fontSize: FONT_SIZES.body,
    fontFamily: FONT_FAMILIES.heading,
    fontWeight: FONT_WEIGHTS.light,
    textAlign: "center",
    color: "#57534E",
    letterSpacing: LETTER_SPACING.wide,
    zIndex: z++,
  }));

  // Season bar bottom
  elements.push({
    id: uid(), type: "shape", zIndex: z++, locked: false, visible: true,
    geometry: { x: 0, y: PAGE.height - SEASON_BAR.height, width: PAGE.width, height: SEASON_BAR.height, rotation: 0 },
    subType: "rectangle", fill: cover.seasonColor || "#186420", stroke: "transparent", strokeWidth: 0,
  });

  return elements;
}

function migrateSongPage(v1: WorshipAidPage): PageElement[] {
  const song = v1.songData;
  if (!song) return [];

  const elements: PageElement[] = [];
  let z = 0;

  // Song title (17pt Crimson Pro small-caps per publisher convention)
  elements.push(textEl({
    geometry: { x: LX, y: MARGINS.top, width: LW, height: 12 },
    content: song.title,
    fontSize: 17,
    fontFamily: FONT_FAMILIES.body,
    fontWeight: FONT_WEIGHTS.regular,
    textTransform: "small-caps",
    letterSpacing: LETTER_SPACING.wide,
    zIndex: z++,
  }));

  // Composer (10.5pt italic)
  if (song.composer) {
    elements.push(textEl({
      geometry: { x: LX, y: MARGINS.top + 13, width: LW, height: 5 },
      content: `<em>${song.composer}</em>`,
      fontSize: 10.5,
      fontFamily: FONT_FAMILIES.body,
      fontWeight: FONT_WEIGHTS.regular,
      color: "#57534E",
      zIndex: z++,
    }));
  }

  // Position label (7.5pt Source Sans 3 uppercase tracked)
  elements.push(textEl({
    geometry: { x: LX, y: MARGINS.top + 19, width: LW, height: 4 },
    content: song.positionLabel || v1.position || "",
    fontSize: 7.5,
    fontFamily: FONT_FAMILIES.heading,
    textAlign: "left",
    letterSpacing: LETTER_SPACING.extraWide,
    textTransform: "uppercase",
    color: "#8C8581",
    zIndex: z++,
  }));

  // Divider (uses CSS variable for season theming)
  elements.push({
    id: uid(), type: "divider", zIndex: z++, locked: false, visible: true,
    geometry: { x: LX, y: MARGINS.top + 22, width: LW, height: 0, rotation: 0 },
    stroke: "var(--wa-border, #E7E5E4)", strokeWidth: 0.3, strokeStyle: "solid" as const,
  });

  // Reprint image or lyrics
  if (song.reprintUrl) {
    const cropTop = v1.cropTop ? v1.cropTop / 100 : 0;
    elements.push(imageEl({
      geometry: { x: LX, y: MARGINS.top + 25, width: LW, height: 150 },
      src: song.reprintUrl,
      cropTop,
      zIndex: z++,
    }));
  } else if (song.lyrics) {
    elements.push(textEl({
      geometry: { x: LX, y: MARGINS.top + 25, width: LW, height: 150 },
      content: song.lyrics,
      fontSize: FONT_SIZES.body,
      lineHeight: LINE_HEIGHTS.tight,
      zIndex: z++,
    }));
  } else {
    // Title card fallback
    elements.push(textEl({
      geometry: { x: LX + 10, y: MARGINS.top + 60, width: LW - 20, height: 30 },
      content: song.title,
      fontSize: FONT_SIZES.h1,
      fontFamily: FONT_FAMILIES.body,
      textAlign: "center",
      color: "#78716C",
      zIndex: z++,
    }));
  }

  // Copyright (generic boilerplate; per-song OneLicense data is a future integration)
  elements.push(textEl({
    geometry: { x: LX, y: COPYRIGHT_ZONE.y, width: LW, height: COPYRIGHT_ZONE.height },
    content: "All music reprinted under OneLicense #A-700048. Contact music@stmonica.net for a complete list of copyrights.",
    fontSize: FONT_SIZES.copyright,
    fontFamily: FONT_FAMILIES.heading,
    textTransform: "uppercase",
    color: "#78716C",
    lineHeight: LINE_HEIGHTS.tight,
    letterSpacing: LETTER_SPACING.wide,
    zIndex: z++,
  }));

  return elements;
}

function migrateReadingPage(v1: WorshipAidPage): PageElement[] {
  const reading = v1.readingData;
  if (!reading) return [];

  const elements: PageElement[] = [];
  let z = 0;

  // Header
  elements.push(textEl({
    geometry: { x: LX, y: MARGINS.top, width: LW, height: 10 },
    content: "Liturgy of the Word",
    fontSize: FONT_SIZES.h2,
    fontFamily: FONT_FAMILIES.heading,
    fontWeight: FONT_WEIGHTS.semibold,
    textAlign: "center",
    letterSpacing: LETTER_SPACING.wide,
    textTransform: "uppercase",
    zIndex: z++,
  }));

  // Divider (uses CSS variable for season theming)
  elements.push({
    id: uid(), type: "divider", zIndex: z++, locked: false, visible: true,
    geometry: { x: LX + 30, y: MARGINS.top + 13, width: LW - 60, height: 0, rotation: 0 },
    stroke: "var(--wa-primary, #186420)", strokeWidth: 0.4, strokeStyle: "solid" as const,
  });

  // Each reading
  const slotHeight = 35;
  reading.readings.forEach((r, i) => {
    const y = MARGINS.top + 20 + i * (slotHeight + 7);
    elements.push(textEl({
      geometry: { x: LX, y, width: LW, height: slotHeight },
      content: `<strong>${r.type}</strong><br/>${r.citation}<br/>${r.summary}`,
      fontSize: FONT_SIZES.body,
      lineHeight: LINE_HEIGHTS.normal,
      zIndex: z++,
    }));
  });

  return elements;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function migrateGivingPage(_v1: WorshipAidPage): PageElement[] {
  const elements: PageElement[] = [];
  let z = 0;

  elements.push(textEl({
    geometry: { x: LX, y: MARGINS.top, width: LW, height: 10 },
    content: "Support Our Parish",
    fontSize: FONT_SIZES.h2,
    fontFamily: FONT_FAMILIES.heading,
    fontWeight: FONT_WEIGHTS.semibold,
    textAlign: "center",
    letterSpacing: LETTER_SPACING.wide,
    textTransform: "uppercase",
    zIndex: z++,
  }));

  elements.push({
    id: uid(), type: "qr", zIndex: z++, locked: false, visible: true,
    geometry: { x: LX + (LW - 40) / 2, y: MARGINS.top + 20, width: 40, height: 40, rotation: 0 },
    url: "https://stmonica.net/give",
    foregroundColor: "#1A1A1A",
    backgroundColor: "#FFFFFF",
  });

  elements.push(textEl({
    geometry: { x: LX, y: MARGINS.top + 65, width: LW, height: 8 },
    content: "stmonica.net/give",
    fontSize: FONT_SIZES.body,
    fontFamily: FONT_FAMILIES.heading,
    textAlign: "center",
    color: "#57534E",
    zIndex: z++,
  }));

  return elements;
}

function migrateLinksPage(v1: WorshipAidPage): PageElement[] {
  const elements: PageElement[] = [];
  let z = 0;

  elements.push(textEl({
    geometry: { x: LX, y: MARGINS.top, width: LW, height: 10 },
    content: v1.title || "Resources",
    fontSize: FONT_SIZES.h2,
    fontFamily: FONT_FAMILIES.heading,
    fontWeight: FONT_WEIGHTS.semibold,
    textAlign: "center",
    zIndex: z++,
  }));

  // Convert custom links to text elements
  const links = v1.customLinks ?? [];
  links.forEach((link, i) => {
    elements.push(textEl({
      geometry: { x: LX, y: MARGINS.top + 18 + i * 12, width: LW, height: 10 },
      content: `<strong>${link.label}</strong><br/>${link.url}`,
      fontSize: FONT_SIZES.body,
      fontFamily: FONT_FAMILIES.body,
      zIndex: z++,
    }));
  });

  return elements;
}

function migrateOnePage(v1: WorshipAidPage): EditorPage {
  let elements: PageElement[];

  switch (v1.type) {
    case "cover":
      elements = migrateCoverPage(v1);
      break;
    case "song":
      elements = migrateSongPage(v1);
      break;
    case "reading":
      elements = migrateReadingPage(v1);
      break;
    case "giving":
      elements = migrateGivingPage(v1);
      break;
    case "links":
      elements = migrateLinksPage(v1);
      break;
    default:
      elements = [];
  }

  return {
    id: uid(),
    templateId: v1.type,
    pageSize: PAGE,
    backgroundColor: "#FFFFFF",
    elements,
  };
}

/**
 * Convert an entire v1 WorshipAid page array into a v2 EditorDocument.
 */
export function migrateV1ToV2(
  v1Pages: WorshipAidPage[],
  metadata: { occasionId: string; ensembleId: string; season?: string },
): EditorDocument {
  const activePges = v1Pages.filter((p) => !p.removed);

  return {
    id: uid(),
    metadata: {
      title: activePges[0]?.title ?? "Worship Aid",
      occasionId: metadata.occasionId,
      ensembleId: metadata.ensembleId,
      parishId: "st-monica",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    globalStyles: {
      defaultFontFamily: FONT_FAMILIES.body,
      defaultFontSize: FONT_SIZES.body,
      defaultColor: "#1A1A1A",
      season: metadata.season ?? "ordinary-time",
    },
    pages: activePges.map(migrateOnePage),
  };
}
