# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Scope

Active work is the **Chrome extension in `chrome-extension/`**. Answer questions and make
changes grounded in that folder unless told otherwise.

The repo also contains `orchestrator/` (Node + Playwright + axe service) and `ui-agent/`
(landing and pricing pages). These are not the current focus. The extension does call a
localhost orchestrator endpoint from `lib/llm-router.js` — that code path is in scope, the
orchestrator's own implementation is not.

## Commands

The extension has **no build step, no package.json, no test suite, and no linter.** It is
plain ES modules loaded directly by Chrome.

```bash
# Load the extension
# 1. chrome://extensions/  → enable Developer mode
# 2. "Load unpacked" → select the chrome-extension/ folder
# 3. After editing background/ or lib/, click the reload icon on the extension card.
#    Popup and content script edits only need the popup reopened / page refreshed.

# Refresh the vendored axe-core build (only when upgrading it)
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" \
  -o chrome-extension/lib/axe.min.js
```

Debugging: the service worker has its own console via the "service worker" link on the
extension card. Content script logs (`[Accea Scanner]`) appear in the page console. Popup
logs appear in the popup's own inspector.

`lib/keys.js` is gitignored and never committed. It holds a local PageSpeed API key for
development and must be created by hand — the extension works without it, only the
Lighthouse panel degrades.

## Architecture

```
popup/popup.js  ──{action}──▶  background/service-worker.js  ──{type}──▶  content/scanner.js
                                        │                                 content/redactor.js
                                        ▼
                                 lib/llm-router.js  ──▶  on-device | cloud provider | localhost
```

### Two message vocabularies

This trips people up. Messages to the **service worker** are keyed on `action` and dispatched
from a handler map at the top of `service-worker.js`. Messages from the service worker to
**content scripts** are keyed on `type`. Adding a feature usually means registering both.

### axe runs in the MAIN world, not the content script

Content scripts live in an isolated world and cannot see `window.axe`, even after injecting a
`<script>` tag. So scanning is done by the service worker via
`chrome.scripting.executeScript({ world: 'MAIN' })`, which injects `lib/axe.min.js` and runs
`axe.run()` in the page's own context.

`content/scanner.js` therefore does **not** scan. It handles highlighting, spotlight/scroll,
DOM context collection, and applying/undoing patches.

The same MAIN-world injection is repeated in `handleVerifyPatches`, which calls `axe.reset()`
before re-running so the patched DOM is analyzed fresh rather than from cache.

### Content scripts are injected on demand

`ensureContentScripts(tabId)` pings the tab and injects `scanner.js` / `redactor.js` if there
is no response. `sendToTab` wraps this with a retry, so content scripts do not need to already
be present. Chrome's own pages (`chrome://`, the Web Store) cannot be injected and will fail.

### LLM routing

`lib/llm-router.js` is the whole AI layer. Two entry points:

- **`generateFix(issue, ...)`** — single issue. Critically, it tries `_deterministicFix` **first**
  and returns immediately if confidence ≥ 0.7, so the model is never called for the common
  cases. `_deterministicFix` holds ~40 hand-written rule handlers that parse the real element
  HTML (deriving alt text from the `src` filename, label text from the input `name`, and so on).
  A handler returning `null` means "too complex, fall through to the LLM."
- **`generateFullAnalysis(issues, ...)`** — every violation in one prompt, plus detected tech
  stack and brand colors. Returns a page-level summary, priority ordering, action plan, and
  fixes keyed by rule ID. This is the agentic path.

Backend cascade: `window.ai` (Chrome on-device) → configured cloud provider → localhost:3000 →
hosted API → deterministic fallback. `_callProvider` implements Gemini, OpenAI, Anthropic and
Mistral behind one interface; the user supplies their own key via `chrome.storage.local`.

**Responses are schema-enforced, not parsed hopefully.** `FIX_SCHEMA` and
`FULL_ANALYSIS_SCHEMA` are the single source of truth, translated per provider —
`toGeminiSchema` strips `additionalProperties` (Gemini rejects it), `toStrictSchema` adds it
(OpenAI and Mistral strict mode require it). Anthropic has no `response_format`, so schema
conformance is achieved with a forced tool call and the result read from the `tool_use` block.
`_callProvider` therefore returns a **parsed object**, not text.

The full-analysis wire format carries `fixes` as an **array** with a `ruleId` on each entry,
because dynamic object keys cannot be expressed in strict schema dialects.
`normalizeFullAnalysis` folds it back into the keyed object the popup expects and still accepts
the legacy keyed shape returned by the local server.

Backends that cannot enforce a schema (on-device, local server) fall back to
`extractJsonObject`, a depth-tracking scanner that respects string literals and escapes. Do not
reintroduce a regex here — a greedy `\{[\s\S]*\}` spans to the last brace in the whole response
and breaks on trailing prose.

### Patch system

Deterministic fixes carry `_patchHint` metadata describing *how* to apply the change rather
than just what the result looks like — `attribute`, `remove-attribute`, `css`, `innerHTML`,
`outerHTML`, `insertAdjacent` (with `_insertPosition`), and `childRole`. `applyPatch` in
`scanner.js` interprets these and records the previous value in an `appliedPatches` map keyed
by patch ID, which is what makes `undo-patch` and `reset-patches` work.

The intended loop is: `scan` → `fix` → `apply-patch` → `verify-patches` (re-scan proves the
violation cleared) → `mark-patched` (swaps the red outline for a green one).

### Judgment layer

`lib/judgment.js` finds problems on elements that **pass** axe and Lighthouse — filename alt
text, generic alt, vague link text, and identical link text pointing at different destinations
(which no rule engine can express, since each link is individually valid). Every finding carries
`passedAutomated: true`; that flag is the product claim, not decoration.

It runs pure heuristics — no model, no network — so results are instant and identical every run.
`collectJudgmentCandidates` is serialized into the MAIN world by `chrome.scripting`, so it must
stay self-contained with no imports or module-scope closure. When adding checks, weight the
tests toward false negatives: one wrong flag costs more credibility than ten missed issues.

### Fix export

`lib/fix-export.js` renders a fix as a unified-diff-style patch. It is a **classic script**, not
a module — the popup is not a module — and attaches to `globalThis.FixExport`; it is loaded by a
`<script>` tag in `popup.html` before `popup.js`. Hunk headers carry the CSS selector, never a
line number: the scan runs against a rendered page, so the source location is genuinely unknown
and a fabricated line number would be worse than an honest selector.

### Privacy model

`content/redactor.js` strips PII, form values, placeholders, `data-*` attributes and all text
between tags. It runs as a content script and is invoked by message (`redact-issue`,
`redact-scan`, …). Settings default to `privacyMode: true`, `cloudOptIn: false`.

**`privacyMode` is the master switch.** While it is on, `LLMRouter._cloudAllowed()` returns
false and no third-party provider is contacted — a saved API key is not on its own consent.
When cloud is reachable, `redactIfCloudReachable()` in the service worker redacts first and
**fails closed**: if the redactor cannot be reached it strips `html` and `nodes` rather than
transmitting them raw. Results returned from a provider are tagged `private: false`.

Deterministic contrast fixes read the page's palette from `config.designInfo.colors` and pick
the *lowest passing* pair at ≥ 4.5:1 — lowest, because maximizing contrast always collapses to
black on white, which is the fix designers reject. Black on white remains the explicit fallback
when no palette pair can clear the threshold, and the explanation says so.

## Known gaps

Verified in the current code — do not treat these as intentional.

- **`lib/auth.js` points at localhost placeholders** (`AUTH_API_URL`, `CHECKOUT_URL`) marked TODO.
- **The hosted fallback still uses the old `api.accea-agent.com` domain** in `lib/llm-router.js`
  and `manifest.json` `optional_host_permissions`. Left as-is because it is infrastructure
  rather than branding; rename only alongside the actual endpoint.
- **Provider structured-output support is version-sensitive.** Strict `json_schema` needs a
  recent OpenAI/Mistral model, and `responseConstraint` needs a recent Chrome. The on-device
  path degrades gracefully; the provider path will surface an API error rather than silently
  falling back, which is intentional — a silent downgrade is what 2.1 removed.
