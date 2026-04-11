"use client";

import { useState, useRef, useCallback } from "react";
import type { ImageElement } from "@/types/schema";
import { mmToPx } from "@/utils/coordinates";

interface CropOverlayProps {
  element: ImageElement;
  zoom: number;
  onCropChange: (crop: { cropTop: number; cropLeft: number; cropWidth: number; cropHeight: number }) => void;
  onClose: () => void;
}

/**
 * Canva-style crop editor: shows full image with a bright crop region.
 * Drag edges to adjust the crop. Click outside or press Enter/Escape to apply.
 */
export function CropOverlay({ element, zoom, onCropChange, onClose }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Crop values as fractions (0-1)
  const [crop, setCrop] = useState({
    top: element.cropTop,
    left: element.cropLeft,
    width: element.cropWidth,
    height: element.cropHeight,
  });

  const elW = mmToPx(element.geometry.width, zoom);
  const elH = mmToPx(element.geometry.height, zoom);

  // Drag state
  const dragRef = useRef<{
    edge: "top" | "bottom" | "left" | "right" | "move";
    startX: number;
    startY: number;
    startCrop: typeof crop;
  } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, edge: typeof dragRef.current extends null ? never : NonNullable<typeof dragRef.current>["edge"]) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      edge,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };

    const handleMove = (me: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = (me.clientX - dragRef.current.startX) / elW;
      const dy = (me.clientY - dragRef.current.startY) / elH;
      const s = dragRef.current.startCrop;

      const next = { ...s };
      switch (dragRef.current.edge) {
        case "top": {
          const newTop = Math.max(0, Math.min(s.top + s.height - 0.05, s.top + dy));
          next.top = newTop;
          next.height = s.height - (newTop - s.top);
          break;
        }
        case "bottom": {
          next.height = Math.max(0.05, Math.min(1 - s.top, s.height + dy));
          break;
        }
        case "left": {
          const newLeft = Math.max(0, Math.min(s.left + s.width - 0.05, s.left + dx));
          next.left = newLeft;
          next.width = s.width - (newLeft - s.left);
          break;
        }
        case "right": {
          next.width = Math.max(0.05, Math.min(1 - s.left, s.width + dx));
          break;
        }
        case "move": {
          next.top = Math.max(0, Math.min(1 - s.height, s.top + dy));
          next.left = Math.max(0, Math.min(1 - s.width, s.left + dx));
          break;
        }
      }
      setCrop(next);
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }, [crop, elW, elH]);

  const apply = useCallback(() => {
    onCropChange({
      cropTop: crop.top,
      cropLeft: crop.left,
      cropWidth: crop.width,
      cropHeight: crop.height,
    });
    onClose();
  }, [crop, onCropChange, onClose]);

  // Keyboard: Enter to apply, Escape to cancel
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); apply(); }
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }, [apply, onClose]);

  const HANDLE = 8;

  return (
    <div
      ref={(el) => { (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el; if (el) el.focus(); }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: mmToPx(element.geometry.x, zoom),
        top: mmToPx(element.geometry.y, zoom),
        width: elW,
        height: elH,
        zIndex: 10000,
        cursor: "default",
        outline: "none",
      }}
    >
      {/* Dark overlay outside crop area */}
      <svg width={elW} height={elH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <defs>
          <mask id="crop-mask">
            <rect x={0} y={0} width={elW} height={elH} fill="white" />
            <rect
              x={crop.left * elW}
              y={crop.top * elH}
              width={crop.width * elW}
              height={crop.height * elH}
              fill="black"
            />
          </mask>
        </defs>
        <rect x={0} y={0} width={elW} height={elH} fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
      </svg>

      {/* Crop region border */}
      <div
        style={{
          position: "absolute",
          left: crop.left * elW,
          top: crop.top * elH,
          width: crop.width * elW,
          height: crop.height * elH,
          border: "2px solid #3b82f6",
          boxSizing: "border-box",
          cursor: "move",
          pointerEvents: "auto",
        }}
        onPointerDown={(e) => handlePointerDown(e, "move")}
      >
        {/* Rule of thirds grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: "33.3%", top: 0, bottom: 0, borderLeft: "1px solid rgba(255,255,255,0.3)" }} />
          <div style={{ position: "absolute", left: "66.6%", top: 0, bottom: 0, borderLeft: "1px solid rgba(255,255,255,0.3)" }} />
          <div style={{ position: "absolute", top: "33.3%", left: 0, right: 0, borderTop: "1px solid rgba(255,255,255,0.3)" }} />
          <div style={{ position: "absolute", top: "66.6%", left: 0, right: 0, borderTop: "1px solid rgba(255,255,255,0.3)" }} />
        </div>
      </div>

      {/* Edge handles */}
      {/* Top */}
      <div
        style={{
          position: "absolute",
          left: crop.left * elW + HANDLE,
          top: crop.top * elH - HANDLE / 2,
          width: crop.width * elW - HANDLE * 2,
          height: HANDLE,
          cursor: "ns-resize",
          pointerEvents: "auto",
        }}
        onPointerDown={(e) => handlePointerDown(e, "top")}
      />
      {/* Bottom */}
      <div
        style={{
          position: "absolute",
          left: crop.left * elW + HANDLE,
          top: (crop.top + crop.height) * elH - HANDLE / 2,
          width: crop.width * elW - HANDLE * 2,
          height: HANDLE,
          cursor: "ns-resize",
          pointerEvents: "auto",
        }}
        onPointerDown={(e) => handlePointerDown(e, "bottom")}
      />
      {/* Left */}
      <div
        style={{
          position: "absolute",
          left: crop.left * elW - HANDLE / 2,
          top: crop.top * elH + HANDLE,
          width: HANDLE,
          height: crop.height * elH - HANDLE * 2,
          cursor: "ew-resize",
          pointerEvents: "auto",
        }}
        onPointerDown={(e) => handlePointerDown(e, "left")}
      />
      {/* Right */}
      <div
        style={{
          position: "absolute",
          left: (crop.left + crop.width) * elW - HANDLE / 2,
          top: crop.top * elH + HANDLE,
          width: HANDLE,
          height: crop.height * elH - HANDLE * 2,
          cursor: "ew-resize",
          pointerEvents: "auto",
        }}
        onPointerDown={(e) => handlePointerDown(e, "right")}
      />

      {/* Apply / Cancel buttons */}
      <div
        style={{
          position: "absolute",
          bottom: -36,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={apply}
          className="text-xs px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
        >
          Apply
        </button>
        <button
          onClick={onClose}
          className="text-xs px-3 py-1 bg-white text-stone-600 rounded shadow border border-stone-200 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
