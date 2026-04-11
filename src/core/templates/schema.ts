/**
 * Template schema: defines the structure of reusable page templates.
 * Each template is a factory that produces an EditorPage with pre-positioned elements.
 */

import type { PageElement, EditorPage, PageSize } from "@/types/schema";

export type TemplateId =
  | "cover"
  | "song-reprint"
  | "two-up-songs"
  | "readings"
  | "compound-word"
  | "announcements"
  | "back-cover";

export interface TemplateSlot {
  id: string;
  label: string;
  elementType: PageElement["type"];
  required: boolean;
  placeholder?: string; // Shown when content is empty
  geometry: {
    x: number;       // mm
    y: number;       // mm
    width: number;   // mm
    height: number;  // mm
  };
  defaults: Partial<PageElement>;
}

export interface TemplateDefinition {
  id: TemplateId;
  label: string;
  description: string;
  pageSize: PageSize;
  backgroundColor: string;
  slots: TemplateSlot[];
}

/**
 * Instantiate a template into a concrete EditorPage.
 * Generates unique IDs for all elements.
 */
export function instantiateTemplate(
  template: TemplateDefinition,
  overrides?: Partial<EditorPage>,
): EditorPage {
  const pageId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const elements: PageElement[] = template.slots.map((slot, idx) => {
    const elementId = `${pageId}-el-${idx}`;
    const base = {
      id: elementId,
      type: slot.elementType,
      geometry: { ...slot.geometry, rotation: 0 },
      zIndex: idx,
      locked: false,
      visible: true,
    };

    const el = { ...base, ...slot.defaults } as PageElement;

    // Inject placeholder for required text slots with empty content
    if (slot.required && slot.placeholder && el.type === "text") {
      const textEl = el as import("@/types/schema").TextElement;
      if (!textEl.content) {
        textEl.content = `<span style="color:#A8A29E;font-style:italic">${slot.placeholder}</span>`;
      }
    }

    return el;
  });

  return {
    id: pageId,
    templateId: template.id,
    pageSize: template.pageSize,
    backgroundColor: template.backgroundColor,
    elements,
    ...overrides,
  };
}
