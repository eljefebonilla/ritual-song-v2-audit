"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SongEntry } from "@/lib/types";

interface SongResult {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  usageCount: number;
}

const ROLE_CATEGORY_FILTER: Record<string, string> = {
  gospel_acclamation: "gospel_acclamation_refrain",
  responsorial_psalm: "psalm",
  gloria: "gloria",
};

interface SlotEditPopoverProps {
  role: string;
  currentSong?: SongEntry;
  anchorRect: DOMRect;
  onSave: (role: string, title: string, composer: string) => Promise<void>;
  onClear: (role: string) => Promise<void>;
  onClose: () => void;
}

export default function SlotEditPopover({
  role,
  currentSong,
  anchorRect,
  onSave,
  onClear,
  onClose,
}: SlotEditPopoverProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [title, setTitle] = useState(currentSong?.title || "");
  const [composer, setComposer] = useState(currentSong?.composer || "");
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

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
      const cat = ROLE_CATEGORY_FILTER[role];
      const catParam = cat ? `&category=${encodeURIComponent(cat)}` : "";
      const res = await fetch(`/api/songs?q=${encodeURIComponent(q)}&limit=10${catParam}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [role]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchSongs(val), 200);
  };

  const handleSelectSong = async (song: SongResult) => {
    setSaving(true);
    setError(null);
    try {
      await onSave(role, song.title, song.composer || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(role, title.trim(), composer.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError(null);
    try {
      await onClear(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear.");
      setSaving(false);
    }
  };

  // Position the popover relative to the anchor row
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 400);
  const left = Math.min(anchorRect.left + 40, window.innerWidth - 330);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div
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
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-2">{error}</p>
          )}
          {saving ? (
            <p className="text-xs text-stone-500 py-4 text-center">Saving...</p>
          ) : mode === "search" ? (
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
                    ref={inputRef}
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
                {currentSong && (
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
