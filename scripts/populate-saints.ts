/**
 * populate-saints.ts
 *
 * Reads saints.json and upserts to the Supabase `saints` table.
 *
 * Usage: npx tsx scripts/populate-saints.ts
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

interface SaintEntry {
  name: string;
  title: string;
  feastMonth: number;
  feastDay: number;
  rank: string;
  description: string;
  patronOf: string;
}

async function main() {
  const jsonPath = path.resolve(__dirname, "../src/data/saints.json");
  const saints: SaintEntry[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  console.log(`Loaded ${saints.length} saints from saints.json`);

  const rows = saints.map((s) => ({
    name: s.name,
    title: s.title || null,
    feast_month: s.feastMonth,
    feast_day: s.feastDay,
    rank: s.rank,
    description: s.description,
    patron_of: s.patronOf || null,
  }));

  // Upsert in batches
  const BATCH_SIZE = 50;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("saints")
      .upsert(batch, { onConflict: "name" });

    if (error) {
      console.error(`Batch upsert error at ${i}:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`Upserted ${upserted} saints to Supabase.`);
  console.log("Done.");
}

main().catch(console.error);
