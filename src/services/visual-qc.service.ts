/**
 * Vision-based Visual QC: send extracted frames to a vision model (OpenAI, Anthropic, Gemini)
 * for quality assessment. Complements the metadata-only QC agent.
 */
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { ExtractedFrame } from "../utils/frame-extractor.js";

export interface VisionQCResult {
  pass: boolean;
  score: number;
  recommendation: "accept" | "retry_local" | "retry_premium" | "manual_review";
  issues: Array<{ type: string; severity: string; description: string }>;
}

const QC_SYSTEM_PROMPT = `You are a video quality reviewer for an AI-generated video clip. You will receive 2-3 frames extracted from the rendered video, plus the original prompt that was used to generate it.

Evaluate the frames for:
1. **Prompt alignment**: Does the visual content match what the prompt describes?
2. **Technical quality**: Blur, artifacts, flicker, deformation, distortion
3. **Common failure modes**: Text/writing (usually fails), hands/fingers (often deformed), multiple human faces (inconsistent), fast motion (choppy)

Respond with a JSON object:
{
  "pass": boolean,
  "score": number (0.0-1.0),
  "recommendation": "accept" | "retry_local" | "retry_premium" | "manual_review",
  "issues": [{"type": string, "severity": "critical"|"major"|"minor", "description": string}]
}

Use "accept" for good quality (score >= 0.65). Use "retry_local" for fixable issues. Use "retry_premium" only for severe failures that local models typically can't fix. Use "manual_review" when uncertain.`;

export async function runVisionQC(
  prompt: string,
  frames: ExtractedFrame[]
): Promise<VisionQCResult | null> {
  const provider = config.VISUAL_QC_PROVIDER;
  if (!provider || frames.length === 0) {
    return null;
  }

  try {
    if (provider === "openai" && config.OPENAI_API_KEY) {
      return await runOpenAIVisionQC(prompt, frames);
    }
    if (provider === "anthropic" && config.ANTHROPIC_API_KEY) {
      return await runAnthropicVisionQC(prompt, frames);
    }
    // Google/Gemini vision requires @google/generative-ai — skipped if not available
  } catch (err) {
    logger.warn({ err, provider }, "Vision QC failed — falling back to metadata-only");
  }
  return null;
}

async function runOpenAIVisionQC(
  prompt: string,
  frames: ExtractedFrame[]
): Promise<VisionQCResult> {
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: `Original prompt: ${prompt}\n\nEvaluate these ${frames.length} frames from the rendered video.` },
  ];
  for (const f of frames) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${f.base64}` },
    });
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.VISUAL_QC_MODEL ?? "gpt-4o",
      messages: [
        { role: "system", content: QC_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      max_tokens: 1024,
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenAI vision API failed: ${resp.status}`);
  }

  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseQCResponse(text);
}

async function runAnthropicVisionQC(
  prompt: string,
  frames: ExtractedFrame[]
): Promise<VisionQCResult> {
  const content: Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }> = [
    { type: "text", text: `Original prompt: ${prompt}\n\nEvaluate these ${frames.length} frames from the rendered video.` },
  ];
  for (const f of frames) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: f.base64 },
    });
  }

  const resp = await fetch(
    `https://api.anthropic.com/v1/messages`,
    {
      method: "POST",
      headers: {
        "x-api-key": config.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.VISUAL_QC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: QC_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Anthropic vision API failed: ${resp.status}`);
  }

  const data = (await resp.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text ?? "";
  return parseQCResponse(text);
}

function parseQCResponse(text: string): VisionQCResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in vision QC response");
  }
  const parsed = JSON.parse(jsonMatch[0]) as VisionQCResult;
  if (typeof parsed.pass !== "boolean") parsed.pass = false;
  if (typeof parsed.score !== "number") parsed.score = 0.5;
  if (!["accept", "retry_local", "retry_premium", "manual_review"].includes(parsed.recommendation ?? "")) {
    parsed.recommendation = "manual_review";
  }
  if (!Array.isArray(parsed.issues)) parsed.issues = [];
  return parsed;
}
