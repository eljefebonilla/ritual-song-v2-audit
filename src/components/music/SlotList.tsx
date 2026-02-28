"use client";

import type { RefObject } from "react";
import type { WorshipSlot, OccasionResource } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/worship-slots";
import { useMedia } from "@/lib/media-context";
import InteractiveSongSlot from "./InteractiveSongSlot";
import SongSlot from "./SongSlot";

interface SlotListProps {
  slots: WorshipSlot[];
  seasonColor: string;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string) => void;
  selectedRowRef?: RefObject<HTMLDivElement | null>;
  audioOverrides?: Record<string, string>;
  presider?: string;
  massNotes?: string[];
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

function ReadingRow({ slot }: { slot: WorshipSlot }) {
  if (!slot.reading) return null;
  const r = slot.reading;
  return (
    <div className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
      </span>
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
        <SlotPlayButton resources={slot.resources} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700">{r.citation}</p>
        {r.summary && (
          <p className="text-xs text-stone-500 mt-0.5">{r.summary}</p>
        )}
        {r.antiphon && (
          <p className="text-xs text-stone-400 italic mt-0.5">
            &ldquo;{r.antiphon}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

function AntiphonRow({ slot }: { slot: WorshipSlot }) {
  if (!slot.antiphon) return null;
  const a = slot.antiphon;
  return (
    <div className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
      </span>
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5">
        <SlotPlayButton resources={slot.resources} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700">{a.citation}</p>
        <p className="text-xs text-stone-500 italic mt-0.5">
          &ldquo;{a.text}&rdquo;
        </p>
      </div>
    </div>
  );
}

function MassSettingRow({ slot }: { slot: WorshipSlot }) {
  if (!slot.massSetting) return null;
  return (
    <div className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
      </span>
      <span className="w-7 shrink-0 flex items-start justify-center pt-0.5" />
      <div>
        <p className="text-sm font-medium text-stone-800">
          {slot.massSetting.name}
        </p>
        {slot.massSetting.composer && (
          <p className="text-xs text-stone-500">
            {slot.massSetting.composer}
          </p>
        )}
      </div>
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
}: {
  slot: WorshipSlot;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string) => void;
  selectedRowRef?: RefObject<HTMLDivElement | null>;
  audioOverrides?: Record<string, string>;
}) {
  if (!slot.song) return null;

  if (slot.resolvedSong) {
    const isSelected = selectedSongId === slot.resolvedSong.id;
    const overrideUrl = audioOverrides?.[slot.resolvedSong.id];
    const resolved = overrideUrl
      ? { ...slot.resolvedSong, audioUrl: overrideUrl, audioType: "audio" as const }
      : slot.resolvedSong;
    return (
      <InteractiveSongSlot
        label={slot.label}
        song={slot.song}
        resolved={resolved}
        isSelected={isSelected}
        onSelect={onSongSelect ? () => onSongSelect(slot.resolvedSong!.id) : undefined}
        rowRef={isSelected ? selectedRowRef : undefined}
      />
    );
  }

  return <SongSlot label={slot.label} song={slot.song} />;
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
}: SlotListProps) {
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

      {sections.map((section) => (
        <div key={section.key}>
          <SectionHeader
            title={SECTION_LABELS[section.key]}
            color={seasonColor}
          />
          <div className="divide-y divide-stone-100">
            {section.slots.map((slot) => {
              switch (slot.kind) {
                case "song":
                  return (
                    <SongSlotRow
                      key={slot.id}
                      slot={slot}
                      selectedSongId={selectedSongId}
                      onSongSelect={onSongSelect}
                      selectedRowRef={selectedRowRef}
                      audioOverrides={audioOverrides}
                    />
                  );
                case "reading":
                  return <ReadingRow key={slot.id} slot={slot} />;
                case "antiphon":
                  return <AntiphonRow key={slot.id} slot={slot} />;
                case "mass_setting":
                  return <MassSettingRow key={slot.id} slot={slot} />;
                case "resource":
                  return <ResourceRow key={slot.id} slot={slot} />;
                default:
                  return null;
              }
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
