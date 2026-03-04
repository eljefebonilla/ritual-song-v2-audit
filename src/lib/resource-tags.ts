/**
 * Resource tag system for structured file classification.
 *
 * File Type Tags (mutually exclusive — pick one):
 *   SCORE, OCTAVO, GTR, KYB, INSTR variants, SAT, SATB variants, 4SC, 4SS
 *
 * Modifier Tags (optional, stackable):
 *   AIM (Assembly in Motion — priority lead sheet)
 *   CLR (Color copy)
 */

export interface FileTypeTag {
  id: string;
  label: string;
  description: string;
  group: "score_parts" | "choral" | "instrumental";
}

export interface ModifierTag {
  id: string;
  label: string;
  description: string;
}

export const FILE_TYPE_TAGS: FileTypeTag[] = [
  // Score & Parts
  { id: "SCORE", label: "Score", description: "Full score / lead sheet", group: "score_parts" },
  { id: "OCTAVO", label: "Octavo", description: "Published octavo edition", group: "score_parts" },
  { id: "GTR", label: "Guitar", description: "Guitar part / chord chart", group: "score_parts" },
  { id: "KYB", label: "Keyboard", description: "Keyboard / piano part", group: "score_parts" },
  { id: "4SC", label: "4-Score", description: "Four-page score format", group: "score_parts" },
  { id: "4SS", label: "4-Song Sheet", description: "Four-song sheet format", group: "score_parts" },
  // Choral
  { id: "SAT", label: "SAT", description: "Soprano/Alto/Tenor arrangement", group: "choral" },
  { id: "SATB", label: "SATB", description: "Full SATB arrangement", group: "choral" },
  { id: "SATB-S", label: "SATB Soprano", description: "Soprano part from SATB", group: "choral" },
  { id: "SATB-A", label: "SATB Alto", description: "Alto part from SATB", group: "choral" },
  { id: "SATB-T", label: "SATB Tenor", description: "Tenor part from SATB", group: "choral" },
  { id: "SATB-B", label: "SATB Bass", description: "Bass part from SATB", group: "choral" },
  // Instrumental
  { id: "INSTR", label: "Instrument", description: "Generic instrument part", group: "instrumental" },
  { id: "INSTR-VLN", label: "Violin", description: "Violin part", group: "instrumental" },
  { id: "INSTR-VLA", label: "Viola", description: "Viola part", group: "instrumental" },
  { id: "INSTR-VLC", label: "Cello", description: "Cello part", group: "instrumental" },
  { id: "INSTR-FL", label: "Flute", description: "Flute part", group: "instrumental" },
  { id: "INSTR-OB", label: "Oboe", description: "Oboe part", group: "instrumental" },
  { id: "INSTR-CL", label: "Clarinet", description: "Clarinet part", group: "instrumental" },
  { id: "INSTR-TPT", label: "Trumpet", description: "Trumpet part", group: "instrumental" },
  { id: "INSTR-HN", label: "Horn", description: "French horn part", group: "instrumental" },
  { id: "INSTR-TBN", label: "Trombone", description: "Trombone part", group: "instrumental" },
];

export const MODIFIER_TAGS: ModifierTag[] = [
  { id: "AIM", label: "AIM", description: "Assembly in Motion — priority lead sheet" },
  { id: "CLR", label: "Color", description: "Color copy" },
];

export const FILE_TYPE_TAG_IDS = FILE_TYPE_TAGS.map((t) => t.id);
export const MODIFIER_TAG_IDS = MODIFIER_TAGS.map((t) => t.id);

/** All valid tag IDs */
export const ALL_TAG_IDS = [...FILE_TYPE_TAG_IDS, ...MODIFIER_TAG_IDS];

/** Grouped file type tags for UI selectors */
export const FILE_TYPE_GROUPS: { label: string; group: FileTypeTag["group"]; tags: FileTypeTag[] }[] = [
  { label: "Score & Parts", group: "score_parts", tags: FILE_TYPE_TAGS.filter((t) => t.group === "score_parts") },
  { label: "Choral", group: "choral", tags: FILE_TYPE_TAGS.filter((t) => t.group === "choral") },
  { label: "Instrumental", group: "instrumental", tags: FILE_TYPE_TAGS.filter((t) => t.group === "instrumental") },
];

/**
 * Build a sanitized storage filename from tags.
 * Example: "Be_Not_Afraid_Dufford_GTR_AIM.pdf"
 */
export function buildStorageName(
  title: string,
  composer: string | undefined,
  typeTag: string,
  modifiers: string[],
  ext: string,
): string {
  const sanitize = (s: string) =>
    s.replace(/[^\w\s.-]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 60);

  const parts = [sanitize(title)];
  if (composer) {
    // Use last name of first composer
    const first = composer.split(/[\/&,]/)[0].trim();
    const nameParts = first.split(/\s+/);
    parts.push(sanitize(nameParts[nameParts.length - 1]));
  }
  parts.push(typeTag);
  for (const m of modifiers) parts.push(m);

  const name = parts.join("_");
  const dotExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `${name}${dotExt}`;
}

/**
 * Build a display label from tags.
 * Example: "Guitar (AIM)" for tags ["GTR", "AIM"]
 */
export function buildLabelFromTags(tags: string[]): string {
  const typeTag = tags.find((t) => FILE_TYPE_TAG_IDS.includes(t));
  const modifiers = tags.filter((t) => MODIFIER_TAG_IDS.includes(t));

  if (!typeTag) return tags.join(", ");

  const typeDef = FILE_TYPE_TAGS.find((t) => t.id === typeTag);
  const label = typeDef?.label || typeTag;

  if (modifiers.length === 0) return label;
  return `${label} (${modifiers.join(", ")})`;
}

/**
 * Parse tags from a legacy freeform label.
 * Used for backfill of existing resources.
 */
export function parseTagsFromLabel(label: string, filePath?: string): string[] {
  const tags: string[] = [];
  const lower = label.toLowerCase();
  const fp = (filePath || "").toLowerCase();

  // Modifier detection
  if (lower.includes("aim") || fp.includes("aim")) tags.push("AIM");
  if (lower.includes("clr") || lower.includes("color") || fp.includes("clr") || fp.includes("color")) {
    tags.push("CLR");
  }

  // Type detection — order matters, most specific first
  if (lower.includes("satb-s") || lower.includes("soprano")) { tags.push("SATB-S"); return tags; }
  if (lower.includes("satb-a") || lower.includes("alto")) { tags.push("SATB-A"); return tags; }
  if (lower.includes("satb-t") || lower.includes("tenor")) { tags.push("SATB-T"); return tags; }
  if (lower.includes("satb-b") || lower.includes("bass")) { tags.push("SATB-B"); return tags; }
  if (lower.includes("satb")) { tags.push("SATB"); return tags; }
  if (lower.includes("sat")) { tags.push("SAT"); return tags; }

  if (lower.includes("guitar") || lower.includes("gtr")) { tags.push("GTR"); return tags; }
  if (lower.includes("keyboard") || lower.includes("kyb") || lower.includes("piano")) { tags.push("KYB"); return tags; }
  if (lower.includes("octavo")) { tags.push("OCTAVO"); return tags; }

  // Instrument parts
  if (lower.includes("violin") || lower.includes("vln")) { tags.push("INSTR-VLN"); return tags; }
  if (lower.includes("viola") || lower.includes("vla")) { tags.push("INSTR-VLA"); return tags; }
  if (lower.includes("cello") || lower.includes("vlc")) { tags.push("INSTR-VLC"); return tags; }
  if (lower.includes("flute") || lower.includes(" fl ") || lower.includes(" fl.")) { tags.push("INSTR-FL"); return tags; }
  if (lower.includes("oboe")) { tags.push("INSTR-OB"); return tags; }
  if (lower.includes("clarinet")) { tags.push("INSTR-CL"); return tags; }
  if (lower.includes("trumpet") || lower.includes("tpt")) { tags.push("INSTR-TPT"); return tags; }
  if (lower.includes("horn")) { tags.push("INSTR-HN"); return tags; }
  if (lower.includes("trombone") || lower.includes("tbn")) { tags.push("INSTR-TBN"); return tags; }
  if (lower.includes("instrument")) { tags.push("INSTR"); return tags; }

  // Generic score/lead sheet
  if (lower.includes("lead sheet") || lower.includes("score") || lower.includes("ls")) {
    tags.push("SCORE");
    return tags;
  }

  return tags;
}

/** Resource display group for organizing resources in the detail panel */
export type ResourceDisplayGroup = "score_parts" | "choral" | "audio" | "other";

export const RESOURCE_GROUP_LABELS: Record<ResourceDisplayGroup, string> = {
  score_parts: "Score & Parts",
  choral: "Choral",
  audio: "Audio",
  other: "Other",
};

export const RESOURCE_GROUP_ORDER: ResourceDisplayGroup[] = ["score_parts", "choral", "audio", "other"];

/**
 * Classify a resource into a display group based on its tags.
 */
export function getResourceGroup(tags: string[] | undefined, type: string): ResourceDisplayGroup {
  if (type === "audio" || type === "practice_track") return "audio";

  if (!tags || tags.length === 0) {
    // Legacy fallback by type
    if (type === "sheet_music") return "score_parts";
    return "other";
  }

  const typeTag = tags.find((t) => FILE_TYPE_TAG_IDS.includes(t));
  if (!typeTag) {
    if (type === "sheet_music") return "score_parts";
    return "other";
  }

  const def = FILE_TYPE_TAGS.find((t) => t.id === typeTag);
  if (!def) return "other";

  if (def.group === "score_parts" || def.group === "instrumental") return "score_parts";
  if (def.group === "choral") return "choral";
  return "other";
}

/** Tag badge colors for display */
export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  // File types
  SCORE: { bg: "bg-emerald-100", text: "text-emerald-700" },
  OCTAVO: { bg: "bg-emerald-100", text: "text-emerald-700" },
  GTR: { bg: "bg-blue-100", text: "text-blue-700" },
  KYB: { bg: "bg-purple-100", text: "text-purple-700" },
  "4SC": { bg: "bg-emerald-100", text: "text-emerald-700" },
  "4SS": { bg: "bg-emerald-100", text: "text-emerald-700" },
  SAT: { bg: "bg-indigo-100", text: "text-indigo-700" },
  SATB: { bg: "bg-indigo-100", text: "text-indigo-700" },
  "SATB-S": { bg: "bg-indigo-100", text: "text-indigo-700" },
  "SATB-A": { bg: "bg-indigo-100", text: "text-indigo-700" },
  "SATB-T": { bg: "bg-indigo-100", text: "text-indigo-700" },
  "SATB-B": { bg: "bg-indigo-100", text: "text-indigo-700" },
  INSTR: { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-VLN": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-VLA": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-VLC": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-FL": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-OB": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-CL": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-TPT": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-HN": { bg: "bg-orange-100", text: "text-orange-700" },
  "INSTR-TBN": { bg: "bg-orange-100", text: "text-orange-700" },
  // Modifiers
  AIM: { bg: "bg-amber-200", text: "text-amber-800" },
  CLR: { bg: "bg-sky-100", text: "text-sky-700" },
};
