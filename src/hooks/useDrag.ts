"use client";

import { useCallback, useRef, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { pxToMm, mmToPx } from "@/utils/coordinates";
import { computeSnap } from "@/utils/snapping";

/**
 * Transient-transform drag with smart snapping.
 * Mutates DOM directly during drag via rAF, computes snap guides,
 * commits final snapped position to Zustand on pointerup.
 */
export function useDrag(pageId: string) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const zoom = useEditorStore((s) => s.zoom);
  const pauseHistory = useEditorStore((s) => s.pauseHistory);
  const resumeHistory = useEditorStore((s) => s.resumeHistory);
  const dragState = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    origXmm: number;
    origYmm: number;
    origWidthMm: number;
    origHeightMm: number;
    pageWidthMm: number;
    pageHeightMm: number;
    otherElements: { x: number; y: number; width: number; height: number; rotation: number }[];
    el: HTMLElement;
    rafId: number | null;
    dx: number;
    dy: number;
    snappedXmm: number;
    snappedYmm: number;
  } | null>(null);

  const zoomRef = useRef(zoom);
  const pageIdRef = useRef(pageId);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { pageIdRef.current = pageId; }, [pageId]);

  const handleMove = useRef((e: PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;

    ds.dx = e.clientX - ds.startX;
    ds.dy = e.clientY - ds.startY;

    if (ds.rafId === null) {
      ds.rafId = requestAnimationFrame(() => {
        if (!dragState.current) return;
        const { el, dx, dy } = dragState.current;

        // Compute candidate position in mm
        const candidateX = dragState.current.origXmm + pxToMm(dx, zoomRef.current);
        const candidateY = dragState.current.origYmm + pxToMm(dy, zoomRef.current);

        // Snap
        const snap = computeSnap(
          { x: candidateX, y: candidateY, width: dragState.current.origWidthMm, height: dragState.current.origHeightMm, rotation: 0 },
          dragState.current.pageWidthMm,
          dragState.current.pageHeightMm,
          dragState.current.otherElements,
        );

        dragState.current.snappedXmm = snap.x;
        dragState.current.snappedYmm = snap.y;

        // Update snap guides in store (will render on canvas)
        useEditorStore.getState().setSnapGuides(snap.guides);

        // Transient transform: show snapped position offset from original
        const snapDxPx = mmToPx(snap.x - dragState.current.origXmm, zoomRef.current);
        const snapDyPx = mmToPx(snap.y - dragState.current.origYmm, zoomRef.current);
        el.style.transform = `translate(${snapDxPx}px, ${snapDyPx}px)`;
        dragState.current.rafId = null;
      });
    }
  });

  const handleUp = useRef(() => {
    const ds = dragState.current;
    if (!ds) return;

    if (ds.rafId !== null) cancelAnimationFrame(ds.rafId);
    ds.el.style.transform = "";

    // Clear snap guides
    useEditorStore.getState().setSnapGuides([]);

    resumeHistory();
    updateElement(pageIdRef.current, ds.elementId, {
      geometry: {
        x: ds.snappedXmm,
        y: ds.snappedYmm,
      },
    });

    dragState.current = null;
    window.removeEventListener("pointermove", handleMove.current);
    window.removeEventListener("pointerup", handleUp.current);
  });

  const startDrag = useCallback(
    (
      e: React.PointerEvent,
      elementId: string,
      origXmm: number,
      origYmm: number,
      el: HTMLElement,
    ) => {
      e.preventDefault();
      pauseHistory();

      // Get page dimensions and other elements for snapping
      const state = useEditorStore.getState();
      const page = state.document.pages.find((p) => p.id === pageIdRef.current);
      const element = page?.elements.find((x) => x.id === elementId);

      dragState.current = {
        elementId,
        startX: e.clientX,
        startY: e.clientY,
        origXmm,
        origYmm,
        origWidthMm: element?.geometry.width ?? 50,
        origHeightMm: element?.geometry.height ?? 30,
        pageWidthMm: page?.pageSize.width ?? 177.8,
        pageHeightMm: page?.pageSize.height ?? 215.9,
        otherElements: (page?.elements ?? [])
          .filter((x) => x.id !== elementId)
          .map((x) => x.geometry),
        el,
        rafId: null,
        dx: 0,
        dy: 0,
        snappedXmm: origXmm,
        snappedYmm: origYmm,
      };

      window.addEventListener("pointermove", handleMove.current);
      window.addEventListener("pointerup", handleUp.current);
    },
    [pauseHistory],
  );

  return { startDrag };
}
