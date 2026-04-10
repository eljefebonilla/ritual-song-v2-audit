/**
 * POST /api/worship-aids/render
 * Accepts a WorshipAid object, returns rendered HTML string.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { renderHtml } from "@/lib/worship-aid/render-html";
import type { WorshipAid } from "@/lib/worship-aid/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let worshipAid: WorshipAid;
  try {
    worshipAid = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!worshipAid?.id || !worshipAid?.config || !Array.isArray(worshipAid?.pages)) {
    return NextResponse.json({ error: "Invalid WorshipAid object" }, { status: 400 });
  }

  try {
    const html = renderHtml(worshipAid);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
