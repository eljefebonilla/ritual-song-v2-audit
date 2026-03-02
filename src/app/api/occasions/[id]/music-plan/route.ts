import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/admin";
import fs from "fs";
import path from "path";

const OCCASIONS_DIR = path.join(process.cwd(), "src/data/occasions");

/**
 * PUT /api/occasions/[id]/music-plan
 * Updates a single music plan field for a specific community within an occasion JSON file.
 *
 * Body: {
 *   communityId: string;    // "reflections", "foundations", etc.
 *   field: string;          // "gathering", "psalm", "offertory", etc.
 *   value: unknown;         // SongEntry object, psalm object, etc.
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { communityId, field, value } = body;

  if (!communityId || !field) {
    return NextResponse.json(
      { error: "communityId and field are required" },
      { status: 400 }
    );
  }

  // Read the occasion JSON file
  const filePath = path.join(OCCASIONS_DIR, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: `Occasion ${id} not found` },
      { status: 404 }
    );
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const occasion = JSON.parse(raw);

    // Find or create the music plan for this community
    if (!occasion.musicPlans) {
      occasion.musicPlans = [];
    }

    let plan = occasion.musicPlans.find(
      (p: { communityId: string }) => p.communityId === communityId
    );

    if (!plan) {
      plan = { community: communityId, communityId };
      occasion.musicPlans.push(plan);
    }

    // Update the field
    plan[field] = value;

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(occasion, null, 2), "utf-8");

    revalidatePath(`/occasion/${id}`);

    return NextResponse.json({ success: true, plan });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
