/**
 * Worship Aid Builder guardrails: validates elements and pages against
 * print-quality rules from publisher research.
 */

import type { EditorPage, PageElement, TextElement, ImageElement } from "@/types/schema";
// MARGINS used for GUTTER_MIN_MM constant below

export interface ValidationWarning {
  elementId: string | null;
  pageId: string;
  severity: "error" | "warning";
  rule: string;
  message: string;
}

const MIN_BODY_FONT = 9;    // pt
const MIN_COPYRIGHT_FONT = 7; // pt (NEVER below)
const MAX_ELEMENTS_PER_PAGE = 8;
const GUTTER_MIN_MM = 20;   // inner margin
const PURE_BLACK = "#000000";
const RICH_BLACK = "#1A1A1A";
const MIN_DPI = 200;

function isText(el: PageElement): el is TextElement {
  return el.type === "text";
}

function isImage(el: PageElement): el is ImageElement {
  return el.type === "image";
}

export function validatePage(page: EditorPage): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Max elements per page
  if (page.elements.length > MAX_ELEMENTS_PER_PAGE) {
    warnings.push({
      elementId: null,
      pageId: page.id,
      severity: "warning",
      rule: "max-elements",
      message: `Page has ${page.elements.length} elements (recommended max: ${MAX_ELEMENTS_PER_PAGE}). Consider splitting.`,
    });
  }

  for (const el of page.elements) {
    // Font size checks
    if (isText(el)) {
      if (el.fontSize < MIN_COPYRIGHT_FONT) {
        warnings.push({
          elementId: el.id,
          pageId: page.id,
          severity: "error",
          rule: "min-font-size",
          message: `Font size ${el.fontSize}pt is below minimum ${MIN_COPYRIGHT_FONT}pt. Elderly parishioners cannot read this.`,
        });
      } else if (el.fontSize < MIN_BODY_FONT && el.fontSize >= MIN_COPYRIGHT_FONT) {
        // Only warn if it's not clearly a copyright element
        const isCopyright = el.geometry.y > 190;
        if (!isCopyright) {
          warnings.push({
            elementId: el.id,
            pageId: page.id,
            severity: "warning",
            rule: "small-font-size",
            message: `Font size ${el.fontSize}pt is small for body text (recommended: ${MIN_BODY_FONT}pt+).`,
          });
        }
      }

      // Pure black text
      if (el.color.toLowerCase() === PURE_BLACK) {
        warnings.push({
          elementId: el.id,
          pageId: page.id,
          severity: "warning",
          rule: "pure-black",
          message: `Pure #000000 black bleeds in print. Use ${RICH_BLACK} (rich black) instead.`,
        });
      }
    }

    // Gutter safety
    if (el.geometry.x < GUTTER_MIN_MM) {
      const intrusion = GUTTER_MIN_MM - el.geometry.x;
      warnings.push({
        elementId: el.id,
        pageId: page.id,
        severity: "warning",
        rule: "gutter-safety",
        message: `Element is ${intrusion.toFixed(1)}mm inside the gutter zone (${GUTTER_MIN_MM}mm inner margin).`,
      });
    }

    // Image DPI check (approximate: compare element mm size to image natural size if available)
    if (isImage(el) && el.src) {
      // We can't check DPI without loading the image, but flag very small elements
      // that are likely stretched beyond their resolution
      const printWidthIn = el.geometry.width / 25.4;
      const printHeightIn = el.geometry.height / 25.4;
      // For now, just flag if the image covers more than half the page
      // Actual DPI checking would require image metadata
      if (printWidthIn > 5 && printHeightIn > 5) {
        warnings.push({
          elementId: el.id,
          pageId: page.id,
          severity: "warning",
          rule: "image-dpi",
          message: `Large image (${printWidthIn.toFixed(1)}" x ${printHeightIn.toFixed(1)}"). Verify source is at least ${MIN_DPI} DPI.`,
        });
      }
    }

    // Overflow: element extends beyond page bounds
    const rightEdge = el.geometry.x + el.geometry.width;
    const bottomEdge = el.geometry.y + el.geometry.height;
    if (rightEdge > page.pageSize.width || bottomEdge > page.pageSize.height || el.geometry.x < 0 || el.geometry.y < 0) {
      warnings.push({
        elementId: el.id,
        pageId: page.id,
        severity: "warning",
        rule: "overflow",
        message: `Element extends beyond page bounds. Content may be clipped in print.`,
      });
    }
  }

  // Check for required copyright on song pages
  if (page.templateId === "song-reprint" || page.templateId === "song") {
    const hasCopyright = page.elements.some(
      (el) => isText(el) && el.geometry.y >= 190 && el.content.length > 0,
    );
    if (!hasCopyright) {
      warnings.push({
        elementId: null,
        pageId: page.id,
        severity: "error",
        rule: "missing-copyright",
        message: "Song page is missing a copyright footer. Required by reprint license.",
      });
    }
  }

  return warnings;
}

export function validateDocument(pages: EditorPage[]): ValidationWarning[] {
  return pages.flatMap(validatePage);
}
