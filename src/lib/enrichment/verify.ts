/**
 * Verification Harness for AI Enrichment
 *
 * Every AI classification passes through a secondary reviewer model
 * before writing to the database. Uses Claude Haiku via OpenRouter
 * (~$0.0001 per verification).
 *
 * Ref: ritualsong-architecture-brief.md, Build 3
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const VERIFIER_MODEL = "anthropic/claude-3.5-haiku";
const CONFIDENCE_THRESHOLD = 0.85;

export interface VerificationResult {
  approved: boolean;
  confidence: number;
  reason: string;
  model: string;
}

export interface VerificationInput {
  songTitle: string;
  lyricsExcerpt?: string;
  field: string;
  proposedValue: string;
  context?: string;
}

/**
 * Verify an AI enrichment decision using a secondary model.
 * Returns approved=true only if confidence >= threshold.
 */
export async function verifyEnrichment(
  input: VerificationInput
): Promise<VerificationResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY required for verification");
  }

  const lyricsSection = input.lyricsExcerpt
    ? `\nLyrics excerpt:\n"${input.lyricsExcerpt}"`
    : "";

  const contextSection = input.context
    ? `\nAdditional context: ${input.context}`
    : "";

  const prompt = `You are a Catholic liturgist verifying an AI's song classification.

Song: "${input.songTitle}"${lyricsSection}${contextSection}

The AI classified this song's ${input.field} as: "${input.proposedValue}"

Is this liturgically correct? Consider:
- Does the title/lyrics support this classification?
- Would a music director agree with this tag?
- Are there any liturgical rules this violates?

Respond with ONLY valid JSON:
{"approved": true/false, "confidence": 0.0-1.0, "reason": "brief explanation"}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://ritualsong.app",
      "X-Title": "Ritual Song Verification Harness",
    },
    body: JSON.stringify({
      model: VERIFIER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Verifier API error ${res.status}: ${body}`);
    return {
      approved: false,
      confidence: 0,
      reason: `API error: ${res.status}`,
      model: VERIFIER_MODEL,
    };
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "";

  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in response");
    const parsed = JSON.parse(match[0]);

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    return {
      approved: parsed.approved === true && confidence >= CONFIDENCE_THRESHOLD,
      confidence,
      reason: String(parsed.reason || "No reason given"),
      model: VERIFIER_MODEL,
    };
  } catch (e) {
    return {
      approved: false,
      confidence: 0,
      reason: `Failed to parse verifier response: ${content.slice(0, 100)}`,
      model: VERIFIER_MODEL,
    };
  }
}

/**
 * Batch verify multiple enrichments. Returns results in same order as inputs.
 * Processes sequentially to respect rate limits.
 */
export async function verifyBatch(
  inputs: VerificationInput[],
  delayMs: number = 200
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  for (const input of inputs) {
    const result = await verifyEnrichment(input);
    results.push(result);
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}
