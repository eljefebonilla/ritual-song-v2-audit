/**
 * Permission Policy & Safety Layer
 * Ref: DESIGN-SPEC-v2.md Section 16.1 Pattern 2
 *
 * Gates tool execution with Allow / Prompt / Deny modes.
 * Tool-specific overrides let sensitive operations (SMS sends,
 * data deletion, copyright reporting) require explicit confirmation
 * while routine operations (read queries, recommendations) pass through.
 */

import type {
  PermissionMode,
  PermissionRule,
  PermissionDecision,
  PermissionPrompter,
} from "./types";

export class PermissionPolicy {
  private rules: Map<string, PermissionRule> = new Map();
  private defaultMode: PermissionMode;
  private prompter: PermissionPrompter | null = null;

  constructor(defaultMode: PermissionMode = "allow") {
    this.defaultMode = defaultMode;
  }

  /**
   * Set a permission rule for a specific tool.
   */
  setRule(rule: PermissionRule): void {
    this.rules.set(rule.toolName, rule);
  }

  /**
   * Set rules in bulk.
   */
  setRules(rules: PermissionRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.toolName, rule);
    }
  }

  /**
   * Register the interactive prompter function.
   * This is called when a tool requires user confirmation (mode = "prompt").
   * In a web context, this might show a confirmation dialog.
   * In a server context, this might send a push notification and await response.
   */
  setPrompter(prompter: PermissionPrompter): void {
    this.prompter = prompter;
  }

  /**
   * Check whether a tool call is permitted.
   * Returns immediately for allow/deny. Awaits prompter for prompt mode.
   */
  async check(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<PermissionDecision> {
    const rule = this.rules.get(toolName);
    const mode = rule?.mode ?? this.defaultMode;

    if (mode === "allow") {
      return { allowed: true, mode, reason: rule?.reason };
    }

    if (mode === "deny") {
      return {
        allowed: false,
        mode,
        reason: rule?.reason ?? `Tool "${toolName}" is denied by policy`,
      };
    }

    // mode === "prompt"
    if (!this.prompter) {
      // No prompter registered: fail closed
      return {
        allowed: false,
        mode,
        reason: `Tool "${toolName}" requires confirmation but no prompter is available`,
      };
    }

    const userApproved = await this.prompter(toolName, args, rule?.reason);
    return {
      allowed: userApproved,
      mode,
      reason: rule?.reason,
      promptedUser: true,
    };
  }

  /**
   * Get the current mode for a tool.
   */
  getMode(toolName: string): PermissionMode {
    return this.rules.get(toolName)?.mode ?? this.defaultMode;
  }

  /**
   * List all explicit rules.
   */
  listRules(): PermissionRule[] {
    return Array.from(this.rules.values());
  }
}

/**
 * Preconfigured permission rules for Ritual Song v2.0.
 * Sensitive operations require prompting; read operations pass through.
 */
export const DEFAULT_PERMISSION_RULES: PermissionRule[] = [
  // Read operations: always allow
  { toolName: "recommendation.score", mode: "allow" },
  { toolName: "recommendation.list", mode: "allow" },
  { toolName: "config.get", mode: "allow" },
  { toolName: "skill.load", mode: "allow" },

  // Write operations: allow for admins (checked at handler level)
  { toolName: "planning.saveNote", mode: "allow" },
  { toolName: "planning.assignSong", mode: "allow" },

  // Sensitive operations: require confirmation
  {
    toolName: "cascade.sendSms",
    mode: "prompt",
    reason: "This will send an SMS to a real person",
  },
  {
    toolName: "cascade.executeFullCascade",
    mode: "prompt",
    reason: "This will contact multiple musicians via SMS in sequence",
  },
  {
    toolName: "licensing.submitReport",
    mode: "prompt",
    reason: "This will submit a copyright usage report to ONE LICENSE / CCLI",
  },
  {
    toolName: "compliance.deleteDocument",
    mode: "prompt",
    reason: "This will permanently delete a compliance document",
  },

  // Dangerous operations: deny by default
  {
    toolName: "data.bulkDelete",
    mode: "deny",
    reason: "Bulk deletion is disabled in the runtime policy",
  },
];
