import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWorshipAidPdf } from "@/lib/generators/worship-aid-generator";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate/worship-aid
 * Body: { massEventId, parishId }
 * Returns: { success, pdfUrl, storagePath, warnings }
 */
export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Parse body
  const body = await request.json();
  const { massEventId, parishId } = body;

  if (!massEventId || !parishId) {
    return NextResponse.json(
      { error: "massEventId and parishId are required" },
      { status: 400 }
    );
  }

  // Generate
  const result = await generateWorshipAidPdf({ massEventId, parishId });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, warnings: result.warnings },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
