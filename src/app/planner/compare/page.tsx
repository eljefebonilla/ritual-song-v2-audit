import { getAllFullOccasions } from "@/lib/data";
import ComparisonShell from "@/components/planner/ComparisonShell";

export default function ComparePage() {
  const occasions = getAllFullOccasions();

  return (
    <div className="min-h-screen">
      <ComparisonShell occasions={occasions} />
    </div>
  );
}
