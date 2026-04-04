#!/usr/bin/env npx tsx
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local", override: true });

/**
 * Upload parish brand fonts to Supabase storage.
 * Fonts are stored under fonts/{parish_id}/ and base64-inlined at generation time.
 *
 * Usage: npx tsx scripts/upload-fonts.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

const FONTS = [
  {
    family: "Eidetic Neo",
    file: "/Users/jeffreybonilla/St Monica Dropbox/Music Ministry/_ARCHIVE FOR REVIEW/Fonts/EideticNeo/EidetNeoOmn.ttf",
    weight: 400,
    style: "normal" as const,
    storageName: "eidetic-neo-regular.ttf",
  },
  {
    family: "Eidetic Neo",
    file: "/Users/jeffreybonilla/St Monica Dropbox/Music Ministry/_ARCHIVE FOR REVIEW/Fonts/EideticNeo/EidetNeoBla.ttf",
    weight: 700,
    style: "normal" as const,
    storageName: "eidetic-neo-bold.ttf",
  },
  {
    family: "Minion Pro",
    file: "/Users/jeffreybonilla/Desktop/Claude Look/V2 Examples/Minion Pro/MinionPro-Regular.otf",
    weight: 400,
    style: "normal" as const,
    storageName: "minion-pro-regular.otf",
  },
  {
    family: "Minion Pro",
    file: "/Users/jeffreybonilla/Desktop/Claude Look/V2 Examples/Minion Pro/MinionPro-Bold.otf",
    weight: 700,
    style: "normal" as const,
    storageName: "minion-pro-bold.otf",
  },
  {
    family: "Minion Pro",
    file: "/Users/jeffreybonilla/Desktop/Claude Look/V2 Examples/Minion Pro/MinionPro-It.otf",
    weight: 400,
    style: "italic" as const,
    storageName: "minion-pro-italic.otf",
  },
];

async function main() {
  const supabase = getSupabase();

  // Find St. Monica's parish
  const { data: parishes } = await supabase
    .from("parishes")
    .select("id, name")
    .ilike("name", "%monica%")
    .limit(1);

  if (!parishes?.[0]) {
    console.error("St. Monica parish not found");
    process.exit(1);
  }

  const parishId = parishes[0].id;
  console.log(`Parish: ${parishes[0].name} (${parishId})\n`);

  for (const font of FONTS) {
    const storagePath = `fonts/${parishId}/${font.storageName}`;
    console.log(`Uploading ${font.family} ${font.weight} ${font.style} -> ${storagePath}`);

    const bytes = readFileSync(font.file);
    const ext = font.storageName.split(".").pop();
    const contentType = ext === "otf" ? "font/otf" : "font/ttf";

    const { error } = await supabase.storage
      .from("song-resources")
      .upload(storagePath, bytes, { contentType, upsert: true });

    if (error) {
      console.error(`  Failed: ${error.message}`);
    } else {
      console.log(`  Done`);
    }
  }

  console.log("\nAll fonts uploaded.");
}

main().catch(console.error);
