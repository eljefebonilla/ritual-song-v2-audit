import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const DIR = "src/data/occasions";

async function main() {
  let updated = 0;
  let noVerse = 0;
  let alreadyHas = 0;

  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith(".json")) continue;
    const data = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    const occasionId = data.id;

    const verseReading = data.readings?.find(
      (r: { type: string }) => r.type === "gospel_verse"
    );
    if (!verseReading?.summary) {
      noVerse++;
      continue;
    }

    const verseText = verseReading.summary.replace(/\n/g, " ").trim();
    if (!verseText) {
      noVerse++;
      continue;
    }

    for (const ens of ["reflections", "heritage"]) {
      const { data: existing } = await supabase
        .from("music_plan_edits")
        .select("occasion_id, ensemble_id, field, value")
        .eq("occasion_id", occasionId)
        .eq("ensemble_id", ens)
        .eq("field", "gospelAcclamation")
        .limit(1);

      if (!existing || existing.length === 0) continue;

      const val = existing[0].value as Record<string, string>;
      if (val.verse) {
        alreadyHas++;
        continue;
      }

      val.verse = verseText;

      const { error } = await supabase
        .from("music_plan_edits")
        .update({ value: val, updated_at: new Date().toISOString() })
        .eq("occasion_id", occasionId)
        .eq("ensemble_id", ens)
        .eq("field", "gospelAcclamation");

      if (error) {
        console.error("Error:", occasionId, error.message);
      } else {
        updated++;
        if (updated <= 5) {
          console.log("OK:", occasionId, "->", verseText.slice(0, 50));
        }
      }
    }
  }
  console.log("\nUpdated:", updated, "| Already has:", alreadyHas, "| No verse:", noVerse);
}

main().catch(console.error);
