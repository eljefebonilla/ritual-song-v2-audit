import type {
  MusicPlan,
  Reading,
  Antiphon,
  OccasionResource,
  ResolvedSong,
  WorshipSlot,
  SlotKind,
  CustomSlotRow,
} from "./types";
import { normalizeTitle } from "./occasion-helpers";

/**
 * Strip messy prefixes from antiphon citations.
 * e.g. "Communion Antiphon • Option II | Cf. Ps 91 (90):4" → "Cf. Ps 91 (90):4"
 *      "Communion Antiphon | Acts 2:4, 11" → "Acts 2:4, 11"
 *      "Cf. Mt 4:4" → "Cf. Mt 4:4" (no change)
 */
function cleanCitation(citation: string): string {
  // Strip patterns like "Communion Antiphon • Option II | " or "Communion Antiphon | "
  const pipeIdx = citation.indexOf("|");
  if (pipeIdx !== -1 && /antiphon/i.test(citation.slice(0, pipeIdx))) {
    return citation.slice(pipeIdx + 1).trim();
  }
  // Strip "Roman Missal — " prefix
  const dashIdx = citation.indexOf("—");
  if (dashIdx !== -1 && /roman missal/i.test(citation.slice(0, dashIdx))) {
    return citation.slice(dashIdx + 1).trim();
  }
  return citation;
}

/**
 * Match an audio resource to a specific antiphon by comparing the label text
 * (after stripping the "Entrance:" or "Communion:" prefix) to the antiphon text.
 */
function matchResourceToAntiphon(
  resource: OccasionResource,
  antiphon: Antiphon,
): boolean {
  if (resource.type !== "audio") return false;
  // Strip "Entrance: " or "Communion: " prefix
  const labelText = resource.label.replace(/^(entrance|communion):\s*/i, "").toLowerCase().trim();
  if (!labelText) return false;
  // Compare to the beginning of the antiphon text (normalized)
  const antiphonStart = antiphon.text.toLowerCase().replace(/\n/g, " ").trim();
  return antiphonStart.startsWith(labelText);
}

export const SECTION_LABELS: Record<WorshipSlot["section"], string> = {
  pre_mass: "Pre-Mass",
  introductory: "Introductory Rites",
  word: "Liturgy of the Word",
  eucharist: "Liturgy of the Eucharist",
  concluding: "The Concluding Rites",
};

let _slotId = 0;
function nextId(): string {
  return `slot-${++_slotId}`;
}

/**
 * Convert a MusicPlan + occasion data into an ordered WorshipSlot array.
 * Skips slots where there is no data.
 *
 * slotLabelOverrides: optional map of role → custom label (e.g. Easter Vigil:
 * prelude → "Procession of the Candle", gathering → "Exultet")
 */
export function planToSlots(
  plan: MusicPlan,
  readings?: Reading[],
  antiphons?: Antiphon[],
  occasionResources?: OccasionResource[],
  resolvedSongs?: Record<string, ResolvedSong>,
  slotLabelOverrides?: Record<string, string>,
): WorshipSlot[] {
  _slotId = 0;
  const slots: WorshipSlot[] = [];

  /** Return the override label for a role, or the default. */
  function lbl(role: string, defaultLabel: string): string {
    return slotLabelOverrides?.[role] ?? defaultLabel;
  }

  function resolve(title: string): ResolvedSong | undefined {
    return resolvedSongs?.[normalizeTitle(title)];
  }

  // --- PRE-MASS ---
  if (plan.prelude) {
    slots.push({
      id: nextId(),
      section: "pre_mass",
      role: "prelude",
      label: lbl("prelude", "Prelude"),
      kind: "song",
      order: 1000,
      song: plan.prelude,
      resolvedSong: resolve(plan.prelude.title),
    });
  }

  // --- INTRODUCTORY RITES ---
  // Entrance antiphons
  const entranceAntiphons = antiphons?.filter((a) => a.type === "entrance") ?? [];
  const allAntiphonResources = occasionResources?.filter(
    (r) => r.category === "antiphon"
  ) ?? [];

  // Split antiphon resources: "Entrance:" audio → entrance, "Communion:" audio → communion, PDFs → both
  const entranceAntiphonResources = allAntiphonResources.filter(
    (r) => r.type === "sheet_music" || /^entrance:/i.test(r.label)
  );
  const communionAntiphonResources = allAntiphonResources.filter(
    (r) => r.type === "sheet_music" || /^communion:/i.test(r.label)
  );

  if (entranceAntiphons.length > 0) {
    const hasMultipleEntrance = entranceAntiphons.length > 1;
    for (let i = 0; i < entranceAntiphons.length; i++) {
      const ant = entranceAntiphons[i];
      // Match audio resource to this specific antiphon; sheet music goes to all
      const matchedResources = entranceAntiphonResources.filter(
        (r) => r.type === "sheet_music" || matchResourceToAntiphon(r, ant),
      );
      slots.push({
        id: nextId(),
        section: "introductory",
        role: "entrance_antiphon",
        label: "Entrance Antiphon",
        kind: "antiphon",
        order: 1500 + i * 10,
        antiphon: { ...ant, citation: cleanCitation(ant.citation) },
        optionNumber: hasMultipleEntrance ? ant.option : undefined,
        resources: matchedResources.length > 0 ? matchedResources : undefined,
      });
    }
  }

  if (plan.gathering) {
    slots.push({
      id: nextId(),
      section: "introductory",
      role: "gathering",
      label: lbl("gathering", "Gathering"),
      kind: "song",
      order: 2000,
      song: plan.gathering,
      resolvedSong: resolve(plan.gathering.title),
    });
  }

  if (plan.penitentialAct) {
    slots.push({
      id: nextId(),
      section: "introductory",
      role: "penitential_act",
      label: "Penitential Act",
      kind: "song",
      order: 2500,
      song: plan.penitentialAct,
      resolvedSong: resolve(plan.penitentialAct.title),
    });
  }

  if (plan.gloria) {
    slots.push({
      id: nextId(),
      section: "introductory",
      role: "gloria",
      label: "Gloria",
      kind: "song",
      order: 3000,
      song: plan.gloria,
      resolvedSong: resolve(plan.gloria.title),
    });
  }

  // --- LITURGY OF THE WORD ---
  const firstReading = readings?.find((r) => r.type === "first");
  if (firstReading) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "first_reading",
      label: "1st Reading",
      kind: "reading",
      order: 4000,
      reading: firstReading,
    });
  }

  // Responsorial Psalm
  const psalmReading = readings?.find((r) => r.type === "psalm");
  // Extract psalm number from the reading citation (e.g. "Ps 31:2, 6..." → "Psalm 31")
  const psalmNumMatch = psalmReading?.citation.match(/Ps(?:alm)?\.?\s*(\d+)/i);
  const psalmLabel = psalmNumMatch ? `Psalm ${psalmNumMatch[1]}` : "Psalm";
  if (plan.responsorialPsalm) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "responsorial_psalm",
      label: psalmLabel,
      kind: "song",
      order: 5000,
      psalm: plan.responsorialPsalm,
      song: { title: plan.responsorialPsalm.psalm, description: plan.responsorialPsalm.setting },
      resolvedSong: resolve(plan.responsorialPsalm.psalm),
      reading: psalmReading,
    });
  } else if (psalmReading) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "responsorial_psalm",
      label: psalmLabel,
      kind: "reading",
      order: 5000,
      reading: psalmReading,
    });
  }

  const secondReading = readings?.find((r) => r.type === "second");
  if (secondReading) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "second_reading",
      label: "2nd Reading",
      kind: "reading",
      order: 6000,
      reading: secondReading,
    });
  }

  // Gospel Acclamation — compound slot (setting + verse)
  const gaResources = occasionResources?.filter(
    (r) => r.category === "gospel_acclamation"
  ) ?? [];
  // Untagged GA resources are verse recordings (bespoke per-week from Lyric Psalter etc.)
  // Refrain audio comes from the resolved library song, not occasion resources.
  const gaRefrainResources = gaResources.filter(
    (r) => r.subcategory === "refrain"
  );
  const gaVerseResources = gaResources.filter(
    (r) => !r.subcategory || r.subcategory === "verse" || r.subcategory === "combined"
  );
  const gospelVerse = readings?.find((r) => r.type === "gospel_verse");

  if (plan.gospelAcclamation) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "gospel_acclamation",
      label: "Gospel Accl.",
      kind: "song",
      order: 7000,
      gospelAcclamation: {
        title: plan.gospelAcclamation.title,
        composer: plan.gospelAcclamation.composer,
        verse: plan.gospelAcclamation.verse,
      },
      song: {
        title: plan.gospelAcclamation.title,
        composer: plan.gospelAcclamation.composer,
      },
      resolvedSong: resolve(plan.gospelAcclamation.title),
      resources: gaRefrainResources.length > 0 ? gaRefrainResources : undefined,
    });
  } else if (gaResources.length > 0 || gospelVerse) {
    // No setting assigned — show verse + resources as read-only
    slots.push({
      id: nextId(),
      section: "word",
      role: "gospel_acclamation",
      label: "Gospel Accl.",
      kind: "resource",
      order: 7000,
      resources: gaRefrainResources.length > 0 ? gaRefrainResources : undefined,
      reading: gospelVerse,
    });
  }

  // Gospel Verse — separate row below the acclamation
  if (gospelVerse) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "gospel_verse",
      label: "Gospel Verse",
      kind: "reading",
      order: 7500,
      reading: gospelVerse,
      resources: gaVerseResources.length > 0 ? gaVerseResources : undefined,
    });
  }

  // Gospel
  const gospel = readings?.find((r) => r.type === "gospel");
  if (gospel) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "gospel",
      label: "Gospel",
      kind: "reading",
      order: 8000,
      reading: gospel,
    });
  }

  // --- LITURGY OF THE EUCHARIST ---
  if (plan.offertory) {
    slots.push({
      id: nextId(),
      section: "eucharist",
      role: "offertory",
      label: "Offertory",
      kind: "song",
      order: 10000,
      song: plan.offertory,
      resolvedSong: resolve(plan.offertory.title),
    });
  }

  if (plan.eucharisticAcclamations) {
    slots.push({
      id: nextId(),
      section: "eucharist",
      role: "mass_setting",
      label: "Mass Setting",
      kind: "mass_setting",
      order: 11000,
      massSetting: {
        name: plan.eucharisticAcclamations.massSettingName,
        composer: plan.eucharisticAcclamations.composer,
      },
    });
  }

  if (plan.lordsPrayer) {
    slots.push({
      id: nextId(),
      section: "eucharist",
      role: "lords_prayer",
      label: "Lord's Prayer",
      kind: "song",
      order: 12000,
      song: plan.lordsPrayer,
      resolvedSong: resolve(plan.lordsPrayer.title),
    });
  }

  if (plan.fractionRite) {
    slots.push({
      id: nextId(),
      section: "eucharist",
      role: "fraction_rite",
      label: "Fraction Rite",
      kind: "song",
      order: 13000,
      song: plan.fractionRite,
      resolvedSong: resolve(plan.fractionRite.title),
    });
  }

  // Communion antiphons (at top of communion, before communion songs)
  const communionAntiphons = antiphons?.filter((a) => a.type === "communion") ?? [];
  if (communionAntiphons.length > 0) {
    const hasMultipleCommunion = communionAntiphons.length > 1;
    for (let i = 0; i < communionAntiphons.length; i++) {
      const ant = communionAntiphons[i];
      // Match audio resource to this specific antiphon; sheet music goes to all
      const matchedResources = communionAntiphonResources.filter(
        (r) => r.type === "sheet_music" || matchResourceToAntiphon(r, ant),
      );
      slots.push({
        id: nextId(),
        section: "eucharist",
        role: "communion_antiphon",
        label: "Comm. Antiphon",
        kind: "antiphon",
        order: 14000 + i * 10,
        antiphon: { ...ant, citation: cleanCitation(ant.citation) },
        optionNumber: hasMultipleCommunion ? ant.option : undefined,
        resources: matchedResources.length > 0 ? matchedResources : undefined,
      });
    }
  }

  if (plan.communionSongs) {
    for (let i = 0; i < plan.communionSongs.length; i++) {
      const s = plan.communionSongs[i];
      slots.push({
        id: nextId(),
        section: "eucharist",
        role: `communion_${i}`,
        label: i === 0 ? "Communion" : `Comm. ${i + 1}`,
        kind: "song",
        order: 15000 + i * 100,
        song: s,
        resolvedSong: resolve(s.title),
      });
    }
  }

  // --- CONCLUDING RITES ---
  if (plan.sending) {
    slots.push({
      id: nextId(),
      section: "concluding",
      role: "sending",
      label: "Sending",
      kind: "song",
      order: 16000,
      song: plan.sending,
      resolvedSong: resolve(plan.sending.title),
    });
  }

  return slots;
}

// --- Custom slot helpers ---

function inferSection(orderPosition: number): WorshipSlot['section'] {
  if (orderPosition < 2000) return 'pre_mass';
  if (orderPosition < 4000) return 'introductory';
  if (orderPosition < 9000) return 'word';
  if (orderPosition < 16000) return 'eucharist';
  return 'concluding';
}

function mapSlotType(slotType: string): SlotKind {
  switch (slotType) {
    case 'mass_part': return 'mass_setting';
    case 'ritual_moment': return 'ritual_moment';
    case 'reading': return 'reading';
    case 'note': return 'note';
    case 'song': return 'song';
    default: return 'note';
  }
}

/**
 * Merge custom slots (from Supabase) into the base slot array.
 * Custom slots are converted to WorshipSlot format and interleaved by order.
 */
export function mergeCustomSlots(
  baseSlots: WorshipSlot[],
  customSlots: CustomSlotRow[],
): WorshipSlot[] {
  if (!customSlots || customSlots.length === 0) return baseSlots;

  const customWorshipSlots: WorshipSlot[] = customSlots.map((cs) => ({
    id: `custom-${cs.id}`,
    section: inferSection(cs.order_position),
    role: cs.slot_type,
    label: cs.label,
    kind: mapSlotType(cs.slot_type),
    order: cs.order_position,
    // Map content fields based on type
    ...(cs.slot_type === 'song' && cs.content.title ? {
      song: { title: cs.content.title as string, composer: cs.content.composer as string | undefined },
    } : {}),
    ...(cs.slot_type === 'reading' && cs.content.citation ? {
      reading: { type: 'custom' as Reading['type'], citation: cs.content.citation as string, summary: (cs.content.text as string) || '' },
    } : {}),
    ...(cs.slot_type === 'mass_part' ? {
      massSetting: { name: (cs.content.name as string) || cs.label, composer: cs.content.composer as string | undefined },
    } : {}),
    // Store full custom content for rendering
    customContent: cs.content,
    customSlotId: cs.id,
    isCustom: true,
  }));

  const merged = [...baseSlots, ...customWorshipSlots];
  merged.sort((a, b) => a.order - b.order);
  return merged;
}
