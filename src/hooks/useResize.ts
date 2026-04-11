"use client";

import { useCallback, useRef, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { pxToMm } from "@/utils/coordinates";
import type { Geometry } from "@/types/schema";

type HandlePosition =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

/**
 * Handle-based resize. Each of the 8 handles constrains which dimensions change.
 * Shift held: maintain aspect ratio (corner handles only).
 * Uses handler refs to avoid circular useCallback dependencies.
 */
export function useResize(pageId: string) {
  const updateElement = useEditorStore((s) => s.updateElement);
  const zoom = useEditorStore((s) => s.zoom);
  const pauseHistory = useEditorStore((s) => s.pauseHistory);
  const resumeHistory = useEditorStore((s) => s.resumeHistory);

  const resizeState = useRef<{
    elementId: string;
    handle: HandlePosition;
    startX: number;
    startY: number;
    orig: Geometry;
    shiftKey: boolean;
    isImage: boolean; // Images lock aspect by default, Shift to free
    el: HTMLElement;
    rafId: number | null;
    dx: number;
    dy: number;
  } | null>(null);

  // Store latest values in refs so handlers always see current state
  const zoomRef = useRef(zoom);
  const pageIdRef = useRef(pageId);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { pageIdRef.current = pageId; }, [pageId]);

  // Stable handler refs (never change identity)
  const handleMove = useRef((e: PointerEvent) => {
    const rs = resizeState.current;
    if (!rs) return;

    rs.dx = e.clientX - rs.startX;
    rs.dy = e.clientY - rs.startY;
    rs.shiftKey = e.shiftKey;

    if (rs.rafId === null) {
      rs.rafId = requestAnimationFrame(() => {
        const s = resizeState.current;
        if (!s) return;

        const currentZoom = zoomRef.current;
        const dxMm = pxToMm(s.dx, currentZoom);
        const dyMm = pxToMm(s.dy, currentZoom);
        const { x, y, width, height } = s.orig;

        let nx = x, ny = y, nw = width, nh = height;
        const h = s.handle;

        if (h.includes("right")) nw = Math.max(5, width + dxMm);
        if (h.includes("left")) { nw = Math.max(5, width - dxMm); nx = x + (width - nw); }
        if (h.includes("bottom")) nh = Math.max(5, height + dyMm);
        if (h === "top" || h === "top-left" || h === "top-right") {
          nh = Math.max(5, height - dyMm);
          ny = y + (height - nh);
        }

        // Aspect ratio: images lock by default (Shift to free), others free by default (Shift to lock)
        const shouldLockAspect = s.isImage ? !s.shiftKey : s.shiftKey;
        if (shouldLockAspect && h.includes("-")) {
          const aspect = width / height;
          if (Math.abs(dxMm) > Math.abs(dyMm)) {
            nh = nw / aspect;
            if (h.includes("top")) ny = y + height - nh;
          } else {
            nw = nh * aspect;
            if (h.includes("left")) nx = x + width - nw;
          }
        }

        s.el.style.left = `${nx}mm`;
        s.el.style.top = `${ny}mm`;
        s.el.style.width = `${nw}mm`;
        s.el.style.height = `${nh}mm`;
        s.rafId = null;
      });
    }
  });

  const handleUp = useRef(() => {
    const rs = resizeState.current;
    if (!rs) return;

    if (rs.rafId !== null) cancelAnimationFrame(rs.rafId);

    // Guard against NaN from click-without-move (inline styles may not be set)
    const px = parseFloat(rs.el.style.left);
    const py = parseFloat(rs.el.style.top);
    const pw = parseFloat(rs.el.style.width);
    const ph = parseFloat(rs.el.style.height);
    const finalX = Number.isFinite(px) ? px : rs.orig.x;
    const finalY = Number.isFinite(py) ? py : rs.orig.y;
    const finalW = Number.isFinite(pw) ? pw : rs.orig.width;
    const finalH = Number.isFinite(ph) ? ph : rs.orig.height;

    resumeHistory();
    updateElement(pageIdRef.current, rs.elementId, {
      geometry: {
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH,
        rotation: rs.orig.rotation,
      },
    });

    resizeState.current = null;
    window.removeEventListener("pointermove", handleMove.current);
    window.removeEventListener("pointerup", handleUp.current);
  });

  const startResize = useCallback(
    (
      e: React.PointerEvent,
      elementId: string,
      handle: HandlePosition,
      geometry: Geometry,
      el: HTMLElement,
      isImage: boolean = false,
    ) => {
      e.stopPropagation();
      e.preventDefault();
      pauseHistory();

      resizeState.current = {
        elementId,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        orig: { ...geometry },
        shiftKey: e.shiftKey,
        isImage,
        el,
        rafId: null,
        dx: 0,
        dy: 0,
      };

      window.addEventListener("pointermove", handleMove.current);
      window.addEventListener("pointerup", handleUp.current);
    },
    [pauseHistory],
  );

  return { startResize };
}

export type { HandlePosition };
