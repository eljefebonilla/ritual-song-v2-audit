/**
 * Generation Tool — MCP-style tool server for PDF generation
 * Ref: DESIGN-SPEC-v2.md Section 16
 *
 * Registers tool handlers that the ConversationRuntime can invoke:
 * - generation.generateSetlist: Generate a setlist/menu PDF
 * - generation.generateWorshipAid: Generate a worship aid PDF
 * - generation.checkCompleteness: Check if a setlist is ready for generation
 * - generation.getStatus: Get generation status for a setlist
 * - generation.generateMobileLink: Create a signed mobile worship aid URL
 */

import type { ToolDefinition } from "@/runtime/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSetlistPdf } from "@/lib/generators/setlist-generator";
import { generateWorshipAidPdf } from "@/lib/generators/worship-aid-generator";
import {
  isSetlistComplete,
  getMissingPositions,
  computeSetlistHash,
} from "@/lib/generators/completeness";
import { generateSignedSlug } from "@/lib/generators/slug-signing";
import { checkRateLimit } from "@/lib/generators/rate-limiter";
import type { SetlistSongRow } from "@/lib/booking-types";

export function createGenerationTools(): ToolDefinition[] {
  return [
    {
      name: "generation.generateSetlist",
      description:
        "Generate a branded setlist/menu PDF for a mass event. Returns a download URL. Requires a saved setlist with songs assigned.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { massEventId, parishId } = args as {
          massEventId: string;
          parishId: string;
        };

        const rateCheck = checkRateLimit(`gen:${parishId}`);
        if (!rateCheck.allowed) {
          return { error: "Rate limit exceeded (10/hour). Try again later." };
        }

        const result = await generateSetlistPdf({ massEventId, parishId });
        return result;
      },
    },
    {
      name: "generation.generateWorshipAid",
      description:
        "Generate a worship aid PDF with cover page, readings, and sheet music reprints. Returns a download URL. Uses the hybrid Puppeteer + pdf-lib pipeline.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { massEventId, parishId } = args as {
          massEventId: string;
          parishId: string;
        };

        const rateCheck = checkRateLimit(`gen:${parishId}`);
        if (!rateCheck.allowed) {
          return { error: "Rate limit exceeded (10/hour). Try again later." };
        }

        const result = await generateWorshipAidPdf({ massEventId, parishId });
        return result;
      },
    },
    {
      name: "generation.checkCompleteness",
      description:
        "Check if a setlist has all required positions filled (gathering, psalm, offertory, communion, sending). Returns completeness status and missing positions.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { setlistId } = args as { setlistId: string };
        const supabase = createAdminClient();

        const { data: setlist } = await supabase
          .from("setlists")
          .select("songs")
          .eq("id", setlistId)
          .single();

        if (!setlist) return { error: "Setlist not found" };

        const songs = (setlist.songs || []) as SetlistSongRow[];
        const complete = isSetlistComplete(songs);
        const missing = getMissingPositions(songs);

        return { complete, missing, hash: computeSetlistHash(songs) };
      },
    },
    {
      name: "generation.getStatus",
      description:
        "Get the current generation status for a setlist (idle, generating, ready, outdated, failed). Includes PDF URLs if ready.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { setlistId } = args as { setlistId: string };
        const supabase = createAdminClient();

        const { data } = await supabase
          .from("setlists")
          .select(
            "generation_status, generated_at, setlist_pdf_url, worship_aid_pdf_url, generation_error"
          )
          .eq("id", setlistId)
          .single();

        if (!data) return { error: "Setlist not found" };
        return data;
      },
    },
    {
      name: "generation.generateMobileLink",
      description:
        "Create a time-limited, HMAC-signed mobile worship aid URL for an occasion. Valid for 7 days around the event date. No login required for assembly members.",
      permissionLevel: "allow",
      handler: async (args) => {
        const { parishId, occasionCode } = args as {
          parishId: string;
          occasionCode: string;
        };
        const supabase = createAdminClient();

        const { data: parish } = await supabase
          .from("parishes")
          .select("name")
          .eq("id", parishId)
          .single();

        if (!parish) return { error: "Parish not found" };

        const parishSlug = parish.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        const slug = generateSignedSlug(parishSlug, occasionCode);
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://stmonica-music-ministry.vercel.app";

        return { slug, url: `${appUrl}/wa/${slug}` };
      },
    },
  ];
}
