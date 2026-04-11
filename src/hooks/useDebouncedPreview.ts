"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { EditorPage } from "@/types/schema";
import { elementToHTML } from "@/utils/elementToCSS";
import { SEASON_COLORS, BASE_COLORS } from "@/core/design-system/tokens/colors";

const DEBOUNCE_MS = 500;

const PREVIEW_FONTS = `@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;600&display=swap');`;

function buildThemeCss(season: string): string {
  const c = SEASON_COLORS[season] ?? SEASON_COLORS["ordinary-time"];
  return `:root {
    --wa-primary: ${c.primary};
    --wa-secondary: ${c.secondary};
    --wa-text-accent: ${c.text};
    --wa-on-primary: ${c.onPrimary};
    --wa-text: ${BASE_COLORS.text};
    --wa-border: ${BASE_COLORS.border};
    --wa-surface: ${BASE_COLORS.surface};
    --wa-copyright: ${BASE_COLORS.copyright};
  }`;
}

function pageToSrcdoc(page: EditorPage, season: string): string {
  const elementsHtml = page.elements
    .filter((el) => el.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(elementToHTML)
    .join("\n");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${PREVIEW_FONTS}
${buildThemeCss(season)}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  width: ${page.pageSize.width}mm;
  height: ${page.pageSize.height}mm;
  position: relative;
  overflow: hidden;
  background: ${page.backgroundColor};
  font-family: 'Crimson Pro', Georgia, serif;
  color: #1A1A1A;
}
</style></head><body>${elementsHtml}</body></html>`;
}

/**
 * Debounced preview: generates an iframe srcdoc string from the current page's
 * element model, updating at most every 500ms after edits settle.
 */
export function useDebouncedPreview(pageId: string | null) {
  const pages = useEditorStore((s) => s.document.pages);
  const season = useEditorStore((s) => s.document.globalStyles.season);
  const page = pages.find((p) => p.id === pageId) ?? null;

  const instantSrcdoc = useMemo(
    () => (page ? pageToSrcdoc(page, season) : ""),
    [page, season],
  );

  // For truly debounced behavior, use a deferred value approach
  const [debouncedSrcdoc, setDebouncedSrcdoc] = useState(instantSrcdoc);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSrcdoc(instantSrcdoc);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [instantSrcdoc]);

  return debouncedSrcdoc;
}
