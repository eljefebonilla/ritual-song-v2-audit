import { NextRequest, NextResponse } from "next/server";
import { getSongLibrary, invalidateSongLibraryCache } from "@/lib/song-library";
import { createAdminClient, resolveSongUuid } from "@/lib/supabase/admin";
import { detectDuplicateGroups, detectJunkEntries } from "@/lib/duplicate-detection";
import { getAllFullOccasions } from "@/lib/data";
import { extractSongEntries, normalizeTitle } from "@/lib/occasion-helpers";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const SONG_LIBRARY_PATH = path.join(process.cwd(), "src/data/song-library.json");

/**
 * Verify admin via Supabase service role (works on Vercel unlike verifyAdmin).
 */
async function checkAdmin(request: NextRequest): Promise<boolean> {
  if (process.env.NODE_ENV === "development") return true;

  // Check for Supabase auth token in cookie
  const supabase = createAdminClient();
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return profile?.role === "admin";
  }

  return false;
}

/**
 * GET /api/songs/duplicates — Returns duplicate groups and junk entries
 */
export async function GET() {
  try {
    const allSongs = getSongLibrary();
    const songs = allSongs.filter(s => s.category === "song" || s.category === "mass_part");
    const groups = detectDuplicateGroups(songs);
    const junk = detectJunkEntries(songs);

    // --- Enrich duplicate groups with per-ensemble usage ---
    // Build reverse index: songKey → songId for all songs in duplicate groups
    const songKeyToId = new Map<string, string>();
    for (const group of groups) {
      for (const song of group.songs) {
        const base = normalizeTitle(song.title);
        const key = song.composer ? `${base}|||${song.composer.toLowerCase()}` : base;
        songKeyToId.set(key, song.id);
      }
    }

    // Count per-ensemble usage from all occasion music plans
    const ensembleUsageMap = new Map<string, Record<string, number>>();
    const allOccasions = getAllFullOccasions();

    for (const occasion of allOccasions) {
      for (const plan of occasion.musicPlans) {
        const ensembleId = plan.ensembleId;

        // Standard song entries (gathering, offertory, communion, etc.)
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

        // Responsorial psalm setting
        if (plan.responsorialPsalm?.setting) {
          const key = normalizeTitle(plan.responsorialPsalm.setting);
          const songId = songKeyToId.get(key);
          if (songId) {
            if (!ensembleUsageMap.has(songId)) ensembleUsageMap.set(songId, {});
            const usage = ensembleUsageMap.get(songId)!;
            usage[ensembleId] = (usage[ensembleId] || 0) + 1;
          }
        }

        // Eucharistic acclamations (mass settings)
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

    // Attach computed ensemble usage to each song
    for (const group of groups) {
      for (const song of group.songs) {
        song.ensembleUsage = ensembleUsageMap.get(song.id) || {};
      }
    }

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

    const filteredGroups = groups.filter((g) => {
      // Check if ALL pairs in the group have been dismissed
      const ids = g.songs.map((s) => s.id);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          if (!dismissedPairs.has(`${ids[i]}::${ids[j]}`)) return true;
        }
      }
      return false;
    });

    return NextResponse.json({
      groups: filteredGroups,
      junk,
      stats: {
        totalGroups: groups.length,
        filteredGroups: filteredGroups.length,
        dismissedCount: groups.length - filteredGroups.length,
        junkCount: junk.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/songs/duplicates — Merge two songs
 * Body: { primaryId, secondaryId }
 */
export async function POST(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { primaryId, secondaryId } = await request.json();
  if (!primaryId || !secondaryId) {
    return NextResponse.json({ error: "primaryId and secondaryId required" }, { status: 400 });
  }

  try {
    const raw = fs.readFileSync(SONG_LIBRARY_PATH, "utf-8");
    const library = JSON.parse(raw);

    const primaryIdx = library.findIndex((s: { id: string }) => s.id === primaryId);
    const secondaryIdx = library.findIndex((s: { id: string }) => s.id === secondaryId);

    if (primaryIdx === -1 || secondaryIdx === -1) {
      return NextResponse.json({ error: "Song not found" }, { status: 404 });
    }

    const primary = library[primaryIdx];
    const secondary = library[secondaryIdx];

    // Capture pre-mutation state for undo
    const preMergePrimary = JSON.parse(JSON.stringify(primary));
    const removedSong = JSON.parse(JSON.stringify(secondary));

    // Combine resources (dedup by id)
    const existingResourceIds = new Set(primary.resources.map((r: { id: string }) => r.id));
    for (const r of secondary.resources) {
      if (!existingResourceIds.has(r.id)) {
        primary.resources.push(r);
      }
    }

    // Combine occasions (dedup)
    const occasionSet = new Set([...primary.occasions, ...secondary.occasions]);
    primary.occasions = [...occasionSet];

    // Sum usageCount
    primary.usageCount += secondary.usageCount;

    // Update Supabase song_resources_v2 to point to primary
    const supabase = createAdminClient();
    const primaryUuid = await resolveSongUuid(supabase, primaryId);
    const secondaryUuid = await resolveSongUuid(supabase, secondaryId);
    if (primaryUuid && secondaryUuid) {
      await supabase
        .from("song_resources_v2")
        .update({ song_id: primaryUuid })
        .eq("song_id", secondaryUuid);
    }

    // Update music_plan_edits — replace secondary title with primary
    const SONG_FIELDS = [
      "prelude", "gathering", "penitentialAct", "gloria",
      "gospelAcclamation", "offertory", "lordsPrayer",
      "fractionRite", "sending", "communionSongs",
    ];
    const { data: planRows } = await supabase
      .from("music_plan_edits")
      .select("occasion_id, ensemble_id, field, value")
      .in("field", SONG_FIELDS);

    let updatedOverrides = 0;
    if (planRows) {
      for (const row of planRows) {
        const val = row.value;
        if (!val) continue;
        let changed = false;

        if (row.field === "communionSongs" && Array.isArray(val)) {
          for (const entry of val) {
            if (entry?.title === secondary.title) {
              entry.title = primary.title;
              entry.composer = primary.composer || undefined;
              changed = true;
            }
          }
        } else if (val.title === secondary.title) {
          val.title = primary.title;
          val.composer = primary.composer || undefined;
          changed = true;
        }

        if (changed) {
          await supabase.from("music_plan_edits").upsert(
            {
              occasion_id: row.occasion_id,
              ensemble_id: row.ensemble_id,
              field: row.field,
              value: val,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "occasion_id,ensemble_id,field" }
          );
          updatedOverrides++;
        }
      }
    }

    // Record the merge decision
    await supabase.from("song_merge_decisions").insert({
      song_id_a: primaryId,
      song_id_b: secondaryId,
      decision: "merged",
    });

    // Remove secondary from library
    library.splice(secondaryIdx, 1);
    fs.writeFileSync(SONG_LIBRARY_PATH, JSON.stringify(library, null, 2), "utf-8");

    // Invalidate cache
    invalidateSongLibraryCache();

    return NextResponse.json({
      merged: primary,
      removedId: secondaryId,
      removedSong,
      preMergePrimary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/songs/duplicates — Dismiss a duplicate group
 * Body: { songIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { songIds } = await request.json();
  if (!songIds || songIds.length < 2) {
    return NextResponse.json({ error: "At least 2 songIds required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const inserts = [];
  for (let i = 0; i < songIds.length; i++) {
    for (let j = i + 1; j < songIds.length; j++) {
      inserts.push({
        song_id_a: songIds[i],
        song_id_b: songIds[j],
        decision: "dismissed",
      });
    }
  }

  const { error } = await supabase.from("song_merge_decisions").insert(inserts);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dismissed: songIds });
}
