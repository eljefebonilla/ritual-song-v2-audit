"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface UpcomingMass {
  id: string;
  title: string;
  event_date: string;
  start_time_12h: string | null;
  ensemble: string | null;
  liturgical_name: string | null;
  setlist_id: string | null;
  occasion_name: string | null;
  generation_status: string | null;
  setlist_pdf_url: string | null;
  filled_positions: number;
  total_positions: number;
  missing_required: string[];
  is_complete: boolean;
}

const POSITION_LABELS: Record<string, string> = {
  gathering: "Gathering",
  psalm: "Psalm",
  offertory: "Offertory",
  communion_1: "Communion",
  sending: "Sending",
};

export default function MenusPage() {
  const [masses, setMasses] = useState<UpcomingMass[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchMasses = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/upcoming-masses?from=${today}`)
      .then((r) => r.json())
      .then((data) => {
        setMasses(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchMasses(); }, [fetchMasses]);

  const handleGenerate = useCallback(async (massEventId: string) => {
    setGenerating(massEventId);
    try {
      const infoRes = await fetch(`/api/generate/occasion-info?occasionId=_`);
      const info = await infoRes.json();
      const parishId = info.parishId;
      if (!parishId) return;

      await fetch("/api/generate/setlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ massEventId, parishId }),
      });

      setTimeout(fetchMasses, 1000);
    } finally {
      setGenerating(null);
    }
  }, [fetchMasses]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-bold text-stone-900 mb-4">Menus</h1>
        <p className="text-sm text-stone-400">Loading...</p>
      </div>
    );
  }

  // Group by date
  const grouped = new Map<string, UpcomingMass[]>();
  for (const m of masses) {
    const key = m.event_date;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Menus</h1>
          <p className="text-sm text-stone-500 mt-1">
            Setlist PDFs for upcoming liturgies. Fills in as songs are assigned.
          </p>
        </div>
      </div>

      {masses.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p className="text-sm">No upcoming Masses found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([date, dateMasses]) => (
            <div key={date}>
              <h2 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                {formatDateHeading(date)}
              </h2>
              <div className="space-y-1.5">
                {dateMasses.map((m) => (
                  <MassRow
                    key={m.id}
                    mass={m}
                    generating={generating === m.id}
                    onGenerate={() => handleGenerate(m.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MassRow({
  mass,
  generating,
  onGenerate,
}: {
  mass: UpcomingMass;
  generating: boolean;
  onGenerate: () => void;
}) {
  const hasSetlist = mass.setlist_id !== null;
  const pct = hasSetlist
    ? Math.round((mass.filled_positions / mass.total_positions) * 100)
    : 0;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-stone-800 truncate">
            {mass.occasion_name || mass.liturgical_name || mass.title || "Mass"}
          </span>
          {hasSetlist && <CompletenessChip pct={pct} isComplete={mass.is_complete} />}
          <StatusDot status={mass.generation_status} />
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-stone-400">
            {mass.start_time_12h || ""}
            {mass.ensemble && ` · ${mass.ensemble}`}
          </span>
          {mass.missing_required.length > 0 && hasSetlist && (
            <span className="text-[10px] text-amber-500">
              Need: {mass.missing_required.map((p) => POSITION_LABELS[p] || p).join(", ")}
            </span>
          )}
          {!hasSetlist && (
            <span className="text-[10px] text-stone-300">No setlist yet</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        {mass.setlist_pdf_url ? (
          <>
            <a
              href={mass.setlist_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800"
            >
              Download
            </a>
            {mass.is_complete && (
              <button
                onClick={onGenerate}
                disabled={generating}
                className="text-xs px-2 py-1.5 text-stone-400 hover:text-stone-600 disabled:opacity-50"
              >
                {generating ? "..." : "Regen"}
              </button>
            )}
          </>
        ) : mass.is_complete ? (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="text-xs px-3 py-1.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50 disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate"}
          </button>
        ) : null}
        <Link
          href={`/admin/setlist/${mass.id}`}
          className="text-xs px-2 py-1.5 text-stone-400 hover:text-stone-600"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}

function CompletenessChip({ pct, isComplete }: { pct: number; isComplete: boolean }) {
  if (isComplete) return null;
  const bg = pct === 0 ? "bg-stone-100 text-stone-400" : "bg-amber-50 text-amber-600";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${bg}`}>
      {pct}%
    </span>
  );
}

function StatusDot({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    ready: "bg-green-500",
    generating: "bg-amber-500 animate-pulse",
    failed: "bg-red-500",
    outdated: "bg-orange-400",
  };
  if (!status || status === "idle") return null;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status] || "bg-stone-300"}`}
      title={status}
    />
  );
}

function formatDateHeading(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
