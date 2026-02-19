/**
 * Accea Agent Chrome Extension — Service Worker (Background)
 * 
 * Coordinates scanning, LLM routing, and messaging between popup
 * and content scripts. This is the central hub.
 * 
 * Architecture:
 *   popup.js  ──msg──▶  service-worker.js  ──msg──▶  content/scanner.js
 *                              │                      content/redactor.js
 *                              ▼
 *                        lib/llm-router.js
 */

import { LLMRouter } from '../lib/llm-router.js';

const llmRouter = new LLMRouter();

/* ═══════════════════════════════════════════
   Lighthouse cache  (tab URL → result)
   ═══════════════════════════════════════════ */
const lighthouseCache    = new Map(); // url → { data, fetchedAt }
const lighthouseInFlight = new Set(); // urls currently being fetched
const LIGHTHOUSE_TTL     = 5 * 60 * 1000; // 5 min

/* ═══════════════════════════════════════════
   Message router — handles all message types
   ═══════════════════════════════════════════ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    'scan':               () => handleScan(msg.tabId),
    'fix':                () => handleFix(msg.issue, msg.pageUrl, msg.tabId),
    'get-settings':       () => getSettings(),
    'save-settings':      () => saveSettings(msg.settings),
    'get-history':        () => getHistory(),
    'clear-history':      () => clearHistory(),
    'get-capabilities':   () => llmRouter.detectCapabilities(),
    'highlight':          () => sendToTab(msg.tabId, { type: 'highlight-issues', issues: msg.issues }),
    'clear-highlights':   () => sendToTab(msg.tabId, { type: 'clear-highlights' }),
    'scroll-to':          () => sendToTab(msg.tabId, { type: 'scroll-to', selector: msg.selector }),
    'spotlight':          () => sendToTab(msg.tabId, { type: 'spotlight', selector: msg.selector }),
    'fetch-lighthouse':   () => handleFetchLighthouse(msg.url),
    'get-lighthouse':     () => Promise.resolve(getLighthouseCache(msg.url)),
  };

  const handler = handlers[msg.action];
  if (!handler) return false;

  handler()
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(err => sendResponse({ ok: false, error: err.message }));

  return true; // all handlers are async
});

/* ═══════════════════════════════════════════
   Scan handler
   ═══════════════════════════════════════════ */

/**
 * Run accessibility scan on a tab.
 * 
 * KEY INSIGHT: Content scripts run in an "isolated world" — they cannot
 * access window.axe even after injecting a <script> tag. So we use
 * chrome.scripting.executeScript with world:'MAIN' to run axe-core
 * directly in the page's main world, then pass raw results to the
 * content script for normalization + highlighting.
 */
async function handleScan(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    if (!tabId) throw new Error('No active tab found');
  }

  // Ensure content scripts are injected (for highlighting, DOM context, etc.)
  await ensureContentScripts(tabId);

  // Step 1: Inject axe-core into the page's MAIN world
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/axe.min.js'],
    world: 'MAIN'
  });

  // Step 2: Run axe.run() in the MAIN world and get raw results
  const [{ result: axeRaw }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      return new Promise((resolve) => {
        if (typeof axe === 'undefined') {
          resolve({ error: 'axe-core not loaded' });
          return;
        }
        axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
          },
          resultTypes: ['violations', 'passes', 'incomplete'],
          reporter: 'v2'
        }).then(results => {
          // Serialize only what we need (axe results contain DOM refs that can't cross worlds)
          resolve({
            violations: (results.violations || []).map(v => ({
              id: v.id, impact: v.impact, help: v.help,
              description: v.description, helpUrl: v.helpUrl, tags: v.tags,
              nodes: (v.nodes || []).map(n => ({
                html: n.html, target: n.target,
                failureSummary: n.failureSummary, impact: n.impact
              }))
            })),
            passes: (results.passes || []).map(p => ({ id: p.id })),
            incomplete: (results.incomplete || []).map(i => ({
              id: i.id, impact: i.impact, help: i.help,
              description: i.description, helpUrl: i.helpUrl, tags: i.tags,
              nodes: (i.nodes || []).map(n => ({
                html: n.html, target: n.target,
                failureSummary: n.failureSummary, impact: n.impact
              }))
            })),
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            axeVersion: axe.version
          });
        }).catch(err => {
          resolve({ error: err.message || String(err) });
        });
      });
    }
  });

  if (axeRaw.error) {
    throw new Error(axeRaw.error);
  }

  // Step 3: Normalize results in the service worker
  const scanResult = normalizeAxeResults(axeRaw);

  // Step 4: Build structured analysis
  const analysis = buildAnalysis(scanResult);

  // Step 5: Store in history
  await storeHistoryEntry(tabId, analysis, scanResult);

  // Step 6: Highlight issues on the page via content script
  await sendToTab(tabId, { type: 'highlight-issues', issues: analysis.issues });

  return { analysis, scanResult };
}

/**
 * Normalize raw axe results into our unified format.
 * Runs in the service worker (no DOM needed).
 */
function normalizeAxeResults(raw) {
  function mapImpact(impact) {
    return { critical: 'critical', serious: 'serious', moderate: 'moderate', minor: 'minor' }[impact] || 'moderate';
  }

  function extractWcag(tags) {
    return (tags || []).filter(t => /^wcag\d/.test(t)).map(t => {
      const m = t.match(/^wcag(\d)(\d)(\d)$/);
      if (m) return `${m[1]}.${m[2]}.${m[3]}`;
      const lm = t.match(/^wcag(\d+)(a{1,3})$/);
      if (lm) return `WCAG ${lm[1].length > 1 ? lm[1][0]+'.'+lm[1][1] : lm[1]}.0 Level ${lm[2].toUpperCase()}`;
      return t;
    });
  }

  function normalizeViolation(v, type) {
    return {
      id: v.id, type,
      title: v.help || v.id,
      description: v.description || '',
      severity: mapImpact(v.impact),
      helpUrl: v.helpUrl || '',
      wcag: extractWcag(v.tags || []),
      tags: v.tags || [],
      nodes: (v.nodes || []).map(n => ({
        html: n.html || '', target: n.target || [],
        failureSummary: n.failureSummary || '', impact: n.impact || 'moderate'
      })),
      selectors: (v.nodes || []).map(n => n.target?.[0] || '').filter(Boolean),
      html: (v.nodes || []).map(n => n.html || '').filter(Boolean).slice(0, 5),
      elementCount: v.nodes?.length || 0
    };
  }

  const violations = (raw.violations || []).map(v => normalizeViolation(v, 'violation'));
  const incomplete = (raw.incomplete || []).map(v => normalizeViolation(v, 'needs-review'));

  const passCount = raw.passes?.length || 0;

  // ── Score calculation (weighted penalty model) ──
  // 1. Incomplete/needs-review items are NOT counted against the score.
  // 2. Each violation carries a severity weight; each passing rule carries weight 1.
  // 3. Score = passing_weight / total_weight × 100.
  //    A failing rule contributes 0 earned weight (not partial credit).
  //    A critical failure (weight 10) therefore hurts 10× more than a minor one (weight 1).
  const severityWeight = { critical: 10, serious: 5, moderate: 2, minor: 1 };

  // Weighted pool: passes contribute weight 1, violations contribute their severity weight.
  const passWeight     = passCount;                                               // each pass = 1
  const violationWeight = violations.reduce((s, v) => s + (severityWeight[v.severity] || severityWeight.moderate), 0);
  const totalPossible  = passWeight + violationWeight;                            // total weight

  // Only passing rules earn credit; failing rules earn 0.
  const score = totalPossible > 0
    ? Math.max(0, Math.min(100, Math.round((passWeight / totalPossible) * 100)))
    : 100;

  const bySeverity = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  violations.forEach(v => { bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1; });

  return {
    url: raw.url, title: raw.title, timestamp: raw.timestamp, score,
    summary: {
      violations: violations.length, incomplete: incomplete.length,
      passes: passCount,
      totalAffected: violations.reduce((s, v) => s + (v.nodes?.length || 0), 0),
      bySeverity
    },
    issues: [...violations, ...incomplete],
    metadata: { axeVersion: raw.axeVersion || 'unknown', scanEngine: 'axe-core', scanSource: 'accea-agent-chrome-extension' }
  };
}

/**
 * Ensure content scripts are injected (for highlighting, scrolling, etc.)
 */
async function ensureContentScripts(tabId) {
  try {
    const response = await sendToTab(tabId, { type: 'ping' });
    if (response?.ok) return; // already injected
  } catch {
    // Not injected yet
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/scanner.js']
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/redactor.js']
  });
}

/**
 * Send message to a content script in a specific tab
 */
function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

/* ═══════════════════════════════════════════
   Lighthouse (PageSpeed Insights) handler
   Runs in the service worker so it survives popup open/close.
   Results cached per URL for LIGHTHOUSE_TTL ms.
   ═══════════════════════════════════════════ */

function getLighthouseCache(url) {
  const cached = lighthouseCache.get(url);
  if (!cached) return { status: 'none' };
  if (Date.now() - cached.fetchedAt > LIGHTHOUSE_TTL) {
    lighthouseCache.delete(url);
    return { status: 'none' };
  }
  return { status: 'ready', data: cached.data };
}

async function handleFetchLighthouse(url) {
  // 1. Cache hit — respond instantly
  const cached = getLighthouseCache(url);
  if (cached.status === 'ready') return { status: 'ready', data: cached.data };

  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('about:') || url.startsWith('file:')) {
    return { status: 'error', error: 'Cannot analyze internal pages' };
  }

  // 2. Already fetching — tell popup to just wait for the push
  if (lighthouseInFlight.has(url)) return { status: 'fetching' };

  // 3. Kick off fetch FIRE-AND-FORGET — respond to popup immediately
  //    (MV3 message responses must come back within ~5s; PageSpeed takes 10-30s)
  lighthouseInFlight.add(url);
  doLighthouseFetch(url); // intentionally NOT awaited
  return { status: 'fetching' };
}

async function doLighthouseFetch(url) {
  // Read API key from settings (if user has provided one)
  const settings = await getSettings();
  const apiKey = (settings.pagespeedApiKey || '').trim();

  let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encodeURIComponent(url)}` +
    `&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO` +
    `&strategy=mobile`;
  if (apiKey) apiUrl += `&key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(120000) });
    if (response.status === 429) {
      throw new Error('Rate limited — add a free PageSpeed API key in Settings');
    }
    if (!response.ok) throw new Error(`PageSpeed API ${response.status}`);

    const json = await response.json();
    const cats = json.lighthouseResult?.categories || {};

    const data = {
      performance:   Math.round((cats.performance?.score        || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score      || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score  || 0) * 100),
      seo:           Math.round((cats.seo?.score                || 0) * 100),
      fetchedAt:     Date.now()
    };

    lighthouseCache.set(url, { data, fetchedAt: Date.now() });

    // Push result to popup (if open)
    try { chrome.runtime.sendMessage({ action: 'lighthouse-ready', data }); } catch { /* closed */ }
  } catch (e) {
    console.warn('[Accea] Lighthouse fetch failed:', e.message);
    // Push error to popup (if open)
    try { chrome.runtime.sendMessage({ action: 'lighthouse-ready', error: e.message }); } catch { /* closed */ }
  } finally {
    lighthouseInFlight.delete(url);
  }
}

/* ═══════════════════════════════════════════
   Analysis builder (deterministic, no LLM)
   ═══════════════════════════════════════════ */

/**
 * Build structured analysis from normalized scan results
 */
function buildAnalysis(scanResult) {
  const issues = scanResult.issues || [];
  const violations = issues.filter(i => i.type === 'violation');
  const needsReview = issues.filter(i => i.type === 'needs-review');

  // Sort: critical first
  const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  violations.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

  return {
    summary: scanResult.summary || {},
    auditScore: scanResult.score || 0,
    complianceStatus: getComplianceStatus(scanResult.score, scanResult.summary),
    counts: scanResult.summary?.bySeverity || {},
    issues: violations,
    needsReview,
    totalViolations: violations.length,
    totalPasses: scanResult.summary?.passes || 0,
    totalIncomplete: needsReview.length,
    url: scanResult.url,
    title: scanResult.title,
    timestamp: scanResult.timestamp,
    metadata: scanResult.metadata
  };
}

function getComplianceStatus(score, summary) {
  if (!summary) return 'Unknown';
  const criticals = summary.bySeverity?.critical || 0;
  if (score >= 90 && criticals === 0) return 'Compliant';          // truly clean
  if (score >= 70 && criticals === 0) return 'At Risk';            // good score but has issues
  if (criticals > 0 || score >= 50)  return 'At Risk';             // critical issues or mid-range
  return 'Not Compliant';                                           // score < 50
}

/* ═══════════════════════════════════════════
   Fix handler
   ═══════════════════════════════════════════ */

/**
 * Generate a fix using the cascading LLM router
 */
async function handleFix(issue, pageUrl, tabId) {
  const settings = await getSettings();
  const config = {
    privacyMode: settings.privacyMode !== false,  // default: true
    cloudOptIn:  settings.cloudOptIn === true,     // default: false
    localServerUrl: settings.localServerUrl || 'http://localhost:3000'
  };

  // If going to cloud and privacy mode is off, redact via content script
  let safeIssue = issue;
  if (config.cloudOptIn && !config.privacyMode && tabId) {
    const redacted = await sendToTab(tabId, { type: 'redact-issue', issue });
    if (redacted?.ok) safeIssue = redacted.redacted;
  }

  const fix = await llmRouter.generateFix(safeIssue, pageUrl, config);
  return { fix };
}

/* ═══════════════════════════════════════════
   Settings
   ═══════════════════════════════════════════ */

const DEFAULT_SETTINGS = {
  privacyMode: true,
  cloudOptIn: false,
  localServerUrl: 'http://localhost:3000',
  autoHighlight: true,
  showBadge: true,
  scanOnLoad: false,
  pagespeedApiKey: ''
};

async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function saveSettings(newSettings) {
  const current = await getSettings();
  const merged = { ...current, ...newSettings };
  await chrome.storage.local.set(merged);
  return merged;
}

/* ═══════════════════════════════════════════
   History
   ═══════════════════════════════════════════ */

async function storeHistoryEntry(tabId, analysis, scanResult) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const entry = {
      url: tab.url,
      title: tab.title,
      score: analysis.auditScore,
      counts: analysis.counts,
      totalViolations: analysis.totalViolations,
      complianceStatus: analysis.complianceStatus,
      timestamp: new Date().toISOString(),
      issueIds: analysis.issues.map(i => i.id)
    };

    const { scanHistory = [] } = await chrome.storage.local.get('scanHistory');
    scanHistory.push(entry);
    // Keep last 200 scans
    if (scanHistory.length > 200) scanHistory.splice(0, scanHistory.length - 200);
    await chrome.storage.local.set({ scanHistory });
  } catch (e) {
    console.warn('Failed to store history:', e.message);
  }
}

async function getHistory() {
  const { scanHistory = [] } = await chrome.storage.local.get('scanHistory');
  return { history: scanHistory };
}

async function clearHistory() {
  await chrome.storage.local.set({ scanHistory: [] });
  return { cleared: true };
}

/* ═══════════════════════════════════════════
   Badge — show issue count on extension icon
   ═══════════════════════════════════════════ */

function updateBadge(tabId, count) {
  const text = count > 0 ? String(count) : '';
  const color = count > 0 ? '#e74c3c' : '#27ae60';
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

/* ═══════════════════════════════════════════
   Extension install / update
   ═══════════════════════════════════════════ */

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set default settings
    await chrome.storage.local.set(DEFAULT_SETTINGS);
    console.log('[Accea Agent] Extension installed — defaults set');
  }

  // Pre-detect LLM capabilities
  const caps = await llmRouter.detectCapabilities();
  console.log('[Accea Agent] LLM capabilities:', caps);
});

console.log('[Accea Agent] Service worker loaded');
