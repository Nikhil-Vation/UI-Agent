# UI-Agent — Developer Quick Start

Short developer README with the commands and main files to edit.

## Purpose
This repository contains a small accessibility scanning app and an embeddable WAVE-style widget:
- `orchestrator/` — backend: Express API, Playwright + axe-core runner, and LLM integration
- `ui-agent/` — frontend: embeddable web component widget (Shadow DOM) and demo pages

## Quick Start (Development)
Prereqs: Node 18+, npm, Python 3

Backend (orchestrator):
```bash
cd "/Users/nikhil/Desktop/Code Space/UI-Agent/orchestrator"
# install (if not installed yet)
npm install
# start server
node index.js
# or use npm script if present:
# npm run start
```

Frontend (static demo):
```bash
cd "/Users/nikhil/Desktop/Code Space/UI-Agent/ui-agent"
# serve static files locally
python3 -m http.server 8000
# open http://localhost:8000/demo.html
```

Ad-hoc LLM / scan test scripts:
```bash
cd "/Users/nikhil/Desktop/Code Space/UI-Agent/orchestrator"
node run_llm_test.js
node run_local_fallback.js
```

## Primary Files (What to edit for common tasks)
- Frontend (report UI):
  - `ui-agent/ai-accelerator-widget.js` — main web component: rendering, tabs, pagination, event handlers
  - `ui-agent/ai-accelerator-widget.css` — widget styling and responsive layout
  - `ui-agent/demo.html` — demo integration and sample data for the widget

- Backend (scanning/LLM):
  - `orchestrator/index.js` — Express server and API endpoints
  - `orchestrator/llmClient.js` — LLM integration: prompts, retries, streaming, model selection
  - `orchestrator/playwrightRunner.js` — Playwright + axe-core runner: rule sets, timeouts, viewports
  - `templates/llm-prompts.md` — prompt templates (first stop for prompt improvements)
  - `reports/schema.json` — report schema expected by the UI

## Common Changes & Where to Do Them
- Change report layout/filters: edit `ui-agent/ai-accelerator-widget.js` and `ui-agent/ai-accelerator-widget.css`.
- Change AIM score calculation: find the aggregation function in `orchestrator/index.js` (or where reports are created), update logic, then update FE renderer.
- Improve LLM summaries: edit `templates/llm-prompts.md` (prompt engineering) and `orchestrator/llmClient.js` (timeouts, retry behavior).
- Tune scan behavior: edit `orchestrator/playwrightRunner.js` (axe rules, timeouts, viewports).

## Git & GitHub
You already pushed the project to GitHub. Useful commands:
```bash
# set remote (if needed)
git remote add origin https://github.com/Nikhil-Vation/UI-Agent.git
# push
git push -u origin main
```

## Useful Notes
- Sample scan artifacts (JSON/screenshot) are stored in `orchestrator/artifacts/` but are excluded from git via `.gitignore`.
- If you want to iterate quickly on prompts, edit `templates/llm-prompts.md` and run `node run_llm_test.js`.

## Contact / Next Steps
If you want, I can:
- Open `ui-agent/ai-accelerator-widget.js` and annotate the exact functions to edit for a specific UI change,
- Make a small UI change (example: add a new filter) and push it.

---
Generated on 2026-02-03
