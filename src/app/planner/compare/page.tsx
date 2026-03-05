import { getAllFullOccasions } from "@/lib/data";
import { getSongLibrary } from "@/lib/song-library";
import ComparisonShell from "@/components/planner/ComparisonShell";

export const metadata = {
  title: "Comparison View",
};

export default function ComparePage() {
  const occasions = getAllFullOccasions();
  const songs = getSongLibrary();

  return (
    <div className="min-h-screen">
      <ComparisonShell occasions={occasions} songs={songs} />
    </div>
  );
}
