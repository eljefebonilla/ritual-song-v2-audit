/**
 * Worship Aid Builder v2: Element-based document model.
 * All geometry in mm. All font sizes in pt. All colors as hex strings.
 */

export type ElementType = "text" | "image" | "shape" | "qr" | "divider";

// ── Geometry ──────────────────────────────────────────────────────────────────

export interface Geometry {
  x: number;      // mm from left edge of page
  y: number;      // mm from top edge of page
  width: number;  // mm
  height: number; // mm
  rotation: number; // degrees, 0-360
}

// ── Base element ──────────────────────────────────────────────────────────────

export interface BaseElement {
  id: string;
  type: ElementType;
  geometry: Geometry;
  zIndex: number;
  locked: boolean;
  visible: boolean;
}

// ── Element variants ──────────────────────────────────────────────────────────

export interface TextElement extends BaseElement {
  type: "text";
  content: string;         // HTML string for rich text
  fontSize: number;        // pt
  fontFamily: string;
  fontWeight: string | number;
  color: string;
  textAlign: "left" | "center" | "right" | "justify";
  lineHeight: number;      // multiplier (e.g., 1.35)
  letterSpacing: number;   // em
  textTransform?: "none" | "uppercase" | "small-caps";
}

export interface ImageElement extends BaseElement {
  type: "image";
  src: string;             // URL (Supabase storage or local)
  objectFit: "contain" | "cover" | "fill";
  cropTop: number;         // 0-1 percentage
  cropLeft: number;
  cropWidth: number;       // 0-1 (1 = full width)
  cropHeight: number;
  opacity: number;         // 0-1
}

export interface ShapeElement extends BaseElement {
  type: "shape";
  subType: "rectangle" | "ellipse";
  fill: string;
  stroke: string;
  strokeWidth: number;     // mm
}

export interface QRElement extends BaseElement {
  type: "qr";
  url: string;
  foregroundColor: string;
  backgroundColor: string;
}

export interface DividerElement extends BaseElement {
  type: "divider";
  stroke: string;
  strokeWidth: number;     // mm
  strokeStyle: "solid" | "dashed" | "dotted";
}

export type PageElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | QRElement
  | DividerElement;

// ── Page ──────────────────────────────────────────────────────────────────────

export interface PageSize {
  width: number;   // mm (e.g., 177.8 for 7")
  height: number;  // mm (e.g., 215.9 for 8.5")
  label: string;   // "Half-Letter", "Letter", "Legal", "Tabloid"
}

export const PAGE_SIZES: Record<string, PageSize> = {
  "half-letter": { width: 177.8, height: 215.9, label: "Half-Letter (7×8.5)" },
  "letter-fold": { width: 139.7, height: 215.9, label: "Letter Fold (5.5×8.5)" },
  "legal-fold":  { width: 177.8, height: 215.9, label: "Legal Fold (7×8.5)" },
  "tabloid-tri": { width: 144.0, height: 279.4, label: "Tabloid Tri-fold (5.67×11)" },
};

export interface EditorPage {
  id: string;
  templateId?: string;
  pageSize: PageSize;
  backgroundColor: string;
  elements: PageElement[];
}

// ── Document ──────────────────────────────────────────────────────────────────

export interface EditorDocument {
  id: string;
  metadata: {
    title: string;
    occasionId: string;
    ensembleId: string;
    parishId: string;
    createdAt: string;
    updatedAt: string;
  };
  globalStyles: {
    defaultFontFamily: string;
    defaultFontSize: number;
    defaultColor: string;
    season: string;
  };
  pages: EditorPage[];
}
