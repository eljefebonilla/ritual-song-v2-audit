"use client";

import type { Geometry } from "@/types/schema";
import type { HandlePosition } from "@/hooks/useResize";
import { mmToPx } from "@/utils/coordinates";

const HANDLE_SIZE = 10;
const TOUCH_PAD = 16; // Extra invisible touch target padding around handles

const HANDLES: { pos: HandlePosition; cursor: string; style: React.CSSProperties }[] = [
  { pos: "top-left",     cursor: "nwse-resize", style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
  { pos: "top",          cursor: "ns-resize",   style: { top: -HANDLE_SIZE / 2, left: "50%", marginLeft: -HANDLE_SIZE / 2 } },
  { pos: "top-right",    cursor: "nesw-resize", style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
  { pos: "right",        cursor: "ew-resize",   style: { top: "50%", marginTop: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
  { pos: "bottom-right", cursor: "nwse-resize", style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
  { pos: "bottom",       cursor: "ns-resize",   style: { bottom: -HANDLE_SIZE / 2, left: "50%", marginLeft: -HANDLE_SIZE / 2 } },
  { pos: "bottom-left",  cursor: "nesw-resize", style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
  { pos: "left",         cursor: "ew-resize",   style: { top: "50%", marginTop: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
];

interface SelectionOverlayProps {
  geometry: Geometry;
  zoom: number;
  onResizeStart: (e: React.PointerEvent, handle: HandlePosition) => void;
  isHover?: boolean;
}

export function SelectionOverlay({ geometry, zoom, onResizeStart, isHover }: SelectionOverlayProps) {
  const left = mmToPx(geometry.x, zoom);
  const top = mmToPx(geometry.y, zoom);
  const width = mmToPx(geometry.width, zoom);
  const height = mmToPx(geometry.height, zoom);

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        transform: geometry.rotation ? `rotate(${geometry.rotation}deg)` : undefined,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/* Bounding box border */}
      <div
        style={{
          position: "absolute",
          inset: -1,
          border: isHover ? "1px dashed #93c5fd" : "1.5px solid #3b82f6",
          borderRadius: 1,
          pointerEvents: "none",
        }}
      />

      {/* 8 resize handles with expanded touch targets */}
      {HANDLES.map(({ pos, cursor, style }) => (
        <div
          key={pos}
          style={{
            position: "absolute",
            width: HANDLE_SIZE + TOUCH_PAD * 2,
            height: HANDLE_SIZE + TOUCH_PAD * 2,
            cursor,
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Offset to center the expanded area on the handle position
            marginTop: style.marginTop != null ? (typeof style.marginTop === "number" ? style.marginTop - TOUCH_PAD : style.marginTop) : -TOUCH_PAD,
            marginLeft: style.marginLeft != null ? (typeof style.marginLeft === "number" ? style.marginLeft - TOUCH_PAD : style.marginLeft) : -TOUCH_PAD,
            top: typeof style.top === "number" ? style.top : style.top,
            left: typeof style.left === "number" ? style.left : style.left,
            right: typeof style.right === "number" ? style.right - TOUCH_PAD : style.right,
            bottom: typeof style.bottom === "number" ? style.bottom - TOUCH_PAD : style.bottom,
          }}
          onPointerDown={(e) => onResizeStart(e, pos)}
        >
          {/* Visible handle dot */}
          <div
            style={{
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              backgroundColor: isHover ? "rgba(255,255,255,0.7)" : "white",
              border: isHover ? "1px solid #93c5fd" : "1.5px solid #3b82f6",
              borderRadius: 2,
              flexShrink: 0,
              opacity: isHover ? 0.6 : 1,
            }}
          />
        </div>
      ))}
    </div>
  );
}
