"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type {
  MusicPlan,
  Reading,
  Antiphon,
  OccasionResource,
  ResolvedSong,
  LibrarySong,
} from "@/lib/types";
import { COMMUNITY_BADGES } from "@/lib/occasion-helpers";
import { planToSlots } from "@/lib/worship-slots";
import SlotList from "./SlotList";
import SongDetailPanel from "@/components/library/SongDetailPanel";

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
  const [panelOffset, setPanelOffset] = useState(0);
  const [audioOverrides, setAudioOverrides] = useState<Record<string, string>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activePlan = sorted[activeIdx];
  if (!activePlan) return null;

  const slots = planToSlots(
    activePlan,
    readings,
    antiphons,
    occasionResources,
    resolvedSongs,
  );

  const selectedSong = selectedSongId
    ? Object.values(librarySongs).find((s) => s.id === selectedSongId) ?? null
    : null;

  const handleSongSelect = (songId: string) => {
    setSelectedSongId((prev) => (prev === songId ? null : songId));
  };

  const handleAudioUploaded = useCallback((songId: string, url: string) => {
    setAudioOverrides((prev) => ({ ...prev, [songId]: url }));
  }, []);

  // Fetch Supabase audio for all songs so play buttons work everywhere
  const allSongIds = useMemo(() => {
    const ids = new Set<string>();
    for (const plan of sorted) {
      const s = planToSlots(plan, readings, antiphons, occasionResources, resolvedSongs);
      for (const slot of s) {
        if (slot.resolvedSong?.id) ids.add(slot.resolvedSong.id);
      }
    }
    return [...ids];
  }, [sorted, readings, antiphons, occasionResources, resolvedSongs]);

  useEffect(() => {
    if (allSongIds.length === 0) return;
    let cancelled = false;
    fetch(`/api/songs/batch-audio?ids=${allSongIds.join(",")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.audioUrls) {
          setAudioOverrides((prev) => ({ ...prev, ...data.audioUrls }));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [allSongIds]);

  // Measure and position the right panel centered on the selected row
  const updatePanelPosition = useCallback(() => {
    const container = containerRef.current;
    const row = selectedRowRef.current;
    const panel = panelRef.current;
    if (!container || !row || !panel) {
      setPanelOffset(0);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const panelHeight = panel.offsetHeight;

    // Row center relative to container top
    const rowCenter = rowRect.top - containerRect.top + rowRect.height / 2;
    // Desired offset: center panel on row
    let offset = rowCenter - panelHeight / 2;
    // Clamp: top = 0, bottom = container can't overflow
    const maxOffset = container.offsetHeight - panelHeight;
    offset = Math.max(0, Math.min(offset, maxOffset));

    setPanelOffset(offset);
  }, []);

  useEffect(() => {
    if (selectedSong) {
      // Small delay to let panel render and get its height
      requestAnimationFrame(updatePanelPosition);
    }
  }, [selectedSongId, selectedSong, updatePanelPosition]);

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-stone-900 mb-4">
        Order of Worship
      </h2>

      <div className="flex gap-0 items-start">
        {/* Left: Tabs + Slot List */}
        <div
          ref={containerRef}
          className="border border-stone-200 rounded-lg overflow-hidden bg-white flex-1 min-w-0"
        >
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
            selectedRowRef={selectedRowRef}
            audioOverrides={audioOverrides}
            presider={activePlan.presider}
            massNotes={activePlan.massNotes}
          />
        </div>

        {/* Right panel: Song detail centered on selected row */}
        {selectedSong && (
          <div
            className="hidden md:block w-80 shrink-0 transition-[margin] duration-200 ease-out"
            style={{ marginTop: panelOffset }}
          >
            <div
              ref={panelRef}
              className="rounded-lg overflow-hidden"
              style={{
                border: "2px solid #4CAF50",
                boxShadow: "0 0 12px #4CAF5020, 0 2px 8px #4CAF5015",
              }}
            >
              <SongDetailPanel
                song={selectedSong}
                onClose={() => setSelectedSongId(null)}
                onAudioUploaded={handleAudioUploaded}
              />
            </div>
          </div>
        )}
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
