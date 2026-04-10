/**
 * POST /api/worship-aids/rerender-page
 * Re-renders a single page's HTML content after edits (crop, links, giving block).
 * Returns { content: string }.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { renderPageContent } from "@/lib/worship-aid/render-page";
import type { WorshipAidPage } from "@/lib/worship-aid/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let page: WorshipAidPage;
  try {
    page = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = renderPageContent({
    type: page.type === "giving" || page.type === "links" ? "song" : page.type,
    coverData: page.coverData,
    readingData: page.readingData,
    songData: page.songData,
    cropTop: page.cropTop ?? 0,
    customLinks: page.customLinks ?? [],
    givingBlock: page.givingBlock ?? false,
  });

  return NextResponse.json({ content });
}
