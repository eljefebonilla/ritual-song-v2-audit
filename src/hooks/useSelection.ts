"use client";

import { useCallback, useRef } from "react";
import { useEditorStore } from "@/store/editorStore";

/**
 * Click-to-select for elements on the editor canvas.
 * - Click element: select it (deselect others)
 * - Shift+click: toggle element in multi-selection
 * - Click canvas background: deselect all
 */
export function useSelection() {
  const selectElements = useEditorStore((s) => s.selectElements);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const selectedIds = useEditorStore((s) => s.selectedElementIds);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleElementPointerDown = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      e.stopPropagation();

      if (e.shiftKey) {
        // Toggle in multi-selection
        const next = selectedIds.includes(elementId)
          ? selectedIds.filter((id) => id !== elementId)
          : [...selectedIds, elementId];
        selectElements(next);
      } else {
        selectElements([elementId]);
      }
    },
    [selectedIds, selectElements],
  );

  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only deselect if clicking the canvas itself, not a child element
      if (e.target === e.currentTarget || e.target === canvasRef.current) {
        clearSelection();
      }
    },
    [clearSelection],
  );

  return {
    canvasRef,
    handleElementPointerDown,
    handleCanvasPointerDown,
    selectedIds,
  };
}
