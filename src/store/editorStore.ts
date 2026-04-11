/**
 * Worship Aid Builder v2: Zustand store with Immer patches for undo/redo.
 * Single source of truth for the entire document model.
 */

import { create } from "zustand";
import { produce, enablePatches, applyPatches, type Patch } from "immer";
import type {
  EditorDocument,
  EditorPage,
  PageElement,
  Geometry,
} from "@/types/schema";

// Union of all partial element types so any element-specific field can be updated
type ElementUpdate = Omit<Partial<PageElement>, "geometry"> & {
  geometry?: Partial<Geometry>;
} & Record<string, unknown>;

enablePatches();

// ── History ─────────────────────────────────────────────────────────────────

interface HistoryEntry {
  patches: Patch[];
  inversePatches: Patch[];
}

// ── Store shape ─────────────────────────────────────────────────────────────

interface EditorState {
  document: EditorDocument;

  // Selection
  selectedPageId: string | null;
  selectedElementIds: string[];

  // History
  past: HistoryEntry[];
  future: HistoryEntry[];
  historyPaused: boolean;

  // Zoom
  zoom: number;

  // Snap guides (transient, set during drag)
  activeSnapGuides: { axis: "x" | "y"; position: number }[];
  setSnapGuides: (guides: { axis: "x" | "y"; position: number }[]) => void;

  // ── Document actions ──
  setDocument: (doc: EditorDocument) => void;

  // ── Page actions ──
  addPage: (page: EditorPage, afterIndex?: number) => void;
  duplicatePage: (pageId: string) => void;
  deletePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  selectPage: (pageId: string) => void;

  // ── Element actions ──
  addElement: (pageId: string, element: PageElement) => void;
  updateElement: (pageId: string, elementId: string, updates: ElementUpdate) => void;
  deleteElement: (pageId: string, elementId: string) => void;
  reorderElement: (pageId: string, elementId: string, direction: "up" | "down" | "top" | "bottom") => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;

  // ── History actions ──
  undo: () => void;
  redo: () => void;
  pauseHistory: () => void;
  resumeHistory: () => void;

  // ── Zoom ──
  setZoom: (zoom: number) => void;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Initial empty document ──────────────────────────────────────────────────

const EMPTY_DOC: EditorDocument = {
  id: newId(),
  metadata: {
    title: "Untitled Worship Aid",
    occasionId: "",
    ensembleId: "",
    parishId: "st-monica",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  globalStyles: {
    defaultFontFamily: "'Crimson Pro', serif",
    defaultFontSize: 10,
    defaultColor: "#1A1A1A",
    season: "ordinary-time",
  },
  pages: [],
};

// ── Store ───────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>((set, get) => {
  // Mutate document with automatic history tracking
  function mutate(recipe: (draft: EditorDocument) => void) {
    const { document: current, historyPaused } = get();

    let forwardPatches: Patch[] = [];
    let inversePatches: Patch[] = [];

    const next = produce(current, recipe, (p, ip) => {
      forwardPatches = p;
      inversePatches = ip;
    });

    const updates: Partial<EditorState> = { document: next };

    if (!historyPaused && forwardPatches.length > 0) {
      updates.past = [...get().past, { patches: forwardPatches, inversePatches }];
      updates.future = []; // new action clears redo stack
    }

    set(updates);
  }

  return {
    document: EMPTY_DOC,
    selectedPageId: null,
    selectedElementIds: [],
    past: [],
    future: [],
    historyPaused: false,
    zoom: 1,
    activeSnapGuides: [],
    setSnapGuides: (guides) => set({ activeSnapGuides: guides }),

    setDocument: (doc) => set({ document: doc, past: [], future: [] }),

    // ── Pages ──

    addPage: (page, afterIndex) => mutate((draft) => {
      const idx = afterIndex !== undefined ? afterIndex + 1 : draft.pages.length;
      draft.pages.splice(idx, 0, page);
    }),

    duplicatePage: (pageId) => mutate((draft) => {
      const idx = draft.pages.findIndex((p) => p.id === pageId);
      if (idx === -1) return;
      const clone: EditorPage = JSON.parse(JSON.stringify(draft.pages[idx]));
      clone.id = newId();
      clone.elements.forEach((el) => { el.id = newId(); });
      draft.pages.splice(idx + 1, 0, clone);
    }),

    deletePage: (pageId) => mutate((draft) => {
      draft.pages = draft.pages.filter((p) => p.id !== pageId);
    }),

    reorderPages: (fromIndex, toIndex) => mutate((draft) => {
      const [moved] = draft.pages.splice(fromIndex, 1);
      draft.pages.splice(toIndex, 0, moved);
    }),

    selectPage: (pageId) => set({ selectedPageId: pageId, selectedElementIds: [] }),

    // ── Elements ──

    addElement: (pageId, element) => mutate((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (page) page.elements.push(element);
    }),

    updateElement: (pageId, elementId, updates) => mutate((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (!page) return;
      const el = page.elements.find((e) => e.id === elementId);
      if (!el) return;
      // Deep merge geometry so partial updates (e.g., just x/y) preserve other fields
      if (updates.geometry) {
        Object.assign(el.geometry, updates.geometry);
        const rest = Object.fromEntries(
          Object.entries(updates).filter(([k]) => k !== "geometry"),
        );
        Object.assign(el, rest);
      } else {
        Object.assign(el, updates);
      }
    }),

    deleteElement: (pageId, elementId) => mutate((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (page) page.elements = page.elements.filter((e) => e.id !== elementId);
    }),

    reorderElement: (pageId, elementId, direction) => mutate((draft) => {
      const page = draft.pages.find((p) => p.id === pageId);
      if (!page) return;
      const el = page.elements.find((e) => e.id === elementId);
      if (!el) return;
      const maxZ = Math.max(...page.elements.map((e) => e.zIndex), 0);
      if (direction === "up") el.zIndex = Math.min(el.zIndex + 1, maxZ + 1);
      if (direction === "down") el.zIndex = Math.max(0, el.zIndex - 1);
      if (direction === "top") el.zIndex = maxZ + 1;
      if (direction === "bottom") el.zIndex = 0;
    }),

    selectElements: (ids) => set({ selectedElementIds: ids }),
    clearSelection: () => set({ selectedElementIds: [] }),

    // ── History ──

    undo: () => {
      const { past, future, document: doc } = get();
      if (past.length === 0) return;
      const entry = past[past.length - 1];
      const restored = applyPatches(doc, entry.inversePatches);
      set({
        document: restored,
        past: past.slice(0, -1),
        future: [{ patches: entry.patches, inversePatches: entry.inversePatches }, ...future],
      });
    },

    redo: () => {
      const { past, future, document: doc } = get();
      if (future.length === 0) return;
      const entry = future[0];
      const applied = applyPatches(doc, entry.patches);
      set({
        document: applied,
        past: [...past, entry],
        future: future.slice(1),
      });
    },

    pauseHistory: () => set({ historyPaused: true }),
    resumeHistory: () => set({ historyPaused: false }),

    // ── Zoom ──
    setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(3, zoom)) }),
  };
});
