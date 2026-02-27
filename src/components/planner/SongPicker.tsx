"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { LibrarySong } from "@/lib/types";

interface SongPickerProps {
  songs: LibrarySong[];
  onSelect: (song: LibrarySong) => void;
  placeholder?: string;
}

export default function SongPicker({ songs, onSelect, placeholder = "Search songs..." }: SongPickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return songs
      .filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.composer && s.composer.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [query, songs]);

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
      />
      {results.length > 0 && (
        <div className="mt-1 max-h-48 overflow-y-auto border border-stone-200 rounded-md bg-white divide-y divide-stone-50">
          {results.map((song) => (
            <button
              key={song.id}
              type="button"
              onClick={() => onSelect(song)}
              className="w-full text-left px-3 py-2 hover:bg-stone-50 transition-colors"
            >
              <p className="text-sm font-medium text-stone-800 truncate">{song.title}</p>
              {song.composer && (
                <p className="text-xs text-stone-400 truncate">{song.composer}</p>
              )}
            </button>
          ))}
        </div>
      )}
      {query.trim() && results.length === 0 && (
        <p className="mt-1 text-xs text-stone-400 px-1">No songs found</p>
      )}
    </div>
  );
}
