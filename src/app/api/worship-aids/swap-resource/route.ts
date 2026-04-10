/**
 * POST /api/worship-aids/swap-resource
 * Returns all available resources for a given songId from song_resources_v2.
 * Used by the Swap Reprint modal in the worship aid builder.
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface ResourceRow {
  id: string;
  type: string;
  tags: string[];
  storage_path: string | null;
  file_path: string | null;
  value: string | null;
}

interface ResourceOption {
  id: string;
  type: string;
  tags: string[];
  storagePath: string | null;
  previewUrl: string | null;
  label: string;
}

function buildPreviewUrl(row: ResourceRow): string | null {
  const path = row.storage_path ?? row.file_path;
  if (!path) return null;

  // Supabase storage resources
  if (row.storage_path) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    return `${base}/storage/v1/object/public/song-resources/${row.storage_path}`;
  }

  // Local filesystem resources (served via the resource route)
  if (row.file_path) {
    return `/api/worship-aids/resource?path=${encodeURIComponent(row.file_path)}`;
  }

  return null;
}

function buildLabel(row: ResourceRow): string {
  const tags = Array.isArray(row.tags) ? row.tags.join(", ") : "";
  const path = row.storage_path ?? row.file_path ?? "";
  const ext = path.split(".").pop()?.toUpperCase() ?? "";
  return `${row.type}${tags ? ` [${tags}]` : ""}${ext ? ` — ${ext}` : ""}`;
}

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { songId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.songId) {
    return NextResponse.json({ error: "songId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: resources, error } = await supabase
    .from("song_resources_v2")
    .select("id, type, tags, storage_path, file_path, value")
    .eq("song_id", body.songId)
    .order("type");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const options: ResourceOption[] = (resources ?? []).map((row: ResourceRow) => ({
    id: row.id,
    type: row.type,
    tags: Array.isArray(row.tags) ? row.tags : [],
    storagePath: row.storage_path ?? null,
    previewUrl: buildPreviewUrl(row),
    label: buildLabel(row),
  }));

  return NextResponse.json({ options });
}
