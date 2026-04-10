/**
 * Advisor Tool — Cost-aware LLM advisor for liturgical music decisions.
 * Ref: DESIGN-SPEC-v2.md Section 16 — tools/advisor/
 *
 * Registers tool handlers that the ConversationRuntime can invoke:
 * - advisor.ask: Ask the advisor a question (cheap model by default)
 * - advisor.verify: Verify a recommendation (always strong model)
 * - advisor.review-plan: Review a complete music plan (always strong model)
 *
 * The advisor is OPTIONAL — if OpenRouter is down or unconfigured, all
 * handlers return graceful fallbacks without blocking normal operation.
 */

import type { ToolDefinition } from "@/runtime/types";
import type {
  AdvisorResponse,
  VerificationResult,
  PlanReviewResult,
} from "./types";
import { callOpenRouter, getAdvisorConfig } from "./openrouter";

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_ASK = `You are an assistant music director for a Roman Catholic parish. Answer questions about liturgical music selection, Mass structure, and song recommendations. Be concise and practical.`;

const SYSTEM_PROMPT_VERIFY = `You are a senior liturgist reviewing music selections for Roman Catholic Mass. Evaluate whether the recommended song is appropriate for the given liturgical position, occasion, and season. Consider: scripture alignment, liturgical function, seasonal appropriateness, and pastoral sensitivity. Be specific about any concerns.`;

const SYSTEM_PROMPT_REVIEW_PLAN = `You are a senior liturgist reviewing a complete music plan for Roman Catholic Mass. Evaluate the overall flow, liturgical appropriateness, variety, and pastoral effectiveness. Consider: does the music support the readings? Is there good variety without jarring transitions? Are seasonal songs appropriate? Flag any liturgical concerns.`;

// ---------------------------------------------------------------------------
// Cost estimation helpers (rough estimates in cents)
// ---------------------------------------------------------------------------

function estimateCostCents(model: string, promptChars: number): number {
  // Very rough per-character approximation for cost display
  // Gemini Flash: ~$0.075/1M input tokens (~4 chars/token)
  // Grok-4: ~$3/1M input tokens
  const tokens = Math.ceil(promptChars / 4);
  if (model.includes("gemini")) {
    return Math.ceil((tokens / 1_000_000) * 7.5); // $0.075 in cents
  }
  return Math.ceil((tokens / 1_000_000) * 300); // $3 in cents
}

// ---------------------------------------------------------------------------
// JSON parse helper — attempts to parse, returns null on failure
// ---------------------------------------------------------------------------

function tryParseJson<T>(text: string): T | null {
  try {
    // Strip markdown code fences if present
    const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    return JSON.parse(stripped) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export function createAdvisorTools(): ToolDefinition[] {
  return [
    // -------------------------------------------------------------------------
    // advisor.ask — General question, cheap model by default
    // -------------------------------------------------------------------------
    {
      name: "advisor.ask",
      description:
        "Ask the advisor a liturgical music question. Uses a cheap model by default; pass forceStrong=true to escalate to the stronger model. Returns the answer, model used, and estimated cost.",
      permissionLevel: "allow",
      handler: async (args): Promise<AdvisorResponse> => {
        const { question, context, model: modelOverride, forceStrong } = args as {
          question: string;
          context?: string;
          model?: string;
          forceStrong?: boolean;
        };

        const config = getAdvisorConfig();

        if (!config.openrouterApiKey) {
          return {
            answer:
              "Advisor unavailable: OPENROUTER_API_KEY is not configured.",
            model: "none",
            tier: "cheap",
            estimatedCostCents: 0,
            timestamp: Date.now(),
          };
        }

        const selectedModel =
          modelOverride ??
          (forceStrong ? config.strongModel : config.cheapModel);
        const tier = selectedModel === config.cheapModel ? "cheap" : "strong";

        const userPrompt = context
          ? `Context: ${context}\n\nQuestion: ${question}`
          : question;

        try {
          const answer = await callOpenRouter(
            config,
            selectedModel,
            SYSTEM_PROMPT_ASK,
            userPrompt
          );

          return {
            answer,
            model: selectedModel,
            tier,
            estimatedCostCents: estimateCostCents(
              selectedModel,
              SYSTEM_PROMPT_ASK.length + userPrompt.length
            ),
            timestamp: Date.now(),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[advisor.ask] OpenRouter call failed:", message);
          return {
            answer: `Advisor temporarily unavailable: ${message}`,
            model: selectedModel,
            tier,
            estimatedCostCents: 0,
            timestamp: Date.now(),
          };
        }
      },
    },

    // -------------------------------------------------------------------------
    // advisor.verify — Verify a recommendation, always strong model
    // -------------------------------------------------------------------------
    {
      name: "advisor.verify",
      description:
        "Verify a song recommendation for liturgical fitness. Always uses the strong model. Returns confidence (0-1), approval status, any issues found, suggested alternatives, and a full explanation.",
      permissionLevel: "allow",
      handler: async (args): Promise<VerificationResult> => {
        const { recommendation, occasion, position } = args as {
          recommendation: {
            songId: string;
            title: string;
            score: number;
            reasons: string[];
          };
          occasion: {
            id: string;
            name: string;
            season: string;
            readings: string[];
          };
          position: string;
        };

        const config = getAdvisorConfig();

        if (!config.openrouterApiKey) {
          return {
            confidence: 0,
            approved: false,
            issues: ["Advisor unavailable: OPENROUTER_API_KEY is not configured."],
            alternatives: [],
            explanation: "Cannot verify — OpenRouter API key missing.",
            model: "none",
          };
        }

        const userPrompt = `
Evaluate this song recommendation:

Song: "${recommendation.title}" (ID: ${recommendation.songId})
Algorithm score: ${recommendation.score}
Scoring reasons: ${recommendation.reasons.join("; ")}

Occasion: ${occasion.name} (ID: ${occasion.id})
Liturgical season: ${occasion.season}
Scripture readings: ${occasion.readings.join("; ") || "not specified"}
Mass position: ${position}

Respond ONLY with valid JSON matching this exact shape:
{
  "confidence": <number 0-1>,
  "approved": <boolean>,
  "issues": [<string>, ...],
  "alternatives": [<string>, ...],
  "explanation": "<string>"
}

If you approve with no concerns, set issues to [] and confidence to 0.9 or higher.
`.trim();

        try {
          const raw = await callOpenRouter(
            config,
            config.strongModel,
            SYSTEM_PROMPT_VERIFY,
            userPrompt
          );

          const parsed = tryParseJson<Omit<VerificationResult, "model">>(raw);
          if (parsed && typeof parsed.confidence === "number") {
            return { ...parsed, model: config.strongModel };
          }

          // Fallback: could not parse structured response
          console.warn(
            "[advisor.verify] Could not parse structured JSON from model response"
          );
          return {
            confidence: 0.5,
            approved: false,
            issues: ["Could not parse structured advisor response."],
            alternatives: [],
            explanation: raw,
            model: config.strongModel,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[advisor.verify] OpenRouter call failed:", message);
          return {
            confidence: 0,
            approved: false,
            issues: [`Verification failed: ${message}`],
            alternatives: [],
            explanation: "Advisor temporarily unavailable.",
            model: config.strongModel,
          };
        }
      },
    },

    // -------------------------------------------------------------------------
    // advisor.review-plan — Review a full music plan, always strong model
    // -------------------------------------------------------------------------
    {
      name: "advisor.review-plan",
      description:
        "Review an entire music plan for liturgical fitness. Always uses the strong model. Returns per-position feedback, an overall score (0-100), and liturgical notes.",
      permissionLevel: "allow",
      handler: async (args): Promise<PlanReviewResult> => {
        const { plan, occasion, ensembleId } = args as {
          plan: Record<string, { title: string; composer?: string }>;
          occasion: { id: string; name: string; season: string };
          ensembleId: string;
        };

        const config = getAdvisorConfig();

        if (!config.openrouterApiKey) {
          return {
            overallScore: 0,
            positionFeedback: {},
            liturgicalNotes: [
              "Advisor unavailable: OPENROUTER_API_KEY is not configured.",
            ],
            model: "none",
          };
        }

        const planLines = Object.entries(plan)
          .map(([pos, song]) =>
            `  ${pos}: "${song.title}"${song.composer ? ` by ${song.composer}` : ""}`
          )
          .join("\n");

        const userPrompt = `
Review this complete music plan for Roman Catholic Mass:

Occasion: ${occasion.name} (ID: ${occasion.id})
Liturgical season: ${occasion.season}
Ensemble: ${ensembleId}

Music plan:
${planLines}

Respond ONLY with valid JSON matching this exact shape:
{
  "overallScore": <number 0-100>,
  "positionFeedback": {
    "<position>": {
      "score": <number 0-100>,
      "comment": "<string>",
      "suggestion": "<string or omit>"
    }
  },
  "liturgicalNotes": [<string>, ...]
}

Score 80+ means liturgically sound. Score below 60 means significant concerns.
`.trim();

        try {
          const raw = await callOpenRouter(
            config,
            config.strongModel,
            SYSTEM_PROMPT_REVIEW_PLAN,
            userPrompt
          );

          const parsed = tryParseJson<Omit<PlanReviewResult, "model">>(raw);
          if (parsed && typeof parsed.overallScore === "number") {
            return { ...parsed, model: config.strongModel };
          }

          console.warn(
            "[advisor.review-plan] Could not parse structured JSON from model response"
          );
          return {
            overallScore: 0,
            positionFeedback: {},
            liturgicalNotes: [
              "Could not parse structured advisor response.",
              raw,
            ],
            model: config.strongModel,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[advisor.review-plan] OpenRouter call failed:", message);
          return {
            overallScore: 0,
            positionFeedback: {},
            liturgicalNotes: [`Plan review failed: ${message}`],
            model: config.strongModel,
          };
        }
      },
    },
  ];
}
