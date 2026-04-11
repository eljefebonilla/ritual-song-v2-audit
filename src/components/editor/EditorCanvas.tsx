"use client";

import { useRef, useCallback, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { mmToPx } from "@/utils/coordinates";
import { useSelection } from "@/hooks/useSelection";
import { useDrag } from "@/hooks/useDrag";
import { useResize } from "@/hooks/useResize";
import { SelectionOverlay } from "./SelectionOverlay";
import { TextRenderer } from "./elements/TextRenderer";
import { ImageRenderer } from "./elements/ImageRenderer";
import { ShapeRenderer, QRRenderer, DividerRenderer } from "./elements/ShapeRenderer";
import type { PageElement } from "@/types/schema";
import type { HandlePosition } from "@/hooks/useResize";

interface EditorCanvasProps {
  pageId: string;
}

export function EditorCanvas({ pageId }: EditorCanvasProps) {
  const page = useEditorStore((s) => s.document.pages.find((p) => p.id === pageId));
  const zoom = useEditorStore((s) => s.zoom);
  const { handleElementPointerDown, handleCanvasPointerDown, selectedIds } = useSelection();
  const { startDrag } = useDrag(pageId);
  const { startResize } = useResize(pageId);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  const handleElementDown = useCallback(
    (e: React.PointerEvent, elementId: string) => {
      handleElementPointerDown(e, elementId);

      // Start drag on the element
      const el = (e.currentTarget as HTMLElement);
      const element = page?.elements.find((x) => x.id === elementId);
      if (element && !element.locked) {
        startDrag(e, elementId, element.geometry.x, element.geometry.y, el);
      }
    },
    [handleElementPointerDown, startDrag, page?.elements],
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, handle: HandlePosition, element: PageElement) => {
      const el = canvasRef.current?.querySelector(
        `[data-element-id="${element.id}"]`,
      ) as HTMLElement | null;
      if (el) {
        startResize(e, element.id, handle, element.geometry, el, element.type === "image");
      }
    },
    [startResize],
  );

  if (!page) return null;

  const canvasW = mmToPx(page.pageSize.width, zoom);
  const canvasH = mmToPx(page.pageSize.height, zoom);

  const sortedElements = [...page.elements]
    .filter((el) => el.visible)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={canvasRef}
      className="relative bg-white shadow-xl rounded"
      style={{
        width: canvasW,
        height: canvasH,
        backgroundColor: page.backgroundColor,
        overflow: "hidden",
        flexShrink: 0,
      }}
      onPointerDown={handleCanvasPointerDown}
    >
      {sortedElements.map((element) => {
        const isSelected = selectedIds.includes(element.id);
        const isHovered = hoveredElementId === element.id && !isSelected;

        return (
          <ElementWrapper
            key={element.id}
            onMouseEnter={() => setHoveredElementId(element.id)}
            onMouseLeave={() => setHoveredElementId((prev) => prev === element.id ? null : prev)}
          >
            {renderElement(element, isSelected, handleElementDown)}
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
          </ElementWrapper>
        );
      })}

      {/* Snap guide lines */}
      <SnapGuideLines zoom={zoom} pageWidth={page.pageSize.width} pageHeight={page.pageSize.height} />
    </div>
  );
}

function ElementWrapper({ children, onMouseEnter, onMouseLeave }: { children: React.ReactNode; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  return <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ display: "contents" }}>{children}</div>;
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

function renderElement(
  element: PageElement,
  isSelected: boolean,
  onPointerDown: (e: React.PointerEvent, id: string) => void,
) {
  switch (element.type) {
    case "text":
      return <TextRenderer element={element} isSelected={isSelected} onPointerDown={onPointerDown} />;
    case "image":
      return <ImageRenderer element={element} isSelected={isSelected} onPointerDown={onPointerDown} />;
    case "shape":
      return <ShapeRenderer element={element} isSelected={isSelected} onPointerDown={onPointerDown} />;
    case "qr":
      return <QRRenderer element={element} isSelected={isSelected} onPointerDown={onPointerDown} />;
    case "divider":
      return <DividerRenderer element={element} isSelected={isSelected} onPointerDown={onPointerDown} />;
    default:
      return null;
  }
}
