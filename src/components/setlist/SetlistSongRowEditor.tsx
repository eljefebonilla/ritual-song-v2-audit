"use client";

import type { SetlistSongRow } from "@/lib/booking-types";

interface Props {
  row: SetlistSongRow;
  onChange: (updated: SetlistSongRow) => void;
  onRemove?: () => void;
}

export default function SetlistSongRowEditor({ row, onChange, onRemove }: Props) {
  const song = row.songs[0] || { title: "" };

  const updateSong = (field: string, value: string) => {
    const updated = { ...song, [field]: value || undefined };
    onChange({ ...row, songs: [updated] });
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

      {/* Song title */}
      <input
        type="text"
        value={song.title || ""}
        onChange={(e) => updateSong("title", e.target.value)}
        placeholder="Song title"
        className="flex-1 text-sm border border-stone-200 rounded-md px-2 py-1.5 focus:border-stone-400 focus:ring-0"
      />

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

      {/* Assignment text */}
      <input
        type="text"
        value={row.assignment_text || ""}
        onChange={(e) =>
          onChange({ ...row, assignment_text: e.target.value || undefined })
        }
        placeholder="Assignments"
        className="w-44 text-xs border border-stone-200 rounded-md px-2 py-1.5 focus:border-stone-400 focus:ring-0 text-stone-500"
      />

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
