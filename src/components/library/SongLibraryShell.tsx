"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { LibrarySong, LiturgicalOccasion } from "@/lib/types";
import { useUser } from "@/lib/user-context";
import { getSongDisplayCategories } from "@/lib/song-library";
import {
  getDateToOccasionMap,
  getOccasionSeasonMap,
  normalizeTitle,
  extractSongEntriesWithPosition,
  MASS_POSITION_ORDER,
} from "@/lib/occasion-helpers";
import SongCard from "./SongCard";
import SongDetailPanel from "./SongDetailPanel";
import AlphabetJump from "./AlphabetJump";
import LibraryFilters from "./LibraryFilters";

interface SongLibraryShellProps {
  songs: LibrarySong[];
  title?: string;
  subtitle?: string;
}

const SORT_OPTIONS = [
  { id: "usage", label: "Most Used" },
  { id: "alpha", label: "A\u2013Z" },
  { id: "resources", label: "Has Resources" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["id"];

// Map from Order of Mass filter values to how songs match them
const ORDER_FILTER_TO_FUNCTIONS: Record<string, string[]> = {
  prelude: ["prelude"],
  gathering: ["gathering"],
  penitential_act: ["penitential_act", "penitentialAct"],
  gloria: ["gloria"],
  psalm: ["psalm"],
  gospel_acclamation: ["gospel_acclamation", "gospelAcclamation"],
  offertory: ["offertory"],
  eucharistic_acclamation: ["eucharistic_acclamation", "eucharisticAcclamation"],
  lords_prayer: ["lords_prayer", "lordsPrayer"],
  fraction_rite: ["fraction_rite", "fractionRite"],
  communion: ["communion"],
  sending: ["sending"],
};

// Map from Order of Mass filter values to song categories
const ORDER_FILTER_TO_CATEGORY: Record<string, string> = {
  psalm: "psalm",
  gospel_acclamation: "gospel_acclamation",
  penitential_act: "mass_part",
  gloria: "mass_part",
  eucharistic_acclamation: "mass_part",
  lords_prayer: "mass_part",
  fraction_rite: "mass_part",
};

/**
 * Find the nearest occasion date on or after today.
 * date-index.json is sorted by date, so we can scan linearly.
 */
function findNearestOccasionDate(
  map: Map<string, { date: string; occasionId: string; season: string; name: string }>
): string | null {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  let nearest: string | null = null;
  for (const date of map.keys()) {
    if (date >= todayStr) {
      nearest = date;
      break;
    }
  }
  return nearest;
}

export default function SongLibraryShell({ songs, title = "Song Library", subtitle }: SongLibraryShellProps) {
  const { role, setRole, isAdmin } = useUser();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("usage");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [addingSong, setAddingSong] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newComposer, setNewComposer] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Pre-built maps (computed before state so we can derive initial date)
  const dateOccasionMap = useMemo(() => getDateToOccasionMap(), []);
  const occasionSeasonMap = useMemo(() => getOccasionSeasonMap(), []);

  // Auto-select nearest upcoming occasion date on mount
  const initialDate = useMemo(() => findNearestOccasionDate(dateOccasionMap), [dateOccasionMap]);

  // New filter state
  const [orderOfMassFilters, setOrderOfMassFilters] = useState<Set<string>>(new Set());
  const [seasonFilters, setSeasonFilters] = useState<Set<string>>(new Set());
  const [resourceFilters, setResourceFilters] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [selectedEnsemble, setSelectedEnsemble] = useState<string | null>(null);
  const [calendarSongIds, setCalendarSongIds] = useState<Set<string> | null>(null);
  const [calendarSongMeta, setCalendarSongMeta] = useState<Map<string, { positions: Set<string>; communities: Set<string> }> | null>(null);
  const [loadingOccasion, setLoadingOccasion] = useState(false);

  // Build a normalized title -> song id lookup for fuzzy matching
  const normalizedTitleIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const song of songs) {
      map.set(normalizeTitle(song.title), song.id);
    }
    return map;
  }, [songs]);

  const activeFilterCount =
    orderOfMassFilters.size +
    seasonFilters.size +
    resourceFilters.size +
    (calendarSongIds !== null ? 1 : 0);

  const clearAllFilters = useCallback(() => {
    setOrderOfMassFilters(new Set());
    setSeasonFilters(new Set());
    setResourceFilters(new Set());
    setSelectedDate(null);
    setSelectedEnsemble(null);
    setCalendarSongIds(null);
    setCalendarSongMeta(null);
  }, []);

  // Load occasion songs when selectedDate or selectedEnsemble changes
  useEffect(() => {
    if (!selectedDate) {
      setCalendarSongIds(null);
      setCalendarSongMeta(null);
      return;
    }

    const entry = dateOccasionMap.get(selectedDate);
    if (!entry) {
      setCalendarSongIds(new Set());
      setCalendarSongMeta(new Map());
      return;
    }

    let cancelled = false;
    setLoadingOccasion(true);

    fetch(`/api/occasions/${entry.occasionId}`)
      .then((res) => res.json())
      .then((occasion: LiturgicalOccasion) => {
        if (cancelled) return;

        let plans = occasion.musicPlans || [];
        if (selectedEnsemble) {
          plans = plans.filter((p) => p.communityId === selectedEnsemble);
        }

        const matchedIds = new Set<string>();
        const meta = new Map<string, { positions: Set<string>; communities: Set<string> }>();

        for (const plan of plans) {
          const positioned = extractSongEntriesWithPosition(plan);
          for (const { entry: songEntry, position } of positioned) {
            const normalized = normalizeTitle(songEntry.title);
            const id = normalizedTitleIndex.get(normalized);
            if (id) {
              matchedIds.add(id);
              let m = meta.get(id);
              if (!m) {
                m = { positions: new Set(), communities: new Set() };
                meta.set(id, m);
              }
              m.positions.add(position);
              m.communities.add(plan.communityId);
            }
          }
        }

        setCalendarSongIds(matchedIds);
        setCalendarSongMeta(meta);
      })
      .catch(() => {
        if (!cancelled) {
          setCalendarSongIds(new Set());
          setCalendarSongMeta(new Map());
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOccasion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedEnsemble, dateOccasionMap, normalizedTitleIndex]);

  const filtered = useMemo(() => {
    let list = [...songs];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.composer && s.composer.toLowerCase().includes(q))
      );
    }

    // Order of Mass filter (OR within group)
    if (orderOfMassFilters.size > 0) {
      list = list.filter((s) => {
        for (const filterVal of orderOfMassFilters) {
          // Check song.functions
          const funcMatches = ORDER_FILTER_TO_FUNCTIONS[filterVal] || [filterVal];
          if (s.functions?.some((fn) => funcMatches.includes(fn))) return true;

          // Check song.category
          const catMatch = ORDER_FILTER_TO_CATEGORY[filterVal];
          if (catMatch && s.category === catMatch) {
            // For generic mass_part category, we match any mass part filter
            if (catMatch === "mass_part") return true;
            // For psalm/gospel_acclamation, exact match
            return true;
          }
        }
        return false;
      });
    }

    // Season filter (OR within group)
    if (seasonFilters.size > 0) {
      list = list.filter((s) => {
        if (!s.occasions || s.occasions.length === 0) return false;
        return s.occasions.some((occId) => {
          const season = occasionSeasonMap.get(occId);
          return season && seasonFilters.has(season);
        });
      });
    }

    // Calendar filter
    if (calendarSongIds !== null) {
      list = list.filter((s) => calendarSongIds.has(s.id));
    }

    // Resource filters (OR within group)
    if (resourceFilters.size > 0) {
      list = list.filter((s) => {
        const cats = getSongDisplayCategories(s);
        return [...resourceFilters].some((rf) => cats.has(rf as never));
      });
    }

    // Sort — when calendar is active, sort by Mass position order
    if (calendarSongMeta && calendarSongMeta.size > 0) {
      list.sort((a, b) => {
        const metaA = calendarSongMeta.get(a.id);
        const metaB = calendarSongMeta.get(b.id);
        const posA = metaA ? Math.min(...[...metaA.positions].map((p) => MASS_POSITION_ORDER[p] ?? 99)) : 99;
        const posB = metaB ? Math.min(...[...metaB.positions].map((p) => MASS_POSITION_ORDER[p] ?? 99)) : 99;
        if (posA !== posB) return posA - posB;
        return a.title.localeCompare(b.title);
      });
    } else {
      switch (sort) {
        case "usage":
          list.sort((a, b) => b.usageCount - a.usageCount);
          break;
        case "alpha":
          list.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case "resources":
          list.sort((a, b) => b.resources.length - a.resources.length);
          break;
      }
    }

    return list;
  }, [songs, search, sort, orderOfMassFilters, seasonFilters, resourceFilters, calendarSongIds, calendarSongMeta, occasionSeasonMap]);

  // Build letter groups for alphabet jump
  const { availableLetters, letterIndices } = useMemo(() => {
    if (sort !== "alpha") return { availableLetters: new Set<string>(), letterIndices: new Map<string, number>() };

    const letters = new Set<string>();
    const indices = new Map<string, number>();

    for (let i = 0; i < filtered.length; i++) {
      const firstChar = filtered[i].title.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstChar)) {
        letters.add(firstChar);
        if (!indices.has(firstChar)) {
          indices.set(firstChar, i);
        }
      }
    }
    return { availableLetters: letters, letterIndices: indices };
  }, [filtered, sort]);

  const handleLetterClick = useCallback((letter: string) => {
    const idx = letterIndices.get(letter);
    if (idx === undefined || !listRef.current) return;

    const el = listRef.current.querySelector(`[data-letter-anchor="${letter}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [letterIndices]);

  const selectedSong = selectedSongId
    ? songs.find((s) => s.id === selectedSongId) || null
    : null;

  const songsWithResources = songs.filter((s) => s.resources.length > 0).length;

  // Track which letters have had their anchor placed
  const placedLetters = new Set<string>();

  return (
    <div className="flex h-screen">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-stone-200 px-4 md:px-6 py-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-stone-900">{title}</h1>
              <p className="text-xs text-stone-400">
                {subtitle || `${songs.length} songs \u00b7 ${songsWithResources} with resources`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setAddingSong(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Song
                </button>
              )}
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-stone-400">View as:</span>
                <div className="flex bg-stone-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setRole("admin")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      role === "admin"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Music Director
                  </button>
                  <button
                    onClick={() => setRole("member")}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      role === "member"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    Choir Member
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:max-w-sm">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search songs or composers..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
            </div>

            {/* Sort */}
            <div className="flex bg-stone-100 rounded-lg p-0.5 self-start">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    sort === opt.id
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Mobile filter toggle */}
            <button
              onClick={() => setFiltersVisible((v) => !v)}
              className="sm:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-stone-200 rounded-md hover:bg-stone-50 transition-colors self-start"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="20" y2="12" />
                <line x1="12" y1="18" x2="20" y2="18" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-stone-800 text-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Alphabet jump — inline, below toolbar when sorted A-Z */}
          {sort === "alpha" && !search && (
            <div className="mt-2 -mb-1">
              <AlphabetJump
                availableLetters={availableLetters}
                onLetterClick={handleLetterClick}
              />
            </div>
          )}
        </div>

        {/* Filter sidebar + song list */}
        <div className="flex-1 flex overflow-hidden">
          {/* Filter panel — desktop sidebar, mobile expandable */}
          {filtersVisible && (
            <div className="w-full sm:w-56 sm:shrink-0 border-r border-stone-100 bg-stone-50/50 overflow-y-auto p-3 sm:block">
              <LibraryFilters
                orderOfMassFilters={orderOfMassFilters}
                seasonFilters={seasonFilters}
                resourceFilters={resourceFilters}
                selectedDate={selectedDate}
                selectedEnsemble={selectedEnsemble}
                dateOccasionMap={dateOccasionMap}
                onOrderOfMassChange={setOrderOfMassFilters}
                onSeasonChange={setSeasonFilters}
                onResourceChange={setResourceFilters}
                onDateSelect={setSelectedDate}
                onEnsembleSelect={setSelectedEnsemble}
                onClearAll={clearAllFilters}
                activeCount={activeFilterCount}
                loadingOccasion={loadingOccasion}
              />
            </div>
          )}

          {/* Desktop filter toggle when hidden */}
          {!filtersVisible && (
            <button
              onClick={() => setFiltersVisible(true)}
              className="hidden sm:flex items-center justify-center w-8 shrink-0 border-r border-stone-100 bg-stone-50/50 hover:bg-stone-100 transition-colors"
              title="Show filters"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Song list */}
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center text-stone-400 text-sm py-12">
                {search || activeFilterCount > 0
                  ? "No songs match your filters."
                  : "No songs in library yet."}
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((song) => {
                  const firstChar = song.title.charAt(0).toUpperCase();
                  const isAnchor = sort === "alpha" && /[A-Z]/.test(firstChar) && !placedLetters.has(firstChar);
                  if (isAnchor) placedLetters.add(firstChar);

                  return (
                    <div key={song.id} {...(isAnchor ? { "data-letter-anchor": firstChar } : {})}>
                      {isAnchor && (
                        <div className="sticky top-0 bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-500 uppercase tracking-wider border-b border-stone-200 z-10">
                          {firstChar}
                        </div>
                      )}
                      <SongCard
                        song={song}
                        isSelected={song.id === selectedSongId}
                        onClick={() => setSelectedSongId(song.id === selectedSongId ? null : song.id)}
                        calendarMeta={calendarSongMeta?.get(song.id) ?? null}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel — side panel on desktop, full-screen modal on mobile */}
      {selectedSong && (
        <SongDetailPanel
          song={selectedSong}
          onClose={() => setSelectedSongId(null)}
        />
      )}

      {/* Add Song Dialog */}
      {addingSong && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setAddingSong(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
              <h2 className="text-base font-bold text-stone-900 mb-4">Add Song</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    placeholder="Song title"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Composer</label>
                  <input
                    type="text"
                    value={newComposer}
                    onChange={(e) => setNewComposer(e.target.value)}
                    className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    placeholder="Composer / arranger"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  onClick={() => { setAddingSong(false); setNewTitle(""); setNewComposer(""); }}
                  className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  disabled={savingNew || !newTitle.trim()}
                  onClick={async () => {
                    setSavingNew(true);
                    try {
                      const res = await fetch("/api/songs", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: newTitle.trim(), composer: newComposer.trim() || undefined }),
                      });
                      if (res.ok) {
                        setAddingSong(false);
                        setNewTitle("");
                        setNewComposer("");
                        window.location.reload();
                      }
                    } finally {
                      setSavingNew(false);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-50"
                >
                  {savingNew ? "Adding..." : "Add Song"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
