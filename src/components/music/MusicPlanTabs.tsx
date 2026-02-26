"use client";

import { useState } from "react";
import type { MusicPlan } from "@/lib/types";
import OrderOfWorship from "./OrderOfWorship";

interface MusicPlanTabsProps {
  plans: MusicPlan[];
  seasonColor: string;
}

const COMMUNITY_ORDER = [
  "reflections",
  "foundations",
  "generations",
  "heritage",
  "elevations",
];

export default function MusicPlanTabs({
  plans,
  seasonColor,
}: MusicPlanTabsProps) {
  const sorted = [...plans].sort(
    (a, b) =>
      COMMUNITY_ORDER.indexOf(a.communityId) -
      COMMUNITY_ORDER.indexOf(b.communityId)
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

          return (
            <button
              key={plan.communityId}
              onClick={() => setActiveIdx(i)}
              className={`relative px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                isActive
                  ? "text-stone-900 bg-white"
                  : "text-stone-400 hover:text-stone-600"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {plan.community}
                {!hasData && (
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-200" />
                )}
              </span>
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: seasonColor }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <OrderOfWorship plan={activePlan} seasonColor={seasonColor} />
    </div>
  );
}
