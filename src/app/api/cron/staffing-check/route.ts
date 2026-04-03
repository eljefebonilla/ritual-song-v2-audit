import { NextRequest, NextResponse } from "next/server";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
  SkillLoader,
} from "@/runtime";
import { createReminderTools, DEFAULT_STAFFING_CONFIG } from "@/tools/reminder";
import type { ToolDefinition } from "@/runtime/types";
import type { ScanResult } from "@/tools/reminder/types";

/**
 * GET /api/cron/staffing-check
 *
 * Daily cron job (Vercel Cron or manual trigger).
 * 1. Scans upcoming Masses for understaffing
 * 2. Sends musician reminders (7-day and 1-day)
 * 3. Alerts admins about understaffed Masses
 *
 * Exercises all 6 Section 16 patterns:
 *  1. ConversationRuntime — orchestrates tool execution
 *  2. PermissionPolicy — prompt-gated bulk SMS sends
 *  3. MCP-style Tools — reminder.scanUpcoming, .sendReminders, .sendUnderstaffedAlert
 *  4. SessionCompactor — via runtime constructor
 *  5. SkillLoader — loads staffing-monitor skill
 *  6. LayeredConfig — parish-scoped settings for lookahead, reminder days, required roles
 *
 * Protected by CRON_SECRET header in production.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  if (process.env.NODE_ENV === "production") {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // --- Pattern 6: LayeredConfig ---
  const config = LayeredConfig.forContext({
    understaffedLookaheadDays: DEFAULT_STAFFING_CONFIG.understaffedLookaheadDays,
    reminderDaysBefore: DEFAULT_STAFFING_CONFIG.reminderDaysBefore,
    requiredRoles: DEFAULT_STAFFING_CONFIG.requiredRoles,
  });

  // --- Pattern 2: PermissionPolicy ---
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);
  // Auto-approve: this is a cron job, not interactive
  permissions.setPrompter(async () => true);

  // --- Pattern 3: MCP-style Tools ---
  const tools = new Map<string, ToolDefinition>();
  for (const tool of createReminderTools()) {
    tools.set(tool.name, tool);
  }

  // --- Pattern 5: SkillLoader ---
  const skillLoader = new SkillLoader();
  const skill = await skillLoader.load("staffing-monitor");

  // --- Pattern 1: ConversationRuntime ---
  const runtime = new ConversationRuntime(
    config,
    permissions,
    tools,
    skill.instructions || ""
  );
  runtime.setMetadata("isAdmin", true);

  // Step 1: Scan upcoming Masses
  const scanResult = await runtime.executeTool({
    name: "reminder.scanUpcoming",
    args: {
      config: {
        understaffedLookaheadDays: config.get<number>("understaffedLookaheadDays") ?? 14,
        reminderDaysBefore: config.get<number[]>("reminderDaysBefore") ?? [7, 1],
        requiredRoles: config.get<string[]>("requiredRoles") ?? ["Director", "Cantor", "Piano"],
      },
    },
  });

  if (scanResult.error) {
    return NextResponse.json({ error: scanResult.error }, { status: 500 });
  }

  const scan = scanResult.output as ScanResult;

  // Step 2: Send musician reminders
  let reminderResult = { sent: 0, skipped: 0, errors: 0 };
  if (scan.upcomingReminders.length > 0) {
    const r = await runtime.executeTool({
      name: "reminder.sendReminders",
      args: { candidates: scan.upcomingReminders },
    });
    if (!r.error) {
      reminderResult = r.output as typeof reminderResult;
    }
  }

  // Step 3: Alert admins about understaffed Masses
  let alertResult = { alertsSent: 0 };
  if (scan.understaffedMasses.length > 0) {
    const a = await runtime.executeTool({
      name: "reminder.sendUnderstaffedAlert",
      args: { masses: scan.understaffedMasses },
    });
    if (!a.error) {
      alertResult = a.output as typeof alertResult;
    }
  }

  // --- Pattern 4: SessionCompactor --- (auto-tracked in runtime)
  const usage = runtime.getUsageStats();

  return NextResponse.json({
    scannedAt: scan.scannedAt,
    understaffedMasses: scan.understaffedMasses.length,
    remindersSent: reminderResult.sent,
    remindersSkipped: reminderResult.skipped,
    reminderErrors: reminderResult.errors,
    adminAlertsSent: alertResult.alertsSent,
    runtimeUsage: {
      toolCalls: usage.toolCalls,
      durationMs: usage.totalDurationMs,
    },
  });
}
