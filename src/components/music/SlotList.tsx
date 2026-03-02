"use client";

import { useState, useRef } from "react";
import type { RefObject } from "react";
import type { WorshipSlot, OccasionResource, LectionarySynopsis } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/worship-slots";
import { useMedia } from "@/lib/media-context";
import InteractiveSongSlot from "./InteractiveSongSlot";
import SongSlot from "./SongSlot";

interface SlotListProps {
  slots: WorshipSlot[];
  seasonColor: string;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string, slotRole: string) => void;
  selectedRowRef?: RefObject<HTMLDivElement | null>;
  audioOverrides?: Record<string, string>;
  presider?: string;
  massNotes?: string[];
  synopsis?: LectionarySynopsis | null;
  songHints?: Map<string, string>;
  isAdmin?: boolean;
  onSlotEdit?: (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string }) => void;
  onSlotReorder?: (fromIndex: number, toIndex: number) => void;
}

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

/** Play button for the fixed-width column — used by antiphon/resource rows with audio */
function SlotPlayButton({ resources }: { resources?: OccasionResource[] }) {
  const { play, stop, current } = useMedia();
  const audioResource = resources?.find((r) => r.type === "audio");
  if (!audioResource) return null;

  const url = `/api/music/${encodeURIComponent(audioResource.filePath)}`;
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
      style={isPlaying ? {
        background: "linear-gradient(145deg, #4CAF5020, #4CAF5010)",
        border: "2px solid #4CAF50",
        boxShadow: "0 0 8px #4CAF5030, 0 1px 4px #4CAF5020",
      } : {
        background: "linear-gradient(145deg, #4CAF500a, transparent)",
        border: "2px solid #4CAF50",
        boxShadow: "0 1px 4px #4CAF5015",
      }}
    >
      {isPlaying ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="3">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinejoin="round">
          <polygon points="6,3 20,12 6,21" />
        </svg>
      )}
    </button>
  );
}

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
            <p className="text-sm font-medium text-stone-700">{r.citation}</p>
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
            <p className="text-xs text-stone-500 mt-0.5">{r.summary}</p>
          )}
          {r.antiphon && (
            <p className="text-xs text-stone-400 italic mt-0.5">
              &ldquo;{r.antiphon}&rdquo;
            </p>
          )}
          {isExpanded && readingSynopsis && (
            <p className="text-xs text-stone-500 mt-1.5 bg-stone-50 rounded p-2 border-l-2 border-stone-300">
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
    <div className="flex items-start gap-3 py-2 px-3 bg-stone-50/50 border-l-2 border-stone-200">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
      </span>
      <span className="w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700">
          {a.citation}
          {slot.optionNumber != null && (
            <span className="text-stone-400 font-normal ml-1">
              (Option {slot.optionNumber})
            </span>
          )}
        </p>
        <p className="text-xs text-stone-500 italic mt-0.5">
          &ldquo;{a.text}&rdquo;
        </p>
      </div>
    </div>
  );
}


function MassSettingRow({ slot, isAdmin, onSlotEdit }: {
  slot: WorshipSlot;
  isAdmin?: boolean;
  onSlotEdit?: (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string }) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  if (!slot.massSetting) return null;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = rowRef.current;
    if (!el || !onSlotEdit) return;
    onSlotEdit(slot.role, el.getBoundingClientRect(), {
      title: slot.massSetting!.name,
      composer: slot.massSetting!.composer,
    });
  };

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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
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
  hint,
  isAdmin,
  onSlotEdit,
}: {
  slot: WorshipSlot;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string, slotRole: string) => void;
  selectedRowRef?: RefObject<HTMLDivElement | null>;
  audioOverrides?: Record<string, string>;
  hint?: string;
  isAdmin?: boolean;
  onSlotEdit?: (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string }) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!slot.song) return null;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = rowRef.current;
    if (!el || !onSlotEdit) return;
    onSlotEdit(slot.role, el.getBoundingClientRect(), slot.song);
  };

  const editButton = isAdmin && onSlotEdit ? (
    <button
      onClick={handleEditClick}
      className="shrink-0 p-1 text-stone-300 hover:text-stone-600 hover:bg-stone-100 rounded transition-colors"
      title="Edit slot"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
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
    const resolved = overrideUrl
      ? { ...slot.resolvedSong, audioUrl: overrideUrl, audioType: "audio" as const }
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
        <SongSlot label={slot.label} song={slot.song} rightAction={editButton} />
      </div>
      {hintEl}
    </>
  );
}

export default function SlotList({
  slots,
  seasonColor,
  selectedSongId,
  onSongSelect,
  selectedRowRef,
  audioOverrides,
  presider,
  massNotes,
  synopsis,
  songHints,
  isAdmin,
  onSlotEdit,
  onSlotReorder,
}: SlotListProps) {
  const [expandedReadings, setExpandedReadings] = useState<Set<string>>(
    new Set(["first", "second", "gospel"])
  );
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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
        No music data for this community yet.
      </div>
    );
  }

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
              title={SECTION_LABELS[section.key]}
              color={seasonColor}
            />
            <div className="divide-y divide-stone-100">
              {section.slots.map((slot) => {
                const slotHint = slot.song?.title ? songHints?.get(slot.song.title) : undefined;
                switch (slot.kind) {
                  case "song": {
                    const communionMatch = slot.role.match(/^communion_(\d+)$/);
                    const communionIdx = communionMatch ? parseInt(communionMatch[1], 10) : -1;
                    const isDraggable = communionIdx >= 0 && communionCount >= 2 && isAdmin && !!onSlotReorder;

                    if (isDraggable) {
                      return (
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
                            hint={slotHint}
                            isAdmin={isAdmin}
                            onSlotEdit={onSlotEdit}
                          />
                        </div>
                      );
                    }

                    return (
                      <SongSlotRow
                        key={slot.id}
                        slot={slot}
                        selectedSongId={selectedSongId}
                        onSongSelect={onSongSelect}
                        selectedRowRef={selectedRowRef}
                        audioOverrides={audioOverrides}
                        hint={slotHint}
                        isAdmin={isAdmin}
                        onSlotEdit={onSlotEdit}
                      />
                    );
                  }
                  case "reading":
                    return (
                      <ReadingRow
                        key={slot.id}
                        slot={slot}
                        synopsis={synopsis}
                        isExpanded={slot.reading ? expandedReadings.has(slot.reading.type) : false}
                        onToggle={slot.reading ? () => toggleReading(slot.reading!.type) : undefined}
                      />
                    );
                  case "antiphon":
                    return <AntiphonRow key={slot.id} slot={slot} />;
                  case "mass_setting":
                    return <MassSettingRow key={slot.id} slot={slot} isAdmin={isAdmin} onSlotEdit={onSlotEdit} />;
                  case "resource":
                    if (!isAdmin && slot.role === "gospel_acclamation") return null;
                    return <ResourceRow key={slot.id} slot={slot} />;
                  default:
                    return null;
                }
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
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add Communion Song
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
