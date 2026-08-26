/**
 * SiteScope 360 Chrome Extension — Service Worker (Background)
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
import { assessCandidates, summarizeJudgment, collectJudgmentCandidates } from '../lib/judgment.js';
import { runDomTool } from '../lib/dom-tools.js';
import '../lib/audit-log.js';   // classic script; attaches globalThis.AuditLog
import '../lib/crawl.js';       // classic script; attaches globalThis.Crawl
import '../lib/keyboard.js';    // classic script; attaches globalThis.Keyboard
import '../lib/screenreader.js';// classic script; attaches globalThis.ScreenReader
import '../lib/reading-order.js'; // classic script; attaches globalThis.ReadingOrder
import '../lib/impairment.js';    // classic script; attaches globalThis.Impairment
import { analyzeScreenshot, describeImageFromVision } from '../lib/vision.js';
import { runJudgmentNuancePass } from '../lib/judgment-llm.js';
import { addUsage, formatUSD } from '../lib/cost-meter.js';
import { buildPrSummary, createAccessibilityPr } from '../lib/github.js';
import { findBaseline, shouldAmbientScan, detectRegression } from '../lib/ambient.js';
import { interpretChatCommand, applyChatPlan } from '../lib/chat.js';

const llmRouter = new LLMRouter();

// 6.4 — every successful provider call reports an estimated cost here. Kept as
// a simple in-memory accumulator flushed to storage on each call rather than
// awaited inline, since usage tracking must never slow down or block a fix.
let costTotals = { total: 0, calls: 0, byProvider: {} };
chrome.storage.local.get('costTotals').then(r => { if (r.costTotals) costTotals = r.costTotals; });

llmRouter.setUsageRecorder((provider, costUSD) => {
  costTotals = addUsage(costTotals, provider, costUSD);
  chrome.storage.local.set({ costTotals }).catch(() => {});
});

/* ═══════════════════════════════════════════
   Lighthouse cache  (tab URL → result)
   ═══════════════════════════════════════════ */
const lighthouseCache    = new Map(); // url → { data, fetchedAt }  (in-memory mirror)
const lighthouseInFlight = new Set(); // urls currently being fetched
const LIGHTHOUSE_TTL     = 30 * 60 * 1000; // 30 min — reduces API calls dramatically

/* ═══════════════════════════════════════════
   Message router — handles all message types
   ═══════════════════════════════════════════ */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    'scan':               () => handleScan(msg.tabId),
    'fix':                () => handleFix(msg.issue, msg.pageUrl, msg.tabId, msg.designInfo, msg.attempts, msg.deterministicOnly),
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
    'apply-patch':        () => sendToTab(msg.tabId, { type: 'apply-patch', change: msg.change, patchId: msg.change.id || `patch-${Date.now()}` }),
    'undo-patch':         () => sendToTab(msg.tabId, { type: 'undo-patch', patchId: msg.patchId }),
    'reset-patches':      () => sendToTab(msg.tabId, { type: 'reset-patches' }),
    'verify-patches':     () => handleVerifyPatches(msg.tabId),
    'analyze-all':        () => handleAnalyzeAll(msg.issues, msg.pageUrl, msg.designInfo, msg.tabId),
    'judgment-scan':      () => handleJudgmentScan(msg.tabId, msg.automatedPassCount),
    'audit-append':       () => appendAudit(msg.entry),
    'audit-get':          () => getAudit(msg.pageUrl),
    'audit-clear':        () => clearAudit(),
    'audit-merge':        () => mergeAuditEntries(msg.entries),
    'crawl-discover':     () => discoverPages(msg.origin, msg.limit),
    'crawl-scan':         () => crawlScan(msg.urls),
    'screenreader-scan':  () => screenReaderScan(msg.tabId),
    'vision-scan':        () => handleVisionScan(msg.tabId),
    'vision-alt':         () => handleVisionAlt(msg.tabId, msg.imageSrc),
    'impairment-apply':   () => handleImpairmentApply(msg.tabId, msg.key),
    'chat-command':       () => handleChatCommand(msg.instruction, msg.issues),
    'cost-get':           () => Promise.resolve({ ...costTotals, formatted: formatUSD(costTotals.total) }),
    'cost-reset':         () => { costTotals = { total: 0, calls: 0, byProvider: {} }; return chrome.storage.local.set({ costTotals }).then(() => ({ reset: true })); },
    'github-open-pr':     () => handleGithubOpenPr(msg.entries, msg.pageUrl, msg.patchContent),
    'ambient-route-changed': () => handleAmbientTrigger(sender?.tab?.id, msg.url),
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

  // Step 3: Extract design info from the page (colors, fonts, tech stack, meta)
  const [{ result: designInfo }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      /* ── Helpers ── */
      function toHex(color) {
        if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
        const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        const h = [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
        return '#' + h;
      }
      function luminance(hex) {
        const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
        const lin = c => c < 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
        return 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
      }
      function isDark(hex) { return luminance(hex) < 0.5; }

      /* ── Computed colors from top ~300 visible elements ── */
      const colorSet = new Map(); // hex -> { hex, count, role }
      const els = Array.from(document.querySelectorAll('*')).slice(0, 300);
      for (const el of els) {
        const s = window.getComputedStyle(el);
        const pairs = [
          [s.backgroundColor, 'background'],
          [s.color, 'text'],
          [s.borderColor, 'border'],
        ];
        for (const [raw, role] of pairs) {
          const hex = toHex(raw);
          if (!hex) continue;
          if (colorSet.has(hex)) {
            const e = colorSet.get(hex);
            e.count++;
            if (!e.roles.includes(role)) e.roles.push(role);
          } else {
            colorSet.set(hex, { hex, count: 1, roles: [role] });
          }
        }
      }
      // Top 16 most-used colors
      const colors = [...colorSet.values()]
        .sort((a,b) => b.count - a.count)
        .slice(0, 16)
        .map(c => ({ hex: c.hex, roles: c.roles, dark: isDark(c.hex) }));

      /* ── CSS custom properties (design tokens) ── */
      const tokens = {};
      try {
        const sheets = Array.from(document.styleSheets);
        for (const sheet of sheets) {
          try {
            const rules = Array.from(sheet.cssRules || []);
            for (const rule of rules) {
              if (rule.selectorText === ':root') {
                const text = rule.cssText;
                const matches = text.matchAll(/--([\w-]+):\s*([^;]+);/g);
                for (const m of matches) {
                  tokens[`--${m[1]}`] = m[2].trim();
                }
              }
            }
          } catch { /* cross-origin sheet */ }
        }
      } catch {}

      /* ── Fonts ── */
      const fontSet = new Set();
      for (const el of els) {
        const ff = window.getComputedStyle(el).fontFamily;
        if (ff) ff.split(',').forEach(f => {
          const clean = f.trim().replace(/['"]/g, '').split(' ').slice(0,4).join(' ');
          if (clean && clean.toLowerCase() !== 'inherit') fontSet.add(clean);
        });
      }
      // Also check @font-face names
      const fonts = [...fontSet].slice(0, 12);

      /* ── Tech stack detection ── */
      const techItems = [];
      const _push = (name, category) => techItems.push({ name, category });
      const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
      const links   = Array.from(document.querySelectorAll('link[href]')).map(l => l.href);
      const allSrcs = [...scripts, ...links];
      const metas   = Object.fromEntries(
        Array.from(document.querySelectorAll('meta')).map(m => [
          (m.name || m.getAttribute('property') || '').toLowerCase(),
          m.content || ''
        ])
      );
      const gen = (metas['generator'] || '').toLowerCase();

      // ── JS Frameworks ──
      try { if (window.__NEXT_DATA__ || document.getElementById('__NEXT_DATA__') || document.querySelector('#__next')) _push('Next.js','Framework');
        else if (window.React || document.querySelector('[data-reactroot],[data-reactid]') || allSrcs.some(s => /\/react[.@]/i.test(s))) _push('React','Framework'); } catch {}
      try { if (window.__NUXT__ || window.__nuxt) _push('Nuxt','Framework');
        else if (window.Vue || document.querySelector('[data-v-app]') || allSrcs.some(s => /\/vue[.@]/i.test(s))) _push('Vue','Framework'); } catch {}
      try { if (window.ng || document.querySelector('[ng-version],[_nghost-],[ng-app]') || allSrcs.some(s => /angular\.min|@angular/i.test(s))) _push('Angular','Framework'); } catch {}
      try { if (document.querySelector('[class*="svelte-"]') || allSrcs.some(s => /svelte/i.test(s))) _push('Svelte','Framework'); } catch {}
      try { if (window.___gatsby || document.getElementById('gatsby-announcer')) _push('Gatsby','Framework'); } catch {}
      try { if (window.__remixContext) _push('Remix','Framework'); } catch {}
      try { if (window.Astro || document.querySelector('[data-astro-cid],[astro-island]')) _push('Astro','Framework'); } catch {}
      try { if (window.Alpine) _push('Alpine.js','Framework'); } catch {}
      try { if (window.htmx) _push('htmx','Framework'); } catch {}

      // ── JS Libraries ──
      try { if (window.jQuery || window.$?.fn?.jquery) _push('jQuery','Library'); } catch {}
      try { if (window._ && window._.VERSION) _push('Lodash','Library'); } catch {}
      try { if (window.gsap || window.TweenMax || window.TweenLite) _push('GSAP','Library'); } catch {}
      try { if (window.__APOLLO_CLIENT__ || allSrcs.some(s => /apollo|graphql/i.test(s))) _push('GraphQL / Apollo','Library'); } catch {}
      try { if (window.axios) _push('Axios','Library'); } catch {}
      try { if (window.moment) _push('Moment.js','Library'); } catch {}
      try { if (window.dayjs) _push('Day.js','Library'); } catch {}
      try { if (window.THREE) _push('Three.js','Library'); } catch {}
      try { if (window.d3) _push('D3.js','Library'); } catch {}
      try { if (window.Swiper) _push('Swiper','Library'); } catch {}
      try { if (window.lottie) _push('Lottie','Library'); } catch {}

      // ── CSS Frameworks & Preprocessors ──
      try { if (allSrcs.some(s => /tailwind/i.test(s)) || document.querySelector('[class*="tw-"]')) _push('Tailwind CSS','CSS'); } catch {}
      try { if (allSrcs.some(s => /bootstrap/i.test(s)) || document.querySelector('.navbar,.btn.btn-primary')) _push('Bootstrap','CSS'); } catch {}
      try { if (allSrcs.some(s => /bulma/i.test(s)) || document.querySelector('.column.is-,.hero.is-')) _push('Bulma','CSS'); } catch {}
      try { if (allSrcs.some(s => /material-ui|@mui/i.test(s)) || document.querySelector('[class*="MuiButton"],[class*="MuiBox"]')) _push('Material UI','CSS'); } catch {}
      try { if (allSrcs.some(s => /antd|ant-design/i.test(s)) || document.querySelector('.ant-btn,.ant-layout')) _push('Ant Design','CSS'); } catch {}
      try { if (allSrcs.some(s => /chakra-ui/i.test(s)) || document.querySelector('[class*="chakra-"]')) _push('Chakra UI','CSS'); } catch {}
      try { if (allSrcs.some(s => /\.scss|\.sass/i.test(s)) || (() => { try { return Array.from(document.styleSheets).some(ss => (ss.href||'').match(/\.scss|\.sass/i)); } catch{return false;} })()) _push('Sass / SCSS','CSS'); } catch {}
      try { if (allSrcs.some(s => /styled-components/i.test(s)) || document.querySelector('[class*="sc-"]')) _push('styled-components','CSS'); } catch {}

      // ── Build Tools ──
      try { if (window.webpackChunk || window.__webpack_require__) _push('Webpack','Build'); } catch {}
      try { if (allSrcs.some(s => /\/@vite\/|__vite__/i.test(s)) || document.querySelector('script[type="module"][src*="vite"]')) _push('Vite','Build'); } catch {}
      try { if (allSrcs.some(s => /rollup/i.test(s))) _push('Rollup','Build'); } catch {}
      try { if (allSrcs.some(s => /\.tsx?$/.test(s))) _push('TypeScript','Build'); } catch {}
      try { if (allSrcs.some(s => /esbuild/i.test(s))) _push('esbuild','Build'); } catch {}
      try { if (window.__TURBOPACK__) _push('Turbopack','Build'); } catch {}

      // ── CMS / Platform ──
      try { if (gen.includes('wordpress') || document.querySelector('.wp-content,.wp-block,#wpadminbar')) _push('WordPress','Platform'); } catch {}
      try { if (window.Shopify || allSrcs.some(s => /shopify/i.test(s))) _push('Shopify','Platform'); } catch {}
      try { if (document.querySelector('[data-wf-page],[data-wf-site]')) _push('Webflow','Platform'); } catch {}
      try { if (document.querySelector('[data-framer-component-type]')) _push('Framer','Platform'); } catch {}
      try { if (gen.includes('drupal') || window.Drupal) _push('Drupal','Platform'); } catch {}
      try { if (gen.includes('joomla') || window.Joomla) _push('Joomla','Platform'); } catch {}
      try { if (gen.includes('wix') || window.wixBiSession) _push('Wix','Platform'); } catch {}
      try { if (gen.includes('squarespace') || document.querySelector('[data-squarespace-version]')) _push('Squarespace','Platform'); } catch {}
      try { if (window.Ghost) _push('Ghost','Platform'); } catch {}
      try { if (window.STORYBLOK_ENV || allSrcs.some(s => /storyblok/i.test(s))) _push('Storyblok','Platform'); } catch {}
      try { if (allSrcs.some(s => /sanity\.io|sanity-studio/i.test(s)) || window._sanity) _push('Sanity','Platform'); } catch {}

      // ── Analytics & Monitoring ──
      try { if (window.ga || window.gtag || allSrcs.some(s => /google-analytics|gtag\/js/i.test(s))) _push('Google Analytics','Analytics'); } catch {}
      try { if (window.fbq || allSrcs.some(s => /connect\.facebook\.net/i.test(s))) _push('Meta Pixel','Analytics'); } catch {}
      try { if (window.mixpanel) _push('Mixpanel','Analytics'); } catch {}
      try { if (window.posthog || allSrcs.some(s => /posthog/i.test(s))) _push('PostHog','Analytics'); } catch {}
      try { if (window.Hotjar || window.hj) _push('Hotjar','Analytics'); } catch {}
      try { if (window.amplitude) _push('Amplitude','Analytics'); } catch {}
      try { if (window.Intercom) _push('Intercom','Analytics'); } catch {}
      try { if (window.Sentry) _push('Sentry','Analytics'); } catch {}
      try { if (window.DD_LOGS || window.DD_RUM) _push('Datadog','Analytics'); } catch {}

      // ── Hosting / CDN ──
      try {
        const origins = allSrcs.map(s => { try { return new URL(s).hostname; } catch { return ''; } });
        if (origins.some(o => /vercel\.com|vercel\.app/i.test(o)) || window.__VERCEL_INSIGHTS_ID__) _push('Vercel','Hosting');
        if (origins.some(o => /netlify/i.test(o)) || window.__NETLIFY) _push('Netlify','Hosting');
        if (origins.some(o => /cloudflare/i.test(o))) _push('Cloudflare','Hosting');
        if (origins.some(o => /amazonaws\.com/i.test(o))) _push('AWS','Hosting');
        if (origins.some(o => /firebase|firebaseapp/i.test(o)) || window.firebase) _push('Firebase','Hosting');
        if (origins.some(o => /supabase/i.test(o)) || window.supabase) _push('Supabase','Hosting');
        if (origins.some(o => /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/i.test(o))) _push('jsDelivr / cdnjs','Hosting');
      } catch {}

      // Generator meta fallback
      const genRaw = metas['generator'] || '';
      if (genRaw && !techItems.some(t => genRaw.toLowerCase().includes(t.name.toLowerCase()))) {
        const shortGen = genRaw.split(' ').slice(0, 3).join(' ');
        if (shortGen) _push(shortGen, 'Platform');
      }

      const tech = techItems;

      /* ── Page meta ── */
      const meta = {
        title: document.title || '',
        description: metas['description'] || metas['og:description'] || '',
        url: window.location.href,
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        favicon: document.querySelector('link[rel*="icon"]')?.href || '',
        viewport: metas['viewport'] || '',
        ogTitle: metas['og:title'] || '',
        ogImage: metas['og:image'] || '',
        twitterCard: metas['twitter:card'] || '',
        charset: document.characterSet || '',
        lang: document.documentElement.lang || '',
        themeColor: metas['theme-color'] || '',
      };

      /* ── Typography scale ── */
      const typeSizes = new Set();
      for (const el of els) {
        const sz = window.getComputedStyle(el).fontSize;
        if (sz) typeSizes.add(sz);
      }
      // Sort sizes descending (largest first)
      const typeSizeSorted = [...typeSizes]
        .map(s => parseFloat(s))
        .filter(n => !isNaN(n) && n > 0)
        .sort((a, b) => b - a)
        .filter((v, i, arr) => arr.indexOf(v) === i) // unique
        .slice(0, 10)
        .map(n => n + 'px');

      /* ── Resource stats ── */
      const allImages   = Array.from(document.querySelectorAll('img'));
      const allScripts  = Array.from(document.querySelectorAll('script[src]'));
      const allLinks    = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      const allAnchors  = Array.from(document.querySelectorAll('a[href]'));
      const externalLinks = allAnchors.filter(a => {
        try { return new URL(a.href).hostname !== window.location.hostname; } catch { return false; }
      });
      const lazyImages  = allImages.filter(i => i.loading === 'lazy' || i.getAttribute('data-src'));
      const iframes     = Array.from(document.querySelectorAll('iframe'));
      const forms       = Array.from(document.querySelectorAll('form'));
      const buttons     = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
      const headings    = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      const h1Count     = document.querySelectorAll('h1').length;

      /* ── Security / head ── */
      const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || null;
      const robotsMeta = metas['robots'] || null;
      const hasHTTPS = window.location.protocol === 'https:';
      const hasCanonical = !!document.querySelector('link[rel="canonical"]');
      const hasOgImage = !!metas['og:image'];
      const hasDescription = !!(metas['description'] || metas['og:description']);
      const hasLang = !!document.documentElement.lang;
      const hasViewport = !!metas['viewport'];
      const structuredData = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => {
        try { return JSON.parse(s.textContent)?.['@type'] || null; } catch { return null; }
      }).filter(Boolean);

      const pageStats = {
        domNodes:      document.querySelectorAll('*').length,
        images:        allImages.length,
        lazyImages:    lazyImages.length,
        scripts:       allScripts.length,
        stylesheets:   allLinks.length,
        iframes:       iframes.length,
        forms:         forms.length,
        buttons:       buttons.length,
        links:         allAnchors.length,
        externalLinks: externalLinks.length,
        headings:      headings.length,
        h1Count,
      };

      const seoSignals = {
        hasHTTPS,
        hasCanonical,
        hasOgImage,
        hasDescription,
        hasLang,
        hasViewport,
        csp:            !!csp,
        robotsMeta,
        structuredData,
        canonical:      document.querySelector('link[rel="canonical"]')?.href || null,
        ogImage:        metas['og:image'] || null,
      };

      return { colors, fonts, tech, meta, tokens, typeSizes: typeSizeSorted, pageStats, seoSignals };
    }
  });

  // Step 4: Normalize results in the service worker
  const scanResult = normalizeAxeResults(axeRaw);
  scanResult.designInfo = designInfo || null;

  // Step 5: Build structured analysis
  const analysis = buildAnalysis(scanResult);

  // Step 6: Store in history
  await storeHistoryEntry(tabId, analysis, scanResult);

  // Step 7: Highlights are sent by the popup directly after it receives the analysis,
  // so we skip sending them here to avoid accumulating duplicate markers on the page.

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
      selectors: (v.nodes || []).map(n => {
        const t = n.target?.[0];
        // axe target can be a nested array for shadow DOM: [['host', 'inner-el']]
        // join with ' ' to form a compound selector string
        return Array.isArray(t) ? t.join(' ') : (t || '');
      }).filter(Boolean),
      html: (v.nodes || []).map(n => n.html || '').filter(Boolean),
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
    metadata: { axeVersion: raw.axeVersion || 'unknown', scanEngine: 'axe-core', scanSource: 'sitescope360-chrome-extension' }
  };
}

/**
 * Ensure content scripts are injected (for highlighting, scrolling, etc.)
 */
async function ensureContentScripts(tabId) {
  try {
    const response = await _sendMessageToTab(tabId, { type: 'ping' });
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
  // Wait for scripts to initialize
  await new Promise(resolve => setTimeout(resolve, 150));
}

/**
 * Send message to a content script in a specific tab.
 * If the content script is not responding, inject it first then retry.
 */
async function sendToTab(tabId, message) {
  // Try sending the message directly first
  const response = await _sendMessageToTab(tabId, message);
  
  // If the content script responded successfully, return its response
  if (response && response.ok === true) {
    return response;
  }
  
  // Content script not loaded or returned an error — inject and retry
  console.log('[Service Worker] Content script not responding, injecting into tab', tabId, '| initial response:', JSON.stringify(response));
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/scanner.js']
    });
    // Small delay for script to initialize
    await new Promise(resolve => setTimeout(resolve, 150));
  } catch (injectErr) {
    console.error('[Service Worker] Failed to inject content script:', injectErr.message);
    return { ok: false, error: 'Cannot inject content script: ' + injectErr.message };
  }
  
  // Retry the original message
  return _sendMessageToTab(tabId, message);
}

/**
 * Low-level message sender — wraps chrome.tabs.sendMessage
 */
function _sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { ok: false, error: 'No response from content script' });
      }
    });
  });
}

/* ═══════════════════════════════════════════
   Lighthouse (PageSpeed Insights) handler
   Runs in the service worker so it survives popup open/close.
   Results cached per URL for LIGHTHOUSE_TTL ms.
   ═══════════════════════════════════════════ */

// Restore in-memory cache from session storage on SW startup
(async () => {
  try {
    const stored = await chrome.storage.session.get('lighthouseCache');
    if (stored.lighthouseCache) {
      for (const [url, entry] of Object.entries(stored.lighthouseCache)) {
        if (Date.now() - entry.fetchedAt < LIGHTHOUSE_TTL) {
          lighthouseCache.set(url, entry);
        }
      }
    }
  } catch { /* session storage unavailable */ }
})();

async function persistLighthouseCache() {
  try {
    const obj = {};
    for (const [url, entry] of lighthouseCache.entries()) obj[url] = entry;
    await chrome.storage.session.set({ lighthouseCache: obj });
  } catch { /* best-effort */ }
}

function getLighthouseCache(url) {
  const cached = lighthouseCache.get(url);
  if (!cached) return { status: 'none' };
  if (Date.now() - cached.fetchedAt > LIGHTHOUSE_TTL) {
    lighthouseCache.delete(url);
    persistLighthouseCache();
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
    const audits = json.lighthouseResult?.audits || {};

    // Extract Core Web Vitals and key metrics
    const metrics = {};
    const metricKeys = [
      'first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time',
      'cumulative-layout-shift', 'speed-index', 'interactive',
      'server-response-time', 'first-meaningful-paint', 'max-potential-fid',
      'render-blocking-resources', 'uses-responsive-images', 'offscreen-images',
      'unminified-css', 'unminified-javascript', 'unused-css-rules', 'unused-javascript',
      'uses-optimized-images', 'uses-webp-images', 'uses-text-compression',
      'uses-rel-preconnect', 'font-display', 'dom-size', 'redirects',
      'network-requests', 'total-byte-weight', 'bootup-time', 'mainthread-work-breakdown',
      'third-party-summary', 'image-alt', 'document-title', 'html-has-lang',
      'meta-description', 'link-text', 'crawlable-anchors', 'is-crawlable',
      'robots-txt', 'hreflang', 'canonical', 'structured-data'
    ];
    for (const key of metricKeys) {
      if (audits[key]) {
        metrics[key] = {
          id: audits[key].id,
          title: audits[key].title,
          description: (audits[key].description || '').replace(/\[.*?\]\(.*?\)/g, '').trim(),
          score: audits[key].score,
          displayValue: audits[key].displayValue || '',
          numericValue: audits[key].numericValue,
          numericUnit: audits[key].numericUnit || '',
          scoreDisplayMode: audits[key].scoreDisplayMode || ''
        };
      }
    }

    // Collect all audits grouped by category for diagnostics
    const diagnostics = [];
    const passedAudits = [];
    for (const [id, audit] of Object.entries(audits)) {
      if (audit.scoreDisplayMode === 'informative' || audit.scoreDisplayMode === 'notApplicable' || audit.scoreDisplayMode === 'manual') continue;
      const entry = {
        id: audit.id,
        title: audit.title,
        description: (audit.description || '').replace(/\[.*?\]\(.*?\)/g, '').trim(),
        score: audit.score,
        displayValue: audit.displayValue || '',
        scoreDisplayMode: audit.scoreDisplayMode || ''
      };
      if (audit.score !== null && audit.score < 1) {
        diagnostics.push(entry);
      } else if (audit.score === 1) {
        passedAudits.push(entry);
      }
    }
    // Sort diagnostics by score ascending (worst first)
    diagnostics.sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

    const data = {
      performance:   Math.round((cats.performance?.score        || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score      || 0) * 100),
      bestPractices: Math.round((cats['best-practices']?.score  || 0) * 100),
      seo:           Math.round((cats.seo?.score                || 0) * 100),
      metrics,
      diagnostics,
      passedAudits,
      fetchedAt:     Date.now()
    };

    lighthouseCache.set(url, { data, fetchedAt: Date.now() });
    await persistLighthouseCache();

    // Push result to popup (if open)
    try { chrome.runtime.sendMessage({ action: 'lighthouse-ready', data }); } catch { /* closed */ }
  } catch (e) {
    console.warn('[SiteScope 360] Lighthouse fetch failed:', e.message);
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
    metadata: scanResult.metadata,
    designInfo: scanResult.designInfo || null
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
   Verify patches — lightweight re-scan (axe only)
   ═══════════════════════════════════════════ */

async function handleVerifyPatches(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    if (!tabId) throw new Error('No active tab found');
  }

  await ensureContentScripts(tabId);

  // Inject axe-core
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/axe.min.js'],
    world: 'MAIN'
  });

  // Run axe.run() in the MAIN world
  const [{ result: axeRaw }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      return new Promise((resolve) => {
        if (typeof axe === 'undefined') {
          resolve({ error: 'axe-core not loaded' });
          return;
        }
        // Reset axe internal state to force fresh analysis of patched DOM
        if (typeof axe.reset === 'function') axe.reset();
        axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
          },
          resultTypes: ['violations', 'passes', 'incomplete'],
          reporter: 'v2'
        }).then(results => {
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

  if (axeRaw.error) throw new Error(axeRaw.error);

  const scanResult = normalizeAxeResults(axeRaw);
  const analysis = buildAnalysis(scanResult);

  return { analysis };
}

/* ═══════════════════════════════════════════
   Fix handler
   ═══════════════════════════════════════════ */

/**
 * Generate a fix using the cascading LLM router
 */
/**
 * Build the config object handed to the LLM router.
 * `designInfo` carries the page's brand palette so deterministic contrast fixes
 * can stay on-brand instead of defaulting to black on white.
 */
function buildLLMConfig(settings, designInfo = null) {
  return {
    privacyMode: settings.privacyMode !== false,  // default: true
    cloudOptIn:  settings.cloudOptIn === true,     // default: false
    localServerUrl: settings.localServerUrl || 'http://localhost:3000',
    llmProvider: settings.llmProvider || '',
    llmModel:    settings.llmModel || '',
    llmApiKey:   settings.llmApiKey || settings.geminiApiKey || '',
    geminiApiKey: settings.geminiApiKey || '',
    designInfo
  };
}

/**
 * Whether this request could reach a third-party host.
 * Privacy mode is the master switch — a saved API key alone is not consent.
 */
function cloudReachable(config) {
  if (config.privacyMode) return false;
  return !!config.llmApiKey || config.cloudOptIn;
}

/**
 * Redact an issue whenever it could leave the machine.
 *
 * Fails CLOSED: if the redactor cannot be reached we strip the raw element HTML
 * rather than transmitting it unredacted.
 */
async function redactIfCloudReachable(issue, config, tabId) {
  if (!cloudReachable(config)) return issue;

  if (tabId) {
    try {
      const redacted = await sendToTab(tabId, { type: 'redact-issue', issue });
      if (redacted?.ok && redacted.redacted) return redacted.redacted;
      console.warn('[SiteScope 360] Redactor returned no result — withholding element HTML');
    } catch (e) {
      console.warn('[SiteScope 360] Redaction failed:', e.message);
    }
  }

  return { ...issue, html: [], nodes: [] };
}

/**
 * Give the model a way to inspect the live page.
 *
 * Only offered when the request is already allowed to reach a provider — the
 * tool results describe the page, so handing them out under privacy mode would
 * reopen the exact hole task 0.1 closed. Returns null when tools must not be used.
 */
function buildToolExecutor(tabId, config) {
  if (!tabId || !cloudReachable(config)) return null;

  return async (name, args) => {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: runDomTool,
        args: [name, args || {}]
      });
      return result ?? { error: 'Tool returned nothing' };
    } catch (e) {
      // Never throw into the model loop — an error object is a usable answer,
      // an exception kills the whole fix request.
      return { error: String(e && e.message ? e.message : e) };
    }
  };
}

async function handleFix(issue, pageUrl, tabId, designInfo, attempts, deterministicOnly = false) {
  const settings = await getSettings();
  const config = buildLLMConfig(settings, designInfo);
  config.attempts = Array.isArray(attempts) ? attempts : [];
  config.deterministicOnly = deterministicOnly === true;
  // No point wiring up page tools for a request that will never reach a model.
  config.executeTool = config.deterministicOnly ? null : buildToolExecutor(tabId, config);

  const safeIssue = await redactIfCloudReachable(issue, config, tabId);

  const fix = await llmRouter.generateFix(safeIssue, pageUrl, config);
  return { fix };
}

/**
 * Full-page analysis — send ALL violations to the LLM in one shot.
 * Returns fixes for every issue + summary + action plan.
 */
async function handleAnalyzeAll(issues, pageUrl, designInfo, tabId) {
  const settings = await getSettings();
  const config = buildLLMConfig(settings, designInfo);

  let safeIssues = issues || [];
  if (cloudReachable(config)) {
    safeIssues = await Promise.all(
      safeIssues.map(i => redactIfCloudReachable(i, config, tabId))
    );
  }

  const result = await llmRouter.generateFullAnalysis(safeIssues, pageUrl, designInfo, config);
  return { result };
}

/* ═══════════════════════════════════════════
   Judgment scan — issues the automated audit passes
   ═══════════════════════════════════════════ */

/**
 * Collect candidates from the page and assess them for quality rather than
 * presence. Deliberately runs no model: the heuristics are instant, free, and
 * give the same answer every time, which is what makes the result demonstrable.
 */
async function handleJudgmentScan(tabId, automatedPassCount = null) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    if (!tabId) throw new Error('No active tab found');
  }

  const [{ result: payload }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: collectJudgmentCandidates
  });

  if (!payload) throw new Error('Could not read the page');

  // Keyboard behaviour is measured on the live page, then merged into the same
  // set — from the user's point of view these are all "things the automated
  // audit passed", and splitting them across two panels would hide them.
  let keyboardFindings = [];
  try {
    const [{ result: profile }] = await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', func: globalThis.Keyboard.collectFocusProfile
    });
    if (profile) keyboardFindings = globalThis.Keyboard.assessFocusOrder(profile);
  } catch (e) {
    console.warn('[SiteScope 360] keyboard pass failed:', e.message);
  }

  // Sequence-level screen reader problems belong in the same panel: individually
  // valid controls that are unusable heard one after another.
  let srFindings = [];
  try {
    const sr = await screenReaderScan(tabId);
    srFindings = sr.findings;
  } catch (e) {
    console.warn('[SiteScope 360] screen reader pass failed:', e.message);
  }

  let readingOrderFindings = [];
  try {
    const [{ result: roProfile }] = await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', func: globalThis.ReadingOrder.collectReadingOrderProfile
    });
    if (roProfile) readingOrderFindings = globalThis.ReadingOrder.assessReadingOrder(roProfile.elements);
  } catch (e) {
    console.warn('[SiteScope 360] reading-order pass failed:', e.message);
  }

  // 3.1's LLM nuance pass — optional, silent on failure, and only attempted
  // when cloud is actually reachable. This is additive polish on top of a
  // panel that already works with zero network calls; it must never be able
  // to block or degrade the deterministic result.
  let nuanceFindings = [];
  try {
    const settings = await getSettings();
    const config = buildLLMConfig(settings);
    if (cloudReachable(config) && config.llmApiKey) {
      const provider = config.llmProvider || 'gemini';
      const callProvider = (prompt, schema) => llmRouter._callProvider(
        provider, config.llmModel, config.llmApiKey, prompt, { schema, schemaName: 'judgment_nuance' }
      );
      nuanceFindings = await runJudgmentNuancePass(callProvider, payload);
    }
  } catch (e) {
    console.warn('[SiteScope 360] judgment nuance pass skipped:', e.message);
  }

  const findings = [
    ...assessCandidates(payload), ...keyboardFindings, ...srFindings,
    ...readingOrderFindings, ...nuanceFindings
  ];

  return {
    findings,
    summary: summarizeJudgment(findings, automatedPassCount),
    scanned: {
      images: payload.images?.length || 0,
      links:  payload.links?.length  || 0
    }
  };
}

/* ═══════════════════════════════════════════
   Impairment simulation — 3.8
   ═══════════════════════════════════════════ */

/**
 * Runs directly via chrome.scripting rather than a content-script message: the
 * effect is a DOM style change, and executeScript avoids the ping/inject dance
 * sendToTab does for a one-shot call.
 */
async function handleImpairmentApply(tabId, key) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    if (!tabId) throw new Error('No active tab found');
  }
  const svgDefsHtml = key ? globalThis.Impairment.buildSvgDefs() : null;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN',
    func: globalThis.Impairment.applyImpairment,
    args: [key || null, globalThis.Impairment.PRESETS, svgDefsHtml]
  });
  return result || { active: null };
}

/* ═══════════════════════════════════════════
   Vision analysis — 3.2 / 3.3
   ═══════════════════════════════════════════ */

/** Resolve which vision-capable provider/key to use, honoring privacy mode exactly like text fixes. */
async function visionCredentials() {
  const settings = await getSettings();
  const config = buildLLMConfig(settings);
  if (!cloudReachable(config)) throw new Error('Vision analysis needs cloud AI, which is off under Privacy Mode.');
  const provider = config.llmProvider || (config.llmApiKey ? 'gemini' : 'none');
  if (provider === 'none' || !config.llmApiKey) throw new Error('No AI provider configured — add an API key in Settings.');
  return { provider, model: config.llmModel, apiKey: config.llmApiKey };
}

async function handleVisionScan(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    if (!tabId) throw new Error('No active tab found');
  }
  const { provider, model, apiKey } = await visionCredentials();
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
  const findings = await analyzeScreenshot(provider, model, apiKey, dataUrl);
  return { findings };
}

async function handleVisionAlt(tabId, imageSrc) {
  if (!imageSrc) throw new Error('No image supplied');
  const { provider, model, apiKey } = await visionCredentials();

  // Fetch the actual pixels rather than re-screenshotting the tab — works for
  // any image on the page, not just what happens to be in the viewport.
  const res = await fetch(imageSrc);
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const altText = await describeImageFromVision(provider, model, apiKey, dataUrl);
  if (!altText) throw new Error('Could not generate a description');
  return { altText };
}

/* ═══════════════════════════════════════════
   Screen reader preview
   ═══════════════════════════════════════════ */

async function screenReaderScan(tabId) {
  if (!tabId) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    if (!tabId) throw new Error('No active tab found');
  }
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: globalThis.ScreenReader.collectAnnouncements
  });
  if (!result) throw new Error('Could not read the page');

  return {
    transcript: globalThis.ScreenReader.buildTranscript(result.items),
    findings: globalThis.ScreenReader.assessTranscript(result.items),
    url: result.url
  };
}

/* ═══════════════════════════════════════════
   Multi-page crawl
   ═══════════════════════════════════════════ */

/**
 * Find pages to scan. Tries the sitemap first, following one level of
 * sitemapindex; falls back to same-origin links on the current page.
 */
async function discoverPages(origin, limit) {
  if (!origin) throw new Error('No origin supplied');
  const cap = Math.min(limit || globalThis.Crawl.DEFAULT_LIMIT, 100);

  const fetchText = async (url) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      return r.ok ? await r.text() : null;
    } catch { return null; }
  };

  for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
    const xml = await fetchText(origin + path);
    if (!xml) continue;

    let { urls, isIndex } = globalThis.Crawl.parseSitemap(xml);

    // A sitemapindex lists sitemaps, not pages — resolve one level deeper or we
    // would hand back .xml files and scan nothing useful.
    if (isIndex) {
      const nested = [];
      for (const sm of urls.slice(0, 5)) {
        const child = await fetchText(sm);
        if (child) nested.push(...globalThis.Crawl.parseSitemap(child).urls);
        if (nested.length >= cap) break;
      }
      urls = nested;
    }

    const pages = globalThis.Crawl.filterCrawlUrls(urls, { origin, limit: cap });
    if (pages.length) return { urls: pages, source: 'sitemap' };
  }

  return { urls: [], source: 'none' };
}

/**
 * Scan each URL in a background tab, one at a time.
 *
 * Sequential on purpose: parallel tabs race for CPU and produce unstable axe
 * results, and hammering a customer's site from their own browser is not a good
 * first impression. Every tab is closed in a finally block so a failed scan
 * cannot leak tabs.
 */
async function crawlScan(urls) {
  const results = [];

  for (const url of (urls || [])) {
    let tab = null;
    try {
      tab = await chrome.tabs.create({ url, active: false });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out loading page')), 30000);
        const listener = (id, info) => {
          if (id === tab.id && info.status === 'complete') {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      const { analysis } = await handleScan(tab.id);
      results.push({ url, analysis });
    } catch (e) {
      results.push({ url, error: e.message });
    } finally {
      if (tab?.id) { try { await chrome.tabs.remove(tab.id); } catch { /* already gone */ } }
    }
  }

  return { results, summary: globalThis.Crawl.aggregateCrawl(results) };
}

/* ═══════════════════════════════════════════
   Audit log — persisted so the record outlives the popup
   ═══════════════════════════════════════════ */

const AUDIT_KEY = 'remediationAudit';

async function appendAudit(entry) {
  const built = globalThis.AuditLog.makeAuditEntry(entry || {});
  if (!built) return { appended: false };

  const { [AUDIT_KEY]: log = [] } = await chrome.storage.local.get(AUDIT_KEY);
  await chrome.storage.local.set({ [AUDIT_KEY]: globalThis.AuditLog.appendEntry(log, built) });
  return { appended: true, entry: built };
}

async function getAudit(pageUrl) {
  const { [AUDIT_KEY]: log = [] } = await chrome.storage.local.get(AUDIT_KEY);
  const entries = globalThis.AuditLog.entriesForPage(log, pageUrl);
  return { entries, summary: globalThis.AuditLog.summarizeAudit(entries) };
}

/** 6.2 — fold externally-supplied entries (from an imported team bundle) into
 *  the same append-only log real usage writes to, reusing its exact bounding
 *  and ordering rules rather than a separate import path. */
async function mergeAuditEntries(entries) {
  const { [AUDIT_KEY]: log = [] } = await chrome.storage.local.get(AUDIT_KEY);
  let next = log;
  for (const raw of (entries || [])) {
    const built = globalThis.AuditLog.makeAuditEntry(raw);
    if (built) next = globalThis.AuditLog.appendEntry(next, built);
  }
  await chrome.storage.local.set({ [AUDIT_KEY]: next });
  return { merged: next.length - log.length };
}

async function clearAudit() {
  await chrome.storage.local.remove(AUDIT_KEY);
  return { cleared: true };
}

/* ═══════════════════════════════════════════
   6.5 — GitHub pull request generation
   ═══════════════════════════════════════════ */

async function handleGithubOpenPr(entries, pageUrl, patchContent) {
  const settings = await getSettings();
  const { githubToken, githubOwner, githubRepo, githubBaseBranch } = settings;
  if (!githubToken || !githubOwner || !githubRepo) {
    throw new Error('Connect a GitHub repo in Settings first (token, owner, repo).');
  }
  return createAccessibilityPr({
    token: githubToken, owner: githubOwner, repo: githubRepo,
    baseBranch: githubBaseBranch || 'main', entries, pageUrl, patchContent
  });
}

/* ═══════════════════════════════════════════
   4.2 — Ambient background scanning
   ═══════════════════════════════════════════ */

const lastAmbientScanAt = new Map(); // tabId -> timestamp

async function handleAmbientTrigger(tabId, url) {
  if (!tabId || !url) return { skipped: true };
  const settings = await getSettings();
  if (!settings.ambientScanEnabled) return { skipped: true };

  const { scanHistory = [] } = await chrome.storage.local.get('scanHistory');
  if (!shouldAmbientScan(url, scanHistory, true, lastAmbientScanAt.get(tabId) || 0)) {
    return { skipped: true };
  }

  const baseline = findBaseline(scanHistory, url);
  lastAmbientScanAt.set(tabId, Date.now());

  let analysis;
  try {
    ({ analysis } = await handleScan(tabId));
  } catch (e) {
    return { skipped: true, error: e.message };
  }

  const result = detectRegression(baseline, analysis);
  if (result.regressed && chrome.notifications) {
    try {
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon-128.png',
        title: 'SiteScope 360 — regression detected',
        message: `${new URL(url).hostname}: ${result.message}`
      });
    } catch (e) {
      console.warn('[SiteScope 360] notification failed (permission likely not granted):', e.message);
    }
  }

  await storeHistoryEntry(tabId, analysis, {});
  return { skipped: false, regressed: result.regressed };
}

// Regular (non-SPA) navigations reuse the same gate.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) handleAmbientTrigger(tabId, tab.url).catch(() => {});
});

/* ═══════════════════════════════════════════
   4.3 — Natural language control over the scan
   ═══════════════════════════════════════════ */

async function handleChatCommand(instruction, issues) {
  if (!instruction || !instruction.trim()) throw new Error('No instruction given');

  const settings = await getSettings();
  const config = buildLLMConfig(settings);
  if (!cloudReachable(config) || !config.llmApiKey) {
    throw new Error('Chat control needs cloud AI, which is off under Privacy Mode or has no API key configured.');
  }

  const provider = config.llmProvider || 'gemini';
  const callProvider = (prompt, schema) => llmRouter._callProvider(
    provider, config.llmModel, config.llmApiKey, prompt, { schema, schemaName: 'chat_plan' }
  );

  const plan = await interpretChatCommand(callProvider, instruction, issues || []);
  const matched = applyChatPlan(issues || [], plan);
  return { plan, matchedIssueIds: matched.map(i => i.id) };
}

/* ═══════════════════════════════════════════
   Settings
   ═══════════════════════════════════════════ */

const DEFAULT_SETTINGS = {
  privacyMode: true,
  cloudOptIn: false,
  localServerUrl: 'http://localhost:3000',
  geminiApiKey: '',
  llmProvider: '',
  llmModel: '',
  llmApiKey: '',
  autoHighlight: true,
  showBadge: true,
  scanOnLoad: false,
  ambientScanEnabled: false,
  githubToken: '', githubOwner: '', githubRepo: '', githubBaseBranch: 'main',
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
    // Set default settings with API keys
    const settingsWithKey = {
      ...DEFAULT_SETTINGS,
      geminiApiKey: 'AIzaSyAegjD3Yp0xsIRdcshnmzzv0l4fAnIltXU',
      pagespeedApiKey: 'AIzaSyDSENFWIIUXmeTMl4x92OYjdv6LY_KKsZQ'
    };
    await chrome.storage.local.set(settingsWithKey);
    console.log('[SiteScope 360] Extension installed — defaults set with API keys');
  } else if (details.reason === 'update') {
    // Set Gemini API key on update if not already set
    const { geminiApiKey, pagespeedApiKey } = await chrome.storage.local.get(['geminiApiKey', 'pagespeedApiKey']);
    if (!geminiApiKey) {
      await chrome.storage.local.set({ geminiApiKey: 'AIzaSyAegjD3Yp0xsIRdcshnmzzv0l4fAnIltXU' });
      console.log('[SiteScope 360] Extension updated — Gemini API key added');
    }
    if (!pagespeedApiKey) {
      await chrome.storage.local.set({ pagespeedApiKey: 'AIzaSyDSENFWIIUXmeTMl4x92OYjdv6LY_KKsZQ' });
      console.log('[SiteScope 360] Extension updated — PageSpeed API key added');
    }
  }

  // Pre-detect LLM capabilities
  const caps = await llmRouter.detectCapabilities();
  console.log('[SiteScope 360] LLM capabilities:', caps);
});

// Seed API keys on every SW startup (covers reload without remove/re-add)
async function seedApiKeys() {
  const { pagespeedApiKey, geminiApiKey } = await chrome.storage.local.get(['pagespeedApiKey', 'geminiApiKey']);
  const patch = {};
  if (!pagespeedApiKey) patch.pagespeedApiKey = 'AIzaSyDSENFWIIUXmeTMl4x92OYjdv6LY_KKsZQ';
  if (!geminiApiKey)    patch.geminiApiKey    = 'AIzaSyAegjD3Yp0xsIRdcshnmzzv0l4fAnIltXU';
  if (Object.keys(patch).length) await chrome.storage.local.set(patch);
}
seedApiKeys();

console.log('[SiteScope 360] Service worker loaded');
