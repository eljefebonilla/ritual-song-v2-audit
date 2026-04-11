import { NextResponse } from "next/server";
import logos from "@/data/parish-logos.json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ logos });
}
