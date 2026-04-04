"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface SetlistRow {
  id: string;
  occasion_name: string | null;
  generation_status: string | null;
  generated_at: string | null;
  setlist_pdf_url: string | null;
  mass_event: {
    id: string;
    title: string;
    event_date: string;
    start_time_12h: string | null;
    ensemble: string | null;
    liturgical_name: string | null;
  } | null;
}

export default function MenusPage() {
  const [setlists, setSetlists] = useState<SetlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchSetlists = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/setlists?from=${today}`)
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        // Filter to only those with a linked mass event and sort by date
        const valid = items
          .filter((s: SetlistRow) => s.mass_event)
          .sort((a: SetlistRow, b: SetlistRow) =>
            (a.mass_event!.event_date || "").localeCompare(b.mass_event!.event_date || "")
          );
        setSetlists(valid);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSetlists(); }, [fetchSetlists]);

  const handleGenerate = useCallback(async (setlistId: string, massEventId: string) => {
    setGenerating(setlistId);
    try {
      // Get parish ID
      const infoRes = await fetch(`/api/generate/occasion-info?occasionId=_`);
      const info = await infoRes.json();
      const parishId = info.parishId;
      if (!parishId) return;

      await fetch("/api/generate/setlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ massEventId, parishId }),
      });

      // Refresh list
      setTimeout(fetchSetlists, 1000);
    } finally {
      setGenerating(null);
    }
  }, [fetchSetlists]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-bold text-stone-900 mb-4">Menus</h1>
        <p className="text-sm text-stone-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Menus</h1>
          <p className="text-sm text-stone-500 mt-1">
            Setlist PDFs for upcoming liturgies. Auto-generated when songs are assigned.
          </p>
        </div>
      </div>

      {setlists.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p className="text-sm">No upcoming setlists yet.</p>
          <p className="text-xs mt-1">
            Assign songs in the{" "}
            <Link href="/planner" className="text-stone-600 underline">
              Multi-Week planner
            </Link>{" "}
            or{" "}
            <Link href="/liturgies/plan-a-mass" className="text-stone-600 underline">
              Plan a Mass
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {setlists.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 rounded-lg border border-stone-200 hover:border-stone-300 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-stone-800 truncate">
                    {s.occasion_name || s.mass_event?.liturgical_name || s.mass_event?.title || "Mass"}
                  </span>
                  <StatusDot status={s.generation_status} />
                </div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {s.mass_event?.event_date && formatDate(s.mass_event.event_date)}
                  {s.mass_event?.start_time_12h && ` · ${s.mass_event.start_time_12h}`}
                  {s.mass_event?.ensemble && ` · ${s.mass_event.ensemble}`}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {s.setlist_pdf_url ? (
                  <a
                    href={s.setlist_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-stone-900 text-white rounded-md hover:bg-stone-800"
                  >
                    Download
                  </a>
                ) : (
                  <button
                    onClick={() => handleGenerate(s.id, s.mass_event!.id)}
                    disabled={generating === s.id}
                    className="text-xs px-3 py-1.5 border border-stone-300 text-stone-600 rounded-md hover:bg-stone-50 disabled:opacity-50"
                  >
                    {generating === s.id ? "Generating..." : "Generate"}
                  </button>
                )}
                <Link
                  href={`/admin/setlist/${s.mass_event?.id}`}
                  className="text-xs px-2 py-1.5 text-stone-400 hover:text-stone-600"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
