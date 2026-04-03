import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
  SkillLoader,
} from "@/runtime";
import { createOnboardingTools } from "@/tools/onboarding";
import type { ToolDefinition } from "@/runtime/types";
import type { ParishSetupData } from "@/tools/onboarding/types";

/**
 * POST /api/parish/onboard — Create a new parish from onboarding wizard data.
 *
 * Exercises all 6 Section 16 patterns (especially LayeredConfig).
 */
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const setup: ParishSetupData = await request.json();

  // --- Pattern 6: LayeredConfig (the star of this feature) ---
  // Create config with global defaults, then the new parish's values overlay
  const config = LayeredConfig.forContext(
    {
      maxTokens: 128_000,
      compactionThreshold: 0.7,
      repetitionPreference: 5,
    },
    "new-parish",
    {
      repetitionPreference: setup.repetitionPreference,
      musicStyle: setup.musicStyle,
      publishers: setup.publishers,
      hymnals: setup.hymnals,
      weekendMassCount: setup.weekendMassCount,
    }
  );

  // --- Pattern 2: PermissionPolicy ---
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);
  permissions.setPrompter(async () => true);

  // --- Pattern 3: MCP-style Tools ---
  const tools = new Map<string, ToolDefinition>();
  for (const tool of createOnboardingTools()) {
    tools.set(tool.name, tool);
  }

  // --- Pattern 5: SkillLoader ---
  const skillLoader = new SkillLoader();
  const skill = await skillLoader.load("parish-onboarding");

  // --- Pattern 1: ConversationRuntime ---
  const runtime = new ConversationRuntime(
    config,
    permissions,
    tools,
    skill.instructions || ""
  );
  runtime.setMetadata("isAdmin", true);

  // Step 1: Create the parish
  const createResult = await runtime.executeTool({
    name: "onboarding.createParish",
    args: { setup, userId: user.id },
  });

  if (createResult.error) {
    return NextResponse.json({ error: createResult.error }, { status: 500 });
  }

  const { parishId } = createResult.output as { parishId: string };

  // Step 2: Seed favorites
  if (setup.favoriteSongs.length > 0) {
    await runtime.executeTool({
      name: "onboarding.seedFavorites",
      args: { parishId, favorites: setup.favoriteSongs },
    });
  }

  // --- Pattern 4: SessionCompactor --- (tracked internally)
  const usage = runtime.getUsageStats();

  return NextResponse.json({
    parishId,
    status: "in_progress",
    generatePlan: setup.generatePlan,
    usage: { toolCalls: usage.toolCalls, durationMs: usage.totalDurationMs },
  });
}
