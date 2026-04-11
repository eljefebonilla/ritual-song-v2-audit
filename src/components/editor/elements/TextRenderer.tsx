"use client";

import { useRef, useState, useCallback } from "react";
import type { TextElement } from "@/types/schema";
import { elementToCSS } from "@/utils/elementToCSS";
import { useEditorStore } from "@/store/editorStore";

interface TextRendererProps {
  element: TextElement;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, elementId: string) => void;
}

/**
 * Renders a TextElement on the editor canvas.
 * Double-click enters contentEditable mode for inline text editing.
 * Escape or blur exits editing and commits content to store.
 */
export function TextRenderer({ element, isSelected, onPointerDown }: TextRendererProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const updateElement = useEditorStore((s) => s.updateElement);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const zoom = useEditorStore((s) => s.zoom);
  const style = elementToCSS(element, { unit: "px", zoom });

  const commitEdit = useCallback(() => {
    if (!ref.current || !selectedPageId) return;
    const newContent = ref.current.innerHTML;
    if (newContent !== element.content) {
      updateElement(selectedPageId, element.id, { content: newContent });
    }
    setEditing(false);
  }, [element.id, element.content, selectedPageId, updateElement]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (element.locked) return;
    e.stopPropagation();
    setEditing(true);
    // Focus after React render
    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.focus();
        // Select all text
        const sel = window.getSelection();
        if (sel) {
          sel.selectAllChildren(ref.current);
          sel.collapseToEnd();
        }
      }
    });
  }, [element.locked]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      commitEdit();
    }
    // Prevent delete/backspace from bubbling to page-level handler while editing
    if (e.key === "Delete" || e.key === "Backspace") {
      e.stopPropagation();
    }
  }, [commitEdit]);

  return (
    <div
      ref={ref}
      data-element-id={element.id}
      contentEditable={editing}
      suppressContentEditableWarning
      style={{
        ...style,
        cursor: editing ? "text" : element.locked ? "default" : "move",
        outline: isSelected ? (editing ? "2px solid #2563eb" : "2px solid #3b82f6") : undefined,
        outlineOffset: "1px",
        userSelect: editing ? "text" : "none",
        pointerEvents: element.locked ? "none" : "auto",
        WebkitUserSelect: editing ? "text" : "none",
      }}
      onPointerDown={(e) => {
        if (editing) {
          e.stopPropagation(); // Don't start drag while editing
          return;
        }
        if (!element.locked) onPointerDown(e, element.id);
      }}
      onDoubleClick={handleDoubleClick}
      onBlur={editing ? commitEdit : undefined}
      onKeyDown={editing ? handleKeyDown : undefined}
      // Admin-only content from element model, not user-submitted
      dangerouslySetInnerHTML={editing ? undefined : { __html: element.content }}
    />
  );
}
