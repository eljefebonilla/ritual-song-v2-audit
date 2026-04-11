"use client";

import { useRef, useCallback, useState, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { mmToPx } from "@/utils/coordinates";
import { useSelection } from "@/hooks/useSelection";
import { useDrag } from "@/hooks/useDrag";
import { useResize } from "@/hooks/useResize";
import { SelectionOverlay } from "./SelectionOverlay";
import { CropOverlay } from "./CropOverlay";
import { elementToHTML } from "@/utils/elementToCSS";
import { SEASON_COLORS, BASE_COLORS } from "@/core/design-system/tokens/colors";
import type { PageElement, ImageElement } from "@/types/schema";
import type { HandlePosition } from "@/hooks/useResize";

const PREVIEW_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');`;

interface EditorCanvasProps {
  pageId: string;
}

export function EditorCanvas({ pageId }: EditorCanvasProps) {
  const page = useEditorStore((s) => s.document.pages.find((p) => p.id === pageId));
  const season = useEditorStore((s) => s.document.globalStyles.season);
  const zoom = useEditorStore((s) => s.zoom);
  const { handleElementPointerDown, handleCanvasPointerDown, selectedIds } = useSelection();
  const { startDrag } = useDrag(pageId);
  const { startResize } = useResize(pageId);
  const updateElement = useEditorStore((s) => s.updateElement);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [croppingElementId, setCroppingElementId] = useState<string | null>(null);

  const handleElementDown = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      handleElementPointerDown(e, elementId);
      const element = page?.elements.find((x) => x.id === elementId);
      if (element && !element.locked) {
        const el = canvasRef.current?.querySelector(`[data-overlay-id="${elementId}"]`) as HTMLElement | null;
        if (el) startDrag(e, elementId, element.geometry.x, element.geometry.y, el);
      }
    },
    [handleElementPointerDown, startDrag, page?.elements],
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, handle: HandlePosition, element: PageElement) => {
      const el = canvasRef.current?.querySelector(`[data-overlay-id="${element.id}"]`) as HTMLElement | null;
      if (el) startResize(e, element.id, handle, element.geometry, el, element.type === "image");
    },
    [startResize],
  );

  // Build the page HTML (same as preview/print) using shared elementToHTML
  const pageSrcdoc = useMemo(() => {
    if (!page) return "";
    const c = SEASON_COLORS[season] ?? SEASON_COLORS["ordinary-time"];
    const themeCss = `:root {
      --wa-primary: ${c.primary}; --wa-secondary: ${c.secondary};
      --wa-text-accent: ${c.text}; --wa-on-primary: ${c.onPrimary};
      --wa-text: ${BASE_COLORS.text}; --wa-border: ${BASE_COLORS.border};
      --wa-surface: ${BASE_COLORS.surface}; --wa-copyright: ${BASE_COLORS.copyright};
    }`;

    const elements = page.elements
      .filter((el) => el.visible)
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(elementToHTML)
      .join("\n");

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${PREVIEW_FONTS}
${themeCss}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: ${page.pageSize.width}mm;
  height: ${page.pageSize.height}mm;
  position: relative;
  overflow: hidden;
  background: ${page.backgroundColor};
  font-family: 'Crimson Pro', Georgia, serif;
  color: #1A1A1A;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
</style></head><body>${elements}</body></html>`;
  }, [page, season]);

  if (!page) return null;

  const canvasW = mmToPx(page.pageSize.width, zoom);
  const canvasH = mmToPx(page.pageSize.height, zoom);

  const sortedElements = [...page.elements]
    .filter((el) => el.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={canvasRef}
      className="relative shadow-xl rounded"
      style={{
        width: canvasW,
        height: canvasH,
        flexShrink: 0,
        overflow: "hidden",
      }}
      onPointerDown={handleCanvasPointerDown}
    >
      {/* WYSIWYG layer: iframe with the exact same HTML as print/preview */}
      <iframe
        srcDoc={pageSrcdoc}
        sandbox="allow-same-origin"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: mmToPx(page.pageSize.width, 1),
          height: mmToPx(page.pageSize.height, 1),
          border: "none",
          pointerEvents: "none",
          transformOrigin: "top left",
          transform: zoom !== 1 ? `scale(${zoom})` : undefined,
        }}
        title="Editor WYSIWYG"
      />

      {/* Interactive overlay layer: transparent hit targets for selection/drag/resize */}
      {sortedElements.map((element) => {
        const isSelected = selectedIds.includes(element.id);
        const isHovered = hoveredElementId === element.id && !isSelected;
        const left = mmToPx(element.geometry.x, zoom);
        const top = mmToPx(element.geometry.y, zoom);
        const width = mmToPx(element.geometry.width, zoom);
        const height = mmToPx(element.geometry.height, zoom);

        return (
          <div key={element.id}>
            {/* Hit target overlay (transparent, positioned over the element) */}
            <div
              data-overlay-id={element.id}
              style={{
                position: "absolute",
                left, top, width, height,
                cursor: element.locked ? "default" : "move",
                zIndex: element.zIndex + 100,
                pointerEvents: element.locked ? "none" : "auto",
              }}
              onPointerDown={(e) => {
                if (!element.locked) handleElementDown(e, element.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (element.type === "image" && !element.locked) {
                  setCroppingElementId(element.id);
                }
              }}
              onMouseEnter={() => setHoveredElementId(element.id)}
              onMouseLeave={() => setHoveredElementId((prev) => prev === element.id ? null : prev)}
            />

            {/* Selection overlay */}
            {isSelected && (
              <SelectionOverlay
                geometry={element.geometry}
                zoom={zoom}
                onResizeStart={(e, handle) => handleResizeStart(e, handle, element)}
              />
            )}
            {isHovered && (
              <SelectionOverlay
                geometry={element.geometry}
                zoom={zoom}
                onResizeStart={(e, handle) => handleResizeStart(e, handle, element)}
                isHover
              />
            )}

            {/* Crop overlay */}
            {croppingElementId === element.id && element.type === "image" && (
              <CropOverlay
                element={element as ImageElement}
                zoom={zoom}
                onCropChange={(update) => {
                  if (!selectedPageId) return;
                  updateElement(selectedPageId, element.id, update);
                }}
                onClose={() => setCroppingElementId(null)}
              />
            )}
          </div>
        );
      })}

      {/* Snap guide lines */}
      <SnapGuideLines zoom={zoom} pageWidth={page.pageSize.width} pageHeight={page.pageSize.height} />
    </div>
  );
}

function SnapGuideLines({ zoom, pageWidth, pageHeight }: { zoom: number; pageWidth: number; pageHeight: number }) {
  const guides = useEditorStore((s) => s.activeSnapGuides);
  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((g, i) => {
        if (g.axis === "x") {
          return (
            <div
              key={`snap-${i}`}
              style={{
                position: "absolute",
                left: mmToPx(g.position, zoom),
                top: 0,
                width: 0,
                height: mmToPx(pageHeight, zoom),
                borderLeft: "1px dashed #3b82f6",
                pointerEvents: "none",
                zIndex: 9998,
              }}
            />
          );
        }
        return (
          <div
            key={`snap-${i}`}
            style={{
              position: "absolute",
              left: 0,
              top: mmToPx(g.position, zoom),
              width: mmToPx(pageWidth, zoom),
              height: 0,
              borderTop: "1px dashed #3b82f6",
              pointerEvents: "none",
              zIndex: 9998,
            }}
          />
        );
      })}
    </>
  );
}
