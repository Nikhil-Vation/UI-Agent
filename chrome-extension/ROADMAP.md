# Roadmap — Chrome Extension

Execution plan. Phases are ordered by dependency, not ambition: each one makes the next
cheaper. Effort uses the S/M/L scale already used in the fix objects.

Status key: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Phase 0 — Credibility (do before any external demo) ✅ COMPLETE

Nothing here is a feature. All of it is "the product contradicts itself," which is the
fastest way to lose a technical evaluator.

- [x] **0.1 — Close the redaction bypass** · S
  Added `LLMRouter._cloudAllowed(config)` — `privacyMode` is now the master switch and a saved
  API key is not on its own consent. Both `generateFix` and `generateFullAnalysis` gate their
  provider branch on it, and provider results are tagged `private: false` instead of `true`.
  In the service worker, `redactIfCloudReachable()` redacts anything that could leave the
  machine and **fails closed** — if the redactor is unreachable it strips `html` and `nodes`
  rather than sending them raw.
  *Verified:* with `privacyMode` on and a real key set, a fix request attempts **zero** network
  calls and falls through to deterministic.

- [x] **0.2 — Reconcile the manifest privacy claim** · S
  Description is now "Private by default — cloud AI is opt-in and redacted." README's privacy
  section and backend table rewritten to match the actual cascade.

- [x] **0.3 — Unify the product name** · S
  **SiteScope 360** everywhere — manifest, README, service worker, scanner, redactor, popup,
  console prefixes, and the `scanSource` metadata field.
  *Deliberately not renamed:* the `api.accea-agent.com` hosted endpoint, which is
  infrastructure rather than branding.

- [x] **0.4 — Brand-aware contrast fixes** · S
  `pickAccessiblePair()` selects from the page's own palette in `designInfo.colors`, choosing
  the **lowest** passing pair at ≥ 4.5:1 — maximizing contrast always collapses to black on
  white, which is the fix designers reject. `designInfo` is now plumbed through all four popup
  `fix` call sites into the deterministic engine. Black on white remains the explicit fallback
  when no palette pair clears the bar, and the explanation says so rather than pretending.

- [x] **0.5 — UI credibility pass** · S
  Added after a reviewer's annotated feedback questioned whether the tool was substantive.
  - **Removed a fabricated statistic.** "~N% of visitors can't use your site" was computed as
    `Math.round(totalIssues / 3) + 4` and presented as a measurement. It now reports the issue
    count that was actually measured and cites the external figures (CDC, AIR) as external.
  - **Grade and compliance status no longer contradict each other.** Any score ≥ 70 previously
    returned "Grade A — meets WCAG 2.1 AA", which could sit beside an "At Risk" status on the
    same card. Grade A now requires score ≥ 90 with zero critical violations, and the wording
    narrowed to "passes all automated WCAG 2.1 AA checks" — automated checks are roughly a
    third of WCAG, so the old phrasing overclaimed.
  - Removed confetti on high scores and the cycling typewriter on the intro; hid the demo tier
    selector that duplicated the plan badge beside it.

- [x] **0.6 — Report content pass** · S
  Audit of the Business Impact and UX Analysis copy. **Four factual corrections:**
  - "Google is penalising your site" — accessibility is not a Google ranking factor and there
    is no penalty. Rewritten around semantic markup, which is true and sufficient.
  - "$55,000–$150,000 before proceedings even begin" — those are DOJ civil penalty maximums
    ($75k first / $150k subsequent), not pre-proceeding costs.
  - "Stanford research shows users judge credibility within 50 milliseconds" — that finding is
    Lindgaard et al. at Carleton, and measures visual appeal, not contrast.
  - Advice to advertise "WCAG 2.1 AA compliance" in investor and client materials off an
    automated scan. Automated checks cover roughly a third of WCAG; the user carries the
    consequences of a claim they cannot support.

  **Credibility:** removed aesthetic verdicts the tool has no standing to make ("signals a lack
  of design rigour", "hallmark of an inconsistent design system"), compressed content-free
  "good" cards to a single measured line, and replaced fear headlines with descriptive ones.
  Where a measurement has known confounders — font families inflated by weights and third-party
  embeds, contrast unmeasurable over images — the card now says so.

---

## Phase 1 — Make the fix leave the browser ✅ COMPLETE

Today `applyPatch` mutates the live DOM and the change dies on refresh. Until this phase
lands, the honest answer to "then what?" is "a developer does the real work."

- [x] **1.1 — Copy-as-diff** · S
  `lib/fix-export.js` renders any fix as a unified-diff-style patch with a "Copy Diff" button
  in the fix modal. The hunk header carries the **CSS selector, not a line number** — the scan
  runs against a rendered page, so the source location genuinely isn't known and inventing one
  would be worse than naming the element. Also exports a whole session as one document, with
  the verified count in the header. Directly answers the "no code can be fixed in browser"
  objection: the change now survives the refresh that discards the live DOM edit.

- [x] **1.2 — Framework-aware output** · M
  `lib/framework.js` detects the framework from the already-collected tech stack and converts
  the fix before it is shown, copied, or exported as a diff. The fix modal tags the dialect.

  **The scope is honestly narrower than it looks.** Vue, Angular and Svelte templates accept
  plain HTML attributes — `class` and `for` are correct in all three — so there is nothing to
  convert, and the card says exactly that rather than inventing a difference to appear
  thorough. JSX is the real exception and is where the work went: attribute spelling
  (`class`→`className`, bare booleans included), inline `style` to a camelCased object with CSS
  custom properties quoted and preserved, and explicit self-closing for void elements.

  `aria-*` and `data-*` are deliberately passed through untouched — JSX takes them verbatim,
  and renaming them would silently break the very attributes an accessibility fix depends on.

- [x] **1.3 — Export the whole session** · S
  `buildSessionExport` existed and was tested but was never wired to anything. Now an **All
  Fixes** export card, producing one patch file with the verified count in the header.

---

## Phase 2 — Upgrade how the model is used ✅ COMPLETE

The model is currently a one-shot text transformer: prompt in, JSON out, no feedback, no
ability to ask questions. This phase is the largest quality jump per line changed.

- [x] **2.1 — Structured output / tool calling** · M
  Two canonical schemas (`FIX_SCHEMA`, `FULL_ANALYSIS_SCHEMA`) are now sent to every provider
  in its own dialect: Gemini `responseSchema`, OpenAI strict `json_schema`, Anthropic forced
  tool use (the Messages API has no `response_format`), Mistral `json_schema`. Schemas are
  adapted per provider by `toStrictSchema` / `toGeminiSchema` because Gemini rejects
  `additionalProperties` while OpenAI strict mode requires it.
  The full-analysis wire format changed from an object keyed by rule ID to an **array** with a
  `ruleId` field — dynamic keys cannot be expressed in strict schema dialects —
  and `normalizeFullAnalysis` folds it back, still accepting the legacy keyed shape the local
  server returns. On-device passes the schema via `responseConstraint`, falling back cleanly on
  older Chrome builds.
  *Done:* the greedy `match(/\{[\s\S]*\}/)` is gone. Schema-less backends now use
  `extractJsonObject`, a depth-tracking scanner that ignores braces inside string literals —
  the old regex spanned first brace to *last* brace anywhere in the response, so any trailing
  prose containing `}` broke it. Regression test confirms the old regex failed on an input the
  new scanner handles.

- [x] **2.2 — Expose DOM inspection as tools** · M
  `lib/dom-tools.js` defines `get_dom_context`, `get_computed_style`, `query_selector_all` and
  `get_sibling_context`, with a multi-turn loop in `_callProviderWithTools` implemented for all
  four providers.

  **Design choice:** the final answer is itself a tool (`submit_fix`). One mechanism across all
  four dialects — the model calls inspection tools until it knows enough, then submits — instead
  of a per-provider "are we done" heuristic.

  `get_computed_style` walks up the ancestor chain to find the **effective background**: a
  transparent background resolves to the nearest painted ancestor, which is what actually sits
  behind the text. Contrast is not solvable without it and it appears nowhere in the markup.

  Safety: the loop is capped at 4 rounds and falls back to the single-shot schema call if the
  model never submits; tool errors are returned as `{error}` rather than thrown, since an
  exception would kill the whole fix request. Tools are only offered when the request is already
  allowed to reach a provider — tool results describe the page, so exposing them under privacy
  mode would reopen the hole 0.1 closed.

- [x] **2.3 — Self-verifying remediation loop** · M
  `remediateIssue()` in `popup.js` runs generate → apply → re-scan → cleared? On failure it
  undoes the patch, appends the failed attempt to context, and retries (cap 3). Surfaced as a
  **Fix & Verify** button with live progress and an honest give-up message naming how many
  approaches were tried.

  **The trap this had to avoid:** `generateFix` short-circuits to the deterministic handler at
  confidence ≥ 0.7, and that handler is a pure function of the issue — so a retry would return
  the byte-identical fix that just failed, forever. The short-circuit is now skipped once any
  attempt has failed; a failed attempt is exactly the signal that the case needs judgement
  rather than a rule.

  Failed attempts are passed to every backend — a test caught that `_fixWithProvider` built its
  own prompt and was silently dropping them, which would have made the loop retry blind.

- [x] **2.4 — Confidence-gated autonomy** · S
  `autonomyFor(fix)` returns `auto` / `flag` / `propose` at 0.9 and 0.7. Wired into Apply All,
  which now reports what it held back as prominently as what it applied — a silent skip reads
  as a failure, and an unexplained edit reads as a liberty. A missing confidence is treated as
  low, never high.

- [x] **2.5 — Fix cache** · S
  `elementSignature()` reduces an element to tag + sorted classes + role + type, discarding id
  and text — so forty instances of one component share a signature and cost one inference.
  30-minute TTL, mirroring `lighthouseCache`.
  **Retries bypass the cache**, or the loop from 2.3 would be handed back the very fix that just
  failed verification.

- [x] **2.6 — Tiered model routing** · S
  `_backendOrder()` uses the deterministic engine's confidence as a free difficulty signal: a
  nearly-solved issue leads with the free on-device model, a hard one leads with the strong model
  that carries the page tools from 2.2. Privacy mode removes the cloud tier from the order
  entirely rather than relying on a later check.

- [x] **2.7 — Batch by default** · S
  `prefetchSuggestions` already led with `analyze-all`, but the pass that followed it — which
  exists only to recover the rule engine's `_patchHint` metadata — called `fix` per issue with
  no restriction. Any issue whose deterministic confidence fell below 0.7 escalated to a model,
  so **one batched call silently became one call per issue** on exactly the hard pages where
  batching matters most.
  Added `config.deterministicOnly`, which returns the rule engine's answer and consults no
  backend at all. Tool wiring is skipped for those requests too, since they can never reach a
  model.

---

## Phase 3 — Find what rules cannot ✅ COMPLETE

Automated rules catch roughly a third of WCAG failures. This phase is the only genuinely
defensible AI territory, and nothing here is sold by competing scanners.

- [x] **3.1 — Judgment layer** · M
  `lib/judgment.js` finds problems on elements that **pass** axe and Lighthouse, which is why
  every finding carries `passedAutomated: true`.

  **Deterministic core** (no model, no network, same answer every time — what makes it
  demonstrable in front of a skeptic): alt text that is a filename (`IMG_4471.jpg`), alt that
  only names the medium ("image", "logo"), redundant "photo of" prefixes, over-long alt, vague
  link text ("click here", "read more"), raw URLs as link text, identical link text pointing at
  different destinations (invisible unless you compare links to each other), **headings that
  name nothing about their section** ("Overview", "Section 3"), **three or more sections sharing
  one heading** (two is normal and not flagged — the threshold exists because false positives
  cost more here than a missed finding), and **form error messages that are correctly wired up
  but say nothing actionable** ("Invalid input" passes every `aria-invalid` check while telling
  nobody what to fix).

  **LLM nuance pass** (`lib/judgment-llm.js`, optional, gated on `cloudReachable()` exactly like
  vision): a schema-constrained call over what the heuristics already let through, looking only
  for cases that read as fine but are actually misleading — alt text that's grammatically
  correct but wrong, a specific-sounding heading unrelated to what follows it. The prompt states
  outright that a false positive costs more than a missed finding, and fails silently on error
  so a network hiccup can never degrade the deterministic panel underneath it.

- [x] **3.2 — Vision analysis** · M
  `lib/vision.js` captures the visible tab (`chrome.tabs.captureVisibleTab`) and sends it to a
  multimodal model with a prompt that explicitly excludes anything checkable from markup — no
  point reporting a missing alt attribute twice. Findings are normalized into the same shape as
  judgment findings (`passedAutomated: true`, same fields) so they land in one panel rather than
  a separate UI.

  All four providers implemented with their actual multimodal shapes — Gemini `inlineData`,
  Anthropic base64 `image` source via forced tool use, OpenAI/Mistral `image_url` data URLs —
  schema-constrained the same way text fixes are (2.1), not asked nicely for JSON.

  **Gated on `cloudReachable()`**, the identical check that governs every other cloud-reaching
  path. A screenshot is page content; privacy mode has to cover it exactly like DOM text, or the
  redaction work in 0.1 would have a hole shaped like an image.

- [x] **3.3 — Alt text from the image itself** · S
  A **Describe with AI** button on `alt-text-quality` judgment findings fetches the image's
  actual pixels and asks a vision model what it shows — not a screenshot of the viewport, the
  specific `<img>` src, so it works for any flagged image regardless of scroll position.
  Deliberately a separate, cheaper call from the full-page vision pass in 3.2: most `image-alt`
  problems don't need a screenshot of the whole page.

- [x] **3.4 — Keyboard and focus simulation** · M
  `lib/keyboard.js` measures focus behaviour on the running page and merges its findings into
  the same "Beyond automated checks" panel. No model, no network.

  The measurement that matters: it **actually focuses each control and diffs the computed
  style** before and after. Whether focus is visible is a property of the page running, not of
  its markup, which is exactly why axe cannot answer it.

  Detects: invisible focus, focus landing off-screen, tab order diverging from visual order
  (naming positive `tabindex` as the cause when that is the cause), interactive elements with no
  keyboard access, and a dialog that leaves the page behind it focusable.

  **Scope stated honestly in the file:** detecting an arbitrary focus trap needs real key events
  and a handler that may call `preventDefault`. That is not done, and is not claimed. Everything
  above is structural and measurable.

  The order check tolerates modest divergence — real layouts are never perfectly linear, and a
  finding that fires on every page is noise rather than signal.

- [x] **3.5 — Reading-order mismatch** · M
  `lib/reading-order.js`, merged into the same judgment panel. Two tiers: a **mechanical, zero-
  false-positive check** — any element with a non-zero CSS `order` is flagged directly and cites
  the actual value, because that's the author admitting the visual position was moved away from
  the DOM position, no heuristic required — and a heuristic pass comparing DOM order to a
  row-then-column visual reading for everything else, tolerant of the normal amount of
  divergence in a real layout.

- [x] **3.6 — Component-level dedupe** · M — *satisfied by existing infrastructure, not a new module*
  Three mechanisms already do this: `elementSignature()` (2.5) caches one fix per element shape
  so forty instances of one broken component cost one inference; `groupFindings()` (3.1)
  collapses repeated judgment findings into one card with an `×N` chip and a **Show me**
  walker; and axe itself already groups violation nodes under one rule with an element count.
  Building a fourth, separate dedupe layer on top would have duplicated work these already do —
  the honest completion here was recognizing that, not writing more code.

- [x] **3.7 — Screen reader announcement preview** · M
  `lib/screenreader.js` renders what a screen reader would say moving through the page —
  focusable controls, headings and landmarks, in order. Exported from the **Screen Reader**
  card; sequence-level findings merge into the same judgment panel.

  Implements accessible-name computation in specification precedence order:
  `aria-labelledby` → `aria-label` → `label[for]` → wrapping label → `alt` / `value` /
  `placeholder` → text content → `title`.

  **The finding only this can produce:** three or more controls in a row that announce
  identically. Each is individually valid — axe passes them all — but heard one after another
  there is no way to tell them apart. Non-consecutive repeats are deliberately not flagged;
  the problem is the sequence, not the repetition.

  **Stated as an approximation, in the transcript itself.** Real output varies by screen reader,
  verbosity setting and browser. Presenting this as literal JAWS or VoiceOver output would be
  the easiest thing here to overclaim, so the document says what it is.

- [x] **3.8 — Impairment simulation** · S
  `lib/impairment.js` — six presets (protanopia, deuteranopia, tritanopia, achromatopsia, low
  vision, contrast-sensitivity loss) as a dropdown next to the severity filters. Color-blindness
  presets use the standard Brettel/Viénot `feColorMatrix` approximations — the same technique
  Chrome DevTools uses for its own vision emulation, not invented here. No model, no network,
  applied directly via `chrome.scripting.executeScript` against the real page rather than a
  content-script message round-trip.

  **This is the cheapest, most persuasive thing in the product to demo.** The effect is visible
  on the reviewer's own page in under a second and needs zero explanation — nobody has to be
  told what deuteranopia does once they're looking through the filter.

---

## Phase 4 — From tool to platform ✅ COMPLETE

- [x] **4.1 — Multi-page crawl** · M
  `lib/crawl.js` handles sitemap parsing, URL filtering and estate-level aggregation; the
  service worker drives background tabs; **Scan Whole Site** in the Export tab runs it.

  Decisions worth keeping:
  - **A `sitemapindex` is resolved one level deeper.** Treating it as a urlset would return
    `.xml` files and scan nothing useful — large sites almost always publish an index.
  - **Same-origin is a hard rule.** Crawling off-site would scan third parties who never
    consented to it.
  - **Tabs are scanned sequentially and closed in a `finally`.** Parallel tabs race for CPU and
    destabilise axe results, and a failed scan must not leak tabs.
  - **Failed pages are counted separately and excluded from the average.** A page that could
    not be reached is not a page with zero issues; averaging it in would flatter the score.
  - **The report leads with rules that fail across many pages** — that is one systemic fix, not
    N separate ones.
  - **Permissions are requested at first use**, not declared up front. `tabs` and host access
    are optional in the manifest; users who never crawl never see the prompt, which matters for
    an extension selling on privacy.
- [x] **4.2 — Ambient background scanning** · M
  `lib/ambient.js` — pure decision logic, wired into `chrome.tabs.onUpdated` for regular
  navigation and a `chrome.runtime` message from the content script for in-page SPA route
  changes (detected by polling `location.href` every 1.5s — monkey-patching `history.pushState`
  from an isolated-world content script does not intercept the page's own calls to it, since the
  two JS realms don't share function identity even though they share the DOM; polling is slower
  but actually works).

  **The trust boundary that makes this safe to ship:** `shouldAmbientScan` refuses to touch any
  URL that has no prior entry in scan history — ambient scanning only ever widens what happens
  to pages the user already scanned manually once, never which pages get scanned. `detectRegression`
  only ever reports a regression; an improvement or a flat result is silent, because a page
  getting better in the background is not worth interrupting anyone for. Opt-in, off by default,
  and the `notifications` permission is requested only when the setting is turned on.
- [x] **4.3 — Natural language chat over the scan** · M
  `lib/chat.js` splits into two pieces on purpose: `interpretChatCommand` (schema-constrained,
  same discipline as every other model call in the product) turns the instruction into a bounded
  plan, and `applyChatPlan` — pure, no network — is what actually selects issues from that plan.
  The model can only ever narrow the result to real rule ids that exist on the page; a malformed
  or empty plan matches **nothing**, never "everything" as a fallback. `applyFilteredIssues`
  reuses the identical generate → confidence-gate → apply path as the existing Apply All button,
  because a chat instruction has to be trusted exactly as much as clicking the button, not more.
- [x] **4.4 — Historical trend and score** · S
  `lib/trend.js` turns the existing `scanHistory` into a per-URL arc — a sparkline plus a delta
  from first scan to latest, shown on each history card once more than one scan exists for that
  page. `direction` is `'flat'` below a small threshold, deliberately, so a one-point run-to-run
  wobble doesn't get announced as an improvement or a regression it isn't.

---

## Phase 5 — Reach the compliance budget ✅ COMPLETE

Compliance budgets are roughly an order of magnitude larger than developer-tool budgets, and
`verify-patches` already produces the evidence these buyers need.

- [x] **5.1 — Evidence pack export** · M
  `lib/evidence.js` builds a dated *Accessibility Remediation Record* — found / verified /
  applied-but-unconfirmed / outstanding, WCAG-mapped, with the generating source and confidence
  for each fix. Exported as Markdown from the Export tab.

  **The distinction the whole document rests on:** "applied" and "verified" are separate states.
  A patch that was applied but never re-scanned is reported as applied, never as fixed. Only an
  issue confirmed *absent by a fresh scan* is called verified — `verifiedIssueIds` is populated
  solely from re-scan results, never from "we applied a patch".

  Scope limitations are in the body of the report, not a footnote: automated testing covers
  roughly a third of WCAG, manual review is required for conformance, and the record closes by
  stating outright that it is not a conformance claim. A reader who finds a disclosed limitation
  trusts the rest; one who finds a hidden one trusts none of it.
- [x] **5.2 — Decision audit trail** · S
  `lib/audit-log.js` records `applied` / `verified` / `failed` / `undone` events with the rule,
  the generating model, its confidence, and the autonomy band. Persisted in
  `chrome.storage.local` by the service worker, so the record outlives the popup — the evidence
  pack now derives its status from the log rather than in-memory sets.

  **Event-sourced, not a mutable status.** A fix applied, rolled back, then reapplied is three
  facts and a compliance reader is entitled to all three; a status field would silently erase
  the middle one. Current state is always derived by `summarizeAudit`, never stored.

  The rule that matters most: **`undone` clears verification.** A fix that was verified and then
  rolled back is not on the page, and reporting it as verified would be the most misleading
  thing this log could do. A later `failed` re-scan revokes it too. Entries are ordered by
  timestamp rather than array position, so out-of-order writes cannot change the outcome.

  Logging is fire-and-forget: a failure to write must never block the fix the user asked for.
- [x] **5.3 — VPAT / ACR draft generation** · M
  `lib/vpat.js` produces a criterion-by-criterion draft against a catalog of the WCAG 2.1 A/AA
  success criteria this product has real test coverage paths for.

  **The constraint that shapes the whole file:** a criterion can never be marked "Supports" —
  automated and heuristic testing covers a fraction of what any single criterion actually
  requires, and claiming full support would repeat the exact overclaim the evidence pack (5.1)
  and the report-content pass (0.6) already exist to prevent. Three honest states only: **Does
  Not Support** (an unresolved violation was found), **Partially Supports** (every violation
  found was fixed and verified, but the criterion covers more than any scanner can check), and
  **Not Evaluated** (nothing in this scan tests it). An unresolved reference to a criterion
  always wins over a verified one elsewhere — one open violation is what a reader needs to know.
  The rendered document states outright, twice, that it is a draft requiring expert review
  before submission.
- [x] **5.4 — Business-risk translation** · S
  `lib/risk.js`, folded into the evidence export. Deliberately **reuses** the DOJ penalty
  figures, lawsuit count, and CDC/AIR statistics already corrected during the 0.6 report-content
  pass, rather than re-deriving new copy that could reintroduce the same overclaims — the
  fabricated "~4% of visitors" statistic that pass removed is exactly the kind of number this
  module is built never to produce again. It states outright that it cannot know what fraction
  of a given site's actual traffic is affected without real analytics, and does not compute one.

---

## Phase 6 — Commercial packaging ✅ COMPLETE

- [x] **6.1 — Agency / white-label mode** · M
  `lib/branding.js` — a local list of client profiles (name, contact, color) stored in
  `chrome.storage.local`, stamped onto the evidence record, VPAT, session export and crawl
  report when a profile is active. Additive by construction: `applyBranding` returns the
  document completely unchanged with no profile selected, so every export still works with zero
  setup. Client-entered names are stripped of markdown-breaking characters before being placed
  into a heading, so a client called `Evil | # Corp` can't corrupt the document structure.
  No sync, no accounts — "multi-client" means a dropdown on the agency's own machine.
- [x] **6.2 — Opt-in team sync** · L
  `lib/team-sync.js` — a portable JSON bundle a team member explicitly exports and shares
  however they already share files, and another explicitly imports. No backend, no account,
  nothing transmits automatically. Metadata-only is enforced structurally, not by convention:
  the bundle builder only ever reads `auditLog` and `scanHistory` — there is no code path
  through which an API key could end up in an exported file.

  Import is additive and deduped against the real existing local data (matched on
  issue+event+timestamp for audit entries, url+timestamp for scan history) before anything is
  written, so importing the same bundle twice — or a bundle two teammates both received — adds
  nothing the second time and never drops what was already there.
- [x] **6.3 — Public score badge** · S
  `lib/badge.js` — a self-contained SVG, no external fonts or resources. "Verifiable" is scoped
  honestly: there is no backend to host a live verification service, so instead the score is a
  real `<text>` element (inspectable by view-source, not baked into a raster image), the scan
  date is printed on the badge itself so staleness is visible rather than hidden, and the
  embed snippet states outright that this reflects one point-in-time scan and tells the user to
  re-scan and replace it to stay current — rather than implying a live feed that doesn't exist.
- [x] **6.4 — Token cost meter** · S
  `lib/cost-meter.js` (chars/4 token approximation, published list pricing) wired into
  `LLMRouter` via an injectable `setUsageRecorder` callback fired from the single `post` helper
  both `_callProvider` and `_callProviderWithTools` funnel every real network call through — one
  choke point, so every round of the multi-turn tool loop is captured, not just top-level calls.
  Persisted by the service worker, shown in Settings, always labeled an estimate: an unknown
  provider or malformed input costs $0 rather than throwing, because usage tracking must never
  be able to break the fix it's measuring.
  **Scoped honestly:** only the fix-generation path is metered. Vision, chat and the judgment
  nuance pass are comparatively rare, one-shot, user-triggered actions and are not separately
  tracked — stated here rather than left to look like an oversight.
- [x] **6.5 — Pull request generation** · L — *source mapping deliberately not attempted*
  `lib/github.js` opens a real branch, commits a real patch document, and opens a real PR
  against a repo the user connects with their own token (stored locally, sent only to
  api.github.com, requested as an optional permission at first use — same BYO-credential
  pattern as every LLM provider key).

  **What this does not do, on purpose:** blindly rewrite a file in the user's repository. Tracing
  a live DOM node back to the exact source file and line in an arbitrary, unknown codebase is not
  reliably solvable from a browser extension — no build tooling access, no way to know which of
  possibly several files produced a given element, no way to confirm a text replacement wouldn't
  break a template or a string used elsewhere. Fabricating that confidence would repeat the exact
  mistake 1.1 already declined to make when it chose a CSS selector over an invented line number.
  So the PR body states outright, in its own text, that it documents each fix for human review
  rather than rewriting files automatically — real infrastructure, honestly bounded, instead of a
  half-built claim of full automation.

---

## Status: 37/37 shipped

Every phase closed. **0.1, 1.1, 2.2, 2.3, 5.1** were the load-bearing five if only five had
gotten built — privacy gate, exportable fixes, model tools, the verify loop, the evidence
pack — and they support the claim nothing else in this market currently can: *it finds the
issues, fixes them, proves the fixes worked, and documents what it could not handle and why.*

Everything built after that widened the same claim rather than replacing it: the judgment
layer (3.x) finds what Lighthouse and axe structurally cannot; the platform phase (4.x) scales
it to an estate and a conversation; the compliance phase (5.x) turns it into a filable
document; the packaging phase (6.x) makes it something an agency, a team, and a developer's own
repo can actually use — without weakening the privacy architecture anywhere along the way.

The discipline that mattered more than any single feature: **every module that touches an
external claim states its own limits in its own output** — the evidence pack distinguishes
applied from verified, the VPAT never claims "Supports," the risk summary never fabricates a
percentage, the badge admits it isn't live, the PR body says it doesn't rewrite files. That
consistency, held across 37 separately-shippable pieces, is the actual product.
