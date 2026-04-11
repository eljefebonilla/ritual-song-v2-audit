import { NextResponse } from "next/server";
import type { WorshipAidConfig } from "@/lib/worship-aid/types";
import { migrateV1ToV2 } from "@/utils/migrateV1ToV2";

/**
 * POST /api/worship-aids/build-v2
 * Builds a v1 worship aid then immediately migrates to v2 EditorDocument.
 * Returns the v2 document directly so the editor can open without v1 roundtrip.
 */
export async function POST(request: Request) {
  try {
    const config = (await request.json()) as WorshipAidConfig & { season?: string };

    // Call the v1 build endpoint internally
    const origin = request.headers.get("origin") || request.headers.get("host") || "";
    const protocol = origin.startsWith("localhost") ? "http" : "https";
    const baseUrl = origin.startsWith("http") ? origin : `${protocol}://${origin}`;

    const v1Res = await fetch(`${baseUrl}/api/worship-aids/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!v1Res.ok) {
      const data = await v1Res.json();
      return NextResponse.json({ error: data.error ?? "v1 build failed" }, { status: v1Res.status });
    }

    const v1Aid = await v1Res.json();

    // Migrate to v2
    const v2Doc = migrateV1ToV2(v1Aid.pages, {
      occasionId: config.occasionId,
      ensembleId: config.ensembleId,
      season: config.season ?? v1Aid.pages[0]?.coverData?.seasonLabel?.toLowerCase().replace(/\s+/g, "-"),
    });

    return NextResponse.json(v2Doc);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
