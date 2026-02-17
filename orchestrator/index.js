require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const runner = require('./playwrightRunner');
const llm = require('./llmClient');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// Simple CORS to allow demo pages running on other ports to call this API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const ARTIFACT_DIR = path.join(__dirname, 'artifacts');
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

// Serve artifacts (screenshots, reports) as static files at /artifacts
app.use('/artifacts', express.static(ARTIFACT_DIR));

app.post('/run', async (req, res) => {
  // Accept two invocation styles:
  // 1) legacy/orchestrator: { url, breakpoints } -> run Playwright tests (unchanged)
  // 2) extension upload: { url, deterministic, axe } -> validate, log, return summary
  const { url, breakpoints, deterministic, axe } = req.body || {};

  // If the request looks like an extension upload (deterministic/axe present) handle it here
  if (deterministic || axe) {
    // Validation
    if (!url) return res.status(400).json({ error: 'Missing url in body' });
    if (!deterministic) return res.status(400).json({ error: 'Missing deterministic in body' });
    if (!axe) return res.status(400).json({ error: 'Missing axe in body' });

    // Log the received payload structure for debugging (do not log full content to avoid huge output)
    try {
      console.log('[POST /run] received extension payload', {
        url: String(url).slice(0, 200),
        deterministicKeys: Object.keys(typeof deterministic === 'object' && deterministic ? deterministic : {}).slice(0, 10),
        axeSummary: { violations: Array.isArray(axe.violations) ? axe.violations.length : 0 }
      });
    } catch (e) { console.warn('[POST /run] logging payload failed', e); }

    // Build summary
    const totalAccessibilityIssues = Array.isArray(axe.violations) ? axe.violations.length : 0;
    let totalUiIssues = 0;
    try {
      const h = deterministic.heuristics || {};
      totalUiIssues = (Array.isArray(h.tapTargets) ? h.tapTargets.length : 0)
        + (Array.isArray(h.headingOrder) ? h.headingOrder.length : 0)
        + (Array.isArray(h.unlabeledInputs) ? h.unlabeledInputs.length : 0);
    } catch (e) { totalUiIssues = 0; }

    // Return lightweight acknowledgement and summary (keep response small and deterministic)
    return res.json({ success: true, summary: { totalAccessibilityIssues, totalUiIssues } });
  }

  // Legacy/orchestrator flow — keep existing behavior
  if (!url) return res.status(400).json({ error: 'Missing url in body' });

  try {
    const result = await runner.runTests({ url, breakpoints, artifactDir: ARTIFACT_DIR });
    // Run deterministic analysis immediately and run remote LLM enrichment asynchronously by default.
    // Set LLM_BLOCKING=true to wait for the remote LLM (slower).
    const analysis = await llm.analyzeWithLLM(result, { fast: !(process.env.LLM_BLOCKING === 'true') }).catch(err => ({ error: String(err) }));
    // persist analysis (async write to avoid blocking request thread)
    const analysisPath = path.join(ARTIFACT_DIR, `${result.id}-analysis.json`);
    try { await fs.promises.writeFile(analysisPath, JSON.stringify(analysis, null, 2)); result.analysisPath = analysisPath; } catch (e) { console.warn('Failed to write analysis', e); }

    // Build public artifact URLs (served under /artifacts)
    const host = `${req.protocol}://${req.get('host')}`;
    const artifacts = { screenshots: [], reportUrl: null, analysisUrl: null };
    try {
      if (Array.isArray(result.results)) {
        result.results = result.results.map(r => {
          const out = Object.assign({}, r);
          if (out.screenshot && typeof out.screenshot === 'string') {
            const name = path.basename(out.screenshot);
            out.screenshotUrl = `${host}/artifacts/${encodeURIComponent(name)}`;
            artifacts.screenshots.push(out.screenshotUrl);
          }
          return out;
        });
      }

      if (result.reportPath) {
        artifacts.reportUrl = `${host}/artifacts/${encodeURIComponent(path.basename(result.reportPath))}`;
      }
      if (result.analysisPath) {
        artifacts.analysisUrl = `${host}/artifacts/${encodeURIComponent(path.basename(result.analysisPath))}`;
      }
    } catch (e) { console.warn('Failed to build artifact URLs', e); }

    result.artifacts = artifacts;

    res.json({ report: result, analysis, artifacts });
  } catch (err) {
    console.error('Runner error', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Test LLM connectivity and parsing with a small synthetic report
app.get('/llm/test', async (req, res) => {
  try {
    const fakeReport = {
      id: 'llm-test',
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      results: [ { breakpoint: 'desktop-1024', width: 1024, height: 768, screenshot: 'llm-test-snap.png', axe: { violations: [] }, layoutIssues: [] } ],
      reportPath: null
    };

    // Force opts from query if provided
    const opts = {};
    if (req.query.model) opts.model = req.query.model;

    const analysis = await llm.analyzeWithLLM(fakeReport, opts).catch(e => ({ error: String(e) }));
    res.json({ ok: true, analysis });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Fetch and return basic page metadata (title, description, favicon) server-side to avoid CORS
app.get('/meta', async (req, res) => {
  const { url } = req.query || {};
  if (!url) return res.status(400).json({ error: 'Missing url query param' });

  try {
    const resp = await fetch(url, { redirect: 'follow' });
    const text = await resp.text();
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
                   || text.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const iconMatch = text.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]*href=["']([^"']+)["'][^>]*>/i)
                   || text.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    let favicon = iconMatch ? iconMatch[1].trim() : '';
    if (favicon && !favicon.startsWith('http')) {
      // make absolute relative to page
      try {
        const u = new URL(url);
        favicon = new URL(favicon, u.origin).toString();
      } catch (e) {}
    }

    // fallback to /favicon.ico
    if (!favicon) {
      try { const u = new URL(url); favicon = `${u.origin}/favicon.ico`; } catch (e) { favicon = ''; }
    }

    res.json({ title, description, favicon });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Server-Sent Events (SSE) — push enriched LLM analysis to clients without polling
// Clients connect to: GET /events?id=<reportId>
const sseClients = new Map(); // reportId -> Set<res>

app.get('/events', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'Missing id query param' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  // initial comment to establish the stream
  res.write(`: connected\n\n`);

  const clients = sseClients.get(id) || new Set();
  clients.add(res);
  sseClients.set(id, clients);

  // heartbeat to keep intermediate proxies happy
  const keepalive = setInterval(() => {
    try { res.write(': keepalive\n\n'); } catch (e) { /* ignore */ }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepalive);
    const set = sseClients.get(id);
    if (set) { set.delete(res); if (set.size === 0) sseClients.delete(id); }
  });
});

// Listen for LLM parsed events and push to connected SSE clients
if (llm && llm.llmEvents && typeof llm.llmEvents.on === 'function') {
  llm.llmEvents.on('parsed', ({ id, parsed }) => {
    const set = sseClients.get(id);
    if (!set || set.size === 0) return;
    const payload = JSON.stringify({ status: 'ready', enriched: true, parsed });
    for (const res of set) {
      try {
        res.write(`data: ${payload}\n\n`);
        res.end();
      } catch (e) { /* ignore send errors */ }
    }
    sseClients.delete(id);
  });
}

// Hybrid support: return LLM-enriched analysis when available for a given report id.
app.get('/analysis/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Missing id param' });
  try {
    const parsedPath = path.join(ARTIFACT_DIR, `${id}-analysis-parsed.json`);
    const analysisPath = path.join(ARTIFACT_DIR, `${id}-analysis.json`);

    if (fs.existsSync(parsedPath)) {
      const raw = await fs.promises.readFile(parsedPath, 'utf8');
      const obj = JSON.parse(raw || '{}');
      // obj may be { parsed: <analysis>, meta... }
      return res.json({ status: 'ready', enriched: true, parsed: obj.parsed || obj });
    }

    if (fs.existsSync(analysisPath)) {
      const raw = await fs.promises.readFile(analysisPath, 'utf8');
      const obj = JSON.parse(raw || '{}');
      return res.json({ status: 'processing', enriched: false, analysis: obj });
    }

    return res.status(404).json({ error: 'Analysis not found' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

app.get('/', (req, res) => res.send('UI A11y Orchestrator — POST /run {url}'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Orchestrator listening on http://localhost:${PORT}`));
