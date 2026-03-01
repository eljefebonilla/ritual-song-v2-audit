"use client";

import { useState } from "react";
import type { LiturgicalDay } from "@/lib/types";
import { LITURGICAL_COLOR_HEX, LITURGICAL_COLOR_LABEL } from "@/lib/liturgical-colors";
import { rankLabel } from "@/lib/liturgical-helpers";

interface TriduumShellProps {
  triduum: {
    holyThursday: LiturgicalDay | null;
    goodFriday: LiturgicalDay | null;
    easterVigil: LiturgicalDay | null;
    easterSunday: LiturgicalDay | null;
  };
}

type Tab = "thursday" | "friday" | "vigil";

const TABS: { id: Tab; label: string; key: keyof TriduumShellProps["triduum"] }[] = [
  { id: "thursday", label: "Holy Thursday", key: "holyThursday" },
  { id: "friday", label: "Good Friday", key: "goodFriday" },
  { id: "vigil", label: "Easter Vigil", key: "easterVigil" },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function TriduumShell({ triduum }: TriduumShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>("thursday");

  // Determine year from first available date
  const firstDate =
    triduum.holyThursday?.date ||
    triduum.goodFriday?.date ||
    triduum.easterVigil?.date;
  const year = firstDate ? new Date(firstDate + "T12:00:00").getFullYear() : "";

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-stone-900 mb-1">
        Sacred Triduum {year}
      </h1>
      <p className="text-sm text-stone-500 mb-6">
        {triduum.holyThursday && triduum.easterVigil
          ? `${formatDate(triduum.holyThursday.date)} \u2013 ${formatDate(triduum.easterVigil.date)}`
          : "Three sacred days of Holy Week"}
      </p>

      {/* Desktop: three columns / Mobile: tabs */}
      <div className="hidden md:grid md:grid-cols-3 md:gap-4">
        {TABS.map((tab) => {
          const day = triduum[tab.key];
          if (!day) return <EmptyPanel key={tab.id} label={tab.label} />;
          return <TriduumPanel key={tab.id} day={day} label={tab.label} />;
        })}
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden">
        <div className="flex border-b border-stone-200 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide text-center transition-colors ${
                activeTab === tab.id
                  ? "text-stone-900 border-b-2 border-stone-900"
                  : "text-stone-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {TABS.map((tab) => {
          if (tab.id !== activeTab) return null;
          const day = triduum[tab.key];
          if (!day) return <EmptyPanel key={tab.id} label={tab.label} />;
          return <TriduumPanel key={tab.id} day={day} label={tab.label} />;
        })}
      </div>

      {/* Cross-panel annotations */}
      <div className="mt-6 space-y-2">
        <Annotation
          label="Gloria"
          notes={[
            "Holy Thursday: Gloria rings out (bells may be rung)",
            "Good Friday: No Gloria",
            "Easter Vigil: Gloria returns with great solemnity",
          ]}
        />
        <Annotation
          label="Alleluia"
          notes={[
            "Holy Thursday: Alleluia is sung",
            "Good Friday: No Alleluia",
            "Easter Vigil: Alleluia returns after the Lenten fast",
          ]}
        />
      </div>

      {/* Easter Sunday link */}
      {triduum.easterSunday && (
        <div className="mt-6 text-center">
          <a
            href={`/day/${triduum.easterSunday.date}`}
            className="text-sm text-parish-burgundy hover:underline"
          >
            Easter Sunday: {triduum.easterSunday.celebrationName} &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

function TriduumPanel({
  day,
  label,
}: {
  day: LiturgicalDay;
  label: string;
}) {
  const colorHex = LITURGICAL_COLOR_HEX[day.colorPrimary];

  return (
    <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
      {/* Color bar */}
      <div className="h-[4px]" style={{ backgroundColor: colorHex }} />

      <div className="p-4 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">
            {label}
          </p>
          <p className="text-sm font-bold text-stone-900 mt-1">
            {day.celebrationName}
          </p>
          <p className="text-xs text-stone-500">{formatDate(day.date)}</p>
        </div>

        {/* Color + rank */}
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full border border-stone-200"
            style={{ backgroundColor: colorHex }}
          />
          <span className="text-xs text-stone-600">
            {LITURGICAL_COLOR_LABEL[day.colorPrimary]}
          </span>
          <span className="text-xs text-stone-400">
            {rankLabel(day.rank)}
          </span>
        </div>

        {/* Gloria / Alleluia */}
        <div className="flex gap-4 text-xs">
          <span className={day.gloria ? "text-green-700 font-medium" : "text-stone-400"}>
            Gloria: {day.gloria ? "YES" : "No"}
          </span>
          <span className={day.alleluia ? "text-green-700 font-medium" : "text-stone-400"}>
            Alleluia: {day.alleluia ? "YES" : "No"}
          </span>
        </div>

        {/* Lectionary */}
        {day.lectionaryNumber && (
          <p className="text-xs text-stone-400">
            Lectionary #{day.lectionaryNumber}
          </p>
        )}

        {/* Occasion link */}
        {day.occasionId ? (
          <a
            href={`/occasion/${day.occasionId}`}
            className="block text-xs text-parish-burgundy hover:underline mt-2"
          >
            View music plan &rarr;
          </a>
        ) : (
          <a
            href={`/day/${day.date}`}
            className="block text-xs text-stone-400 hover:text-stone-600 mt-2"
          >
            View day details &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="border border-stone-200 rounded-lg p-4 bg-stone-50">
      <p className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">
        {label}
      </p>
      <p className="text-xs text-stone-400 mt-2">No data available</p>
    </div>
  );
}

function Annotation({ label, notes }: { label: string; notes: string[] }) {
  return (
    <div className="p-3 bg-stone-50 rounded-lg">
      <p className="text-xs font-semibold text-stone-600 mb-1">{label}</p>
      <div className="space-y-0.5">
        {notes.map((n, i) => (
          <p key={i} className="text-xs text-stone-500">{n}</p>
        ))}
      </div>
    </div>
  );
}
