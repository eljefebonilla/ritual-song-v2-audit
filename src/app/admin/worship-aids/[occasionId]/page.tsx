"use client";

/**
 * Admin: Worship Aid Builder — Preview Page
 * Builds and shows a paginated preview of the worship aid for a given occasion.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import type { WorshipAid, WorshipAidPage, WorshipAidConfig } from "@/lib/worship-aid/types";

const ENSEMBLES = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

const PAGE_TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  cover: { bg: "bg-stone-200", text: "text-stone-700", label: "Cover" },
  song: { bg: "bg-blue-100", text: "text-blue-700", label: "Song" },
  reading: { bg: "bg-amber-100", text: "text-amber-700", label: "Readings" },
  prayer: { bg: "bg-green-100", text: "text-green-700", label: "Prayer" },
  blank: { bg: "bg-stone-100", text: "text-stone-500", label: "Blank" },
};

export default function WorshipAidPreviewPage() {
  const params = useParams();
  const occasionId = params?.occasionId as string;

  const [ensembleId, setEnsembleId] = useState("generations");
  const [layout, setLayout] = useState<"fit-page" | "flow">("fit-page");
  const [includeReadings, setIncludeReadings] = useState(true);
  const [worshipAid, setWorshipAid] = useState<WorshipAid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removedPageIds, setRemovedPageIds] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  const buildAid = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRemovedPageIds(new Set());

    const config: WorshipAidConfig = {
      occasionId,
      ensembleId,
      parishName: "St. Monica Catholic Community",
      includeReadings,
      includeMusicalNotation: true,
      pageSize: "half-letter",
      layout,
    };

    try {
      const res = await fetch("/api/worship-aids/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const aid = await res.json();
      setWorshipAid(aid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build worship aid");
    } finally {
      setLoading(false);
    }
  }, [occasionId, ensembleId, layout, includeReadings]);

  // Build on mount
  useEffect(() => {
    if (occasionId) buildAid();
  }, [occasionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemovePage = (pageId: string) => {
    setRemovedPageIds((prev) => new Set([...prev, pageId]));
  };

  const handleRestorePage = (pageId: string) => {
    setRemovedPageIds((prev) => {
      const next = new Set(prev);
      next.delete(pageId);
      return next;
    });
  };

  const handlePrint = async () => {
    if (!worshipAid) return;
    setPrinting(true);

    // Filter out removed pages
    const filtered: WorshipAid = {
      ...worshipAid,
      pages: worshipAid.pages.filter((p) => !removedPageIds.has(p.id)),
    };

    try {
      const res = await fetch("/api/worship-aids/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filtered),
      });
      if (!res.ok) throw new Error(`Render failed: HTTP ${res.status}`);
      const html = await res.text();
      // Open rendered HTML in a new window via Blob URL (avoids XSS risks of document.write)
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      // Revoke URL after window has loaded
      if (w) {
        w.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Render failed");
    } finally {
      setPrinting(false);
    }
  };

  const visiblePages = worshipAid?.pages ?? [];
  const activePages = visiblePages.filter((p) => !removedPageIds.has(p.id));

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <a href="/admin/worship-aids" className="text-xs text-stone-400 hover:text-stone-600">
            Worship Aids
          </a>
          <span className="text-xs text-stone-300">/</span>
          <span className="text-xs text-stone-600 capitalize">
            {occasionId?.replace(/-/g, " ")}
          </span>
        </div>
        <h1 className="text-xl font-bold text-stone-900 font-serif">
          {occasionId?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </h1>
      </div>

      {/* Config Panel */}
      <div className="mb-6 p-4 bg-stone-50 rounded-lg border border-stone-200 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {/* Ensemble */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Ensemble</label>
            <select
              value={ensembleId}
              onChange={(e) => setEnsembleId(e.target.value)}
              className="w-full text-sm border border-stone-300 rounded-md px-2.5 py-1.5 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              {ENSEMBLES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {/* Layout */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Layout</label>
            <select
              value={layout}
              onChange={(e) => setLayout(e.target.value as "fit-page" | "flow")}
              className="w-full text-sm border border-stone-300 rounded-md px-2.5 py-1.5 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="fit-page">Fit Page</option>
              <option value="flow">Flow</option>
            </select>
          </div>

          {/* Options */}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Options</label>
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReadings}
                onChange={(e) => setIncludeReadings(e.target.checked)}
                className="rounded border-stone-300 text-stone-800 focus:ring-stone-400"
              />
              Include Readings
            </label>
          </div>
        </div>

        {/* Parish Logo placeholder */}
        <div>
          <p className="text-xs font-medium text-stone-600 mb-1.5">Parish Logo</p>
          <div className="border border-dashed border-stone-300 rounded-md px-4 py-3 text-center text-xs text-stone-400">
            Logo upload coming soon
          </div>
        </div>

        <button
          onClick={buildAid}
          disabled={loading}
          className="text-sm px-4 py-2 bg-stone-900 text-white rounded-md hover:bg-stone-800 disabled:opacity-50 transition-colors"
        >
          {loading ? "Building..." : "Rebuild"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-stone-400">
          <p className="text-sm">Building worship aid...</p>
        </div>
      )}

      {/* Page list */}
      {!loading && worshipAid && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-stone-500">
              {activePages.length} page{activePages.length !== 1 ? "s" : ""}
              {removedPageIds.size > 0 && ` (${removedPageIds.size} hidden)`}
            </p>
            <button
              onClick={handlePrint}
              disabled={printing || activePages.length === 0}
              className="text-sm px-4 py-2 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              {printing ? "Preparing..." : "Print / Export PDF"}
            </button>
          </div>

          <div className="space-y-2">
            {visiblePages.map((page, idx) => {
              const removed = removedPageIds.has(page.id);
              const badge = PAGE_TYPE_BADGE[page.type] ?? PAGE_TYPE_BADGE.blank;
              return (
                <PageCard
                  key={page.id}
                  page={page}
                  pageNumber={idx + 1}
                  removed={removed}
                  badge={badge}
                  onRemove={() => handleRemovePage(page.id)}
                  onRestore={() => handleRestorePage(page.id)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page Card ─────────────────────────────────────────────────────────────────

interface PageCardProps {
  page: WorshipAidPage;
  pageNumber: number;
  removed: boolean;
  badge: { bg: string; text: string; label: string };
  onRemove: () => void;
  onRestore: () => void;
}

function PageCard({ page, pageNumber, removed, badge, onRemove, onRestore }: PageCardProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        removed
          ? "border-stone-100 bg-stone-50 opacity-50"
          : "border-stone-200 bg-white hover:border-stone-300"
      }`}
    >
      {/* Page number */}
      <div className="shrink-0 w-6 text-center text-xs text-stone-400 pt-0.5">{pageNumber}</div>

      {/* Badge + content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
          <span className="text-sm font-medium text-stone-800 truncate">{page.title}</span>
        </div>
        {page.subtitle && (
          <p className="text-xs text-stone-400 italic truncate">{page.subtitle}</p>
        )}
        {page.resourceType && page.resourceType !== "placeholder" && (
          <p className="text-[10px] text-stone-300 mt-0.5">
            {page.resourceType?.toUpperCase()} asset
            {page.resourcePath ? ` — ${page.resourcePath.split("/").slice(-2).join("/")}` : ""}
          </p>
        )}
        {page.resourceType === "placeholder" && (
          <p className="text-[10px] text-amber-500 mt-0.5">No sheet music found</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          className="text-xs px-2 py-1 text-stone-300 cursor-not-allowed"
          disabled
          title="Swap (coming soon)"
        >
          Swap
        </button>
        {removed ? (
          <button
            onClick={onRestore}
            className="text-xs px-2 py-1 text-stone-500 hover:text-stone-700"
          >
            Restore
          </button>
        ) : (
          <button
            onClick={onRemove}
            className="text-xs px-2 py-1 text-stone-400 hover:text-red-500"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
