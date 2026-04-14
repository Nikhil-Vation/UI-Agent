# UI-Agent Codebase Reference

Detailed per-file guide for developers. Each section lists functions/methods and what to change for common tasks.

---

## Frontend (ui-agent/)

### `ai-accelerator-widget.js`
Main web component (Shadow DOM). All report UI rendering lives here.

| Line | Method | Purpose | When to Edit |
|------|--------|---------|--------------|
| 7 | `constructor()` | Initializes shadow DOM and state | Add new instance properties |
| 16 | `connectedCallback()` | Auto-loads if attributes set | Change auto-init behavior |
| 35 | `runAnalysis(url, apiEndpoint)` | Calls backend `/run` and renders result | Change API endpoint or request payload |
| 64 | `loadData(data)` / `setReport(data)` | Load existing JSON into widget | Change how external data is ingested |
| 82 | `_render()` | Main render dispatcher | Add new view states |
| 108 | `_renderLoading()` | Loading spinner HTML | Customize loading UI |
| 117 | `_renderError()` | Error state HTML | Customize error display |
| 126 | `_renderEmpty()` | Empty state HTML | Customize empty state |
| 137 | `_renderDashboard()` | Assembles full report view | Add/remove dashboard sections |
| 179 | `_renderNoIssues()` | "All clear" message | Change success message |
| 189 | `_renderExportButtons()` | Export JSON/CSV buttons | Add new export formats |
| 205 | `_renderHeader(data)` | Header with URL and timestamp | Change header layout |
| 218 | `_renderWaveSummary(data)` | WAVE-style AIM Score + 6 categories | **Change score display, category badges, score calculation UI** |
| 352 | `_renderScoreAndStats(score, counts, compliance)` | Alternate score/stats rendering | Change stats cards |
| 406 | `_renderComplianceStatus(data)` | WCAG/ADA compliance badges | Change compliance display |
| 449 | `_renderIssuesSection(issues)` | Accessibility issues list | Change issue card layout |
| 460 | `_renderIssueCard(issue, idx)` | Single issue card HTML | **Change individual issue rendering (code snippets, severity badges)** |
| 584 | `_renderUIIssuesSection(uiIssues)` | UI quality issues with tabs + pagination | **Change UI issues display, pagination, tabs** |
| 673 | `_renderTopFixes(topFixes)` | Top fixes section | Change fix suggestions display |
| 691 | `_renderRecommendations(recommendations)` | Recommendations list | Change recommendations UI |
| 705 | `_renderActionPlan(actionPlan)` | Action plan section | Change action plan layout |
| 739 | `_renderBestPractices(bestPractices)` | Best practices list | Change best practices display |
| 754 | `_renderFooter()` | Footer HTML | Change footer |
| 763 | `_attachEventListeners()` | Event delegation for clicks | **Add new interactive behaviors (modals, toggles)** |
| 865 | `_handleExport(action)` | Dispatches export events | Change export behavior |
| 881 | `_handleUIIssuesPagination(btn)` | Handles prev/next pagination | **Change pagination logic** |
| 925 | `_exportJSON()` | Generates JSON download | Change JSON export format |
| 936 | `_exportCSV()` | Generates CSV download | Change CSV columns |
| 969 | `_escapeHtml(str)` | Escapes HTML entities | (utility, rarely changed) |

**Common tasks:**
- Add a filter dropdown: edit `_renderDashboard()` to add filter HTML, then `_attachEventListeners()` to handle it.
- Change score circle colors: edit `_renderWaveSummary()` (lines ~220–350).
- Add new issue category: edit `_renderIssueCard()` and `_renderUIIssuesSection()`.

---

### `ai-accelerator-widget.css`
All widget styles. Key sections:

| Line Range | Selector | Purpose | When to Edit |
|------------|----------|---------|--------------|
| 1–50 | `.aa-widget-wrapper`, base | Global widget container and resets | Change overall padding, font |
| ~50–100 | `.aa-loading`, `.aa-error` | Loading spinner, error state | Customize loading/error UI |
| ~100–200 | `.aa-header`, `.aa-score-*` | Header and score circle | **Change score colors, sizes** |
| ~200–350 | `.aa-wave-summary`, `.aa-wave-categories` | WAVE-style summary panel | **Change category badge colors, grid layout** |
| ~350–450 | `.aa-stat-card`, `.aa-compliance` | Stat cards and compliance badges | Change stat card styling |
| ~450–550 | `.aa-issues-section`, `.aa-issue-card` | Accessibility issue cards | **Change issue card appearance** |
| ~550–650 | `.aa-ui-issues-compact`, `.aa-ui-issues-tabs` | UI issues collapsible + tabs | **Change tabs, pagination styles** |
| ~650–750 | `.aa-top-fixes`, `.aa-recommendations` | Fixes and recommendations | Change suggestions styling |
| ~750–850 | `.aa-action-plan`, `.aa-best-practices` | Action plan and best practices | Change plan styling |
| ~850+ | `.aa-footer`, buttons, modals | Footer and export buttons | Change footer/button styles |

**Common tasks:**
- Change score colors (good/bad): search for `.aa-wave-score-circle.good`, `.warning`, `.bad`.
- Change category badge colors: search for `.aa-wave-category`.
- Make issue cards more compact: edit `.aa-issue-card` padding/margin.

---

### `demo.html`
Demo page that integrates the widget. Key areas:

| Line Range | Section | Purpose | When to Edit |
|------------|---------|---------|--------------|
| 1–50 | `<head>` | Styles, scripts | Add new dependencies |
| ~50–100 | `<ai-accelerator-widget>` | Widget element | Change widget attributes |
| ~100–200 | `showIssuesListModal()` | Modal for issue details | **Change modal rendering for issues** |
| ~200–300 | `triggerScan()` | Button handler to run scan | Change scan trigger behavior |
| ~300+ | Sample data / event handlers | Demo data and handlers | Add demo scenarios |

---

### `landing.html` / `landing.css`
Landing page and site-wide styles. Edit these for:
- Global page layout changes
- Site header/footer
- Severity color definitions (`.severity-critical`, etc.)

---

## Backend (orchestrator/)

### `index.js`
Express server and API endpoints.

| Line | Endpoint/Middleware | Purpose | When to Edit |
|------|---------------------|---------|--------------|
| 10 | `app.use(bodyParser.json())` | JSON body parsing | Change body size limit |
| 13 | CORS middleware | Allow cross-origin requests | Restrict origins |
| 25 | `app.use('/artifacts', ...)` | Serve screenshots/reports | Change artifact serving |
| 27 | `POST /run` | **Main scan endpoint** | **Change scan request handling, add params** |
| 73 | `GET /llm/test` | Test LLM connectivity | Change test behavior |
| 95 | `GET /meta` | Fetch page metadata | Change meta extraction |
| 131 | `GET /` | Health check | (rarely changed) |

**Common tasks:**
- Add new scan option (e.g., `ruleSet`): edit `POST /run` handler, pass to `runner.runTests()`.
- Change how analysis is saved: edit lines ~36–40 in `POST /run`.
- Add authentication: add middleware before routes.

---

### `llmClient.js`
LLM integration and deterministic analysis. **Primary file for LLM optimization.**

| Line | Function/Section | Purpose | When to Edit |
|------|------------------|---------|--------------|
| 1–10 | Config vars | `LLM_API_URL`, `LLM_API_TOKEN`, etc. | **Change LLM provider, model, timeouts** |
| 12–100 | `WCAG_DATABASE` | WCAG criteria metadata | Add/update WCAG rules |
| 100–270 | `FIX_SUGGESTIONS` | Fix suggestions per rule | **Add/improve fix suggestions** |
| 273 | `buildDeterministicAnalysis(report)` | Builds analysis from axe data (no LLM) | **Change score calculation, issue categorization** |
| 584 | `mergeWithLLMOutput(deterministic, llmParsed)` | Merges LLM output with deterministic | Change how LLM output is combined |
| 639 | `buildPrompt(report, templatePath)` | Builds prompt for LLM | **Change prompt format** |
| 730 | `localAnalyze(report)` | Local fallback (no LLM) | Change offline analysis |
| 738 | `analyzeWithLLM(report, opts)` | **Main entry point** | **Change LLM request/response handling, retries, streaming** |
| 1114 | `module.exports` | Exports | Add new exports |

**Common tasks:**
- Improve LLM summaries: edit `buildPrompt()` (line 639) and `templates/llm-prompts.md`.
- Change score formula: edit `buildDeterministicAnalysis()` (line 273).
- Add retry/backoff: edit `analyzeWithLLM()` (line 738).
- Support new LLM provider: edit lines 1–10 (config) and `analyzeWithLLM()`.

---

### `playwrightRunner.js`
Playwright + axe-core scanning.

| Line | Function/Section | Purpose | When to Edit |
|------|------------------|---------|--------------|
| 1–10 | Imports, constants | Dependencies, default breakpoints | **Change default breakpoints** |
| 14 | `runTests({ url, breakpoints, artifactDir })` | **Main scan function** | **Change scan logic** |
| 25 | Navigation timeout | `PLAYWRIGHT_NAV_TIMEOUT_MS` | Tune timeout |
| 28–60 | Navigation with fallback | `goto()` with networkidle → domcontentloaded | Change navigation strategy |
| 70–75 | axe-core injection | `addScriptTag()` + `axe.run()` | **Change axe rules** (e.g., `runOnly` tags) |
| 80–120 | Layout heuristics | Detect overflow, clipping | **Add/change layout checks** |
| 130–160 | Result assembly | Build result object | Change output format |

**Common tasks:**
- Add new breakpoint: edit `DEFAULT_BREAKPOINTS` (line 7).
- Change axe rules: edit line ~75 (`runOnly: { type: 'tag', values: [...] }`).
- Add new layout check: edit the `page.evaluate()` block (lines 80–120).
- Increase/decrease timeout: set `PLAYWRIGHT_NAV_TIMEOUT_MS` in `.env` or edit line 25.

---

### `templates/llm-prompts.md`
Prompt templates for the LLM. **First stop for prompt engineering.**

| Section | Purpose | When to Edit |
|---------|---------|--------------|
| System prompt | Sets LLM role and output format | Change tone, output structure |
| User prompt | Contains scan data and instructions | Change what data is sent |
| Examples | Few-shot examples | Improve quality with better examples |

**Common tasks:**
- Get better summaries: rewrite system prompt.
- Change output JSON schema: update prompt and `mergeWithLLMOutput()`.

---

### `reports/schema.json`
JSON schema for reports. Edit when:
- Adding new fields to reports
- Changing field types
- Validating report structure

---

## Config Files

| File | Purpose | When to Edit |
|------|---------|--------------|
| `orchestrator/.env` | API keys, URLs, timeouts | **Change LLM provider, secrets** |
| `orchestrator/.env.example` | Template for `.env` | Document new env vars |
| `orchestrator/package.json` | Dependencies, scripts | Add packages, npm scripts |
| `.gitignore` | Git exclusions | Add files to ignore |

---

## Quick Reference: Task → File

| Task | Primary File(s) |
|------|-----------------|
| Change report UI layout | `ui-agent/ai-accelerator-widget.js` → `_renderDashboard()` |
| Change score colors | `ui-agent/ai-accelerator-widget.css` → `.aa-wave-score-circle` |
| Change issue card design | `ui-agent/ai-accelerator-widget.js` → `_renderIssueCard()` |
| Add pagination to a section | `ui-agent/ai-accelerator-widget.js` → `_renderUIIssuesSection()` |
| Change LLM prompts | `templates/llm-prompts.md` |
| Change score calculation | `orchestrator/llmClient.js` → `buildDeterministicAnalysis()` |
| Add LLM retry/backoff | `orchestrator/llmClient.js` → `analyzeWithLLM()` |
| Change axe rules | `orchestrator/playwrightRunner.js` → axe.run() |
| Add new API endpoint | `orchestrator/index.js` → add `app.get/post()` |
| Change default breakpoints | `orchestrator/playwrightRunner.js` → `DEFAULT_BREAKPOINTS` |

---

## Run Commands

```bash
# Backend (port 3000)
cd orchestrator && npm install && node index.js

# Frontend (port 8000)
cd ui-agent && python3 -m http.server 8000

# Test LLM
cd orchestrator && node run_llm_test.js
```

---

*Generated 2026-02-03*
