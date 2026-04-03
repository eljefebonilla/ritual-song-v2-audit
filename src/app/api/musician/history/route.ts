import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
} from "@/runtime";
import { createInvoiceTools } from "@/tools/invoice";
import type { ToolDefinition } from "@/runtime/types";

/**
 * GET /api/musician/history
 * Query params:
 *   ?profileId=uuid  — required (admin can query any, musician can query self)
 *   ?from=2026-01-01 — optional date filter
 *   ?to=2026-12-31
 *   ?ensemble=Heritage
 *   ?eventType=mass
 *
 * Uses ConversationRuntime + PermissionPolicy for access control.
 */
export async function GET(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const ensemble = searchParams.get("ensemble");
  const eventType = searchParams.get("eventType");

  if (!profileId) {
    return NextResponse.json({ error: "profileId required" }, { status: 400 });
  }

  // Permission check: only self or admin
  const supabase = createAdminClient();
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = callerProfile?.role === "admin";
  const isSelf = user.id === profileId;

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "You can only view your own history" }, { status: 403 });
  }

  // --- Use runtime for tool execution ---
  const config = LayeredConfig.forContext({});
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);

  const tools = new Map<string, ToolDefinition>();
  for (const tool of createInvoiceTools()) {
    tools.set(tool.name, tool);
  }

  const runtime = new ConversationRuntime(config, permissions, tools);
  runtime.setMetadata("isAdmin", isAdmin);

  const result = await runtime.executeTool({
    name: "invoice.queryHistory",
    args: {
      profileId,
      from: from || undefined,
      to: to || undefined,
      ensemble: ensemble || undefined,
      eventType: eventType || undefined,
    },
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.output);
}

/**
 * POST /api/musician/history — Generate invoice data
 * Body: { profileId, from, to, customRate? }
 */
export async function POST(request: NextRequest) {
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const { profileId, from, to, customRate } = body;

  if (!profileId || !from || !to) {
    return NextResponse.json({ error: "profileId, from, and to are required" }, { status: 400 });
  }

  // Permission check
  const supabase = createAdminClient();
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = callerProfile?.role === "admin";
  const isSelf = user.id === profileId;

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "You can only generate your own invoice" }, { status: 403 });
  }

  // Use runtime with permission-prompted invoice generation
  const config = LayeredConfig.forContext({});
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);
  // Auto-approve: user already clicked the button
  permissions.setPrompter(async () => true);

  const tools = new Map<string, ToolDefinition>();
  for (const tool of createInvoiceTools()) {
    tools.set(tool.name, tool);
  }

  const runtime = new ConversationRuntime(config, permissions, tools);
  runtime.setMetadata("isAdmin", isAdmin);

  const result = await runtime.executeTool({
    name: "invoice.generateInvoice",
    args: { profileId, from, to, customRate },
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result.output);
}
