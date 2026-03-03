"use client";

import { useState } from "react";
import type { MusicPlan, ResolvedSong } from "@/lib/types";
import { ENSEMBLE_BADGES } from "@/lib/occasion-helpers";
import OrderOfWorship from "./OrderOfWorship";

interface MusicPlanTabsProps {
  plans: MusicPlan[];
  seasonColor: string;
  resolvedSongs?: Record<string, ResolvedSong>;
}

const ENSEMBLE_ORDER = [
  "reflections",
  "foundations",
  "generations",
  "heritage",
  "elevations",
];

export default function MusicPlanTabs({
  plans,
  seasonColor,
  resolvedSongs,
}: MusicPlanTabsProps) {
  const sorted = [...plans].sort(
    (a, b) =>
      ENSEMBLE_ORDER.indexOf(a.ensembleId) -
      ENSEMBLE_ORDER.indexOf(b.ensembleId)
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const activePlan = sorted[activeIdx];

  if (!activePlan) return null;

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-stone-200 bg-stone-50">
        {sorted.map((plan, i) => {
          const isActive = i === activeIdx;
          const hasData =
            plan.prelude ||
            plan.gathering ||
            plan.offertory ||
            plan.sending;

          const badge = ENSEMBLE_BADGES[plan.ensembleId];

          return (
            <button
              key={plan.ensembleId}
              onClick={() => setActiveIdx(i)}
              className={`relative px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                isActive
                  ? ""
                  : "hover:opacity-80"
              }`}
              style={{
                color: isActive ? badge?.text ?? "#1c1917" : "#a8a29e",
                backgroundColor: isActive ? badge?.bg : undefined,
              }}
            >
              <span className="flex items-center gap-1.5">
                {plan.ensemble}
                {!hasData && (
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                )}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: badge?.text ?? seasonColor }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <OrderOfWorship plan={activePlan} seasonColor={seasonColor} resolvedSongs={resolvedSongs} />
    </div>
  );
}
