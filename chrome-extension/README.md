# Vation Agent Chrome Extension

> **The only accessibility tool that generates working code fixes privately on your machine.**

Privacy-first accessibility scanner powered by AI. Runs axe-core in your browser, generates code fixes using cascading LLM backends, and never sends your data to the cloud without your explicit consent.

## 🔒 Privacy Architecture

```
Page Data ──▶ axe-core scan (in-browser, private)
                    │
                    ▼
              LLM Fix Router
                    │
    ┌───────────────┼───────────────────┐
    │               │                   │
    ▼               ▼                   ▼
window.ai       localhost           Cloud API
(Gemini Nano)   (Ollama)            (redacted)
🔒 Private      🔒 Private         ☁️ Redacted
    │               │                   │
    └───────────────┼───────────────────┘
                    │
              Deterministic fallback
              (rule-based, always works)
```

**Your data never leaves your machine** unless you explicitly opt into cloud mode — and even then, PII is stripped first.

## ✨ Features

- **One-click scanning** — Click the extension icon → "Scan This Page"
- **Issue highlighting** — Violations are outlined directly on the page with color-coded severity
- **AI-powered fixes** — Click "Fix it ✨" on any issue to get a working code patch
- **Cascading LLM** — Tries private options first (window.ai → Ollama), falls back to cloud only if opted in
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

# Make sure Ollama is running
ollama serve
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

| Backend | Privacy | Speed | Quality | Requirements |
|---------|---------|-------|---------|-------------|
| **window.ai** (Gemini Nano) | 🔒 Full | ⚡ Fast | ★★★ | Chrome 127+ with AI features |
| **Localhost** (Ollama) | 🔒 Full | 🔄 Medium | ★★★★ | Ollama + any model |
| **Cloud API** | ☁️ Redacted | 🔄 Medium | ★★★★★ | Opt-in required |
| **Deterministic** | 🔒 Full | ⚡ Instant | ★★ | Always available |

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
| `host_permissions: localhost:3000` | Connect to local Ollama server |

## License

MIT
