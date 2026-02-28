export const dynamic = "force-dynamic";

import { getSongLibrary } from "@/lib/song-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectDuplicateGroups, detectJunkEntries } from "@/lib/duplicate-detection";
import DuplicateReviewShell from "@/components/admin/DuplicateReviewShell";

export default async function DuplicatesPage() {
  const songs = getSongLibrary();
  const groups = detectDuplicateGroups(songs);
  const junk = detectJunkEntries(songs);

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
