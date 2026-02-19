Accea Agent — Short Summary
=============================

What it is
----------
Accea Agent is a privacy-first Chrome extension that scans webpages for WCAG accessibility issues, provides an instant audit score, and generates AI-powered, actionable code fixes. It also surfaces Lighthouse and SEO recommendations so teams can improve accessibility while boosting search and performance metrics.

Key Capabilities (at-a-glance)
-------------------------------
- One-click scan (popup or `⌘⇧A`) using `axe-core` injected into the page (MAIN world).
- Scores pages 0–100 (grade A/B/C/F) and lists issues by severity with quick filters.
- AI-powered fix suggestions via a cascading LLM router: on-device AI → local LLM → cloud API → deterministic rules.
- PII redaction before any external call (7 regex patterns) — default is privacy-first.
- Tips tab with Lighthouse estimate, Quick Wins, SEO crossover, Improvement Insights.
- Onboarding intro hero with typewriter animation (8 phrases) that collapses on first scan.
- History (200 scans), export (JSON/CSV/HTML/PDF/clipboard), and highlight toggles.

Primary Components
------------------
- `chrome-extension/` — popup UI, content scripts (`scanner.js`, `redactor.js`), styles, and `lib/llm-router.js`.
- `orchestrator/` — Node/Express server (port 3000) offering `/scan`, `/fix`, `/health`, `/meta` endpoints and LLM proxying.
- Local LLM (optional) — any compatible model running via a local server.
- Docs — `chrome-extension/HOW-IT-WORKS.md` (deep dive) and `README.short.md` (this file).

High-Level Flows
----------------
Scan flow:
1. User clicks Scan (popup) or uses keyboard shortcut.
2. Extension injects `axe-core` (MAIN world) and collects issues, selectors, and contextual HTML.
3. Orchestrator normalizes results and computes audit score.
4. Popup shows score card, severity badges, issue list, and quick actions.

Fix flow:
1. User requests a fix for an issue (single or "Fix All").
2. Popup sends the issue to the orchestrator which routes to the best LLM tier.
3. LLM returns a patch suggestion, WCAG tags, effort estimate, and confidence score.
4. UI displays the suggestion and provides copy/apply guidance; manual review recommended.

Privacy & Safety
----------------
- PII redaction runs before any outbound payload (email, phone, SSN, credit cards, IPv4, JWT, API keys).
- Default mode: local-first (no cloud), user may opt into cloud features in settings.
- Deterministic fallback rules ensure safe, predictable suggestions without external calls.

Mobile, Performance & SEO
-------------------------
- The extension checks mobile friendliness (`meta-viewport`, touch target size, responsive layouts).
- Recommends lazy-loading images/iframes (`loading="lazy"`), responsive images (`srcset`, `sizes`), and Core Web Vitals improvements.
- `ISSUE_IMPACT_MAP` maps accessibility issues to SEO and Lighthouse impact to prioritize fixes.

Developer Notes (key files)
---------------------------
- `chrome-extension/popup/popup.html` — popup DOM + `#intro-hero` markup.
- `chrome-extension/popup/popup.js` — UI controller, `startTypewriter()`, `handleScan()`, tab logic.
- `chrome-extension/popup/popup.css` — theme, animations, and responsive styles.
- `chrome-extension/content/scanner.js` — injection + DOM context collection.
- `chrome-extension/content/redactor.js` — PII redaction logic.
- `chrome-extension/lib/llm-router.js` — cascading LLM logic and deterministic fallback.
- `orchestrator/index.js`, `orchestrator/llmClient.js` — server and LLM client logic.
- `chrome-extension/HOW-IT-WORKS.md` — full architecture and documentation (now includes onboarding and mobile/lazy sections).

How to Run Locally (quick)
--------------------------
1. Start local LLM (optional):

```bash
# If using a local LLM server
# Start your preferred LLM backend
```

2. Start the orchestrator:

```bash
cd orchestrator
node index.js
```

3. Load the extension in Chrome:

- Open `chrome://extensions` → Developer mode → Load unpacked → select `chrome-extension/` folder.

4. Scan a page and inspect results from the popup.

Testing & Debugging Tips
------------------------
- Use `curl http://localhost:3000/health` to confirm orchestrator + LLM health.
- Use the provided `run_llm_test.js` or `/fix` endpoint to simulate fix responses.
- Confirm manifest JSON validity with Python: `python3 -c "import json,sys; json.load(open('chrome-extension/manifest.json')); print('ok')"`.

Limitations & Trade-offs
------------------------
- Local LLM inference (8B) can be slow on CPU (~5–15s). Cloud fallback reduces latency but impacts privacy.
- axe-core covers many a11y rules but Lighthouse audits some different runtime behaviors (e.g., resource timing).
- Fix suggestions are recommendations — manual review and testing before deploy is required.

Elevator Pitch (1–2 lines)
--------------------------
Accea Agent is a privacy-first browser extension that scans any webpage for accessibility issues and generates AI-powered code fixes, while surfacing Lighthouse and SEO tips so you can fix accessibility and boost search and performance metrics simultaneously.

Next Steps I Can Do
-------------------
- Add `README.short.md` (done).
- Create `README.slide.md` (one-slide summary) or a 1-page PPT/MDX if you want a presentation.
- Produce a 60–90s talking script for demos.

If you'd like a slide or demo script next, tell me which and I'll generate it.