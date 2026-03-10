# Reel Kingdom Studios — Roadmap

Future features and enhancements to consider.

---

## Under Consideration

### Model Router

Route requests to different models (LLM, vision, video) based on:
- Task type (storyboard vs. QC vs. orchestration)
- Cost vs. quality tradeoff
- Provider availability / fallback
- Per-project or per-shot overrides

*Could extend the existing Render Orchestrator pattern to LLM and vision calls.*

---

### Template Library

- Pre-built project templates (e.g. "60s sermon", "30s trailer", "vertical social clip")
- Storyboard templates (beat structure, shot count, mood presets)
- Presenter templates (delivery modes, framing presets)
- Reusable assemblies (transition styles, reframe presets)

*Stored in DB or `$STUDIO_ROOT/templates/`. UI to browse and apply.*

---

### Agent Workflows

- **Visual workflows** — See the agent chain: Intent → Storyboard → Compiler → Safety → Orchestrator → QC → Editor
- **Customizable pipelines** — Enable/disable agents, reorder, add custom steps
- **Workflow templates** — Save and share agent configurations (e.g. "strict safety", "fast draft", "client deliverable")
- **Audit trail** — Per-run agent inputs/outputs, timings, model used

*Builds on the existing 7-agent pipeline; adds visibility and configuration.*

---

## Captured

*Add new ideas here as they come up.*

---

## Reference

- **Tier 1–2** (done): Stub cleanup, auto premium retry, render orchestrator, engine UI, visual QC, error resilience, tests, audio pipeline
- **Tier 3** (done): Audio library, timeline/reorder, trim, cost caps
- **Tier 4** (planned): Versioning, batch/scale, auth/multi-user
