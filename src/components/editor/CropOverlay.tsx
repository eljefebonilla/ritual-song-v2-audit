"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ImageElement } from "@/types/schema";
import { mmToPx } from "@/utils/coordinates";

interface CropOverlayProps {
  element: ImageElement;
  zoom: number;
  onCropChange: (update: {
    cropTop: number; cropLeft: number; cropWidth: number; cropHeight: number;
    src?: string;
  }) => void;
  onClose: () => void;
}

/**
 * Canva-style crop editor.
 * Loads the image to get natural dimensions, then maps crop handles
 * to the actual image area (accounting for object-fit:contain layout).
 */
export function CropOverlay({ element, zoom, onCropChange, onClose }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const elW = mmToPx(element.geometry.width, zoom);
  const elH = mmToPx(element.geometry.height, zoom);

  // Load natural image dimensions to compute contain layout
  const [imgLayout, setImgLayout] = useState<{
    offsetX: number; offsetY: number; renderW: number; renderH: number;
  } | null>(null);

  useEffect(() => {
    if (!element.src) return;
    const img = new Image();
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const frameAspect = elW / elH;
      const imgAspect = natW / natH;

      let renderW: number, renderH: number, offsetX: number, offsetY: number;
      if (imgAspect > frameAspect) {
        // Image is wider: fills width, letterboxed top/bottom
        renderW = elW;
        renderH = elW / imgAspect;
        offsetX = 0;
        offsetY = (elH - renderH) / 2;
      } else {
        // Image is taller: fills height, pillarboxed left/right
        renderH = elH;
        renderW = elH * imgAspect;
        offsetX = (elW - renderW) / 2;
        offsetY = 0;
      }
      setImgLayout({ offsetX, offsetY, renderW, renderH });
    };
    img.src = element.src;
  }, [element.src, elW, elH]);

  // Crop values as fractions of the IMAGE (not the frame)
  const [crop, setCrop] = useState({
    top: element.cropTop,
    left: element.cropLeft,
    width: element.cropWidth,
    height: element.cropHeight,
  });

  // If layout not loaded yet, show loading
  if (!imgLayout) {
    return (
      <div style={{
        position: "absolute",
        left: mmToPx(element.geometry.x, zoom),
        top: mmToPx(element.geometry.y, zoom),
        width: elW, height: elH,
        zIndex: 10000,
        background: "rgba(0,0,0,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "white", fontSize: 12 }}>Loading...</span>
      </div>
    );
  }

  const { offsetX, offsetY, renderW, renderH } = imgLayout;

  // Convert image-relative crop fractions to pixel positions within the frame
  const cropPxLeft = offsetX + crop.left * renderW;
  const cropPxTop = offsetY + crop.top * renderH;
  const cropPxW = crop.width * renderW;
  const cropPxH = crop.height * renderH;

  return (
    <CropOverlayInner
      element={element}
      zoom={zoom}
      elW={elW}
      elH={elH}
      offsetX={offsetX}
      offsetY={offsetY}
      renderW={renderW}
      renderH={renderH}
      crop={crop}
      cropPxLeft={cropPxLeft}
      cropPxTop={cropPxTop}
      cropPxW={cropPxW}
      cropPxH={cropPxH}
      setCrop={setCrop}
      onCropChange={onCropChange}
      onClose={onClose}
    />
  );
}

function CropOverlayInner({
  element, zoom, elW, elH,
  offsetX, offsetY, renderW, renderH,
  crop, cropPxLeft, cropPxTop, cropPxW, cropPxH,
  setCrop, onCropChange, onClose,
}: {
  element: ImageElement;
  zoom: number;
  elW: number; elH: number;
  offsetX: number; offsetY: number; renderW: number; renderH: number;
  crop: { top: number; left: number; width: number; height: number };
  cropPxLeft: number; cropPxTop: number; cropPxW: number; cropPxH: number;
  setCrop: (c: { top: number; left: number; width: number; height: number }) => void;
  onCropChange: CropOverlayProps["onCropChange"];
  onClose: () => void;
}) {
  const dragRef = useRef<{
    edge: "top" | "bottom" | "left" | "right" | "move";
    startX: number;
    startY: number;
    startCrop: typeof crop;
  } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent, edge: "top" | "bottom" | "left" | "right" | "move") => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { edge, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } };

    const handleMove = (me: PointerEvent) => {
      if (!dragRef.current) return;
      // Convert pixel drag to image-relative fractions
      const dx = (me.clientX - dragRef.current.startX) / renderW;
      const dy = (me.clientY - dragRef.current.startY) / renderH;
      const s = dragRef.current.startCrop;
      const next = { ...s };

      switch (dragRef.current.edge) {
        case "top": {
          const newTop = Math.max(0, Math.min(s.top + s.height - 0.05, s.top + dy));
          next.top = newTop;
          next.height = s.height - (newTop - s.top);
          break;
        }
        case "bottom":
          next.height = Math.max(0.05, Math.min(1 - s.top, s.height + dy));
          break;
        case "left": {
          const newLeft = Math.max(0, Math.min(s.left + s.width - 0.05, s.left + dx));
          next.left = newLeft;
          next.width = s.width - (newLeft - s.left);
          break;
        }
        case "right":
          next.width = Math.max(0.05, Math.min(1 - s.left, s.width + dx));
          break;
        case "move":
          next.top = Math.max(0, Math.min(1 - s.height, s.top + dy));
          next.left = Math.max(0, Math.min(1 - s.width, s.left + dx));
          break;
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
  }, [crop, renderW, renderH, setCrop]);

  const apply = useCallback(() => {
    let newSrc = element.src;
    if (crop.top > 0.001 || crop.left > 0.001 || crop.width < 0.999 || crop.height < 0.999) {
      const base = element.src.replace(/&c[tlwh]=[^&]*/g, "");
      const sep = base.includes("?") ? "&" : "?";
      newSrc = `${base}${sep}ct=${crop.top.toFixed(4)}&cl=${crop.left.toFixed(4)}&cw=${crop.width.toFixed(4)}&ch=${crop.height.toFixed(4)}`;
    }
    onCropChange({ cropTop: 0, cropLeft: 0, cropWidth: 1, cropHeight: 1, src: newSrc });
    onClose();
  }, [crop, element.src, onCropChange, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); apply(); }
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }, [apply, onClose]);

  const HANDLE = 8;

  return (
    <div
      ref={(el) => { if (el) el.focus(); }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        left: mmToPx(element.geometry.x, zoom),
        top: mmToPx(element.geometry.y, zoom),
        width: elW, height: elH,
        zIndex: 10000,
        outline: "none",
      }}
    >
      {/* Dark overlay outside crop area */}
      <svg width={elW} height={elH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <defs>
          <mask id="crop-mask">
            <rect x={0} y={0} width={elW} height={elH} fill="white" />
            <rect x={cropPxLeft} y={cropPxTop} width={cropPxW} height={cropPxH} fill="black" />
          </mask>
        </defs>
        <rect x={0} y={0} width={elW} height={elH} fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)" />
      </svg>

      {/* Crop region border */}
      <div
        style={{
          position: "absolute",
          left: cropPxLeft, top: cropPxTop,
          width: cropPxW, height: cropPxH,
          border: "2px solid #3b82f6",
          boxSizing: "border-box",
          cursor: "move",
          pointerEvents: "auto",
        }}
        onPointerDown={(e) => handlePointerDown(e, "move")}
      >
        {/* Rule of thirds grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {[33.3, 66.6].map(p => (
            <div key={`v${p}`} style={{ position: "absolute", left: `${p}%`, top: 0, bottom: 0, borderLeft: "1px solid rgba(255,255,255,0.3)" }} />
          ))}
          {[33.3, 66.6].map(p => (
            <div key={`h${p}`} style={{ position: "absolute", top: `${p}%`, left: 0, right: 0, borderTop: "1px solid rgba(255,255,255,0.3)" }} />
          ))}
        </div>
      </div>

      {/* Edge drag handles */}
      <div style={{ position: "absolute", left: cropPxLeft + HANDLE, top: cropPxTop - HANDLE / 2, width: cropPxW - HANDLE * 2, height: HANDLE, cursor: "ns-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "top")} />
      <div style={{ position: "absolute", left: cropPxLeft + HANDLE, top: cropPxTop + cropPxH - HANDLE / 2, width: cropPxW - HANDLE * 2, height: HANDLE, cursor: "ns-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "bottom")} />
      <div style={{ position: "absolute", left: cropPxLeft - HANDLE / 2, top: cropPxTop + HANDLE, width: HANDLE, height: cropPxH - HANDLE * 2, cursor: "ew-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "left")} />
      <div style={{ position: "absolute", left: cropPxLeft + cropPxW - HANDLE / 2, top: cropPxTop + HANDLE, width: HANDLE, height: cropPxH - HANDLE * 2, cursor: "ew-resize", pointerEvents: "auto" }} onPointerDown={(e) => handlePointerDown(e, "right")} />

      {/* Apply / Cancel */}
      <div style={{ position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, pointerEvents: "auto" }}>
        <button onClick={apply} className="text-xs px-3 py-1 bg-blue-600 text-white rounded shadow hover:bg-blue-700">Apply</button>
        <button onClick={onClose} className="text-xs px-3 py-1 bg-white text-stone-600 rounded shadow border border-stone-200 hover:bg-stone-50">Cancel</button>
      </div>
    </div>
  );
}
