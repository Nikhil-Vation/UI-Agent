Extension: UI-Agent accessibility quick-scan

Setup (local dev):
1. Ensure `orchestrator` dependencies are installed (contains `axe-core`):
   cd orchestrator && npm install
2. Copy the official axe bundle into the extension package:
   cd orchestrator && npm run copy-axe-to-extension
   (this copies `node_modules/axe-core/axe.min.js` → `extension/src/content/axe-core.min.js`)
3. Load the extension in Chrome: `chrome://extensions` → Load unpacked → select `extension/` folder.

Notes:
- The content script now uses `runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] }` to match the orchestrator Playwright runner.
- If `axe-core` vendor bundle isn't copied, a small fallback shim will run (development only).
- The background worker validates schema and forwards results to `/run` for enrichment.
