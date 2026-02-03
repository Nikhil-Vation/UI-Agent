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

app.get('/', (req, res) => res.send('UI A11y Orchestrator — POST /run {url}'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Orchestrator listening on http://localhost:${PORT}`));
