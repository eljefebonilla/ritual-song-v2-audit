import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "src/skills/wedding-planner.md"),
  "utf-8"
);

/**
 * POST /api/wedding/chat
 * Body: { messages: { role: string, content: string }[] }
 * Returns: { reply: string }
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

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

  return NextResponse.json({ reply });
}
