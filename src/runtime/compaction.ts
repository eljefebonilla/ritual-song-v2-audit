/**
 * Token-Aware Session Compaction
 * Ref: DESIGN-SPEC-v2.md Section 16.1 Pattern 4
 *
 * Preserves recent turns verbatim while intelligently summarizing
 * older history. Critical for long-running planning sessions
 * (3-year lectionary cycles, multi-week planner) without exceeding
 * context limits.
 */

import type { Turn, TurnSummary, ConversationState } from "./types";

/**
 * Rough token estimation: ~4 chars per token for English text.
 * Good enough for budget management. Not a tokenizer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface CompactionOptions {
  /** Max tokens before compaction triggers */
  maxTokens: number;
  /** Percentage of maxTokens that triggers compaction (0.0-1.0) */
  threshold: number;
  /** Number of recent turns to always preserve verbatim */
  preserveRecentTurns: number;
  /** Custom summarizer. Falls back to naive truncation if not provided. */
  summarizer?: (turns: Turn[]) => Promise<string>;
}

const DEFAULT_OPTIONS: CompactionOptions = {
  maxTokens: 128_000,
  threshold: 0.7,
  preserveRecentTurns: 10,
};

export class SessionCompactor {
  private options: CompactionOptions;

  constructor(options?: Partial<CompactionOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Check whether the conversation needs compaction.
   */
  needsCompaction(state: ConversationState): boolean {
    return state.totalTokens > this.options.maxTokens * this.options.threshold;
  }

  /**
   * Compact a conversation state. Preserves the most recent N turns
   * verbatim and summarizes everything older.
   *
   * Returns a new ConversationState (does not mutate the input).
   */
  async compact(state: ConversationState): Promise<ConversationState> {
    if (!this.needsCompaction(state)) {
      return state;
    }

    const { preserveRecentTurns } = this.options;
    const splitIdx = Math.max(0, state.turns.length - preserveRecentTurns);

    const turnsToSummarize = state.turns.slice(0, splitIdx);
    const turnsToKeep = state.turns.slice(splitIdx);

    if (turnsToSummarize.length === 0) {
      return state;
    }

    // Generate summary of older turns
    const summaryText = this.options.summarizer
      ? await this.options.summarizer(turnsToSummarize)
      : this.naiveSummarize(turnsToSummarize);

    const newSummary: TurnSummary = {
      turnIds: turnsToSummarize.map((t) => t.id),
      summary: summaryText,
      tokenEstimate: estimateTokens(summaryText),
    };

    // Calculate new token total
    const summaryTokens = [...state.summaries, newSummary].reduce(
      (sum, s) => sum + s.tokenEstimate,
      0
    );
    const turnTokens = turnsToKeep.reduce(
      (sum, t) => sum + t.tokenEstimate,
      0
    );

    return {
      ...state,
      turns: turnsToKeep,
      summaries: [...state.summaries, newSummary],
      totalTokens: summaryTokens + turnTokens,
      updatedAt: Date.now(),
    };
  }

  /**
   * Naive summarization: extract key facts from tool calls and assistant responses.
   * Used when no LLM summarizer is available.
   */
  private naiveSummarize(turns: Turn[]): string {
    const parts: string[] = [];

    for (const turn of turns) {
      if (turn.role === "tool" && turn.toolName) {
        const result =
          typeof turn.toolResult === "string"
            ? turn.toolResult.slice(0, 200)
            : JSON.stringify(turn.toolResult).slice(0, 200);
        parts.push(`[${turn.toolName}]: ${result}`);
      } else if (turn.role === "assistant" && turn.content.length > 0) {
        parts.push(`Assistant: ${turn.content.slice(0, 300)}`);
      } else if (turn.role === "user") {
        parts.push(`User: ${turn.content.slice(0, 200)}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Build the effective context window from a conversation state.
   * Returns summaries (oldest first) + recent turns (chronological).
   */
  buildContext(state: ConversationState): string {
    const parts: string[] = [];

    if (state.summaries.length > 0) {
      parts.push("## Prior Context (summarized)");
      for (const s of state.summaries) {
        parts.push(s.summary);
      }
      parts.push("## Recent Conversation");
    }

    for (const turn of state.turns) {
      const prefix =
        turn.role === "tool" ? `[tool:${turn.toolName}]` : `[${turn.role}]`;
      parts.push(`${prefix} ${turn.content}`);
    }

    return parts.join("\n\n");
  }
}
