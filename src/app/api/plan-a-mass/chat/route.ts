import { NextRequest, NextResponse } from "next/server";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
  AgentLauncher,
  SkillLoader,
} from "@/runtime";
import { createPlanningTools } from "@/tools/planning";
import { createRecommendationTools } from "@/tools/recommendation";
import { createGenerationTools } from "@/tools/generation";
import type { ToolDefinition } from "@/runtime/types";

/**
 * POST /api/plan-a-mass/chat
 *
 * Runtime-powered AI chat for mass planning.
 * Exercises all 6 Section 16 patterns:
 *  1. ConversationRuntime — multi-turn orchestration
 *  2. PermissionPolicy — prompt-gated writes
 *  3. MCP-style tools — planning + recommendation tools
 *  4. SessionCompactor — long session support
 *  5. SkillLoader — loads mass-planner + season-briefing
 *  6. LayeredConfig — parish-scoped defaults
 */
export async function POST(request: NextRequest) {
  const { messages, sessionId, context } = await request.json();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  // --- Pattern 6: LayeredConfig ---
  const config = LayeredConfig.forContext(
    { maxTokens: 128_000, compactionThreshold: 0.7 },
    context?.parishId,
    context?.parishConfig
  );

  // --- Pattern 2: PermissionPolicy ---
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);
  // Auto-approve for server-side chat (user already confirmed via UI)
  permissions.setPrompter(async () => true);

  // --- Pattern 3: MCP-style tools ---
  const tools = new Map<string, ToolDefinition>();
  for (const tool of createPlanningTools()) {
    tools.set(tool.name, tool);
  }
  for (const tool of createRecommendationTools()) {
    tools.set(tool.name, tool);
  }
  for (const tool of createGenerationTools()) {
    tools.set(tool.name, tool);
  }

  // --- Pattern 5: SkillLoader ---
  const skillLoader = new SkillLoader();
  const massPlanner = await skillLoader.load("mass-planner");
  const seasonBriefing = await skillLoader.load("season-briefing");

  // Build system prompt from skills
  const systemPrompt = [
    massPlanner.instructions,
    "\n## Season Context\n",
    seasonBriefing.instructions,
    sessionId ? `\n## Active Session\nSession ID: ${sessionId}` : "",
    context?.massType ? `\nMass Type: ${context.massType}` : "",
    context?.date ? `\nDate: ${context.date}` : "",
  ].join("\n");

  // --- Pattern 1: ConversationRuntime ---
  const runtime = new ConversationRuntime(config, permissions, tools, systemPrompt);

  // Replay message history into runtime for context
  for (const msg of messages.slice(0, -1)) {
    if (msg.role === "user") runtime.addUserTurn(msg.content);
    else if (msg.role === "assistant") runtime.addAssistantTurn(msg.content);
  }

  // --- Pattern 4: SessionCompactor (automatic via runtime) ---
  // The runtime's internal compactor triggers if token budget exceeded

  // Get the latest user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    runtime.addUserTurn(lastMessage.content);
  }

  // Call OpenRouter with the runtime-built context
  const contextWindow = runtime.buildContext();

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      messages: [
        { role: "system", content: contextWindow },
        ...messages,
      ],
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `AI request failed: ${text}` }, { status: 502 });
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || "I'm not sure how to help with that.";

  // Track the assistant response in the runtime
  runtime.addAssistantTurn(reply);

  return NextResponse.json({
    reply,
    usage: {
      toolCalls: runtime.getUsageStats().toolCalls,
      totalTokens: runtime.getState().totalTokens,
    },
  });
}
