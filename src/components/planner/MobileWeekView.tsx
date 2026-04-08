"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { GridColumn } from "@/lib/grid-types";
import {
  GRID_SECTIONS,
  GRID_ROW_LABELS,
  READING_ROWS,
  MASS_PART_ROWS,
  MASS_SETTING_SUB_ROWS,
  type GridRowKey,
} from "@/lib/grid-types";
import type { LibrarySong } from "@/lib/types";
import { extractCellData } from "@/lib/grid-data";
import { normalizeTitle } from "@/lib/occasion-helpers";
import { SEASON_COLORS, getOccasionColor } from "@/lib/liturgical-colors";
import { getTitleIndex, pickBestMatch, resourceUrl } from "@/lib/song-library";
import { useMedia } from "@/lib/media-context";
import GridCell from "./GridCell";

const MASS_SETTING_SUB_SET = new Set<GridRowKey>(MASS_SETTING_SUB_ROWS);

interface MobileWeekViewProps {
  columns: GridColumn[];
  hideMassParts?: boolean;
  hideReadings?: boolean;
  ensembleId?: string;
  onHideOccasion?: (id: string) => void;
}

function findPlayable(song: LibrarySong): { url: string; type: "audio" | "youtube"; label?: string } | null {
  for (const r of song.resources) {
    if (r.type === "audio" && (r.url || r.storagePath)) {
      const url = resourceUrl(r);
      if (url) return { url, type: "audio", label: r.label };
    }
  }
  for (const r of song.resources) {
    if (r.type === "youtube" && r.url) {
      return { url: r.url, type: "youtube", label: r.label };
    }
  }
  if (song.youtubeUrl) {
    return { url: song.youtubeUrl, type: "youtube" };
  }
  return null;
}

export default function MobileWeekView({
  columns,
  hideMassParts = false,
  hideReadings = false,
  onHideOccasion,
}: MobileWeekViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { play } = useMedia();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [massSettingExpanded, setMassSettingExpanded] = useState(false);

  // Audio
  const songIndex = useMemo(() => getTitleIndex(), [columns]); // eslint-disable-line react-hooks/exhaustive-deps
  const psalmIndex = useMemo(() => {
    const map = new Map<number, LibrarySong[]>();
    for (const candidates of songIndex.values()) {
      for (const s of candidates) {
        if (s.psalmNumber && s.category === "psalm") {
          const arr = map.get(s.psalmNumber) || [];
          arr.push(s);
          map.set(s.psalmNumber, arr);
        }
      }
    }
    return map;
  }, [songIndex]);
  const lookupSong = useCallback((title: string, composer?: string): LibrarySong | null => {
    const key = normalizeTitle(title);
    const candidates = songIndex.get(key);
    if (candidates) {
      const match = pickBestMatch(candidates, composer);
      if (match) return match;
    }
    const psalmMatch = title.match(/^Ps(?:alm)?\s+(\d+)/i);
    if (psalmMatch && composer) {
      const psalmNum = parseInt(psalmMatch[1], 10);
      const psalmCandidates = psalmIndex.get(psalmNum);
      if (psalmCandidates) return pickBestMatch(psalmCandidates, composer);
    }
    return null;
  }, [songIndex, psalmIndex]);

  const [audioOverrides, setAudioOverrides] = useState<Record<string, string>>({});
  const [youtubeOverrides, setYoutubeOverrides] = useState<Record<string, string>>({});

  // Batch audio fetch for current column
  const currentCol = columns[currentIndex];
  useEffect(() => {
    if (!currentCol?.plan) return;
    const ids = new Set<string>();
    const fields = ["prelude", "gathering", "penitentialAct", "gloria", "offertory", "lordsPrayer", "fractionRite", "sending", "responsorialPsalm", "gospelAcclamation"] as const;
    for (const f of fields) {
      const val = currentCol.plan[f as keyof typeof currentCol.plan];
      if (val && typeof val === "object" && "title" in val) {
        const song = lookupSong((val as { title: string }).title, (val as { composer?: string }).composer);
        if (song) ids.add(song.id);
      }
    }
    if (currentCol.plan.communionSongs) {
      for (const s of currentCol.plan.communionSongs) {
        const song = lookupSong(s.title, s.composer);
        if (song) ids.add(song.id);
      }
    }
    const idArr = [...ids];
    if (idArr.length === 0) return;
    fetch(`/api/songs/batch-audio?ids=${idArr.join(",")}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.audioUrls) setAudioOverrides(data.audioUrls);
        if (data?.youtubeUrls) setYoutubeOverrides(data.youtubeUrls);
      })
      .catch(() => {});
  }, [currentCol, lookupSong]);

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Only register horizontal swipes (not vertical scrolling)
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) || dt > 500) return;

    if (dx < 0 && currentIndex < columns.length - 1) {
      setCurrentIndex(i => i + 1);
    } else if (dx > 0 && currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  };

  // Clamp index if columns change
  useEffect(() => {
    if (currentIndex >= columns.length) setCurrentIndex(Math.max(0, columns.length - 1));
  }, [columns.length, currentIndex]);

  if (columns.length === 0) {
    return <div className="p-6 text-center text-stone-400">No occasions to display.</div>;
  }

  const col = columns[currentIndex];
  const occasion = col.occasion;
  const occColor = getOccasionColor(occasion.id, occasion.season);
  const colors = SEASON_COLORS[occasion.season] || SEASON_COLORS.ordinary;

  // Build rows
  const rows: { type: "header" | "row"; label: string; key?: GridRowKey; isReading?: boolean; isExpandable?: boolean; isSubRow?: boolean }[] = [];
  for (const section of GRID_SECTIONS) {
    const visibleRows = section.rows.filter((rowKey) => {
      if (hideMassParts && MASS_PART_ROWS.has(rowKey)) return false;
      if (hideReadings && READING_ROWS.has(rowKey)) return false;
      if (MASS_SETTING_SUB_SET.has(rowKey) && !massSettingExpanded) return false;
      return true;
    });
    if (visibleRows.length === 0) continue;
    rows.push({ type: "header", label: section.label });
    for (const rowKey of visibleRows) {
      rows.push({
        type: "row",
        label: GRID_ROW_LABELS[rowKey],
        key: rowKey,
        isReading: READING_ROWS.has(rowKey),
        isExpandable: rowKey === "massSetting",
        isSubRow: MASS_SETTING_SUB_SET.has(rowKey),
      });
    }
  }

  const shortName = occasion.name
    .replace(/\[([ABC])\]/, "")
    .replace(/^(ORDINARY TIME|ORD\. TIME)\s*/, "OT ")
    .trim();

  const displayDate = occasion.dates?.find(d => d.date >= new Date().toISOString().split("T")[0])?.label
    || occasion.dates?.[0]?.label || "";
  const dateShort = displayDate.replace(/Year [ABC] — /, "").replace(/\s*\(.*\)/, "");

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header with occasion info + dot navigation */}
      <div
        className="sticky top-0 z-20 px-4 pt-3 pb-2"
        style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${occColor}, white 85%), white)` }}
      >
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="p-1 text-stone-400 disabled:opacity-20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-xs text-stone-400 font-medium">{dateShort}</p>
            <p className="text-sm font-bold text-stone-800 truncate">{shortName}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <span
                className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-sm text-white"
                style={{ backgroundColor: colors.primary }}
              >
                {occasion.seasonLabel}
              </span>
              {occasion.year !== "ABC" && (
                <span className="text-[9px] font-bold text-stone-400">{occasion.year}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setCurrentIndex(i => Math.min(columns.length - 1, i + 1))}
            disabled={currentIndex === columns.length - 1}
            className="p-1 text-stone-400 disabled:opacity-20"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-1">
          {columns.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all ${
                i === currentIndex ? "w-2 h-2" : "w-1.5 h-1.5 opacity-30"
              }`}
              style={{ backgroundColor: i === currentIndex ? occColor : "#a8a29e" }}
            />
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="px-2 pb-80">
        {rows.map((row, ri) => {
          if (row.type === "header") {
            return (
              <div key={`h-${ri}`} className="px-2 pt-4 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                  {row.label}
                </span>
              </div>
            );
          }

          const rowKey = row.key!;
          const cellData = extractCellData(col.plan, rowKey, col.occasion);

          // Song lookup for audio
          let matchedSong: LibrarySong | null = null;
          let playable: ReturnType<typeof findPlayable> = null;
          if (!row.isReading && !cellData.isEmpty && cellData.title) {
            matchedSong = lookupSong(cellData.title, cellData.composer);
            if (matchedSong) {
              const overrideUrl = audioOverrides[matchedSong.id];
              const ytOverrideUrl = youtubeOverrides[matchedSong.id];
              if (overrideUrl) {
                playable = { url: overrideUrl, type: "audio" };
              } else {
                playable = findPlayable(matchedSong);
                if (!playable && ytOverrideUrl) {
                  playable = { url: ytOverrideUrl, type: "youtube" };
                }
              }
            }
          }

          return (
            <div
              key={`r-${ri}`}
              className={`flex items-start gap-2 px-2 py-1.5 border-b border-stone-100 ${
                row.isReading ? "bg-stone-50/50" : ""
              }`}
            >
              <span className={`text-[9px] font-medium uppercase tracking-wide w-20 shrink-0 pt-0.5 text-right ${
                row.isReading ? "text-stone-400 italic" : row.isSubRow ? "text-stone-400" : "text-stone-500"
              }`}>
                {row.isExpandable ? (
                  <button
                    onClick={() => setMassSettingExpanded(!massSettingExpanded)}
                    className="flex items-center gap-0.5 ml-auto"
                  >
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`transition-transform ${massSettingExpanded ? "rotate-90" : ""}`}
                    ><polyline points="9 18 15 12 9 6" /></svg>
                    {row.label}
                  </button>
                ) : row.label}
              </span>
              <div className="flex-1 min-w-0">
                <GridCell
                  data={cellData}
                  isEven={false}
                  hasAudio={!!playable}
                  audioType={playable?.type}
                  onPlay={playable && matchedSong ? () => {
                    play({
                      type: playable!.type,
                      url: playable!.url,
                      title: matchedSong!.title,
                      subtitle: playable!.label,
                      songId: matchedSong!.id,
                    });
                  } : undefined}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
