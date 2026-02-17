require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const runner = require('./playwrightRunner');
const llm = require('./llmClient');

const app = express();
console.log('app: ', app);
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
  const { url, breakpoints } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url in body' });

  try {
    const result = await runner.runTests({ url, breakpoints, artifactDir: ARTIFACT_DIR });
    // Run local/remote LLM analysis (free local fallback if no external LLM configured)
    const analysis = await llm.analyzeWithLLM(result).catch(err => ({ error: String(err) }));
    // persist analysis
    const analysisPath = path.join(ARTIFACT_DIR, `${result.id}-analysis.json`);
    try { fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2)); result.analysisPath = analysisPath; } catch (e) { console.warn('Failed to write analysis', e); }

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

// ============================================================================
// GET /health — check orchestrator + Ollama + LLM readiness
// ============================================================================
app.get('/health', async (req, res) => {
  const status = { orchestrator: 'ok', ollama: 'unknown', llm: 'unknown', timestamp: new Date().toISOString() };
  const ollamaUrl = process.env.LLM_API_URL || 'http://localhost:11434';
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const data = await r.json();
      status.ollama = 'ok';
      status.models = (data.models || []).map(m => m.name);
    } else {
      status.ollama = `error (HTTP ${r.status})`;
    }
  } catch (e) {
    status.ollama = `unreachable: ${e.message || e}`;
  }
  // Check if LLM is configured for real use (not local fallback)
  const llmCfg = require('./llmClient');
  status.llmMode = llmCfg.LLM_USE_LOCAL ? 'local-deterministic' : (process.env.LLM_API_MODE || 'unknown');
  status.llmModel = llmCfg.LLM_MODEL_NAME || 'not set';
  status.llmUrl = llmCfg.LLM_API_URL || 'not set';
  status.llm = (!llmCfg.LLM_USE_LOCAL && status.ollama === 'ok') ? 'ok' : (llmCfg.LLM_USE_LOCAL ? 'local-only' : 'degraded');
  res.json(status);
});

// ============================================================================
// POST /fix — "Fix it for me" patch generator (core differentiator)
// Takes an issue + optional HTML snippet, returns a working code patch via LLM
// ============================================================================
app.post('/fix', async (req, res) => {
  const { issue, html, selector, url, framework } = req.body || {};
  if (!issue) return res.status(400).json({ error: 'Missing issue object in body' });

  const fw = framework || 'html'; // html | react | vue
  const prompt = `You are an expert accessibility engineer. Given the following accessibility issue and the surrounding HTML code, generate a MINIMAL, WORKING code fix.

ISSUE:
- Title: ${issue.title || issue.id || 'Unknown'}
- Severity: ${issue.severity || issue.impact || 'Unknown'}
- WCAG Criteria: ${JSON.stringify(issue.wcagCriteria || issue.wcag || [])}
- Selectors: ${JSON.stringify(issue.selectors || [selector] || [])}
- Impact: ${issue.impact || issue.description || ''}
- Current problematic code: ${issue.code?.problem || issue.evidence || html || 'Not provided'}
- Suggested fix hint: ${issue.suggestedFix || issue.code?.fix || 'Not provided'}

${html ? `SURROUNDING HTML:\n\`\`\`html\n${html.slice(0, 3000)}\n\`\`\`\n` : ''}
${url ? `PAGE URL: ${url}` : ''}

TARGET FRAMEWORK: ${fw}

RESPOND WITH ONLY a JSON object in this exact shape:
{
  "fixTitle": "short title of the fix",
  "before": "the problematic code snippet",
  "after": "the fixed code snippet",
  "diff": "unified diff showing the change",
  "explanation": "1-2 sentence explanation of what was fixed and why",
  "wcagResolved": ["list of WCAG criteria this fix addresses"],
  "effort": "S|M|L",
  "confidence": 0.0-1.0,
  "testHint": "how to verify the fix works"
}

Produce ONLY valid JSON. No markdown fences, no commentary.`;

  try {
    const ollamaUrl = (process.env.LLM_API_URL || 'http://localhost:11434').replace(/\/+$/, '');
    const model = process.env.LLM_MODEL_NAME || 'llama3.1:8b';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    const r = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: `LLM returned ${r.status}: ${t}` });
    }

    const data = await r.json();
    let text = data.response || '';

    // Strip markdown fences
    text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();

    let fix;
    try {
      fix = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON block
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { fix = JSON.parse(match[0]); } catch (e2) { /* fall through */ }
      }
    }

    if (!fix) {
      return res.json({ fix: null, raw: text, error: 'Could not parse LLM response as JSON' });
    }

    // Add metadata
    fix.model = model;
    fix.timestamp = new Date().toISOString();
    fix.issueId = issue.id || issue.title || null;

    // Persist fix to artifacts
    try {
      const fixPath = path.join(ARTIFACT_DIR, `fix-${Date.now()}.json`);
      fs.writeFileSync(fixPath, JSON.stringify(fix, null, 2));
      fix.artifactPath = fixPath;
    } catch (e) { /* non-fatal */ }

    res.json({ fix });
  } catch (err) {
    console.error('/fix error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ============================================================================
// POST /fix/batch — Generate fixes for multiple issues at once
// ============================================================================
app.post('/fix/batch', async (req, res) => {
  const { issues, html, url, framework } = req.body || {};
  if (!Array.isArray(issues) || issues.length === 0) return res.status(400).json({ error: 'Missing issues array in body' });

  // Group by selector to detect component-level propagation
  const selectorMap = {};
  for (const issue of issues) {
    const sels = issue.selectors || [issue.selector] || ['unknown'];
    for (const sel of sels) {
      if (!selectorMap[sel]) selectorMap[sel] = [];
      selectorMap[sel].push(issue);
    }
  }

  const componentGroups = Object.entries(selectorMap)
    .filter(([, group]) => group.length > 1)
    .map(([sel, group]) => ({ selector: sel, count: group.length, issues: group.map(i => i.title || i.id) }));

  // Process each unique issue (deduplicated by title)
  const seen = new Set();
  const fixes = [];
  for (const issue of issues) {
    const key = issue.title || issue.id || JSON.stringify(issue);
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      // Call /fix internally
      const fixRes = await new Promise((resolve) => {
        const mockReq = { body: { issue, html, url, framework } };
        const mockRes = {
          _status: 200,
          status(s) { this._status = s; return this; },
          json(data) { resolve({ status: this._status, data }); }
        };
        // Re-use the /fix handler logic inline
        app.handle({ ...mockReq, method: 'POST', url: '/fix', headers: { 'content-type': 'application/json' } }, mockRes, () => resolve({ status: 500, data: { error: 'routing failed' } }));
      });
      if (fixRes.data.fix) {
        const fix = fixRes.data.fix;
        // Tag with propagation info
        const group = componentGroups.find(g => (issue.selectors || []).includes(g.selector));
        if (group) {
          fix.propagation = { selector: group.selector, affectedCount: group.count, relatedIssues: group.issues };
        }
        fixes.push(fix);
      }
    } catch (e) {
      fixes.push({ issueId: issue.title || issue.id, error: String(e) });
    }
  }

  res.json({ fixes, componentGroups, totalIssues: issues.length, uniqueFixed: fixes.length });
});

// ============================================================================
// History & Trends — regression tracking over time
// ============================================================================
const HISTORY_FILE = path.join(ARTIFACT_DIR, 'scan-history.json');

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch (e) { console.warn('Failed to load history', e.message); }
  return [];
}

function saveHistory(history) {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2)); } catch (e) { console.warn('Failed to save history', e.message); }
}

// POST /history — store a scan result snapshot
app.post('/history', (req, res) => {
  const { url, score, counts, timestamp, reportId, summary } = req.body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const history = loadHistory();
  const entry = {
    id: reportId || `hist-${Date.now()}`,
    url,
    score: score ?? null,
    counts: counts || {},
    summary: summary || '',
    timestamp: timestamp || new Date().toISOString()
  };
  history.push(entry);
  saveHistory(history);
  res.json({ ok: true, entry, totalEntries: history.length });
});

// GET /history?url=... — get scan history, optionally filtered by URL
app.get('/history', (req, res) => {
  const history = loadHistory();
  const url = req.query.url;
  const filtered = url ? history.filter(h => h.url === url) : history;
  res.json({ history: filtered, total: filtered.length });
});

// GET /trends?url=... — score trends over time for a URL
app.get('/trends', (req, res) => {
  const history = loadHistory();
  const url = req.query.url;
  if (!url) {
    // Aggregate trends per URL
    const byUrl = {};
    for (const h of history) {
      if (!byUrl[h.url]) byUrl[h.url] = [];
      byUrl[h.url].push({ score: h.score, timestamp: h.timestamp, counts: h.counts, id: h.id });
    }
    const trends = Object.entries(byUrl).map(([url, entries]) => {
      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const scores = entries.filter(e => e.score != null).map(e => e.score);
      const latest = scores.length ? scores[scores.length - 1] : null;
      const previous = scores.length > 1 ? scores[scores.length - 2] : null;
      const delta = (latest != null && previous != null) ? latest - previous : null;
      const trend = delta > 0 ? 'improving' : delta < 0 ? 'regressing' : 'stable';
      return { url, entries, latestScore: latest, previousScore: previous, delta, trend, scanCount: entries.length };
    });
    return res.json({ trends });
  }

  const filtered = history.filter(h => h.url === url);
  filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const scores = filtered.filter(e => e.score != null).map(e => e.score);
  const latest = scores.length ? scores[scores.length - 1] : null;
  const previous = scores.length > 1 ? scores[scores.length - 2] : null;
  const delta = (latest != null && previous != null) ? latest - previous : null;
  const trend = delta > 0 ? 'improving' : delta < 0 ? 'regressing' : 'stable';
  res.json({ url, entries: filtered, latestScore: latest, previousScore: previous, delta, trend, scanCount: filtered.length });
});

// Auto-save to history after each /run scan
const originalRunHandler = app._router.stack.find(layer => layer.route && layer.route.path === '/run' && layer.route.methods.post);

app.get('/', (req, res) => res.json({
  name: 'UI-Agent Accessibility Orchestrator',
  version: '2.0.0',
  endpoints: {
    'POST /run': 'Run accessibility + UI scan on a URL',
    'POST /fix': 'Generate a code fix for a single issue (LLM-powered)',
    'POST /fix/batch': 'Generate fixes for multiple issues with component propagation',
    'GET /health': 'Check orchestrator, Ollama, and LLM health',
    'GET /llm/test': 'Test LLM connectivity with a synthetic report',
    'GET /meta?url=': 'Fetch page metadata (title, description, favicon)',
    'POST /history': 'Store a scan result snapshot for trend tracking',
    'GET /history?url=': 'Retrieve scan history (optionally filtered by URL)',
    'GET /trends?url=': 'Get accessibility score trends over time',
    'GET /artifacts/*': 'Serve stored artifacts (screenshots, reports)'
  },
  differentiators: [
    'Fix-it-for-me: generates working code patches via local LLM',
    'Component-level fix propagation across repeated selectors',
    'Regression tracking with score trends over time',
    'Privacy-first: runs entirely local with Ollama',
    'Deterministic + LLM hybrid analysis with provenance'
  ]
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Orchestrator listening on http://localhost:${PORT}`);

  // Warm up Ollama model on start
  const ollamaUrl = (process.env.LLM_API_URL || 'http://localhost:11434').replace(/\/+$/, '');
  const model = process.env.LLM_MODEL_NAME || 'llama3.1:8b';
  try {
    console.log(`Warming up LLM model "${model}" at ${ollamaUrl}...`);
    const r = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'warmup', stream: false, options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(60000)
    });
    if (r.ok) {
      console.log(`LLM model "${model}" warmed up successfully.`);
    } else {
      console.warn(`LLM warmup returned HTTP ${r.status}`);
    }
  } catch (e) {
    console.warn(`LLM warmup failed (non-fatal): ${e.message || e}`);
  }
});
