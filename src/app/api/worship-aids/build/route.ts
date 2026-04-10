/**
 * POST /api/worship-aids/build
 * Accepts a WorshipAidConfig, builds and returns a WorshipAid with page list.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { buildPages } from "@/lib/worship-aid/build-pages";
import type { WorshipAidConfig } from "@/lib/worship-aid/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_PARISH_ID = "st-monica";

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let config: Partial<WorshipAidConfig>;
  try {
    config = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!config.occasionId || !config.ensembleId) {
    return NextResponse.json(
      { error: "occasionId and ensembleId are required" },
      { status: 400 }
    );
  }

  const fullConfig: WorshipAidConfig = {
    occasionId: config.occasionId,
    ensembleId: config.ensembleId,
    parishId: config.parishId ?? DEFAULT_PARISH_ID,
    includeReadings: config.includeReadings ?? true,
    layout: config.layout ?? "fit-page",
  };

  try {
    const worshipAid = await buildPages(fullConfig);
    return NextResponse.json(worshipAid);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
