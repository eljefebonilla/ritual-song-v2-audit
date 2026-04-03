/**
 * Agent Launcher — Sub-agent launch with handoff metadata
 * Ref: DESIGN-SPEC-v2.md Section 16.1 Pattern 5
 *
 * Agents are specialized sub-runtimes that handle specific domains:
 * recommendation refinement, sub-request cascades, collaborative planning.
 * Each agent gets its own conversation state, tool set, and skills,
 * but can hand off to other agents with full context preservation.
 */

import type {
  AgentDefinition,
  AgentHandoff,
  ConversationState,
  ToolDefinition,
} from "./types";
import { ConversationRuntime } from "./conversation";
import { SkillLoader } from "./skill";
import { PermissionPolicy } from "./permissions";
import { LayeredConfig } from "./config";

// Agent registry
const AGENT_REGISTRY: AgentDefinition[] = [
  {
    name: "recommendation",
    description:
      "Multi-turn song recommendation refinement. Scores songs, explains reasoning, accepts feedback to re-rank.",
    skills: ["season-briefing"],
    tools: ["recommendation.score", "recommendation.list", "recommendation.explain"],
    initialPrompt:
      "You are the song recommendation agent for a Catholic music planning app. Given an occasion with readings and a liturgical slot, suggest the best songs from the parish library. Explain your reasoning. Accept feedback to refine.",
  },
  {
    name: "cascade",
    description:
      "Sub-request SMS cascade executor. Contacts musicians in seniority order to fill open slots.",
    skills: [],
    tools: [
      "cascade.buildCandidateList",
      "cascade.sendSms",
      "cascade.checkResponse",
      "cascade.executeFullCascade",
    ],
    initialPrompt:
      "You are the musician substitute coordinator. When a musician cancels, you contact replacements in order of seniority via SMS, waiting for each response before moving to the next candidate.",
  },
  {
    name: "planning",
    description:
      "Collaborative mass planning orchestrator. Guides users through the Plan a Mass wizard.",
    skills: ["mass-planner", "season-briefing"],
    tools: [
      "planning.createEvent",
      "planning.assignSong",
      "planning.saveNote",
      "planning.inviteCollaborator",
    ],
    initialPrompt:
      "You are the mass planning assistant for a Catholic parish. Guide the user through creating a liturgical event: mass type, date/time, celebrant, readings (daily or custom), music selections with recommendation scoring, personnel assignments, and notification preferences. Support school mass distinctions (upper/lower school) and collaborative editing.",
  },
  {
    name: "onboarding",
    description:
      "Parish setup wizard. Creates the parish, seeds favorites, configures ensembles, generates the 3-year plan.",
    skills: ["parish-onboarding"],
    tools: [
      "onboarding.createParish",
      "onboarding.seedFavorites",
      "onboarding.generatePlan",
    ],
    initialPrompt:
      "You are the parish onboarding assistant. Guide a new music director through setting up their parish: profile, publishers/hymnals, favorite songs, parish personality, mass schedule, ensembles with custom names and colors, repetition preference, and optional 3-year plan auto-generation.",
  },
  {
    name: "reminder",
    description:
      "Proactive staffing monitor. Scans upcoming Masses, detects understaffing, sends musician reminders and admin alerts.",
    skills: ["staffing-monitor"],
    tools: [
      "reminder.scanUpcoming",
      "reminder.sendReminders",
      "reminder.sendUnderstaffedAlert",
    ],
    initialPrompt:
      "You are the staffing monitor for St. Monica Music Ministry. Every day, scan upcoming Masses to detect understaffing (missing Director, Cantor, or Piano). Send reminders to scheduled musicians 7 days and 1 day before. Alert the admin about gaps that need attention.",
  },
  {
    name: "invoice",
    description:
      "Musician history lookup and invoice generator. Queries booking history, calculates rates, generates PDF-ready data.",
    skills: ["invoice-assistant"],
    tools: [
      "invoice.queryHistory",
      "invoice.generateInvoice",
    ],
    initialPrompt:
      "You are the musician payment assistant. Help musicians look up their booking history, filter by date range or ensemble, and generate invoices with their agreed-upon rate. Be precise with dates and amounts.",
  },
];

export class AgentLauncher {
  private registry: Map<string, AgentDefinition> = new Map();
  private activeAgents: Map<string, ConversationRuntime> = new Map();
  private handoffLog: AgentHandoff[] = [];
  private skillLoader: SkillLoader;

  constructor(skillLoader?: SkillLoader) {
    this.skillLoader = skillLoader ?? new SkillLoader();
    for (const agent of AGENT_REGISTRY) {
      this.registry.set(agent.name, agent);
    }
  }

  /**
   * Register a custom agent definition.
   */
  register(definition: AgentDefinition): void {
    this.registry.set(definition.name, definition);
  }

  /**
   * Launch a sub-agent. Creates a new ConversationRuntime scoped to
   * the agent's tools and skills. Optionally seeds with handoff context.
   */
  async launch(
    agentName: string,
    config: LayeredConfig,
    permissions: PermissionPolicy,
    tools: Map<string, ToolDefinition>,
    handoffContext?: Record<string, unknown>
  ): Promise<ConversationRuntime> {
    const definition = this.registry.get(agentName);
    if (!definition) {
      throw new Error(
        `Agent "${agentName}" not found. Available: ${this.listNames().join(", ")}`
      );
    }

    // Filter tools to only those the agent is allowed to use
    const agentTools = new Map<string, ToolDefinition>();
    for (const toolName of definition.tools) {
      const tool = tools.get(toolName);
      if (tool) agentTools.set(toolName, tool);
    }

    // Load agent's skills
    const skillInstructions: string[] = [];
    for (const skillName of definition.skills) {
      const skill = await this.skillLoader.load(skillName);
      if (skill.instructions) {
        skillInstructions.push(skill.instructions);
      }
    }

    // Build the agent's system prompt
    const systemParts = [definition.initialPrompt ?? ""];
    if (skillInstructions.length > 0) {
      systemParts.push("## Loaded Skills");
      systemParts.push(...skillInstructions);
    }
    if (handoffContext) {
      systemParts.push("## Handoff Context");
      systemParts.push(JSON.stringify(handoffContext, null, 2));
    }

    // Create the runtime
    const runtime = new ConversationRuntime(
      config,
      permissions,
      agentTools,
      systemParts.join("\n\n")
    );

    this.activeAgents.set(agentName, runtime);
    return runtime;
  }

  /**
   * Hand off from one agent to another, preserving context.
   */
  async handoff(
    fromAgent: string,
    toAgent: string,
    context: Record<string, unknown>,
    reason: string,
    config: LayeredConfig,
    permissions: PermissionPolicy,
    tools: Map<string, ToolDefinition>
  ): Promise<ConversationRuntime> {
    const handoff: AgentHandoff = {
      fromAgent,
      toAgent,
      context,
      reason,
      timestamp: Date.now(),
    };
    this.handoffLog.push(handoff);

    // Terminate the source agent
    this.activeAgents.delete(fromAgent);

    // Launch the target agent with handoff context
    return this.launch(toAgent, config, permissions, tools, {
      ...context,
      handoffFrom: fromAgent,
      handoffReason: reason,
    });
  }

  /**
   * Get the handoff history.
   */
  getHandoffLog(): AgentHandoff[] {
    return [...this.handoffLog];
  }

  /**
   * List registered agent names.
   */
  listNames(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List active agents.
   */
  listActive(): string[] {
    return Array.from(this.activeAgents.keys());
  }
}
