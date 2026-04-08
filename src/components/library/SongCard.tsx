"use client";

import type { LibrarySong, ResourceDisplayCategory, SongResource } from "@/lib/types";
import { getResourceDisplayCategory } from "@/lib/song-library";
import { useMedia } from "@/lib/media-context";
import { extractChartKeys } from "@/lib/key-utils";
import { MASS_POSITION_LABELS, MASS_POSITION_ORDER, ENSEMBLE_BADGES } from "@/lib/occasion-helpers";
import InlinePlayButton from "@/components/ui/InlinePlayButton";

interface CalendarMeta {
  positions: Set<string>;
  ensembles: Set<string>;
}

interface SongRowProps {
  song: LibrarySong;
  isSelected: boolean;
  onClick: () => void;
  calendarMeta?: CalendarMeta | null;
  hasAlleluia?: boolean;
  isLent?: boolean;
  uploadedAudioUrl?: string;
  youtubeUrl?: string;
  scriptureMatchRefs?: string[];
}

const BUTTON_STYLES: Record<ResourceDisplayCategory, { bg: string; text: string; label: string }> = {
  aim: { bg: "bg-amber-100 hover:bg-amber-200", text: "text-amber-700", label: "AIM" },
  audio: { bg: "bg-red-100 hover:bg-red-200", text: "text-red-700", label: "" },
  lead_sheet: { bg: "bg-emerald-100 hover:bg-emerald-200", text: "text-emerald-700", label: "" },
  choral: { bg: "bg-violet-100 hover:bg-violet-200", text: "text-violet-700", label: "" },
  color: { bg: "bg-sky-100 hover:bg-sky-200", text: "text-sky-700", label: "" },
};

function getFirstResource(song: LibrarySong, category: ResourceDisplayCategory): SongResource | null {
  for (const r of song.resources) {
    if (getResourceDisplayCategory(r) === category) return r;
  }
  return null;
}

function resourceUrl(resource: SongResource): string | null {
  if (resource.url) return resource.url;
  if (resource.filePath) return `/api/music/${encodeURIComponent(resource.filePath)}`;
  return null;
}

// Inline SVG icons for each resource type
function AudioIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function SheetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MusicNoteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  );
}

const CATEGORY_ORDER: ResourceDisplayCategory[] = ["aim", "audio", "lead_sheet", "choral", "color"];

function titleContainsAlleluia(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("alleluia") || lower.includes("hallelujah");
}

export default function SongCard({ song, isSelected, onClick, calendarMeta, hasAlleluia, isLent, uploadedAudioUrl, youtubeUrl, scriptureMatchRefs }: SongRowProps) {
  // If hasAlleluia not explicitly passed, infer from title
  const showAlleluiaBadge = hasAlleluia ?? titleContainsAlleluia(song.title);
  const { play } = useMedia();

  // Determine which resource categories are available
  const available = new Map<ResourceDisplayCategory, SongResource>();
  for (const cat of CATEGORY_ORDER) {
    const r = getFirstResource(song, cat);
    if (r) available.set(cat, r);
  }

  // If no local audio but there's uploaded audio, add a synthetic entry
  if (!available.has("audio") && uploadedAudioUrl) {
    available.set("audio", {
      id: `uploaded-${song.id}`,
      type: "audio",
      label: "Uploaded Audio",
      url: uploadedAudioUrl,
      source: "supabase",
    });
  }

  // YouTube fallback (from batch-audio API or song.youtubeUrl)
  const ytUrl = youtubeUrl || song.youtubeUrl;
  if (!available.has("audio") && ytUrl) {
    available.set("audio", {
      id: `youtube-${song.id}`,
      type: "youtube",
      label: "YouTube",
      url: ytUrl,
    });
  }

  // Derive audio info for inline play button
  const audioResource = available.get("audio");
  const inlineAudioUrl = audioResource ? resourceUrl(audioResource) : null;
  const inlineAudioType: "audio" | "youtube" | null = audioResource
    ? (audioResource.type === "youtube" ? "youtube" : "audio")
    : null;
  const sheetPaths = song.resources
    .filter((r) => r.type === "sheet_music" && r.filePath)
    .map((r) => r.filePath!);

  const handleResourceClick = (e: React.MouseEvent, cat: ResourceDisplayCategory, resource: SongResource) => {
    e.stopPropagation();
    const url = resourceUrl(resource);
    if (!url) return;

    if (cat === "audio") {
      const sheetPaths = song.resources
        .filter((r) => r.type === "sheet_music" && r.filePath)
        .map((r) => r.filePath!);
      play({
        type: resource.type === "youtube" ? "youtube" : "audio",
        url,
        title: song.title,
        subtitle: resource.label,
        songId: song.id,
        recordedKey: song.recordedKey,
        chartKeys: extractChartKeys(sheetPaths),
      });
    } else {
      window.open(url, "_blank");
    }
  };

  const getIcon = (cat: ResourceDisplayCategory) => {
    switch (cat) {
      case "aim": return null; // uses text label
      case "audio": return <AudioIcon />;
      case "lead_sheet": return <SheetIcon />;
      case "choral": return <MusicNoteIcon />;
      case "color": return <SheetIcon />;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`text-left w-full px-3 py-2.5 border-b transition-colors ${
        isSelected
          ? "bg-stone-100 border-stone-300"
          : "bg-white border-stone-100 hover:bg-stone-50"
      }`}
    >
      <div>
        {calendarMeta && calendarMeta.positions.size > 0 && (
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
              {[...calendarMeta.positions]
                .sort((a, b) => (MASS_POSITION_ORDER[a] ?? 99) - (MASS_POSITION_ORDER[b] ?? 99))
                .map((p) => MASS_POSITION_LABELS[p] || p)
                .join(" / ")}
            </span>
            {[...calendarMeta.ensembles].map((c) => {
              const badge = ENSEMBLE_BADGES[c];
              if (!badge) return null;
              return (
                <span
                  key={c}
                  title={c.charAt(0).toUpperCase() + c.slice(1)}
                  className="inline-flex items-center justify-center rounded-full"
                  style={{
                    width: "16px",
                    height: "16px",
                    fontSize: "9px",
                    fontWeight: 700,
                    lineHeight: "16px",
                    textAlign: "center" as const,
                    backgroundColor: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.text}30`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(0,0,0,0.08)`,
                  }}
                >
                  {badge.letter}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <InlinePlayButton
            audioUrl={inlineAudioUrl}
            audioType={inlineAudioType}
            title={song.title}
            subtitle={song.composer}
            songId={song.id}
            recordedKey={song.recordedKey}
            chartKeys={extractChartKeys(sheetPaths)}
            size="sm"
          />
          <p className="text-sm font-semibold text-stone-800 leading-tight truncate">
            {song.title}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {song.composer && (
            <p className="text-xs text-stone-400 truncate">
              {song.composer}
            </p>
          )}
          <span className="text-[10px] text-stone-300 shrink-0">
            Used {song.usageCount}x
          </span>
          {showAlleluiaBadge && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                isLent
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-50 text-amber-600"
              }`}
              title={isLent ? "Contains Alleluia — not suitable for Lenten liturgy" : "Contains Alleluia"}
            >
              {isLent ? "Alleluia!" : "Alleluia"}
            </span>
          )}
        </div>

        {/* Scripture match badges — shown when scripture match filter is active */}
        {scriptureMatchRefs && scriptureMatchRefs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {scriptureMatchRefs.slice(0, 3).map((ref) => (
              <span
                key={ref}
                className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/60"
              >
                {ref}
              </span>
            ))}
          </div>
        )}

        {/* Resource action buttons — left-aligned under title */}
        {available.size > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {CATEGORY_ORDER.map((cat) => {
              const resource = available.get(cat);
              if (!resource) return null;
              const style = BUTTON_STYLES[cat];
              return (
                <button
                  key={cat}
                  onClick={(e) => handleResourceClick(e, cat, resource)}
                  title={style.label || cat.replace("_", " ")}
                  className={`inline-flex items-center justify-center rounded transition-colors ${style.bg} ${style.text} ${
                    cat === "aim"
                      ? "px-1.5 py-0.5 text-[9px] font-bold"
                      : "w-6 h-6"
                  }`}
                >
                  {cat === "aim" ? "AIM" : getIcon(cat)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
}
