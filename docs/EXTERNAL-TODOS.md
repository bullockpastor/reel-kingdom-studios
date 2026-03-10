# External To-Dos — Reel Kingdom Studios

Step-by-step tasks you need to do **outside** the codebase (accounts, config, setup) to use Tier 3+ features.

---

## 1. ElevenLabs API (Presenter TTS)

**When:** Before using TTS narration on presenter projects.

**Steps:**

1. Go to [elevenlabs.io](https://elevenlabs.io) and create an account.
2. Open **Profile → API Keys** and create an API key.
3. Copy the key and add to your `.env`:
   ```
   ELEVENLABS_API_KEY=your_key_here
   ```
4. (Optional) Set a default voice. Get a voice ID from the ElevenLabs dashboard (Voices → copy ID). Add:
   ```
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ```
5. When creating a Presenter profile, set **Voice ID** to match your preferred ElevenLabs voice.

**Result:** Assembling a presenter project with a voice will auto-generate TTS and mix it into the final video.

---

## 2. Audio Library (Background Music)

**When:** Before using background music on assembled videos.

**Steps:**

1. The audio library lives on your **T9 drive** at:
   ```
   /Volumes/T9/ReelKingdomStudios/audio/
   ├── music/   ← background music (cinematic, ambient, etc.)
   └── sfx/     ← sound effects
   ```
2. Add audio files to `music/` and/or `sfx/`. **Supported formats:** `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.aiff`, `.aif`
3. Add to your `.env`:
   ```
   AUDIO_LIBRARY_PATH=/Volumes/T9/ReelKingdomStudios/audio
   ```
   (The UI lists files from the root `audio/` folder; subfolders are included.)
4. Restart the backend.

**Result:** The Assembly UI will show a “background music” dropdown listing files in that folder. Pick one when assembling.

---

## 3. Cost Caps (Premium Budget Controls)

**When:** You want to limit premium API spend.

**Steps:**

1. Decide your caps:
   - **Monthly cap** — total spend per calendar month
   - **Project cap** — max spend per project (optional)

2. Add to `.env` (values in USD):
   ```
   PREMIUM_MONTHLY_CAP=100
   PREMIUM_PROJECT_CAP=50
   ```
   - Omit either variable if you don't want that cap.
   - Use `100` for $100, etc.

3. Restart the backend.

**Result:** Premium renders will be rejected when over cap. The Dashboard shows “Premium Spend” when caps or spend exist.

---

## 4. Premium Video Providers (Runway, Sora, etc.)

**When:** Before using premium (cloud) video rendering.

**Steps:**

1. Pick a provider and create an account:
   - **Runway Gen4:** [runwayml.com](https://runwayml.com)
   - **OpenAI Sora:** [platform.openai.com](https://platform.openai.com)
   - **Google Veo:** [Google AI Studio](https://aistudio.google.com) or Vertex AI
   - **Kling Video:** [klingai.com](https://klingai.com)

2. Obtain an API key or credentials for that provider.

3. Add the appropriate env vars (see `.env.example`):
   ```
   PREMIUM_VIDEO_PROVIDER=runway_gen4
   RUNWAY_API_KEY=your_key
   ```
   Or for Sora:
   ```
   PREMIUM_VIDEO_PROVIDER=openai_sora
   OPENAI_API_KEY=your_key
   ```

4. Restart the backend and worker.

**Result:** You can use “Premium” in the engine dropdown when rendering shots.

---

## 5. Visual QC (Frame-Based Quality Check)

**When:** Before using vision-based QC on rendered shots.

**Steps:**

1. Pick a provider:
   - **OpenAI:** set `VISUAL_QC_PROVIDER=openai`, ensure `OPENAI_API_KEY` is set.
   - **Anthropic:** set `VISUAL_QC_PROVIDER=anthropic`, add `ANTHROPIC_API_KEY`.

2. Add to `.env`:
   ```
   VISUAL_QC_PROVIDER=openai
   VISUAL_QC_MODEL=gpt-4o
   ```
   Or for Anthropic:
   ```
   VISUAL_QC_PROVIDER=anthropic
   ANTHROPIC_API_KEY=your_key
   ```

3. Restart the backend and render worker.

**Result:** QC will sample frames from rendered videos and send them to the vision API for quality assessment.

---

## Checklist

| Task               | Done? | Notes                                                |
|--------------------|-------|------------------------------------------------------|
| ElevenLabs API     | ☐     | For presenter TTS                                    |
| Audio library path | ☑     | T9 folder + CC0 music & SFX ready — add to .env     |
| Cost caps          | ☐     | Optional budget limits                               |
| Premium provider   | ☐     | Runway/Sora/Veo/Kling                                |
| Visual QC provider | ☐     | Optional frame-based QC                              |
