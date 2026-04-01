/**
 * Conversation Runtime — The Central Orchestrator
 * Ref: DESIGN-SPEC-v2.md Section 16.1 Pattern 1
 *
 * Manages full user → assistant → tool → result loops with turn
 * summaries, usage tracking, and multi-turn reasoning. This is the
 * core that ties config, permissions, compaction, skills, and tools
 * together into a single execution engine.
 *
 * NOT a chatbot. It's a structured orchestration layer for complex
 * multi-step operations: recommendation refinement, Plan a Mass wizard,
 * SMS cascades, practice session management.
 */

import { randomUUID } from "crypto";
import type {
  ConversationState,
  Turn,
  ToolCall,
  ToolResult,
  ToolDefinition,
  RuntimeContext,
} from "./types";
import { LayeredConfig } from "./config";
import { PermissionPolicy } from "./permissions";
import { SessionCompactor, estimateTokens } from "./compaction";

export class ConversationRuntime {
  private state: ConversationState;
  private tools: Map<string, ToolDefinition>;
  private config: LayeredConfig;
  private permissions: PermissionPolicy;
  private compactor: SessionCompactor;
  private systemPrompt: string;

  // Usage tracking
  private toolCallCount = 0;
  private totalDurationMs = 0;

  constructor(
    config: LayeredConfig,
    permissions: PermissionPolicy,
    tools: Map<string, ToolDefinition>,
    systemPrompt: string = ""
  ) {
    this.config = config;
    this.permissions = permissions;
    this.tools = tools;
    this.systemPrompt = systemPrompt;

    const resolved = config.resolve();
    this.compactor = new SessionCompactor({
      maxTokens: resolved.maxTokens,
      threshold: resolved.compactionThreshold,
    });

    this.state = {
      id: randomUUID(),
      turns: [],
      summaries: [],
      totalTokens: estimateTokens(systemPrompt),
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // ---------------------------------------------------------------------------
  // Core turn management
  // ---------------------------------------------------------------------------

  /**
   * Add a user turn to the conversation.
   */
  addUserTurn(content: string): Turn {
    return this.addTurn("user", content);
  }

  /**
   * Add an assistant turn to the conversation.
   */
  addAssistantTurn(content: string): Turn {
    return this.addTurn("assistant", content);
  }

  /**
   * Execute a tool call with permission checks.
   * Returns the tool result or throws if denied/not found.
   */
  async executeTool(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      const error = `Tool "${call.name}" not registered. Available: ${Array.from(this.tools.keys()).join(", ")}`;
      this.addTurn("tool", error, call.name);
      return { name: call.name, output: null, error, durationMs: 0 };
    }

    // Permission check
    const decision = await this.permissions.check(call.name, call.args);
    if (!decision.allowed) {
      const error = `Permission denied for "${call.name}": ${decision.reason}`;
      this.addTurn("tool", error, call.name);
      return { name: call.name, output: null, error, durationMs: 0 };
    }

    // Build runtime context
    const resolved = this.config.resolve();
    const ctx: RuntimeContext = {
      config: resolved,
      conversationId: this.state.id,
      parishId: resolved.parishId,
      userId: resolved.userId,
      isAdmin: this.state.metadata.isAdmin === true,
    };

    // Execute
    const startTime = Date.now();
    let output: unknown;
    let error: string | undefined;

    try {
      output = await tool.handler(call.args, ctx);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - startTime;
    this.toolCallCount++;
    this.totalDurationMs += durationMs;

    // Record the tool turn
    const content = error ?? (typeof output === "string" ? output : JSON.stringify(output));
    this.addTurn("tool", content, call.name, output);

    return { name: call.name, output, error, durationMs };
  }

  /**
   * Execute a sequence of tool calls. Stops on first error if stopOnError is true.
   */
  async executeToolSequence(
    calls: ToolCall[],
    stopOnError = false
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of calls) {
      const result = await this.executeTool(call);
      results.push(result);
      if (stopOnError && result.error) break;
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Compaction
  // ---------------------------------------------------------------------------

  /**
   * Compact the conversation if it exceeds the token threshold.
   */
  async compact(): Promise<boolean> {
    if (!this.compactor.needsCompaction(this.state)) {
      return false;
    }
    this.state = await this.compactor.compact(this.state);
    return true;
  }

  /**
   * Build the full context string for this conversation.
   * Includes system prompt + summarized history + recent turns.
   */
  buildContext(): string {
    const parts: string[] = [];
    if (this.systemPrompt) {
      parts.push(`## System\n${this.systemPrompt}`);
    }
    parts.push(this.compactor.buildContext(this.state));
    return parts.join("\n\n");
  }

  // ---------------------------------------------------------------------------
  // State access
  // ---------------------------------------------------------------------------

  getState(): Readonly<ConversationState> {
    return this.state;
  }

  getConversationId(): string {
    return this.state.id;
  }

  getTotalTokens(): number {
    return this.state.totalTokens;
  }

  getUsageStats(): { toolCalls: number; totalDurationMs: number; totalTokens: number } {
    return {
      toolCalls: this.toolCallCount,
      totalDurationMs: this.totalDurationMs,
      totalTokens: this.state.totalTokens,
    };
  }

  setMetadata(key: string, value: unknown): void {
    this.state.metadata[key] = value;
    this.state.updatedAt = Date.now();
  }

  /**
   * Register an additional tool at runtime.
   */
  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * List available tool names.
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private addTurn(
    role: Turn["role"],
    content: string,
    toolName?: string,
    toolResult?: unknown
  ): Turn {
    const turn: Turn = {
      id: randomUUID(),
      role,
      content,
      toolName,
      toolResult,
      timestamp: Date.now(),
      tokenEstimate: estimateTokens(content),
    };

    this.state.turns.push(turn);
    this.state.totalTokens += turn.tokenEstimate;
    this.state.updatedAt = Date.now();

    return turn;
  }
}
