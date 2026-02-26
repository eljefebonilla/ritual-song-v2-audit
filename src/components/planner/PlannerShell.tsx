"use client";

import { useState, useMemo } from "react";
import type { LiturgicalOccasion, LiturgicalSeason } from "@/lib/types";
import type { YearCycleFilter, CommunityId } from "@/lib/grid-types";
import { getFilteredOccasions, buildGridColumns } from "@/lib/grid-data";
import FilterToolbar from "./FilterToolbar";
import PlannerGrid from "./PlannerGrid";

interface PlannerShellProps {
  occasions: LiturgicalOccasion[];
}

export default function PlannerShell({ occasions }: PlannerShellProps) {
  const [yearCycle, setYearCycle] = useState<YearCycleFilter>("A");
  const [season, setSeason] = useState<LiturgicalSeason | "all">("all");
  const [communityId, setCommunityId] = useState<CommunityId>("reflections");
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(12);

  const filteredOccasions = useMemo(
    () => getFilteredOccasions(occasions, yearCycle, season),
    [occasions, yearCycle, season]
  );

  const maxEnd = filteredOccasions.length;
  const clampedStart = Math.min(rangeStart, maxEnd);
  const clampedEnd = Math.min(rangeEnd, maxEnd);

  const visibleOccasions = filteredOccasions.slice(clampedStart, clampedEnd);

  const columns = useMemo(
    () => buildGridColumns(visibleOccasions, communityId),
    [visibleOccasions, communityId]
  );

  return (
    <div className="flex flex-col h-screen">
      <FilterToolbar
        yearCycle={yearCycle}
        setYearCycle={setYearCycle}
        season={season}
        setSeason={setSeason}
        communityId={communityId}
        setCommunityId={setCommunityId}
        rangeStart={clampedStart}
        rangeEnd={clampedEnd}
        setRangeStart={setRangeStart}
        setRangeEnd={setRangeEnd}
        totalOccasions={filteredOccasions.length}
        occasions={filteredOccasions}
      />
      <div className="flex-1 overflow-hidden">
        <PlannerGrid columns={columns} />
      </div>
    </div>
  );
}
