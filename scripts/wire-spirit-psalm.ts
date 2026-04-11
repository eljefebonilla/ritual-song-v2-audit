/**
 * Wire Spirit & Psalm 2026 (Cycle A) YouTube videos to music_plan_edits
 * for Generations, Foundations, and Elevations ensembles.
 *
 * - Psalms → responsorialPsalm with youtubeUrl
 * - Gospel Acclamations → gospelAcclamation with youtubeUrl (combined refrain+verse)
 * - Removes verseStoragePath for these 3 ensembles
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { execFileSync } from "child_process";
import fs from "fs";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ENSEMBLES = ["foundations", "generations", "elevations"];
const OCCASIONS_DIR = "src/data/occasions";

// Hardcoded playlist data: [videoId, occasionName, type]
const PLAYLIST: [string, string, "psalm" | "ga"][] = [
  ["TAOCPA0sPNY", "Advent 1", "psalm"],
  ["E5BdwNy9TJg", "Advent 1", "ga"],
  ["WSRsoS3EXYo", "Advent 2", "psalm"],
  ["1rwBd7yqzko", "Advent 2", "ga"],
  ["2l8CsCTjjBQ", "Immaculate Conception", "psalm"],
  ["z2KmVufMpbk", "Immaculate Conception", "ga"],
  ["gz9D2g9NPkI", "Our Lady of Guadalupe", "psalm"],
  ["k_e5S6MlHhY", "Our Lady of Guadalupe", "ga"],
  ["yr88D32OQP0", "Advent 3", "psalm"],
  ["LjzKcCYuSUA", "Advent 3", "ga"],
  ["jm9YN3fyEDY", "Advent 4", "psalm"],
  ["yrJqiehjUgs", "Advent 4", "ga"],
  ["Y_JwlKHVbQ4", "Nativity Vigil", "psalm"],
  ["4iSye_mG2Og", "Nativity Vigil", "ga"],
  ["zERgew3ZDwQ", "Nativity Night", "psalm"],
  ["3D0cyNq_X94", "Nativity Night", "ga"],
  ["irCSpKpHy6Q", "Nativity Dawn", "psalm"],
  ["1ETMah5OhgU", "Nativity Dawn", "ga"],
  ["n6iYHOkJOX8", "Nativity Day", "psalm"],
  ["pwbk3qEsho0", "Nativity Day", "ga"],
  ["X3NM_ipSmWc", "Holy Family", "psalm"],
  ["P4zm7FHJnek", "Holy Family", "ga"],
  ["Sl5OMe2gEHQ", "Mary Mother of God", "psalm"],
  ["AOFPxGKZUqc", "Mary Mother of God", "ga"],
  ["EPxu5i9K8-A", "Epiphany", "psalm"],
  ["ap_ojBJfodU", "Epiphany", "ga"],
  ["GYL6B5nygf8", "Baptism of the Lord", "psalm"],
  ["gXDs1X9Hp-8", "Baptism of the Lord", "ga"],
  ["SnmKqZ4OxXc", "Ordinary Time 2", "psalm"],
  ["5yRoWDLwU-s", "Ordinary Time 2", "ga"],
  ["fsmS0G7zSLI", "Ordinary Time 3", "psalm"],
  ["qRNdxWUjjmE", "Ordinary Time 3", "ga"],
  ["MAyzzbPFeoY", "Ordinary Time 4", "psalm"],
  ["CZoYYAjxHqY", "Ordinary Time 4", "ga"],
  ["2b1fptSbTCU", "Ordinary Time 5", "psalm"],
  ["rdmu-etZYho", "Ordinary Time 5", "ga"],
  ["EvnPlXt0l4w", "Ordinary Time 6", "psalm"],
  ["Hp-p_Zha14k", "Ordinary Time 6", "ga"],
  ["6XEvKgBuTHg", "Ash Wednesday", "psalm"],
  ["bpWrlkLPVXs", "Ash Wednesday", "ga"],
  ["23H3yvJAhmY", "Lent 1", "psalm"],
  ["IUU2vempl8s", "Lent 1", "ga"],
  ["bZKTv0pLQFo", "Lent 2", "psalm"],
  ["7D_pBjDmC-o", "Lent 2", "ga"],
  ["bCYHqLybZCY", "Lent 3", "psalm"],
  ["O4_hdddBaHA", "Lent 3", "ga"],
  ["mgHZr21IH74", "Lent 4", "psalm"],
  ["vORUKLEGQRw", "Lent 4", "ga"],
  ["0CG6as5ZAXE", "Lent 5", "psalm"],
  ["v_jUxJyj0mg", "Lent 5", "ga"],
  ["LW8n2_grH90", "Palm Sunday", "psalm"],
  ["G5RmwTt8mbg", "Palm Sunday", "ga"],
  ["ti987YH3Ch0", "Holy Thursday", "psalm"],
  ["eghdBsjCoAw", "Holy Thursday", "ga"],
  ["Benrk3cZzKc", "Good Friday", "psalm"],
  ["MDDNvL0bLw8", "Good Friday", "ga"],
  ["jsG4Serb310", "Easter Sunday", "psalm"],
  ["Ni9Q3zq2r9M", "Easter Sunday", "ga"],
  ["j4Bkup8Rv78", "Easter 2", "psalm"],
  ["fEdm8J4k_LY", "Easter 2", "ga"],
  ["6rXWzD9Sme8", "Easter 3", "psalm"],
  ["ZbIWuCwPUl8", "Easter 3", "ga"],
  ["iIvKtjvkdYM", "Easter 4", "psalm"],
  ["ZGSHOv_c9Q4", "Easter 4", "ga"],
  ["bMfNpgMJdYw", "Easter 5", "psalm"],
  ["gZxg9EsRWZ0", "Easter 5", "ga"],
  ["UXBlLFCYaqM", "Easter 6", "psalm"],
  ["jqrYufITuNU", "Easter 6", "ga"],
  ["IVMQa-zeJe8", "Easter 7", "psalm"],
  ["AjaUUy-oQB4", "Easter 7", "ga"],
  ["_-tg_swblYM", "Ascension", "psalm"],
  ["zWCZCNnoZNI", "Ascension", "ga"],
  ["rK399sXaOuw", "Pentecost Sunday", "psalm"],
  ["FwNyPirVJ_M", "Pentecost Sunday", "ga"],
  ["TQ-r4y_tjNE", "Most Holy Trinity", "psalm"],
  ["19If1xWwMdQ", "Most Holy Trinity", "ga"],
  ["EiMf_D7xJ9A", "Corpus Christi", "psalm"],
  ["I565SlYf3pw", "Corpus Christi", "ga"],
  ["w7A0L9tcZls", "Ordinary Time 11", "psalm"],
  ["t_ZQVIUaC98", "Ordinary Time 11", "ga"],
  ["VMyVQggypmU", "Ordinary Time 12", "psalm"],
  ["qokxSRkmyTA", "Ordinary Time 12", "ga"],
  ["daATIYbGpl8", "Ordinary Time 13", "psalm"],
  ["Z8n9V-Hwf_s", "Ordinary Time 13", "ga"],
  ["zwlBFAGB2KY", "Ordinary Time 14", "psalm"],
  ["ACO28VBSFLo", "Ordinary Time 14", "ga"],
  ["Qv10JxijZYA", "Ordinary Time 15", "psalm"],
  ["fhPi4DP9Q1w", "Ordinary Time 15", "ga"],
  ["t1ruk5jgBeA", "Ordinary Time 16", "psalm"],
  ["HdFMDLEhwhs", "Ordinary Time 16", "ga"],
  ["tS0WEBHo02I", "Ordinary Time 17", "psalm"],
  ["ScRrgGMkQnE", "Ordinary Time 17", "ga"],
  ["p3cv9Jqb1_E", "Ordinary Time 18", "psalm"],
  ["9CrE7uMtsOw", "Ordinary Time 18", "ga"],
  ["Z_h6BPBFzDE", "Ordinary Time 19", "psalm"],
  ["e9rKmSPGhYc", "Ordinary Time 19", "ga"],
  ["hppRkbQdeg4", "Assumption Vigil", "psalm"],
  ["jlKGDer5xi8", "Assumption Vigil", "ga"],
  ["qYLHznuKwYY", "Assumption Day", "psalm"],
  ["3Ib07yy4le4", "Assumption Day", "ga"],
  ["UGGo2A_ni-0", "Ordinary Time 20", "psalm"],
  ["UVLqoe-f9GU", "Ordinary Time 20", "ga"],
  ["SXTVU1av9BM", "Ordinary Time 21", "psalm"],
  ["waUmG4J2ljo", "Ordinary Time 21", "ga"],
  ["H6msH-Eh75c", "Ordinary Time 22", "psalm"],
  ["EhT4lSi5M8c", "Ordinary Time 22", "ga"],
  ["z5qA93T04H8", "Ordinary Time 23", "psalm"],
  ["ph09uR37t70", "Ordinary Time 23", "ga"],
  ["YE1dQs9pE3k", "Ordinary Time 24", "psalm"],
  ["fp2iXcZmTNY", "Ordinary Time 24", "ga"],
  ["CkseryAUta8", "Ordinary Time 25", "psalm"],
  ["k8gWqVJxRF0", "Ordinary Time 25", "ga"],
  ["BK3N2DO-qXU", "Ordinary Time 26", "psalm"],
  ["NkwkvDxvRbI", "Ordinary Time 26", "ga"],
  ["yYjCaJkaVL4", "Ordinary Time 27", "psalm"],
  ["Pela-Su1BF8", "Ordinary Time 27", "ga"],
  ["UztWMbRADR0", "Ordinary Time 28", "psalm"],
  ["ueotGQxS2s8", "Ordinary Time 28", "ga"],
  ["RlLtJngnrf8", "Ordinary Time 29", "psalm"],
  ["6SCGueGNDOc", "Ordinary Time 29", "ga"],
  ["E6tCL_KcBnA", "Ordinary Time 30", "psalm"],
  ["YpCX-ANOpq8", "Ordinary Time 30", "ga"],
  ["r3Utu5jGMIs", "All Saints", "psalm"],
  ["Ko4lEU4qNAA", "All Saints", "ga"],
  ["KiyCFNPmKFc", "Ordinary Time 32", "psalm"],
  ["MffVR0VzVeY", "Ordinary Time 32", "ga"],
  ["jImImywyE9U", "Ordinary Time 33", "psalm"],
  ["MdyripgmFvI", "Ordinary Time 33", "ga"],
  ["zZm1AxVVYwY", "Christ the King", "psalm"],
  ["Rijv9K0zudE", "Christ the King", "ga"],
  ["vOBHwwdaM-A", "Thanksgiving", "psalm"],
  ["G66dHnwcBJI", "Thanksgiving", "ga"],
];

function occasionToId(name: string): string | null {
  const map: Record<string, string> = {
    "Advent 1": "advent-01-a",
    "Advent 2": "advent-02-a",
    "Advent 3": "advent-03-a",
    "Advent 4": "advent-04-a",
    "Immaculate Conception": "solemnity-immaculate-conception",
    "Our Lady of Guadalupe": "feast-our-lady-of-guadalupe-abc",
    "Nativity Vigil": "nativity",
    "Nativity Night": "nativity",
    "Nativity Dawn": "nativity",
    "Nativity Day": "nativity",
    "Holy Family": "holy-family-a",
    "Mary Mother of God": "jan-1-mary-mother-of-god-abc",
    "Epiphany": "the-epiphany-of-the-lord-abc",
    "Baptism of the Lord": "baptism-of-the-lord-a",
    "Ash Wednesday": "ash-wednesday",
    "Lent 1": "lent-01-a",
    "Lent 2": "lent-02-a",
    "Lent 3": "lent-03-a-first-scrutiny",
    "Lent 4": "lent-04-a",
    "Lent 5": "lent-05-a-third-scrutiny",
    "Palm Sunday": "palm-sunday-a",
    "Holy Thursday": "holy-thursday-lords-supper",
    "Good Friday": "good-friday-passion",
    "Easter Sunday": "easter-sunday-abc",
    "Easter 2": "easter-02-divine-mercy-a",
    "Easter 3": "easter-03-a",
    "Easter 4": "easter-04-a",
    "Easter 5": "easter-05-a",
    "Easter 6": "easter-06-a",
    "Easter 7": "easter-07-a",
    "Ascension": "ascension-a",
    "Pentecost Sunday": "pentecost-a",
    "Most Holy Trinity": "solemnity-most-holy-trinity-a",
    "Corpus Christi": "solemnity-body-blood-of-christ-a",
    "All Saints": "solemnity-nov-1-all-saints-abc",
    "Christ the King": "solemnity-christ-the-king-a",
    "Thanksgiving": "thanksgiving",
    "Assumption Vigil": "assumption-vigil-abc",
    "Assumption Day": "assumption-day-abc",
  };

  if (map[name]) return map[name];

  const otMatch = name.match(/^Ordinary Time (\d+)$/);
  if (otMatch) {
    const num = parseInt(otMatch[1], 10);
    const padded = String(num).padStart(2, "0");
    if (num === 3) return `ordinary-time-${padded}-a-word-of-god-sunday`;
    return `ordinary-time-${padded}-a`;
  }

  return null;
}

function getComposer(videoId: string): { composer: string; massSetting?: string } {
  try {
    const desc = execFileSync(
      "yt-dlp",
      ["--force-ipv4", "--print", "%(description)s", `https://www.youtube.com/watch?v=${videoId}`],
      { timeout: 15000 }
    ).toString();
    const composerMatch = desc.match(/Composed by (.+)/);
    const massMatch = desc.match(/Music: ([^;]+)/);
    return {
      composer: composerMatch?.[1]?.trim() || "Spirit & Psalm",
      massSetting: massMatch?.[1]?.trim(),
    };
  } catch {
    return { composer: "Spirit & Psalm" };
  }
}

function getPsalmLabel(occasionId: string): string | null {
  const fpath = `${OCCASIONS_DIR}/${occasionId}.json`;
  if (!fs.existsSync(fpath)) return null;
  const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
  const psalmReading = data.readings?.find((r: { type: string }) => r.type === "psalm");
  if (!psalmReading?.citation) return null;
  const lines = psalmReading.citation.split("\n");
  const antiphon = (lines[1] || "").trim();
  const psNum = psalmReading.citation.match(/Ps\s+(\d+)/)?.[1];
  if (psNum && antiphon) return `Ps ${psNum} ${antiphon}`;
  return psalmReading.citation.split("\n")[0];
}

function getVerseText(occasionId: string): string | undefined {
  const fpath = `${OCCASIONS_DIR}/${occasionId}.json`;
  if (!fs.existsSync(fpath)) return undefined;
  const data = JSON.parse(fs.readFileSync(fpath, "utf8"));
  const verseReading = data.readings?.find((r: { type: string }) => r.type === "gospel_verse");
  if (!verseReading?.summary) return undefined;
  return verseReading.summary.replace(/\n/g, " ").trim();
}

async function main() {
  let psalmLinked = 0;
  let gaLinked = 0;
  let verseRemoved = 0;
  let skipped = 0;

  for (const [videoId, occasionName, type] of PLAYLIST) {
    const occasionId = occasionToId(occasionName);
    if (!occasionId) {
      console.log(`  SKIP (no occasion): ${occasionName}`);
      skipped++;
      continue;
    }

    const occFile = `${OCCASIONS_DIR}/${occasionId}.json`;
    if (!fs.existsSync(occFile)) {
      console.log(`  SKIP (no file): ${occasionId}`);
      skipped++;
      continue;
    }

    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (type === "psalm") {
      const { composer } = getComposer(videoId);
      const psalmLabel = getPsalmLabel(occasionId) || `Spirit & Psalm: ${occasionName}`;
      const setting = `Spirit & Psalm • ${composer}`;

      console.log(`  Psalm: ${occasionName} → ${occasionId} (${composer})`);

      for (const ensemble of ENSEMBLES) {
        const { error } = await supabase.from("music_plan_edits").upsert(
          {
            occasion_id: occasionId,
            ensemble_id: ensemble,
            field: "responsorialPsalm",
            value: { psalm: psalmLabel, setting, youtubeUrl: ytUrl },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "occasion_id,ensemble_id,field" }
        );
        if (error) console.error(`    Error: ${error.message}`);
        else psalmLinked++;
      }
    } else {
      const { composer, massSetting } = getComposer(videoId);
      const gaTitle = massSetting || "Spirit & Psalm: Gospel Acclamation";
      const gaComposer = `Spirit & Psalm • ${composer}`;
      const verseText = getVerseText(occasionId);

      console.log(`  GA: ${occasionName} → ${occasionId} (${massSetting || "?"} / ${composer})`);

      for (const ensemble of ENSEMBLES) {
        const value: Record<string, string | undefined> = {
          title: gaTitle,
          composer: gaComposer,
          youtubeUrl: ytUrl,
          verse: verseText,
        };

        const { error } = await supabase.from("music_plan_edits").upsert(
          {
            occasion_id: occasionId,
            ensemble_id: ensemble,
            field: "gospelAcclamation",
            value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "occasion_id,ensemble_id,field" }
        );
        if (error) console.error(`    Error: ${error.message}`);
        else gaLinked++;
      }
    }
  }

  // Clean up remaining verseStoragePath entries for these ensembles
  const { data: existingEdits } = await supabase
    .from("music_plan_edits")
    .select("occasion_id, ensemble_id, value")
    .eq("field", "gospelAcclamation")
    .in("ensemble_id", ENSEMBLES);

  if (existingEdits) {
    for (const edit of existingEdits) {
      const val = edit.value as Record<string, string>;
      if (val?.verseStoragePath) {
        delete val.verseStoragePath;
        await supabase
          .from("music_plan_edits")
          .update({ value: val, updated_at: new Date().toISOString() })
          .eq("occasion_id", edit.occasion_id)
          .eq("ensemble_id", edit.ensemble_id)
          .eq("field", "gospelAcclamation");
        verseRemoved++;
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Psalm linked: ${psalmLinked} | GA linked: ${gaLinked} | Verse paths removed: ${verseRemoved} | Skipped: ${skipped}`);
}

main().catch(console.error);
