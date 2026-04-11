/**
 * Shared CSS generation from PageElement data.
 * Used by BOTH the interactive editor (React components)
 * and the print renderer (static HTML for PDF).
 * All positions in mm, font sizes in pt.
 */

import type { PageElement } from "@/types/schema";
import type { CSSProperties } from "react";
import { mmToPx } from "./coordinates";

export interface ElementCSSOptions {
  unit?: "mm" | "px";
  zoom?: number;
}

export function elementToCSS(el: PageElement, opts?: ElementCSSOptions): CSSProperties {
  const unit = opts?.unit ?? "mm";
  const zoom = opts?.zoom ?? 1;

  function dim(mm: number): string {
    return unit === "px" ? `${mmToPx(mm, zoom)}px` : `${mm}mm`;
  }

  const base: CSSProperties = {
    position: "absolute",
    left: dim(el.geometry.x),
    top: dim(el.geometry.y),
    width: dim(el.geometry.width),
    height: dim(el.geometry.height),
    transform: el.geometry.rotation ? `rotate(${el.geometry.rotation}deg)` : undefined,
    zIndex: el.zIndex,
    display: el.visible ? undefined : "none",
  };

  switch (el.type) {
    case "text":
      return {
        ...base,
        fontFamily: el.fontFamily,
        fontSize: `${el.fontSize}pt`,
        fontWeight: el.fontWeight,
        color: el.color,
        textAlign: el.textAlign,
        lineHeight: el.lineHeight,
        letterSpacing: `${el.letterSpacing}em`,
        fontVariant: el.textTransform === "small-caps" ? "small-caps" : undefined,
        textTransform: el.textTransform === "uppercase" ? "uppercase" : undefined,
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
        overflow: "hidden",
      };

    case "image":
      return {
        ...base,
        objectFit: el.objectFit,
        opacity: el.opacity,
        overflow: "hidden",
        imageRendering: "-webkit-optimize-contrast" as CSSProperties["imageRendering"],
      };

    case "shape":
      return {
        ...base,
        backgroundColor: el.fill,
        border: el.strokeWidth > 0 ? `${el.strokeWidth}mm ${el.stroke} solid` : undefined,
        borderRadius: el.subType === "ellipse" ? "50%" : undefined,
      };

    case "qr":
      return base;

    case "divider":
      return {
        ...base,
        borderTop: `${el.strokeWidth}mm ${el.strokeStyle} ${el.stroke}`,
        height: "0",
      };

    default:
      return base;
  }
}

/**
 * Generate static HTML string from a single element (for print renderer).
 */
export function elementToHTML(el: PageElement): string {
  const style = Object.entries(elementToCSS(el))
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}: ${v}`)
    .join("; ");

  switch (el.type) {
    case "text":
      return `<div data-el-id="${el.id}" style="${style}">${el.content}</div>`;

    case "image": {
      const clipStyle = el.cropTop > 0 || el.cropLeft > 0 || el.cropWidth < 1 || el.cropHeight < 1
        ? `clip-path: inset(${el.cropTop * 100}% ${(1 - el.cropLeft - el.cropWidth) * 100}% ${(1 - el.cropTop - el.cropHeight) * 100}% ${el.cropLeft * 100}%);`
        : "";
      return `<div data-el-id="${el.id}" style="${style}"><img src="${el.src}" alt="" style="width:100%;height:100%;object-fit:${el.objectFit};${clipStyle}" /></div>`;
    }

    case "shape":
      return `<div data-el-id="${el.id}" style="${style}"></div>`;

    case "qr":
      return `<div data-el-id="${el.id}" style="${style}"><img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(el.url)}&size=200x200&color=${el.foregroundColor.replace("#", "")}&bgcolor=${el.backgroundColor.replace("#", "")}" alt="QR" style="width:100%;height:100%;" /></div>`;

    case "divider":
      return `<div data-el-id="${el.id}" style="${style}"></div>`;

    default:
      return "";
  }
}
