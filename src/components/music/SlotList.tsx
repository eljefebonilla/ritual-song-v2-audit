"use client";

import { useState, useRef } from "react";
import type { RefObject } from "react";
import type { WorshipSlot, OccasionResource, LectionarySynopsis } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/worship-slots";
import { useMedia } from "@/lib/media-context";
import InteractiveSongSlot from "./InteractiveSongSlot";
import SongSlot from "./SongSlot";
import CustomSlotForm from "./CustomSlotForm";

type CustomSlotType = "song" | "reading" | "ritual_moment" | "note" | "mass_part";

interface SlotListProps {
  slots: WorshipSlot[];
  seasonColor: string;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string, slotRole: string) => void;
  selectedRowRef?: RefObject<HTMLDivElement | null>;
  audioOverrides?: Record<string, string>;
  youtubeOverrides?: Record<string, string>;
  presider?: string;
  massNotes?: string[];
  synopsis?: LectionarySynopsis | null;
  songHints?: Map<string, string>;
  isAdmin?: boolean;
  onSlotEdit?: (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string; description?: string }) => void;
  onSlotReorder?: (fromIndex: number, toIndex: number) => void;
  /** Override section header labels (e.g. Good Friday: eucharist -> "Veneration of the Cross and Holy Communion") */
  sectionLabelOverrides?: Record<string, string>;
  // Custom slot props
  occasionId?: string;
  ensembleId?: string;
  onCustomSlotCreate?: (ensembleId: string, slotType: string, label: string, orderPosition: number, content: Record<string, unknown>) => Promise<void>;
  onCustomSlotUpdate?: (slotId: string, ensembleId: string, updates: { label?: string; content?: Record<string, unknown> }) => Promise<void>;
  onCustomSlotDelete?: (slotId: string, ensembleId: string) => Promise<void>;
}

// ===== SVG Icons (inline, matching project pattern) =====

function IconPlus({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconEdit({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconTrash({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ===== Type picker icon/label data =====

const CUSTOM_SLOT_OPTIONS: { type: CustomSlotType; label: string; icon: string }[] = [
  { type: "song", label: "Song", icon: "\u266B" },           // musical note
  { type: "reading", label: "Reading", icon: "\uD83D\uDCD6" }, // open book
  { type: "ritual_moment", label: "Ritual Moment", icon: "\u271A" }, // cross
  { type: "note", label: "Note", icon: "\u270E" },           // pencil
  { type: "mass_part", label: "Mass Part", icon: "\uD83D\uDCDC" }, // scroll
];

// ===== Section Header =====

function SectionHeader({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border-y border-stone-100">
      <div
        className="w-1 h-4 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">
        {title}
      </span>
    </div>
  );
}

// ===== Play button for antiphon/resource rows =====

function SlotPlayButton({ resources }: { resources?: OccasionResource[] }) {
  const { play, stop, current } = useMedia();
  const audioResource = resources?.find((r) => r.type === "audio");
  if (!audioResource) return null;

  const url = audioResource.filePath.startsWith("http")
    ? audioResource.filePath
    : `/api/music/${encodeURIComponent(audioResource.filePath)}`;
  const isPlaying = current?.url === url;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      stop();
    } else {
      play({
        type: "audio",
        url,
        title: audioResource.label,
        subtitle: audioResource.category === "gospel_acclamation"
          ? "Gospel Acclamation"
          : "Antiphon",
      });
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="w-6 h-6 flex items-center justify-center rounded-full transition-all active:scale-95"
      title={isPlaying ? "Stop" : "Play"}
      style={{
        background: isPlaying ? "linear-gradient(145deg, #292524, #1c1917)" : "#292524",
        border: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
      }}
    >
      {isPlaying ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2.5" strokeLinejoin="round">
          <polygon points="6,3 20,12 6,21" />
        </svg>
      )}
    </button>
  );
}

// ===== Standard row components =====

const READING_TYPE_TO_SYNOPSIS_KEY: Record<string, "first" | "second" | "gospel"> = {
  first: "first",
  second: "second",
  gospel: "gospel",
};

function ReadingRow({ slot, synopsis, isExpanded, onToggle }: {
  slot: WorshipSlot;
  synopsis?: LectionarySynopsis | null;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  if (!slot.reading) return null;
  const r = slot.reading;
  const synopsisKey = READING_TYPE_TO_SYNOPSIS_KEY[r.type];
  const readingSynopsis = synopsisKey ? synopsis?.readings[synopsisKey] : null;

  // For psalm readings, the citation may contain the refrain after a newline.
  // Split it so we can show the verse reference as citation and the refrain in burgundy.
  const isPsalm = r.type === "psalm";
  const citationParts = r.citation.split("\n");
  const displayCitation = citationParts[0];
  // Extract just the refrain text (after the first line). The antiphon field often
  // contains the full citation+refrain string, so prefer splitting from citation.
  const psalmRefrain = isPsalm && citationParts.length > 1
    ? citationParts.slice(1).join(" ").trim()
    : (r.antiphon && r.antiphon !== r.citation
      ? r.antiphon.split("\n").slice(1).join(" ").trim() || r.antiphon
      : null);

  return (
    <div className="py-2 px-3 bg-stone-50/50 border-l-2 border-stone-200">
      <div className="flex items-start gap-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
          {slot.label}
        </span>
        <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
          <SlotPlayButton resources={slot.resources} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-stone-700">{displayCitation}</p>
            {readingSynopsis && (
              <button
                onClick={onToggle}
                className="text-stone-300 hover:text-stone-500 transition-colors shrink-0"
                title={isExpanded ? "Hide synopsis" : "Show synopsis"}
              >
                <svg
                  width="12" height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
          {r.summary && (
            <p className="text-xs text-[#374151] mt-0.5">{r.summary}</p>
          )}
          {psalmRefrain && (
            <p className="text-xs italic mt-0.5 text-parish-burgundy">
              &ldquo;{psalmRefrain}&rdquo;
            </p>
          )}
          {!isPsalm && r.antiphon && (
            <p className="text-xs italic mt-0.5 text-parish-burgundy">
              &ldquo;{r.antiphon}&rdquo;
            </p>
          )}
          {isExpanded && readingSynopsis && (
            <p className="text-xs mt-1.5 bg-stone-50/50 rounded-lg p-3 border border-stone-200 text-[#4A5568]">
              {readingSynopsis.synopsis}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AntiphonRow({ slot }: { slot: WorshipSlot }) {
  if (!slot.antiphon) return null;
  const a = slot.antiphon;
  return (
    <div className="flex items-start gap-3 py-2 px-3 bg-stone-50/50 border-l-2 border-stone-200 overflow-hidden">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
      </span>
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
        <SlotPlayButton resources={slot.resources} />
      </span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-xs text-muted">
          {a.citation}
          {slot.optionNumber != null && (
            <span className="ml-1">
              (Option {slot.optionNumber})
            </span>
          )}
        </p>
        <p className="text-sm font-serif italic mt-0.5 text-parish-burgundy line-clamp-3">
          &ldquo;{a.text}&rdquo;
        </p>
      </div>
    </div>
  );
}


function GospelAcclamationRow({
  slot,
  isAdmin,
  onSlotEdit,
  selectedSongId,
  onSongSelect,
  selectedRowRef,
  audioOverrides,
  youtubeOverrides,
}: {
  slot: WorshipSlot;
  isAdmin?: boolean;
  onSlotEdit?: (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string; description?: string }) => void;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string, slotRole: string) => void;
  selectedRowRef?: RefObject<HTMLDivElement | null>;
  audioOverrides?: Record<string, string>;
  youtubeOverrides?: Record<string, string>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const ga = slot.gospelAcclamation;
  if (!ga) return null;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = rowRef.current;
    if (!el || !onSlotEdit) return;
    onSlotEdit(slot.role, el.getBoundingClientRect(), {
      title: ga.title,
      composer: ga.composer,
    });
  };

  // Resolve for audio playback
  const resolved = slot.resolvedSong;
  const isSelected = resolved ? selectedSongId === resolved.id : false;
  const overrideUrl = resolved ? audioOverrides?.[resolved.id] : undefined;
  const ytOverrideUrl = resolved ? youtubeOverrides?.[resolved.id] : undefined;
  const finalResolved = resolved && overrideUrl
    ? { ...resolved, audioUrl: overrideUrl, audioType: "audio" as const }
    : resolved && !resolved.audioUrl && ytOverrideUrl
    ? { ...resolved, audioUrl: ytOverrideUrl, audioType: "youtube" as const }
    : resolved;

  return (
    <div ref={rowRef} className="py-2 px-3">
      <div className="flex items-start gap-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
          {slot.label}
        </span>
        <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
          {finalResolved?.audioUrl ? (
            <button
              onClick={() => onSongSelect?.(finalResolved.id, slot.role)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isSelected
                  ? "linear-gradient(145deg, #7f1d1d, #991b1b)"
                  : "linear-gradient(145deg, #7f1d1d0a, transparent)",
                border: `2px solid #7f1d1d`,
                boxShadow: isSelected
                  ? "0 0 8px #7f1d1d30, 0 1px 4px #7f1d1d20"
                  : "0 1px 4px #7f1d1d15",
              }}
              title="Play"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7f1d1d" strokeWidth="2.5" strokeLinejoin="round">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            </button>
          ) : (
            <SlotPlayButton resources={slot.resources} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {/* Setting line — refrain title + composer */}
          <p className="text-sm font-medium text-stone-800 leading-snug">
            {ga.title}
          </p>
          {ga.composer && (
            <p className="text-xs text-stone-500">{ga.composer}</p>
          )}
        </div>
        {isAdmin && onSlotEdit && (
          <button
            onClick={handleEditClick}
            className="shrink-0 p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
            title="Edit gospel acclamation"
          >
            <IconEdit />
          </button>
        )}
      </div>
    </div>
  );
}

function MassSettingRow({ slot, isAdmin, onSlotEdit }: {
  slot: WorshipSlot;
  isAdmin?: boolean;
  onSlotEdit?: (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string; description?: string }) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = rowRef.current;
    if (!el || !onSlotEdit) return;
    onSlotEdit(slot.role, el.getBoundingClientRect(), slot.massSetting ? {
      title: slot.massSetting.name,
      composer: slot.massSetting.composer,
    } : undefined);
  };

  if (!slot.massSetting) {
    return (
      <div
        ref={rowRef}
        className={`flex items-center gap-3 py-2.5 px-3 ${
          isAdmin && onSlotEdit ? "cursor-pointer hover:bg-stone-50 transition-colors group" : ""
        }`}
        onClick={isAdmin && onSlotEdit ? handleEditClick : undefined}
      >
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0">
          {slot.label}
        </span>
        <span className="w-7 shrink-0" />
        <span className="text-sm text-stone-300 italic flex-1">
          {isAdmin ? "Pick a setting..." : "\u2014"}
        </span>
        {isAdmin && onSlotEdit && (
          <span className="text-stone-300 group-hover:text-stone-500 transition-colors">
            <IconEdit />
          </span>
        )}
      </div>
    );
  }

  return (
    <div ref={rowRef} className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
      </span>
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-800">
          {slot.massSetting.name}
        </p>
        {slot.massSetting.composer && (
          <p className="text-xs text-stone-500">
            {slot.massSetting.composer}
          </p>
        )}
      </div>
      {isAdmin && onSlotEdit && (
        <button
          onClick={handleEditClick}
          className="shrink-0 p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
          title="Edit mass setting"
        >
          <IconEdit />
        </button>
      )}
    </div>
  );
}

function ResourceRow({ slot }: { slot: WorshipSlot }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
      </span>
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
        <SlotPlayButton resources={slot.resources} />
      </span>
      <div className="min-w-0 flex-1">
        {slot.reading && (
          <p className="text-sm font-medium text-stone-700">
            {slot.reading.citation}
          </p>
        )}
      </div>
    </div>
  );
}

function SongSlotRow({
  slot,
  selectedSongId,
  onSongSelect,
  selectedRowRef,
  audioOverrides,
  youtubeOverrides,
  hint,
  isAdmin,
  onSlotEdit,
}: {
  slot: WorshipSlot;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string, slotRole: string) => void;
  selectedRowRef?: RefObject<HTMLDivElement | null>;
  audioOverrides?: Record<string, string>;
  youtubeOverrides?: Record<string, string>;
  hint?: string;
  isAdmin?: boolean;
  onSlotEdit?: (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string; description?: string }) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const isLiturgicalText = slot.role === "gospel_acclamation";

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = rowRef.current;
    if (!el || !onSlotEdit) return;
    onSlotEdit(slot.role, el.getBoundingClientRect(), slot.song);
  };

  // Empty slot — show placeholder with edit affordance
  if (!slot.song) {
    return (
      <div
        ref={rowRef}
        className={`flex items-center gap-3 py-2.5 px-3 ${
          isAdmin && onSlotEdit ? "cursor-pointer hover:bg-stone-50 transition-colors group" : ""
        }`}
        onClick={isAdmin && onSlotEdit ? handleEditClick : undefined}
      >
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0">
          {slot.label}
        </span>
        <span className="w-7 shrink-0" />
        <span className="text-sm text-stone-300 italic flex-1">
          {isAdmin ? "Pick a song..." : "\u2014"}
        </span>
        {isAdmin && onSlotEdit && (
          <span className="text-stone-300 group-hover:text-stone-500 transition-colors">
            <IconEdit />
          </span>
        )}
      </div>
    );
  }

  const editButton = isAdmin && onSlotEdit ? (
    <button
      onClick={handleEditClick}
      className="shrink-0 p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
      title="Edit slot"
    >
      <IconEdit />
    </button>
  ) : null;

  const hintEl = hint ? (
    <div className="px-3 pb-1 -mt-1">
      <div className="flex items-start gap-3">
        <span className="w-28 shrink-0" />
        <span className="w-7 shrink-0" />
        <p className="text-[10px] italic text-stone-400 leading-tight">{hint}</p>
      </div>
    </div>
  ) : null;

  if (slot.resolvedSong) {
    const isSelected = selectedSongId === slot.resolvedSong.id;
    const overrideUrl = audioOverrides?.[slot.resolvedSong.id];
    const ytOverrideUrl = youtubeOverrides?.[slot.resolvedSong.id];
    const resolved = overrideUrl
      ? { ...slot.resolvedSong, audioUrl: overrideUrl, audioType: "audio" as const }
      : !slot.resolvedSong.audioUrl && ytOverrideUrl
      ? { ...slot.resolvedSong, audioUrl: ytOverrideUrl, audioType: "youtube" as const }
      : slot.resolvedSong;
    return (
      <>
        <div ref={rowRef}>
          <InteractiveSongSlot
            label={slot.label}
            song={slot.song}
            resolved={resolved}
            isSelected={isSelected}
            onSelect={onSongSelect ? () => onSongSelect(slot.resolvedSong!.id, slot.role) : undefined}
            rowRef={isSelected ? selectedRowRef : undefined}
            rightAction={editButton}
            isLiturgicalText={isLiturgicalText}
          />
        </div>
        {hintEl}
      </>
    );
  }

  return (
    <>
      <div
        ref={rowRef}
        className={onSongSelect ? "cursor-pointer hover:bg-stone-50 rounded transition-colors" : ""}
        onClick={onSongSelect ? () => onSongSelect(`unresolved:${slot.song!.title}`, slot.role) : undefined}
      >
        <SongSlot label={slot.label} song={slot.song} rightAction={editButton} isLiturgicalText={isLiturgicalText} />
      </div>
      {hintEl}
    </>
  );
}

// ===== Custom Slot Row Renderers (Deliverable 4) =====

/** Small "custom" indicator dot */
function CustomDot() {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 shrink-0"
      style={{ backgroundColor: "#B8A472" }}
      title="Custom slot"
    />
  );
}

/** BPM pill badge */
function BpmBadge({ bpm }: { bpm: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-500">
      {bpm} BPM
    </span>
  );
}

/** Edit + Delete buttons for custom slots (admin only) */
function CustomSlotActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
        title="Edit"
      >
        <IconEdit size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
        title="Delete"
      >
        <IconTrash size={12} />
      </button>
    </div>
  );
}

function CustomSongRow({
  slot,
  isAdmin,
  onEdit,
  onDelete,
}: {
  slot: WorshipSlot;
  isAdmin?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = slot.customContent || {};
  return (
    <div className="flex items-start gap-3 py-2 px-3" style={{ borderLeft: "2px solid #B8A472" }}>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5 flex items-center">
        {slot.label}
        <CustomDot />
      </span>
      <span className="w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-stone-800">{(c.title as string) || slot.label}</p>
          {c.bpm ? <BpmBadge bpm={String(c.bpm)} /> : null}
        </div>
        {c.composer ? <p className="text-xs text-stone-500">{String(c.composer)}</p> : null}
        {c.description ? <p className="text-xs text-stone-400 italic mt-0.5">{String(c.description)}</p> : null}
      </div>
      {isAdmin && <CustomSlotActions onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );
}

function CustomReadingRow({
  slot,
  isAdmin,
  onEdit,
  onDelete,
}: {
  slot: WorshipSlot;
  isAdmin?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = slot.customContent || {};
  return (
    <div className="py-2 px-3 bg-stone-50/50" style={{ borderLeft: "2px solid #B8A472" }}>
      <div className="flex items-start gap-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5 flex items-center">
          {slot.label}
          <CustomDot />
        </span>
        <span className="w-7 shrink-0" />
        <div className="min-w-0 flex-1">
          {c.citation ? <p className="text-sm font-medium text-stone-700">{String(c.citation)}</p> : null}
          {c.text ? <p className="text-xs text-stone-500 mt-0.5 whitespace-pre-line">{String(c.text)}</p> : null}
        </div>
        {isAdmin && <CustomSlotActions onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
  );
}

function CustomRitualMomentRow({
  slot,
  seasonColor,
  isAdmin,
  onEdit,
  onDelete,
}: {
  slot: WorshipSlot;
  seasonColor: string;
  isAdmin?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = slot.customContent || {};
  const notes = Array.isArray(c.notes) ? c.notes as { text: string; url?: string }[] : [];

  return (
    <div className="py-2 px-3" style={{ borderLeft: `3px solid ${seasonColor}` }}>
      <div className="flex items-start gap-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5 flex items-center">
          {slot.label}
          <CustomDot />
        </span>
        <span className="w-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800">{slot.label}</p>
          {c.description ? (
            <p className="text-xs text-stone-500 mt-0.5">{String(c.description)}</p>
          ) : null}
          {notes.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {notes.map((note, i) => (
                <li key={i} className="text-xs text-stone-600">
                  {note.url ? (
                    <a
                      href={note.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-parish-burgundy hover:underline"
                    >
                      {note.text}
                    </a>
                  ) : (
                    note.text
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        {isAdmin && <CustomSlotActions onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
  );
}

function CustomNoteRow({
  slot,
  isAdmin,
  onEdit,
  onDelete,
}: {
  slot: WorshipSlot;
  isAdmin?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = slot.customContent || {};
  const links = Array.isArray(c.links) ? c.links as { label: string; url: string }[] : [];

  return (
    <div className="py-2 px-3" style={{ borderLeft: "2px solid #B8A472" }}>
      <div className="flex items-start gap-3">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5 flex items-center">
          Note
          <CustomDot />
        </span>
        <span className="w-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-stone-700 whitespace-pre-line">{String(c.text || '')}</p>
            {c.bpm ? <BpmBadge bpm={String(c.bpm)} /> : null}
          </div>
          {links.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-parish-burgundy hover:underline"
                >
                  {link.label || link.url}
                </a>
              ))}
            </div>
          )}
        </div>
        {isAdmin && <CustomSlotActions onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
  );
}

function CustomMassPartRow({
  slot,
  isAdmin,
  onEdit,
  onDelete,
}: {
  slot: WorshipSlot;
  isAdmin?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = slot.customContent || {};
  return (
    <div className="flex items-start gap-3 py-2 px-3" style={{ borderLeft: "2px solid #B8A472" }}>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5 flex items-center">
        {slot.label}
        <CustomDot />
      </span>
      <span className="w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-800">
          {(c.name as string) || slot.label}
        </p>
        {c.setting ? <p className="text-xs text-stone-500">{String(c.setting)}</p> : null}
        {c.composer ? <p className="text-xs text-stone-400">{String(c.composer)}</p> : null}
      </div>
      {isAdmin && <CustomSlotActions onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );
}

// ===== Insert Zone (between slots, admin only) =====

function InsertZone({
  orderPosition,
  onInsert,
}: {
  orderPosition: number;
  onInsert: (slotType: CustomSlotType, orderPosition: number) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative group/insert">
      {/* Thin hover zone */}
      <div className="h-0 relative">
        <div className="absolute inset-x-3 -top-2 h-4 flex items-center justify-center z-10">
          {/* Line that appears on hover */}
          <div className="w-full h-px bg-transparent group-hover/insert:bg-stone-200 transition-colors" />
          {/* Plus button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPicker(!showPicker);
            }}
            className="absolute opacity-0 group-hover/insert:opacity-100 transition-opacity z-20 w-5 h-5 flex items-center justify-center rounded-full bg-white border border-stone-300 text-stone-400 hover:border-stone-500 hover:text-stone-600 shadow-sm"
          >
            <IconPlus size={10} />
          </button>
        </div>
      </div>

      {/* Type picker dropdown */}
      {showPicker && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setShowPicker(false)} />
          <div
            className="absolute left-1/2 -translate-x-1/2 top-1 z-40 bg-white border border-stone-200 rounded-lg shadow-lg py-1 min-w-[160px]"
          >
            {CUSTOM_SLOT_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                onClick={() => {
                  setShowPicker(false);
                  onInsert(opt.type, orderPosition);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors flex items-center gap-2"
              >
                <span className="w-4 text-center text-sm">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ===== Main SlotList Component =====

export default function SlotList({
  slots,
  seasonColor,
  selectedSongId,
  onSongSelect,
  selectedRowRef,
  audioOverrides,
  youtubeOverrides,
  presider,
  massNotes,
  synopsis,
  songHints,
  isAdmin,
  onSlotEdit,
  onSlotReorder,
  sectionLabelOverrides,
  ensembleId,
  onCustomSlotCreate,
  onCustomSlotUpdate,
  onCustomSlotDelete,
}: SlotListProps) {
  const [expandedReadings, setExpandedReadings] = useState<Set<string>>(
    new Set(["first", "second", "gospel"])
  );
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Custom slot form state
  const [customForm, setCustomForm] = useState<{
    slotType: CustomSlotType;
    orderPosition: number;
    mode: "create" | "edit";
    existingContent?: Record<string, unknown>;
    existingLabel?: string;
    existingSlotId?: string;
  } | null>(null);

  const toggleReading = (type: string) => {
    setExpandedReadings((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (slots.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-stone-400">
        No music data for this ensemble yet.
      </div>
    );
  }

  // Calculate insert position between two slots
  const getInsertOrder = (beforeSlot: WorshipSlot | null, afterSlot: WorshipSlot | null): number => {
    if (!beforeSlot && afterSlot) return afterSlot.order - 500;
    if (beforeSlot && !afterSlot) return beforeSlot.order + 1000;
    if (beforeSlot && afterSlot) return Math.round((beforeSlot.order + afterSlot.order) / 2);
    return 500;
  };

  const handleInsert = (slotType: CustomSlotType, orderPosition: number) => {
    setCustomForm({
      slotType,
      orderPosition,
      mode: "create",
    });
  };

  const handleEditCustom = (slot: WorshipSlot) => {
    if (!slot.customSlotId || !slot.customContent) return;
    setCustomForm({
      slotType: slot.role as CustomSlotType,
      orderPosition: slot.order,
      mode: "edit",
      existingContent: slot.customContent,
      existingLabel: slot.label,
      existingSlotId: slot.customSlotId,
    });
  };

  const handleDeleteCustom = (slot: WorshipSlot) => {
    if (!slot.customSlotId || !ensembleId || !onCustomSlotDelete) return;
    onCustomSlotDelete(slot.customSlotId, ensembleId);
  };

  const handleFormSave = async (label: string, content: Record<string, unknown>) => {
    if (!customForm || !ensembleId) return;
    if (customForm.mode === "create" && onCustomSlotCreate) {
      await onCustomSlotCreate(ensembleId, customForm.slotType, label, customForm.orderPosition, content);
    } else if (customForm.mode === "edit" && customForm.existingSlotId && onCustomSlotUpdate) {
      await onCustomSlotUpdate(customForm.existingSlotId, ensembleId, { label, content });
    }
    setCustomForm(null);
  };

  // Render a custom slot based on its kind
  const renderCustomSlot = (slot: WorshipSlot) => {
    const editFn = () => handleEditCustom(slot);
    const deleteFn = () => handleDeleteCustom(slot);

    switch (slot.kind) {
      case "song":
        return <CustomSongRow key={slot.id} slot={slot} isAdmin={isAdmin} onEdit={editFn} onDelete={deleteFn} />;
      case "reading":
        return <CustomReadingRow key={slot.id} slot={slot} isAdmin={isAdmin} onEdit={editFn} onDelete={deleteFn} />;
      case "ritual_moment":
        return <CustomRitualMomentRow key={slot.id} slot={slot} seasonColor={seasonColor} isAdmin={isAdmin} onEdit={editFn} onDelete={deleteFn} />;
      case "note":
        return <CustomNoteRow key={slot.id} slot={slot} isAdmin={isAdmin} onEdit={editFn} onDelete={deleteFn} />;
      case "mass_setting":
        return <CustomMassPartRow key={slot.id} slot={slot} isAdmin={isAdmin} onEdit={editFn} onDelete={deleteFn} />;
      default:
        return null;
    }
  };

  // Group slots by section, preserving order
  const sections: { key: WorshipSlot["section"]; slots: WorshipSlot[] }[] = [];
  let currentSection: WorshipSlot["section"] | null = null;

  for (const slot of slots) {
    if (slot.section !== currentSection) {
      currentSection = slot.section;
      sections.push({ key: slot.section, slots: [] });
    }
    sections[sections.length - 1].slots.push(slot);
  }

  return (
    <div className="divide-y divide-stone-100">
      {/* Meta info */}
      {(presider || (massNotes && massNotes.length > 0)) && (
        <div className="px-3 py-2">
          {presider && (
            <p className="text-xs text-stone-500">
              <span className="font-semibold">Presider:</span> {presider}
            </p>
          )}
          {massNotes?.map((note, i) => (
            <p key={i} className="text-xs text-stone-400 italic">
              {note}
            </p>
          ))}
        </div>
      )}

      {sections.map((section) => {
        const communionCount = section.key === "eucharist"
          ? section.slots.filter((s) => s.role.startsWith("communion_")).length
          : 0;

        return (
          <div key={section.key}>
            <SectionHeader
              title={sectionLabelOverrides?.[section.key] ?? SECTION_LABELS[section.key]}
              color={seasonColor}
            />
            <div className="divide-y divide-stone-100">
              {/* Insert zone before first slot in section (admin only) */}
              {isAdmin && onCustomSlotCreate && section.slots.length > 0 && (
                <InsertZone
                  orderPosition={getInsertOrder(null, section.slots[0])}
                  onInsert={handleInsert}
                />
              )}

              {section.slots.map((slot, slotIdx) => {
                const slotHint = slot.song?.title ? songHints?.get(slot.song.title) : undefined;

                // Render the slot
                let slotElement: React.ReactNode = null;

                if (slot.isCustom) {
                  slotElement = renderCustomSlot(slot);
                } else {
                  switch (slot.kind) {
                    case "song": {
                      // Gospel Acclamation — dedicated compound row
                      if (slot.role === "gospel_acclamation" && slot.gospelAcclamation) {
                        slotElement = (
                          <GospelAcclamationRow
                            key={slot.id}
                            slot={slot}
                            isAdmin={isAdmin}
                            onSlotEdit={onSlotEdit}
                            selectedSongId={selectedSongId}
                            onSongSelect={onSongSelect}
                            selectedRowRef={selectedRowRef}
                            audioOverrides={audioOverrides}
                            youtubeOverrides={youtubeOverrides}
                          />
                        );
                        break;
                      }

                      const communionMatch = slot.role.match(/^communion_(\d+)$/);
                      const communionIdx = communionMatch ? parseInt(communionMatch[1], 10) : -1;
                      const isDraggable = communionIdx >= 0 && communionCount >= 2 && isAdmin && !!onSlotReorder;

                      if (isDraggable) {
                        slotElement = (
                          <div
                            key={slot.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/x-communion-idx", String(communionIdx));
                              setDragFromIdx(communionIdx);
                            }}
                            onDragOver={(e) => {
                              if (!e.dataTransfer.types.includes("text/x-communion-idx")) return;
                              e.preventDefault();
                              setDragOverIdx(communionIdx);
                            }}
                            onDragEnd={() => {
                              setDragFromIdx(null);
                              setDragOverIdx(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragFromIdx !== null && dragFromIdx !== communionIdx) {
                                onSlotReorder!(dragFromIdx, communionIdx);
                              }
                              setDragFromIdx(null);
                              setDragOverIdx(null);
                            }}
                            className={`relative group ${dragFromIdx === communionIdx ? "opacity-40" : ""}`}
                          >
                            {dragOverIdx === communionIdx && dragFromIdx !== null && dragFromIdx !== communionIdx && (
                              <div className="absolute top-0 left-3 right-3 h-0.5 bg-stone-400 rounded-full z-10" />
                            )}
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 text-stone-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              title="Drag to reorder"
                            >
                              <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
                                <circle cx="2" cy="2" r="1.2" />
                                <circle cx="6" cy="2" r="1.2" />
                                <circle cx="2" cy="7" r="1.2" />
                                <circle cx="6" cy="7" r="1.2" />
                                <circle cx="2" cy="12" r="1.2" />
                                <circle cx="6" cy="12" r="1.2" />
                              </svg>
                            </span>
                            <SongSlotRow
                              slot={slot}
                              selectedSongId={selectedSongId}
                              onSongSelect={onSongSelect}
                              selectedRowRef={selectedRowRef}
                              audioOverrides={audioOverrides}
                              youtubeOverrides={youtubeOverrides}
                              hint={slotHint}
                              isAdmin={isAdmin}
                              onSlotEdit={onSlotEdit}
                            />
                          </div>
                        );
                      } else {
                        slotElement = (
                          <SongSlotRow
                            key={slot.id}
                            slot={slot}
                            selectedSongId={selectedSongId}
                            onSongSelect={onSongSelect}
                            selectedRowRef={selectedRowRef}
                            audioOverrides={audioOverrides}
                            youtubeOverrides={youtubeOverrides}
                            hint={slotHint}
                            isAdmin={isAdmin}
                            onSlotEdit={onSlotEdit}
                          />
                        );
                      }
                      break;
                    }
                    case "reading":
                      slotElement = (
                        <ReadingRow
                          key={slot.id}
                          slot={slot}
                          synopsis={synopsis}
                          isExpanded={slot.reading ? expandedReadings.has(slot.reading.type) : false}
                          onToggle={slot.reading ? () => toggleReading(slot.reading!.type) : undefined}
                        />
                      );
                      break;
                    case "antiphon":
                      slotElement = <AntiphonRow key={slot.id} slot={slot} />;
                      break;
                    case "mass_setting":
                      slotElement = <MassSettingRow key={slot.id} slot={slot} isAdmin={isAdmin} onSlotEdit={onSlotEdit} />;
                      break;
                    case "resource":
                      if (!isAdmin && slot.role === "gospel_acclamation") {
                        // Non-admin: show label + verse citation if available, but no resource links
                        if (slot.reading) {
                          slotElement = (
                            <div key={slot.id} className="py-2 px-3 bg-stone-50/50 border-l-2 border-stone-200">
                              <div className="flex items-start gap-3">
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
                                  {slot.label}
                                </span>
                                <span className="w-7 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-stone-500">{slot.reading.citation}</p>
                                  {slot.reading.summary && (
                                    <p className="text-xs italic mt-0.5 text-[#374151]">
                                      {slot.reading.summary}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          slotElement = null;
                        }
                      } else {
                        slotElement = <ResourceRow key={slot.id} slot={slot} />;
                      }
                      break;
                    default:
                      slotElement = null;
                  }
                }

                const nextSlot = section.slots[slotIdx + 1] ?? null;

                return (
                  <div key={slot.id}>
                    {slotElement}
                    {/* Insert zone between this slot and the next (admin only) */}
                    {isAdmin && onCustomSlotCreate && slotElement && (
                      <InsertZone
                        orderPosition={getInsertOrder(slot, nextSlot)}
                        onInsert={handleInsert}
                      />
                    )}
                  </div>
                );
              })}
              {/* Add Communion Song button */}
              {section.key === "eucharist" && isAdmin && onSlotEdit && (
                <div className="py-2 px-3">
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0" />
                    <span className="w-7 shrink-0" />
                    <button
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        onSlotEdit(`communion_${communionCount}`, rect);
                      }}
                      className="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
                    >
                      <IconPlus />
                      Add Communion Song
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Custom Slot Form Modal */}
      {customForm && (
        <CustomSlotForm
          slotType={customForm.slotType}
          existingContent={customForm.existingContent}
          existingLabel={customForm.existingLabel}
          mode={customForm.mode}
          onSave={handleFormSave}
          onCancel={() => setCustomForm(null)}
        />
      )}
    </div>
  );
}
