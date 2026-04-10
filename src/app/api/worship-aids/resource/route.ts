/**
 * GET /api/worship-aids/resource?path=ENCODED_PATH
 * Serves local resource files (GIF, TIFF, PNG, PDF) for the worship-aid preview.
 * Admin-only. Path is validated against an allowlist of prefixes.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { verifyAdmin } from "@/lib/admin";

export const runtime = "nodejs";

const ALLOWED_PREFIXES = [
  "/Users/jeffreybonilla/Desktop/OCP Fresh Resource Files/",
  "/Users/jeffreybonilla/St Monica Dropbox/",
];

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
};

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get("path");

  if (!rawPath) {
    return NextResponse.json({ error: "path query param required" }, { status: 400 });
  }

  // Security: reject path traversal
  if (rawPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  // Security: must match an allowed prefix
  const isAllowed = ALLOWED_PREFIXES.some((prefix) => rawPath.startsWith(prefix));
  if (!isAllowed) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }

  if (!fs.existsSync(rawPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(rawPath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  try {
    const data = fs.readFileSync(rawPath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Read error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
