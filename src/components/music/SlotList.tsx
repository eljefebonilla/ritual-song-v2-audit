"use client";

import type { WorshipSlot } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/worship-slots";
import InteractiveSongSlot from "./InteractiveSongSlot";
import SongSlot from "./SongSlot";
import ResourceItem from "./ResourceItem";

interface SlotListProps {
  slots: WorshipSlot[];
  seasonColor: string;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string) => void;
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

function ReadingRow({ slot }: { slot: WorshipSlot }) {
  if (!slot.reading) return null;
  const r = slot.reading;
  return (
    <div className="flex items-start gap-3 py-2 px-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
        {slot.label}
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

function InlineResources({
  slot,
  seasonColor,
}: {
  slot: WorshipSlot;
  seasonColor: string;
}) {
  if (!slot.resources || slot.resources.length === 0) return null;
  return (
    <div className="px-3 pb-2 pl-[7.75rem]">
      <div className="flex flex-wrap gap-1.5">
        {slot.resources.map((r) => (
          <ResourceItem key={r.id} resource={r} seasonColor={seasonColor} />
        ))}
      </div>
    </div>
  );
}

function SongSlotRow({
  slot,
  seasonColor,
  selectedSongId,
  onSongSelect,
}: {
  slot: WorshipSlot;
  seasonColor: string;
  selectedSongId?: string | null;
  onSongSelect?: (songId: string) => void;
}) {
  if (!slot.song) return null;

  if (slot.resolvedSong) {
    const isSelected = selectedSongId === slot.resolvedSong.id;
    return (
      <>
        <InteractiveSongSlot
          label={slot.label}
          song={slot.song}
          resolved={slot.resolvedSong}
          isSelected={isSelected}
          onSelect={onSongSelect ? () => onSongSelect(slot.resolvedSong!.id) : undefined}
        />
        <InlineResources slot={slot} seasonColor={seasonColor} />
      </>
    );
  }

  return (
    <>
      <SongSlot label={slot.label} song={slot.song} />
      <InlineResources slot={slot} seasonColor={seasonColor} />
    </>
  );
}

export default function SlotList({
  slots,
  seasonColor,
  selectedSongId,
  onSongSelect,
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
                      seasonColor={seasonColor}
                      selectedSongId={selectedSongId}
                      onSongSelect={onSongSelect}
                    />
                  );
                case "reading":
                  return <ReadingRow key={slot.id} slot={slot} />;
                case "antiphon":
                  return (
                    <div key={slot.id}>
                      <AntiphonRow slot={slot} />
                      <InlineResources slot={slot} seasonColor={seasonColor} />
                    </div>
                  );
                case "mass_setting":
                  return <MassSettingRow key={slot.id} slot={slot} />;
                case "resource":
                  return (
                    <div key={slot.id} className="px-3 py-2">
                      {slot.reading && (
                        <div className="flex items-start gap-3 mb-2">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-stone-400 w-28 shrink-0 pt-0.5">
                            {slot.label}
                          </span>
                          <p className="text-sm font-medium text-stone-700">
                            {slot.reading.citation}
                          </p>
                        </div>
                      )}
                      {slot.resources && (
                        <div className="flex flex-wrap gap-1.5 pl-[7.75rem]">
                          {slot.resources.map((r) => (
                            <ResourceItem
                              key={r.id}
                              resource={r}
                              seasonColor={seasonColor}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
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
