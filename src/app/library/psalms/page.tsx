import { getSongsByCategory } from "@/lib/song-library";
import SongLibraryShell from "@/components/library/SongLibraryShell";

export default function PsalmsPage() {
  const songs = getSongsByCategory("psalm");

  return (
    <div className="min-h-screen">
      <SongLibraryShell
        songs={songs}
        title="Psalms"
        subtitle={`${songs.length} responsorial psalms`}
      />
    </div>
  );
}
