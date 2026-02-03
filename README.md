# AI UI & Accessibility Testing — POC

This repository contains a proof-of-concept for an AI-powered UI and accessibility testing assistant. The POC includes a Node.js orchestrator and a Playwright-based runner that captures screenshots, DOM snapshots and runs `axe-core` accessibility scans.

Quick start

1. Install dependencies

```bash
cd "$(dirname "$0")"/orchestrator
npm install
npx playwright install
```

2. Run the orchestrator

```bash
cd orchestrator
npm start
# Server will listen on http://localhost:3000
```

3. Run a test (example)

```bash
curl -X POST http://localhost:3000/run -H 'Content-Type: application/json' -d '{"url":"https://example.com"}'
```

Notes

- `npx playwright install` is required to install browser binaries.
- After running, check `orchestrator/artifacts` for screenshots and JSON output.
