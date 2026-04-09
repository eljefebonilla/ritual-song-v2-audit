import { notFound } from "next/navigation";
import { getAllFullOccasions } from "@/lib/data";
import PlannerShell from "@/components/planner/PlannerShell";
import { getSharedView } from "@/lib/shared-view";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function SharePlannerPage({ params }: Props) {
  const { token } = await params;
  const view = await getSharedView(token);
  if (!view || !view.config.types.includes("planner")) notFound();

  const occasions = getAllFullOccasions();

  return (
    <div className="h-full overflow-hidden">
      <PlannerShell
        occasions={occasions}
        viewerMode
        viewerConfig={view.config}
        viewerName={view.name}
      />
    </div>
  );
}
