"use client";

import { useState, useMemo } from "react";
import type {
  MusicPlan,
  Reading,
  Antiphon,
  OccasionResource,
  ResolvedSong,
  LibrarySong,
} from "@/lib/types";
import { normalizeTitle, COMMUNITY_BADGES } from "@/lib/occasion-helpers";
import { planToSlots } from "@/lib/worship-slots";
import SlotList from "./SlotList";
import SongDetailPanel from "@/components/library/SongDetailPanel";
import OccasionResourcePanel from "./OccasionResourcePanel";

interface OccasionMusicSectionProps {
  plans: MusicPlan[];
  readings: Reading[];
  antiphons: Antiphon[];
  occasionResources?: OccasionResource[];
  seasonColor: string;
  resolvedSongs: Record<string, ResolvedSong>;
  librarySongs: Record<string, LibrarySong>;
}

const COMMUNITY_ORDER = [
  "reflections",
  "foundations",
  "generations",
  "heritage",
  "elevations",
];

export default function OccasionMusicSection({
  plans,
  readings,
  antiphons,
  occasionResources,
  seasonColor,
  resolvedSongs,
  librarySongs,
}: OccasionMusicSectionProps) {
  const sorted = useMemo(
    () =>
      [...plans].sort(
        (a, b) =>
          COMMUNITY_ORDER.indexOf(a.communityId) -
          COMMUNITY_ORDER.indexOf(b.communityId)
      ),
    [plans]
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  const activePlan = sorted[activeIdx];
  if (!activePlan) return null;

  const slots = planToSlots(
    activePlan,
    readings,
    antiphons,
    occasionResources,
    resolvedSongs,
  );

  // Find the selected LibrarySong by ID
  const selectedSong = selectedSongId
    ? Object.values(librarySongs).find((s) => s.id === selectedSongId) ?? null
    : null;

  const handleSongSelect = (songId: string) => {
    setSelectedSongId((prev) => (prev === songId ? null : songId));
  };

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-stone-900 mb-4">
        Order of Worship
      </h2>

      <div className="flex gap-0 items-start">
        {/* Left: Tabs + Slot List */}
        <div className="border border-stone-200 rounded-lg overflow-hidden bg-white flex-1 min-w-0">
          {/* Community Tabs */}
          <div className="flex border-b border-stone-200 bg-stone-50">
            {sorted.map((plan, i) => {
              const isActive = i === activeIdx;
              const hasData =
                plan.prelude ||
                plan.gathering ||
                plan.offertory ||
                plan.sending;
              const badge = COMMUNITY_BADGES[plan.communityId];

              return (
                <button
                  key={plan.communityId}
                  onClick={() => {
                    setActiveIdx(i);
                    setSelectedSongId(null);
                  }}
                  className={`relative px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive ? "" : "hover:opacity-80"
                  }`}
                  style={{
                    color: isActive ? badge?.text ?? "#1c1917" : "#a8a29e",
                    backgroundColor: isActive ? badge?.bg : undefined,
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    {plan.community}
                    {!hasData && (
                      <span className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                    )}
                  </span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5"
                      style={{ backgroundColor: badge?.text ?? seasonColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Slot List */}
          <SlotList
            slots={slots}
            seasonColor={seasonColor}
            selectedSongId={selectedSongId}
            onSongSelect={handleSongSelect}
            presider={activePlan.presider}
            massNotes={activePlan.massNotes}
          />
        </div>

        {/* Right panel: Song detail or Occasion resources */}
        <div className="hidden md:block w-80 shrink-0">
          {selectedSong ? (
            <SongDetailPanel
              song={selectedSong}
              onClose={() => setSelectedSongId(null)}
            />
          ) : occasionResources && occasionResources.length > 0 ? (
            <OccasionResourcePanel
              resources={occasionResources}
              seasonColor={seasonColor}
            />
          ) : null}
        </div>
      </div>

      {/* Mobile: Song Detail as modal */}
      {selectedSong && (
        <div className="md:hidden">
          <SongDetailPanel
            song={selectedSong}
            onClose={() => setSelectedSongId(null)}
          />
        </div>
      )}
    </div>
  );
}
