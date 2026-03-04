"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import type {
  MusicPlan,
  Reading,
  Antiphon,
  OccasionResource,
  ResolvedSong,
  LibrarySong,
  LectionarySynopsis,
  OccasionDate,
  LiturgicalDay,
  CustomSlotRow,
} from "@/lib/types";
import { ENSEMBLE_BADGES, normalizeTitle } from "@/lib/occasion-helpers";
import { planToSlots, mergeCustomSlots } from "@/lib/worship-slots";
import { validateMusicPlan, type ValidationWarning } from "@/lib/liturgical-validation";
import { rowToLiturgicalDay } from "@/lib/liturgical-helpers";
import { findPsalmSettings } from "@/lib/psalm-matching";
import { getTitleIndex, pickBestMatch } from "@/lib/song-library";
import SlotList from "./SlotList";
import SlotEditPopover from "./SlotEditPopover";
import SongDetailPanel from "@/components/library/SongDetailPanel";
import { useViewMode } from "@/hooks/useViewMode";

interface OccasionMusicSectionProps {
  occasionId: string;
  plans: MusicPlan[];
  readings: Reading[];
  antiphons: Antiphon[];
  occasionResources?: OccasionResource[];
  seasonColor: string;
  resolvedSongs: Record<string, ResolvedSong>;
  librarySongs: Record<string, LibrarySong>;
  synopsis?: LectionarySynopsis | null;
  occasionDates?: OccasionDate[];
}

const ENSEMBLE_ORDER = [
  "reflections",
  "foundations",
  "generations",
  "heritage",
  "elevations",
];

/** Triduum occasions where songHints are suppressed (every song relates to the readings) */
const HINT_SUPPRESSED_PREFIXES = ["good-friday", "holy-thursday", "easter-vigil"];

/** Common words to ignore when matching song titles to readings */
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "in", "to", "and", "is", "for", "my", "me", "we",
  "our", "all", "be", "o", "oh", "i", "you", "us", "with", "his", "her",
  "your", "that", "this", "from", "on", "at", "by", "will", "not", "are",
  "let", "come", "who", "day", "new", "sing", "song", "one", "have", "has",
]);

/**
 * Find a reading that thematically echoes a song title.
 * Returns a short hint string or null.
 */
function findSongHint(
  songTitle: string,
  readingsList: Reading[],
  synopsis?: LectionarySynopsis | null
): string | null {
  const titleWords = songTitle
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (titleWords.length === 0) return null;

  // Check against reading summaries
  for (const r of readingsList) {
    if (!r.summary) continue;
    const summaryLower = r.summary.toLowerCase();
    const matches = titleWords.filter((w) => summaryLower.includes(w));
    if (matches.length >= 2 || (matches.length === 1 && matches[0].length > 5)) {
      const label =
        r.type === "gospel" ? "Gospel" :
        r.type === "first" ? "1st Reading" :
        r.type === "second" ? "2nd Reading" :
        r.type === "psalm" ? "Psalm" : r.type;
      const snippet = r.summary.length > 60 ? r.summary.slice(0, 57) + "..." : r.summary;
      return `Echoes the ${label}: "${snippet}"`;
    }
  }

  // Check against synopsis
  if (synopsis) {
    for (const key of ["first", "second", "gospel"] as const) {
      const entry = synopsis.readings[key];
      if (!entry?.synopsis) continue;
      const synLower = entry.synopsis.toLowerCase();
      const matches = titleWords.filter((w) => synLower.includes(w));
      if (matches.length >= 2 || (matches.length === 1 && matches[0].length > 5)) {
        const label = key === "gospel" ? "Gospel" : key === "first" ? "1st Reading" : "2nd Reading";
        const snippet = entry.synopsis.length > 60 ? entry.synopsis.slice(0, 57) + "..." : entry.synopsis;
        return `Echoes the ${label}: "${snippet}"`;
      }
    }
  }

  return null;
}

/** Extract all song titles from a music plan */
function extractSongTitles(plan: MusicPlan): string[] {
  const titles: string[] = [];
  if (plan.prelude?.title) titles.push(plan.prelude.title);
  if (plan.gathering?.title) titles.push(plan.gathering.title);
  if (plan.penitentialAct?.title) titles.push(plan.penitentialAct.title);
  if (plan.gloria?.title) titles.push(plan.gloria.title);
  if (plan.gospelAcclamation?.title) titles.push(plan.gospelAcclamation.title);
  if (plan.offertory?.title) titles.push(plan.offertory.title);
  if (plan.lordsPrayer?.title) titles.push(plan.lordsPrayer.title);
  if (plan.fractionRite?.title) titles.push(plan.fractionRite.title);
  if (plan.sending?.title) titles.push(plan.sending.title);
  for (const s of plan.communionSongs ?? []) {
    if (s.title) titles.push(s.title);
  }
  return titles;
}

// Map WorshipSlot.role → MusicPlan field name
const ROLE_TO_FIELD: Record<string, string> = {
  prelude: "prelude",
  gathering: "gathering",
  penitential_act: "penitentialAct",
  gloria: "gloria",
  responsorial_psalm: "responsorialPsalm",
  gospel_acclamation: "gospelAcclamation",
  offertory: "offertory",
  mass_setting: "eucharisticAcclamations",
  lords_prayer: "lordsPrayer",
  fraction_rite: "fractionRite",
  sending: "sending",
};

export default function OccasionMusicSection({
  occasionId,
  plans,
  readings,
  antiphons,
  occasionResources,
  seasonColor,
  resolvedSongs,
  librarySongs,
  synopsis,
  occasionDates,
}: OccasionMusicSectionProps) {
  const sorted = useMemo(
    () =>
      [...plans].sort(
        (a, b) =>
          ENSEMBLE_ORDER.indexOf(a.ensembleId) -
          ENSEMBLE_ORDER.indexOf(b.ensembleId)
      ),
    [plans]
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedSlotRole, setSelectedSlotRole] = useState<string | null>(null);
  const [panelOffset, setPanelOffset] = useState(0);
  const [audioOverrides, setAudioOverrides] = useState<Record<string, string>>({});
  const [planOverrides, setPlanOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [liturgicalDay, setLiturgicalDay] = useState<LiturgicalDay | null>(null);
  const [editingSlot, setEditingSlot] = useState<{
    role: string;
    anchorRect: DOMRect;
    currentSong?: { title: string; composer?: string; description?: string };
  } | null>(null);
  const [customSlots, setCustomSlots] = useState<Record<string, CustomSlotRow[]>>({});

  const { effectiveIsAdmin: isAdmin } = useViewMode();

  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activePlan = sorted[activeIdx];
  if (!activePlan) return null;

  // Merge Supabase overrides on top of static JSON plan
  // Exclude ensembleId from overrides to prevent accidental overwrites
  const ensembleOverrides = planOverrides[activePlan.ensembleId];
  const mergedPlan = ensembleOverrides && Object.keys(ensembleOverrides).length > 0
    ? { ...activePlan, ...ensembleOverrides, ensembleId: activePlan.ensembleId } as MusicPlan
    : activePlan;

  // Occasion-specific label overrides for special liturgies
  const slotLabelOverrides = useMemo<Record<string, string> | undefined>(() => {
    if (occasionId === "easter-vigil") {
      return {
        prelude: "Procession of the Candle",
        gathering: "Exultet",
      };
    }
    return undefined;
  }, [occasionId]);

  const sectionLabelOverrides = useMemo<Record<string, string> | undefined>(() => {
    if (occasionId === "good-friday-passion") {
      return {
        eucharist: "Veneration of the Cross and Holy Communion",
      };
    }
    return undefined;
  }, [occasionId]);

  const baseSlots = planToSlots(
    mergedPlan,
    readings,
    antiphons,
    occasionResources,
    resolvedSongs,
    slotLabelOverrides,
  );
  const ensembleCustom = customSlots[activePlan.ensembleId] || [];
  const slots = mergeCustomSlots(baseSlots, ensembleCustom);

  const selectedSong = useMemo(() => {
    if (!selectedSongId) return null;
    // Direct ID match from resolved songs
    const direct = Object.values(librarySongs).find((s) => s.id === selectedSongId);
    if (direct) return direct;
    // Unresolved fallback — search library by title
    if (selectedSongId.startsWith("unresolved:")) {
      const title = selectedSongId.slice("unresolved:".length);
      const key = normalizeTitle(title);
      const candidates = getTitleIndex().get(key);
      if (candidates) return pickBestMatch(candidates) ?? null;
    }
    return null;
  }, [selectedSongId, librarySongs]);

  const handleSongSelect = (songId: string, slotRole?: string) => {
    setSelectedSongId((prev) => (prev === songId ? null : songId));
    setSelectedSlotRole(slotRole ?? null);
  };

  const handleAudioUploaded = useCallback((songId: string, url: string) => {
    setAudioOverrides((prev) => ({ ...prev, [songId]: url }));
  }, []);

  const handleSlotEdit = useCallback(
    (role: string, anchorRect: DOMRect, currentSong?: { title: string; composer?: string; description?: string }) => {
      setEditingSlot({ role, anchorRect, currentSong });
    },
    []
  );

  const handleSlotSave = useCallback(
    async (role: string, title: string, composer: string, description?: string) => {
      // Communion songs use array indexing: "communion_0", "communion_1", etc.
      const communionMatch = role.match(/^communion_(\d+)$/);
      let field: string;
      let value: unknown;

      if (communionMatch) {
        // For communion songs, we update the whole communionSongs array
        const idx = parseInt(communionMatch[1], 10);
        const current = mergedPlan.communionSongs ? [...mergedPlan.communionSongs] : [];
        while (current.length <= idx) current.push({ title: "" });
        current[idx] = { title, composer, ...(description ? { description } : {}) };
        field = "communionSongs";
        value = current;
      } else if (role === "responsorial_psalm") {
        field = "responsorialPsalm";
        value = { psalm: title, setting: composer || undefined };
      } else if (role === "mass_setting") {
        field = "eucharisticAcclamations";
        value = { massSettingName: title, composer: composer || undefined };
      } else {
        field = ROLE_TO_FIELD[role] || role;
        value = { title, composer: composer || undefined, ...(description ? { description } : {}) };
      }

      const eid = activePlan.ensembleId;
      if (!eid) throw new Error("No ensemble selected");

      const res = await fetch(`/api/occasions/${occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensembleId: eid, field, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      // Update local overrides so UI reflects the change immediately
      setPlanOverrides(prev => ({
        ...prev,
        [eid]: {
          ...(prev[eid] || {}),
          [field]: value,
        },
      }));
      setEditingSlot(null);
    },
    [occasionId, mergedPlan, activePlan]
  );

  const handleSlotClear = useCallback(
    async (role: string) => {
      const communionMatch = role.match(/^communion_(\d+)$/);
      let field: string;
      let value: unknown = null;

      if (communionMatch) {
        const idx = parseInt(communionMatch[1], 10);
        const current = mergedPlan.communionSongs ? [...mergedPlan.communionSongs] : [];
        current.splice(idx, 1);
        field = "communionSongs";
        value = current.length > 0 ? current : null;
      } else if (role === "responsorial_psalm") {
        field = "responsorialPsalm";
      } else if (role === "mass_setting") {
        field = "eucharisticAcclamations";
      } else {
        field = ROLE_TO_FIELD[role] || role;
      }

      const eid = activePlan.ensembleId;
      if (!eid) throw new Error("No ensemble selected");

      const res = await fetch(`/api/occasions/${occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensembleId: eid, field, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Clear failed (${res.status})`);
      }
      // Update local overrides so UI reflects the change immediately
      setPlanOverrides(prev => ({
        ...prev,
        [eid]: {
          ...(prev[eid] || {}),
          [field]: value,
        },
      }));
      setEditingSlot(null);
    },
    [occasionId, mergedPlan, activePlan]
  );

  const handleCommunionReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const current = mergedPlan.communionSongs ? [...mergedPlan.communionSongs] : [];
      if (current.length < 2) return;
      const [moved] = current.splice(fromIndex, 1);
      current.splice(toIndex, 0, moved);

      const field = "communionSongs";
      const prev = mergedPlan.communionSongs;

      // Optimistic local update
      setPlanOverrides(p => ({
        ...p,
        [activePlan.ensembleId]: {
          ...(p[activePlan.ensembleId] || {}),
          [field]: current,
        },
      }));

      const res = await fetch(`/api/occasions/${occasionId}/music-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensembleId: activePlan.ensembleId, field, value: current }),
      });
      if (!res.ok) {
        // Revert on failure
        setPlanOverrides(p => ({
          ...p,
          [activePlan.ensembleId]: {
            ...(p[activePlan.ensembleId] || {}),
            [field]: prev,
          },
        }));
      }
    },
    [occasionId, mergedPlan]
  );

  // --- Custom slot CRUD handlers ---
  const handleCustomSlotCreate = useCallback(
    async (
      ensembleId: string,
      slotType: string,
      label: string,
      orderPosition: number,
      content: Record<string, unknown>,
    ) => {
      // Optimistic: create a temporary row
      const tempId = `temp-${Date.now()}`;
      const tempRow: CustomSlotRow = {
        id: tempId,
        occasion_id: occasionId,
        ensemble_id: ensembleId,
        slot_type: slotType as CustomSlotRow["slot_type"],
        label,
        order_position: orderPosition,
        content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setCustomSlots((prev) => {
        const existing = prev[ensembleId] || [];
        return { ...prev, [ensembleId]: [...existing, tempRow] };
      });

      try {
        const res = await fetch(`/api/occasions/${occasionId}/custom-slots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ensembleId, slotType, label, orderPosition, content }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Create failed (${res.status})`);
        }
        const created = await res.json();
        // Replace temp row with real row
        setCustomSlots((prev) => {
          const existing = (prev[ensembleId] || []).map((r) =>
            r.id === tempId ? (created as CustomSlotRow) : r,
          );
          return { ...prev, [ensembleId]: existing };
        });
      } catch {
        // Revert optimistic update
        setCustomSlots((prev) => {
          const existing = (prev[ensembleId] || []).filter((r) => r.id !== tempId);
          return { ...prev, [ensembleId]: existing };
        });
      }
    },
    [occasionId],
  );

  const handleCustomSlotUpdate = useCallback(
    async (slotId: string, ensembleId: string, updates: { label?: string; content?: Record<string, unknown> }) => {
      // Snapshot for revert
      const prevSlots = customSlots[ensembleId] || [];

      // Optimistic update
      setCustomSlots((prev) => {
        const existing = (prev[ensembleId] || []).map((r) => {
          if (r.id !== slotId) return r;
          return {
            ...r,
            ...(updates.label !== undefined && { label: updates.label }),
            ...(updates.content !== undefined && { content: updates.content }),
          };
        });
        return { ...prev, [ensembleId]: existing };
      });

      try {
        const res = await fetch(`/api/occasions/${occasionId}/custom-slots/${slotId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) {
          throw new Error("Update failed");
        }
        const updated = await res.json();
        setCustomSlots((prev) => {
          const existing = (prev[ensembleId] || []).map((r) =>
            r.id === slotId ? (updated as CustomSlotRow) : r,
          );
          return { ...prev, [ensembleId]: existing };
        });
      } catch {
        // Revert
        setCustomSlots((prev) => ({ ...prev, [ensembleId]: prevSlots }));
      }
    },
    [occasionId, customSlots],
  );

  const handleCustomSlotDelete = useCallback(
    async (slotId: string, ensembleId: string) => {
      const prevSlots = customSlots[ensembleId] || [];

      // Optimistic remove
      setCustomSlots((prev) => {
        const existing = (prev[ensembleId] || []).filter((r) => r.id !== slotId);
        return { ...prev, [ensembleId]: existing };
      });

      try {
        const res = await fetch(`/api/occasions/${occasionId}/custom-slots/${slotId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error("Delete failed");
        }
      } catch {
        // Revert
        setCustomSlots((prev) => ({ ...prev, [ensembleId]: prevSlots }));
      }
    },
    [occasionId, customSlots],
  );

  const handleSlotReplace = useCallback(
    async (_songId: string, title: string, composer: string) => {
      if (!selectedSlotRole) return;
      await handleSlotSave(selectedSlotRole, title, composer);
    },
    [selectedSlotRole, handleSlotSave]
  );

  // Fetch liturgical day for this occasion
  useEffect(() => {
    if (!occasionDates || occasionDates.length === 0) return;
    const firstDate = occasionDates[0].date;
    if (!firstDate) return;
    let cancelled = false;
    fetch(`/api/liturgical-days?date=${firstDate}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => {
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          setLiturgicalDay(rowToLiturgicalDay(rows[0]));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [occasionDates]);

  // Fetch music plan overrides from Supabase (edits made via slot editor)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/occasions/${occasionId}/music-plan`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (!cancelled) setPlanOverrides(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [occasionId]);

  // Fetch custom worship slots from Supabase
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/occasions/${occasionId}/custom-slots`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        if (!cancelled) setCustomSlots(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [occasionId]);

  // Run validation when liturgical day and active plan are available
  const warnings: ValidationWarning[] = useMemo(() => {
    if (!liturgicalDay || !mergedPlan) return [];
    const titles = extractSongTitles(mergedPlan);
    return validateMusicPlan(liturgicalDay, titles, undefined, occasionId);
  }, [liturgicalDay, mergedPlan, occasionId]);

  // Song hints disabled — too noisy and not deletable by user.
  const songHints: Map<string, string> = useMemo(() => {
    return new Map<string, string>();
  }, []);

  // Compute psalm suggestions from the psalm reading citation
  const psalmSuggestions = useMemo(() => {
    const psalmReading = readings.find((r) => r.type === "psalm");
    if (!psalmReading) return [];
    const allSongs = Object.values(librarySongs);
    return findPsalmSettings(psalmReading.citation, allSongs);
  }, [readings, librarySongs]);

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
          {/* Ensemble Tabs */}
          <div className="flex border-b border-stone-200 bg-stone-50">
            {sorted.map((plan, i) => {
              const isActive = i === activeIdx;
              const hasData =
                plan.prelude ||
                plan.gathering ||
                plan.offertory ||
                plan.sending;
              const badge = ENSEMBLE_BADGES[plan.ensembleId];

              return (
                <button
                  key={plan.ensembleId}
                  onClick={() => {
                    setActiveIdx(i);
                    setSelectedSongId(null);
                    setSelectedSlotRole(null);
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
                    {plan.ensemble}
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

          {/* Validation Warnings */}
          {warnings.length > 0 && (
            <div className="px-3 py-2 space-y-1">
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${
                    w.severity === "error"
                      ? "bg-red-50 border border-red-200 text-red-700"
                      : "bg-amber-50 border border-amber-200 text-amber-700"
                  }`}
                >
                  <span className="shrink-0 mt-0.5">
                    {w.severity === "error" ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    )}
                  </span>
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Slot List */}
          <SlotList
            slots={slots}
            seasonColor={seasonColor}
            selectedSongId={selectedSongId}
            onSongSelect={handleSongSelect}
            selectedRowRef={selectedRowRef}
            audioOverrides={audioOverrides}
            presider={mergedPlan.presider}
            massNotes={mergedPlan.massNotes}
            synopsis={synopsis}
            songHints={songHints}
            isAdmin={isAdmin}
            onSlotEdit={handleSlotEdit}
            onSlotReorder={handleCommunionReorder}
            sectionLabelOverrides={sectionLabelOverrides}
            occasionId={occasionId}
            ensembleId={activePlan.ensembleId}
            onCustomSlotCreate={handleCustomSlotCreate}
            onCustomSlotUpdate={handleCustomSlotUpdate}
            onCustomSlotDelete={handleCustomSlotDelete}
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
                ensembleId={activePlan.ensembleId}
                psalmSuggestions={selectedSong.category === "psalm" ? psalmSuggestions.filter((s) => s.id !== selectedSong.id) : undefined}
                onSelectSuggestion={handleSongSelect}
                occasionId={occasionId}
                slotRole={selectedSlotRole ?? undefined}
                onSlotReplace={handleSlotReplace}
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
            ensembleId={activePlan.ensembleId}
            psalmSuggestions={selectedSong.category === "psalm" ? psalmSuggestions.filter((s) => s.id !== selectedSong.id) : undefined}
            onSelectSuggestion={handleSongSelect}
            occasionId={occasionId}
            slotRole={selectedSlotRole ?? undefined}
            onSlotReplace={handleSlotReplace}
          />
        </div>
      )}

      {/* Slot edit popover */}
      {editingSlot && (
        <SlotEditPopover
          role={editingSlot.role}
          currentSong={editingSlot.currentSong}
          anchorRect={editingSlot.anchorRect}
          onSave={handleSlotSave}
          onClear={handleSlotClear}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  );
}
