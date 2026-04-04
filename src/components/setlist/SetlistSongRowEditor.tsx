"use client";

import { useState, useRef, useEffect } from "react";
import type { SetlistSongRow } from "@/lib/booking-types";

interface PersonnelEntry {
  name: string;
  role: string;
}

interface Props {
  row: SetlistSongRow;
  personnelNames: PersonnelEntry[];
  verseCounts: Record<string, number>;
  onChange: (updated: SetlistSongRow) => void;
  onRemove?: () => void;
}

const PSALM_POSITIONS = ["psalm", "gospel_acclamation"];

function buildQuickPatterns(
  verseCount: number | null,
  cantorName: string | null,
  isPsalm: boolean
): { label: string; value: string }[] {
  const patterns: { label: string; value: string }[] = [];

  if (isPsalm && cantorName) {
    patterns.push({ label: `${cantorName}/ALL`, value: `${cantorName}/ALL` });
  }

  patterns.push({ label: "ALL", value: "ALL" });

  if (cantorName) {
    patterns.push({ label: `Solo: ${cantorName}`, value: cantorName });
  }

  if (verseCount && verseCount >= 2 && cantorName) {
    const parts = Array.from({ length: verseCount }, (_, i) => {
      const vNum = i + 1;
      return vNum % 2 === 1 ? `V${vNum} - ${cantorName}` : `V${vNum} - ALL`;
    });
    patterns.push({ label: "Alternate", value: parts.join("; ") });
  }

  if (verseCount && verseCount >= 2 && cantorName) {
    const parts = Array.from({ length: verseCount }, (_, i) => `V${i + 1} - `);
    patterns.push({ label: "Fill in", value: parts.join("; ") });
  }

  return patterns;
}

export default function SetlistSongRowEditor({
  row,
  personnelNames,
  verseCounts,
  onChange,
  onRemove,
}: Props) {
  const song = row.songs[0] || { title: "" };
  const [showHelper, setShowHelper] = useState(false);
  const helperRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLInputElement>(null);

  // Close helper on outside click
  useEffect(() => {
    if (!showHelper) return;
    function handleClick(e: MouseEvent) {
      if (helperRef.current && !helperRef.current.contains(e.target as Node)) {
        setShowHelper(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showHelper]);

  const updateSong = (field: string, value: string) => {
    const updated = { ...song, [field]: value || undefined };
    onChange({ ...row, songs: [updated] });
  };

  const verseCount = song.song_library_id
    ? verseCounts[song.song_library_id] || null
    : null;

  const isPsalm = PSALM_POSITIONS.includes(row.position);

  // Find the cantor from personnel (first person with cantor-like role)
  const cantor = personnelNames.find(
    (p) => /cantor|vocalist|singer/i.test(p.role)
  );
  const cantorName = cantor?.name || null;

  const quickPatterns = buildQuickPatterns(verseCount, cantorName, isPsalm);

  const insertName = (name: string) => {
    const input = assignRef.current;
    if (!input) return;
    const start = input.selectionStart || 0;
    const current = row.assignment_text || "";
    const newVal = current.slice(0, start) + name + current.slice(input.selectionEnd || start);
    onChange({ ...row, assignment_text: newVal });
    setShowHelper(false);
    setTimeout(() => {
      input.focus();
      const pos = start + name.length;
      input.setSelectionRange(pos, pos);
    }, 0);
  };

  const applyPattern = (value: string) => {
    onChange({ ...row, assignment_text: value });
    setShowHelper(false);
  };

  return (
    <div className="flex items-center gap-2 group">
      {/* Position label */}
      <div className="w-40 shrink-0">
        <input
          type="text"
          value={row.label}
          onChange={(e) => onChange({ ...row, label: e.target.value })}
          className="w-full text-xs font-medium text-stone-600 bg-transparent border-0 px-0 py-1.5 focus:ring-0 focus:outline-none"
        />
      </div>

      {/* Song title + verse count badge */}
      <div className="flex-1 flex items-center gap-1">
        <input
          type="text"
          value={song.title || ""}
          onChange={(e) => updateSong("title", e.target.value)}
          placeholder="Song title"
          className="flex-1 text-sm border border-stone-200 rounded-md px-2 py-1.5 focus:border-stone-400 focus:ring-0"
        />
        {verseCount && (
          <span
            className="shrink-0 text-[10px] font-medium text-stone-400 bg-stone-100 rounded px-1.5 py-0.5"
            title={`${verseCount} verses`}
          >
            {verseCount}v
          </span>
        )}
      </div>

      {/* Composer */}
      <input
        type="text"
        value={song.composer || ""}
        onChange={(e) => updateSong("composer", e.target.value)}
        placeholder="Composer"
        className="w-36 text-sm border border-stone-200 rounded-md px-2 py-1.5 focus:border-stone-400 focus:ring-0"
      />

      {/* Hymnal # */}
      <input
        type="text"
        value={song.hymnal_number || ""}
        onChange={(e) => updateSong("hymnal_number", e.target.value)}
        placeholder="#"
        className="w-16 text-sm border border-stone-200 rounded-md px-2 py-1.5 text-center focus:border-stone-400 focus:ring-0"
      />

      {/* Assignment text with helper */}
      <div className="relative w-52" ref={helperRef}>
        <input
          ref={assignRef}
          type="text"
          value={row.assignment_text || ""}
          onChange={(e) =>
            onChange({ ...row, assignment_text: e.target.value || undefined })
          }
          onFocus={() => setShowHelper(true)}
          placeholder="Assignments"
          className="w-full text-xs border border-stone-200 rounded-md px-2 py-1.5 pr-7 focus:border-stone-400 focus:ring-0 text-stone-500"
        />
        <button
          onClick={() => setShowHelper(!showHelper)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 text-xs"
          title="Assignment helper"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>

        {showHelper && (
          <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-white border border-stone-200 rounded-lg shadow-lg overflow-hidden">
            {/* Quick patterns */}
            {quickPatterns.length > 0 && (
              <div className="px-2 py-1.5 border-b border-stone-100">
                <div className="text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-1">
                  Quick patterns
                </div>
                <div className="flex flex-wrap gap-1">
                  {quickPatterns.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyPattern(p.value)}
                      className="text-[11px] px-2 py-0.5 bg-stone-100 text-stone-600 rounded hover:bg-stone-200"
                      type="button"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Personnel insert */}
            {personnelNames.length > 0 && (
              <div className="px-2 py-1.5">
                <div className="text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-1">
                  Insert name
                </div>
                <div className="flex flex-wrap gap-1">
                  {personnelNames.map((p) => (
                    <button
                      key={`${p.name}-${p.role}`}
                      onClick={() => insertName(p.name)}
                      className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                      type="button"
                      title={p.role}
                    >
                      {p.name.split(" ")[0]}
                      <span className="text-blue-400 ml-0.5 text-[9px]">
                        {p.role.split(/[/,]/)[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Remove button (custom rows only) */}
      {onRemove ? (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-all p-1"
          title="Remove row"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ) : (
        <div className="w-5" />
      )}
    </div>
  );
}
