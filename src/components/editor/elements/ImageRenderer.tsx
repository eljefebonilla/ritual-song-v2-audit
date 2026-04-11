"use client";

import { useRef, useState } from "react";
import type { ImageElement } from "@/types/schema";
import { elementToCSS } from "@/utils/elementToCSS";
import { useEditorStore } from "@/store/editorStore";

interface ImageRendererProps {
  element: ImageElement;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, elementId: string) => void;
}

export function ImageRenderer({ element, isSelected, onPointerDown }: ImageRendererProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [imgLoading, setImgLoading] = useState(true);
  const zoom = useEditorStore((s) => s.zoom);
  const style = elementToCSS(element, { unit: "px", zoom });

  const clipPath =
    element.cropTop > 0 || element.cropLeft > 0 || element.cropWidth < 1 || element.cropHeight < 1
      ? `inset(${element.cropTop * 100}% ${(1 - element.cropLeft - element.cropWidth) * 100}% ${(1 - element.cropTop - element.cropHeight) * 100}% ${element.cropLeft * 100}%)`
      : undefined;

  return (
    <div
      ref={ref}
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
      {imgLoading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f4" }}>
          <span style={{ fontSize: "10px", color: "#a8a29e" }}>Loading...</span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={element.src}
        alt=""
        draggable={false}
        onLoad={() => setImgLoading(false)}
        onError={() => setImgLoading(false)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: element.objectFit,
          clipPath,
          pointerEvents: "none",
          opacity: imgLoading ? 0 : 1,
        }}
      />
    </div>
  );
}
