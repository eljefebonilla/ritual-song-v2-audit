import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const OCCASIONS_DIR = path.join(process.cwd(), "src/data/occasions");

/**
 * GET /api/occasions/[id]
 * Returns the full occasion JSON for a given occasion ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
    return NextResponse.json(occasion);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
