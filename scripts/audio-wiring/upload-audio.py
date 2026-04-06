#!/usr/bin/env python3
"""
Upload Lyric Psalter and Gospel Acclamation audio to Supabase Storage,
create song_resources_v2 rows, and populate occasionResources in occasion JSONs.

Usage:
  python3 upload-audio.py --dry-run    # Preview only
  python3 upload-audio.py              # Actually upload
"""

import json, os, sys, re, uuid
from pathlib import Path
from supabase import create_client

# --- Config ---
SUPABASE_URL = "https://kzziuepuepdcnvtexvxn.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
OCCASIONS_DIR = Path(os.path.expanduser("~/Dropbox/RITUALSONG/ritualsong-app/src/data/occasions"))
MANIFEST_PATH = Path(__file__).parent / "audio-manifest.json"
BUCKET = "song-resources"

DRY_RUN = "--dry-run" in sys.argv

if not SUPABASE_KEY:
    # Read from .env.local
    env_path = Path(os.path.expanduser("~/Dropbox/RITUALSONG/ritualsong-app/.env.local"))
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                SUPABASE_KEY = line.split("=", 1)[1].strip().strip('"').replace("\\n", "").strip()
                break

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Load manifest ---
with open(MANIFEST_PATH) as f:
    manifest = json.load(f)

# --- Load Lyric Psalter songs from DB ---
print("Fetching Lyric Psalter songs from DB...")
result = supabase.table("songs").select("id, title, psalm_number").ilike("composer", "%Lyric Psalter%").execute()
psalter_songs = result.data  # list of {id, title, psalm_number}
print(f"  Found {len(psalter_songs)} Lyric Psalter songs")

# Build title index for matching
def normalize_psalm(title):
    """Normalize psalm title for matching: 'Ps 122 Let us go...' -> 'ps 122'"""
    m = re.match(r'(Ps\s+\d+)', title, re.IGNORECASE)
    return m.group(1).lower() if m else title.lower().strip()

psalter_by_title = {}
psalter_by_psalm_num = {}
for s in psalter_songs:
    key = normalize_psalm(s["title"])
    psalter_by_title[key] = s
    # Also index by full normalized title
    psalter_by_title[s["title"].lower().strip()] = s
    if s.get("psalm_number"):
        psalter_by_psalm_num[s["psalm_number"]] = s

# --- Load occasion psalm assignments ---
print("Loading occasion psalm assignments...")
occasion_psalm_map = {}  # occasion_id -> psalm_title
for f in sorted(OCCASIONS_DIR.glob("*.json")):
    with open(f) as fh:
        d = json.load(fh)
    oid = f.stem
    for plan in d.get("musicPlans", []):
        ps = plan.get("responsorialPsalm", {})
        if ps and "Lyric Psalter" in (ps.get("setting", "") or ""):
            occasion_psalm_map[oid] = ps.get("psalm", "")
            break

print(f"  {len(occasion_psalm_map)} occasions with Lyric Psalter psalm assignments")

# --- Step 1: Create GA refrain songs ---
print("\n=== CREATING GA REFRAIN SONGS ===")
GA_SEASONS = {
    "Advent": "The Lyric Gospel Acclamations: Advent",
    "Christmas": "The Lyric Gospel Acclamations: Christmas",
    "Lent": "The Lyric Gospel Acclamations: Lent",
    "Easter": "The Lyric Gospel Acclamations: Easter",
    "OT": "The Lyric Gospel Acclamations: Ordinary Time",
}

ga_song_ids = {}  # season -> song UUID
for season, title in GA_SEASONS.items():
    # Check if already exists
    existing = supabase.table("songs").select("id").eq("title", title).execute()
    if existing.data:
        ga_song_ids[season] = existing.data[0]["id"]
        print(f"  {season}: exists ({ga_song_ids[season][:8]}...)")
    else:
        if DRY_RUN:
            ga_song_ids[season] = f"dry-run-{season}"
            print(f"  {season}: WOULD CREATE '{title}'")
        else:
            new_id = str(uuid.uuid4())
            lent_category = "gospel_acclamation_refrain"
            supabase.table("songs").insert({
                "id": new_id,
                "title": title,
                "composer": "Tony Alonso & Marty Haugen",
                "category": lent_category,
                "legacy_id": f"lyric-ga-{season.lower()}",
            }).execute()
            ga_song_ids[season] = new_id
            print(f"  {season}: CREATED ({new_id[:8]}...)")

# --- Step 2: Upload Psalter audio + create song_resources_v2 rows ---
print("\n=== UPLOADING LYRIC PSALTER ===")
psalter_uploaded = 0
psalter_linked = 0
psalter_skipped = 0

for entry in manifest["psalter"]:
    file_path = Path(entry["filePath"])
    occasion_ids = entry["occasionIds"]
    psalm_title = entry.get("psalmTitle")

    if not file_path.exists():
        print(f"  SKIP (file missing): {file_path.name}")
        psalter_skipped += 1
        continue

    # Find the matching Lyric Psalter song
    song = None
    if psalm_title:
        key = normalize_psalm(psalm_title)
        song = psalter_by_title.get(key)
        if not song:
            # Try full title match
            song = psalter_by_title.get(psalm_title.lower().strip())

    if not song:
        # Try matching from occasion psalm assignments
        for oid in occasion_ids:
            pt = occasion_psalm_map.get(oid)
            if pt:
                key = normalize_psalm(pt)
                song = psalter_by_title.get(key)
                if song:
                    break

    if not song:
        psalter_skipped += 1
        continue

    # Storage path
    storage_path = f"lyric-psalter/{occasion_ids[0]}.mp3"
    url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"

    if DRY_RUN:
        print(f"  WOULD upload {file_path.name} -> {storage_path} (song: {song['title'][:40]})")
        psalter_uploaded += 1
        psalter_linked += len(occasion_ids)
        continue

    # Upload to storage
    try:
        with open(file_path, "rb") as f:
            data = f.read()
        supabase.storage.from_(BUCKET).upload(
            storage_path, data,
            file_options={"content-type": "audio/mpeg", "upsert": "true"}
        )
        psalter_uploaded += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "Duplicate" in str(e):
            psalter_uploaded += 1  # Already there
        else:
            print(f"  ERROR uploading {file_path.name}: {e}")
            psalter_skipped += 1
            continue

    # Create song_resources_v2 row
    try:
        supabase.table("song_resources_v2").insert({
            "song_id": song["id"],
            "type": "audio",
            "label": f"Lyric Psalter: {entry['trackName']}",
            "url": url,
            "storage_path": storage_path,
            "source": "gia_lyric_psalter",
            "is_highlighted": False,
        }).execute()
        psalter_linked += 1
    except Exception as e:
        if "duplicate" in str(e).lower():
            psalter_linked += 1  # Already linked
        else:
            print(f"  ERROR linking {file_path.name}: {e}")

print(f"  Uploaded: {psalter_uploaded}, Linked: {psalter_linked}, Skipped: {psalter_skipped}")


# --- Step 3: Upload GA refrains + verses ---
print("\n=== UPLOADING GOSPEL ACCLAMATIONS ===")
ga_uploaded = 0
ga_linked = 0
ga_skipped = 0
occasion_resources_to_add = {}  # occasion_id -> list of resources

for entry in manifest["gospel_acclamations"]:
    file_path = Path(entry["filePath"])
    if not file_path.exists():
        ga_skipped += 1
        continue

    if entry["type"] == "refrain":
        # Link to seasonal GA song
        season = entry["season"]
        song_id = ga_song_ids.get(season)
        if not song_id:
            ga_skipped += 1
            continue

        storage_path = f"lyric-ga/{season.lower()}_refrain.mp3"
        url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"

        if DRY_RUN:
            print(f"  REFRAIN: {file_path.name} -> {storage_path}")
            ga_uploaded += 1
            ga_linked += 1
            continue

        try:
            with open(file_path, "rb") as f:
                data = f.read()
            supabase.storage.from_(BUCKET).upload(
                storage_path, data,
                file_options={"content-type": "audio/mpeg", "upsert": "true"}
            )
            ga_uploaded += 1
        except Exception as e:
            if "already exists" in str(e).lower() or "Duplicate" in str(e):
                ga_uploaded += 1
            else:
                print(f"  ERROR uploading refrain {file_path.name}: {e}")
                ga_skipped += 1
                continue

        try:
            supabase.table("song_resources_v2").insert({
                "song_id": song_id,
                "type": "audio",
                "label": f"Lyric Gospel Acclamation: {season} Refrain",
                "url": url,
                "storage_path": storage_path,
                "source": "gia_lyric_ga",
                "is_highlighted": True,
            }).execute()
            ga_linked += 1
        except Exception as e:
            if "duplicate" in str(e).lower():
                ga_linked += 1
            else:
                print(f"  ERROR linking refrain: {e}")

    elif entry["type"] == "verse":
        occasion_ids = entry["occasionIds"]
        if not occasion_ids:
            ga_skipped += 1
            continue

        # Use first occasion ID for storage path
        primary_oid = occasion_ids[0]
        storage_path = f"lyric-ga/{primary_oid}_verse.mp3"
        url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"

        if DRY_RUN:
            print(f"  VERSE: {file_path.name} -> {storage_path} ({len(occasion_ids)} occasions)")
            ga_uploaded += 1
            ga_linked += len(occasion_ids)
            continue

        try:
            with open(file_path, "rb") as f:
                data = f.read()
            supabase.storage.from_(BUCKET).upload(
                storage_path, data,
                file_options={"content-type": "audio/mpeg", "upsert": "true"}
            )
            ga_uploaded += 1
        except Exception as e:
            if "already exists" in str(e).lower() or "Duplicate" in str(e):
                ga_uploaded += 1
            else:
                print(f"  ERROR uploading verse {file_path.name}: {e}")
                ga_skipped += 1
                continue

        # Add as occasion resource for each mapped occasion
        for oid in occasion_ids:
            resource = {
                "id": f"lyric-ga-verse-{oid}",
                "type": "audio",
                "label": f"Lyric Gospel Acclamation Verse",
                "filePath": url,
                "source": "local",
                "category": "gospel_acclamation",
                "subcategory": "verse",
            }
            if oid not in occasion_resources_to_add:
                occasion_resources_to_add[oid] = []
            occasion_resources_to_add[oid].append(resource)
            ga_linked += 1

print(f"  Uploaded: {ga_uploaded}, Linked: {ga_linked}, Skipped: {ga_skipped}")


# --- Step 4: Update occasion JSONs with GA verse resources ---
print(f"\n=== UPDATING OCCASION JSONs ({len(occasion_resources_to_add)} occasions) ===")
occasions_updated = 0

for oid, resources in occasion_resources_to_add.items():
    json_path = OCCASIONS_DIR / f"{oid}.json"
    if not json_path.exists():
        print(f"  SKIP (no JSON): {oid}")
        continue

    with open(json_path) as f:
        data = json.load(f)

    existing_ids = {r["id"] for r in data.get("occasionResources", [])}
    new_resources = [r for r in resources if r["id"] not in existing_ids]

    if not new_resources:
        continue

    if "occasionResources" not in data:
        data["occasionResources"] = []
    data["occasionResources"].extend(new_resources)

    if DRY_RUN:
        print(f"  WOULD update {oid}: +{len(new_resources)} GA verse resources")
    else:
        with open(json_path, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

    occasions_updated += 1

print(f"  Updated: {occasions_updated} occasion files")


# --- Summary ---
print(f"\n{'=' * 50}")
print(f"{'DRY RUN ' if DRY_RUN else ''}SUMMARY:")
print(f"  Psalter: {psalter_uploaded} uploaded, {psalter_linked} linked to songs")
print(f"  GA: {ga_uploaded} uploaded, {ga_linked} linked")
print(f"  Occasion JSONs: {occasions_updated} updated with verse resources")
print(f"  Total files: {psalter_uploaded + ga_uploaded}")
print(f"  Skipped: {psalter_skipped + ga_skipped}")
