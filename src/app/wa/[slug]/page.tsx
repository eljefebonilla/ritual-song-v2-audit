import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignedSlug, isWithinTimeWindow } from "@/lib/generators/slug-signing";
import { getOccasion } from "@/lib/data";
import type { SetlistSongRow, SetlistSongEntry } from "@/lib/booking-types";
import type { Reading } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WorshipAidMobilePage({ params }: Props) {
  const { slug } = await params;

  // Verify HMAC signature
  const parsed = verifySignedSlug(slug);
  if (!parsed) {
    return <ExpiredPage message="Invalid worship aid link." />;
  }

  const supabase = createAdminClient();

  // Find the parish by slug-like name match
  const { data: parishes } = await supabase
    .from("parishes")
    .select("id, name, timezone");

  const parish = parishes?.find((p) => {
    const parishSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return parishSlug === parsed.parishSlug || parishSlug.startsWith(parsed.parishSlug);
  });

  if (!parish) {
    return <ExpiredPage message="Parish not found." />;
  }

  // Find mass event by occasion_id
  const { data: massEvents } = await supabase
    .from("mass_events")
    .select("id, event_date, start_time_12h, ensemble, liturgical_name, occasion_id")
    .eq("occasion_id", parsed.occasionCode)
    .order("event_date", { ascending: false })
    .limit(5);

  const massEvent = massEvents?.[0];
  if (!massEvent) {
    return <ExpiredPage message="No Mass found for this occasion." parishName={parish.name} />;
  }

  // Check time window
  if (!isWithinTimeWindow(massEvent.event_date)) {
    return (
      <ExpiredPage
        message="This worship aid has expired. Content is only available within 7 days of the occasion."
        parishName={parish.name}
      />
    );
  }

  // Fetch setlist
  const { data: setlist } = await supabase
    .from("setlists")
    .select("songs, occasion_name")
    .eq("mass_event_id", massEvent.id)
    .maybeSingle();

  // Fetch brand config
  const { data: brand } = await supabase
    .from("parish_brand_config")
    .select("*")
    .eq("parish_id", parish.id)
    .maybeSingle();

  // Load occasion for readings
  const occasion = massEvent.occasion_id ? getOccasion(massEvent.occasion_id) : null;

  const songRows = (setlist?.songs || []) as SetlistSongRow[];
  const occasionName = setlist?.occasion_name || massEvent.liturgical_name || "Mass";
  const dateDisplay = formatDate(massEvent.event_date);

  // Fetch lyrics for songs that have LYR resources
  const lyricsMap = new Map<string, string>();
  const songIds = songRows
    .flatMap((r) => r.songs)
    .filter((s) => s.song_library_id)
    .map((s) => s.song_library_id!);

  if (songIds.length > 0) {
    const { data: lyrResources } = await supabase
      .from("song_resources_v2")
      .select("song_id, value")
      .in("song_id", songIds)
      .eq("type", "lyrics");

    for (const r of lyrResources || []) {
      if (r.value) lyricsMap.set(r.song_id, r.value);
    }
  }

  const primaryColor = brand?.primary_color || "#333333";
  const accentColor = brand?.accent_color || "#4A90D9";
  const headingFont = brand?.heading_font || "Playfair Display";
  const bodyFont = brand?.body_font || "Inter";
  const parishName = brand?.parish_display_name || parish.name;

  return (
    <div
      className="min-h-screen bg-stone-50"
      style={{
        // @ts-expect-error CSS custom properties
        "--brand-primary": primaryColor,
        "--brand-accent": accentColor,
        "--brand-heading-font": `"${headingFont}", serif`,
        "--brand-body-font": `"${bodyFont}", sans-serif`,
      }}
    >
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center pb-3 mb-5" style={{ borderBottom: `2px solid ${accentColor}` }}>
          <div className="text-[10px] tracking-[3px] uppercase" style={{ color: accentColor }}>
            {parishName}
          </div>
          <h1 className="text-2xl font-bold mt-1" style={{ fontFamily: `"${headingFont}", serif`, color: primaryColor }}>
            {occasionName}
          </h1>
          <div className="text-sm text-stone-400 mt-1">{dateDisplay}</div>
        </div>

        {/* Content in Mass order */}
        {renderMassSections(songRows, occasion, lyricsMap, accentColor, primaryColor, headingFont)}

        {/* Footer */}
        <div className="text-center text-[10px] text-stone-300 pt-4 mt-6 border-t border-stone-200">
          {parishName} &bull; Powered by Ritual Song
        </div>
      </div>
    </div>
  );
}

function renderMassSections(
  songRows: SetlistSongRow[],
  occasion: ReturnType<typeof getOccasion>,
  lyricsMap: Map<string, string>,
  accentColor: string,
  primaryColor: string,
  headingFont: string
) {
  const sections: { section: string; positions: string[] }[] = [
    { section: "Introductory Rites", positions: ["gathering", "penitential_act", "gloria"] },
    { section: "Liturgy of the Word", positions: ["psalm", "gospel_acclamation"] },
    { section: "Preparation of the Gifts", positions: ["offertory"] },
    { section: "Liturgy of the Eucharist", positions: ["holy", "memorial", "amen", "lords_prayer", "fraction_rite"] },
    { section: "Communion Rite", positions: ["communion_1", "communion_2", "communion_3"] },
    { section: "Concluding Rites", positions: ["sending"] },
  ];

  return sections.map((sec) => {
    const items: React.ReactNode[] = [];

    // Add readings for Liturgy of the Word
    if (sec.section === "Liturgy of the Word" && occasion) {
      const first = occasion.readings.find((r: Reading) => r.type === "first");
      if (first) items.push(<ReadingBlock key="r-first" label="First Reading" reading={first} accentColor={accentColor} />);
    }

    for (const position of sec.positions) {
      const row = songRows.find((r) => r.position === position);
      if (!row) continue;

      if (position === "psalm" && occasion) {
        const psalm = occasion.readings.find((r: Reading) => r.type === "psalm");
        if (psalm?.antiphon) {
          items.push(
            <div key="psalm-resp" className="mx-3 my-3 p-3 rounded-r-md" style={{ background: `color-mix(in srgb, ${accentColor} 8%, white)`, borderLeft: `3px solid ${accentColor}` }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: accentColor }}>Response</div>
              <div className="italic text-base" style={{ fontFamily: `"${headingFont}", serif`, color: primaryColor }}>
                {psalm.antiphon}
              </div>
            </div>
          );
        }
      }

      if (position === "gospel_acclamation" && occasion) {
        const second = occasion.readings.find((r: Reading) => r.type === "second");
        if (second) items.push(<ReadingBlock key="r-second" label="Second Reading" reading={second} accentColor={accentColor} />);
        const gospel = occasion.readings.find((r: Reading) => r.type === "gospel");
        if (gospel) items.push(<ReadingBlock key="r-gospel" label="Gospel" reading={gospel} accentColor={accentColor} />);
      }

      for (const song of row.songs) {
        const lyrics = song.song_library_id ? lyricsMap.get(song.song_library_id) : null;
        items.push(
          <SongBlock
            key={`${position}-${song.title}`}
            position={row.label}
            song={song}
            lyrics={lyrics || null}
            accentColor={accentColor}
          />
        );
      }
    }

    if (items.length === 0) return null;

    return (
      <div key={sec.section} className="mb-5">
        <h2
          className="text-sm font-bold pb-1 mb-3"
          style={{ fontFamily: `"${headingFont}", serif`, color: primaryColor, borderBottom: `1px solid ${accentColor}` }}
        >
          {sec.section}
        </h2>
        {items}
      </div>
    );
  });
}

function SongBlock({
  position,
  song,
  lyrics,
  accentColor,
}: {
  position: string;
  song: SetlistSongEntry;
  lyrics: string | null;
  accentColor: string;
}) {
  return (
    <div className="mb-3 pl-3">
      <div className="text-[10px] uppercase tracking-wider" style={{ color: accentColor }}>
        {position}
      </div>
      <div className="font-semibold">{song.title}</div>
      {song.composer && <div className="text-sm text-stone-500 italic">{song.composer}</div>}
      {lyrics && (
        <div className="mt-2 text-sm text-stone-600 whitespace-pre-line leading-relaxed">
          {lyrics}
        </div>
      )}
    </div>
  );
}

function ReadingBlock({
  label,
  reading,
  accentColor,
}: {
  label: string;
  reading: Reading;
  accentColor: string;
}) {
  return (
    <div className="mb-3 pl-3">
      <div className="text-[10px] uppercase tracking-wider" style={{ color: accentColor }}>
        {label}
      </div>
      <div className="font-semibold">{reading.citation}</div>
      <div className="text-sm text-stone-500 italic">{reading.summary}</div>
    </div>
  );
}

function ExpiredPage({ message, parishName }: { message: string; parishName?: string }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {parishName && (
          <div className="text-xs tracking-widest uppercase text-stone-400 mb-2">
            {parishName}
          </div>
        )}
        <h1 className="text-lg font-semibold text-stone-700 mb-2">Worship Aid Unavailable</h1>
        <p className="text-sm text-stone-500">{message}</p>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
