"use client";

import { useState, useMemo } from "react";
import type { LibrarySong, SongResourceType } from "@/lib/types";
import { useUser } from "@/lib/user-context";
import SongCard from "./SongCard";
import SongDetailPanel from "./SongDetailPanel";

interface SongLibraryShellProps {
  songs: LibrarySong[];
}

const SORT_OPTIONS = [
  { id: "usage", label: "Most Used" },
  { id: "alpha", label: "A–Z" },
  { id: "resources", label: "Has Resources" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["id"];

export default function SongLibraryShell({ songs }: SongLibraryShellProps) {
  const { role, setRole } = useUser();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("usage");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

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

  const selectedSong = selectedSongId
    ? songs.find((s) => s.id === selectedSongId) || null
    : null;

  const songsWithResources = songs.filter((s) => s.resources.length > 0).length;

  return (
    <div className="flex h-screen">
      {/* Main list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-stone-200 px-6 py-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-stone-900">Song Library</h1>
              <p className="text-xs text-stone-400">
                {songs.length} songs &middot; {songsWithResources} with resources linked
              </p>
            </div>
            <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
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
            <div className="flex bg-stone-100 rounded-lg p-0.5">
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

        {/* Song list */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="text-center text-stone-400 text-sm py-12">
              {search ? "No songs match your search." : "No songs in library yet. Run the CSV parser to extract songs."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  isSelected={song.id === selectedSongId}
                  onClick={() => setSelectedSongId(song.id === selectedSongId ? null : song.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedSong && (
        <SongDetailPanel
          song={selectedSong}
          onClose={() => setSelectedSongId(null)}
        />
      )}
    </div>
  );
}
