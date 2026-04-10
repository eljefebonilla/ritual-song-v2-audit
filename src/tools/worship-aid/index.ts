/**
 * Worship Aid Tools — Section 16 tool server registration.
 * Provides three tools: build, render, and list-occasions.
 *
 * Server-side only (uses fs). Do not import in browser code.
 */

import fs from "node:fs";
import path from "node:path";
import { buildPages } from "@/lib/worship-aid/build-pages";
import { renderHtml } from "@/lib/worship-aid/render-html";
import type { ToolDefinition } from "@/runtime/types";
import type { WorshipAidConfig, WorshipAid } from "@/lib/worship-aid/types";

const OCCASIONS_DATA_PATH = path.join(process.cwd(), "src/data/all-occasions.json");

interface OccasionSummary {
  id: string;
  name: string;
  season: string;
  seasonLabel: string;
  nextDate: string | null;
}

function getUpcomingOccasions(weeks = 8): OccasionSummary[] {
  if (!fs.existsSync(OCCASIONS_DATA_PATH)) return [];
  const all = JSON.parse(fs.readFileSync(OCCASIONS_DATA_PATH, "utf-8")) as OccasionSummary[];
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + weeks * 7);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return all
    .filter((o) => o.nextDate && o.nextDate >= todayStr && o.nextDate <= cutoffStr)
    .sort((a, b) => (a.nextDate ?? "").localeCompare(b.nextDate ?? ""));
}

export function createWorshipAidTools(): ToolDefinition[] {
  return [
    {
      name: "worship-aid.build",
      description:
        "Build a worship aid for a given occasion and ensemble. Returns a WorshipAid object with cover, readings, and song pages. Each page includes resolved sheet music resource metadata.",
      permissionLevel: "allow",
      handler: async (args) => {
        const config = args as unknown as WorshipAidConfig;
        if (!config.occasionId || !config.ensembleId) {
          throw new Error("occasionId and ensembleId are required");
        }
        const fullConfig: WorshipAidConfig = {
          ...config,
          parishName: config.parishName ?? "St. Monica Catholic Community",
          includeReadings: config.includeReadings ?? true,
          includeMusicalNotation: config.includeMusicalNotation ?? true,
          pageSize: config.pageSize ?? "half-letter",
          layout: config.layout ?? "fit-page",
        };
        return buildPages(fullConfig);
      },
    },

    {
      name: "worship-aid.render",
      description:
        "Render a WorshipAid object to a full HTML string using Paged.js. The returned HTML is ready to open in a browser and print as a PDF.",
      permissionLevel: "allow",
      handler: async (args) => {
        const worshipAid = args as unknown as WorshipAid;
        if (!worshipAid?.id || !worshipAid?.config || !Array.isArray(worshipAid?.pages)) {
          throw new Error("A valid WorshipAid object is required");
        }
        return renderHtml(worshipAid);
      },
    },

    {
      name: "worship-aid.list-occasions",
      description:
        "List upcoming occasions available for worship aid building. Returns occasions in the next 8 weeks by default, sorted by date.",
      permissionLevel: "allow",
      handler: async (args) => {
        const weeks = typeof (args as { weeks?: number }).weeks === "number"
          ? (args as { weeks: number }).weeks
          : 8;
        const occasions = getUpcomingOccasions(weeks);
        return {
          occasions,
          count: occasions.length,
        };
      },
    },
  ];
}

export type { WorshipAidConfig, WorshipAid } from "@/lib/worship-aid/types";
