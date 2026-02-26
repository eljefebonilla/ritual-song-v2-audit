import { getAllFullOccasions } from "@/lib/data";
import PlannerShell from "@/components/planner/PlannerShell";

export default function PlannerPage() {
  const occasions = getAllFullOccasions();

  return (
    <div className="min-h-screen">
      <PlannerShell occasions={occasions} />
    </div>
  );
}
