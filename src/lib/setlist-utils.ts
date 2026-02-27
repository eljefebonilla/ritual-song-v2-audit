import type { MusicPlan, LiturgicalOccasion, SongEntry } from "./types";
import type {
  SetlistSongRow,
  SetlistSongEntry,
  SetlistPersonnel,
  BookingSlot,
} from "./booking-types";

/**
 * Maps a MusicPlan field to a SetlistSongEntry.
 */
function songEntryToSetlist(song?: SongEntry): SetlistSongEntry[] {
  if (!song || !song.title) return [];
  return [
    {
      title: song.title,
      composer: song.composer,
    },
  ];
}

/**
 * Standard setlist positions for a typical Mass.
 */
const STANDARD_POSITIONS: { position: string; label: string }[] = [
  { position: "prelude", label: "Prelude" },
  { position: "gathering", label: "Gathering" },
  { position: "penitential_act", label: "Penitential Act" },
  { position: "gloria", label: "Gloria" },
  { position: "psalm", label: "Responsorial Psalm" },
  { position: "gospel_acclamation", label: "Gospel Acclamation" },
  { position: "offertory", label: "Offertory" },
  { position: "holy", label: "Holy, Holy, Holy" },
  { position: "memorial", label: "Memorial Acclamation" },
  { position: "amen", label: "Great Amen" },
  { position: "lords_prayer", label: "The Lord's Prayer" },
  { position: "fraction_rite", label: "Lamb of God" },
  { position: "communion_1", label: "Communion" },
  { position: "communion_2", label: "Communion 2" },
  { position: "communion_3", label: "Communion 3" },
  { position: "sending", label: "Sending Forth" },
];

/**
 * Bootstraps a setlist from an occasion's music plan.
 * Uses extractCellData-style logic to pull songs from the plan.
 */
export function bootstrapSongsFromPlan(
  plan: MusicPlan | null
): SetlistSongRow[] {
  if (!plan) {
    return STANDARD_POSITIONS.map(({ position, label }) => ({
      position,
      label,
      songs: [],
    }));
  }

  const rows: SetlistSongRow[] = [];

  rows.push({
    position: "prelude",
    label: "Prelude",
    songs: songEntryToSetlist(plan.prelude),
  });
  rows.push({
    position: "gathering",
    label: "Gathering",
    songs: songEntryToSetlist(plan.gathering),
  });
  rows.push({
    position: "penitential_act",
    label: "Penitential Act",
    songs: songEntryToSetlist(plan.penitentialAct),
  });
  rows.push({
    position: "gloria",
    label: "Gloria",
    songs: songEntryToSetlist(plan.gloria),
  });

  // Psalm
  if (plan.responsorialPsalm) {
    rows.push({
      position: "psalm",
      label: "Responsorial Psalm",
      songs: [
        {
          title: plan.responsorialPsalm.psalm,
          composer: plan.responsorialPsalm.setting,
        },
      ],
    });
  } else {
    rows.push({ position: "psalm", label: "Responsorial Psalm", songs: [] });
  }

  // Gospel Acclamation
  if (plan.gospelAcclamation) {
    rows.push({
      position: "gospel_acclamation",
      label: "Gospel Acclamation",
      songs: [
        {
          title: plan.gospelAcclamation.title,
          composer: plan.gospelAcclamation.composer,
        },
      ],
    });
  } else {
    rows.push({
      position: "gospel_acclamation",
      label: "Gospel Acclamation",
      songs: [],
    });
  }

  rows.push({
    position: "offertory",
    label: "Offertory",
    songs: songEntryToSetlist(plan.offertory),
  });

  // Eucharistic acclamations
  const massSetting = plan.eucharisticAcclamations;
  if (massSetting) {
    const entry: SetlistSongEntry = {
      title: massSetting.massSettingName,
      composer: massSetting.composer,
    };
    rows.push({ position: "holy", label: "Holy, Holy, Holy", songs: [entry] });
    rows.push({
      position: "memorial",
      label: "Memorial Acclamation",
      songs: [entry],
    });
    rows.push({ position: "amen", label: "Great Amen", songs: [entry] });
  } else {
    rows.push({ position: "holy", label: "Holy, Holy, Holy", songs: [] });
    rows.push({
      position: "memorial",
      label: "Memorial Acclamation",
      songs: [],
    });
    rows.push({ position: "amen", label: "Great Amen", songs: [] });
  }

  rows.push({
    position: "lords_prayer",
    label: "The Lord's Prayer",
    songs: songEntryToSetlist(plan.lordsPrayer),
  });
  rows.push({
    position: "fraction_rite",
    label: "Lamb of God",
    songs: songEntryToSetlist(plan.fractionRite),
  });

  // Communion songs (up to 3)
  const communionSongs = plan.communionSongs || [];
  for (let i = 0; i < 3; i++) {
    rows.push({
      position: `communion_${i + 1}`,
      label: i === 0 ? "Communion" : `Communion ${i + 1}`,
      songs: songEntryToSetlist(communionSongs[i]),
    });
  }

  rows.push({
    position: "sending",
    label: "Sending Forth",
    songs: songEntryToSetlist(plan.sending),
  });

  return rows;
}

/**
 * Builds personnel footer from confirmed booking slots.
 */
export function buildPersonnelFromSlots(
  slots: BookingSlot[]
): SetlistPersonnel[] {
  const confirmed = slots.filter(
    (s) => s.confirmation === "confirmed" || s.confirmation === "expected"
  );

  // Sort by role sort_order, then slot_order
  confirmed.sort((a, b) => {
    const aOrder = a.ministry_role?.sort_order ?? 99;
    const bOrder = b.ministry_role?.sort_order ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.slot_order - b.slot_order;
  });

  // Split into left (instruments) and right (vocals/other)
  const leftRoles = new Set([
    "Piano",
    "A. Guitar",
    "E. Guitar",
    "E. Bass",
    "Drums/Percussion",
    "Other",
  ]);

  return confirmed.map((slot) => {
    const roleName = slot.ministry_role?.name || "Unknown";
    return {
      person_name: slot.profile?.full_name || slot.person_name || "TBD",
      profile_id: slot.profile_id || undefined,
      role_label: slot.role_label_override || roleName,
      side: leftRoles.has(roleName) ? "left" : "right",
    };
  });
}

/**
 * Full bootstrap: creates a setlist from occasion + booking slots.
 */
export function bootstrapSetlist(
  occasion: LiturgicalOccasion | null,
  communityId: string | null,
  bookingSlots: BookingSlot[]
): {
  songs: SetlistSongRow[];
  personnel: SetlistPersonnel[];
  occasion_name: string | null;
  occasion_id: string | null;
} {
  let plan: MusicPlan | null = null;
  if (occasion && communityId) {
    plan =
      occasion.musicPlans.find(
        (p) => p.communityId === communityId.toLowerCase()
      ) || null;
  }

  return {
    songs: bootstrapSongsFromPlan(plan),
    personnel: buildPersonnelFromSlots(bookingSlots),
    occasion_name: occasion?.name || null,
    occasion_id: occasion?.id || null,
  };
}
