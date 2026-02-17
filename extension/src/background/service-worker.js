// Background service worker (MV3) - receives deterministic results, forwards to UI, calls backend /run and subscribes to SSE

const BACKEND_BASE = 'http://localhost:3000';
const SSE_PATH = '/events';

// Unified onMessage handler with verbose logging and RUN_SCAN support
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[service-worker] onMessage received', { msg, sender });
  if (!msg || !msg.type) {
    console.warn('[service-worker] onMessage: invalid message', msg);
    return;
  }

  // Support both RUN_SCAN (new) and TRIGGER_SCAN (legacy)
  if (msg.type === 'RUN_SCAN' || msg.type === 'TRIGGER_SCAN') {
    console.log(`[service-worker] ${msg.type} request — initiating scan (sender=${sender && (sender.id || (sender.tab && sender.tab.id)) || 'unknown'})`);
    (async () => {
      try {
        await triggerScan();
        // acknowledge asynchronously
        try { sendResponse && sendResponse({ status: 'accepted', started: true }); } catch (e) { /* ignore */ }
      } catch (err) {
        console.error('[service-worker] triggerScan failed', err);
        try { sendResponse && sendResponse({ status: 'error', error: String(err) }); } catch (e) { /* ignore */ }
      }
    })();
    // indicate we'll call sendResponse asynchronously
    return true;
  }

  if (msg.type === 'DETERMINISTIC_RESULT') {
    console.log('[service-worker] DETERMINISTIC_RESULT received — forwarding for processing', msg && msg.report && msg.report.url);
    try {
      handleDeterministicResult(msg.report);
    } catch (e) {
      console.error('[service-worker] handleDeterministicResult threw', e);
    }
    return;
  }

  console.log('[service-worker] Unknown message type:', msg.type);
});

async function triggerScan(){
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || !tabs[0]) {
    console.warn('[service-worker] triggerScan: no active tab found');
    return;
  }

  const tabId = tabs[0].id;
  console.log('[service-worker] triggerScan: injecting content script into tab', tabId);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/content-script.js'] });
    console.log('[service-worker] triggerScan: content script injected');
    // content script will self-run and post results
  } catch (err) {
    console.error('[service-worker] Failed to inject content script', err);
    throw err;
  }
}

function validateAxeSchema(axe) {
  // Basic verification to ensure structure matches Playwright/Orchestrator output
  const problems = [];
  if (!axe || typeof axe !== 'object') return ['missing-axe-object'];
  if (!Array.isArray(axe.violations)) problems.push('violations-not-array');
  const runOnly = axe.toolOptions && axe.toolOptions.runOnly;
  if (!runOnly || !Array.isArray(runOnly.values) || !runOnly.values.includes('wcag2a')) problems.push('runOnly-wcag2a-missing');
  if (!runOnly || !Array.isArray(runOnly.values) || !runOnly.values.includes('wcag2aa')) problems.push('runOnly-wcag2aa-missing');
  if (!axe.testEngine || !axe.testEngine.name) problems.push('testEngine-missing');
  return problems;
}

async function handleDeterministicResult(report){
  // quick schema verification (will auto-normalize if possible)
  const problems = validateAxeSchema(report.axe);
  if (problems.length) {
    console.warn('Axe schema validation issues:', problems);
    // attempt lightweight normalization if possible
    report.axe = report.axe || {};
    report.axe.toolOptions = report.axe.toolOptions || { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa'] }, resultTypes: ['violations'] };
    report.axe.violations = Array.isArray(report.axe.violations) ? report.axe.violations : [];
    report.axe.testEngine = report.axe.testEngine || { name: 'axe-core' };
  } else {
    console.log('Axe schema OK (matches expected Playwright shape)');
  }

  // forward to any UI (popup/panel)
  chrome.runtime.sendMessage({ type: 'DETERMINISTIC_RESULT', report });
  // POST to backend for enrichment — send full payload (url + deterministic + axe)
  try {
    const payload = {
      url: report && report.url,
      deterministic: report,
      axe: report && report.axe
    };
    console.log('[service-worker] POST /run payload', { url: payload.url, hasDeterministic: !!payload.deterministic, hasAxe: !!payload.axe });
    const resp = await fetch(`${BACKEND_BASE}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) { console.warn('/run returned', resp.status); return; }
    const data = await resp.json();
    console.log('[service-worker] /run response', data);
    if (data && data.reportId) {
      listenSSE(data.reportId, data.sseToken);
    }
  } catch (err) {
    console.error('POST /run failed', err);
  }
}

let sseControllers = new Map();

async function listenSSE(reportId, token){
  if (!reportId) return;
  const key = `sse::${reportId}`;
  if (sseControllers.has(key)) return; // already listening
  let aborted = false;
  const sseUrl = `${BACKEND_BASE}${SSE_PATH}?id=${encodeURIComponent(reportId)}${token?`&token=${encodeURIComponent(token)}`:''}`;
  const controller = new AbortController();
  sseControllers.set(key, controller);

  try {
    const res = await fetch(sseUrl, { method: 'GET', headers: { Accept: 'text/event-stream' }, signal: controller.signal });
    if (!res.body) throw new Error('No streaming body');
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const p of parts) {
        if (!p.startsWith('data:')) continue;
        const json = JSON.parse(p.replace(/^data:\s*/, ''));
        // forward enrichment messages to UI
        chrome.runtime.sendMessage({ type: 'ENRICHMENT_UPDATE', reportId, payload: json });
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('SSE aborted for', reportId);
    } else {
      console.error('SSE listen error', err);
      // try reconnect after delay
      setTimeout(() => { if (!aborted) listenSSE(reportId, token); }, 2000);
    }
  } finally {
    sseControllers.delete(key);
  }
}
