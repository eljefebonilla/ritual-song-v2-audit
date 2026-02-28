import type {
  MusicPlan,
  Reading,
  Antiphon,
  OccasionResource,
  ResolvedSong,
  WorshipSlot,
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
 */
export function planToSlots(
  plan: MusicPlan,
  readings?: Reading[],
  antiphons?: Antiphon[],
  occasionResources?: OccasionResource[],
  resolvedSongs?: Record<string, ResolvedSong>,
): WorshipSlot[] {
  _slotId = 0;
  const slots: WorshipSlot[] = [];

  function resolve(title: string): ResolvedSong | undefined {
    return resolvedSongs?.[normalizeTitle(title)];
  }

  // --- PRE-MASS ---
  if (plan.prelude) {
    slots.push({
      id: nextId(),
      section: "pre_mass",
      role: "prelude",
      label: "Prelude",
      kind: "song",
      order: 0,
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
        order: i,
        antiphon: { ...ant, citation: cleanCitation(ant.citation) },
        optionNumber: hasMultipleEntrance ? ant.option : undefined,
        resources: matchedResources.length > 0 ? matchedResources : undefined,
      });
    }
  }

  let introOrder = entranceAntiphons.length;

  if (plan.gathering) {
    slots.push({
      id: nextId(),
      section: "introductory",
      role: "gathering",
      label: "Gathering",
      kind: "song",
      order: introOrder++,
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
      order: introOrder++,
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
      order: introOrder++,
      song: plan.gloria,
      resolvedSong: resolve(plan.gloria.title),
    });
  }

  // --- LITURGY OF THE WORD ---
  let wordOrder = 0;

  const firstReading = readings?.find((r) => r.type === "first");
  if (firstReading) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "first_reading",
      label: "1st Reading",
      kind: "reading",
      order: wordOrder++,
      reading: firstReading,
    });
  }

  // Responsorial Psalm
  const psalmReading = readings?.find((r) => r.type === "psalm");
  if (plan.responsorialPsalm) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "responsorial_psalm",
      label: "Psalm",
      kind: "song",
      order: wordOrder++,
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
      label: "Psalm",
      kind: "reading",
      order: wordOrder++,
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
      order: wordOrder++,
      reading: secondReading,
    });
  }

  // Gospel Acclamation
  const gaResources = occasionResources?.filter(
    (r) => r.category === "gospel_acclamation"
  ) ?? [];
  const gospelVerse = readings?.find((r) => r.type === "gospel_verse");

  if (plan.gospelAcclamation) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "gospel_acclamation",
      label: "Gospel Accl.",
      kind: "song",
      order: wordOrder++,
      song: {
        title: plan.gospelAcclamation.title,
        composer: plan.gospelAcclamation.composer,
        description: plan.gospelAcclamation.verse,
      },
      resolvedSong: resolve(plan.gospelAcclamation.title),
      resources: gaResources.length > 0 ? gaResources : undefined,
      reading: gospelVerse,
    });
  } else if (gaResources.length > 0) {
    slots.push({
      id: nextId(),
      section: "word",
      role: "gospel_acclamation",
      label: "Gospel Accl.",
      kind: "resource",
      order: wordOrder++,
      resources: gaResources,
      reading: gospelVerse,
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
      order: wordOrder++,
      reading: gospel,
    });
  }

  // --- LITURGY OF THE EUCHARIST ---
  let euchOrder = 0;

  if (plan.offertory) {
    slots.push({
      id: nextId(),
      section: "eucharist",
      role: "offertory",
      label: "Offertory",
      kind: "song",
      order: euchOrder++,
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
      order: euchOrder++,
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
      order: euchOrder++,
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
      order: euchOrder++,
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
        order: euchOrder++,
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
        role: "communion",
        label: i === 0 ? "Communion" : `Comm. ${i + 1}`,
        kind: "song",
        order: euchOrder++,
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
      order: 0,
      song: plan.sending,
      resolvedSong: resolve(plan.sending.title),
    });
  }

  return slots;
}
