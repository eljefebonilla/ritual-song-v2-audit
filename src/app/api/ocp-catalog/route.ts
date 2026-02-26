import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CATALOG_PATH = path.join(
  process.cwd(),
  "src/data/ocp-bb-catalog.json"
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(body, null, 2));
    return NextResponse.json(
      {
        success: true,
        count: Array.isArray(body) ? body.length : Object.keys(body).length,
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 500, headers: corsHeaders }
    );
  }
}
