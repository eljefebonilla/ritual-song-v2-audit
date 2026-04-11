"use client";

import type { ShapeElement, QRElement, DividerElement } from "@/types/schema";
import { elementToCSS } from "@/utils/elementToCSS";
import { useEditorStore } from "@/store/editorStore";

interface ShapeRendererProps {
  element: ShapeElement;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, elementId: string) => void;
}

export function ShapeRenderer({ element, isSelected, onPointerDown }: ShapeRendererProps) {
  const zoom = useEditorStore((s) => s.zoom);
  const style = elementToCSS(element, { unit: "px", zoom });

  return (
    <div
      data-element-id={element.id}
      style={{
        ...style,
        cursor: element.locked ? "default" : "move",
        outline: isSelected ? "2px solid #3b82f6" : undefined,
        outlineOffset: "1px",
        userSelect: "none",
        pointerEvents: element.locked ? "none" : "auto",
      }}
      onPointerDown={(e) => !element.locked && onPointerDown(e, element.id)}
    />
  );
}

interface QRRendererProps {
  element: QRElement;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, elementId: string) => void;
}

export function QRRenderer({ element, isSelected, onPointerDown }: QRRendererProps) {
  const zoom = useEditorStore((s) => s.zoom);
  const style = elementToCSS(element, { unit: "px", zoom });
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(element.url)}&size=200x200&color=${element.foregroundColor.replace("#", "")}&bgcolor=${element.backgroundColor.replace("#", "")}`;

  return (
    <div
      data-element-id={element.id}
      style={{
        ...style,
        cursor: element.locked ? "default" : "move",
        outline: isSelected ? "2px solid #3b82f6" : undefined,
        outlineOffset: "1px",
        userSelect: "none",
        pointerEvents: element.locked ? "none" : "auto",
      }}
      onPointerDown={(e) => !element.locked && onPointerDown(e, element.id)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrSrc} alt="QR" draggable={false} style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
    </div>
  );
}

interface DividerRendererProps {
  element: DividerElement;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, elementId: string) => void;
}

export function DividerRenderer({ element, isSelected, onPointerDown }: DividerRendererProps) {
  const zoom = useEditorStore((s) => s.zoom);
  const style = elementToCSS(element, { unit: "px", zoom });

  return (
    <div
      data-element-id={element.id}
      style={{
        ...style,
        cursor: element.locked ? "default" : "move",
        outline: isSelected ? "2px solid #3b82f6" : undefined,
        outlineOffset: "1px",
        userSelect: "none",
        pointerEvents: element.locked ? "none" : "auto",
      }}
      onPointerDown={(e) => !element.locked && onPointerDown(e, element.id)}
    />
  );
}
