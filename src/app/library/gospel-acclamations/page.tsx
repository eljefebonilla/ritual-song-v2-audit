import { getSongsByCategory } from "@/lib/song-library";
import SongLibraryShell from "@/components/library/SongLibraryShell";

export default function GospelAcclamationsPage() {
  const songs = getSongsByCategory("gospel_acclamation");

  return (
    <div className="min-h-screen">
      <SongLibraryShell
        songs={songs}
        title="Gospel Acclamations"
        subtitle={`${songs.length} alleluias and gospel acclamations`}
      />
    </div>
  );
}
