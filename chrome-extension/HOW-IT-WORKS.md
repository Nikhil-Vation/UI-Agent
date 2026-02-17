# Vation Agent — Under the Hood

> A complete technical deep-dive into how Vation Agent works, why it was built this way, and what makes it different from everything else on the market.

---

## Table of Contents

1. [Architecture at a Glance](#1-architecture-at-a-glance)
2. [Full Data Flow — Scan](#2-full-data-flow--scan)
3. [Full Data Flow — Fix](#3-full-data-flow--fix)
4. [The LLM Layer — What, Why, How](#4-the-llm-layer--what-why-how)
5. [Privacy & Security Deep-Dive](#5-privacy--security-deep-dive)
6. [PII Redaction Engine](#6-pii-redaction-engine)
7. [Export & Reporting Pipeline](#7-export--reporting-pipeline)
8. [Permissions — Why We Ask, Why We Don't](#8-permissions--why-we-ask-why-we-dont)
9. [Checklist — Hard Questions Answered](#9-checklist--hard-questions-answered)
10. [Competitive Differentiation](#10-competitive-differentiation)
11. [Technical Decisions — Why This, Not That](#11-technical-decisions--why-this-not-that)
12. [Limitations & Honest Trade-Offs](#12-limitations--honest-trade-offs)
13. [Tech Stack — Full Inventory](#13-tech-stack--full-inventory)
14. [Improvement Roadmap — Change X → Affects Y](#14-improvement-roadmap--change-x--affects-y)
15. [Lighthouse & SEO Optimization Tips](#15-lighthouse--seo-optimization-tips)
16. [Onboarding Intro & Typewriter Hero](#16-onboarding-intro--typewriter-hero)
17. [Mobile Responsiveness & Lazy Loading](#17-mobile-responsiveness--lazy-loading)

---

## 1. Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER (Chrome)                         │
│                                                                  │
│  ┌──────────┐    messages     ┌────────────────────┐             │
│  │  Popup   │ ◄─────────────► │  Service Worker    │             │
│  │ (UI/UX)  │                 │  (Central Hub)     │             │
│  │          │                 │                    │             │
│  │ • Score  │                 │ • Scan handler     │             │
│  │ • Issues │                 │ • Fix handler      │             │
│  │ • Export │                 │ • History store    │             │
│  │ • History│                 │ • Settings CRUD   │             │
│  └──────────┘                 │ • Badge updater   │             │
│                               └────────┬───────────┘             │
│                                        │                         │
│              ┌─────────────────────────┼─────────────────┐       │
│              │                         │                 │       │
│              ▼                         ▼                 ▼       │
│  ┌────────────────┐      ┌──────────────────┐  ┌──────────────┐ │
│  │  scanner.js    │      │  redactor.js     │  │ llm-router.js│ │
│  │  (Content)     │      │  (Content)       │  │ (Background) │ │
│  │                │      │                  │  │              │ │
│  │ • Highlighting │      │ • PII stripping  │  │ • Cascade:   │ │
│  │ • DOM context  │      │ • HTML redaction │  │   1. Nano    │ │
│  │ • Scroll-to    │      │ • URL redaction  │  │   2. Ollama  │ │
│  └────────────────┘      └──────────────────┘  │   3. Cloud   │ │
│                                                │   4. Rules   │ │
│  ┌────────────────┐                            └──────┬───────┘ │
│  │  axe-core      │                                   │         │
│  │  (MAIN world)  │                                   │         │
│  │  Injected at   │                                   │         │
│  │  scan time     │                                   │         │
│  └────────────────┘                                   │         │
│                                                       │         │
└───────────────────────────────────────────────────────┼─────────┘
                                                        │
                     ┌──────────────────────────────────┼──────┐
                     │          OPTIONAL / LOCAL                │
                     │                                         │
                     │  ┌──────────────────────────────────┐   │
                     │  │  Ollama (localhost:3000)          │   │
                     │  │  llama3.1:8b                      │   │
                     │  │  Orchestrator w/ Express           │   │
                     │  │  • POST /fix                       │   │
                     │  │  • GET  /health                    │   │
                     │  └──────────────────────────────────┘   │
                     │                                         │
                     └─────────────────────────────────────────┘
```

### Component Summary

| Component | Runs In | File | Purpose |
|-----------|---------|------|---------|
| **Popup** | Extension popup | `popup/popup.html`, `.js`, `.css` | User interface — scan trigger, results display, export, settings |
| **Service Worker** | Background (MV3) | `background/service-worker.js` | Central message router, scan orchestration, history, settings |
| **Scanner** | Content script (ISOLATED) | `content/scanner.js` | DOM highlighting, scroll-to-element, DOM context collection |
| **Redactor** | Content script (ISOLATED) | `content/redactor.js` | PII stripping before any data leaves the browser |
| **LLM Router** | Background (imported) | `lib/llm-router.js` | Cascading AI fix generation with 4-tier fallback |
| **axe-core** | Page (MAIN world) | `lib/axe.min.js` | Industry-standard accessibility engine (Deque, v4.10.2) |
| **Orchestrator** | Local server (Node.js) | `orchestrator/index.js` | Express API bridging the extension to Ollama LLM |

---

## 2. Full Data Flow — Scan

**What happens when you click "Scan Page":**

```
User clicks "Scan Page"
        │
        ▼
   ┌─────────────┐
   │  popup.js   │  Sends message: { action: 'scan-page' }
   └──────┬──────┘
          │  chrome.runtime.sendMessage()
          ▼
   ┌─────────────────────┐
   │  service-worker.js  │  handleScan(tabId)
   │                     │
   │  Step 1: Ensure content scripts are injected
   │          → Pings scanner.js. If no response, injects via
   │            chrome.scripting.executeScript()
   │
   │  Step 2: Inject axe-core into MAIN world
   │          → chrome.scripting.executeScript({
   │              target: { tabId },
   │              world: 'MAIN',        ◄── Critical! Not ISOLATED
   │              files: ['lib/axe.min.js']
   │            })
   │
   │  Step 3: Run axe.run() in MAIN world
   │          → chrome.scripting.executeScript({
   │              target: { tabId },
   │              world: 'MAIN',
   │              func: () => axe.run()  ◄── Accesses page's real DOM
   │            })
   │
   │  Step 4: Normalize results
   │          → normalizeAxeResults(rawResults)
   │          → Maps severity (critical/serious/moderate/minor)
   │          → Extracts WCAG tags (e.g. wcag2a, wcag2aa)
   │          → Calculates score: 100 - Σ(severity_weights × count)
   │            Weights: critical=15, serious=10, moderate=5, minor=2
   │
   │  Step 5: Build analysis
   │          → Sorts issues by severity
   │          → Calculates compliance status
   │          → Groups by category
   │
   │  Step 6: Store history
   │          → chrome.storage.local (max 200 entries, auto-prune)
   │
   │  Step 7: Auto-highlight issues on page
   │          → Sends highlight-issues message to scanner.js
   │
   │  Step 8: Update badge
   │          → Shows issue count on extension icon
   │
   └──────┬──────────────┘
          │  Returns { issues, score, analysis, timestamp }
          ▼
   ┌─────────────┐
   │  popup.js   │  Renders animated score ring, issue cards,
   │             │  severity badges, grade (A/B/C/F)
   │             │  Triggers confetti if score ≥ 90 🎉
   └─────────────┘
```

### Why MAIN World Injection?

This is the single most important technical decision in the scanner:

- **Content scripts run in an ISOLATED world** — they share the DOM tree but have a separate JavaScript context
- **axe-core needs to call `window.getComputedStyle()`**, traverse the live DOM, and access ARIA attributes
- If axe runs in ISOLATED world → it can't see page-injected styles, shadow DOM, or dynamic ARIA → **false negatives**
- **MAIN world injection** lets axe-core run in the page's own JavaScript context, giving it full access to the real DOM state
- The results are serialized and passed back to the service worker (structured cloneable data only)

### Scoring Algorithm

```
score = 100 - Σ(weight × count)

Weights:
  critical  → 15 points each
  serious   → 10 points each
  moderate  →  5 points each
  minor     →  2 points each

Floor: 0 (never negative)
```

| Score | Grade | Meaning |
|-------|-------|---------|
| 90–100 | A | Excellent — few/no issues |
| 70–89 | B | Good — minor issues |
| 50–69 | C | Needs work — significant issues |
| 0–49 | F | Failing — critical problems |

---

## 3. Full Data Flow — Fix

**What happens when you click "Fix it" on an issue:**

```
User clicks "Fix it" on an issue card
        │
        ▼
   ┌─────────────┐
   │  popup.js   │  Sends message: { action: 'fix-issue', issue: {...} }
   └──────┬──────┘
          │
          ▼
   ┌─────────────────────┐
   │  service-worker.js  │  handleFix(issue, tabId)
   │                     │
   │  Step 1: Load settings from chrome.storage.local
   │          → Gets privacy preferences, server URL
   │
   │  Step 2: Optionally redact PII (if cloud path is used)
   │          → Sends 'redact-issue' to redactor.js content script
   │          → Strips emails, phones, SSNs, API keys, etc.
   │
   │  Step 3: Call LLM Router
   │          → llmRouter.generateFix(issue)
   │
   └──────┬──────────────┘
          │
          ▼
   ┌─────────────────────┐
   │  llm-router.js      │  CASCADING FALLBACK
   │                     │
   │  Tier 1: window.ai (Gemini Nano)
   │  └─ Chrome's built-in on-device LLM
   │  └─ FREE, instant, 100% private
   │  └─ If available → use it, done.
   │
   │  Tier 2: Ollama (localhost:3000)
   │  └─ Local LLM via orchestrator
   │  └─ llama3.1:8b model
   │  └─ FREE, local, 100% private
   │  └─ Checks /health first
   │
   │  Tier 3: Cloud API (api.vation-agent.com)
   │  └─ Remote LLM endpoint
   │  └─ Data is PII-REDACTED before sending
   │  └─ Only used if Tier 1+2 fail
   │  └─ Requires optional_host_permissions
   │
   │  Tier 4: Deterministic Rules
   │  └─ Hardcoded fix patterns for 9 common issues
   │  └─ ALWAYS works, no AI needed
   │  └─ html-has-lang, image-alt, label, button-name,
   │     link-name, color-contrast, document-title,
   │     bypass, meta-viewport
   │
   └──────┬──────────────┘
          │  Returns { fixTitle, before, after, explanation, ... }
          ▼
   ┌─────────────┐
   │  popup.js   │  Shows fix modal with:
   │             │  • Before/After code diff
   │             │  • Copy button
   │             │  • Explanation
   │             │  • WCAG criteria resolved
   │             │  • Effort estimate (S/M/L)
   │             │  • Confidence score (0.0–1.0)
   └─────────────┘
```

### Fix All — Batch Mode

The "Fix All" button takes the **top 5 issues by severity** and processes them sequentially through the same LLM cascade. Each fix is independent. If one fails, the others still complete.

---

## 4. The LLM Layer — What, Why, How

### What Does the LLM Actually Do?

The LLM has **one job**: given an accessibility violation, generate a working code fix.

It does NOT:
- ❌ Scan the page (axe-core does that)
- ❌ Score the page (deterministic algorithm does that)
- ❌ Access the internet
- ❌ Store any data
- ❌ Make decisions about what to scan

It DOES:
- ✅ Read the issue metadata (type, severity, WCAG criteria, HTML snippet)
- ✅ Generate a `before` → `after` code patch
- ✅ Explain why the fix works in plain English
- ✅ Estimate effort (S/M/L) and confidence (0.0–1.0)

### The Prompt

Every fix request builds a structured prompt:

```
You are an expert web accessibility engineer.
Given this issue, generate a MINIMAL code fix.

ISSUE: [title, severity, WCAG criteria, HTML snippet]

RESPOND AS JSON ONLY:
{
  "fixTitle": "...",
  "before": "problematic code",
  "after": "fixed code",
  "explanation": "...",
  "wcagResolved": ["1.1.1"],
  "effort": "S",
  "confidence": 0.95
}
```

### The 4-Tier Cascade — Why?

| Tier | Backend | Cost | Privacy | Latency | When Used |
|------|---------|------|---------|---------|-----------|
| 1 | Gemini Nano (`window.ai`) | Free | 100% on-device | ~1–3s | Chrome ≥127 with AI flag enabled |
| 2 | Ollama (localhost) | Free | 100% local | ~3–15s | Ollama running with llama3.1:8b |
| 3 | Cloud API | Paid | PII-redacted first | ~2–5s | Tiers 1+2 unavailable |
| 4 | Deterministic Rules | Free | N/A | Instant | All AI backends fail / unknown rule |

**Why this order?**
- Privacy-first: We try the most private option first (on-device), then local, then cloud
- Cost-first: Free options exhaust before paid
- Reliability-last: Deterministic rules always work as ultimate fallback — the user never sees "fix failed"

### What If No LLM Is Available?

The extension **still works fully**. Scanning is 100% axe-core (no LLM). Fixes fall back to Tier 4 deterministic rules, which cover the 9 most common accessibility issues with hardcoded before/after patches. The experience degrades gracefully — never breaks.

---

## 5. Privacy & Security Deep-Dive

### The Core Promise

**By default, ZERO data leaves the browser.**

Here's why that's true:

| Operation | Where It Runs | Data Leaves Browser? |
|-----------|--------------|---------------------|
| Page scanning | axe-core in MAIN world | ❌ No |
| Score calculation | Service worker | ❌ No |
| Issue highlighting | Content script | ❌ No |
| History storage | chrome.storage.local | ❌ No |
| Export (JSON/CSV/HTML/PDF) | Popup script | ❌ No |
| Fix — Gemini Nano | On-device LLM | ❌ No |
| Fix — Ollama | localhost:3000 | ❌ No (localhost) |
| Fix — Cloud API | Remote server | ⚠️ Yes — but PII-redacted |
| Fix — Deterministic | In-memory rules | ❌ No |

### When Does Data Leave the Browser?

**Only when ALL of these are true simultaneously:**
1. User clicks "Fix it" on an issue
2. Gemini Nano is not available
3. Ollama is not running locally
4. Cloud API is enabled in settings
5. Even then → data is PII-redacted before transmission

### What Data Goes to the Cloud (When It Does)?

Only the **issue metadata** — never the full page content:
- Issue ID (e.g., `image-alt`)
- Severity level
- WCAG criteria tags
- HTML snippet (**redacted** — text content replaced with `[TEXT]`, attributes stripped)
- CSS selector (**redacted** — no identifying values)

What is **never** sent:
- ❌ Page URL (redacted — query params and fragments stripped)
- ❌ User input / form values
- ❌ Cookies, tokens, or session data
- ❌ Full page HTML
- ❌ Screenshots
- ❌ User identity

### Content Security Policy

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

- **`script-src 'self'`**: Only scripts bundled with the extension can run. No CDN, no inline scripts, no `eval()`.
- **`object-src 'self'`**: No external plugins or embeds.
- No remote code execution is possible.

### Storage Model

All data stored in `chrome.storage.local`:
- **Scan history**: Last 200 scans (auto-pruned). Structure: `{ url, score, issueCount, timestamp }`
- **Settings**: Privacy preferences, server URL, display options
- **No PII stored** — history only stores aggregate scores, not page content

---

## 6. PII Redaction Engine

**File:** `content/redactor.js` (260 lines)

### What Gets Redacted

| PII Type | Pattern | Example → Redacted |
|----------|---------|-------------------|
| Email | `user@domain.com` | `[EMAIL]` |
| Phone | `+1 (555) 123-4567` | `[PHONE]` |
| SSN | `123-45-6789` | `[SSN]` |
| Credit Card | `4111-1111-1111-1111` | `[CREDIT_CARD]` |
| IPv4 Address | `192.168.1.1` | `[IPv4]` |
| JWT Token | `eyJhbGci...` | `[JWT]` |
| API Key | `sk-abc123...` (32+ chars) | `[API_KEY]` |
| URL Tokens | `?token=abc&session=xyz` | Stripped entirely |

### How It Works

```
Issue arrives for cloud transmission
        │
        ▼
   redactIssue(issue)
   ├── Keep: id, severity, wcag tags
   ├── redactHTMLContent(html)
   │   └── Replace all text between tags with [TEXT]
   ├── redactHTMLAttributes(html)
   │   └── Strip value=, placeholder=, data-* attributes
   ├── redactString(selectors)
   │   └── Run all 7 PII regex patterns
   └── redactUrl(url)
       └── Strip query params and hash fragments

   Result: Safe, structural-only issue data
```

### Why Content Script, Not Service Worker?

The redactor runs as a content script because:
1. It needs to handle DOM-related data transformations
2. It's invoked via message passing from the service worker
3. Keeping it in the content layer maintains separation of concerns
4. It exposes `window.__uaRedactor` for the page to use if needed

---

## 7. Export & Reporting Pipeline

### Available Formats

| Format | Method | Opens In | Contains |
|--------|--------|----------|----------|
| **JSON** | Download | Text editor | Full structured scan data |
| **CSV** | Download | Excel/Sheets | Tabular issue list |
| **HTML Report** | New tab | Browser | Styled, branded report with all issues |
| **PDF** | Print dialog | PDF viewer | Full report via browser print-to-PDF |
| **Clipboard** | Copy | Paste anywhere | Quick-share summary text |

### HTML Report Architecture

The HTML report is a **self-contained, standalone page**:
- Full CSS embedded inline (no external dependencies)
- Vation Agent branding and dark theme
- Issue cards with severity badges
- Score ring visualization
- Metadata (URL, timestamp, scan duration)
- Opens in a new tab via `chrome.tabs.create({ url: dataUrl })`

### PDF Export

PDF uses the browser's native print engine:
1. Generates the same HTML report
2. Opens it in a new tab
3. Automatically triggers `window.print()` after 500ms delay
4. User saves as PDF via the system print dialog
5. No external PDF library needed — zero dependency

---

## 8. Permissions — Why We Ask, Why We Don't

### Permissions We Request

| Permission | Why We Need It | What It Can't Do |
|------------|---------------|-----------------|
| `activeTab` | Run axe-core on the current tab when user clicks scan | Can't access other tabs, can't run without user action |
| `scripting` | Inject axe-core into MAIN world for accurate scanning | Only executes our own bundled scripts |
| `storage` | Save scan history and user settings locally | Data never synced, never uploaded |

### Host Permissions

| Permission | Type | Why |
|------------|------|-----|
| `http://localhost:3000/*` | Required | Talk to local Ollama orchestrator for AI fixes |
| `https://api.vation-agent.com/*` | **Optional** | Cloud AI fallback — user must explicitly enable |

### Permissions We Do NOT Request

| Permission | Why We Don't Need It |
|------------|---------------------|
| `tabs` | We don't need to list or monitor all open tabs |
| `history` | We don't read browser history |
| `cookies` | We never access cookies |
| `webRequest` | We don't intercept network requests |
| `downloads` | Exports use data URLs, not the download API |
| `identity` | No user accounts, no login |
| `<all_urls>` host | We only access the active tab when user triggers scan |

---

## 9. Checklist — Hard Questions Answered

### 🔐 Security

| # | Question | Answer |
|---|----------|--------|
| 1 | **Is this extension secure?** | Yes. Manifest V3 with strict CSP (`script-src 'self'`). No eval, no remote scripts, no inline code execution. All code is bundled and auditable. |
| 2 | **Can it access my passwords or form data?** | No. axe-core reads DOM structure (elements, attributes, styles) — not input values. The redactor strips any PII if data goes to cloud. |
| 3 | **Can it modify web pages?** | Only visually (CSS highlights on issues). It never changes page HTML, submits forms, or alters functionality. Highlights are removed on "Clear". |
| 4 | **What if someone installs a malicious update?** | Chrome Web Store has review processes. The extension's CSP blocks loading any external scripts. The open-source codebase is fully auditable. |
| 5 | **Does it phone home?** | No. Zero telemetry, zero analytics, zero tracking. The only outbound request is the optional cloud fix API (user must enable). |

### 🔒 Privacy

| # | Question | Answer |
|---|----------|--------|
| 6 | **How does data remain within the browser?** | All scanning (axe-core), scoring (algorithm), highlighting (CSS), history (chrome.storage.local), and exports (data URLs) run entirely in-browser. No server needed for core functionality. |
| 7 | **Is scan data sent anywhere?** | Never. Scan results live in the service worker's memory and chrome.storage.local. They're never transmitted. |
| 8 | **What about the AI fixes?** | By default, fixes use on-device AI (Gemini Nano) or local Ollama — both 100% private. Cloud is opt-in and PII-redacted. |
| 9 | **Can my company use this on internal apps?** | Yes. Since scanning is entirely local, it's safe for intranet, staging, and pre-production environments. No data leaks to third parties. |
| 10 | **Is it GDPR / SOC2 compliant?** | By design, yes. No personal data collection, no data transmission (default mode), no cookies, no user tracking. No data processor agreement needed since no data is processed externally. |

### 🤖 LLM / AI

| # | Question | Answer |
|---|----------|--------|
| 11 | **What does the LLM do exactly?** | It generates code fixes for accessibility issues. Given `<img src="photo.jpg">`, it outputs `<img src="photo.jpg" alt="Description of photo">` with an explanation. |
| 12 | **Does the LLM scan the page?** | No. Scanning is 100% axe-core (deterministic, rule-based). The LLM only processes individual issues when user requests a fix. |
| 13 | **Can it work without any AI?** | Yes. Scanning works perfectly. Fixes fall back to deterministic rules (Tier 4) for the 9 most common issues. |
| 14 | **Is the AI response always correct?** | No AI is perfect. That's why we show a confidence score (0.0–1.0) and include before/after code for human review. The fix is a suggestion, not auto-applied. |
| 15 | **Which LLM model is used?** | Depends on the tier: Gemini Nano (on-device), llama3.1:8b (Ollama), or cloud model. User can configure in settings. |

### 📊 Reports

| # | Question | Answer |
|---|----------|--------|
| 16 | **Can I share reports with stakeholders?** | Yes. Export as HTML (self-contained, branded page), PDF (via print dialog), JSON (for developers), or CSV (for spreadsheets). |
| 17 | **Are reports stored on any server?** | No. Reports are generated client-side and saved to the user's local machine. |
| 18 | **Can I track progress over time?** | Yes. The History tab shows the last 200 scans with scores, dates, and trends. All stored in chrome.storage.local. |

### 🏗️ Architecture

| # | Question | Answer |
|---|----------|--------|
| 19 | **Why a Chrome Extension and not a web app?** | Extensions can inject scripts into any page (MAIN world), access the real DOM, and run locally. A web app can't scan third-party sites due to CORS/same-origin restrictions. |
| 20 | **Why Manifest V3?** | MV3 is Google's current standard. Service workers (vs background pages) use less memory, can't persist state secretly, and align with Chrome's security model. |
| 21 | **Why axe-core specifically?** | It's the industry standard (Deque Systems). Used by Google Lighthouse, Microsoft Accessibility Insights, and thousands of enterprises. 90+ rules covering WCAG 2.0/2.1/2.2 A/AA/AAA. |
| 22 | **Why not just use Lighthouse?** | Lighthouse is a full audit tool (performance, SEO, etc.) that runs in DevTools. Vation Agent is focused, real-time, and adds AI fixes — Lighthouse can't generate code patches. |

---

## 10. Competitive Differentiation

### Vation Agent vs. Existing Tools

| Feature | Vation Agent | axe DevTools | WAVE | Lighthouse | Accessibility Insights |
|---------|:------------:|:------------:|:----:|:----------:|:---------------------:|
| **AI Code Fixes** | ✅ LLM-generated patches | ❌ | ❌ | ❌ | ❌ |
| **Privacy-First (no data leaves)** | ✅ Default mode | ⚠️ Cloud features | ⚠️ Cloud service | ✅ Local | ✅ Local |
| **On-Device AI** | ✅ Gemini Nano | ❌ | ❌ | ❌ | ❌ |
| **Cascading LLM Fallback** | ✅ 4 tiers | ❌ | ❌ | ❌ | ❌ |
| **PII Redaction Layer** | ✅ 7 pattern types | ❌ | ❌ | ❌ | ❌ |
| **Real-Time Highlighting** | ✅ Severity-colored | ✅ | ✅ | ❌ | ✅ |
| **Score with Grade** | ✅ A/B/C/F + ring | ✅ Score only | ❌ | ✅ Score | ❌ |
| **Scan History** | ✅ 200 entries | ❌ | ❌ | ❌ | ❌ |
| **Multi-Format Export** | ✅ JSON/CSV/HTML/PDF/Clipboard | ✅ JSON/CSV | ❌ | ✅ JSON | ✅ JSON |
| **Fix All (Batch)** | ✅ Top 5 by severity | ❌ | ❌ | ❌ | ❌ |
| **Confetti on Perfect Score** | ✅ 🎉 | ❌ | ❌ | ❌ | ❌ |
| **Free** | ✅ Fully | ⚠️ Freemium | ✅ | ✅ | ✅ |
| **Open Source** | ✅ | ⚠️ Core only | ❌ | ✅ | ✅ |

### The 5 Selling Factors

1. **🤖 AI-Powered Fixes, Not Just Reports**
   Every other tool tells you *what's wrong*. Vation Agent tells you *how to fix it* — with working code. Click "Fix it" and get a copy-paste patch with explanation, confidence score, and effort estimate.

2. **🔒 Privacy-First Architecture**
   Zero data transmission by default. On-device AI (Gemini Nano) + local LLM (Ollama) = enterprise-safe for internal apps, staging environments, and regulated industries (healthcare, finance, government).

3. **🛡️ PII Redaction — Defense in Depth**
   Even when cloud AI is used, a 7-pattern redaction engine strips emails, SSNs, credit cards, API keys, JWTs, and more *before* any data leaves the browser. No other accessibility tool has this.

4. **⚡ Graceful Degradation — Never Breaks**
   4-tier fallback ensures fixes always work: Gemini Nano → Ollama → Cloud → Deterministic Rules. User never sees "service unavailable." The tool adapts to whatever infrastructure is available.

5. **📊 Actionable, Not Overwhelming**
   Score ring with letter grade (not just a number), severity filtering, one-click Fix All for top issues, confetti on success, and 5 export formats. Designed for developers AND managers to understand.

---

## 11. Technical Decisions — Why This, Not That

| Decision | Why This | Why Not That |
|----------|----------|-------------|
| **axe-core in MAIN world** | Full DOM access, accurate computed styles, real ARIA state | ISOLATED world → false negatives, can't read `getComputedStyle()` |
| **Service worker as hub** | MV3 requirement, no persistent background page, event-driven | Background page (MV2) → being deprecated, higher memory |
| **Message passing (not direct calls)** | Chrome's security model requires it between isolated contexts | Direct function calls → impossible across content/background boundary |
| **chrome.storage.local (not IndexedDB)** | Simpler API, syncs with extension lifecycle, auto-cleanup on uninstall | IndexedDB → overkill for settings + history, manual cleanup |
| **Data URLs for export (not downloads API)** | No `downloads` permission needed, works in popup context | Downloads API → requires extra permission, popup closes on download |
| **CSS highlighting (not DOM mutation)** | Non-destructive, easy to clear, doesn't break page functionality | DOM injection → could break page scripts, event handlers, or layouts |
| **Deterministic scoring (not LLM scoring)** | Consistent, reproducible, instant, no AI hallucination risk | LLM scoring → inconsistent between runs, slow, expensive |
| **Cascading LLM (not single provider)** | Resilient, privacy-graduated, works offline | Single provider → single point of failure, all-or-nothing privacy |

---

## 12. Limitations & Honest Trade-Offs

### What Vation Agent Cannot Do

| Limitation | Why | Workaround |
|-----------|-----|------------|
| **Cannot auto-apply fixes to the page** | Content scripts can't safely modify third-party DOM without breaking apps | Copy-paste the fix code into your source |
| **Doesn't test keyboard navigation** | axe-core tests DOM state, not user interaction flows | Manual keyboard testing still required |
| **Doesn't test screen reader behavior** | Can't run NVDA/JAWS/VoiceOver programmatically | Pair with manual screen reader testing |
| **LLM fixes may be imperfect** | AI generates suggestions, not guaranteed-correct patches | Confidence score shown; human review required |
| **Gemini Nano needs Chrome flags** | Still experimental (chrome://flags → #prompt-api-for-gemini-nano) | Falls back to Ollama or deterministic |
| **Ollama needs local setup** | Must install Ollama + pull model + run orchestrator | Extension works without it (Tier 3/4 fallback) |
| **Cannot scan PDFs or iframes** | Browser security blocks cross-origin frame access | Scan embedded content separately |
| **History limited to 200 entries** | Prevents unbounded storage growth | Export history before it rotates |

### What It Doesn't Claim To Be

- ❌ **Not a legal compliance certification tool** — it identifies WCAG issues but doesn't certify ADA/Section 508 compliance
- ❌ **Not a replacement for manual testing** — automated tools catch ~30-50% of accessibility issues (source: W3C WAI); the rest require human evaluation
- ❌ **Not a full WCAG 2.2 AAA audit** — focuses on A and AA criteria (the legal requirements)

---

## 13. Tech Stack — Full Inventory

### Chrome Extension (Frontend)

| Technology | Version | Role | Why Chosen |
|-----------|---------|------|------------|
| **Chrome Manifest V3** | MV3 | Extension framework | Google's current standard; service workers, stricter security model |
| **axe-core** | 4.10.2 | Accessibility scanning engine | Industry gold standard by Deque Systems. 90+ WCAG rules, used by Google/Microsoft |
| **Vanilla JavaScript (ES2022+)** | ES Modules | All extension logic | Zero dependencies = zero supply chain risk, tiny bundle, fast load |
| **CSS3 (Custom Properties)** | — | UI styling | Glassmorphism, animations, `backdrop-filter`, `@keyframes` — no CSS framework needed |
| **HTML5** | — | Popup structure | Semantic markup, data attributes for state management |
| **Chrome APIs** | — | Platform integration | `chrome.scripting`, `chrome.storage`, `chrome.tabs`, `chrome.runtime`, `chrome.action` |
| **Gemini Nano / window.ai** | Experimental | On-device LLM | Chrome's built-in AI — free, instant, 100% private |

### Orchestrator (Backend)

| Technology | Version | Role | Why Chosen |
|-----------|---------|------|------------|
| **Node.js** | 18+ | Runtime | Universal, async-native, npm ecosystem |
| **Express.js** | 4.x | HTTP server | Lightweight, battle-tested, minimal boilerplate |
| **Ollama** | Latest | Local LLM host | Run open-source models locally with one command. Free. |
| **llama3.1:8b** | 8B params | LLM model | Best quality-to-speed ratio at 8B params. Runs on 8GB RAM. |
| **Playwright** | Latest | Browser automation | Headless scanning, screenshots, multi-viewport testing |
| **dotenv** | — | Environment config | Keep secrets out of code |
| **body-parser** | — | Request parsing | Handle JSON payloads up to 10MB |

### Development & Build

| Tool | Purpose |
|------|---------|
| **No bundler** | Extension uses native ES modules — no Webpack/Vite/Rollup needed |
| **No transpiler** | Modern JS runs natively in Chrome — no Babel needed |
| **No CSS preprocessor** | CSS custom properties replace Sass/Less variables |
| **No package.json (extension)** | Zero npm dependencies in the extension = zero supply chain attacks |
| **Git** | Version control |
| **Chrome DevTools** | Debugging, extension reload, service worker inspection |

### Why No React/Vue/Angular?

| Reason | Detail |
|--------|--------|
| **Bundle size** | React adds ~45KB gzipped. Our entire popup JS is ~30KB raw. |
| **Startup speed** | Framework hydration takes 50-200ms. Vanilla DOM is instant. |
| **Supply chain risk** | `node_modules` in a Chrome extension = massive attack surface |
| **Complexity** | Popup has 3 tabs and a few modals. A framework would be overengineering. |
| **Extension constraints** | CSP blocks `eval()` — many frameworks need workarounds for this |
| **Maintenance** | No dependency updates, no breaking changes, no security patches to track |

> **Bottom line:** The extension has **zero npm dependencies**. The only external code is `axe-core` (bundled as a single file). This is a deliberate security and simplicity choice.

---

## 14. Improvement Roadmap — Change X → Affects Y

### 🔧 What You Can Change & What It Impacts

This section maps every major component to its downstream effects. Useful for planning upgrades.

### Scanning Engine

| If You Change... | It Affects... | Effort | Risk |
|-----------------|--------------|--------|------|
| **Upgrade axe-core** (e.g., 4.10 → 5.x) | New rules detected, possibly new severity mappings, score changes | S | Low — drop-in replacement of `lib/axe.min.js` |
| **Add custom axe rules** | More issues caught, need to update `normalizeAxeResults()` in service-worker | M | Medium — custom rules need WCAG mapping |
| **Switch to IBM Equal Access** | Different rule set, different result format, need full normalization rewrite | L | High — different API contract |
| **Add Lighthouse integration** | Performance + SEO + a11y in one scan, but much heavier (headless Chrome needed) | L | Medium — can't run Lighthouse inside extension easily |

### LLM Layer

| If You Change... | It Affects... | Effort | Risk |
|-----------------|--------------|--------|------|
| **Swap Ollama model** (e.g., llama3.1 → mistral) | Fix quality changes, may need prompt tuning, response format may differ | S | Low — just change model name in `.env` |
| **Add GPT-4o / Claude as cloud tier** | Better fix quality, need API key management, cost implications | M | Low — add new `_fixWithOpenAI()` method in llm-router |
| **Remove cloud tier entirely** | Simpler, more private, but no fallback if local AI is down | S | Low — just remove Tier 3 from cascade |
| **Fine-tune a model on a11y fixes** | Much better fix accuracy, need training data (~500 examples), hosting | L | Medium — model may overfit on specific patterns |
| **Upgrade Gemini Nano API** | `window.ai` API may change as it moves from experimental to stable | S | Medium — Google may change the API surface |

### UI / Popup

| If You Change... | It Affects... | Effort | Risk |
|-----------------|--------------|--------|------|
| **Add React/Vue** | Need bundler, CSP adjustments, larger bundle, but easier state management | L | Medium — significant architecture change |
| **Add dark/light theme toggle** | CSS custom properties make this easy, need to store preference | S | Low — CSS-only change + storage |
| **Add multi-language support (i18n)** | Need `chrome.i18n` API, `_locales/` folder, string extraction | M | Low — Chrome has built-in i18n support |
| **Add issue trend charts** | Need a charting lib (Chart.js ~60KB) or SVG-based custom charts | M | Low — additive feature |
| **Add automated re-scan** | Need `chrome.alarms` API, background scheduling, notification on regression | M | Medium — requires new permission |

### Privacy & Security

| If You Change... | It Affects... | Effort | Risk |
|-----------------|--------------|--------|------|
| **Add more PII patterns** | Better redaction, more regex = slightly slower redaction pass | S | Low — additive |
| **Enable cloud by default** | Faster fixes, but breaks "zero data out" promise, need user consent flow | S | High — trust/branding impact |
| **Add end-to-end encryption** | Cloud data encrypted before transmission, need key management | M | Medium — complexity increase |
| **Add user accounts** | Need `identity` permission, OAuth flow, server-side storage | L | High — fundamentally changes privacy model |

### Storage & History

| If You Change... | It Affects... | Effort | Risk |
|-----------------|--------------|--------|------|
| **Increase history limit** (200 → 1000) | More trend data, but `chrome.storage.local` has 10MB limit | S | Low — monitor storage usage |
| **Switch to IndexedDB** | Unlimited storage, better querying, but more complex API | M | Low — no permission change needed |
| **Add chrome.storage.sync** | History syncs across devices, but 100KB limit, exposes data to Google | S | High — privacy implications |
| **Add cloud backup** | Never lose data, but need server, auth, encryption | L | High — new infrastructure |

### Orchestrator / Backend

| If You Change... | It Affects... | Effort | Risk |
|-----------------|--------------|--------|------|
| **Switch Express → Fastify** | ~2x faster HTTP, similar API, need route migration | M | Low — compatible middleware |
| **Add rate limiting** | Prevents abuse, need `express-rate-limit` package | S | Low — additive |
| **Add authentication** | API key or JWT for `/fix` endpoint, prevents unauthorized use | M | Medium — extension needs to send auth headers |
| **Deploy orchestrator to cloud** | No local setup needed, but latency increases, need hosting | M | Medium — cost + security considerations |
| **Add WebSocket for live scan** | Real-time progress updates, need `ws` package, service worker changes | M | Medium — bidirectional comms complexity |

### Exports

| If You Change... | It Affects... | Effort | Risk |
|-----------------|--------------|--------|------|
| **Add true PDF library** (jsPDF/pdfmake) | Better PDF formatting, but adds ~200KB+ dependency | M | Low — additive |
| **Add SARIF export** | IDE integration (VS Code, GitHub), standard format for static analysis | S | Low — just a new JSON shape |
| **Add Jira/GitHub issue creation** | Direct workflow integration, need OAuth + API tokens | M | Medium — new permissions + auth |
| **Add scheduled email reports** | Need server-side email service, user auth, cron jobs | L | High — new infrastructure |

---

## 15. Lighthouse & SEO Optimization Tips

> Vation Agent focuses on **accessibility**, but accessibility improvements directly boost your **Lighthouse scores** and **SEO rankings**. Here's the full cross-over map.

### How Accessibility Fixes Improve Lighthouse Scores

Lighthouse has 5 categories. Accessibility fixes from Vation Agent directly impact **3 of them**:

```
┌─────────────────────────────────────────────────────┐
│                LIGHTHOUSE SCORES                     │
├──────────────────┬──────────────────────────────────┤
│ Category         │ Impact from Vation Agent Fixes    │
├──────────────────┼──────────────────────────────────┤
│ Accessibility    │ ████████████████████  DIRECT      │
│ SEO              │ ████████████░░░░░░░░  HIGH        │
│ Best Practices   │ ████████░░░░░░░░░░░░  MODERATE    │
│ Performance      │ ████░░░░░░░░░░░░░░░░  INDIRECT    │
│ PWA              │ ░░░░░░░░░░░░░░░░░░░░  NONE        │
└──────────────────┴──────────────────────────────────┘
```

### Accessibility Issues That Also Hurt Lighthouse SEO

These Vation Agent findings **double as SEO fixes**. Fix them once, improve two scores:

| Vation Agent Issue | Lighthouse A11y Impact | Lighthouse SEO Impact | Google Ranking Signal |
|-------------------|----------------------|---------------------|---------------------|
| **`html-has-lang`** | ⬆️ Screen readers know the language | ⬆️ Search engines index correct language | ✅ Yes — affects hreflang/i18n |
| **`document-title`** | ⬆️ Users identify the page | ⬆️ Title tag is #1 SEO ranking factor | ✅ Yes — appears in search results |
| **`image-alt`** | ⬆️ Blind users understand images | ⬆️ Google Images indexing, context signals | ✅ Yes — image search ranking |
| **`meta-viewport`** | ⬆️ Users can zoom | ⬆️ Mobile-friendliness signal | ✅ Yes — mobile-first indexing |
| **`link-name`** | ⬆️ Screen readers describe links | ⬆️ Anchor text is a ranking signal | ✅ Yes — link relevance |
| **`heading-order`** | ⬆️ Logical navigation | ⬆️ Heading structure helps crawlers understand content hierarchy | ✅ Yes — content structure |
| **`color-contrast`** | ⬆️ Low vision readability | ⚠️ Indirect — reduces bounce rate | ⚠️ Indirect — user engagement |
| **`bypass`** (skip link) | ⬆️ Keyboard navigation | ⚠️ Indirect — better UX | ⚠️ Indirect |

### 🚀 Quick Wins: Fix These First for Maximum Score Boost

#### Tier 1 — Instant Impact (fix in < 5 minutes, biggest score jump)

| Fix | A11y Score | SEO Score | How |
|-----|-----------|----------|-----|
| Add `<html lang="en">` | +3-5 | +2-3 | One attribute on root element |
| Add `<title>Page Name - Site</title>` | +3-5 | +5-8 | One tag in `<head>` |
| Add `alt` to all `<img>` | +5-15 | +3-5 | Describe each image's content |
| Fix viewport meta | +3-5 | +3-5 | Remove `maximum-scale=1` |

#### Tier 2 — Medium Effort (15–30 minutes, solid improvement)

| Fix | A11y Score | SEO Score | How |
|-----|-----------|----------|-----|
| Fix heading hierarchy (h1→h2→h3) | +2-5 | +2-3 | Restructure headings logically |
| Add labels to all form inputs | +5-10 | +1-2 | `<label for="id">` on every input |
| Fix color contrast (4.5:1 minimum) | +3-8 | +1 (bounce rate) | Darken text or lighten backgrounds |
| Add skip navigation link | +2-3 | — | `<a href="#main">Skip to content</a>` |

#### Tier 3 — Strategic (1+ hours, comprehensive improvement)

| Fix | A11y Score | SEO Score | How |
|-----|-----------|----------|-----|
| Add ARIA landmarks | +3-5 | +1-2 | `<main>`, `<nav>`, `<footer>` roles |
| Fix all ARIA attributes | +5-10 | — | Validate roles, states, properties |
| Add structured data (Schema.org) | — | +5-10 | JSON-LD in `<head>` |
| Optimize Core Web Vitals | — | +10-20 | LCP, FID, CLS improvements |

### 💡 Pro Tips: SEO Optimizations That Pair With Accessibility

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEO + ACCESSIBILITY SYNERGY                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SEMANTIC HTML = Better for Both                             │
│     ─────────────────────────────                               │
│     Use <header>, <main>, <nav>, <article>, <section>, <footer> │
│     instead of <div> soup.                                      │
│     → Screen readers navigate by landmarks                      │
│     → Crawlers understand page structure                        │
│     → Lighthouse rewards both                                   │
│                                                                 │
│  2. IMAGE ALT TEXT = A11y + Image SEO                           │
│     ─────────────────────────────────                           │
│     Bad:  alt="" (empty) or alt="IMG_3847.jpg"                  │
│     Good: alt="Team meeting in conference room with whiteboard" │
│     → Screen readers describe the image                         │
│     → Google Images ranks it for relevant searches              │
│                                                                 │
│  3. HEADING HIERARCHY = Navigation + Crawling                   │
│     ──────────────────────────────────────────                  │
│     Only ONE <h1> per page (your main topic).                   │
│     <h2> for sections, <h3> for subsections.                    │
│     → Screen reader users jump between headings                 │
│     → Google treats <h1> as primary topic signal                │
│                                                                 │
│  4. LINK TEXT = Usability + Anchor Text SEO                     │
│     ──────────────────────────────────────                      │
│     Bad:  <a href="/pricing">Click here</a>                    │
│     Good: <a href="/pricing">View pricing plans</a>            │
│     → Screen readers announce "View pricing plans, link"        │
│     → Google uses anchor text to understand target page         │
│                                                                 │
│  5. PAGE TITLE = #1 SEO Factor + Tab Identification             │
│     ──────────────────────────────────────────────              │
│     Pattern: "Primary Keyword - Secondary | Brand Name"         │
│     Example: "Accessibility Scanner - AI Fixes | Vation Agent"  │
│     → Appears in browser tab (a11y)                             │
│     → Appears in Google search results (SEO)                    │
│     → 50-60 characters max for full display                     │
│                                                                 │
│  6. META DESCRIPTION = CTR + Context                            │
│     ─────────────────────────────────                           │
│     Not directly an a11y issue, but:                            │
│     → Improves click-through rate from search results           │
│     → Pairs with <title> for complete search snippet            │
│     → 150-160 characters max                                    │
│                                                                 │
│  7. MOBILE FRIENDLINESS = Zoom + Mobile-First Index             │
│     ──────────────────────────────────────────────              │
│     Don't block zoom: remove maximum-scale=1                    │
│     → Users with low vision can zoom (a11y)                     │
│     → Google mobile-first indexing (SEO)                        │
│     → Touch targets ≥ 44×44px (both)                            │
│                                                                 │
│  8. PERFORMANCE = UX for Everyone                               │
│     ─────────────────────────────                               │
│     Slow pages hurt disabled users MORE:                        │
│     → Screen readers wait for DOM to settle                     │
│     → Jittery layouts cause motion sickness                     │
│     → CLS > 0.1 = bad for vestibular disorders + SEO            │
│     Fix: lazy-load images, minify CSS/JS, use CDN               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Lighthouse Score Cheat Sheet

| Category | What Lighthouse Checks | How Vation Agent Helps |
|----------|----------------------|----------------------|
| **Accessibility (25%)** | 50+ audits (names, labels, ARIA, contrast, focus, language) | Directly scans and fixes all of these |
| **SEO (25%)** | Title, meta description, hreflang, robots, canonical, mobile viewport, crawlability, structured data | Fixes title, lang, viewport, alt text, heading structure, link text — covers ~40% of SEO audits |
| **Best Practices (25%)** | HTTPS, no console errors, correct image aspect ratio, no deprecated APIs | Fixing ARIA errors reduces console warnings; proper img alt + dimensions help |
| **Performance (25%)** | LCP, FID/INP, CLS, resource loading, render-blocking | Indirect — proper semantic HTML reduces reflows; lazy alt text loading helps LCP |

### Vation Agent Score → Lighthouse Score Correlation

```
Vation Agent Score    Estimated Lighthouse A11y Score
──────────────────    ─────────────────────────────────
     95-100           →  95-100  (Excellent)
     80-94            →  85-95   (Good, minor issues)
     60-79            →  65-85   (Needs work)
     40-59            →  45-65   (Significant problems)
     0-39             →  20-50   (Critical failures)

Note: Not 1:1 — Lighthouse weighs some audits differently
and checks a few things axe-core doesn't (e.g., tabindex > 0).
```

### 🏆 The "Perfect 100" Checklist

Want a perfect Lighthouse Accessibility score? Fix everything Vation Agent finds, then verify these manually:

- [ ] All images have descriptive `alt` text (not `alt=""` unless decorative)
- [ ] `<html lang="en">` (or appropriate language code)
- [ ] `<title>` is unique and descriptive per page
- [ ] All form inputs have visible `<label>` elements
- [ ] Color contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- [ ] No `tabindex` values greater than 0
- [ ] All interactive elements have focus styles (`:focus-visible`)
- [ ] ARIA attributes are valid and complete
- [ ] Heading levels are sequential (no skipping h2 → h4)
- [ ] Skip navigation link exists and works
- [ ] No auto-playing media without controls
- [ ] Touch targets are ≥ 44×44 CSS pixels
- [ ] Page works at 200% zoom without horizontal scroll
- [ ] Videos have captions, audio has transcripts

### Want to improve SEO beyond accessibility? Also do:

- [ ] Add `<meta name="description" content="...">` (150-160 chars)
- [ ] Add `<link rel="canonical" href="...">` to prevent duplicate content
- [ ] Add Open Graph meta tags (`og:title`, `og:description`, `og:image`)
- [ ] Add structured data (JSON-LD) for rich search results
- [ ] Submit XML sitemap to Google Search Console
- [ ] Ensure all pages return proper HTTP status codes
- [ ] Enable HTTPS everywhere
- [ ] Optimize Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)

---

## 16. Onboarding Intro & Typewriter Hero

> First impressions matter. When a user installs Vation Agent and opens the popup for the first time, they see an **animated intro hero** that explains exactly what the extension does — then it **vanishes the moment they click Scan**.

### What the User Sees (Before First Scan)

```
┌──────────────────────────────────────────────┐
│  ♿ 🛡️ ✨                                     │
│                                              │
│  Make the Web Accessible|     ← typewriter   │
│               ↕ cycles through:              │
│  Accessible → SEO-Friendly → Lighthouse      │
│  Ready → Mobile Responsive → Lazy Load       │
│  Ready → Inclusive → WCAG Compliant →        │
│  Privacy Safe → (loops)                      │
│                                              │
│  Vation Agent scans any webpage for WCAG     │
│  accessibility issues, gives you an instant  │
│  score, and uses AI to generate code fixes   │
│  — all while keeping your data 100% private. │
│                                              │
│  ┌──────────────┐  ┌──────────────┐          │
│  │ 🔍 One-click  │  │ 🤖 AI-powered│          │
│  │    scan       │  │    fixes     │          │
│  ├──────────────┤  ├──────────────┤          │
│  │ 📱 Mobile     │  │ ⚡ Lazy load │          │
│  │ responsive   │  │    tips      │          │
│  ├──────────────┤  ├──────────────┤          │
│  │ 🔒 Privacy    │  │ 📊 Lighthouse│          │
│  │    first     │  │    tips      │          │
│  └──────────────┘  └──────────────┘          │
│                                              │
│              👇                               │
│      HIT SCAN TO GET STARTED                 │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │    🔍  Scan This Page                │   │
│   └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Typewriter Engine — Technical Details

| Parameter | Value | Why |
|-----------|-------|-----|
| **Type speed** | 80ms/char | Natural, readable typing feel |
| **Delete speed** | 45ms/char | Faster erase (feels deliberate) |
| **Pause after type** | 1800ms | Enough time to read the phrase |
| **Pause after delete** | 350ms | Brief beat before next word |
| **Phrase count** | 8 | Covers all major value props |
| **Loop** | Infinite | Until user clicks Scan |

**Phrases in order:**
1. `Accessible` — core mission
2. `SEO-Friendly` — SEO crossover value
3. `Lighthouse Ready` — performance angle
4. `Mobile Responsive` — responsive design awareness
5. `Lazy Load Ready` — performance optimization
6. `Inclusive` — human-centered design
7. `WCAG Compliant` — standards compliance
8. `Privacy Safe` — privacy-first promise

### Exit Animation

When the user clicks **Scan This Page**:

```
Frame 0ms:   intro-exit class added
             → opacity: 1 → 0
             → transform: scale(1) → scale(0.95)
             → translateY(0) → translateY(-20px)
             → max-height: 600px → 0
             → padding/margin collapse to 0

Frame 400ms: hidden class added → display: none
             Typewriter timer cleared (stopTypewriter())
```

The intro **never comes back** — after scan, the score card, issues, tabs, and tips take over the full viewport.

### Implementation Files

| File | What |
|------|------|
| `popup.html` | `#intro-hero` div — icon stack, title with `#typewriter-word` span, subtitle, 6 feature pills, bouncing arrow |
| `popup.js` | `TYPEWRITER_PHRASES[]`, `startTypewriter()`, `stopTypewriter()`, `tick()` recursive loop, cleanup in `handleScan()` |
| `popup.css` | `.intro-hero`, `.typewriter-word` gradient text, `.intro-cursor` blink, `.intro-feature` pop animations (6 staggered delays), `.intro-exit` collapse transition, `.intro-glow` pulsing orb |

### Animations Inventory

| Animation | Element | Keyframes | Duration |
|-----------|---------|-----------|----------|
| `introSlideIn` | `.intro-hero` | translateY(20px) → 0, scale(0.96) → 1 | 0.6s spring |
| `introGlowPulse` | `.intro-glow` | opacity 0.4↔0.8, scale 1↔1.15 | 3s infinite |
| `introIconFloat` | `.intro-icon` | translateY(0↔-4px) | 2.5s infinite (staggered 0/0.3/0.6s) |
| `introBlink` | `.intro-cursor` | opacity 1↔0 | 1s step-end infinite |
| `introFeaturePop` | `.intro-feature` | scale(0.85)→1, translateY(8px)→0 | 0.5s spring (staggered 0.15–0.65s) |
| `introBounce` | `.intro-arrow` | translateY(0↔4px) | 2s infinite |
| `gradientShift` | `.typewriter-word` | background-position shift | 4s infinite |

---

## 17. Mobile Responsiveness & Lazy Loading

> Vation Agent doesn't just **check** for accessibility — it actively advises on **mobile responsiveness** and **lazy loading**, two pillars of modern web performance that directly affect both user experience and search rankings.

### Why We Cover These

```
┌────────────────────────────────────────────────────────────────┐
│              THE A11Y ↔ PERFORMANCE TRIANGLE                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│                    Accessibility                               │
│                       ▲                                        │
│                      / \                                       │
│                     /   \                                      │
│                    /     \                                     │
│    Mobile ◄──────/───────\──────► Performance                  │
│  Responsive     Vation    Lazy Loading                         │
│                 Agent                                          │
│                                                                │
│  All three are Google ranking signals.                         │
│  Fix one → often improves the others.                          │
└────────────────────────────────────────────────────────────────┘
```

### Mobile Responsiveness — What We Check & Advise

| Check | Why It Matters | Vation Agent Advice |
|-------|---------------|--------------------|
| **`meta-viewport`** blocks zoom | Users with low vision can't zoom → WCAG 1.4.4 failure | Remove `maximum-scale=1` and `user-scalable=no` |
| **Touch targets < 44×44px** | Motor-impaired users can't tap small buttons | Increase padding/min-size to 44×44 CSS pixels |
| **No responsive meta tag** | Page isn't mobile-friendly → fails Google mobile audit | Add `<meta name="viewport" content="width=device-width, initial-scale=1">` |
| **Fixed widths** | Horizontal scroll on mobile = unusable | Use fluid layouts, `%`, `vw`, `max-width` |
| **Font sizes < 16px on mobile** | Unreadable without zoom | Use `clamp()` or media queries for fluid type |

#### Google's Mobile-First Indexing Impact

```
2016: Mobile-friendly as ranking signal
2018: Mobile-first indexing rollout
2021: Mobile-first indexing for ALL sites
2024: Mobile experience = THE experience for ranking

Vation Agent's meta-viewport check directly addresses this.
```

### Lazy Loading — What We Advise

| Technique | HTML | Impact | Tips Tab Shows |
|-----------|------|--------|----------------|
| **Native lazy loading** | `<img loading="lazy">` | Defers offscreen images → faster LCP | ✅ |
| **Iframe lazy loading** | `<iframe loading="lazy">` | Defers heavy embeds (maps, videos) | ✅ |
| **Responsive images** | `<img srcset="..." sizes="...">` | Serves correct size per viewport | ✅ |
| **Intersection Observer** | JS-based lazy load | Fallback for complex scenarios | ✅ (in SEO tips) |

#### How Lazy Loading Affects Lighthouse Scores

```
Without lazy loading:                With lazy loading:
┌──────────────────────┐            ┌──────────────────────┐
│ LCP: 4.2s  ⚠️ Poor   │            │ LCP: 1.8s  ✅ Good   │
│ TBT: 350ms ⚠️ Poor   │            │ TBT: 120ms ✅ Good   │
│ CLS: 0.15  ⚠️ Poor   │            │ CLS: 0.05  ✅ Good   │
│                      │            │                      │
│ Performance: 45      │            │ Performance: 88      │
└──────────────────────┘            └──────────────────────┘

One attribute (loading="lazy") can boost Performance by 30-40 points.
```

### Where These Tips Appear in the Extension

| Location | What Shows |
|----------|------------|
| **Intro Hero** | 📱 "Mobile responsive" + ⚡ "Lazy loading tips" feature pills |
| **Typewriter** | "Mobile Responsive" and "Lazy Load Ready" rotate in title |
| **Tips Tab → SEO Crossover** | 📱 Mobile responsiveness tip (high impact, lighthouse + seo tags) |
| **Tips Tab → SEO Crossover** | 🖼️ Lazy load images & iframes tip (high impact, lighthouse tag) |
| **Tips Tab → SEO Crossover** | 🎯 Responsive images tip (medium impact, lighthouse tag) |
| **Tips Tab → Quick Wins** | `meta-viewport` fix surfaces as quick win if detected |
| **ISSUE_IMPACT_MAP** | `meta-viewport` entry: seoImpact=high, lhBoost=5, quickWin=true |

### The 8 GENERAL_SEO_TIPS (Full List)

These always display in the Tips → SEO Crossover section after scanning:

| # | Icon | Tip | Impact | Tags |
|---|------|-----|--------|------|
| 1 | 📝 | Add meta description (150-160 chars) | High | seo |
| 2 | 🔗 | Add canonical URL | Medium | seo |
| 3 | 📱 | Open Graph tags | Medium | seo |
| 4 | 📊 | Structured data (JSON-LD) | High | seo |
| 5 | ⚡ | Core Web Vitals (LCP/INP/CLS) | High | lighthouse, seo |
| 6 | 📱 | **Mobile responsiveness** — fluid layouts, media queries, mobile-first indexing | High | lighthouse, seo |
| 7 | 🖼️ | **Lazy load images & iframes** — `loading="lazy"`, reduces LCP | High | lighthouse |
| 8 | 🎯 | **Responsive images** — `srcset` + `sizes` for right size per screen | Medium | lighthouse |

### Lazy Loading Quick Reference

```html
<!-- ✅ Native image lazy loading -->
<img src="photo.jpg" alt="Team photo" loading="lazy" width="800" height="600">

<!-- ✅ Responsive image with lazy loading -->
<img srcset="photo-400.jpg 400w, photo-800.jpg 800w, photo-1200.jpg 1200w"
     sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px"
     src="photo-800.jpg"
     alt="Team photo"
     loading="lazy"
     width="800" height="600">

<!-- ✅ Iframe lazy loading -->
<iframe src="https://maps.google.com/..." loading="lazy" title="Office location"></iframe>

<!-- ✅ Responsive viewport meta -->
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- ❌ DON'T block zoom -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

---

## Quick Reference Card

```
┌────────────────────────────────────────────┐
│          VATION AGENT — QUICK REF          │
├────────────────────────────────────────────┤
│ Scan:     ⌘⇧A  or click extension icon    │
│ Engine:   axe-core 4.10.2 (Deque)          │
│ AI Tiers: Nano → Ollama → Cloud → Rules   │
│ Privacy:  Zero data out (default)          │
│ History:  200 scans (chrome.storage)       │
│ Export:   JSON · CSV · HTML · PDF · Copy   │
│ Score:    0-100, Grade A/B/C/F             │
│ Weights:  Crit=15, Ser=10, Mod=5, Min=2   │
│ Manifest: V3, Service Worker, Strict CSP   │
│ Intro:    Typewriter hero (8 phrases)      │
│ Tips:     8 SEO/Perf tips (mobile + lazy)  │
│ License:  Open Source                      │
└────────────────────────────────────────────┘
```

---

*Built with privacy in mind, powered by AI, grounded in standards.*
