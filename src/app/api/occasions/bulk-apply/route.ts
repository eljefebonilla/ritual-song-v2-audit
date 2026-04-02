import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOccasion, getAllOccasions } from "@/lib/data";

/**
 * POST /api/occasions/bulk-apply
 * Apply a song to a position across multiple occasions in a season or all cycles.
 * Body: { occasionId, position, title, composer, scope: "season" | "all", ensembleId }
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { occasionId, position, title, composer, scope, ensembleId } = body;

  if (!occasionId || !position || !title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const sourceOccasion = getOccasion(occasionId);
  if (!sourceOccasion) {
    return NextResponse.json({ error: "Occasion not found" }, { status: 404 });
  }

  // Find all occasions to apply to
  const allOccasions = getAllOccasions();
  const targetIds: string[] = [];

  for (const occ of allOccasions) {
    if (scope === "season") {
      if (occ.season === sourceOccasion.season) {
        targetIds.push(occ.id);
      }
    } else if (scope === "all") {
      // All occasions in the same season name across all year cycles
      if (occ.season === sourceOccasion.season) {
        targetIds.push(occ.id);
      }
    }
  }

  // Apply via Supabase music_plan_overrides
  const supabase = createAdminClient();
  let applied = 0;

  for (const targetId of targetIds) {
    const { data: existing } = await supabase
      .from("music_plan_overrides")
      .select("id, overrides")
      .eq("occasion_id", targetId)
      .eq("ensemble_id", ensembleId)
      .single();

    const overrides = (existing?.overrides as Record<string, unknown>) || {};
    overrides[position] = { title, composer: composer || "" };

    if (existing) {
      await supabase
        .from("music_plan_overrides")
        .update({ overrides })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("music_plan_overrides")
        .insert({
          occasion_id: targetId,
          ensemble_id: ensembleId,
          overrides,
        });
    }
    applied++;
  }

  return NextResponse.json({ applied, total: targetIds.length });
}
