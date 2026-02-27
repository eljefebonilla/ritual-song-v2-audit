import { getSongsByCategory } from "@/lib/song-library";
import SongLibraryShell from "@/components/library/SongLibraryShell";

export default function MassPartsPage() {
  const songs = getSongsByCategory("mass_part");

  return (
    <div className="min-h-screen">
      <SongLibraryShell
        songs={songs}
        title="Mass Parts"
        subtitle={`${songs.length} mass parts (Kyrie, Gloria, Lamb of God, etc.)`}
      />
    </div>
  );
}
