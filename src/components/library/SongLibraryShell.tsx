"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { LibrarySong, LiturgicalOccasion, SongCategory, ExpandedSongCategory } from "@/lib/types";
import {
  MASS_PART_CATEGORIES, GOSPEL_ACCLAMATION_CATEGORIES,
  SONG_FUNCTION_FILTERS, SERVICE_MUSIC_FILTERS, GA_FILTERS, ANTIPHON_FUNCTION_FILTERS,
} from "@/lib/types";
import {
  PSALM_FILTERS, PSALTER_BOOKS, PSALM_SEASON_FILTERS,
  parsePsalmNumber, getPsalmCategories, getPsalmSeasons, isInPsalterBook,
} from "@/lib/psalm-categories";
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
import PsalmNumberPicker from "./PsalmNumberPicker";
import SubFilterChips from "./SubFilterChips";

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

// 5 library tabs
type LibraryTab = "songs" | "service_music" | "psalms" | "gospel_acclamations" | "antiphons";

const LIBRARY_TABS: { id: LibraryTab; label: string }[] = [
  { id: "songs", label: "Songs" },
  { id: "service_music", label: "Service Music" },
  { id: "psalms", label: "Psalms" },
  { id: "gospel_acclamations", label: "Gospel Accl." },
  { id: "antiphons", label: "Antiphons" },
];

// Map tabs to categories
function getCategoriesForTab(tab: LibraryTab): SongCategory[] {
  switch (tab) {
    case "songs": return ["song"];
    case "service_music": return [...MASS_PART_CATEGORIES, "mass_part"] as SongCategory[];
    case "psalms": return ["psalm"];
    case "gospel_acclamations": return [...GOSPEL_ACCLAMATION_CATEGORIES, "gospel_acclamation"] as SongCategory[];
    case "antiphons": return ["antiphon"] as SongCategory[];
  }
}

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
  const { role, isAdmin } = useUser();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<LibraryTab>("songs");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("usage");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(
    searchParams.get("song") || null
  );
  const [addingSong, setAddingSong] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newComposer, setNewComposer] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; title: string; composer: string | null; resourceCount: number; usageCount: number }[] | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Resizable detail panel
  const PANEL_MIN = 320;
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return PANEL_MIN;
    const saved = localStorage.getItem("rs_panel_width");
    return saved ? Math.max(PANEL_MIN, parseInt(saved, 10) || PANEL_MIN) : PANEL_MIN;
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const PREVIEW_WIDTH = 640;
  const handlePreviewOpen = useCallback(() => {
    setPanelWidth((w) => {
      if (w < PREVIEW_WIDTH) {
        const capped = Math.min(PREVIEW_WIDTH, Math.floor(window.innerWidth * 0.65));
        localStorage.setItem("rs_panel_width", String(capped));
        return capped;
      }
      return w;
    });
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = panelWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX; // drag left = positive = wider
      const maxW = Math.floor(window.innerWidth * 0.65);
      const newWidth = Math.min(maxW, Math.max(PANEL_MIN, dragStartWidth.current + delta));
      setPanelWidth(newWidth);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      // Persist — read current DOM-driven width via a microtask
      setPanelWidth((w) => {
        localStorage.setItem("rs_panel_width", String(w));
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Unified sub-filter state (resets on tab switch)
  const [subFilter, setSubFilter] = useState<string>("all");

  // Psalm number picker state
  const [selectedPsalmNumber, setSelectedPsalmNumber] = useState<number | null>(null);
  const [selectedBook, setSelectedBook] = useState<string>("book1");
  const [psalmSeasonFilter, setPsalmSeasonFilter] = useState<string>("all");

  // Group by setting toggle for Mass Parts
  const [groupBySetting, setGroupBySetting] = useState(false);

  // Track songs removed client-side (replace/delete) for instant UI update
  const [removedSongIds, setRemovedSongIds] = useState<Set<string>>(new Set());
  const activeSongs = useMemo(
    () => removedSongIds.size > 0 ? songs.filter(s => !removedSongIds.has(s.id)) : songs,
    [songs, removedSongIds]
  );

  // Supabase-uploaded audio URLs: songId → audioUrl
  const [uploadedAudio, setUploadedAudio] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = activeSongs.map((s) => s.id).join(",");
    if (!ids) return;
    fetch(`/api/songs/batch-audio?ids=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.audioUrls) setUploadedAudio(data.audioUrls);
      })
      .catch(() => {});
  }, [activeSongs]);

  // Determine if we're in Lent
  const isLent = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    return (month >= 2 && month <= 4);
  }, []);

  // Pre-built maps
  const dateOccasionMap = useMemo(() => getDateToOccasionMap(), []);
  const occasionSeasonMap = useMemo(() => getOccasionSeasonMap(), []);
  const initialDate = useMemo(() => findNearestOccasionDate(dateOccasionMap), [dateOccasionMap]);

  // Filter state
  const [orderOfMassFilters, setOrderOfMassFilters] = useState<Set<string>>(new Set());
  const [seasonFilters, setSeasonFilters] = useState<Set<string>>(new Set());
  const [resourceFilters, setResourceFilters] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [selectedEnsemble, setSelectedEnsemble] = useState<string | null>(null);
  const [calendarSongIds, setCalendarSongIds] = useState<Set<string> | null>(null);
  const [calendarSongMeta, setCalendarSongMeta] = useState<Map<string, { positions: Set<string>; ensembles: Set<string> }> | null>(null);
  const [loadingOccasion, setLoadingOccasion] = useState(false);

  // Normalized title index for fuzzy matching
  const normalizedTitleIndex = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const song of activeSongs) {
      const key = normalizeTitle(song.title);
      const existing = map.get(key);
      if (existing) {
        existing.push(song.id);
      } else {
        map.set(key, [song.id]);
      }
    }
    return map;
  }, [activeSongs]);

  // Tab counts — using expanded categories + sub-filter counts
  const tabCounts = useMemo(() => {
    const counts: Record<LibraryTab, number> = {
      songs: 0,
      service_music: 0,
      psalms: 0,
      gospel_acclamations: 0,
      antiphons: 0,
    };

    // Sub-category counts for chips (covers all tabs)
    const subCounts: Record<string, number> = {};

    // Track psalm usage counts for "common" threshold
    const psalmUsageCounts: number[] = [];

    for (const s of activeSongs) {
      const cat = (s.category || "song") as string;

      if (cat === "song") {
        counts.songs++;
        // Count by function for Songs sub-filters
        if (s.functions) {
          for (const fn of s.functions) {
            subCounts[fn] = (subCounts[fn] || 0) + 1;
          }
        }
      } else if (MASS_PART_CATEGORIES.includes(cat as ExpandedSongCategory) || cat === "mass_part") {
        counts.service_music++;
        subCounts[cat] = (subCounts[cat] || 0) + 1;
      } else if (cat === "psalm") {
        counts.psalms++;
        psalmUsageCounts.push(s.usageCount);
        // Count by psalm scholarly category + season
        const psalmNum = s.psalmNumber || parsePsalmNumber(s.title);
        if (psalmNum) {
          const cats = getPsalmCategories(psalmNum);
          for (const pc of cats) {
            subCounts[pc] = (subCounts[pc] || 0) + 1;
          }
          const seasons = getPsalmSeasons(psalmNum);
          for (const sn of seasons) {
            subCounts[`season_${sn}`] = (subCounts[`season_${sn}`] || 0) + 1;
          }
        }
      } else if (GOSPEL_ACCLAMATION_CATEGORIES.includes(cat as ExpandedSongCategory) || cat === "gospel_acclamation") {
        counts.gospel_acclamations++;
        subCounts[cat] = (subCounts[cat] || 0) + 1;
      } else if (cat === "antiphon") {
        counts.antiphons++;
        // Count by function for Antiphon sub-filters
        if (s.functions) {
          for (const fn of s.functions) {
            subCounts[`antiphon_${fn}`] = (subCounts[`antiphon_${fn}`] || 0) + 1;
          }
        }
      } else {
        counts.songs++; // fallback
      }
    }

    // Compute "common" psalm count = top quartile by usage
    if (psalmUsageCounts.length > 0) {
      psalmUsageCounts.sort((a, b) => b - a);
      const threshold = psalmUsageCounts[Math.floor(psalmUsageCounts.length * 0.25)] || 1;
      let commonCount = 0;
      for (const s of activeSongs) {
        if (s.category === "psalm" && s.usageCount >= threshold) {
          commonCount++;
        }
      }
      subCounts["common"] = commonCount;
      // Store threshold for filtering
      subCounts["_common_threshold"] = threshold;
    }

    return { counts, subCounts };
  }, [activeSongs]);

  // Available psalm numbers (parse from title if psalmNumber not stored)
  const availablePsalmNumbers = useMemo(() => {
    const nums = new Set<number>();
    for (const s of activeSongs) {
      if (s.category === "psalm") {
        const num = s.psalmNumber || parsePsalmNumber(s.title);
        if (num) nums.add(num);
      }
    }
    return nums;
  }, [activeSongs]);

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
          plans = plans.filter((p) => p.ensembleId === selectedEnsemble);
        }

        const matchedIds = new Set<string>();
        const meta = new Map<string, { positions: Set<string>; ensembles: Set<string> }>();

        for (const plan of plans) {
          const positioned = extractSongEntriesWithPosition(plan);
          for (const { entry: songEntry, position } of positioned) {
            const normalized = normalizeTitle(songEntry.title);
            const ids = normalizedTitleIndex.get(normalized);
            if (ids) {
              for (const id of ids) {
                matchedIds.add(id);
                let m = meta.get(id);
                if (!m) {
                  m = { positions: new Set(), ensembles: new Set() };
                  meta.set(id, m);
                }
                m.positions.add(position);
                m.ensembles.add(plan.ensembleId);
              }
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
    const tabCategories = getCategoriesForTab(activeTab);
    let list = activeSongs.filter(s => {
      const cat = (s.category || "song") as string;
      return tabCategories.includes(cat as SongCategory);
    });

    // Sub-filter by tab type
    if (subFilter !== "all") {
      if (activeTab === "songs") {
        list = list.filter(s => (s.functions || []).includes(subFilter));
      } else if (activeTab === "service_music" || activeTab === "gospel_acclamations") {
        list = list.filter(s => s.category === subFilter);
      } else if (activeTab === "psalms") {
        if (subFilter === "common") {
          const threshold = tabCounts.subCounts["_common_threshold"] || 1;
          list = list.filter(s => s.usageCount >= threshold);
        } else {
          list = list.filter(s => {
            const psalmNum = s.psalmNumber || parsePsalmNumber(s.title);
            if (!psalmNum) return false;
            return getPsalmCategories(psalmNum).includes(subFilter);
          });
        }
      } else if (activeTab === "antiphons") {
        list = list.filter(s => (s.functions || []).includes(subFilter));
      }
    }

    // Psalter Book filter — always active for psalms tab
    if (activeTab === "psalms") {
      list = list.filter(s => {
        const num = s.psalmNumber || parsePsalmNumber(s.title);
        return isInPsalterBook(num, selectedBook);
      });
    }

    // Psalm season filter
    if (activeTab === "psalms" && psalmSeasonFilter !== "all") {
      list = list.filter(s => {
        const psalmNum = s.psalmNumber || parsePsalmNumber(s.title);
        if (!psalmNum) return false;
        return getPsalmSeasons(psalmNum).includes(psalmSeasonFilter);
      });
    }

    // Psalm number filter
    if (activeTab === "psalms" && selectedPsalmNumber !== null) {
      list = list.filter(s => {
        const num = s.psalmNumber || parsePsalmNumber(s.title);
        return num === selectedPsalmNumber;
      });
    }

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
          const funcMatches = ORDER_FILTER_TO_FUNCTIONS[filterVal] || [filterVal];
          if (s.functions?.some((fn) => funcMatches.includes(fn))) return true;

          const catMatch = ORDER_FILTER_TO_CATEGORY[filterVal];
          if (catMatch && s.category === catMatch) return true;
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

    // Sort
    if (calendarSongMeta && calendarSongMeta.size > 0) {
      list.sort((a, b) => {
        const metaA = calendarSongMeta.get(a.id);
        const metaB = calendarSongMeta.get(b.id);
        const posA = metaA ? Math.min(...[...metaA.positions].map((p) => MASS_POSITION_ORDER[p] ?? 99)) : 99;
        const posB = metaB ? Math.min(...[...metaB.positions].map((p) => MASS_POSITION_ORDER[p] ?? 99)) : 99;
        if (posA !== posB) return posA - posB;
        return a.title.localeCompare(b.title);
      });
    } else if (activeTab === "psalms" && !search) {
      // Sort psalms by psalm number (canticles = null → sort after 150)
      list.sort((a, b) => {
        const numA = a.psalmNumber || parsePsalmNumber(a.title);
        const numB = b.psalmNumber || parsePsalmNumber(b.title);
        const sortA = numA ?? 999;
        const sortB = numB ?? 999;
        if (sortA !== sortB) return sortA - sortB;
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
  }, [activeSongs, activeTab, subFilter, selectedPsalmNumber, selectedBook, psalmSeasonFilter, search, sort, orderOfMassFilters, seasonFilters, resourceFilters, calendarSongIds, calendarSongMeta, occasionSeasonMap, tabCounts.subCounts]);

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
    const el = listRef.current?.querySelector(`[data-letter-anchor="${letter}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const selectedSong = selectedSongId
    ? activeSongs.find((s) => s.id === selectedSongId) || null
    : null;

  // Track which letters have had their anchor placed
  const placedLetters = new Set<string>();

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-stone-200 px-4 md:px-6 py-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-stone-900">{title}</h1>
              <p className="text-xs text-stone-400">
                {subtitle || `${filtered.length} of ${activeSongs.length} songs`}
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
              {isAdmin && (
                <span className="hidden sm:inline text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                  Music Director
                </span>
              )}
            </div>
          </div>

          {/* 5-tab system */}
          <div className="flex gap-1 mb-1 bg-stone-100 rounded-lg p-0.5 overflow-x-auto">
            {LIBRARY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearch("");
                  setSubFilter("all");
                  setSelectedPsalmNumber(null);
                  setSelectedBook("book1");
                  setPsalmSeasonFilter("all");
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {tab.label} ({tabCounts.counts[tab.id]})
              </button>
            ))}
          </div>

          {/* Sub-filter chips — every tab gets them */}
          <div className="mb-1">
            <SubFilterChips
              filters={
                activeTab === "songs" ? SONG_FUNCTION_FILTERS :
                activeTab === "service_music" ? SERVICE_MUSIC_FILTERS :
                activeTab === "psalms" ? PSALM_FILTERS :
                activeTab === "gospel_acclamations" ? GA_FILTERS :
                ANTIPHON_FUNCTION_FILTERS
              }
              selected={subFilter}
              onSelect={setSubFilter}
              counts={
                activeTab === "antiphons"
                  ? Object.fromEntries(
                      Object.entries(tabCounts.subCounts)
                        .filter(([k]) => k.startsWith("antiphon_"))
                        .map(([k, v]) => [k.replace("antiphon_", ""), v])
                    )
                  : tabCounts.subCounts
              }
            />
            {/* Group by setting toggle — Service Music only */}
            {activeTab === "service_music" && (
              <label className="flex items-center gap-1.5 mt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupBySetting}
                  onChange={(e) => setGroupBySetting(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-stone-300 text-stone-800 focus:ring-stone-400 focus:ring-1"
                />
                <span className="text-[11px] text-stone-500">Group by Setting</span>
              </label>
            )}
            {/* Psalms: Season filter + Book selector + number picker */}
            {activeTab === "psalms" && (
              <>
                {/* Seasonal common psalms */}
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide mr-1">Season</span>
                  {PSALM_SEASON_FILTERS.map((sf) => (
                    <button
                      key={sf.id}
                      onClick={() => setPsalmSeasonFilter(sf.id)}
                      className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        psalmSeasonFilter === sf.id
                          ? "bg-amber-600 text-white"
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}
                    >
                      {sf.label}{sf.id !== "all" ? ` ${tabCounts.subCounts[`season_${sf.id}`] || 0}` : ""}
                    </button>
                  ))}
                </div>
                {/* Psalter Book selector */}
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide mr-1">Book</span>
                  {PSALTER_BOOKS.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => {
                        setSelectedBook(book.id);
                        setSelectedPsalmNumber(null);
                      }}
                      className={`shrink-0 px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        selectedBook === book.id
                          ? "bg-stone-700 text-white"
                          : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      }`}
                    >
                      {book.label}
                    </button>
                  ))}
                </div>
                {/* Number picker — hidden for Canticles book */}
                {selectedBook !== "canticles" && (
                  <PsalmNumberPicker
                    availableNumbers={new Set([...availablePsalmNumbers].filter(n => isInPsalterBook(n, selectedBook)))}
                    selectedNumber={selectedPsalmNumber}
                    onSelect={setSelectedPsalmNumber}
                  />
                )}
              </>
            )}
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
          {sort === "alpha" && !search && activeTab !== "psalms" && (
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
          {/* Filter panel */}
          {filtersVisible && (
            <div className="w-full sm:w-56 sm:shrink-0 border-r border-stone-100 bg-stone-50 overflow-y-auto p-3 sm:block">
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
              className="hidden sm:flex items-center justify-center w-8 shrink-0 border-r border-stone-100 bg-stone-50 hover:bg-stone-100 transition-colors"
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
                  : activeTab === "antiphons"
                  ? "No antiphons in library yet."
                  : "No songs in library yet."}
              </div>
            ) : activeTab === "service_music" && groupBySetting ? (
              // Grouped by mass setting
              <MassSettingGroups songs={filtered} selectedSongId={selectedSongId} onSelectSong={setSelectedSongId} isLent={isLent} uploadedAudio={uploadedAudio} calendarSongMeta={calendarSongMeta} />
            ) : (
              <div className="flex flex-col pb-8">
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
                        isLent={isLent}
                        uploadedAudioUrl={uploadedAudio[song.id]}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedSong && (
        <SongDetailPanel
          song={selectedSong}
          onClose={() => setSelectedSongId(null)}
          onSongRemoved={(id) => setRemovedSongIds(prev => new Set(prev).add(id))}
          panelWidth={panelWidth}
          onResizeStart={handleResizeStart}
          onPreviewOpen={handlePreviewOpen}
        />
      )}

      {/* Add Song Dialog */}
      {addingSong && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => { setAddingSong(false); setDuplicateWarning(null); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
              <h2 className="text-base font-bold text-stone-900 mb-4">Add Song</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => { setNewTitle(e.target.value); setDuplicateWarning(null); }}
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

              {duplicateWarning && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-xs font-medium text-amber-800 mb-2">Potential duplicates found:</p>
                  <div className="space-y-1.5">
                    {duplicateWarning.map((m) => (
                      <div key={m.id} className="text-xs text-amber-700 bg-white rounded px-2 py-1.5 border border-amber-100">
                        <span className="font-medium">{m.title}</span>
                        {m.composer && <span className="text-amber-500"> — {m.composer}</span>}
                        <span className="text-amber-400 ml-1">({m.resourceCount} resources, used {m.usageCount}x)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4 justify-end">
                <button
                  onClick={() => { setAddingSong(false); setNewTitle(""); setNewComposer(""); setDuplicateWarning(null); }}
                  className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-md"
                >
                  Cancel
                </button>
                {duplicateWarning ? (
                  <button
                    disabled={savingNew}
                    onClick={async () => {
                      setSavingNew(true);
                      try {
                        const res = await fetch("/api/songs?force=true", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: newTitle.trim(), composer: newComposer.trim() || undefined }),
                        });
                        if (res.ok) {
                          setAddingSong(false);
                          setNewTitle("");
                          setNewComposer("");
                          setDuplicateWarning(null);
                          window.location.reload();
                        }
                      } finally {
                        setSavingNew(false);
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
                  >
                    {savingNew ? "Adding..." : "Create Anyway"}
                  </button>
                ) : (
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
                        const data = await res.json();
                        if (data.warning === "potential_duplicates") {
                          setDuplicateWarning(data.matches);
                        } else if (res.ok) {
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
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// === Mass Setting Grouping Sub-component ===

function MassSettingGroups({
  songs,
  selectedSongId,
  onSelectSong,
  isLent,
  uploadedAudio,
  calendarSongMeta,
}: {
  songs: LibrarySong[];
  selectedSongId: string | null;
  onSelectSong: (id: string | null) => void;
  isLent: boolean;
  uploadedAudio: Record<string, string>;
  calendarSongMeta: Map<string, { positions: Set<string>; ensembles: Set<string> }> | null;
}) {
  // Group by mass setting name
  const groups = useMemo(() => {
    const bySettingId = new Map<string, { name: string; composer?: string; songs: LibrarySong[] }>();
    const ungrouped: LibrarySong[] = [];

    for (const song of songs) {
      if (song.massSettingId) {
        const settingName = song.massSettingName || song.massSettingId;
        const existing = bySettingId.get(song.massSettingId);
        if (existing) {
          existing.songs.push(song);
        } else {
          // Extract setting name from title parenthetical
          const match = song.title.match(/\(([^)]*(?:Mass|Misa|Heritage|Storrington|Community)[^)]*)\)/i);
          bySettingId.set(song.massSettingId, {
            name: match?.[1] || settingName,
            composer: song.composer,
            songs: [song],
          });
        }
      } else {
        ungrouped.push(song);
      }
    }

    return { grouped: [...bySettingId.values()].sort((a, b) => a.name.localeCompare(b.name)), ungrouped };
  }, [songs]);

  const [collapsedSettings, setCollapsedSettings] = useState<Set<string>>(new Set());

  const toggleSetting = (name: string) => {
    setCollapsedSettings(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="flex flex-col pb-8">
      {groups.grouped.map((group) => (
        <div key={group.name}>
          <button
            onClick={() => toggleSetting(group.name)}
            className="sticky top-0 w-full flex items-center justify-between px-3 py-2 bg-stone-50 border-b border-stone-200 hover:bg-stone-100 transition-colors z-10"
          >
            <div className="text-left">
              <span className="text-xs font-bold text-stone-700">{group.name}</span>
              {group.composer && (
                <span className="text-[10px] text-stone-400 ml-2">{group.composer}</span>
              )}
              <span className="text-[10px] text-stone-300 ml-2">{group.songs.length} pieces</span>
            </div>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`text-stone-400 transition-transform ${collapsedSettings.has(group.name) ? "" : "rotate-90"}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          {!collapsedSettings.has(group.name) && group.songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              isSelected={song.id === selectedSongId}
              onClick={() => onSelectSong(song.id === selectedSongId ? null : song.id)}
              calendarMeta={calendarSongMeta?.get(song.id) ?? null}
              isLent={isLent}
              uploadedAudioUrl={uploadedAudio[song.id]}
            />
          ))}
        </div>
      ))}

      {groups.ungrouped.length > 0 && (
        <>
          <div className="sticky top-0 px-3 py-2 bg-stone-50 border-b border-stone-200 z-10">
            <span className="text-xs font-bold text-stone-500">Other Service Music</span>
            <span className="text-[10px] text-stone-300 ml-2">{groups.ungrouped.length}</span>
          </div>
          {groups.ungrouped.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              isSelected={song.id === selectedSongId}
              onClick={() => onSelectSong(song.id === selectedSongId ? null : song.id)}
              calendarMeta={calendarSongMeta?.get(song.id) ?? null}
              isLent={isLent}
              uploadedAudioUrl={uploadedAudio[song.id]}
            />
          ))}
        </>
      )}
    </div>
  );
}
