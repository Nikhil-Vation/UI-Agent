# Architecture Overview — UI-Agent

A concise summary of the system components, data flow, and key properties.

- Playwright + axe (Scanner): Runs headless browser checks at multiple breakpoints, injects `axe-core`, and produces raw accessibility results and screenshots.

- Orchestrator (Express): Coordinates scans, stores artifacts under `orchestrator/artifacts`, and serves report + artifact URLs to the UI.

- Deterministic Enrichment (`llmClient.js`): Always-run layer that maps axe findings to a local WCAG database and `FIX_SUGGESTIONS` to generate a complete, reliable analysis (scores, issues, fixes, effort estimates).

- LLM Enhancement (optional): Configurable LLM backends (Ollama/OpenAI/HuggingFace/text-gen-webui) produce richer summaries, contextual prioritization, and improved code examples; responses are validated and merged with deterministic output.

- Artifact Store: Saves `{uuid}-report.json`, `{uuid}-analysis.json` (raw LLM), `{uuid}-analysis-parsed.json` (merged), and screenshots — all accessible via the orchestrator.

- UI (demo + `ai-accelerator-widget`): Renders the enriched analysis, screenshot gallery, accessibility checklist, and export options. The UI prefers `analysis.parsed` when available and falls back to deterministic data.

- Data Flow (condensed): URL → Playwright scan → Raw report → Deterministic enrichment → (optional LLM) → Merge → Save artifacts → UI renders final analysis.

Key properties:
- Deterministic-first: reliable results without an LLM.
- Graceful degradation: LLM timeouts/invalid responses fall back to deterministic output.
- Extensible: supports multiple LLM backends and UI enhancements.
- Developer-friendly artifacts: JSON + screenshots useful for CI and debugging.

File: `docs/ARCHITECTURE_OVERVIEW.md` — created.
