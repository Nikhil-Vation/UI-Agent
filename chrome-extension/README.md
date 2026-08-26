# SiteScope 360 Chrome Extension

> **The only accessibility tool that generates working code fixes privately on your machine.**

Privacy-first accessibility scanner powered by AI. Runs axe-core in your browser, generates code fixes using cascading LLM backends, and never sends your data to the cloud without your explicit consent.

## 🔒 Privacy Architecture

```
Page Data ──▶ axe-core scan (in-browser, private)
                    │
                    ▼
            Deterministic rule engine
            (~40 rules, no model, free)
                    │  confidence < 0.7
                    ▼
              LLM Fix Router
                    │
    ┌───────────────┼───────────────────┐
    │               │                   │
    ▼               ▼                   ▼
window.ai       localhost         Cloud provider
(On-device)     (Local LLM)       (BYO API key)
🔒 Private      🔒 Private         ☁️ Redacted
    │               │                   │
    └───────────────┼───────────────────┘
                    │
              Deterministic fallback
              (rule-based, always works)
```

**Privacy Mode is the master switch and defaults to ON.** While it is on, no cloud
provider is contacted — not even one you have saved an API key for. Turning it off
enables the cloud tiers, and everything sent is redacted first; if the redactor cannot
be reached, the element HTML is withheld rather than sent raw.

## ✨ Features

- **One-click scanning** — Click the extension icon → "Scan This Page"
- **Issue highlighting** — Violations are outlined directly on the page with color-coded severity
- **AI-powered fixes** — Click "Fix it ✨" on any issue to get a working code patch
- **Cascading LLM** — Tries private options first (on-device AI → local LLM), falls back to cloud only if opted in
- **Data redaction** — PII, cookies, form values, and text content are stripped before any cloud calls
- **WCAG scoring** — Compliance score with severity breakdown
- **Scan history** — Track accessibility improvements over time

## 🚀 Installation

### From Source (Developer)

1. Clone the repo and navigate to the extension:
   ```bash
   cd chrome-extension
   ```

2. Download axe-core (if not already present):
   ```bash
   curl -sL "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js" -o lib/axe.min.js
   ```

3. Open Chrome → `chrome://extensions/`

4. Enable **Developer mode** (top right)

5. Click **Load unpacked** → select the `chrome-extension` folder

6. Pin the extension to your toolbar

### Optional: Local LLM Server

For AI-powered fixes without any cloud dependency:

```bash
# Start the orchestrator (from project root)
cd orchestrator && npm start

# Make sure your local LLM backend is running
# (e.g. start your preferred model server)
```

The extension will auto-detect the local server at `http://localhost:3000`.

## 📁 File Structure

```
chrome-extension/
├── manifest.json              # Manifest V3 config
├── background/
│   └── service-worker.js      # Central coordinator
├── content/
│   ├── scanner.js             # axe-core scanner (runs in page)
│   └── redactor.js            # PII/data redaction layer
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup controller
│   └── popup.css              # Dark theme styles
├── lib/
│   ├── axe.min.js             # axe-core accessibility engine
│   └── llm-router.js          # Cascading LLM fallback
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Privacy Mode | ✅ On | No data leaves your machine |
| Cloud LLM | ❌ Off | Allow cloud API (data redacted first) |
| Server URL | `localhost:3000` | Local orchestrator endpoint |
| Auto-highlight | ✅ On | Outline issues on page after scan |
| Badge count | ✅ On | Show issue count on extension icon |

## 🧠 LLM Backends

Tried in order. The deterministic engine runs **first** and short-circuits the rest
whenever it is confident (≥ 0.7), so most fixes never reach a model at all.

| Backend | Privacy | Speed | Quality | Requirements |
|---------|---------|-------|---------|-------------|
| **Deterministic** | 🔒 Full | ⚡ Instant | ★★★ | Always available — tried first |
| **On-device AI** | 🔒 Full | ⚡ Fast | ★★★ | Chrome 127+ with AI features |
| **Cloud provider** | ☁️ Redacted | 🔄 Medium | ★★★★★ | Your own key + Privacy Mode off |
| **Local LLM** | 🔒 Full | 🔄 Medium | ★★★★ | Any compatible model server |
| **Hosted API** | ☁️ Redacted | 🔄 Medium | ★★★★ | Opt-in required |

Supported cloud providers: Gemini, OpenAI, Anthropic, Mistral — all bring-your-own-key.

## 🛡️ What Gets Redacted

When cloud mode is enabled, the redactor strips:

- ✂️ Email addresses, phone numbers, SSNs
- ✂️ Credit card numbers, API keys, JWTs
- ✂️ Form input values, placeholder text
- ✂️ Text content between HTML tags
- ✂️ URL query parameters with tokens
- ✂️ Data attributes (non-ARIA)
- ✂️ Page title and document content

What's **kept** (needed for accurate fixes):
- ✅ Tag names and structure
- ✅ CSS class names and IDs
- ✅ ARIA attributes (presence only)
- ✅ Axe rule IDs and descriptions
- ✅ WCAG criteria references
- ✅ Element selectors (values redacted)

## 📋 Permissions Explained

| Permission | Why |
|-----------|-----|
| `activeTab` | Access the current tab to run scans |
| `scripting` | Inject axe-core and scanner into pages |
| `storage` | Save settings and scan history locally |
| `host_permissions: localhost:3000` | Connect to local LLM server |

## License

MIT
