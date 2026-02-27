/**
 * Migrate booking grid CSV into Supabase booking_slots.
 *
 * Usage:
 *   node scripts/migrate-booking-csv.mjs
 *
 * Reads: ~/Downloads/MM - MASS PREP - 2026 BOOKING.csv
 * Writes to: mass_events (booking_status, choir_descriptor, celebrant)
 *            booking_slots (person assignments per role per Mass)
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────
const CSV_PATH =
  process.env.CSV_PATH ||
  `${process.env.HOME}/Downloads/MM - MASS PREP - 2026 BOOKING.csv`;

// Load .env.local
const envFile = readFileSync(
  new URL("../.env.local", import.meta.url),
  "utf8"
);
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Constants ───────────────────────────────────────────────────
const YEAR = 2026;
const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const STATUS_SYMBOLS = new Set(["✅", "X", "◎", "◉", "?"]);

const ROLE_COLUMNS = [
  "Director", "Sound", "Playback", "Cantor", "Piano",
  "Soprano", "Alto", "Tenor", "Bass", "A. Guitar",
  "E. Guitar", "E. Bass", "Drums/Percussion", "Other",
];

const BOOKING_STATUS_MAP = {
  Confirmed: "confirmed",
  Pending: "pending",
  "Needs Attention": "needs_attention",
  "N/A": "na",
};

const CONFIRMATION_MAP = {
  "✅": "confirmed",
  X: "declined",
  "◎": "pending",
  "◉": "expected",
  "?": "pending",
};

// ── CSV Parsing ─────────────────────────────────────────────────
function parseCSV(text) {
  const lines = [];
  let current = "";
  let inQuotes = false;

  for (const ch of text) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h.trim()] = (values[i] || "").trim()));
    return row;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Date/Time Parsing ───────────────────────────────────────────
function parseDateAndTime(dateStr) {
  // Format: "3-Jan_1730" or "18-Feb_0630"
  const match = dateStr.match(/^(\d{1,2})-(\w+)_(\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1]);
  const month = MONTHS[match[2]];
  if (month === undefined) return null;
  const hhmm = match[3];
  const hours = parseInt(hhmm.slice(0, 2));
  const minutes = parseInt(hhmm.slice(2));

  const date = new Date(YEAR, month, day);
  const eventDate = date.toISOString().split("T")[0];

  // 24h time
  const startTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

  // 12h format matching existing style: "5:30p", "7:30a"
  const h12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  const ampm = hours >= 12 ? "p" : "a";
  const time12h = minutes === 0 ? `${h12}${ampm}` : `${h12}:${String(minutes).padStart(2, "0")}${ampm}`;

  return { eventDate, startTime, time12h };
}

// ── Cell Parsing ────────────────────────────────────────────────

/**
 * Parse a role cell value into person assignments.
 * Examples:
 *   "David L." → [{ name: "David L.", confirmation: "unconfirmed" }]
 *   "David L., ✅" → [{ name: "David L.", confirmation: "confirmed" }]
 *   "Jeffrey B., ✅, Eddie K., X" → two people
 *   "AUTO" → [{ name: null, confirmation: "auto" }]
 *   "N/A" → []
 *   "?" → [{ name: "TBD", confirmation: "pending" }]
 *   "◎" → [{ name: "TBD", confirmation: "pending" }]
 */
function parseCellPersons(cellValue, isNotAvailableRow = false) {
  const val = cellValue.trim();
  if (!val || val === "N/A") return [];
  if (val === "AUTO") return [{ name: null, confirmation: "auto" }];
  if (val === "AUTO, ?")
    return [{ name: null, confirmation: "auto" }];
  if (val === "?" || val === "◎")
    return [{ name: "TBD", confirmation: "pending" }];

  const tokens = val.split(",").map((t) => t.trim()).filter(Boolean);
  const persons = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // If token is a pure status symbol, apply it to previous person or skip
    if (STATUS_SYMBOLS.has(token)) {
      if (persons.length > 0) {
        persons[persons.length - 1].confirmation =
          CONFIRMATION_MAP[token] || "unconfirmed";
      }
      i++;
      continue;
    }

    // Check if it starts with "X " (prefix X for declined in Not Available rows)
    if (token === "X" && isNotAvailableRow) {
      // Next tokens are declined names
      i++;
      continue;
    }

    // It's a person name
    const name = token;
    // Default: unconfirmed for regular rows, declined for "Not Available..." rows
    const defaultConf = isNotAvailableRow ? "declined" : "unconfirmed";

    // Peek at next token for status
    let confirmation = defaultConf;
    if (i + 1 < tokens.length && STATUS_SYMBOLS.has(tokens[i + 1].trim())) {
      confirmation =
        CONFIRMATION_MAP[tokens[i + 1].trim()] || defaultConf;
      i++; // consume the status token
    }

    // Check for embedded status in name like "Cam M. ✅" (no comma)
    for (const [sym, conf] of Object.entries(CONFIRMATION_MAP)) {
      if (name.endsWith(` ${sym}`)) {
        persons.push({
          name: name.slice(0, -(sym.length + 1)).trim(),
          confirmation: conf,
        });
        i++;
        continue;
      }
    }

    if (name && !STATUS_SYMBOLS.has(name)) {
      persons.push({ name, confirmation });
    }
    i++;
  }

  return persons;
}

/**
 * Parse the "Other" column which has format: "Instrument – Name, status"
 * Examples:
 *   "Violin – Wesley W., ✅"
 *   "WW – Ross C., ✅"
 *   "Violin – Alice T., X"
 */
function parseOtherCell(cellValue, isNotAvailableRow = false) {
  const val = cellValue.trim();
  if (!val || val === "N/A") return [];

  // Split by comma to handle multiple instruments
  // But be careful — status symbols are also comma-separated
  // Check for "Instrument – Name" pattern
  const segments = val.split(/\s*,\s*(?=[A-Z])/);
  const results = [];

  for (const segment of segments) {
    const dashMatch = segment.match(/^(.+?)\s*–\s*(.+)$/);
    if (dashMatch) {
      const instrument = dashMatch[1].trim();
      const rest = dashMatch[2].trim();
      const persons = parseCellPersons(rest, isNotAvailableRow);
      for (const p of persons) {
        results.push({ ...p, instrument_detail: instrument });
      }
    } else {
      // No dash — treat as regular persons for Other role
      const persons = parseCellPersons(segment, isNotAvailableRow);
      for (const p of persons) {
        results.push({ ...p, instrument_detail: null });
      }
    }
  }

  return results;
}

/**
 * Parse the Choir column value into a choir_descriptor.
 */
function parseChoirDescriptor(val) {
  if (!val || val === "N/A") return "N/A";
  if (val === "Volunteers") return "Volunteers";
  if (val === "SMPREP") return "SMPREP";
  if (val === "Cancelled") return "Cancelled";
  if (val.includes("Volunteers") && val.includes("SMPREP"))
    return "Volunteers + SMPREP";
  return null;
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log("Reading CSV:", CSV_PATH);
  const csvText = readFileSync(CSV_PATH, "utf8");
  const rows = parseCSV(csvText);
  console.log(`Parsed ${rows.length} rows`);

  // Fetch ministry roles
  const { data: rolesData } = await supabase
    .from("ministry_roles")
    .select("id, name");
  const roleMap = new Map(rolesData.map((r) => [r.name, r.id]));
  console.log(`Loaded ${roleMap.size} ministry roles`);

  // Fetch existing mass_events
  const { data: existingMasses } = await supabase
    .from("mass_events")
    .select("id, event_date, start_time, start_time_12h, title, community");

  // Index by date+time for matching
  const massIndex = new Map();
  for (const m of existingMasses || []) {
    const key = `${m.event_date}_${m.start_time_12h || m.start_time}`;
    massIndex.set(key, m);
  }
  console.log(`Loaded ${massIndex.size} existing mass events`);

  // Stats
  let massesCreated = 0;
  let massesUpdated = 0;
  let slotsCreated = 0;
  let skipped = 0;

  // Track which mass_event_id corresponds to each date+time
  // (needed because "Not Available" rows reference the same mass)
  const massEventIdCache = new Map();

  // ── Process each CSV row ──
  for (const row of rows) {
    const celebration = row.Celebration;
    const dateStr = row.Date;
    const status = row.Status;

    if (!dateStr) {
      skipped++;
      continue;
    }

    const parsed = parseDateAndTime(dateStr);
    if (!parsed) {
      console.warn(`  Skipping unparseable date: ${dateStr}`);
      skipped++;
      continue;
    }

    const { eventDate, startTime, time12h } = parsed;
    const isNotAvailable = status === "Not Available...";
    const isNA = status === "N/A";

    // ── Find or create mass_event ──
    const lookupKey = `${eventDate}_${time12h}`;
    let massEventId = massEventIdCache.get(lookupKey);

    if (!massEventId) {
      // Try matching existing
      let existing = massIndex.get(lookupKey);
      if (!existing) {
        // Try matching by date + start_time
        const altKey = `${eventDate}_${startTime}`;
        existing = massIndex.get(altKey);
      }

      if (existing) {
        massEventId = existing.id;
      } else if (!isNotAvailable) {
        // Create new mass_event
        const bookingStatus = BOOKING_STATUS_MAP[status] || "pending";
        const choirDescriptor = parseChoirDescriptor(row.Choir);
        const presider = row.Presider && row.Presider !== "N/A" && row.Presider !== "◎"
          ? row.Presider.replace(/^"|"$/g, "")
          : null;

        // Determine community from time
        let community = null;
        if (time12h === "5:30p" || time12h === "5p") community = "Reflections";
        else if (time12h === "7:30a") community = "Foundations";
        else if (time12h === "9:30a") community = "Generations";
        else if (time12h === "11:30a") community = "Heritage";
        else if (time12h === "1:15p") community = null; // Spanish Mass
        else if (time12h === "5:30p") community = "Elevations";

        const { data: created, error } = await supabase
          .from("mass_events")
          .insert({
            title: celebration,
            event_date: eventDate,
            start_time: startTime,
            start_time_12h: time12h,
            event_type: "mass",
            has_music: true,
            community,
            celebrant: presider,
            booking_status: bookingStatus,
            choir_descriptor: choirDescriptor,
            liturgical_name: celebration,
          })
          .select("id")
          .single();

        if (error) {
          console.error(`  Error creating mass_event for ${celebration} ${dateStr}:`, error.message);
          skipped++;
          continue;
        }

        massEventId = created.id;
        massesCreated++;
        console.log(`  Created mass_event: ${celebration} ${eventDate} ${time12h} → ${massEventId}`);
      } else {
        // "Not Available" row but no prior mass — skip
        skipped++;
        continue;
      }

      massEventIdCache.set(lookupKey, massEventId);
    }

    // ── Update mass_event status (only on primary rows) ──
    if (!isNotAvailable && !isNA && status) {
      const bookingStatus = BOOKING_STATUS_MAP[status] || "pending";
      const choirDescriptor = parseChoirDescriptor(row.Choir);
      const presider = row.Presider && row.Presider !== "N/A" && row.Presider !== "◎"
        ? row.Presider.replace(/^"|"$/g, "")
        : null;

      await supabase
        .from("mass_events")
        .update({
          booking_status: bookingStatus,
          choir_descriptor: choirDescriptor,
          celebrant: presider,
        })
        .eq("id", massEventId);
      massesUpdated++;
    }

    // ── Parse role cells and create booking_slots ──
    for (const roleName of ROLE_COLUMNS) {
      const cellValue = row[roleName];
      if (!cellValue || cellValue.trim() === "" || cellValue.trim() === "N/A") continue;

      let persons;
      if (roleName === "Other") {
        persons = parseOtherCell(cellValue, isNotAvailable);
      } else {
        persons = parseCellPersons(cellValue, isNotAvailable);
      }

      const roleId = roleMap.get(roleName);
      if (!roleId) {
        // "Bass" column maps to "Bass (Vocal)" role
        const altId = roleName === "Bass" ? roleMap.get("Bass (Vocal)") : null;
        if (!altId) {
          console.warn(`  No role ID for: ${roleName}`);
          continue;
        }
        persons.forEach((p, idx) => {
          insertSlot(massEventId, altId, p, idx);
        });
        continue;
      }

      for (let idx = 0; idx < persons.length; idx++) {
        await insertSlot(massEventId, roleId, persons[idx], idx);
        slotsCreated++;
      }
    }
  }

  console.log("\n=== Migration Complete ===");
  console.log(`  Mass events created: ${massesCreated}`);
  console.log(`  Mass events updated: ${massesUpdated}`);
  console.log(`  Booking slots created: ${slotsCreated}`);
  console.log(`  Rows skipped: ${skipped}`);
}

async function insertSlot(massEventId, roleId, person, slotOrder) {
  const { error } = await supabase.from("booking_slots").insert({
    mass_event_id: massEventId,
    ministry_role_id: roleId,
    profile_id: null, // We don't have profile IDs — just names
    person_name: person.name,
    confirmation: person.confirmation,
    is_recurring: person.confirmation === "expected",
    slot_order: slotOrder,
    instrument_detail: person.instrument_detail || null,
  });

  if (error) {
    // Duplicate constraint — might happen with "Not Available" rows
    if (error.code !== "23505") {
      console.warn(
        `  Slot insert error (${person.name} / ${person.confirmation}):`,
        error.message
      );
    }
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
