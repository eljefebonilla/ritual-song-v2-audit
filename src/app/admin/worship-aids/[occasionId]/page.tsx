"use client";

/**
 * Admin: Worship Aid Builder — Print Preview
 * Full visual page-by-page preview with thumbnail sidebar.
 * Feels like Google Docs / InDesign print preview.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import type { WorshipAid, WorshipAidPage, WorshipAidConfig } from "@/lib/worship-aid/types";
import { BASE_CSS } from "@/lib/worship-aid/render-html";
import { PageEditPanel } from "./PageEditPanel";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { useEditorStore } from "@/store/editorStore";
import { useDebouncedPreview } from "@/hooks/useDebouncedPreview";
import { ThemeProvider } from "@/core/design-system/ThemeProvider";
import { ALL_TEMPLATES } from "@/core/templates/definitions";
import { ImpositionPreview } from "@/components/editor/ImpositionPreview";
import { instantiateTemplate } from "@/core/templates/schema";
import type { FoldFormat } from "@/imposition/types";
import { migrateV1ToV2 } from "@/utils/migrateV1ToV2";
import { validateDocument, type ValidationWarning } from "@/utils/guardrails";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EditorDocument } from "@/types/schema";
import { usePinch } from "@use-gesture/react";
import { List as VirtualList } from "react-window";

// ─── Constants ─────────────────────────────────────────────────────────────────

const ENSEMBLES = [
  { id: "reflections", label: "Reflections" },
  { id: "foundations", label: "Foundations" },
  { id: "generations", label: "Generations" },
  { id: "heritage", label: "Heritage" },
  { id: "elevations", label: "Elevations" },
];

const PARISH_ID = "st-monica";

const PAGE_TYPE_COLORS: Record<string, string> = {
  cover: "bg-stone-200 text-stone-700",
  song: "bg-blue-100 text-blue-700",
  reading: "bg-amber-100 text-amber-700",
  giving: "bg-green-100 text-green-700",
  links: "bg-purple-100 text-purple-700",
};

const PAGE_TYPE_LABELS: Record<string, string> = {
  cover: "Cover",
  song: "Song",
  reading: "Readings",
  giving: "Giving",
  links: "Links",
};

// ─── iframe srcdoc helper ──────────────────────────────────────────────────────

const PREVIEW_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');`;

function buildSrcdoc(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${PREVIEW_FONTS}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Crimson Pro', Georgia, serif; font-size: 12pt; line-height: 1.5; color: #1c1917; background: white; padding: 0.55in 0.60in 0.75in; }
${BASE_CSS}
</style></head><body>${content}</body></html>`;
}

// ─── Re-render a page after edits ──────────────────────────────────────────────

async function rerenderPage(page: WorshipAidPage): Promise<string> {
  const res = await fetch("/api/worship-aids/rerender-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(page),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Rerender failed");
  return data.content as string;
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function WorshipAidPreviewPage() {
  const params = useParams();
  const occasionId = params?.occasionId as string;

  const [ensembleId, setEnsembleId] = useState("generations");
  const [layout, setLayout] = useState<"fit-page" | "flow">("fit-page");
  const [includeReadings, setIncludeReadings] = useState(true);
  const [worshipAid, setWorshipAid] = useState<WorshipAid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [printing, setPrinting] = useState(false);
  // Track per-page edits locally (mutates page objects in-place via immutable update)
  const [pages, setPages] = useState<WorshipAidPage[]>([]);

  // v2 editor mode
  const [mode, setMode] = useState<"preview" | "editor">("preview");
  const editorDoc = useEditorStore((s) => s.document);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const selectPage = useEditorStore((s) => s.selectPage);
  const editorZoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const addEditorPage = useEditorStore((s) => s.addPage);
  const deleteEditorPage = useEditorStore((s) => s.deletePage);
  const duplicateEditorPage = useEditorStore((s) => s.duplicatePage);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const reorderPages = useEditorStore((s) => s.reorderPages);
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const setDocument = useEditorStore((s) => s.setDocument);
  const editorSeason = useEditorStore((s) => s.document.globalStyles.season);
  const previewSrcdoc = useDebouncedPreview(selectedPageId);
  const [foldFormat, setFoldFormat] = useState<FoldFormat | "FLAT">("HALF_LETTER_SADDLE_STITCH");
  const [exporting, setExporting] = useState(false);
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [buildingV2, setBuildingV2] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Pinch-to-zoom gesture
  usePinch(
    ({ offset: [scale] }) => {
      setZoom(Math.max(0.25, Math.min(3, scale)));
    },
    {
      target: canvasAreaRef,
      scaleBounds: { min: 0.25, max: 3 },
      from: () => [editorZoom, 0],
    },
  );

  const buildAid = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActivePageIdx(0);

    const config: WorshipAidConfig = {
      occasionId,
      ensembleId,
      parishId: PARISH_ID,
      includeReadings,
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
      const aid = await res.json() as WorshipAid;
      setWorshipAid(aid);
      setPages(aid.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build worship aid");
    } finally {
      setLoading(false);
    }
  }, [occasionId, ensembleId, layout, includeReadings]);

  useEffect(() => {
    if (occasionId) buildAid();
  }, [occasionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation + undo/redo + editor shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Preview mode: arrow page navigation
      if (mode === "preview") {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          setActivePageIdx((i) => Math.min(i + 1, pages.length - 1));
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          setActivePageIdx((i) => Math.max(i - 1, 0));
        }
      }

      // Editor mode shortcuts
      if (mode === "editor") {
        // Undo/redo
        if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
        if (meta && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }

        // Zoom: Cmd+= / Cmd+- / Cmd+0
        if (meta && (e.key === "=" || e.key === "+")) { e.preventDefault(); setZoom(editorZoom + 0.1); }
        if (meta && e.key === "-") { e.preventDefault(); setZoom(editorZoom - 0.1); }
        if (meta && e.key === "0") {
          e.preventDefault();
          // Fit-to-page: calculate zoom so page fits in viewport with padding
          const area = canvasAreaRef.current;
          const currentPage = editorDoc.pages.find((p) => p.id === selectedPageId);
          if (area && currentPage) {
            const padding = 64; // px padding around page
            const fitW = (area.clientWidth - padding) / (currentPage.pageSize.width * 3.7795);
            const fitH = (area.clientHeight - padding) / (currentPage.pageSize.height * 3.7795);
            setZoom(Math.min(fitW, fitH, 3));
          } else {
            setZoom(1);
          }
        }

        // Delete selected elements
        if ((e.key === "Delete" || e.key === "Backspace") && selectedElementIds.length > 0 && selectedPageId) {
          // Don't delete if user is editing text (contentEditable)
          const active = document.activeElement;
          if (active && (active as HTMLElement).isContentEditable) return;
          e.preventDefault();
          for (const elId of selectedElementIds) {
            deleteElement(selectedPageId, elId);
          }
          clearSelection();
        }

        // Escape: deselect
        if (e.key === "Escape") {
          clearSelection();
          // Exit contentEditable if active
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }

        // Arrow nudge: 1mm, Shift+arrow: 5mm
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && selectedElementIds.length > 0 && selectedPageId && !meta) {
          const active = document.activeElement;
          if (active && (active as HTMLElement).isContentEditable) return;
          e.preventDefault();
          const step = e.shiftKey ? 5 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          const currentPage = editorDoc.pages.find((p) => p.id === selectedPageId);
          if (currentPage) {
            for (const elId of selectedElementIds) {
              const el = currentPage.elements.find((x) => x.id === elId);
              if (el) {
                updateElement(selectedPageId, elId, {
                  geometry: { x: el.geometry.x + dx, y: el.geometry.y + dy },
                });
              }
            }
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pages.length, mode, undo, redo, editorZoom, setZoom, selectedElementIds, selectedPageId, deleteElement, clearSelection, updateElement, editorDoc.pages]);

  // Ctrl+scroll wheel zoom in editor mode
  useEffect(() => {
    if (mode !== "editor") return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom(editorZoom + delta);
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler);
  }, [mode, editorZoom, setZoom]);

  // Run guardrails validation when editor document changes
  useEffect(() => {
    if (mode !== "editor" || editorDoc.pages.length === 0) {
      setWarnings([]);
      return;
    }
    const w = validateDocument(editorDoc.pages);
    setWarnings(w);
  }, [mode, editorDoc.pages]);

  const handlePageUpdate = useCallback(async (idx: number, updates: Partial<WorshipAidPage>) => {
    setPages((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
    // Re-render the page HTML after edits
    setPages((prev) => {
      const updated = { ...prev[idx], ...updates };
      rerenderPage(updated).then((content) => {
        setPages((p2) => {
          const n = [...p2];
          n[idx] = { ...n[idx], content };
          return n;
        });
      });
      return prev;
    });
  }, []);

  const handlePrint = async () => {
    if (!worshipAid) return;
    setPrinting(true);
    const filtered: WorshipAid = {
      ...worshipAid,
      pages: pages.filter((p) => !p.removed),
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

  const activePage = pages[activePageIdx] ?? null;
  const activePageCount = pages.filter((p) => !p.removed).length;
  const hiddenCount = pages.filter((p) => p.removed).length;
  const occasionTitle = occasionId?.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="h-screen flex flex-col bg-stone-100 overflow-hidden">
      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <a href="/admin/worship-aids" className="hover:text-stone-600">Worship Aids</a>
          <span>/</span>
          <span className="text-stone-600 capitalize">{occasionTitle}</span>
        </div>
      </div>

      {/* ── Config bar ─────────────────────────────────────────────── */}
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

        <label className="flex items-center gap-1.5 cursor-pointer">
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

        {error && <span className="text-xs text-red-600 ml-2">{error}</span>}

        <div className="ml-auto flex items-center gap-3">
          {worshipAid && (
            <span className="text-xs text-stone-400">
              {activePageCount} page{activePageCount !== 1 ? "s" : ""}
              {hiddenCount > 0 && ` (${hiddenCount} hidden)`}
            </span>
          )}

          {/* Mode toggle */}
          <div className="flex rounded-md border border-stone-200 overflow-hidden">
            <button
              onClick={() => setMode("preview")}
              className={`text-xs px-3 py-1.5 transition-colors ${
                mode === "preview"
                  ? "bg-stone-800 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => {
                // Auto-migrate v1 pages to v2 on first switch
                if (editorDoc.pages.length === 0 && pages.length > 0) {
                  const migrated = migrateV1ToV2(pages, {
                    occasionId,
                    ensembleId,
                    season: pages[0]?.coverData?.seasonLabel?.toLowerCase().replace(/\s+/g, "-"),
                  });
                  setDocument(migrated);
                  if (migrated.pages.length > 0) selectPage(migrated.pages[0].id);
                }
                setMode("editor");
              }}
              disabled={loading}
              className={`text-xs px-3 py-1.5 transition-colors ${
                mode === "editor"
                  ? "bg-stone-800 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50"
              } ${loading ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              Editor v2
            </button>
          </div>

          <button
            onClick={handlePrint}
            disabled={printing || !worshipAid || activePageCount === 0}
            className="text-sm px-4 py-1.5 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-50 disabled:opacity-40 transition-colors font-medium"
          >
            {printing ? "Preparing..." : "Print / Export PDF"}
          </button>
        </div>
      </div>

      {/* ── Loading spinner ─────────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-stone-500">Building worship aid...</p>
          </div>
        </div>
      )}

      {/* ── Main 2-panel layout (v1 Preview mode) ──────────────────── */}
      {!loading && worshipAid && pages.length > 0 && mode === "preview" && (
        <div className="flex-1 flex gap-0 overflow-hidden">
          {/* Thumbnail strip (virtualized for >20 pages) */}
          <div className="w-[180px] shrink-0 overflow-hidden px-3 py-2">
            {pages.length > 20 ? (
              <VirtualList
                style={{ height: 600, width: 156 }}
                rowCount={pages.length}
                rowHeight={100}
                rowProps={{}}
                rowComponent={({ index, style: rowStyle }) => (
                  <div style={{ ...rowStyle, paddingBottom: 8 }}>
                    <ThumbnailCard
                      page={pages[index]}
                      pageNumber={index + 1}
                      isActive={index === activePageIdx}
                      onClick={() => setActivePageIdx(index)}
                      onRemove={() => handlePageUpdate(index, { removed: true })}
                      onRestore={() => handlePageUpdate(index, { removed: false })}
                    />
                  </div>
                )}
              />
            ) : (
              <div className="space-y-2 overflow-y-auto h-full">
                {pages.map((page, idx) => (
                  <ThumbnailCard
                    key={page.id}
                    page={page}
                    pageNumber={idx + 1}
                    isActive={idx === activePageIdx}
                    onClick={() => setActivePageIdx(idx)}
                    onRemove={() => handlePageUpdate(idx, { removed: true })}
                    onRestore={() => handlePageUpdate(idx, { removed: false })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Large preview + edit panel side by side */}
          <div className="flex-1 flex overflow-hidden">
            {/* Preview column */}
            <div className="flex-1 flex flex-col items-center overflow-y-auto py-6 px-4">
              {activePage && (
                <>
                  <PagePreview page={activePage} />

                  {/* Navigation */}
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      onClick={() => setActivePageIdx((i) => Math.max(0, i - 1))}
                      disabled={activePageIdx === 0}
                      className="text-xs px-3 py-1.5 rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-stone-400">
                      {activePageIdx + 1} of {pages.length}
                    </span>
                    <button
                      onClick={() => setActivePageIdx((i) => Math.min(pages.length - 1, i + 1))}
                      disabled={activePageIdx === pages.length - 1}
                      className="text-xs px-3 py-1.5 rounded-md border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-30 transition-colors"
                    >
                      Next
                    </button>
                  </div>

                  <p className="mt-1 text-xs text-stone-400">
                    {PAGE_TYPE_LABELS[activePage.type] ?? activePage.type} — {activePage.title}
                  </p>
                </>
              )}
            </div>

            {/* Edit panel column (right side) */}
            {activePage && (
              <div className="w-[280px] shrink-0 overflow-y-auto border-l border-stone-200 bg-white px-3 py-4">
                <PageEditPanel
                  page={activePage}
                  onUpdate={(updates) => handlePageUpdate(activePageIdx, updates)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── v2 Element Editor mode ─────────────────────────────────── */}
      {!loading && mode === "editor" && (
        <ThemeProvider season={editorSeason}>
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden relative">

          {/* Mobile toggle buttons (bottom bar) */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 flex items-center justify-around py-2 px-4 safe-area-bottom">
            <button onClick={() => { setMobileSidebar(!mobileSidebar); setMobilePreview(false); }} className={`text-xs px-3 py-2 rounded-lg ${mobileSidebar ? "bg-stone-800 text-white" : "text-stone-600"}`}>
              Pages
            </button>
            <button onClick={undo} className="text-xs px-3 py-2 text-stone-600">Undo</button>
            <button onClick={redo} className="text-xs px-3 py-2 text-stone-600">Redo</button>
            <button onClick={() => { setMobilePreview(!mobilePreview); setMobileSidebar(false); }} className={`text-xs px-3 py-2 rounded-lg ${mobilePreview ? "bg-stone-800 text-white" : "text-stone-600"}`}>
              Preview
            </button>
          </div>

          {/* Page list sidebar -- desktop: fixed left, mobile: overlay */}
          <div className={`
            w-[200px] shrink-0 overflow-y-auto px-3 py-2 space-y-1 border-r border-stone-200 bg-stone-50
            ${mobileSidebar ? "fixed inset-y-0 left-0 z-30 shadow-xl" : "hidden"} lg:block
          `}>
            {/* Auto-build button */}
            <button
              onClick={async () => {
                setBuildingV2(true);
                try {
                  const res = await fetch("/api/worship-aids/build-v2", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ occasionId, ensembleId, parishId: "st-monica", includeReadings, layout }),
                  });
                  if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                  const v2Doc = await res.json() as EditorDocument;
                  setDocument(v2Doc);
                  if (v2Doc.pages.length > 0) selectPage(v2Doc.pages[0].id);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Build failed");
                } finally {
                  setBuildingV2(false);
                }
              }}
              disabled={buildingV2}
              className="w-full text-xs px-2 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-40 font-medium mb-2"
            >
              {buildingV2 ? "Building..." : "Auto-Build from Occasion"}
            </button>

            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-1">Pages</p>

            {/* Sortable page list */}
            <DndContext collisionDetection={closestCenter} onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (over && active.id !== over.id) {
                const oldIdx = editorDoc.pages.findIndex((p) => p.id === active.id);
                const newIdx = editorDoc.pages.findIndex((p) => p.id === over.id);
                if (oldIdx !== -1 && newIdx !== -1) reorderPages(oldIdx, newIdx);
              }
            }}>
              <SortableContext items={editorDoc.pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {editorDoc.pages.map((p, idx) => (
                  <SortablePageItem
                    key={p.id}
                    pageId={p.id}
                    index={idx}
                    templateId={p.templateId}
                    elementCount={p.elements.length}
                    isSelected={selectedPageId === p.id}
                    onSelect={() => selectPage(p.id)}
                    onDelete={() => deleteEditorPage(p.id)}
                    onDuplicate={() => duplicateEditorPage(p.id)}
                    onInsertAfter={() => {
                      const blankPage = instantiateTemplate(ALL_TEMPLATES[0]);
                      addEditorPage(blankPage, idx);
                      selectPage(blankPage.id);
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Template picker */}
            <div className="mt-3 pt-3 border-t border-stone-200">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">Add from Template</p>
              {ALL_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    const newPage = instantiateTemplate(tmpl);
                    addEditorPage(newPage);
                    selectPage(newPage.id);
                  }}
                  className="w-full text-left px-2 py-2 rounded text-xs text-stone-500 hover:bg-stone-200 hover:text-stone-700 transition-colors"
                >
                  + {tmpl.label}
                </button>
              ))}
            </div>

            {editorDoc.pages.length === 0 && (
              <p className="text-xs text-stone-400 italic px-2 mt-2">
                Click Auto-Build or add pages from templates.
              </p>
            )}
          </div>

          {/* Canvas area */}
          <div className="flex-1 flex flex-col overflow-hidden pb-14 lg:pb-0">
            {/* Toolbar -- desktop: full, mobile: compact */}
            <div className="shrink-0 px-3 lg:px-4 py-2 border-b border-stone-200 bg-white flex items-center gap-2 lg:gap-3 overflow-x-auto">
              <button onClick={undo} className="hidden lg:block text-xs px-2 py-1 border border-stone-200 rounded hover:bg-stone-50 text-stone-600" title="Undo (Cmd+Z)">Undo</button>
              <button onClick={redo} className="hidden lg:block text-xs px-2 py-1 border border-stone-200 rounded hover:bg-stone-50 text-stone-600" title="Redo (Cmd+Shift+Z)">Redo</button>
              <div className="hidden lg:block h-4 w-px bg-stone-200" />
              <label className="text-xs text-stone-500 shrink-0">Zoom</label>
              <input type="range" min={25} max={300} value={Math.round(editorZoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} className="w-16 lg:w-24 accent-stone-700" />
              <span className="text-xs text-stone-400 w-10 shrink-0">{Math.round(editorZoom * 100)}%</span>
              {/* Page count badge */}
              <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full shrink-0">
                {editorDoc.pages.length} pg{editorDoc.pages.length !== 1 ? "s" : ""}
              </span>
              <div className="h-4 w-px bg-stone-200" />
              <label className="text-xs text-stone-500 shrink-0 hidden sm:block">Format</label>
              <select value={foldFormat} onChange={(e) => setFoldFormat(e.target.value as FoldFormat | "FLAT")} className="text-xs border border-stone-200 rounded px-1 lg:px-2 py-1 bg-white text-stone-700">
                <option value="FLAT">Flat</option>
                <option value="HALF_LETTER_SADDLE_STITCH">Saddle</option>
                <option value="LETTER_BIFOLD">Letter Fold</option>
                <option value="LEGAL_BIFOLD">Legal Fold</option>
                <option value="TABLOID_TRIFOLD">Tri-Fold</option>
              </select>
              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    const res = await fetch("/api/export", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ document: editorDoc, format: foldFormat, marks: true }),
                    });
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? `Export failed: HTTP ${res.status}`); }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const date = new Date().toISOString().slice(0, 10);
                    const name = occasionId?.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) || "worship-aid";
                    a.download = `${name}-${date}-worship-aid.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Export failed");
                  } finally { setExporting(false); }
                }}
                disabled={exporting || editorDoc.pages.length === 0}
                className="text-xs px-3 py-1 bg-stone-800 text-white rounded hover:bg-stone-700 disabled:opacity-40 font-medium shrink-0"
              >
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
            </div>

            {/* Imposition preview (when non-flat format selected) */}
            {foldFormat !== "FLAT" && editorDoc.pages.length > 0 && (
              <div className="shrink-0 px-3 py-2 border-b border-stone-200 bg-stone-50">
                <ImpositionPreview format={foldFormat} pageCount={editorDoc.pages.length} />
              </div>
            )}

            {/* Guardrails warnings */}
            {warnings.length > 0 && (
              <div className="shrink-0 px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2 overflow-x-auto">
                <span className="text-[10px] font-semibold text-amber-700 shrink-0">
                  {warnings.filter((w) => w.severity === "error").length} errors, {warnings.filter((w) => w.severity === "warning").length} warnings
                </span>
                {warnings.slice(0, 3).map((w, i) => (
                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${w.severity === "error" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {w.message.slice(0, 60)}{w.message.length > 60 ? "..." : ""}
                  </span>
                ))}
                {warnings.length > 3 && <span className="text-[10px] text-amber-500">+{warnings.length - 3} more</span>}
              </div>
            )}

            {/* Canvas scroll area with touch-action for mobile + pinch-to-zoom */}
            <div ref={canvasAreaRef} className="flex-1 overflow-auto bg-stone-200 flex items-start justify-center py-6 lg:py-8 px-2 lg:px-4" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
              {selectedPageId ? (
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-center lg:items-start">
                  <EditorCanvas pageId={selectedPageId} />
                  {/* Live preview -- desktop: side panel, mobile: overlay */}
                  {previewSrcdoc && (
                    <div className={`flex-col items-center ${mobilePreview ? "flex fixed inset-0 z-30 bg-black/50 justify-center p-6" : "hidden lg:flex"}`}>
                      {mobilePreview && (
                        <button onClick={() => setMobilePreview(false)} className="absolute top-4 right-4 text-white text-lg">x</button>
                      )}
                      <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider">Live Preview</p>
                      {(() => {
                        const currentPage = editorDoc.pages.find(p => p.id === selectedPageId);
                        const containerW = mobilePreview ? 320 : 280;
                        const pageNaturalW = (currentPage?.pageSize.width ?? 177.8) * 3.7795;
                        const pageNaturalH = (currentPage?.pageSize.height ?? 215.9) * 3.7795;
                        const previewScale = containerW / pageNaturalW;
                        const containerH = pageNaturalH * previewScale;
                        return (
                          <div className="bg-white rounded shadow-md overflow-hidden" style={{ width: containerW, height: containerH }}>
                            <iframe
                              srcDoc={previewSrcdoc}
                              sandbox="allow-same-origin"
                              className="border-0 pointer-events-none"
                              style={{
                                width: pageNaturalW,
                                height: pageNaturalH,
                                transform: `scale(${previewScale})`,
                                transformOrigin: "top left",
                              }}
                              title="Live preview"
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone-400 mt-20">Select a page from the sidebar</p>
              )}
            </div>
          </div>

          {/* Mobile sidebar backdrop */}
          {mobileSidebar && <div className="lg:hidden fixed inset-0 z-20 bg-black/30" onClick={() => setMobileSidebar(false)} />}
        </div>
        </ThemeProvider>
      )}

      {!loading && !worshipAid && !error && (
        <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
          Select an ensemble and click Rebuild to generate the preview.
        </div>
      )}
    </div>
  );
}

// ─── Sortable Page Item (v2 editor sidebar) ──────────────────────────────────

interface SortablePageItemProps {
  pageId: string;
  index: number;
  templateId?: string;
  elementCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onInsertAfter: () => void;
}

function SortablePageItem({ pageId, index, templateId, elementCount, isSelected, onSelect, onDelete, onDuplicate, onInsertAfter }: SortablePageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pageId });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 relative">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 px-0.5 touch-none">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" />
          <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
          <circle cx="3" cy="11" r="1.2" /><circle cx="7" cy="11" r="1.2" />
        </svg>
      </div>
      <button
        onClick={onSelect}
        onContextMenu={(e) => { e.preventDefault(); onSelect(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        className={`flex-1 text-left px-2 py-2 rounded text-xs transition-colors ${
          isSelected ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-200"
        }`}
      >
        {index + 1}. {templateId ?? "Page"}
        <span className="ml-1 text-[10px] opacity-60">({elementCount})</span>
      </button>
      <button
        onClick={onDelete}
        className="text-[10px] text-stone-300 hover:text-red-500 px-1 py-1"
        title="Delete page"
      >
        x
      </button>

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-stone-200 py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={() => { onDuplicate(); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100">
              Duplicate
            </button>
            <button onClick={() => { onInsertAfter(); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100">
              Insert Blank After
            </button>
            <div className="border-t border-stone-100 my-0.5" />
            <button onClick={() => { onDelete(); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Thumbnail Card ────────────────────────────────────────────────────────────

interface ThumbnailCardProps {
  page: WorshipAidPage;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
  onRestore: () => void;
}

function ThumbnailCard({ page, pageNumber, isActive, onClick, onRemove, onRestore }: ThumbnailCardProps) {
  const [hovered, setHovered] = useState(false);
  const badgeColor = PAGE_TYPE_COLORS[page.type] ?? "bg-stone-100 text-stone-500";
  const badgeLabel = PAGE_TYPE_LABELS[page.type] ?? page.type;

  return (
    <div
      className={`relative rounded-lg cursor-pointer transition-all select-none ${
        isActive
          ? "ring-2 ring-stone-800 shadow-md"
          : "ring-1 ring-stone-200 hover:ring-stone-400 hover:shadow-sm"
      } ${page.removed ? "opacity-40" : ""}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="bg-white rounded-lg overflow-hidden" style={{ aspectRatio: "7 / 8.5" }}>
        <ThumbnailPreview page={page} />
      </div>

      <div className="absolute top-1.5 left-1.5 text-[10px] font-medium text-white bg-stone-700 bg-opacity-80 rounded px-1 py-0.5 leading-none">
        {pageNumber}
      </div>

      <div className={`absolute bottom-1.5 left-1.5 text-[9px] font-semibold px-1 py-0.5 rounded leading-none ${badgeColor}`}>
        {badgeLabel}
      </div>

      {hovered && (
        <div className="absolute top-1.5 right-1.5">
          {page.removed ? (
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

// ─── Thumbnail Preview (scaled iframe) ────────────────────────────────────────

function ThumbnailPreview({ page }: { page: WorshipAidPage }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <iframe
        srcDoc={buildSrcdoc(page.content)}
        sandbox="allow-same-origin"
        className="absolute top-0 left-0 border-0 pointer-events-none"
        style={{ width: "357%", height: "357%", transform: "scale(0.28)", transformOrigin: "top left" }}
        title={`Thumbnail: ${page.title}`}
      />
    </div>
  );
}

// ─── Large Page Preview ────────────────────────────────────────────────────────

function PagePreview({ page }: { page: WorshipAidPage }) {
  const paperW = 560;
  const paperH = Math.round(paperW * (8.5 / 7));

  return (
    <div
      className={`relative bg-white rounded shadow-xl overflow-hidden flex-shrink-0 transition-opacity ${
        page.removed ? "opacity-40" : ""
      }`}
      style={{ width: paperW, height: paperH }}
    >
      {page.removed && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/60">
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
