import type { LLMProvider, StoryboardResult } from "./llm-provider.interface.js";
import type { AgentChatProvider, ChatMessage, ChatOptions } from "./agent-chat.interface.js";
import { storyboardResultSchema, storyboardJsonSchema } from "../../schemas/storyboard.schema.js";
import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";

const STORYBOARD_SYSTEM_PROMPT = `You are a cinematic storyboard artist for an AI video studio. Given a video idea, produce a structured storyboard in JSON format.

Each shot must have:
- shotIndex: sequential integer starting from 0
- prompt: a detailed visual prompt suitable for AI video generation (describe scene, lighting, subjects, style)
- negativePrompt: what to avoid (blur, text, watermark, low quality)
- durationSeconds: how long this shot lasts (1-8 seconds)
- cameraMotion: camera movement description (e.g. "slow pan left", "static", "zoom in", "tracking shot")
- mood: emotional tone (e.g. "tense", "serene", "dramatic", "joyful")
- transitionToNext: how to transition to the next shot ("crossfade", "cut", or "fade_to_black")

Also provide:
- title: a short cinematic title for the video
- totalDurationSeconds: sum of all shot durations
- styleNotes: overall aesthetic guidance (e.g. "cinematic, moody lighting, shallow depth of field")
- colorPalette: color description (e.g. "warm golden tones", "cyberpunk neon", "muted earth tones")

Make prompts highly detailed and visual. Think like a cinematographer.`;

export class OllamaProvider implements LLMProvider, AgentChatProvider {
  readonly name = "ollama";
  readonly providerKey = "ollama" as const;

  isAvailable(): boolean {
    return true; // always reachable (errors surface at call time)
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model ?? config.OLLAMA_MODEL;
    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: { temperature: options?.temperature ?? 0.7 },
    };
    if (options?.outputSchema) {
      body.format = options.outputSchema;
    }

    const response = await fetch(`${config.OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content ?? "";
  }


  async generateStoryboard(
    idea: string,
    shotCount: { min: number; max: number },
    totalDuration: { min: number; max: number }
  ): Promise<StoryboardResult> {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const userPrompt =
        attempt === 0
          ? `Create a storyboard with ${shotCount.min}-${shotCount.max} shots, totaling ${totalDuration.min}-${totalDuration.max} seconds, for this idea:\n\n${idea}`
          : `The previous response was invalid. Please try again. Create a storyboard with ${shotCount.min}-${shotCount.max} shots, totaling ${totalDuration.min}-${totalDuration.max} seconds, for this idea:\n\n${idea}`;

      logger.info({ attempt: attempt + 1, model: config.OLLAMA_MODEL }, "Calling Ollama for storyboard");

      const response = await fetch(`${config.OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.OLLAMA_MODEL,
          messages: [
            { role: "system", content: STORYBOARD_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          format: storyboardJsonSchema,
          stream: false,
          options: { temperature: 0.7 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as { message?: { content?: string } };
      const content = data.message?.content;

      if (!content) {
        logger.warn({ attempt: attempt + 1 }, "Ollama returned empty content");
        continue;
      }

      try {
        const parsed = JSON.parse(content);
        const validated = storyboardResultSchema.parse(parsed);

        // Check constraints
        if (validated.shots.length < shotCount.min || validated.shots.length > shotCount.max) {
          logger.warn(
            { shotCount: validated.shots.length, expected: shotCount },
            "Shot count out of range, retrying"
          );
          continue;
        }

        if (
          validated.totalDurationSeconds < totalDuration.min ||
          validated.totalDurationSeconds > totalDuration.max
        ) {
          logger.warn(
            { duration: validated.totalDurationSeconds, expected: totalDuration },
            "Duration out of range, retrying"
          );
          continue;
        }

        return validated;
      } catch (err) {
        logger.warn(
          { attempt: attempt + 1, err: err instanceof Error ? err.message : String(err) },
          "Storyboard validation failed"
        );
        if (attempt === maxRetries - 1) {
          throw new Error(
            `Failed to generate valid storyboard after ${maxRetries} attempts. Last error: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    throw new Error("Unreachable");
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${config.OLLAMA_URL}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
