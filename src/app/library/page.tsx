import { Suspense } from "react";
import { loadSongLibrary } from "@/lib/song-library";
import SongLibraryShell from "@/components/library/SongLibraryShell";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const songs = await loadSongLibrary();

  return (
    <div className="h-full overflow-hidden">
      <Suspense>
        <SongLibraryShell songs={songs} />
      </Suspense>
    </div>
  );
}
