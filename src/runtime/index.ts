/**
 * Ritual Song Intelligent Agent Runtime — Main Exports
 * Ref: DESIGN-SPEC-v2.md Section 16
 *
 * Usage:
 *   import { ConversationRuntime, LayeredConfig, PermissionPolicy } from "@/runtime";
 *   import { createRecommendationTools } from "@/tools/recommendation";
 *
 *   const config = LayeredConfig.forContext(globalValues, parishId, parishValues);
 *   const permissions = new PermissionPolicy("allow");
 *   permissions.setRules(DEFAULT_PERMISSION_RULES);
 *
 *   const tools = new Map();
 *   for (const tool of createRecommendationTools()) {
 *     tools.set(tool.name, tool);
 *   }
 *
 *   const runtime = new ConversationRuntime(config, permissions, tools);
 *   const result = await runtime.executeTool({
 *     name: "recommendation.score",
 *     args: { occasionId: "palm-sunday-c", position: "gathering", ... }
 *   });
 */

// Core runtime
export { ConversationRuntime } from "./conversation";
export { LayeredConfig } from "./config";
export { PermissionPolicy, DEFAULT_PERMISSION_RULES } from "./permissions";
export { SessionCompactor, estimateTokens } from "./compaction";
export { SkillLoader } from "./skill";
export { AgentLauncher } from "./agent";

// Types
export type {
  // Conversation
  Turn,
  TurnRole,
  TurnSummary,
  ConversationState,
  ToolCall,
  ToolResult,
  ToolHandler,
  ToolDefinition,
  // Permissions
  PermissionMode,
  PermissionRule,
  PermissionDecision,
  PermissionPrompter,
  // Config
  ConfigScope,
  ConfigLayer,
  ToolServerDefinition,
  RuntimeConfig,
  RecommendationWeights,
  // Skills & Agents
  SkillDefinition,
  AgentDefinition,
  AgentHandoff,
  // Context
  RuntimeContext,
} from "./types";

export { DEFAULT_CONFIG, DEFAULT_RECOMMENDATION_WEIGHTS } from "./types";
