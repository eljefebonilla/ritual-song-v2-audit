/**
 * Core types for the Ritual Song intelligent agent runtime.
 * Ref: DESIGN-SPEC-v2.md Section 16 — all six architectural patterns.
 */

// ---------------------------------------------------------------------------
// 16.1.1 — Conversation Runtime types
// ---------------------------------------------------------------------------

export type TurnRole = "user" | "assistant" | "tool" | "system";

export interface Turn {
  id: string;
  role: TurnRole;
  content: string;
  toolName?: string;
  toolResult?: unknown;
  timestamp: number;
  tokenEstimate: number;
}

export interface TurnSummary {
  turnIds: string[];
  summary: string;
  tokenEstimate: number;
}

export interface ConversationState {
  id: string;
  turns: Turn[];
  summaries: TurnSummary[];
  totalTokens: number;
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  output: unknown;
  error?: string;
  durationMs: number;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: RuntimeContext) => Promise<unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  handler: ToolHandler;
  permissionLevel?: PermissionMode;
}

// ---------------------------------------------------------------------------
// 16.1.2 — Permission Policy types
// ---------------------------------------------------------------------------

export type PermissionMode = "allow" | "prompt" | "deny";

export interface PermissionRule {
  toolName: string;
  mode: PermissionMode;
  reason?: string;
}

export interface PermissionDecision {
  allowed: boolean;
  mode: PermissionMode;
  reason?: string;
  promptedUser?: boolean;
}

export type PermissionPrompter = (
  toolName: string,
  args: Record<string, unknown>,
  reason?: string
) => Promise<boolean>;

// ---------------------------------------------------------------------------
// 16.1.6 — Layered Config types
// ---------------------------------------------------------------------------

export type ConfigScope = "global" | "parish" | "user";

export interface ConfigLayer {
  scope: ConfigScope;
  scopeId?: string; // parish ID or user ID
  values: Record<string, unknown>;
}

export interface ToolServerDefinition {
  name: string;
  transport: "stdio" | "remote" | "oauth";
  endpoint?: string;
  authConfig?: {
    type: "oauth" | "api_key" | "none";
    clientId?: string;
    scopes?: string[];
  };
}

export interface RuntimeConfig {
  maxTokens: number;
  compactionThreshold: number; // percentage of maxTokens before compacting
  recommendationWeights: RecommendationWeights;
  repetitionPreference: number; // 1-10, higher = more repetition
  toolServers: ToolServerDefinition[];
  parishId?: string;
  userId?: string;
}

export interface RecommendationWeights {
  scriptureMatch: number;
  topicMatch: number;
  seasonMatch: number;
  functionMatch: number;
  recencyPenalty: number;
  familiarityBoost: number;
  userRankingBoost: number;
  semanticSimilarity: number;
}

// ---------------------------------------------------------------------------
// 16.1.5 — Skill & Agent types
// ---------------------------------------------------------------------------

export interface SkillDefinition {
  name: string;
  description: string;
  instructionPath: string;
  instructions?: string; // loaded content
}

export interface AgentDefinition {
  name: string;
  description: string;
  skills: string[];
  tools: string[];
  initialPrompt?: string;
}

export interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  context: Record<string, unknown>;
  reason: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Runtime context — passed to every tool handler
// ---------------------------------------------------------------------------

export interface RuntimeContext {
  config: RuntimeConfig;
  conversationId: string;
  parishId?: string;
  userId?: string;
  isAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  scriptureMatch: 30,
  topicMatch: 20,
  seasonMatch: 15,
  functionMatch: 25,
  recencyPenalty: 5,
  familiarityBoost: 10,
  userRankingBoost: 15,
  semanticSimilarity: 20,
};

export const DEFAULT_CONFIG: RuntimeConfig = {
  maxTokens: 128_000,
  compactionThreshold: 0.7,
  recommendationWeights: DEFAULT_RECOMMENDATION_WEIGHTS,
  repetitionPreference: 5,
  toolServers: [],
};
