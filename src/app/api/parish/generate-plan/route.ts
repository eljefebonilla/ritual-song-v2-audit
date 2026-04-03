import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
} from "@/runtime";
import { createOnboardingTools } from "@/tools/onboarding";
import type { ToolDefinition } from "@/runtime/types";

/**
 * POST /api/parish/generate-plan — Generate the 3-year lectionary plan
 * Body: { parishId }
 */
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { parishId } = await request.json();
  if (!parishId) {
    return NextResponse.json({ error: "parishId required" }, { status: 400 });
  }

  const config = LayeredConfig.forContext({});
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);
  permissions.setPrompter(async () => true);

  const tools = new Map<string, ToolDefinition>();
  for (const tool of createOnboardingTools()) {
    tools.set(tool.name, tool);
  }

  const runtime = new ConversationRuntime(config, permissions, tools);
  runtime.setMetadata("isAdmin", true);

  const result = await runtime.executeTool({
    name: "onboarding.generatePlan",
    args: { parishId, cycles: 3 },
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.output);
}
