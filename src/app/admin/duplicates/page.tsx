export const dynamic = "force-dynamic";

import { getSongLibrary } from "@/lib/song-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectDuplicateGroups, detectJunkEntries } from "@/lib/duplicate-detection";
import { getAllFullOccasions } from "@/lib/data";
import { extractSongEntries, normalizeTitle } from "@/lib/occasion-helpers";
import DuplicateReviewShell from "@/components/admin/DuplicateReviewShell";

export default async function DuplicatesPage() {
  const allSongs = getSongLibrary();
  const groups = detectDuplicateGroups(allSongs);
  const junk = detectJunkEntries(allSongs);

  // Enrich with per-ensemble usage
  const songKeyToId = new Map<string, string>();
  for (const group of groups) {
    for (const song of group.songs) {
      const base = normalizeTitle(song.title);
      const key = song.composer ? `${base}|||${song.composer.toLowerCase()}` : base;
      songKeyToId.set(key, song.id);
    }
  }

  const ensembleUsageMap = new Map<string, Record<string, number>>();
  const allOccasions = getAllFullOccasions();

  for (const occasion of allOccasions) {
    for (const plan of occasion.musicPlans) {
      const ensembleId = plan.ensembleId;

      for (const entry of extractSongEntries(plan)) {
        const base = normalizeTitle(entry.title);
        const key = entry.composer ? `${base}|||${entry.composer.toLowerCase()}` : base;
        const songId = songKeyToId.get(key);
        if (songId) {
          if (!ensembleUsageMap.has(songId)) ensembleUsageMap.set(songId, {});
          const usage = ensembleUsageMap.get(songId)!;
          usage[ensembleId] = (usage[ensembleId] || 0) + 1;
        }
      }

      if (plan.responsorialPsalm?.setting) {
        const key = normalizeTitle(plan.responsorialPsalm.setting);
        const songId = songKeyToId.get(key);
        if (songId) {
          if (!ensembleUsageMap.has(songId)) ensembleUsageMap.set(songId, {});
          const usage = ensembleUsageMap.get(songId)!;
          usage[ensembleId] = (usage[ensembleId] || 0) + 1;
        }
      }

      if (plan.eucharisticAcclamations) {
        const base = normalizeTitle(plan.eucharisticAcclamations.massSettingName);
        const key = plan.eucharisticAcclamations.composer
          ? `${base}|||${plan.eucharisticAcclamations.composer.toLowerCase()}`
          : base;
        const songId = songKeyToId.get(key);
        if (songId) {
          if (!ensembleUsageMap.has(songId)) ensembleUsageMap.set(songId, {});
          const usage = ensembleUsageMap.get(songId)!;
          usage[ensembleId] = (usage[ensembleId] || 0) + 1;
        }
      }
    }
  }

  for (const group of groups) {
    for (const song of group.songs) {
      song.ensembleUsage = ensembleUsageMap.get(song.id) || {};
    }
  }

  // Split songs used by multiple ensembles into separate entries
  // so each can be merged into the correct arrangement independently
  for (const group of groups) {
    const expanded: typeof group.songs = [];
    for (const song of group.songs) {
      const ensembles = Object.keys(song.ensembleUsage);
      if (ensembles.length > 1) {
        for (const ensembleId of ensembles) {
          expanded.push({
            ...song,
            _key: `${song.id}::${ensembleId}`,
            usageCount: song.ensembleUsage[ensembleId],
            ensembleUsage: { [ensembleId]: song.ensembleUsage[ensembleId] },
          });
        }
      } else {
        expanded.push(song);
      }
    }
    group.songs = expanded;
  }

  // Fetch dismissed pairs
  const supabase = createAdminClient();
  const { data: decisions } = await supabase
    .from("song_merge_decisions")
    .select("song_id_a, song_id_b, decision");

  const dismissedPairs = new Set<string>();
  if (decisions) {
    for (const d of decisions) {
      if (d.decision === "dismissed") {
        dismissedPairs.add(`${d.song_id_a}::${d.song_id_b}`);
        dismissedPairs.add(`${d.song_id_b}::${d.song_id_a}`);
      }
    }
  }

  // Filter out dismissed groups
  const filteredGroups = groups.filter((g) => {
    if (g.songs.length !== 2) return true;
    const key = `${g.songs[0].id}::${g.songs[1].id}`;
    return !dismissedPairs.has(key);
  });

  return (
    <div className="min-h-screen">
      <DuplicateReviewShell groups={filteredGroups} junk={junk} />
    </div>
  );
}
