import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
} from "@/runtime";
import { createReminderTools, DEFAULT_STAFFING_CONFIG } from "@/tools/reminder";
import type { ToolDefinition } from "@/runtime/types";
import type { ScanResult, ReminderCandidate, UnderstaffedMass } from "@/tools/reminder/types";

/**
 * GET /api/staffing — Fetch current staffing scan (no sends)
 */
export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const config = LayeredConfig.forContext({});
  const permissions = new PermissionPolicy("allow");
  const tools = new Map<string, ToolDefinition>();
  for (const tool of createReminderTools()) tools.set(tool.name, tool);

  const runtime = new ConversationRuntime(config, permissions, tools);
  const result = await runtime.executeTool({
    name: "reminder.scanUpcoming",
    args: { config: DEFAULT_STAFFING_CONFIG },
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.output);
}

/**
 * POST /api/staffing — Manually trigger reminders or alerts
 * Body: { action: "sendReminders" | "sendAlerts", candidates?, masses? }
 */
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const { action, candidates, masses } = await request.json();

  const config = LayeredConfig.forContext({});
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);
  permissions.setPrompter(async () => true);

  const tools = new Map<string, ToolDefinition>();
  for (const tool of createReminderTools()) tools.set(tool.name, tool);

  const runtime = new ConversationRuntime(config, permissions, tools);
  runtime.setMetadata("isAdmin", true);

  if (action === "sendReminders" && candidates) {
    const result = await runtime.executeTool({
      name: "reminder.sendReminders",
      args: { candidates: candidates as ReminderCandidate[] },
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result.output);
  }

  if (action === "sendAlerts" && masses) {
    const result = await runtime.executeTool({
      name: "reminder.sendUnderstaffedAlert",
      args: { masses: masses as UnderstaffedMass[] },
    });
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result.output);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
