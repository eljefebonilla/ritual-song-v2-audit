import type { LibrarySong } from "./types";
import { normalizeTitle } from "./occasion-helpers";
import { normalizeComposer, composerSimilarity } from "./song-library";

export type DuplicateConfidence = "high" | "medium" | "low";

export interface DuplicateGroup {
  normalizedTitle: string;
  displayTitle: string;
  confidence: DuplicateConfidence;
  songs: {
    id: string;
    _key: string;
    title: string;
    composer: string | null;
    category: string;
    resourceCount: number;
    usageCount: number;
    ensembleUsage: Record<string, number>;
  }[];
}

export interface JunkEntry {
  id: string;
  title: string;
  composer: string;
  reason: string;
}

// Categories where multiple entries with the same title are expected (e.g., different verses per Sunday)
const EXEMPT_CATEGORIES = new Set(["gospel_acclamation", "antiphon"]);

/**
 * Group songs by normalized title and classify duplicate confidence.
 * - high: composer names fuzzy-match (same person, different spelling)
 * - medium: same title, one has resources and other doesn't
 * - low: same title, genuinely different composers
 *
 * Gospel acclamations and antiphons are excluded: they intentionally share
 * titles across Sundays (e.g., "Alleluia, Mass of Joy and Peace" with
 * different verses for each liturgical day).
 */
export function detectDuplicateGroups(songs: LibrarySong[]): DuplicateGroup[] {
  // Exclude categories where same-title entries are expected
  const candidateSongs = songs.filter((s) => !EXEMPT_CATEGORIES.has(s.category || ""));

  // Group by normalized title
  const groups = new Map<string, LibrarySong[]>();
  for (const song of candidateSongs) {
    const key = normalizeTitle(song.title);
    const existing = groups.get(key);
    if (existing) {
      existing.push(song);
    } else {
      groups.set(key, [song]);
    }
  }

  const result: DuplicateGroup[] = [];

  for (const [normTitle, members] of groups) {
    if (members.length < 2) continue;

    const confidence = classifyGroup(members);
    result.push({
      normalizedTitle: normTitle,
      displayTitle: members[0].title,
      confidence,
      songs: members.map((s, i) => ({
        id: s.id,
        _key: `${s.id}::${i}`,
        title: s.title,
        composer: s.composer || null,
        category: s.category || "song",
        resourceCount: s.resources.length,
        usageCount: s.usageCount,
        ensembleUsage: {},
      })),
    });
  }

  // Sort: high confidence first, then medium, then low
  const order: Record<DuplicateConfidence, number> = { high: 0, medium: 1, low: 2 };
  result.sort((a, b) => order[a.confidence] - order[b.confidence]);

  return result;
}

function classifyGroup(members: LibrarySong[]): DuplicateConfidence {
  // Check all pairs for composer similarity
  const withComposer = members.filter((m) => m.composer);

  if (withComposer.length >= 2) {
    // Check if any pair of composers fuzzy-match
    for (let i = 0; i < withComposer.length; i++) {
      for (let j = i + 1; j < withComposer.length; j++) {
        const sim = composerSimilarity(withComposer[i].composer!, withComposer[j].composer!);
        if (sim > 0.3) return "high";
      }
    }

    // All have composers but they don't match — genuinely different songs
    // Check if normalized composers are distinct
    const normComposers = new Set(withComposer.map((m) => normalizeComposer(m.composer!)));
    if (normComposers.size === withComposer.length) return "low";
  }

  // One has resources, other doesn't → medium
  const hasResources = members.some((m) => m.resources.length > 0);
  const lacksResources = members.some((m) => m.resources.length === 0);
  if (hasResources && lacksResources) return "medium";

  // Default: if some lack composer entirely, probably same song
  if (withComposer.length < members.length) return "medium";

  return "low";
}

/**
 * Junk pattern: composer field contains verse text, lectionary references,
 * or other non-composer content.
 */
const JUNK_COMPOSER_PATTERNS = [
  /\b(O\.T\.|N\.T\.|Cf\.)\b/i,
  /\b\d+:\d+/,                          // scripture citations like "23:1-6"
  /\b(talk to presider|if needed)\b/i,
  /\b(verse|antiphon|refrain)\b/i,
  /\b(see|lectionary|sacramentary)\b/i,
];

/**
 * Detect entries where the composer field contains non-composer text.
 */
export function detectJunkEntries(songs: LibrarySong[]): JunkEntry[] {
  const results: JunkEntry[] = [];

  for (const song of songs) {
    if (!song.composer) continue;

    for (const pattern of JUNK_COMPOSER_PATTERNS) {
      if (pattern.test(song.composer)) {
        results.push({
          id: song.id,
          title: song.title,
          composer: song.composer,
          reason: `Composer field matches junk pattern: ${pattern.source}`,
        });
        break;
      }
    }
  }

  return results;
}
