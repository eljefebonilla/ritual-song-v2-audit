// Psalm scholarly/liturgical categories
// Sources: Gunkel form criticism, Catholic liturgical tradition

export const PSALM_CATEGORY_MAP: Record<number, string[]> = {
  // Wisdom
  1: ["wisdom"],
  37: ["wisdom"],
  49: ["wisdom"],
  73: ["wisdom"],
  112: ["wisdom"],
  119: ["wisdom"],
  127: ["wisdom"],
  128: ["wisdom"],
  133: ["wisdom"],

  // Royal/Messianic
  2: ["royal"],
  20: ["royal"],
  21: ["royal"],
  45: ["royal"],
  72: ["royal"],
  89: ["royal"],
  101: ["royal"],
  110: ["royal"],
  132: ["royal"],
  144: ["royal"],

  // Individual Lament
  3: ["lament"],
  5: ["lament"],
  7: ["lament"],
  10: ["lament"],
  13: ["lament"],
  17: ["lament"],
  22: ["lament"],
  25: ["lament"],
  26: ["lament"],
  28: ["lament"],
  31: ["lament"],
  35: ["lament"],
  39: ["lament"],
  42: ["lament"],
  43: ["lament"],
  54: ["lament"],
  55: ["lament"],
  56: ["lament"],
  57: ["lament"],
  59: ["lament"],
  61: ["lament"],
  64: ["lament"],
  69: ["lament"],
  70: ["lament"],
  71: ["lament"],
  77: ["lament"],
  86: ["lament"],
  88: ["lament"],
  109: ["lament"],
  120: ["lament"],
  140: ["lament"],
  141: ["lament"],
  142: ["lament"],

  // Communal Lament
  12: ["lament"],
  44: ["lament"],
  58: ["lament"],
  60: ["lament"],
  74: ["lament"],
  79: ["lament"],
  80: ["lament"],
  83: ["lament"],
  85: ["lament"],
  90: ["lament"],
  94: ["lament"],
  123: ["lament"],
  126: ["lament"],
  137: ["lament"],

  // Praise/Hymn
  8: ["praise"],
  19: ["praise"],
  29: ["praise"],
  33: ["praise"],
  46: ["praise"],
  47: ["praise"],
  48: ["praise"],
  65: ["praise"],
  68: ["praise"],
  76: ["praise"],
  84: ["praise"],
  87: ["praise"],
  95: ["praise"],
  96: ["praise"],
  97: ["praise"],
  98: ["praise"],
  99: ["praise"],
  100: ["praise"],
  103: ["praise"],
  104: ["praise"],
  105: ["praise"],
  111: ["praise"],
  113: ["praise"],
  114: ["praise"],
  117: ["praise"],
  134: ["praise"],
  135: ["praise"],
  136: ["praise"],
  145: ["praise"],
  146: ["praise"],
  147: ["praise"],
  148: ["praise"],
  149: ["praise"],
  150: ["praise"],

  // Thanksgiving
  9: ["thanksgiving"],
  30: ["thanksgiving"],
  34: ["thanksgiving"],
  40: ["thanksgiving"],
  41: ["thanksgiving"],
  75: ["thanksgiving"],
  92: ["thanksgiving"],
  107: ["thanksgiving"],
  116: ["thanksgiving"],
  118: ["thanksgiving"],
  124: ["thanksgiving"],
  138: ["thanksgiving"],

  // Penitential (Catholic tradition — the 7 penitential psalms)
  // These overlap with lament; handled via multi-category
  6: ["lament", "penitential"],
  38: ["lament", "penitential"],
  51: ["lament", "penitential"],
  102: ["lament", "penitential"],
  130: ["lament", "penitential"],
  143: ["lament", "penitential"],
  // Ps 32 is both thanksgiving and penitential
  32: ["thanksgiving", "penitential"],

  // Multi-category: Psalms that are both praise and thanksgiving
  66: ["praise", "thanksgiving"],
  67: ["praise", "thanksgiving"],

  // Royal + Thanksgiving overlap
  18: ["royal", "thanksgiving"],

  // Trust psalms (grouped with praise in liturgical tradition)
  23: ["praise"],
  27: ["praise"],
  62: ["praise"],
  91: ["praise"],
  121: ["praise"],
  125: ["praise"],
  131: ["praise"],
};

export const PSALM_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "common", label: "Common" },
  { id: "penitential", label: "Penitential" },
  { id: "lament", label: "Lament" },
  { id: "praise", label: "Praise" },
  { id: "thanksgiving", label: "Thanksgiving" },
  { id: "royal", label: "Royal" },
  { id: "wisdom", label: "Wisdom" },
];

/** Psalm browsing lens — the primary axis for psalm exploration */
export type PsalmLens = "all" | "season" | "book" | "type";

export const PSALM_LENS_OPTIONS: { id: PsalmLens; label: string }[] = [
  { id: "all", label: "All" },
  { id: "season", label: "By Season" },
  { id: "book", label: "By Book" },
  { id: "type", label: "By Type" },
];

/** Scholarly type options (used when lens = "type") */
export const PSALM_TYPE_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All Types" },
  { id: "penitential", label: "Penitential" },
  { id: "lament", label: "Lament" },
  { id: "praise", label: "Praise" },
  { id: "thanksgiving", label: "Thanksgiving" },
  { id: "royal", label: "Royal" },
  { id: "wisdom", label: "Wisdom" },
];

/** The five Books of the Psalter (Torah-like structure, each ending with a doxology) + Canticles */
export const PSALTER_BOOKS: { id: string; label: string; range: [number, number] | null }[] = [
  { id: "book1", label: "Book I (1–41)", range: [1, 41] },
  { id: "book2", label: "Book II (42–72)", range: [42, 72] },
  { id: "book3", label: "Book III (73–89)", range: [73, 89] },
  { id: "book4", label: "Book IV (90–106)", range: [90, 106] },
  { id: "book5", label: "Book V (107–150)", range: [107, 150] },
  { id: "canticles", label: "Canticles", range: null },
];

/** Check if a psalm/canticle belongs to the selected book */
export function isInPsalterBook(psalmNum: number | null, bookId: string): boolean {
  const book = PSALTER_BOOKS.find(b => b.id === bookId);
  if (!book) return true;
  // Canticles book: songs with no psalm number
  if (book.range === null) return psalmNum === null;
  // Numbered books: songs with a psalm number in range
  if (psalmNum === null) return false;
  return psalmNum >= book.range[0] && psalmNum <= book.range[1];
}

/** Lectionary psalm assignments — mined from Organized Psalms folder structure */
export type PsalmSeasonEntry = { season: string; years: string[] };

export const PSALM_SEASON_ASSIGNMENTS: { psalm: number; season: string; years: string[] }[] = [
  // advent
  { psalm: 24, season: "advent", years: ["A"] },
  { psalm: 25, season: "advent", years: ["C"] },
  { psalm: 72, season: "advent", years: ["A"] },
  { psalm: 80, season: "advent", years: ["B", "C"] },
  { psalm: 85, season: "advent", years: ["B"] },
  { psalm: 89, season: "advent", years: ["B"] },
  { psalm: 122, season: "advent", years: ["A"] },
  { psalm: 126, season: "advent", years: ["C"] },
  { psalm: 146, season: "advent", years: ["A"] },
  // christmas
  { psalm: 29, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 34, season: "christmas", years: ["C"] },
  { psalm: 40, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 67, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 71, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 72, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 84, season: "christmas", years: ["C"] },
  { psalm: 89, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 96, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 97, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 98, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 104, season: "christmas", years: ["C"] },
  { psalm: 105, season: "christmas", years: ["B"] },
  { psalm: 128, season: "christmas", years: ["A", "B", "C"] },
  { psalm: 139, season: "christmas", years: ["A", "B", "C"] },
  // lent
  { psalm: 19, season: "lent", years: ["B"] },
  { psalm: 22, season: "lent", years: ["A", "B", "C"] },
  { psalm: 23, season: "lent", years: ["A", "B", "C"] },
  { psalm: 25, season: "lent", years: ["B"] },
  { psalm: 27, season: "lent", years: ["C"] },
  { psalm: 29, season: "lent", years: ["C"] },
  { psalm: 31, season: "lent", years: ["A", "B", "C"] },
  { psalm: 33, season: "lent", years: ["A"] },
  { psalm: 34, season: "lent", years: ["C"] },
  { psalm: 51, season: "lent", years: ["A", "B", "C"] },
  { psalm: 67, season: "lent", years: ["A", "B", "C"] },
  { psalm: 89, season: "lent", years: ["A", "B", "C"] },
  { psalm: 91, season: "lent", years: ["C"] },
  { psalm: 95, season: "lent", years: ["A", "B", "C"] },
  { psalm: 103, season: "lent", years: ["C"] },
  { psalm: 104, season: "lent", years: ["C"] },
  { psalm: 116, season: "lent", years: ["A", "B", "C"] },
  { psalm: 126, season: "lent", years: ["C"] },
  { psalm: 130, season: "lent", years: ["A", "B", "C"] },
  { psalm: 137, season: "lent", years: ["B"] },
  // holy_week (Palm Sunday / Triduum — shared across all years)
  { psalm: 22, season: "holy_week", years: ["A", "B", "C"] },
  { psalm: 31, season: "holy_week", years: ["A", "B", "C"] },
  { psalm: 116, season: "holy_week", years: ["A", "B", "C"] },
  // easter
  { psalm: 4, season: "easter", years: ["B"] },
  { psalm: 16, season: "easter", years: ["A"] },
  { psalm: 19, season: "easter", years: ["A", "B", "C"] },
  { psalm: 22, season: "easter", years: ["B"] },
  { psalm: 23, season: "easter", years: ["A"] },
  { psalm: 27, season: "easter", years: ["A"] },
  { psalm: 30, season: "easter", years: ["A", "B", "C"] },
  { psalm: 33, season: "easter", years: ["A", "B", "C"] },
  { psalm: 47, season: "easter", years: ["A", "B", "C"] },
  { psalm: 51, season: "easter", years: ["A", "B", "C"] },
  { psalm: 66, season: "easter", years: ["A"] },
  { psalm: 67, season: "easter", years: ["C"] },
  { psalm: 97, season: "easter", years: ["C"] },
  { psalm: 98, season: "easter", years: ["B"] },
  { psalm: 100, season: "easter", years: ["C"] },
  { psalm: 103, season: "easter", years: ["B"] },
  { psalm: 104, season: "easter", years: ["A", "B", "C"] },
  { psalm: 118, season: "easter", years: ["A", "B", "C"] },
  { psalm: 126, season: "easter", years: ["C"] },
  { psalm: 136, season: "easter", years: ["A", "B", "C"] },
  { psalm: 145, season: "easter", years: ["C"] },
  // ordinary
  { psalm: 1, season: "ordinary", years: ["C"] },
  { psalm: 15, season: "ordinary", years: ["B", "C"] },
  { psalm: 16, season: "ordinary", years: ["B", "C"] },
  { psalm: 17, season: "ordinary", years: ["C"] },
  { psalm: 18, season: "ordinary", years: ["A", "B"] },
  { psalm: 19, season: "ordinary", years: ["B", "C"] },
  { psalm: 23, season: "ordinary", years: ["A", "B"] },
  { psalm: 25, season: "ordinary", years: ["A", "B"] },
  { psalm: 27, season: "ordinary", years: ["A"] },
  { psalm: 30, season: "ordinary", years: ["B", "C"] },
  { psalm: 31, season: "ordinary", years: ["A"] },
  { psalm: 32, season: "ordinary", years: ["B", "C"] },
  { psalm: 33, season: "ordinary", years: ["B", "C"] },
  { psalm: 34, season: "ordinary", years: ["B", "C"] },
  { psalm: 40, season: "ordinary", years: ["A", "B", "C"] },
  { psalm: 50, season: "ordinary", years: ["A"] },
  { psalm: 51, season: "ordinary", years: ["C"] },
  { psalm: 54, season: "ordinary", years: ["B"] },
  { psalm: 62, season: "ordinary", years: ["A"] },
  { psalm: 63, season: "ordinary", years: ["A", "C"] },
  { psalm: 65, season: "ordinary", years: ["A"] },
  { psalm: 66, season: "ordinary", years: ["C"] },
  { psalm: 67, season: "ordinary", years: ["A"] },
  { psalm: 68, season: "ordinary", years: ["C"] },
  { psalm: 69, season: "ordinary", years: ["A", "C"] },
  { psalm: 71, season: "ordinary", years: ["C"] },
  { psalm: 78, season: "ordinary", years: ["B"] },
  { psalm: 80, season: "ordinary", years: ["A"] },
  { psalm: 81, season: "ordinary", years: ["B"] },
  { psalm: 85, season: "ordinary", years: ["A", "B"] },
  { psalm: 86, season: "ordinary", years: ["A"] },
  { psalm: 89, season: "ordinary", years: ["A"] },
  { psalm: 90, season: "ordinary", years: ["B", "C"] },
  { psalm: 92, season: "ordinary", years: ["C"] },
  { psalm: 95, season: "ordinary", years: ["A", "B", "C"] },
  { psalm: 96, season: "ordinary", years: ["A", "C"] },
  { psalm: 98, season: "ordinary", years: ["C"] },
  { psalm: 100, season: "ordinary", years: ["A"] },
  { psalm: 103, season: "ordinary", years: ["A", "C"] },
  { psalm: 104, season: "ordinary", years: ["C"] },
  { psalm: 107, season: "ordinary", years: ["B"] },
  { psalm: 110, season: "ordinary", years: ["C"] },
  { psalm: 112, season: "ordinary", years: ["A"] },
  { psalm: 113, season: "ordinary", years: ["C"] },
  { psalm: 116, season: "ordinary", years: ["B"] },
  { psalm: 117, season: "ordinary", years: ["C"] },
  { psalm: 119, season: "ordinary", years: ["A"] },
  { psalm: 121, season: "ordinary", years: ["C"] },
  { psalm: 123, season: "ordinary", years: ["B"] },
  { psalm: 126, season: "ordinary", years: ["B"] },
  { psalm: 128, season: "ordinary", years: ["A", "B"] },
  { psalm: 130, season: "ordinary", years: ["B"] },
  { psalm: 131, season: "ordinary", years: ["A"] },
  { psalm: 138, season: "ordinary", years: ["A", "C"] },
  { psalm: 145, season: "ordinary", years: ["A", "B", "C"] },
  { psalm: 146, season: "ordinary", years: ["A", "B", "C"] },
  { psalm: 147, season: "ordinary", years: ["B"] },
];

export const PSALM_SEASON_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "advent", label: "Advent" },
  { id: "christmas", label: "Christmas" },
  { id: "lent", label: "Lent" },
  { id: "holy_week", label: "Holy Week" },
  { id: "easter", label: "Easter" },
  { id: "ordinary", label: "Ordinary" },
];

export const PSALM_YEAR_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "A", label: "Year A" },
  { id: "B", label: "Year B" },
  { id: "C", label: "Year C" },
];

/** Get seasons for a psalm, optionally filtered by year */
export function getPsalmSeasons(psalmNum: number, year?: string): string[] {
  const entries = PSALM_SEASON_ASSIGNMENTS.filter(e => e.psalm === psalmNum);
  if (!year || year === "all") {
    return [...new Set(entries.map(e => e.season))];
  }
  return [...new Set(entries.filter(e => e.years.includes(year)).map(e => e.season))];
}

/** Get psalm numbers assigned to a season, optionally filtered by year */
export function getSeasonPsalmNumbers(season: string, year?: string): Set<number> {
  const nums = new Set<number>();
  for (const e of PSALM_SEASON_ASSIGNMENTS) {
    if (e.season !== season) continue;
    if (year && year !== "all" && !e.years.includes(year)) continue;
    nums.add(e.psalm);
  }
  return nums;
}

/** Parse psalm number from title: "Psalm 23: ...", "Ps 67 ...", "Ps. 103 ..." */
export function parsePsalmNumber(title: string): number | null {
  const m = title.match(/^(?:psalm|ps\.?)\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Common Psalms — from the USCCB Lectionary #173-174
 * "Common Texts for Sung Responsorial Psalms"
 * These may be used in place of the assigned psalm during any Mass in their season.
 */
export const COMMON_PSALMS: Record<string, number[]> = {
  advent: [25, 85],
  christmas: [72, 98],
  lent: [51, 91, 130],
  holy_week: [22],
  easter: [47, 66, 104, 118],
  ordinary: [19, 27, 34, 63, 95, 100, 103, 122, 145],
};

/** All common psalm numbers (union across seasons) */
export const ALL_COMMON_PSALM_NUMBERS: Set<number> = new Set(
  Object.values(COMMON_PSALMS).flat()
);

/** Get scholarly/liturgical categories for a psalm number */
export function getPsalmCategories(psalmNum: number): string[] {
  return PSALM_CATEGORY_MAP[psalmNum] || [];
}
