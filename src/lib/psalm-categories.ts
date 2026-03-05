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

/** Seasonal Common Psalms — from Lectionary and OCP Spirit & Song index */
export const PSALM_SEASON_MAP: Record<number, string[]> = {
  25: ["advent"],
  85: ["advent"],
  24: ["advent"],
  122: ["advent"],
  98: ["christmas"],
  96: ["christmas"],
  97: ["christmas"],
  72: ["christmas"], // Epiphany
  51: ["lent"],
  91: ["lent"],
  130: ["lent"],
  27: ["lent"],
  34: ["lent", "ordinary"],
  22: ["lent", "holy_week"],
  31: ["holy_week"],
  116: ["holy_week"],
  136: ["easter"],
  118: ["easter"],
  66: ["easter"],
  47: ["easter"], // Ascension
  104: ["easter"], // Pentecost
  33: ["easter"],
  19: ["ordinary"],
  63: ["ordinary"],
  95: ["ordinary"],
  100: ["ordinary"],
  103: ["ordinary"],
  145: ["ordinary"],
  128: ["ordinary"],
  112: ["ordinary"],
  84: ["ordinary"],
  15: ["ordinary"],
  16: ["ordinary"],
  23: ["ordinary"],
};

export const PSALM_SEASON_FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "advent", label: "Advent" },
  { id: "christmas", label: "Christmas" },
  { id: "lent", label: "Lent" },
  { id: "holy_week", label: "Holy Week" },
  { id: "easter", label: "Easter" },
  { id: "ordinary", label: "Ordinary" },
];

/** Get seasonal assignments for a psalm number */
export function getPsalmSeasons(psalmNum: number): string[] {
  return PSALM_SEASON_MAP[psalmNum] || [];
}

/** Parse psalm number from title: "Psalm 23: ...", "Ps 67 ...", "Ps. 103 ..." */
export function parsePsalmNumber(title: string): number | null {
  const m = title.match(/^(?:psalm|ps\.?)\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Get scholarly/liturgical categories for a psalm number */
export function getPsalmCategories(psalmNum: number): string[] {
  return PSALM_CATEGORY_MAP[psalmNum] || [];
}
