"use client";

/**
 * Admin: Worship Aid Builder — Print Preview
 * Full visual page-by-page preview with thumbnail sidebar.
 * Feels like Google Docs / InDesign print preview.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import type { WorshipAid, WorshipAidPage, WorshipAidConfig } from "@/lib/worship-aid/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ENSEMBLES = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

const PAGE_TYPE_COLORS: Record<string, string> = {
  cover: "bg-stone-200 text-stone-700",
  song: "bg-blue-100 text-blue-700",
  reading: "bg-amber-100 text-amber-700",
  prayer: "bg-green-100 text-green-700",
  blank: "bg-stone-100 text-stone-500",
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  cover: "Cover",
  song: "Song",
  reading: "Readings",
  prayer: "Prayer",
  blank: "Blank",
};

// ─── Preview iframe CSS injected alongside the page HTML ─────────────────────

const PREVIEW_INJECT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Crimson Pro', Georgia, serif; font-size: 12pt; line-height: 1.5; color: #1c1917; background: white; padding: 0.75in 0.80in 1.05in; }
  .cover-page { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 6in; }
  .cover-inner { max-width: 5in; }
  .parish-logo { max-height: 1.2in; margin-bottom: 0.4in; }
  .parish-name { font-family: 'Source Sans 3', sans-serif; font-weight: 300; font-size: 11pt; letter-spacing: 0.15em; text-transform: uppercase; color: #57534e; margin-bottom: 0.25in; }
  .cover-divider { height: 3px; width: 2in; margin: 0.2in auto; border-radius: 2px; }
  .occasion-name { font-size: 28pt; font-weight: 600; line-height: 1.2; margin-bottom: 0.15in; }
  .season-label { font-size: 11pt; font-style: italic; color: #78716c; margin-bottom: 0.1in; }
  .occasion-date { font-family: 'Source Sans 3', sans-serif; font-size: 10pt; color: #78716c; margin-top: 0.15in; }
  .readings-page h2 { font-size: 14pt; font-weight: 600; border-bottom: 1px solid #e7e5e4; padding-bottom: 0.1in; margin-bottom: 0.2in; }
  .reading-item { margin-bottom: 0.2in; }
  .reading-label { font-family: 'Source Sans 3', sans-serif; font-size: 8pt; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #78716c; margin-bottom: 2pt; }
  .reading-citation { font-size: 12pt; font-weight: 600; }
  .reading-summary { font-size: 10.5pt; color: #57534e; font-style: italic; margin-top: 2pt; }
  .song-page {}
  .song-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e7e5e4; padding-bottom: 0.1in; margin-bottom: 0.15in; }
  .position-label { font-family: 'Source Sans 3', sans-serif; font-size: 7.5pt; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #a8a29e; margin-bottom: 3pt; }
  .song-title { font-size: 17pt; font-weight: 600; line-height: 1.2; }
  .song-composer { font-size: 10.5pt; font-style: italic; color: #57534e; margin-top: 2pt; }
  .resource-image-wrap { overflow: hidden; margin-top: 0.1in; }
  .resource-image-wrap img { width: 100%; display: block; }
  .resource-note { font-size: 8pt; color: #a8a29e; margin-top: 4pt; font-style: italic; }
  .placeholder-block { margin-top: 0.3in; padding: 0.25in; border: 1.5px dashed #d6d3d1; border-radius: 4px; color: #a8a29e; font-size: 10.5pt; font-style: italic; }
  .placeholder-note { font-size: 9pt; margin-top: 0.05in; color: #c4b5b0; }
`;

function buildSrcdoc(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${PREVIEW_INJECT_CSS}</style></head><body>${content}</body></html>`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [printing, setPrinting] = useState(false);

  const buildAid = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRemovedPageIds(new Set());
    setActivePageIdx(0);

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
      setWorshipAid(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build worship aid");
    } finally {
      setLoading(false);
    }
  }, [occasionId, ensembleId, layout, includeReadings]);

  useEffect(() => {
    if (occasionId) buildAid();
  }, [occasionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation
  useEffect(() => {
    const pages = worshipAid?.pages ?? [];
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setActivePageIdx((i) => Math.min(i + 1, pages.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setActivePageIdx((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [worshipAid]);

  const handlePrint = async () => {
    if (!worshipAid) return;
    setPrinting(true);
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
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Render failed");
    } finally {
      setPrinting(false);
    }
  };

  const allPages = worshipAid?.pages ?? [];
  const activePage = allPages[activePageIdx] ?? null;
  const activePageCount = allPages.filter((p) => !removedPageIds.has(p.id)).length;
  const occasionTitle = occasionId?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="h-screen flex flex-col bg-stone-100 overflow-hidden">
      {/* ── Breadcrumb + title ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <a href="/admin/worship-aids" className="hover:text-stone-600">Worship Aids</a>
          <span>/</span>
          <span className="text-stone-600 capitalize">{occasionTitle}</span>
        </div>
      </div>

      {/* ── Config bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 mx-4 mb-3 px-4 py-2.5 bg-white rounded-xl border border-stone-200 shadow-sm flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-stone-500">Ensemble</label>
          <select
            value={ensembleId}
            onChange={(e) => setEnsembleId(e.target.value)}
            className="text-sm border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            {ENSEMBLES.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-stone-500">Layout</label>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as "fit-page" | "flow")}
            className="text-sm border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            <option value="fit-page">Fit Page</option>
            <option value="flow">Flow</option>
          </select>
        </div>

        <label className="flex items-center gap-1.5 text-sm text-stone-700 cursor-pointer">
          <input
            type="checkbox"
            checked={includeReadings}
            onChange={(e) => setIncludeReadings(e.target.checked)}
            className="rounded border-stone-300"
          />
          <span className="text-xs font-medium text-stone-500">Readings</span>
        </label>

        <button
          onClick={buildAid}
          disabled={loading}
          className="text-sm px-3 py-1 bg-stone-900 text-white rounded-md hover:bg-stone-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Building..." : "Rebuild"}
        </button>

        {error && (
          <span className="text-xs text-red-600 ml-2">{error}</span>
        )}

        <div className="ml-auto flex items-center gap-3">
          {worshipAid && (
            <span className="text-xs text-stone-400">
              {activePageCount} page{activePageCount !== 1 ? "s" : ""}
              {removedPageIds.size > 0 && ` (${removedPageIds.size} hidden)`}
            </span>
          )}
          <button
            onClick={handlePrint}
            disabled={printing || !worshipAid || activePageCount === 0}
            className="text-sm px-4 py-1.5 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50 disabled:opacity-40 transition-colors font-medium"
          >
            {printing ? "Preparing..." : "Print / Export PDF"}
          </button>
        </div>
      </div>

      {/* ── Main content area ──────────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-stone-500">Building worship aid...</p>
          </div>
        </div>
      )}

      {!loading && worshipAid && allPages.length > 0 && (
        <div className="flex-1 flex gap-0 overflow-hidden">
          {/* ── Thumbnail strip ────────────────────────────────────────── */}
          <div className="w-[180px] shrink-0 overflow-y-auto px-3 py-2 space-y-2">
            {allPages.map((page, idx) => (
              <ThumbnailCard
                key={page.id}
                page={page}
                pageNumber={idx + 1}
                isActive={idx === activePageIdx}
                isRemoved={removedPageIds.has(page.id)}
                onClick={() => setActivePageIdx(idx)}
                onRemove={() => setRemovedPageIds((prev) => new Set([...prev, page.id]))}
                onRestore={() => {
                  setRemovedPageIds((prev) => {
                    const next = new Set(prev);
                    next.delete(page.id);
                    return next;
                  });
                }}
              />
            ))}
          </div>

          {/* ── Large preview area ─────────────────────────────────────── */}
          <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto py-6 px-4">
            {activePage && (
              <>
                <PagePreview page={activePage} isRemoved={removedPageIds.has(activePage.id)} />
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => setActivePageIdx((i) => Math.max(0, i - 1))}
                    disabled={activePageIdx === 0}
                    className="text-xs px-3 py-1.5 rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-stone-400">
                    {activePageIdx + 1} of {allPages.length}
                  </span>
                  <button
                    onClick={() => setActivePageIdx((i) => Math.min(allPages.length - 1, i + 1))}
                    disabled={activePageIdx === allPages.length - 1}
                    className="text-xs px-3 py-1.5 rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                  >
                    Next →
                  </button>
                </div>
                <p className="mt-2 text-xs text-stone-400">
                  {PAGE_TYPE_LABELS[activePage.type] ?? activePage.type} — {activePage.title}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {!loading && !worshipAid && !error && (
        <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
          Select an ensemble and click Rebuild to generate the preview.
        </div>
      )}
    </div>
  );
}

// ─── Thumbnail Card ───────────────────────────────────────────────────────────

interface ThumbnailCardProps {
  page: WorshipAidPage;
  pageNumber: number;
  isActive: boolean;
  isRemoved: boolean;
  onClick: () => void;
  onRemove: () => void;
  onRestore: () => void;
}

function ThumbnailCard({
  page,
  pageNumber,
  isActive,
  isRemoved,
  onClick,
  onRemove,
  onRestore,
}: ThumbnailCardProps) {
  const [hovered, setHovered] = useState(false);
  const badgeColor = PAGE_TYPE_COLORS[page.type] ?? PAGE_TYPE_COLORS.blank;
  const badgeLabel = PAGE_TYPE_LABELS[page.type] ?? page.type;

  return (
    <div
      className={`relative rounded-lg cursor-pointer transition-all select-none group ${
        isActive
          ? "ring-2 ring-stone-800 shadow-md"
          : "ring-1 ring-stone-200 hover:ring-stone-400 hover:shadow-sm"
      } ${isRemoved ? "opacity-40" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Paper thumbnail */}
      <div
        className="bg-white rounded-lg overflow-hidden"
        style={{ aspectRatio: "7 / 8.5" }}
      >
        <ThumbnailPreview page={page} />
      </div>

      {/* Page number badge */}
      <div className="absolute top-1.5 left-1.5 text-[10px] font-medium text-white bg-stone-700 bg-opacity-80 rounded px-1 py-0.5 leading-none">
        {pageNumber}
      </div>

      {/* Type badge */}
      <div className={`absolute bottom-1.5 left-1.5 text-[9px] font-semibold px-1 py-0.5 rounded leading-none ${badgeColor}`}>
        {badgeLabel}
      </div>

      {/* Remove / Restore overlay */}
      {hovered && (
        <div className="absolute top-1.5 right-1.5">
          {isRemoved ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              className="text-[9px] px-1.5 py-0.5 bg-green-600 text-white rounded leading-none hover:bg-green-700"
            >
              Restore
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-[9px] px-1.5 py-0.5 bg-stone-700 bg-opacity-80 text-white rounded leading-none hover:bg-red-600"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Thumbnail Preview (small scaled view) ────────────────────────────────────

function ThumbnailPreview({ page }: { page: WorshipAidPage }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <iframe
        ref={iframeRef}
        srcDoc={buildSrcdoc(page.content)}
        sandbox="allow-same-origin"
        className="absolute top-0 left-0 w-full h-full border-0 pointer-events-none"
        style={{ transform: "scale(0.28)", transformOrigin: "top left", width: "357%", height: "357%" }}
        title={`Thumbnail: ${page.title}`}
      />
    </div>
  );
}

// ─── Large Page Preview ───────────────────────────────────────────────────────

function PagePreview({ page, isRemoved }: { page: WorshipAidPage; isRemoved: boolean }) {
  // 7:8.5 ratio at ~560px wide = 680px tall
  const paperW = 560;
  const paperH = Math.round(paperW * (8.5 / 7));

  return (
    <div
      className={`relative bg-white rounded shadow-xl overflow-hidden flex-shrink-0 transition-opacity ${
        isRemoved ? "opacity-40" : ""
      }`}
      style={{ width: paperW, height: paperH }}
    >
      {isRemoved && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-60">
          <span className="text-stone-400 text-sm font-medium bg-white px-3 py-1.5 rounded border border-stone-200">
            Hidden from output
          </span>
        </div>
      )}
      <iframe
        srcDoc={buildSrcdoc(page.content)}
        sandbox="allow-same-origin"
        className="absolute top-0 left-0 border-0"
        style={{ width: "100%", height: "100%" }}
        title={`Preview: ${page.title}`}
      />
    </div>
  );
}
