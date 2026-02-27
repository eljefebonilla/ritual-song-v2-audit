"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GridRowKey } from "@/lib/grid-types";
import type { GridCellData } from "@/lib/grid-types";

interface SongResult {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  usageCount: number;
}

interface CellEditorProps {
  occasionId: string;
  communityId: string;
  rowKey: GridRowKey;
  currentData: GridCellData;
  anchorRect: DOMRect;
  onSave: (rowKey: GridRowKey, title: string, composer: string) => void;
  onClear: (rowKey: GridRowKey) => void;
  onClose: () => void;
}

export default function CellEditor({
  rowKey,
  currentData,
  anchorRect,
  onSave,
  onClear,
  onClose,
}: CellEditorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState(currentData.title || "");
  const [composer, setComposer] = useState(currentData.composer || "");
  const [mode, setMode] = useState<"search" | "manual">("search");
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Search songs with debounce
  const searchSongs = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/songs?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchSongs(val), 200);
  };

  const handleSelectSong = (song: SongResult) => {
    onSave(rowKey, song.title, song.composer || "");
    onClose();
  };

  const handleManualSave = () => {
    if (!title.trim()) return;
    onSave(rowKey, title.trim(), composer.trim());
    onClose();
  };

  const handleClear = () => {
    onClear(rowKey);
    onClose();
  };

  // Position the popover relative to the anchor cell
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 400);
  const left = Math.min(anchorRect.left, window.innerWidth - 320);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div
        ref={panelRef}
        className="fixed z-50 w-80 bg-white border border-stone-200 rounded-lg shadow-xl"
        style={{ top, left }}
      >
        {/* Tabs */}
        <div className="flex border-b border-stone-100">
          <button
            onClick={() => setMode("search")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              mode === "search"
                ? "text-stone-900 border-b-2 border-stone-900"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Search Library
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              mode === "manual"
                ? "text-stone-900 border-b-2 border-stone-900"
                : "text-stone-400 hover:text-stone-600"
            }`}
          >
            Manual Entry
          </button>
        </div>

        <div className="p-3">
          {mode === "search" ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search songs..."
                className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              {searching && (
                <p className="text-xs text-stone-400 mt-2 px-1">Searching...</p>
              )}
              {results.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-stone-50">
                  {results.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => handleSelectSong(song)}
                      className="w-full text-left px-2 py-2 hover:bg-stone-50 rounded transition-colors"
                    >
                      <p className="text-sm font-medium text-stone-800 truncate">
                        {song.title}
                      </p>
                      {song.composer && (
                        <p className="text-xs text-stone-400 truncate">
                          {song.composer}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {query.trim() && !searching && results.length === 0 && (
                <p className="text-xs text-stone-400 mt-2 px-1">
                  No songs found.{" "}
                  <button
                    onClick={() => {
                      setMode("manual");
                      setTitle(query);
                    }}
                    className="text-stone-600 underline"
                  >
                    Enter manually
                  </button>
                </p>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-medium text-stone-500 uppercase tracking-wide mb-0.5">
                    Title
                  </label>
                  <input
                    ref={mode === "manual" ? inputRef : undefined}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    placeholder="Song title"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-stone-500 uppercase tracking-wide mb-0.5">
                    Composer
                  </label>
                  <input
                    type="text"
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    className="w-full text-sm border border-stone-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-stone-400"
                    placeholder="Composer/arranger"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {!currentData.isEmpty && (
                  <button
                    onClick={handleClear}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Clear
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs text-stone-500 hover:bg-stone-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleManualSave}
                    disabled={!title.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-md hover:bg-stone-800 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
