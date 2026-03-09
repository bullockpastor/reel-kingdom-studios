import type { AgentDefinition } from "./runner.js";

// ─────────────────────────────────────────────
// Script Director Agent
// Input: { rawScript, presenterDescription, videoType, targetDurationSeconds }
// Output: { segments[], totalEstimatedDurationSeconds, globalDeliveryNotes }
// ─────────────────────────────────────────────

export const scriptDirectorAgent: AgentDefinition = {
  name: "Script Director",
  temperature: 0.4,
  outputSchema: {
    type: "object",
    required: ["segments", "totalEstimatedDurationSeconds", "globalDeliveryNotes"],
    properties: {
      segments: {
        type: "array",
        items: {
          type: "object",
          required: [
            "index",
            "text",
            "pauseBefore",
            "pauseAfter",
            "emphasis",
            "beatTimingSeconds",
            "captionChunk",
            "deliveryNote",
          ],
          properties: {
            index: { type: "integer" },
            text: { type: "string" },
            pauseBefore: { type: "number" },
            pauseAfter: { type: "number" },
            emphasis: { type: "array", items: { type: "string" } },
            beatTimingSeconds: { type: "number" },
            captionChunk: { type: "string" },
            deliveryNote: { type: "string" },
          },
        },
      },
      totalEstimatedDurationSeconds: { type: "number" },
      globalDeliveryNotes: { type: "string" },
    },
  },
  systemPrompt: `You are the Script Director for a talking-head video production studio.

Your job: Take a raw script and mark it up for spoken delivery by an on-screen presenter.

For each phrase segment you must determine:
- index: sequential integer starting at 0
- text: the exact text of this segment as it will be spoken
- pauseBefore: seconds of silence before this segment (0.0–2.0)
- pauseAfter: seconds of silence after this segment (0.0–2.0)
- emphasis: list of words within this segment to stress
- beatTimingSeconds: total camera segment duration including speech + pauses (2.0–12.0 seconds)
- captionChunk: cleaned text for on-screen captions (same as text, without filler words)
- deliveryNote: one-sentence coaching note for the presenter (e.g., "Open with authority", "Slow down here for weight")

Also provide:
- totalEstimatedDurationSeconds: sum of all beatTimingSeconds
- globalDeliveryNotes: overall pacing and tone guidance for the full presentation

Guidelines:
- Break at natural phrase boundaries — do not split mid-clause
- Sermon/devotional: measured, pastoral pacing; allow pauses for spiritual weight
- Announcements: crisp, energetic, shorter segments with minimal pauses
- Social clips: punchy, immediate, strong open; no long pauses
- Never alter the meaning or wording of the script
- Emphasis words should feel natural and impactful when spoken aloud
- Aim for 4–10 segments for a typical 30–90 second piece`,
};

// ─────────────────────────────────────────────
// Performance Director Agent
// Input: Script Director output + { presenterDescription, templatePreference }
// Output: { shots[], globalStyle }
// ─────────────────────────────────────────────

export const performanceDirectorAgent: AgentDefinition = {
  name: "Performance Director",
  temperature: 0.5,
  outputSchema: {
    type: "object",
    required: ["shots", "globalStyle"],
    properties: {
      shots: {
        type: "array",
        items: {
          type: "object",
          required: [
            "segmentIndex",
            "cameraFraming",
            "pacingProfile",
            "emotionalTone",
            "gestureIntensity",
            "templateId",
            "safeZone",
            "verticalCropSafe",
            "visualPrompt",
          ],
          properties: {
            segmentIndex: { type: "integer" },
            cameraFraming: { type: "string" },
            pacingProfile: { type: "string" },
            emotionalTone: { type: "string" },
            gestureIntensity: {
              type: "string",
              enum: ["none", "subtle", "moderate", "expressive"],
            },
            templateId: { type: "string" },
            lowerThirdTiming: {
              type: "object",
              properties: {
                in: { type: "number" },
                out: { type: "number" },
                text: { type: "string" },
              },
            },
            scriptureOverlay: { type: "string" },
            safeZone: { type: "string" },
            verticalCropSafe: { type: "boolean" },
            visualPrompt: { type: "string" },
          },
        },
      },
      globalStyle: { type: "string" },
    },
  },
  systemPrompt: `You are the Performance Director for a talking-head video production studio.

You will receive a directed script (with segments, beat timing, delivery notes) along with a presenter profile description.

Your job: Create a shot-by-shot performance specification for each script segment.

For each shot provide:
- segmentIndex: matches the script segment index exactly
- cameraFraming: camera framing (e.g. "medium_close_up", "close_up", "medium_shot", "wide_shot", "extreme_close_up")
- pacingProfile: shot rhythm ("deliberate", "steady", "energetic", "contemplative", "authoritative")
- emotionalTone: emotional quality ("pastoral_authority", "warm_invitation", "urgent_call", "joyful_celebration", "solemn_reflection", "encouraging", "prophetic")
- gestureIntensity: hand/body movement ("none", "subtle", "moderate", "expressive")
- templateId: background/set template (e.g. "dark_wood_pulpit", "light_studio", "outdoor_natural", "modern_church", "home_office", "bookshelf_study")
- lowerThirdTiming: if a name/title lower-third should appear, provide { in: seconds, out: seconds, text: display text }. For no lower third, omit this field or use an empty object.
- scriptureOverlay: if a scripture reference should appear as on-screen overlay text, provide it as a string. Otherwise omit or use empty string.
- safeZone: framing safe zone ("center_16x9", "center_9x16", "left_rule_of_thirds", "right_rule_of_thirds")
- verticalCropSafe: true if this framing keeps the subject centered enough for 9:16 vertical crop
- visualPrompt: a complete, provider-ready text prompt for an AI video generation model. Incorporate the presenter's description naturally. Describe: presenter appearance, background/set, camera angle, lighting, emotional expression, and key gestures. This prompt goes directly to a video AI model — make it rich and specific.

Also provide:
- globalStyle: a one-sentence overall style statement applying across all shots

Guidelines:
- Match camera framing to emotional weight: close-ups for intimate/heavy moments, medium shots for teaching, wide for establishing
- Use lower thirds on the FIRST segment only (presenter introduction)
- Scripture overlays only when the script text explicitly quotes scripture
- Visual prompts must incorporate the presenter's physical description naturally
- For social/announcement: prefer tight framing (close_up, medium_close_up) for mobile engagement
- verticalCropSafe=true means the subject stays centered enough for 9:16 crop without losing key framing
- Make the visual prompt self-contained — another team member with no context should be able to generate from it alone`,
};
