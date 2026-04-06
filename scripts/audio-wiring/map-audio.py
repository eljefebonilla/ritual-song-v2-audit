#!/usr/bin/env python3
"""
Map Lyric Psalter and Lyric Gospel Acclamation audio files to occasion IDs.
Outputs a JSON manifest for the upload script.
"""

import json, re, os
from pathlib import Path

# --- Config ---
PSALTER_ROOT = Path(os.path.expanduser("~/Desktop/Lyric Psalter Recordings"))
GA_ROOT = Path(os.path.expanduser("~/Dropbox (Personal)/RITUALSONG/Song Folders/Music/_Collections/GIA/The Lyric Gospel Acclamations/AudioFiles_LyricGospelAcclamations"))
OCCASIONS_DIR = Path(os.path.expanduser("~/Dropbox/RITUALSONG/ritualsong-app/src/data/occasions"))

# --- Load occasion data ---
occasions = {}  # id -> {name, season, psalms: {setting: psalm_title}}
for f in sorted(OCCASIONS_DIR.glob("*.json")):
    with open(f) as fh:
        d = json.load(fh)
    oid = f.stem
    psalms = {}
    for plan in d.get("musicPlans", []):
        ps = plan.get("responsorialPsalm", {})
        if ps:
            psalms[ps.get("setting", "")] = ps.get("psalm", "")
    occasions[oid] = {
        "name": d.get("name", ""),
        "season": d.get("season", ""),
        "psalms": psalms,
    }

# --- Lyric Psalter: build name-to-occasionID lookup ---
# Map common liturgical names to occasion ID patterns
PSALTER_YEAR_MAP = {
    "X-89100 The Lyric Psalter Year A": "a",
    "X-89200 The Lyric Psalter Year B": "b",
    "X-89300 The Lyric Psalter Year C": "c",
    "X-89000 The Lyric Psalter": None,  # common/feasts (all cycles)
}

def track_name_to_occasion_ids(track_name, year_letter):
    """Convert a track name like '1st Sunday of Advent' to occasion IDs."""
    name = track_name.strip()

    # Convert word ordinals to numeric
    ordinal_words = {"first": "1st", "second": "2nd", "third": "3rd", "fourth": "4th",
                     "fifth": "5th", "sixth": "6th", "seventh": "7th", "eighth": "8th"}
    name_lower = name.lower()
    for word, num in ordinal_words.items():
        name_lower = name_lower.replace(word, num)
    n = name_lower

    results = []

    # Handle compound names (separated by / or missing separator like "3rd Sunday of Lent23rd Sunday in OT")
    # Split on digit boundaries that look like new entries
    parts = re.split(r'(?<=\w)(\d+(?:st|nd|rd|th)\s)', name)
    if len(parts) > 2:
        # Reconstruct parts
        chunks = []
        current = parts[0]
        for i in range(1, len(parts), 2):
            if i+1 < len(parts):
                chunks.append(current.strip())
                current = parts[i] + parts[i+1]
            else:
                current += parts[i]
        chunks.append(current.strip())
        chunks = [c for c in chunks if c]
    else:
        chunks = [name]

    for chunk in chunks:
        oids = _map_single_name(chunk.strip(), year_letter)
        results.extend(oids)

    return results

def _map_single_name(name, year_letter):
    """Map a single occasion name to occasion IDs."""
    n = name.lower().strip()

    # Advent
    m = re.match(r'(\d+)(?:st|nd|rd|th)\s+sunday\s+of\s+advent', n)
    if m:
        num = int(m.group(1))
        return _with_year(f"advent-{num:02d}", year_letter)

    # Nativity / Christmas (single occasion file: nativity.json)
    if 'nativity' in n or ('christmas' in n and ('vigil' in n or 'midnight' in n or 'dawn' in n or 'day' in n)):
        return ["nativity"]

    # Holy Family
    if 'holy family' in n:
        return _with_year("holy-family", year_letter)

    # Epiphany
    if 'epiphany' in n:
        return ["the-epiphany-of-the-lord-abc"]

    # Baptism of the Lord
    if 'baptism' in n and 'lord' in n:
        return _with_year("baptism-of-the-lord", year_letter)

    # Lent
    m = re.match(r'(\d+)(?:st|nd|rd|th)\s+sunday\s+of\s+lent', n)
    if m:
        num = int(m.group(1))
        base = f"lent-{num:02d}"
        # Year A has scrutiny suffixes for Lent 3-5
        if year_letter == "a" and num == 3:
            return ["lent-03-a-first-scrutiny"]
        if year_letter == "a" and num == 4:
            return ["lent-04-a-second-scrutiny"]
        if year_letter == "a" and num == 5:
            return ["lent-05-a-third-scrutiny"]
        return _with_year(base, year_letter)

    # Palm Sunday
    if 'palm sunday' in n or 'palm' in n and 'holy week' in n:
        return _with_year("palm-sunday", year_letter)

    # Easter Vigil
    if 'easter vigil' in n:
        return ["easter-vigil"]

    # Easter Sunday
    if 'easter day' in n or 'easter sunday' in n:
        return ["easter-sunday-abc"]

    m = re.match(r'(\d+)(?:st|nd|rd|th)\s+sunday\s+of\s+easter', n)
    if m:
        num = int(m.group(1))
        base = f"easter-{num:02d}"
        if num == 2:
            base = "easter-02-divine-mercy"
        return _with_year(base, year_letter)

    # Ascension
    if 'ascension' in n:
        return _with_year("ascension", year_letter)

    # Pentecost
    if 'pentecost' in n:
        if 'vigil' in n:
            return ["pentecost-vigil-abc"]
        return _with_year("pentecost", year_letter)

    # Ordinary Time (both "in Ordinary Time" and "Ordinary Time")
    m = re.match(r'(\d+)(?:st|nd|rd|th)\s+sunday\s+(?:in\s+)?(?:ordinary\s+time|or(?:s|d)inary\s+time|ot)', n)
    if m:
        num = int(m.group(1))
        if num == 3:
            if year_letter:
                return [f"ordinary-time-03-{year_letter}-word-of-god-sunday"]
            return [f"ordinary-time-03-a-word-of-god-sunday", f"ordinary-time-03-b-word-of-god-sunday", f"ordinary-time-03-c-word-of-god-sunday"]
        return _with_year(f"ordinary-time-{num:02d}", year_letter)

    # Christ the King / Our Lord Jesus Christ King of the Universe
    if 'christ the king' in n or 'king of the universe' in n:
        return _with_year("solemnity-christ-the-king", year_letter)

    # Corpus Christi / Body and Blood
    if 'body and blood' in n or 'corpus christi' in n:
        return _with_year("solemnity-body-blood-of-christ", year_letter)

    # Trinity Sunday
    if 'trinity' in n or 'most holy trinity' in n:
        return _with_year("solemnity-most-holy-trinity", year_letter)

    # Feasts (common psalter - no year letter)
    if 'presentation' in n and 'lord' in n:
        return ["feast-abc-feb-2-presentation-of-the-lord"]
    if 'st joseph' in n or 'saint joseph' in n or 'st. joseph' in n:
        return ["st-joseph-abc"]
    if 'annunciation' in n:
        return ["annunciation-abc"]
    if 'birth of john' in n or 'nativity of john' in n:
        if 'vigil' in n:
            return ["birth-of-john-the-baptist-vigil-abc"]
        return ["birth-of-john-the-baptist-abc"]
    if 'peter and paul' in n:
        if 'vigil' in n:
            return ["ss-peter-paul-apostles-jun-29-at-the-vigil-mass-abc"]
        return ["ss-peter-paul-apostles-jun-29-mass-during-the-day-abc"]
    if 'transfiguration' in n:
        return ["transfiguration-abc"]
    if 'assumption' in n:
        if 'vigil' in n:
            return ["assumption-vigil-abc"]
        return ["assumption-abc"]
    if 'exaltation' in n and ('cross' in n or 'holy cross' in n):
        return ["feast-the-exaltation-sep-14-of-the-holy-cross-abc"]
    if 'all saints' in n:
        return ["solemnity-nov-1-all-saints-abc"]
    if 'all souls' in n:
        return ["solemnity-nov-1-all-souls-abc"]
    if 'dedication' in n and 'lateran' in n:
        return ["the-dedication-of-nov-9-the-lateran-basilica-abc"]
    if 'immaculate conception' in n:
        return ["solemnity-immaculate-conception"]
    if 'ash wednesday' in n:
        return ["ash-wednesday"]
    if 'chrism mass' in n or ('holy thursday' in n and 'chrism' in n):
        return []  # no separate chrism mass occasion
    if 'thursday of the lord' in n or 'lord\'s supper' in n or 'holy thursday' in n:
        return ["holy-thursday-lords-supper"]
    if 'good friday' in n or 'friday of the passion' in n:
        return ["good-friday-passion"]
    if 'sacred heart' in n:
        return _with_year("sacred-heart", year_letter) if year_letter else []
    if 'mary' in n and ('mother of god' in n or 'january 1' in n or 'jan 1' in n):
        return ["jan-1-mary-mother-of-god-abc"]
    if 'thanksgiving' in n:
        return ["thanksgiving-abc"]
    if 'labor day' in n:
        return ["labor-day-abc"]

    return []

def _with_year(base, year_letter):
    """Add year letter suffix, or try all 3 if common."""
    if year_letter:
        return [f"{base}-{year_letter}"]
    else:
        return [f"{base}-a", f"{base}-b", f"{base}-c"]


# === MAP LYRIC PSALTER ===
psalter_manifest = []
unmapped_psalter = []

for folder in sorted(PSALTER_ROOT.iterdir()):
    if not folder.is_dir():
        continue
    year_letter = PSALTER_YEAR_MAP.get(folder.name)

    for mp3 in sorted(folder.rglob("*.mp3")):
        # Parse track name: "Track N OccasionName"
        stem = mp3.stem
        m = re.match(r'Track\s+\d+\s+(.*)', stem)
        if not m:
            unmapped_psalter.append({"file": str(mp3), "reason": "no track pattern"})
            continue

        track_name = m.group(1).strip()

        # Handle psalm number suffix like "Ps 145"
        track_name_clean = re.sub(r'\s+Ps\s+\d+.*$', '', track_name)

        occasion_ids = track_name_to_occasion_ids(track_name_clean, year_letter)

        # Filter to actually existing occasions
        valid_ids = [oid for oid in occasion_ids if oid in occasions]

        if not valid_ids:
            unmapped_psalter.append({"file": str(mp3), "track": track_name, "tried": occasion_ids})
            continue

        # Find the Lyric Psalter psalm title for these occasions
        psalm_title = None
        for oid in valid_ids:
            occ = occasions[oid]
            for setting, title in occ["psalms"].items():
                if "Lyric Psalter" in setting:
                    psalm_title = title
                    break
            if psalm_title:
                break

        psalter_manifest.append({
            "filePath": str(mp3),
            "occasionIds": valid_ids,
            "psalmTitle": psalm_title,
            "trackName": track_name,
            "category": "psalm",
        })


def _parse_year_letters(s):
    """Parse 'ABC' or 'A' or 'BC' into list of lowercase letters."""
    s = s.strip("_ ")
    if not s:
        return ["a", "b", "c"]
    return [c.lower() for c in s if c in "ABCabc"]


def _parse_ga_name(name, season_prefix):
    """Parse GA filename remainder into occasion IDs."""
    name = name.strip()

    # Fixed occasion IDs (must match actual JSON filenames without .json)
    specials_fixed = {
        "Ascension": ["ascension"],  # has -a/-b/-c
        "Pentecost": ["pentecost"],  # has -a/-b/-c
        "Trinity": ["solemnity-most-holy-trinity"],
        "CorpusChristi": ["solemnity-body-blood-of-christ"],
        "Corpus Christi": ["solemnity-body-blood-of-christ"],
        "Easter Sunday": ["easter-sunday-abc"],
        "Easter_Sunday": ["easter-sunday-abc"],
        "Palm Sunday": ["palm-sunday"],
        "HolyFamily": ["holy-family"],
        "Holy Family": ["holy-family"],
        "Epiphany": ["the-epiphany-of-the-lord-abc"],
        "Baptism": ["baptism-of-the-lord"],
        "ImmaculateConception": ["solemnity-immaculate-conception"],
        "Immaculate Conception": ["solemnity-immaculate-conception"],
        "Annunciation": ["annunciation-abc"],
        "St Joseph": ["st-joseph-abc"],
        "StJoseph": ["st-joseph-abc"],
        "Assumption During Day": ["assumption-abc"],
        "Assumption of BVM": ["assumption-abc"],
        "Assumption": ["assumption-abc"],
        "Dedication of LB": ["the-dedication-of-nov-9-the-lateran-basilica-abc"],
        "Exaltation of HC": ["feast-the-exaltation-sep-14-of-the-holy-cross-abc"],
        "JtB During Day": ["birth-of-john-the-baptist-abc"],
        "JtB Vigil": ["birth-of-john-the-baptist-vigil-abc"],
        "Presentation of the Lord": ["feast-abc-feb-2-presentation-of-the-lord"],
        "Transfiguration": ["transfiguration-abc"],
        "Sacred Heart": ["sacred-heart"],
        "St Peter and Paul Vigil": ["ss-peter-paul-apostles-jun-29-at-the-vigil-mass-abc"],
        "St Peter and Paul During the Day": ["ss-peter-paul-apostles-jun-29-mass-during-the-day-abc"],
        "All Saints": ["solemnity-nov-1-all-saints-abc"],
        "AllSaints": ["solemnity-nov-1-all-saints-abc"],
        "All Souls": ["solemnity-nov-1-all-souls-abc"],
        "AllSouls": ["solemnity-nov-1-all-souls-abc"],
        "Christ the King": ["solemnity-christ-the-king"],  # needs -a/-b/-c
        "ChristTheKing": ["solemnity-christ-the-king"],
        "Annunciation2": ["annunciation-abc"],  # duplicate key handled above
        "Midnight": ["nativity"],
        "Dawn": ["nativity"],
        "Day": ["nativity"],
        "Vigil": ["nativity"],
        "Ash Wednesday": ["ash-wednesday"],
        "AshWednesday": ["ash-wednesday"],
        "Holy Thursday": ["holy-thursday-lords-supper"],
        "HolyThursday": ["holy-thursday-lords-supper"],
        "PalmSunday": ["palm-sunday"],
        "GoodFriday": ["good-friday-passion"],
        "St Joseph": ["st-joseph"],
        "StJoseph": ["st-joseph"],
    }

    for special_name, fixed_ids in specials_fixed.items():
        if name.startswith(special_name):
            suffix = name[len(special_name):].strip("_ ")
            # For IDs that need year letters
            needs_year = any(oid in ("ascension", "pentecost", "holy-family", "baptism-of-the-lord",
                                      "solemnity-most-holy-trinity", "solemnity-body-blood-of-christ", "palm-sunday") for oid in fixed_ids)
            if needs_year:
                years = _parse_year_letters(suffix)
                return [f"{oid}-{y}" for oid in fixed_ids for y in years]
            return fixed_ids

    # Keep original specials dict for backward compat
    specials = {}

    for special_name, base_id in specials.items():
        if name.startswith(special_name):
            suffix = name[len(special_name):].strip("_ ")
            years = _parse_year_letters(suffix)
            if "-abc" in base_id or base_id.endswith("-abc"):
                return [base_id]
            return [f"{base_id}-{y}" for y in years]

    if "+" in name:
        parts = name.split("+")
        results = []
        for p in parts:
            results.extend(_parse_ga_name(p.strip(), season_prefix))
        return results

    # Compound with special name: "21A St Peter and Paul During the Day"
    m_compound = re.match(r'(\d+)([ABC])\s+(.*)', name)
    if m_compound:
        num, yr, rest = m_compound.groups()
        results = [f"{season_prefix}-{int(num):02d}-{yr.lower()}"]
        # Also parse the special name
        rest_ids = _parse_ga_name(rest.strip(), season_prefix)
        results.extend(rest_ids)
        return results

    # Compound space-separated like "12B 17B" or "12C 16B 20C 26A"
    space_parts = re.findall(r'(\d+)([ABC])', name)
    if len(space_parts) >= 2:
        results = []
        for num_s, yr in space_parts:
            num = int(num_s)
            base = f"{season_prefix}-{num:02d}" if season_prefix != "easter" or num != 2 else "easter-02-divine-mercy"
            results.append(f"{base}-{yr.lower()}")
        return results

    m = re.match(r'(\d+)\s*([ABC]+)?$', name)
    if m:
        num = int(m.group(1))
        year_str = m.group(2) or "ABC"
        years = _parse_year_letters(year_str)

        if season_prefix == "ordinary-time":
            base = f"ordinary-time-{num:02d}"
        elif season_prefix == "advent":
            base = f"advent-{num:02d}"
        elif season_prefix == "lent":
            base = f"lent-{num:02d}"
            # Year A lent 3-5 have scrutiny suffixes
            result = []
            for y in years:
                if y == "a" and num == 3: result.append("lent-03-a-first-scrutiny")
                elif y == "a" and num == 4: result.append("lent-04-a-second-scrutiny")
                elif y == "a" and num == 5: result.append("lent-05-a-third-scrutiny")
                else: result.append(f"{base}-{y}")
            return result
        elif season_prefix == "easter":
            base = f"easter-{num:02d}"
            if num == 2:
                base = "easter-02-divine-mercy"
        else:
            base = f"{season_prefix}-{num:02d}"

        return [f"{base}-{y}" for y in years]

    m2 = re.match(r'(\d+)([ABC])\+(\d+)([ABC])', name.replace(" ",""))
    if m2:
        n1, y1, n2, y2 = m2.groups()
        results = []
        for num, yr in [(int(n1), y1.lower()), (int(n2), y2.lower())]:
            results.append(f"{season_prefix}-{num:02d}-{yr}")
        return results

    return []


# === MAP GOSPEL ACCLAMATIONS ===
ga_manifest = []
unmapped_ga = []

SEASON_MAP = {
    "Advent": "advent",
    "Christmas": "christmas",
    "Easter": "easter",
    "Lent": "lent",
    "OT": "ordinary-time",
}

# Duplicate subfolders to skip
SKIP_SUBDIRS = {"EasterAudio_LyricGospelAcclamations", "ChristmasAudio_LyricGospelAcclamations",
                "LentAudio_LyricGospelAcclamations", "AdventAudio_LyricGospelAcclamations",
                "OTAudio_LyricGospelAcclamations"}

for season_dir in sorted(GA_ROOT.iterdir()):
    if not season_dir.is_dir():
        continue
    season_key = season_dir.name
    season_prefix = SEASON_MAP.get(season_key)
    if not season_prefix:
        continue

    for mp3 in sorted(season_dir.glob("*.mp3")):
        stem = mp3.stem

        # Skip FULL recordings (composite refrain+verse)
        if "_FULL" in stem or stem.endswith("_FULL"):
            continue

        # Refrain recordings
        if "Refrain" in stem or "refrain" in stem:
            ga_manifest.append({
                "filePath": str(mp3),
                "type": "refrain",
                "season": season_key,
                "occasionIds": [],  # applies to all occasions in this season
                "category": "gospel_acclamation",
            })
            continue

        # Parse verse filename: "SEASON_NX.mp3" or "SEASON_SpecialName.mp3"
        # Examples: ADVENT_1ABC, LENT_3A, OT 30C, EASTER_Ascension_ABC
        # Remove season prefix
        name = stem
        for prefix in [f"{season_key.upper()}_", f"{season_key} ", f"{season_key.upper()} "]:
            if name.startswith(prefix):
                name = name[len(prefix):]
                break

        occasion_ids = _parse_ga_name(name, season_prefix)
        valid_ids = [oid for oid in occasion_ids if oid in occasions]

        if not valid_ids:
            unmapped_ga.append({"file": str(mp3), "parsed_name": name, "tried": occasion_ids})
            continue

        ga_manifest.append({
            "filePath": str(mp3),
            "type": "verse",
            "season": season_key,
            "occasionIds": valid_ids,
            "category": "gospel_acclamation",
        })


# === REPORT ===
print(f"=== LYRIC PSALTER ===")
print(f"  Mapped: {len(psalter_manifest)} files -> {sum(len(m['occasionIds']) for m in psalter_manifest)} occasion links")
print(f"  With psalm match: {sum(1 for m in psalter_manifest if m['psalmTitle'])} / {len(psalter_manifest)}")
print(f"  Unmapped: {len(unmapped_psalter)}")
for u in unmapped_psalter[:10]:
    print(f"    {u.get('track', u.get('reason','?'))} -> tried: {u.get('tried','')}")

print(f"\n=== GOSPEL ACCLAMATIONS ===")
verses = [m for m in ga_manifest if m["type"] == "verse"]
refrains = [m for m in ga_manifest if m["type"] == "refrain"]
print(f"  Verse files mapped: {len(verses)} -> {sum(len(m['occasionIds']) for m in verses)} occasion links")
print(f"  Refrain files: {len(refrains)}")
print(f"  Unmapped: {len(unmapped_ga)}")
for u in unmapped_ga[:10]:
    print(f"    {u['parsed_name']} -> tried: {u['tried']}")

# Save manifest
manifest = {
    "psalter": psalter_manifest,
    "gospel_acclamations": ga_manifest,
    "unmapped_psalter": unmapped_psalter,
    "unmapped_ga": unmapped_ga,
}
out_path = Path(__file__).parent / "audio-manifest.json"
with open(out_path, "w") as f:
    json.dump(manifest, f, indent=2)
print(f"\nManifest saved to {out_path}")
