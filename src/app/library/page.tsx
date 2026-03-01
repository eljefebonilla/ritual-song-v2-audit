import { Suspense } from "react";
import { getSongLibrary } from "@/lib/song-library";
import SongLibraryShell from "@/components/library/SongLibraryShell";

export default function LibraryPage() {
  const songs = getSongLibrary();

  return (
    <div className="h-full overflow-hidden">
      <Suspense>
        <SongLibraryShell songs={songs} />
      </Suspense>
    </div>
  );
}
