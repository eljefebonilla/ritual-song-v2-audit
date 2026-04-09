"use client";

import { useMemo, useState } from "react";
import type { SharedView, SharedViewType } from "@/lib/shared-view";

interface OccasionOption {
  id: string;
  name: string;
  year: string;
  season: string;
}

interface Props {
  occasions: OccasionOption[];
  existing: SharedView[];
}

type ViewTypeSelection = { planner: boolean; calendar: boolean; library: boolean };

const SEASON_OPTIONS: { id: string; label: string }[] = [
  { id: "all", label: "All Seasons" },
  { id: "advent", label: "Advent" },
  { id: "christmas", label: "Christmas" },
  { id: "lent", label: "Lent" },
  { id: "holyweek", label: "Holy Week" },
  { id: "easter", label: "Easter" },
  { id: "ordinary", label: "Ordinary Time" },
  { id: "solemnity", label: "Solemnities" },
  { id: "feast", label: "Feasts" },
];

const ENSEMBLE_OPTIONS: { id: string; label: string }[] = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

const YEAR_OPTIONS = ["A", "B", "C", "all"] as const;

export default function ShareAdminClient({ occasions, existing }: Props) {
  const [views, setViews] = useState<SharedView[]>(existing);
  const [name, setName] = useState("");
  const [types, setTypes] = useState<ViewTypeSelection>({
    planner: true,
    calendar: true,
    library: true,
  });
  const [yearCycle, setYearCycle] = useState<"A" | "B" | "C" | "all">("A");
  const [season, setSeason] = useState<string>("easter");
  const [ensembleId, setEnsembleId] = useState<string>("generations");
  const [startOccasionId, setStartOccasionId] = useState<string>("");
  const [endOccasionId, setEndOccasionId] = useState<string>("");
  const [hiddenOccasionIds, setHiddenOccasionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredOccasions = useMemo(() => {
    return occasions.filter((o) => {
      if (yearCycle !== "all" && o.year !== yearCycle && o.year !== "ABC") return false;
      if (season !== "all" && o.season !== season) return false;
      return true;
    });
  }, [occasions, yearCycle, season]);

  const toggleHidden = (id: string) => {
    setHiddenOccasionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setError(null);
    setCreatedUrl(null);
    setCopied(false);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const selectedTypes: SharedViewType[] = [];
    if (types.planner) selectedTypes.push("planner");
    if (types.calendar) selectedTypes.push("calendar");
    if (types.library) selectedTypes.push("library");
    if (selectedTypes.length === 0) {
      setError("Select at least one view type.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/shared-views", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          config: {
            types: selectedTypes,
            yearCycle,
            season,
            ensembleId,
            startOccasionId: startOccasionId || null,
            endOccasionId: endOccasionId || null,
            hiddenOccasionIds,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to save.");
        return;
      }
      const view = json.view as { id: string };
      const origin = window.location.origin;
      const url = `${origin}/share/${view.id}/${selectedTypes[0]}`;
      setCreatedUrl(url);
      const refreshed = await fetch("/api/shared-views");
      if (refreshed.ok) {
        const listJson = await refreshed.json();
        setViews(listJson.views || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm("Deactivate this share view? The link will stop working.")) return;
    const res = await fetch(`/api/shared-views/${id}`, { method: "DELETE" });
    if (res.ok) {
      setViews((v) => v.filter((x) => x.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-white border border-stone-200 rounded-lg p-5">
        <h2 className="font-serif text-lg text-stone-900 mb-4">New share view</h2>

        {createdUrl && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded">
            <div className="text-xs text-emerald-800 mb-1 font-semibold">
              Share link ready. Copy and email:
            </div>
            <div className="flex gap-2 items-center">
              <input
                readOnly
                value={createdUrl}
                className="flex-1 px-2 py-1 bg-white border border-emerald-300 rounded text-sm font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Easter 2026 — Members View"
              className="mt-1 w-full px-3 py-2 border border-stone-300 rounded text-sm"
            />
          </label>

          <div className="block">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Include tabs</span>
            <div className="mt-1 flex gap-3">
              {(["planner", "calendar", "library"] as const).map((key) => (
                <label key={key} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={types[key]}
                    onChange={(e) => setTypes((t) => ({ ...t, [key]: e.target.checked }))}
                  />
                  {key === "planner" ? "Multi-Week" : key === "calendar" ? "Calendar" : "Song Library"}
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Year cycle</span>
            <select
              value={yearCycle}
              onChange={(e) => setYearCycle(e.target.value as "A" | "B" | "C" | "all")}
              className="mt-1 w-full px-3 py-2 border border-stone-300 rounded text-sm"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y === "all" ? "All" : `Year ${y}`}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Season</span>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-stone-300 rounded text-sm"
            >
              {SEASON_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Ensemble</span>
            <select
              value={ensembleId}
              onChange={(e) => setEnsembleId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-stone-300 rounded text-sm"
            >
              {ENSEMBLE_OPTIONS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Start occasion</span>
            <select
              value={startOccasionId}
              onChange={(e) => setStartOccasionId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-stone-300 rounded text-sm"
            >
              <option value="">(none — show from beginning)</option>
              {filteredOccasions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-stone-700 uppercase tracking-wide">End occasion</span>
            <select
              value={endOccasionId}
              onChange={(e) => setEndOccasionId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-stone-300 rounded text-sm"
            >
              <option value="">(none — show until end)</option>
              {filteredOccasions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-stone-700 uppercase tracking-wide mb-2">
            Hide weeks (optional)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-64 overflow-y-auto border border-stone-200 rounded p-2">
            {filteredOccasions.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-xs py-0.5">
                <input
                  type="checkbox"
                  checked={hiddenOccasionIds.includes(o.id)}
                  onChange={() => toggleHidden(o.id)}
                />
                <span className="truncate">{o.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-stone-900 text-white text-sm rounded hover:bg-stone-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create share link"}
          </button>
        </div>
      </section>

      <section className="bg-white border border-stone-200 rounded-lg p-5">
        <h2 className="font-serif text-lg text-stone-900 mb-3">Existing share views</h2>
        {views.length === 0 ? (
          <div className="text-sm text-stone-500">No active share views yet.</div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {views.map((v) => {
              const url =
                typeof window !== "undefined"
                  ? `${window.location.origin}/share/${v.id}/${v.config.types[0] || "planner"}`
                  : `/share/${v.id}`;
              return (
                <li key={v.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-stone-900">{v.name}</div>
                    <div className="text-xs text-stone-500 font-mono truncate">{url}</div>
                    <div className="text-[11px] text-stone-400">
                      {v.active ? "Active" : "Inactive"} · tabs: {v.config.types.join(", ")} ·{" "}
                      {v.config.season} Year {v.config.yearCycle}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(url)}
                    className="px-2 py-1 text-xs border border-stone-300 rounded hover:bg-stone-100"
                  >
                    Copy
                  </button>
                  {v.active && (
                    <button
                      type="button"
                      onClick={() => handleDeactivate(v.id)}
                      className="px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50"
                    >
                      Deactivate
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
