"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { LibrarySong } from "@/lib/types";
import { useUser } from "@/lib/user-context";
import SongCard from "./SongCard";
import SongDetailPanel from "./SongDetailPanel";
import AlphabetJump from "./AlphabetJump";

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

export default function SongLibraryShell({ songs, title = "Song Library", subtitle }: SongLibraryShellProps) {
  const { role, setRole, isAdmin } = useUser();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("usage");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [addingSong, setAddingSong] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newComposer, setNewComposer] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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

    // Sort
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

    return list;
  }, [songs, search, sort]);

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

    // Find the card element by data attribute
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
      {/* Main list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-stone-200 px-4 md:px-6 py-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-stone-900">{title}</h1>
              <p className="text-xs text-stone-400">
                {subtitle || `${songs.length} songs \u00b7 ${songsWithResources} with resources linked`}
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
          </div>
        </div>

        {/* Song list + alphabet jump */}
        <div className="flex-1 flex overflow-hidden">
          <div ref={listRef} className="flex-1 overflow-y-auto p-4 md:p-6">
            {filtered.length === 0 ? (
              <div className="text-center text-stone-400 text-sm py-12">
                {search ? "No songs match your search." : "No songs in library yet. Run the CSV parser to extract songs."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((song) => {
                  const firstChar = song.title.charAt(0).toUpperCase();
                  const isAnchor = sort === "alpha" && /[A-Z]/.test(firstChar) && !placedLetters.has(firstChar);
                  if (isAnchor) placedLetters.add(firstChar);

                  return (
                    <div key={song.id} {...(isAnchor ? { "data-letter-anchor": firstChar } : {})}>
                      <SongCard
                        song={song}
                        isSelected={song.id === selectedSongId}
                        onClick={() => setSelectedSongId(song.id === selectedSongId ? null : song.id)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Alphabet jump — only when sorted A-Z */}
          {sort === "alpha" && !search && (
            <AlphabetJump
              availableLetters={availableLetters}
              onLetterClick={handleLetterClick}
            />
          )}
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
                        // Refresh page to pick up new song
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
