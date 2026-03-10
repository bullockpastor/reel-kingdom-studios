# Reel Kingdom Studios — Optimal Use Manual

How to get the best results while controlling cost and keeping workflow smooth.

---

## 1. Before You Start

### Prerequisites

- [ ] T9 drive mounted at `/Volumes/T9/ReelKingdomStudios`
- [ ] `AUDIO_LIBRARY_PATH` set in `.env` if you want background music
- [ ] Backend, frontend, and workers running (see [Startup](#startup))

### Choose Your Project Type

| Type | Best For | Main Workflow |
|------|----------|---------------|
| **Cinematic** | Short films, trailers, multi-shot narratives | Idea → Storyboard → Render (local or premium) → Assemble |
| **Presenter** | Sermons, devotionals, talking-head content | Script + Presenter → Direct → Produce → Assemble with TTS |

---

## 2. Cinematic Workflow (Optimal)

### Step 1: Create Project

1. Dashboard → **Create Project** → **Cinematic**
2. Enter your idea (clear narrative intent helps the agents)
3. Choose format: horizontal (16:9), vertical (9:16), or square

### Step 2: Generate Storyboard

- Click **Generate Storyboard**
- The 4-agent pipeline runs: Intent → Storyboard → Prompt Compiler → Safety/IP Guard
- Review shots in the **Storyboard** tab. Reorder via drag-and-drop if needed

### Step 3: Render (Cost-Optimal Strategy)

**Recommended: Local-first, then premium for finals**

1. **Render All** → Choose **Use plan** or **Force local**
   - The Render Orchestrator (when using “Use plan”) picks engine per shot
   - Local = ComfyUI (Wan2.1), free, private, fast iteration
2. Review rendered shots. QC runs automatically.
3. **If a shot fails QC twice** → Auto-retry sends it to premium, or use **Retry with Premium** on the shot card
4. **For hero shots** → Manually re-render with Premium (Runway/Sora/Veo/Kling) from the ShotCard dropdown

**When to force premium from the start**

- Client deliverable, tight deadline
- Shots that need cinematic polish (Sora/Veo) or reference-image identity (Runway)
- You have budget and want maximum quality

### Step 4: Trim & Reorder (Optional)

- In **Storyboard** tab: drag shots to reorder
- On rendered shots: use **trim↑** and **trim↓** to trim start/end (removes AI artifacts)

### Step 5: Assemble

1. When all shots are rendered, go to **Assembly** tab
2. Optional: pick **Background music** from the dropdown (if `AUDIO_LIBRARY_PATH` is set)
3. Click **Assemble Video**
4. FFmpeg + Editor Agent produce the final video

---

## 3. Presenter Workflow (Optimal)

### Step 1: Create Presenter Profile

1. Go to **Presenter** → **Create** (or edit existing)
2. Set **Name**, **Description** (woven into visual prompts)
3. **Reference image**: path to a face/identity image for Runway (e.g. `$STUDIO_ROOT/presenters/your_name/reference/photo.jpg`)
4. **Voice ID**: ElevenLabs voice for TTS (set `ELEVENLABS_API_KEY` in `.env`)
5. **Default provider**: Runway Gen4 (best for identity), or Sora/Veo/Kling

### Step 2: Create Presenter Project

1. Dashboard → **Create Project** → **Presenter**
2. Paste your script
3. Pick the presenter profile
4. Set **Video type** (sermon, devotional, etc.) and optional **Target duration**
5. Submit → Script Director + Performance Director run

### Step 3: Review Script & Shots

- **Script** tab: review directed segments, beat timings, emphasis
- **Shots** tab: review visual prompts per segment
- **Re-direct** if you edit the script and want new direction

### Step 4: Produce (Render All Shots)

1. Click **Produce All** (or pick a provider first)
2. All shots render via your chosen premium provider (Runway recommended for identity)
3. One seed per project keeps appearance consistent across clips

### Step 5: Assemble (with TTS)

1. When all shots are rendered, click **Assemble**
2. **TTS runs automatically** if the presenter has a Voice ID and `ELEVENLABS_API_KEY` is set
3. Optional: add **Background music** from the dropdown
4. Assembly mixes video + TTS + optional music into the final file

---

## 4. Cost Optimization

| Strategy | How |
|----------|-----|
| **Local-first** | Render all shots locally. Upgrade only failed or hero shots to premium. |
| **Use plan** | Let the Render Orchestrator choose per-shot engine. |
| **Caps** | Set `PREMIUM_MONTHLY_CAP` and `PREMIUM_PROJECT_CAP` in `.env`. |
| **Trim** | Trim start/end to avoid re-renders for small fixes. |
| **Reorder** | Drag shots instead of regenerating the storyboard. |

---

## 5. When to Use Which Engine

| Engine | Best For | Cost | Speed |
|--------|----------|------|-------|
| **Local (ComfyUI)** | Drafts, iteration, private content, 6–8 shot storyboards | Free | Fast (GPU) |
| **Runway Gen4** | Presenters, identity consistency, reference images | $ | Medium |
| **OpenAI Sora** | Cinematic polish, photoreal, motion | $$ | Medium |
| **Google Veo** | High quality, diverse motion | $$ | Slower |
| **Kling** | Short clips, experimentation | $ | Variable |

---

## 6. Common Pitfalls & Fixes

| Issue | Fix |
|-------|-----|
| Backend won’t start: "STUDIO_ROOT not writable" | Mount T9 and ensure path exists. Run with full permissions. |
| No audio library in dropdown | Set `AUDIO_LIBRARY_PATH` in `.env`, restart backend. |
| TTS not mixing on assemble | Set `ELEVENLABS_API_KEY` and presenter Voice ID. |
| Premium rejected: "cap reached" | Raise `PREMIUM_MONTHLY_CAP` or wait for next month. |
| Shot fails QC twice | Auto-retry queues premium. Or use **Retry with Premium** manually. |
| Wrong aspect ratio | Set project format at creation; reframing happens in assembly. |

---

## 7. Startup

```bash
# Terminal 1: Backend (needs T9 mounted)
cd /Users/bos/video-studio-platform && npm run dev

# Terminal 2: Frontend
cd /Users/bos/video-studio-platform && npm run dev:client

# Terminal 3: Render worker (processes render jobs)
cd /Users/bos/video-studio-platform && npm run worker

# Terminal 4: Assembly worker (processes assemble jobs)
cd /Users/bos/video-studio-platform && npm run worker:assembly
```

Then open **http://localhost:5173/studio/**

---

## 8. Quick Reference

| Action | Location |
|--------|----------|
| Create cinematic project | Dashboard → Create Project → Cinematic |
| Create presenter project | Dashboard → Create Project → Presenter |
| Reorder shots | Storyboard tab → drag shot cards |
| Trim shot | ShotCard (rendered) → trim↑ / trim↓ |
| Choose engine per shot | ShotCard → dropdown (Local / Premium + provider) |
| Set render-all engine | Overview → Use plan / Force local / Force premium |
| Add background music | Assembly tab → dropdown before Assemble |
| View cost | Dashboard → Premium Spend card |
