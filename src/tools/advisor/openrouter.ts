/**
 * Minimal OpenRouter client for advisor tools.
 * Uses native fetch only — no external SDK dependencies.
 */

import type { AdvisorConfig } from "./types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const HTTP_REFERER = "https://ritualsong.app";

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens: number;
  temperature: number;
}

interface OpenRouterChoice {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenRouter with a system + user prompt pair.
 * Retries once on 429 (rate limit) or 500 (server error).
 * Throws on all other error responses.
 */
export async function callOpenRouter(
  config: AdvisorConfig,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const body: OpenRouterRequest = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 2000,
    temperature: 0.3,
  };

  return attemptCall(config, body, 0);
}

async function attemptCall(
  config: AdvisorConfig,
  body: OpenRouterRequest,
  attempt: number
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openrouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": HTTP_REFERER,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  // Log cost headers if present
  const generationCost = response.headers.get("x-openrouter-generation-cost");
  if (generationCost) {
    console.log(`[advisor] OpenRouter cost: $${generationCost} (model: ${body.model})`);
  }

  // Retry once on rate limit or server error
  if ((response.status === 429 || response.status >= 500) && attempt === 0) {
    console.warn(
      `[advisor] OpenRouter returned ${response.status}, retrying once...`
    );
    // Brief back-off before retry
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return attemptCall(config, body, 1);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "(unreadable body)");
    throw new Error(
      `OpenRouter error ${response.status}: ${errText}`
    );
  }

  const data = (await response.json()) as OpenRouterResponse;

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned an empty response");
  }

  if (data.usage) {
    console.log(
      `[advisor] tokens used — prompt: ${data.usage.prompt_tokens}, ` +
        `completion: ${data.usage.completion_tokens}, ` +
        `total: ${data.usage.total_tokens}`
    );
  }

  return content;
}

/**
 * Resolve config from environment variables with sensible defaults.
 */
export function getAdvisorConfig(): AdvisorConfig {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  return {
    cheapModel: "google/gemini-2.5-flash",
    strongModel: "x-ai/grok-4",
    openrouterApiKey: apiKey,
    maxRetries: 1,
    timeoutMs: 30_000,
  };
}
