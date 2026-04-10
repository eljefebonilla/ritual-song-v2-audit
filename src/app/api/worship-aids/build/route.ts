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

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let config: WorshipAidConfig;
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

  // Apply defaults for optional fields
  const fullConfig: WorshipAidConfig = {
    ...config,
    parishName: config.parishName ?? "St. Monica Catholic Community",
    includeReadings: config.includeReadings ?? true,
    includeMusicalNotation: config.includeMusicalNotation ?? true,
    pageSize: config.pageSize ?? "half-letter",
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
