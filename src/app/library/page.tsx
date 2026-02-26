import { getSongLibrary } from "@/lib/song-library";
import SongLibraryShell from "@/components/library/SongLibraryShell";

export default function LibraryPage() {
  const songs = getSongLibrary();

  return (
    <div className="min-h-screen">
      <SongLibraryShell songs={songs} />
    </div>
  );
}
