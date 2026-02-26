import type { LibrarySong } from "./types";

let songLibraryData: LibrarySong[] | null = null;

export function getSongLibrary(): LibrarySong[] {
  if (songLibraryData) return songLibraryData;
  try {
    songLibraryData = require("../data/song-library.json") as LibrarySong[];
    return songLibraryData;
  } catch {
    return [];
  }
}

export function getSongById(id: string): LibrarySong | null {
  const library = getSongLibrary();
  return library.find((s) => s.id === id) || null;
}
