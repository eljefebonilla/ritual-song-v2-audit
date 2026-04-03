import { NextRequest, NextResponse } from "next/server";
import {
  ConversationRuntime,
  LayeredConfig,
  PermissionPolicy,
  DEFAULT_PERMISSION_RULES,
  SkillLoader,
} from "@/runtime";
import { createRecommendationTools } from "@/tools/recommendation";
import type { ToolDefinition } from "@/runtime/types";

/**
 * POST /api/funeral/chat
 * Body: { messages: { role: string, content: string }[] }
 * Returns: { reply: string, usage?: { toolCalls, totalTokens } }
 *
 * Runtime-powered AI chat for funeral music planning.
 * Upgraded from raw OpenRouter call to full ConversationRuntime stack:
 *  1. ConversationRuntime — multi-turn orchestration
 *  2. PermissionPolicy — default rules
 *  3. MCP-style tools — recommendation tools for song suggestions
 *  4. SessionCompactor — long session support
 *  5. SkillLoader — loads funeral-planner skill dynamically
 *  6. LayeredConfig — parish-scoped defaults
 */
export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI not configured" },
      { status: 500 }
    );
  }

  // --- Pattern 6: LayeredConfig ---
  const config = LayeredConfig.forContext(
    { maxTokens: 128_000, compactionThreshold: 0.7 }
  );

  // --- Pattern 2: PermissionPolicy ---
  const permissions = new PermissionPolicy("allow");
  permissions.setRules(DEFAULT_PERMISSION_RULES);
  permissions.setPrompter(async () => true);

  // --- Pattern 3: MCP-style tools ---
  const tools = new Map<string, ToolDefinition>();
  for (const tool of createRecommendationTools()) {
    tools.set(tool.name, tool);
  }

  // --- Pattern 5: SkillLoader ---
  const skillLoader = new SkillLoader();
  const funeralPlanner = await skillLoader.load("funeral-planner");

  // --- Pattern 1: ConversationRuntime ---
  const runtime = new ConversationRuntime(
    config,
    permissions,
    tools,
    funeralPlanner.instructions || ""
  );

  // Replay message history into runtime for context
  for (const msg of messages.slice(0, -1)) {
    if (msg.role === "user") runtime.addUserTurn(msg.content);
    else if (msg.role === "assistant") runtime.addAssistantTurn(msg.content);
  }

  // --- Pattern 4: SessionCompactor (automatic via runtime) ---
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
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `AI request failed: ${text}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || "I'm not sure how to answer that.";

  // Track the assistant response in the runtime
  runtime.addAssistantTurn(reply);

  return NextResponse.json({ reply });
}
