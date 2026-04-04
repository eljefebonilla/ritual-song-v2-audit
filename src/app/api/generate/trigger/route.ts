import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSetlistComplete, computeSetlistHash } from "@/lib/generators/completeness";
import { generateSetlistPdf } from "@/lib/generators/setlist-generator";
import { generateWorshipAidPdf } from "@/lib/generators/worship-aid-generator";
import { checkRateLimit } from "@/lib/generators/rate-limiter";
import type { SetlistSongRow } from "@/lib/booking-types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/generate/trigger
 * Body: { setlistId, parishId }
 *
 * Called after a setlist save. Checks completeness, skips if unchanged,
 * then generates both setlist and worship aid PDFs.
 * Returns immediately with status; generation runs inline (within maxDuration).
 */
export async function POST(request: NextRequest) {
  // Auth check
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const { setlistId, parishId } = body;

  if (!setlistId || !parishId) {
    return NextResponse.json(
      { error: "setlistId and parishId are required" },
      { status: 400 }
    );
  }

  // Rate limit: 10 generations per hour per parish
  const rateCheck = checkRateLimit(`gen:${parishId}`);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later.", remaining: 0 },
      { status: 429 }
    );
  }

  const supabase = createAdminClient();

  // Fetch setlist
  const { data: setlist, error: fetchError } = await supabase
    .from("setlists")
    .select("id, mass_event_id, songs, content_hash, generation_status")
    .eq("id", setlistId)
    .single();

  if (fetchError || !setlist) {
    return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
  }

  const songRows = (setlist.songs || []) as SetlistSongRow[];

  // Check completeness
  if (!isSetlistComplete(songRows)) {
    return NextResponse.json({
      triggered: false,
      reason: "incomplete",
    });
  }

  // Check if content has changed since last generation
  const newHash = computeSetlistHash(songRows);
  if (setlist.content_hash === newHash && setlist.generation_status === "ready") {
    return NextResponse.json({
      triggered: false,
      reason: "unchanged",
    });
  }

  // Mark as generating
  await supabase
    .from("setlists")
    .update({
      generation_status: "generating",
      generation_error: null,
    })
    .eq("id", setlistId);

  // Generate both PDFs
  try {
    const [setlistResult, worshipAidResult] = await Promise.all([
      generateSetlistPdf({ massEventId: setlist.mass_event_id, parishId }),
      generateWorshipAidPdf({ massEventId: setlist.mass_event_id, parishId }),
    ]);

    const warnings = [
      ...setlistResult.warnings,
      ...worshipAidResult.warnings,
    ];

    if (!setlistResult.success || !worshipAidResult.success) {
      const errors = [
        setlistResult.error,
        worshipAidResult.error,
      ].filter(Boolean).join("; ");

      await supabase
        .from("setlists")
        .update({
          generation_status: "failed",
          generation_error: errors,
          content_hash: newHash,
        })
        .eq("id", setlistId);

      return NextResponse.json({
        triggered: true,
        success: false,
        error: errors,
        warnings,
      });
    }

    // Update setlist with results
    await supabase
      .from("setlists")
      .update({
        generation_status: "ready",
        generated_at: new Date().toISOString(),
        setlist_pdf_path: setlistResult.storagePath,
        setlist_pdf_url: setlistResult.pdfUrl,
        worship_aid_pdf_path: worshipAidResult.storagePath,
        worship_aid_pdf_url: worshipAidResult.pdfUrl,
        generation_error: null,
        content_hash: newHash,
      })
      .eq("id", setlistId);

    return NextResponse.json({
      triggered: true,
      success: true,
      setlistPdfUrl: setlistResult.pdfUrl,
      worshipAidPdfUrl: worshipAidResult.pdfUrl,
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown generation error";

    await supabase
      .from("setlists")
      .update({
        generation_status: "failed",
        generation_error: message,
        content_hash: newHash,
      })
      .eq("id", setlistId);

    return NextResponse.json({
      triggered: true,
      success: false,
      error: message,
    }, { status: 500 });
  }
}

/**
 * GET /api/generate/trigger?setlistId=xxx
 * Poll generation status.
 */
export async function GET(request: NextRequest) {
  const userSupabase = await createClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const setlistId = request.nextUrl.searchParams.get("setlistId");
  if (!setlistId) {
    return NextResponse.json({ error: "setlistId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("setlists")
    .select("generation_status, generated_at, setlist_pdf_url, worship_aid_pdf_url, generation_error")
    .eq("id", setlistId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Setlist not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
