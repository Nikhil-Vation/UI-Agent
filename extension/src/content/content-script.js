(function(){
  const INJECT_ID = '__ui_agent_axe';

  function injectAxeBundle(){
    if (document.getElementById(INJECT_ID)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('src/content/axe.min.js');
      s.id = INJECT_ID;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      (document.head || document.documentElement).appendChild(s);
    });
  }

  let lastAxeOptions = null;

  function normalizeAxeResult(axeResult, options) {
    // Ensure the axe result shape matches the Playwright/orchestrator shape used by backend
    const normalized = Object.assign({}, axeResult || {});
    normalized.toolOptions = normalized.toolOptions || (options ? { runOnly: options.runOnly, resultTypes: options.resultTypes || ['violations'] } : {});
    normalized.timestamp = normalized.timestamp || new Date().toISOString();
    normalized.url = normalized.url || location.href;
    normalized.testEngine = normalized.testEngine || { name: 'axe-core', version: (window.axe && window.axe.version) ? window.axe.version : undefined };
    normalized.testRunner = normalized.testRunner || { name: 'axe' };
    normalized.testEnvironment = normalized.testEnvironment || { userAgent: navigator.userAgent, windowWidth: window.innerWidth, windowHeight: window.innerHeight };
    // ensure arrays exist
    normalized.violations = Array.isArray(normalized.violations) ? normalized.violations : (normalized.violations ? [normalized.violations] : []);
    normalized.inapplicable = Array.isArray(normalized.inapplicable) ? normalized.inapplicable : (normalized.inapplicable ? [normalized.inapplicable] : []);
    normalized.incomplete = Array.isArray(normalized.incomplete) ? normalized.incomplete : (normalized.incomplete ? [normalized.incomplete] : []);
    normalized.passes = Array.isArray(normalized.passes) ? normalized.passes : (normalized.passes ? [normalized.passes] : []);
    return normalized;
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window || !ev.data || ev.data.direction !== 'ui-agent') return;
    if (ev.data.type === 'AXE_RESULT') {
      const axeResult = ev.data.payload;
      const normalized = normalizeAxeResult(axeResult, lastAxeOptions);
      const heuristics = computeHeuristics();
      const report = {
        url: location.href,
        timestamp: Date.now(),
        axe: normalized,
        heuristics,
        meta: { duration: performance.now() }
      };
      chrome.runtime.sendMessage({ type: 'DETERMINISTIC_RESULT', report });
      console.log('UI-Agent deterministic result', report);
      renderOverlay(report);
    }
  });

  async function runScan(){
    try { await injectAxeBundle(); } catch (err) { console.warn('AXE injection failed, using local heuristics', err); }
    // use the same runOnly configuration as the backend Playwright runner
    const axeOptions = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations','inapplicable','incomplete'] };
    lastAxeOptions = axeOptions;
    window.postMessage({ direction: 'ui-agent', type: 'RUN_AXE', options: axeOptions }, '*');
    showTemporaryStatus();
  }

  function computeHeuristics(){
    const heuristics = { tapTargets: [], headingOrder: [], unlabeledInputs: [] };
    const interactives = Array.from(document.querySelectorAll('a,button,[role=button],input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"]'));
    for (const el of interactives){
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) heuristics.tapTargets.push({ selector: getSelector(el), rect: rectToObj(r) });
    }
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    let lastLevel = 0;
    headings.forEach(h => {
      const level = parseInt(h.tagName[1], 10);
      if (lastLevel && level > lastLevel + 1) heuristics.headingOrder.push({ selector: getSelector(h), from: lastLevel, to: level });
      lastLevel = level;
    });
    let inputs = [];
    try {
      // properly quote attribute value and guard the selector to avoid runtime exceptions
      inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([aria-label]):not([aria-labelledby])'));
    } catch (err) {
      // Don't let a bad selector crash the deterministic scan — log and continue with empty inputs
      console.error('UI-Agent: computeHeuristics — querySelectorAll failed for unlabeled inputs selector', err);
      inputs = [];
    }
    for (const input of inputs) heuristics.unlabeledInputs.push({ selector: getSelector(input), type: input.type || 'text' });
    return heuristics;
  }

  function getSelector(el){
    if (!el) return null;
    if (el.id) return `#${el.id}`;
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 5){
      let part = el.tagName.toLowerCase();
      if (el.className) {
        const cls = el.className.toString().trim().split(/\s+/)[0];
        if (cls) part += `.${cls}`;
      }
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function rectToObj(r){ return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }

  function renderOverlay(report){
    const existing = document.getElementById('__ui_agent_overlay');
    if (existing) existing.remove();
    const container = document.createElement('div');
    container.id = '__ui_agent_overlay';
    container.style.position = 'fixed';
    container.style.left = 0; container.style.top = 0; container.style.right = 0; container.style.bottom = 0;
    container.style.pointerEvents = 'none';
    container.style.zIndex = 2147483647;
    const violations = (report.axe && report.axe.violations) || [];
    violations.slice(0,20).forEach(v => {
      (v.nodes || []).forEach(node => {
        try {
          const el = document.querySelector(node.target && node.target[0]);
          if (!el) return;
          const r = el.getBoundingClientRect();
          const badge = document.createElement('div');
          badge.style.position = 'absolute';
          badge.style.left = (r.x + window.scrollX) + 'px';
          badge.style.top = (r.y + window.scrollY) + 'px';
          badge.style.width = r.width + 'px';
          badge.style.height = r.height + 'px';
          badge.style.boxSizing = 'border-box';
          badge.style.border = '2px solid rgba(255,80,80,0.9)';
          badge.style.background = 'rgba(255,80,80,0.06)';
          badge.style.pointerEvents = 'none';
          badge.title = v.id;
          container.appendChild(badge);
        } catch (e) { /* ignore bad nodes */ }
      });
    });
    document.documentElement.appendChild(container);
    setTimeout(()=>{ container.remove(); }, 12000);
  }

  function showTemporaryStatus(){ console.log('UI-Agent: running deterministic scan…'); }

  // run immediately
  runScan();

  // allow external re-run
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'RE-RUN_SCAN') { runScan(); sendResponse({ ok: true }); }
  });
})();