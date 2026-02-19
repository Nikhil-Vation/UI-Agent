/**
 * Accea Agent Chrome Extension — Popup Controller V2
 * Enhanced with: Tabs, History, Export, Confetti, Filters,
 * Animated counters, Scan timer, Keyboard shortcuts
 */

/* ═══════ DOM refs ═══════ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const escHtml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const els = {
  // Views
  viewMain:     $('#view-main'),
  viewSettings: $('#view-settings'),
  introHero:    $('#intro-hero'),
  
  // Score
  scoreCard:    $('#score-card'),
  scoreArc:     $('#score-arc'),
  scoreNumber:  $('#score-number'),
  scoreStatus:  $('#score-status'),
  scoreSummary: $('#score-summary'),
  scoreGrade:   $('#score-grade'),
  scoreSource:  $('#score-source'),
  scoreInfoBtn: $('#score-info-btn'),
  scoreBreakdown: $('#score-breakdown'),
  breakdownRows:  $('#breakdown-rows'),
  scoreAttribution: $('#score-attribution'),
  lhLoadingHint:    $('#lh-loading-hint'),
  scanTime:     $('#scan-time'),
  
  // Badges
  badges:       $('#severity-badges'),
  badgeCritical:$('#badge-critical'),
  badgeSerious: $('#badge-serious'),
  badgeModerate:$('#badge-moderate'),
  badgeMinor:   $('#badge-minor'),
  
  // Actions
  btnScan:      $('#btn-scan'),
  btnSettings:  $('#btn-settings'),
  btnBack:      $('#btn-back'),
  btnHighlight: $('#btn-highlight'),
  btnFixAll:    $('#btn-fix-all'),
  btnClear:     $('#btn-clear'),
  btnDetect:    $('#btn-detect'),
  
  // Tabs
  tabBar:       $('#tab-bar'),
  quickActions: $('#quick-actions'),
  filterBar:    $('#filter-bar'),
  
  // Prefetch status
  prefetchStatus:  $('#prefetch-status'),
  prefetchIcon:    $('#prefetch-icon'),
  prefetchText:    $('#prefetch-text'),
  prefetchProgress:$('#prefetch-progress'),
  prefetchBarFill: $('#prefetch-bar-fill'),

  // Containers
  loading:      $('#loading'),
  progressBar:  $('#scan-progress-bar'),
  error:        $('#error'),
  errorText:    $('#error-text'),
  issuesContainer: $('#issues-container'),
  issuesList:   $('#issues-list'),
  issueCount:   $('#issue-count'),
  
  // History
  historyList:  $('#history-list'),
  historyEmpty: $('#history-empty'),
  
  // Checklist
  checklistList:     $('#checklist-list'),
  checklistEmpty:    $('#checklist-empty'),
  checklistLighthouse: $('#checklist-lighthouse'),
  checklistLhScores: $('#checklist-lh-scores'),

  // Lighthouse (real)
  lighthouseSection: $('#lighthouse-section'),
  lighthouseScores:  $('#lighthouse-scores'),
  lhStatus:          $('#lh-status'),
  
  // Settings
  settingPrivacy:       $('#setting-privacy'),
  settingCloud:         $('#setting-cloud'),
  settingServerUrl:     $('#setting-server-url'),
  settingAutoHighlight: $('#setting-auto-highlight'),
  settingBadge:         $('#setting-badge'),
  settingPsApiKey:      $('#setting-ps-api-key'),
  
  // Capabilities
  capOverall:   $('#cap-overall'),
  capWindowAI:  $('#cap-windowai'),
  capLocalhost: $('#cap-localhost'),
  capCloud:     $('#cap-cloud'),
  
  // Fix modal
  fixModal:     $('#fix-modal'),
  fixTitle:     $('#fix-title'),
  fixBody:      $('#fix-body'),
  fixClose:     $('#fix-close'),

  // Toast & confetti
  toast:        $('#toast'),
  confettiCanvas: $('#confetti-canvas'),

  // Design tab
  designEmpty:        $('#design-empty'),
  designContent:      $('#design-content'),
  designMetaSection:  $('#design-meta-section'),
  designColorsSection:$('#design-colors-section'),
  designFontsSection: $('#design-fonts-section'),
  designTechSection:  $('#design-tech-section'),
  designTokensSection:$('#design-tokens-section'),

  // Tips tab
  tipsEmpty:         $('#tips-empty'),
  quickWins:         $('#quick-wins'),
  quickWinsList:     $('#quick-wins-list'),
  seoCrossover:      $('#seo-crossover'),
  seoCrossoverList:  $('#seo-crossover-list'),
  improvementInsights: $('#improvement-insights'),
  improvementList:   $('#improvement-list'),
};

/* ═══════ SVG Icon Templates ═══════ */
const SVG = {
  locate: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>',
  suggest: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>',
  zap: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  copy: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  lock: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  cloud: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  checkCircle: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  xCircle: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  alertTriangle: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
};

/** Page-level axe rule IDs (affect the whole document, not individual elements) */
const PAGE_LEVEL_RULES = new Set([
  'html-has-lang', 'html-lang-valid', 'document-title', 'meta-viewport',
  'bypass', 'landmark-one-main', 'region', 'page-has-heading-one',
  'html-xml-lang-mismatch', 'valid-lang'
]);

/* ═══════ State ═══════ */
let currentTabId = null;
let currentAnalysis = null;
let highlightsActive = false;
let scanStartTime = null;
let activeFilter = 'all';

/* ═══════ Lighthouse state ═══════ */
let lighthouseData = null;
let lighthouseLoading = false;

/* ═══════ Suggestion cache (pre-fetched) ═══════ */
const suggestionCache = new Map(); // key: issue.id, value: fix response
let prefetchInProgress = false;
let prefetchTotal = 0;
let prefetchDone = 0;

/* ═══════ Typewriter engine ═══════ */

const TYPEWRITER_PHRASES = [
  'Accessible',
  'SEO-Friendly',
  'Lighthouse Ready',
  'Mobile Responsive',
  'Lazy Load Ready',
  'Inclusive',
  'WCAG Compliant',
  'Privacy Safe',
];

let _twTimer = null;

function startTypewriter() {
  const el = document.getElementById('typewriter-word');
  if (!el) return;

  let phraseIdx = 0;
  let charIdx = 0;
  let deleting = false;
  const TYPE_SPEED = 80;
  const DELETE_SPEED = 45;
  const PAUSE_AFTER_TYPE = 1800;
  const PAUSE_AFTER_DELETE = 350;

  function tick() {
    const phrase = TYPEWRITER_PHRASES[phraseIdx];

    if (!deleting) {
      charIdx++;
      el.textContent = phrase.slice(0, charIdx);
      if (charIdx === phrase.length) {
        deleting = true;
        _twTimer = setTimeout(tick, PAUSE_AFTER_TYPE);
        return;
      }
      _twTimer = setTimeout(tick, TYPE_SPEED);
    } else {
      charIdx--;
      el.textContent = phrase.slice(0, charIdx);
      if (charIdx === 0) {
        deleting = false;
        phraseIdx = (phraseIdx + 1) % TYPEWRITER_PHRASES.length;
        _twTimer = setTimeout(tick, PAUSE_AFTER_DELETE);
        return;
      }
      _twTimer = setTimeout(tick, DELETE_SPEED);
    }
  }

  tick();
}

function stopTypewriter() {
  if (_twTimer) { clearTimeout(_twTimer); _twTimer = null; }
}

/* ═══════ Init ═══════ */

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id;

  await loadSettings();
  detectCapabilities();
  bindEvents();
  startTypewriter();

  // Listen for Lighthouse results pushed from the service worker.
  // The SW fetches in background; this fires whether or not the popup was open during fetch.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== 'lighthouse-ready') return;
    lighthouseLoading = false;
    if (msg.error) {
      lighthouseData = { error: msg.error };
    } else if (msg.data) {
      lighthouseData = msg.data;
    }
    els.lhLoadingHint?.classList.add('hidden');
    renderLighthouseSection();
    renderChecklistLighthouse();
    upgradeScoreCardWithLighthouse();
  });

  // If popup opens after a scan already happened, try to get cached Lighthouse data
  if (currentTabId) {
    try {
      const cachedTab = await chrome.tabs.get(currentTabId);
      if (cachedTab?.url) {
        const cached = await sendMessage({ action: 'get-lighthouse', url: cachedTab.url });
        if (cached?.status === 'ready' && cached.data) {
          lighthouseLoading = false;
          lighthouseData = cached.data;
          // Only render if a scan result is already showing
          if (!els.scoreCard.classList.contains('hidden')) {
            els.lhLoadingHint?.classList.add('hidden');
            renderLighthouseSection();
            renderChecklistLighthouse();
            upgradeScoreCardWithLighthouse();
          }
        }
      }
    } catch { /* no cached data, that's fine */ }
  }
});

/* ═══════ Event binding ═══════ */

function bindEvents() {
  els.btnScan.addEventListener('click', handleScan);
  els.btnSettings.addEventListener('click', showSettings);
  els.btnBack.addEventListener('click', hideSettings);
  els.btnHighlight.addEventListener('click', toggleHighlights);
  els.btnClear.addEventListener('click', clearHighlights);
  els.btnDetect.addEventListener('click', detectCapabilities);
  els.fixClose.addEventListener('click', closeFixModal);
  els.fixModal.addEventListener('click', (e) => {
    if (e.target === els.fixModal) closeFixModal();
  });

  // Tab switching
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Severity filter pills
  $$('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => filterIssues(pill.dataset.filter));
  });

  // Export cards
  $$('.export-card').forEach(card => {
    card.addEventListener('click', () => handleExport(card.dataset.export));
  });

  // Fix All
  els.btnFixAll?.addEventListener('click', handleFixAll);

  // Score info toggle
  els.scoreInfoBtn.addEventListener('click', toggleScoreBreakdown);

  // Settings auto-save
  const settingInputs = [
    els.settingPrivacy, els.settingCloud,
    els.settingAutoHighlight, els.settingBadge
  ];
  settingInputs.forEach(input => {
    input.addEventListener('change', saveCurrentSettings);
  });
  els.settingServerUrl.addEventListener('blur', saveCurrentSettings);

  // Privacy mode controls cloud opt-in
  els.settingPrivacy.addEventListener('change', () => {
    if (els.settingPrivacy.checked) {
      els.settingCloud.checked = false;
      els.settingCloud.disabled = true;
    } else {
      els.settingCloud.disabled = false;
    }
  });

  // Keyboard shortcut: Cmd+Shift+A
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
      e.preventDefault();
      handleScan();
    }
  });
}

/* ═══════ Tab switching ═══════ */

function switchTab(tabName) {
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));

  if (tabName === 'history') loadHistory();
  if (tabName === 'tips') renderTips();
  if (tabName === 'checklist') renderChecklist();
  if (tabName === 'design') renderDesignTab();
}

/* ═══════ Design tab ═══════ */

/* Tech colour map for recognisable brand colours */
const TECH_COLORS = {
  'React':'#61dafb','Next.js':'#fff','Vue':'#42b883','Nuxt':'#00dc82',
  'Angular':'#dd0031','Svelte':'#ff3e00','Gatsby':'#663399','Remix':'#f44250',
  'jQuery':'#0769ad','Bootstrap':'#7952b3','Tailwind':'#38bdf8',
  'WordPress':'#21759b','Shopify':'#96bf48','Webflow':'#4353ff',
  'Framer':'#0055ff','GSAP':'#88ce02','Lodash':'#3492ff',
  'TypeScript':'#3178c6','Vite':'#bd34fe','Webpack':'#8dd6f9','GraphQL':'#e10098'
};

function renderDesignTab() {
  const d = currentAnalysis?.designInfo;
  if (!d) {
    els.designEmpty.classList.remove('hidden');
    els.designContent.classList.add('hidden');
    return;
  }
  els.designEmpty.classList.add('hidden');
  els.designContent.classList.remove('hidden');

  const meta   = d.meta   || {};
  const colors = d.colors || [];
  const fonts  = d.fonts  || [];
  const tech   = d.tech   || [];
  const tokens = d.tokens || {};
  const tokenEntries = Object.entries(tokens);

  // ── 1. Page Identity hero card ──
  const faviconHtml = meta.favicon
    ? `<img class="di-favicon" src="${escHtml(meta.favicon)}" alt="" onerror="this.style.display='none'">`
    : `<div class="di-favicon-fallback"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>`;
  const themeStyle = meta.themeColor ? `border-top: 3px solid ${meta.themeColor};` : '';
  const urlHost = (() => { try { return new URL(meta.url || '').hostname; } catch(e) { return meta.url || ''; } })();

  els.designMetaSection.innerHTML = `
    <div class="di-hero" style="${themeStyle}">
      <div class="di-hero-head">
        ${faviconHtml}
        <div class="di-hero-text">
          <div class="di-hero-title">${escHtml(meta.title || urlHost || 'Untitled')}</div>
          <div class="di-hero-url">${escHtml(urlHost)}</div>
        </div>
        ${meta.lang ? `<span class="di-lang-badge">${escHtml(meta.lang.toUpperCase())}</span>` : ''}
      </div>
      ${meta.description ? `<p class="di-description">${escHtml(meta.description.slice(0,120))}${meta.description.length > 120 ? '…' : ''}</p>` : ''}
      <div class="di-pills-row">
        ${meta.charset    ? `<span class="di-pill">${escHtml(meta.charset)}</span>` : ''}
        ${meta.viewport   ? `<span class="di-pill" title="${escHtml(meta.viewport)}">responsive</span>` : ''}
        ${meta.twitterCard? `<span class="di-pill">Twitter card</span>` : ''}
        ${meta.ogTitle    ? `<span class="di-pill">Open Graph</span>` : ''}
        ${meta.themeColor ? `<span class="di-pill" style="background:${escHtml(meta.themeColor)};color:#fff;border-color:transparent">${escHtml(meta.themeColor)}</span>` : ''}
      </div>
    </div>`;

  // ── 2. Colour palette ──
  if (colors.length) {
    // Build a wide gradient strip from the top colours
    const strip = colors.map(c => c.hex).join(', ');
    const big   = colors.slice(0, 5);
    const rest  = colors.slice(5);
    els.designColorsSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
            Colour Palette
          </span>
          <span class="di-badge">${colors.length}</span>
        </div>
        <div class="di-color-strip" style="background:linear-gradient(to right,${strip})"></div>
        <div class="di-color-row">
          ${big.map(c => `
            <button class="di-swatch" style="background:${c.hex}" title="${c.hex} · ${c.count}×"
              data-hex="${c.hex}"
              onclick="navigator.clipboard?.writeText('${c.hex}');this.setAttribute('data-copied','1');setTimeout(()=>this.removeAttribute('data-copied'),1300)">
            </button>`).join('')}
          ${rest.length ? `<div class="di-swatch-more">${rest.map(c=>`<button class="di-swatch di-swatch-sm" style="background:${c.hex}" title="${c.hex}" onclick="navigator.clipboard?.writeText('${c.hex}');this.setAttribute('data-copied','1');setTimeout(()=>this.removeAttribute('data-copied'),1300)"></button>`).join('')}</div>` : ''}
        </div>
        <div class="di-color-labels">
          ${big.map(c => `<span class="di-color-label">${c.hex}</span>`).join('')}
        </div>
      </div>`;
  } else {
    els.designColorsSection.innerHTML = '';
  }

  // ── 3. Typography ──
  if (fonts.length) {
    els.designFontsSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            Typography
          </span>
          <span class="di-badge">${fonts.length}</span>
        </div>
        <div class="di-font-list">
          ${fonts.map((f, i) => {
            const sizes = ['28px','20px','15px','13px','12px'];
            const sz = sizes[Math.min(i, sizes.length - 1)];
            const primary = f.split(',')[0].replace(/["']/g,'').trim();
            return `
              <div class="di-font-row">
                <div class="di-font-preview" style="font-family:${f};font-size:${sz}">${escHtml(primary)}</div>
                <div class="di-font-name">${escHtml(primary)}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  } else {
    els.designFontsSection.innerHTML = '';
  }

  // ── 4. Tech Stack ──
  if (tech.length) {
    els.designTechSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Tech Stack
          </span>
          <span class="di-badge">${tech.length}</span>
        </div>
        <div class="di-tech-grid">
          ${tech.map(t => {
            const col = TECH_COLORS[t] || 'rgba(255,255,255,0.15)';
            return `<div class="di-tech-item">
              <span class="di-tech-dot" style="background:${col};box-shadow:0 0 6px ${col}40"></span>
              <span class="di-tech-name">${escHtml(t)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  } else {
    els.designTechSection.innerHTML = '';
  }

  // ── 5. CSS Design Tokens ──
  if (tokenEntries.length) {
    const colorTokens = tokenEntries.filter(([,v]) => /^#|^rgb|^hsl/.test((v||'').trim()));
    const otherTokens = tokenEntries.filter(([,v]) => !/^#|^rgb|^hsl/.test((v||'').trim()));
    els.designTokensSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            CSS Tokens
          </span>
          <span class="di-badge">${tokenEntries.length}</span>
        </div>
        ${colorTokens.length ? `
          <div class="di-tokens-label">Colour tokens</div>
          <div class="di-token-swatches">
            ${colorTokens.slice(0,20).map(([k,v]) => `
              <div class="di-token-swatch-wrap" title="${escHtml(k)}: ${escHtml(v)}">
                <div class="di-token-swatch" style="background:${escHtml(v)}"></div>
                <span class="di-token-var">${escHtml(k.replace('--',''))}</span>
              </div>`).join('')}
          </div>` : ''}
        ${otherTokens.length ? `
          <div class="di-tokens-label" style="margin-top:10px">Other tokens</div>
          <div class="di-token-rows">
            ${otherTokens.slice(0,16).map(([k,v]) => `
              <div class="di-token-row">
                <span class="di-token-key">${escHtml(k)}</span>
                <span class="di-token-val">${escHtml(v.length>32?v.slice(0,29)+'…':v)}</span>
              </div>`).join('')}
            ${otherTokens.length > 16 ? `<div class="di-token-row"><span class="di-token-key" style="color:var(--text-muted)">+${otherTokens.length-16} more</span></div>` : ''}
          </div>` : ''}
      </div>`;
  } else {
    els.designTokensSection.innerHTML = '';
  }
}

/* ═══════ Severity filter ═══════ */

function filterIssues(severity) {
  activeFilter = severity;
  $$('.filter-pill').forEach(p => {
    p.classList.remove('active', 'active-all');
    if (p.dataset.filter === severity) {
      p.classList.add(severity === 'all' ? 'active-all' : 'active');
    }
  });

  $$('.issue-card').forEach(card => {
    if (severity === 'all') {
      card.style.display = '';
    } else {
      const dot = card.querySelector('.issue-severity-dot');
      card.style.display = dot?.classList.contains(severity) ? '' : 'none';
    }
  });
}

/* ═══════ Scan ═══════ */

async function handleScan() {
  if (!currentTabId) {
    showError('No active tab found');
    return;
  }

  // Dismiss intro hero with smooth animation
  if (els.introHero && !els.introHero.classList.contains('hidden')) {
    stopTypewriter();
    els.introHero.classList.add('intro-exit');
    setTimeout(() => {
      els.introHero.classList.add('hidden');
    }, 400);
  }

  // Reset UI
  els.btnScan.disabled = true;
  els.btnScan.querySelector('.btn-scan-text').textContent = 'Scanning…';
  els.loading.classList.remove('hidden');
  els.error.classList.add('hidden');
  els.issuesContainer.classList.add('hidden');
  els.scoreCard.classList.add('hidden');
  els.scoreBreakdown.classList.remove('expanded');
  els.scoreBreakdown.classList.add('hidden');
  els.scoreInfoBtn.classList.remove('active');
  els.scoreAttribution.classList.add('hidden');
  els.lhLoadingHint.classList.add('hidden');
  clearTimeout(_breakdownAutoTimer);
  _breakdownUserTouched = false;
  els.badges.classList.add('hidden');
  els.tabBar.classList.add('hidden');
  els.quickActions.classList.add('hidden');
  els.filterBar.classList.add('hidden');
  updatePrefetchStatus('hide');

  // Fake progress bar
  scanStartTime = Date.now();
  animateProgress();

  try {
    const response = await sendMessage({ action: 'scan', tabId: currentTabId });

    if (!response?.ok) {
      throw new Error(response?.error || 'Scan failed');
    }

    currentAnalysis = response.analysis;
    const duration = ((Date.now() - scanStartTime) / 1000).toFixed(1);
    currentAnalysis._scanDuration = duration;

    renderResults(response.analysis);
    saveToHistory(response.analysis);

    // Pre-fetch code suggestions in background so they're ready instantly
    suggestionCache.clear();
    prefetchSuggestions();

    // Fetch real Lighthouse scores in parallel (non-blocking)
    fetchLighthouseScores();
  } catch (err) {
    showError(err.message);
  } finally {
    els.btnScan.disabled = false;
    els.btnScan.querySelector('.btn-scan-text').textContent = 'Scan Again';
    els.loading.classList.add('hidden');
    els.progressBar.style.width = '0%';
  }
}

function animateProgress() {
  let progress = 0;
  const interval = setInterval(() => {
    if (els.loading.classList.contains('hidden')) {
      clearInterval(interval);
      return;
    }
    progress += Math.random() * 15;
    if (progress > 90) progress = 90;
    els.progressBar.style.width = `${progress}%`;
  }, 200);
}

/* ═══════ Render results ═══════ */

function renderResults(analysis) {
  const score = analysis.auditScore || 0;

  // Animated score counter
  animateCounter(els.scoreNumber, 0, score, 800);

  // Score ring — animate after a slight delay
  setTimeout(() => {
    els.scoreArc.setAttribute('stroke-dasharray', `${score}, 100`);
  }, 50);
  
  // Score color
  if (score >= 90) els.scoreArc.style.stroke = 'var(--green)';
  else if (score >= 70) els.scoreArc.style.stroke = 'var(--orange)';
  else els.scoreArc.style.stroke = 'var(--red)';

  // Grade badge
  const grade = getGrade(score);
  els.scoreGrade.textContent = grade.label;
  els.scoreGrade.className = `score-grade ${grade.class}`;
  els.scoreGrade.classList.remove('hidden');

  // Score source badge — initially axe-core, upgraded when Lighthouse arrives
  els.scoreSource.textContent = 'axe-core';
  els.scoreSource.className = 'score-source axe';
  els.scoreSource.title = 'Score from axe-core engine — Lighthouse score loading…';
  els.scoreSource.classList.remove('hidden');

  // Info button + initial breakdown
  els.scoreInfoBtn.classList.remove('hidden');
  renderScoreBreakdown(score, null);

  // Always-visible attribution + loading hint
  els.scoreAttribution.classList.remove('hidden');
  els.lhLoadingHint.classList.remove('hidden');

  const status = analysis.complianceStatus || 'Unknown';
  els.scoreStatus.textContent = status;
  els.scoreStatus.className = 'score-status ' + status.toLowerCase().replace(/\s+/g, '-');

  const total = analysis.totalViolations || 0;
  const passes = analysis.totalPasses || 0;
  els.scoreSummary.textContent = `${total} issue${total !== 1 ? 's' : ''} found · ${passes} checks passed`;

  // Scan time
  if (analysis._scanDuration) {
    els.scanTime.textContent = `Scanned in ${analysis._scanDuration}s`;
    els.scanTime.classList.remove('hidden');
  }

  els.scoreCard.classList.remove('hidden');

  // Auto-open breakdown for 5s so users see the scores immediately
  setTimeout(() => autoOpenScoreBreakdown(), 300);

  // Severity badges
  const counts = analysis.counts || {};
  els.badgeCritical.textContent = `${counts.critical || 0} Critical`;
  els.badgeSerious.textContent = `${counts.serious || 0} Serious`;
  els.badgeModerate.textContent = `${counts.moderate || 0} Moderate`;
  els.badgeMinor.textContent = `${counts.minor || 0} Minor`;
  els.badges.classList.remove('hidden');

  // Show tabs, quick actions, filter bar
  els.tabBar.classList.remove('hidden');
  els.quickActions.classList.remove('hidden');
  els.filterBar.classList.remove('hidden');
  switchTab('issues');

  // Issues list
  const issues = analysis.issues || [];
  els.issueCount.textContent = `(${issues.length})`;
  els.issuesList.innerHTML = '';

  if (issues.length === 0) {
    els.issuesList.innerHTML = `
      <li class="no-issues">
        <div class="no-issues-icon">${SVG.checkCircle}</div>
        <div class="no-issues-text">Perfect Score!</div>
        <div class="no-issues-sub">No accessibility issues found</div>
      </li>`;
    launchConfetti();
  } else {
    issues.forEach((issue, idx) => {
      els.issuesList.appendChild(createIssueCard(issue, idx));
    });
  }

  els.issuesContainer.classList.remove('hidden');
  highlightsActive = true;

  // Confetti for score >= 90
  if (score >= 90 && issues.length > 0) {
    launchConfetti();
  }
}

function getGrade(score) {
  if (score >= 90) return { label: 'Grade A', class: 'a' };
  if (score >= 70) return { label: 'Grade B', class: 'b' };
  if (score >= 50) return { label: 'Grade C', class: 'c' };
  return { label: 'Grade F', class: 'f' };
}

/* Auto-collapse timer handle — cancelled if user manually toggles */
let _breakdownAutoTimer = null;
/* Track whether user manually interacted with the panel */
let _breakdownUserTouched = false;

/**
 * Open the breakdown panel, start a 5-second auto-collapse unless the
 * user has already manually interacted with it this session.
 */
function autoOpenScoreBreakdown() {
  _breakdownUserTouched = false;
  clearTimeout(_breakdownAutoTimer);

  const panel = els.scoreBreakdown;
  panel.classList.remove('hidden');
  void panel.offsetHeight; // force reflow
  panel.classList.add('expanded');
  els.scoreCard.classList.add('breakdown-open');
  els.scoreInfoBtn.classList.add('active');

  _breakdownAutoTimer = setTimeout(() => {
    if (!_breakdownUserTouched) {
      panel.classList.remove('expanded');
      els.scoreCard.classList.remove('breakdown-open');
      els.scoreInfoBtn.classList.remove('active');
    }
  }, 5000);
}

function toggleScoreBreakdown() {
  // User manually toggled — cancel auto-collapse and lock open/closed
  _breakdownUserTouched = true;
  clearTimeout(_breakdownAutoTimer);

  const panel = els.scoreBreakdown;
  const isOpen = panel.classList.contains('expanded');
  if (isOpen) {
    panel.classList.remove('expanded');
    els.scoreCard.classList.remove('breakdown-open');
    els.scoreInfoBtn.classList.remove('active');
  } else {
    panel.classList.remove('hidden');
    void panel.offsetHeight;
    panel.classList.add('expanded');
    els.scoreCard.classList.add('breakdown-open');
    els.scoreInfoBtn.classList.add('active');
  }
}

function animateCounter(el, from, to, duration) {
  const start = performance.now();
  const diff = to - from;
  
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + diff * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ═══════ Issue card ═══════ */

function createIssueCard(issue, idx) {
  const li = document.createElement('li');
  li.className = 'issue-card';
  li.setAttribute('role', 'listitem');

  const severity = (issue.severity || 'moderate').toLowerCase();
  const wcagTags = (issue.wcag || []).slice(0, 2);
  const elemCount = issue.elementCount || issue.nodes?.length || 0;
  const isPageLevel = PAGE_LEVEL_RULES.has(issue.id);

  if (isPageLevel) li.classList.add('page-level-issue');

  const markerContent = isPageLevel
    ? `<div class="issue-marker page-level">${SVG.globe} PAGE</div>`
    : `<div class="issue-marker">#${idx + 1}</div>`;

  li.innerHTML = `
    <div class="issue-card-header" data-idx="${idx}">
      ${markerContent}
      <div class="issue-severity-dot ${severity}"></div>
      <div class="issue-info">
        <div class="issue-title">${escapeHtml(issue.title || issue.id)}</div>
        <div class="issue-meta">
          ${wcagTags.map(w => `<span class="issue-wcag">${escapeHtml(w)}</span>`).join('')}
          ${isPageLevel ? '<span class="page-level-tag">' + SVG.globe + ' Page-level</span>' : ''}
          ${elemCount > 0 ? `<span class="issue-count-badge">${elemCount} element${elemCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="issue-actions">
        <button class="issue-btn locate-btn" data-selector="${escapeAttr(issue.selectors?.[0] || '')}" data-issue-num="${idx + 1}" title="Locate on page">${SVG.locate}</button>
        <button class="issue-btn fix-btn" data-idx="${idx}" title="Get AI code suggestion">${SVG.suggest} Suggest</button>
      </div>
    </div>
    <div class="issue-detail">
      <p>${escapeHtml(issue.description || '')}</p>
      ${issue.html?.[0] ? `<div class="issue-html">${escapeHtml(issue.html[0])}</div>` : ''}
      ${issue.helpUrl ? `<a href="${escapeAttr(issue.helpUrl)}" target="_blank" class="issue-help-link">Learn more →</a>` : ''}
    </div>
  `;

  // Toggle expand + spotlight element on page
  const header = li.querySelector('.issue-card-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.issue-btn')) return;
    li.classList.toggle('expanded');

    // Clear all spotlit states first
    document.querySelectorAll('.issue-card.spotlit').forEach(c => c.classList.remove('spotlit'));

    // Spotlight the element on the page when expanding
    if (li.classList.contains('expanded')) {
      li.classList.add('spotlit');
      const selector = issue.selectors?.[0];
      if (selector) {
        sendMessage({ action: 'spotlight', tabId: currentTabId, selector });
      }
    }
  });

  // Locate button — scroll to element on page + flash card
  const locateBtn = li.querySelector('.locate-btn');
  locateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const selector = locateBtn.dataset.selector;
    if (selector) {
      sendMessage({ action: 'scroll-to', tabId: currentTabId, selector });
      // Flash the card to confirm
      li.classList.add('locating');
      setTimeout(() => li.classList.remove('locating'), 1500);
    } else {
      showToast('No selector — element may be dynamic');
    }
  });

  // Fix button
  const fixBtn = li.querySelector('.fix-btn');
  fixBtn.addEventListener('click', () => handleFix(issue, fixBtn));

  return li;
}

/* ═══════ Fix handler ═══════ */

async function handleFix(issue, btn) {
  // Check cache first — instant if pre-fetched
  const cached = suggestionCache.get(issue.id);
  if (cached) {
    showFixModal(cached, issue);
    btn.innerHTML = SVG.checkCircle + ' Ready';
    setTimeout(() => { btn.innerHTML = SVG.suggest + ' Suggest'; }, 1200);
    return;
  }

  // Not cached — show animated loading with status messages
  btn.classList.add('loading');
  const loadingMessages = ['Analyzing…', 'Asking AI…', 'Generating…', 'Almost…'];
  let msgIdx = 0;
  btn.textContent = loadingMessages[0];
  const msgInterval = setInterval(() => {
    msgIdx = Math.min(msgIdx + 1, loadingMessages.length - 1);
    btn.textContent = loadingMessages[msgIdx];
  }, 2500);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await sendMessage({
      action: 'fix',
      issue,
      pageUrl: tab?.url || '',
      tabId: currentTabId
    });

    if (!response?.ok || !response.fix) {
      throw new Error(response?.error || 'No suggestion generated');
    }

    // Cache for future clicks
    suggestionCache.set(issue.id, response.fix);
    showFixModal(response.fix, issue);
  } catch (err) {
    showError(`Suggestion failed: ${err.message}`);
  } finally {
    clearInterval(msgInterval);
    btn.classList.remove('loading');
    btn.innerHTML = suggestionCache.has(issue.id) ? SVG.checkCircle + ' Ready' : SVG.suggest + ' Suggest';
    if (suggestionCache.has(issue.id)) {
      setTimeout(() => { btn.innerHTML = SVG.suggest + ' Suggest'; }, 1200);
    }
  }
}

/* ═══════ Fix All ═══════ */

async function handleFixAll() {
  if (!currentAnalysis?.issues?.length) return;

  els.btnFixAll.classList.add('active');
  els.btnFixAll.textContent = '✨ Suggesting…';
  let fixCount = 0;
  const issues = currentAnalysis.issues.slice(0, 5);

  for (const issue of issues) {
    // Skip if already cached
    if (suggestionCache.has(issue.id)) {
      fixCount++;
      continue;
    }
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await sendMessage({
        action: 'fix',
        issue,
        pageUrl: tab?.url || '',
        tabId: currentTabId
      });
      if (response?.ok && response.fix) {
        suggestionCache.set(issue.id, response.fix);
        fixCount++;
      }
    } catch { /* continue */ }
    els.btnFixAll.textContent = `✨ ${fixCount}/${issues.length}`;
  }

  // Update all Suggest buttons to show cached state
  updateSuggestButtonStates();

  els.btnFixAll.classList.remove('active');
  els.btnFixAll.textContent = '✨ Suggest All';
  showToast(`Generated ${fixCount} suggestions — click any Suggest button to view`);
}

/**
 * Pre-fetch code suggestions for all issues right after scan.
 * Runs in background so user sees instant results when they click "Suggest".
 */
async function prefetchSuggestions() {
  if (!currentAnalysis?.issues?.length) return;
  if (prefetchInProgress) return;

  prefetchInProgress = true;
  const issues = currentAnalysis.issues;
  prefetchTotal = issues.length;
  prefetchDone = 0;

  // Show status banner
  updatePrefetchStatus('working');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab?.url || '';

  // Dedup issues by rule ID — same rule gets same suggestion
  // e.g. 10 images missing alt text all share one LLM call
  const uniqueRules = new Map(); // ruleId → first issue
  const ruleOrder = [];          // track order for progress
  for (const issue of issues) {
    if (suggestionCache.has(issue.id)) {
      prefetchDone++;
      continue;
    }
    if (!uniqueRules.has(issue.id)) {
      uniqueRules.set(issue.id, issue);
      ruleOrder.push(issue.id);
    }
  }

  updatePrefetchStatus('working');

  // Process unique rules in parallel batches of 4
  const BATCH_SIZE = 4;
  for (let i = 0; i < ruleOrder.length; i += BATCH_SIZE) {
    const batch = ruleOrder.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (ruleId) => {
      const issue = uniqueRules.get(ruleId);
      try {
        const response = await sendMessage({
          action: 'fix',
          issue,
          pageUrl,
          tabId: currentTabId
        });
        if (response?.ok && response.fix) {
          // Cache for ALL issues with this rule ID
          for (const iss of issues) {
            if (iss.id === ruleId) {
              suggestionCache.set(iss.id, response.fix);
            }
          }
        }
      } catch { /* silent */ }
      // Count all issues with this rule as done
      const count = issues.filter(iss => iss.id === ruleId).length;
      prefetchDone += count;
      updatePrefetchStatus('working');
    });

    await Promise.all(promises);
    updateSuggestButtonStates();
  }

  prefetchInProgress = false;
  updatePrefetchStatus('done');
}

/**
 * Update the prefetch status banner.
 * @param {'working'|'done'|'hide'} state
 */
function updatePrefetchStatus(state) {
  if (!els.prefetchStatus) return;

  if (state === 'hide') {
    els.prefetchStatus.classList.add('hidden');
    return;
  }

  els.prefetchStatus.classList.remove('hidden');

  if (state === 'working') {
    const pct = prefetchTotal > 0 ? Math.round((prefetchDone / prefetchTotal) * 100) : 0;
    els.prefetchIcon.innerHTML = '<span class="prefetch-spinner"></span>';
    els.prefetchText.textContent = prefetchDone === 0 ? 'Preparing AI suggestions…' : 'AI is generating code suggestions…';
    els.prefetchProgress.textContent = `${prefetchDone}/${prefetchTotal}`;
    els.prefetchBarFill.style.width = pct + '%';
    els.prefetchStatus.className = 'prefetch-status working';
  } else if (state === 'done') {
    const count = suggestionCache.size;
    els.prefetchIcon.innerHTML = SVG.checkCircle;
    els.prefetchText.textContent = count > 0
      ? `✅ All ${count} suggestion${count > 1 ? 's' : ''} ready — click Suggest to view`
      : 'No suggestions available';
    els.prefetchProgress.textContent = '';
    els.prefetchBarFill.style.width = '100%';
    els.prefetchStatus.className = 'prefetch-status done';

    // Auto-fade after 10 seconds
    setTimeout(() => {
      if (!prefetchInProgress) {
        els.prefetchStatus.classList.add('fade-out');
      }
    }, 10000);
  }
}

/**
 * Update all Suggest buttons to show ✅ if their suggestion is cached
 */
function updateSuggestButtonStates() {
  document.querySelectorAll('.fix-btn').forEach(btn => {
    const idx = parseInt(btn.dataset.idx, 10);
    const issue = currentAnalysis?.issues?.[idx];
    if (issue && suggestionCache.has(issue.id) && !btn.classList.contains('loading')) {
      btn.innerHTML = SVG.checkCircle + ' Ready';
      btn.classList.add('cached');
      setTimeout(() => {
        if (btn.classList.contains('cached')) {
          btn.innerHTML = SVG.suggest + ' Suggest';
        }
      }, 2000);
    }
  });
}

/* ═══════ Fix modal ═══════ */

function showFixModal(fix, issue) {
  els.fixTitle.textContent = fix.fixTitle || `Suggestion: ${issue.id}`;
  
  const sourceIcon = fix.private ? SVG.lock : SVG.cloud;
  const sourceClass = fix.private ? 'private' : 'cloud';
  const sourceLabel = fix.source || 'unknown';
  const confidence = fix.confidence ? `${Math.round(fix.confidence * 100)}%` : '—';
  
  els.fixBody.innerHTML = `
    <div class="fix-label">Current Code</div>
    <div class="fix-code before">${escapeHtml(fix.before || '(no code)')}</div>
    
    <div class="fix-label">Suggested Fix</div>
    <div class="fix-code after">${escapeHtml(fix.after || '(no suggestion)')}</div>
    
    <div class="fix-label">Explanation</div>
    <p class="fix-explanation">${escapeHtml(fix.explanation || '')}</p>
    
    <div class="fix-meta">
      <span class="fix-source">${sourceIcon} <span class="${sourceClass}">${sourceLabel}</span></span>
      <span>Effort: ${fix.effort || '—'}</span>
      <span>Confidence: ${confidence}</span>
    </div>
    
    <button class="fix-copy-btn" id="fix-copy">${SVG.copy} Copy Suggested Code</button>
  `;

  const copyBtn = $('#fix-copy');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fix.after || '');
      copyBtn.innerHTML = SVG.check + ' Copied!';
      showToast('Code copied to clipboard');
      setTimeout(() => { copyBtn.innerHTML = SVG.copy + ' Copy Suggested Code'; }, 2000);
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
  });

  els.fixModal.classList.remove('hidden');
}

function closeFixModal() {
  els.fixModal.classList.add('hidden');
}

/* ═══════ History ═══════ */

async function saveToHistory(analysis) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const entry = {
      url: tab?.url || 'Unknown',
      title: tab?.title || '',
      score: analysis.auditScore || 0,
      issues: analysis.totalViolations || 0,
      counts: analysis.counts || {},
      timestamp: Date.now(),
      duration: analysis._scanDuration
    };

    const result = await chrome.storage.local.get('scanHistory');
    const history = result.scanHistory || [];
    history.unshift(entry);
    // Keep last 50 entries
    await chrome.storage.local.set({ scanHistory: history.slice(0, 50) });
  } catch { /* ignore */ }
}

async function loadHistory() {
  try {
    const result = await chrome.storage.local.get('scanHistory');
    const history = result.scanHistory || [];

    if (history.length === 0) {
      els.historyEmpty.classList.remove('hidden');
      els.historyList.innerHTML = '';
      return;
    }

    els.historyEmpty.classList.add('hidden');
    els.historyList.innerHTML = '';

    history.slice(0, 20).forEach((entry, idx) => {
      const li = document.createElement('li');
      li.className = 'history-card';
      li.style.animationDelay = `${idx * 0.04}s`;

      const scoreClass = entry.score >= 90 ? 'good' : entry.score >= 70 ? 'ok' : 'bad';
      const ago = timeAgo(entry.timestamp);
      const shortUrl = new URL(entry.url).hostname || entry.url;

      // Trend arrow (compare with previous entry)
      let trend = '';
      if (idx < history.length - 1) {
        const prev = history[idx + 1];
        if (prev.url === entry.url) {
          trend = entry.score > prev.score ? '↑' : entry.score < prev.score ? '↓' : '→';
        }
      }

      li.innerHTML = `
        <div class="history-score ${scoreClass}">${entry.score}</div>
        <div class="history-info">
          <div class="history-url" title="${escapeAttr(entry.url)}">${escapeHtml(shortUrl)}</div>
          <div class="history-meta">
            <span>${entry.issues} issues</span>
            <span>${ago}</span>
            ${entry.duration ? `<span>${entry.duration}s</span>` : ''}
          </div>
        </div>
        ${trend ? `<span class="history-trend">${trend}</span>` : ''}
      `;

      els.historyList.appendChild(li);
    });
  } catch { /* ignore */ }
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ═══════ Export ═══════ */

function handleExport(format) {
  if (!currentAnalysis) {
    showToast('Run a scan first');
    return;
  }

  switch (format) {
    case 'json':
      downloadFile(
        JSON.stringify(currentAnalysis, null, 2),
        `a11y-report-${Date.now()}.json`,
        'application/json'
      );
      showToast('JSON report downloaded');
      break;

    case 'csv':
      downloadFile(
        generateCSV(currentAnalysis),
        `a11y-report-${Date.now()}.csv`,
        'text/csv'
      );
      showToast('CSV report downloaded');
      break;

    case 'pdf':
      generatePDFReport(currentAnalysis);
      break;

    case 'clipboard':
      copyReportToClipboard(currentAnalysis);
      break;
  }
}

function generateCSV(analysis) {
  const rows = [['Severity', 'Title', 'WCAG', 'Elements', 'Description']];
  (analysis.issues || []).forEach(issue => {
    rows.push([
      issue.severity || '',
      `"${(issue.title || issue.id || '').replace(/"/g, '""')}"`,
      (issue.wcag || []).join('; '),
      issue.elementCount || 0,
      `"${(issue.description || '').replace(/"/g, '""')}"`
    ]);
  });
  return rows.map(r => r.join(',')).join('\n');
}

/**
 * Generate a comprehensive professional PDF report.
 * Opens a new tab with a detailed HTML report styled for print,
 * then triggers the browser's print dialog (Save as PDF).
 */
function generatePDFReport(analysis) {
  const html = generateDetailedHTMLReport(analysis);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Open in new tab — the report auto-triggers print dialog
  chrome.tabs.create({ url }, () => {
    showToast('PDF report opened — use Print → Save as PDF');
  });
}

function generateDetailedHTMLReport(analysis) {
  const score = analysis.auditScore || 0;
  const grade = getGrade(score);
  const issues = analysis.issues || [];
  const counts = analysis.counts || {};
  const needsReview = analysis.needsReview || [];
  const scoreColor = score >= 90 ? '#2ecc71' : score >= 70 ? '#e67e22' : '#e74c3c';
  const scanDate = new Date().toLocaleString();
  const pageUrl = analysis.url || 'Unknown';
  const pageTitle = analysis.title || 'Unknown';

  // Group issues by severity
  const grouped = { critical: [], serious: [], moderate: [], minor: [] };
  issues.forEach(i => {
    const sev = (i.severity || 'moderate').toLowerCase();
    if (grouped[sev]) grouped[sev].push(i);
  });

  // WCAG criteria summary
  const allWcag = new Set();
  issues.forEach(i => (i.wcag || []).forEach(w => allWcag.add(w)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Accessibility Audit Report — ${escapeHtml(pageTitle)}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; background: #fff; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 32px; }

    /* Header */
    .report-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #e2e8f0; }
    .report-header h1 { font-size: 28px; font-weight: 800; color: #0f172a; }
    .report-header h1 span { color: ${scoreColor}; }
    .report-branding { font-size: 12px; color: #94a3b8; text-align: right; }
    .report-branding strong { color: #475569; font-size: 14px; display: block; }

    /* Meta info */
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 32px; }
    .meta-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .meta-item .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700; margin-bottom: 4px; }
    .meta-item .value { font-size: 14px; font-weight: 600; color: #1e293b; word-break: break-all; }

    /* Score section */
    .score-section { display: flex; gap: 24px; margin-bottom: 32px; }
    .score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${scoreColor}12; border: 4px solid ${scoreColor}; flex-shrink: 0; }
    .score-circle .num { font-size: 42px; font-weight: 800; color: ${scoreColor}; line-height: 1; }
    .score-circle .of { font-size: 12px; color: #94a3b8; }
    .score-details { flex: 1; }
    .score-details .grade-badge { display: inline-block; padding: 4px 16px; border-radius: 6px; font-size: 13px; font-weight: 700; background: ${scoreColor}18; color: ${scoreColor}; margin-bottom: 8px; }
    .score-details .compliance { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .score-details .summary-text { font-size: 13px; color: #64748b; }

    /* Stats bar */
    .stats-bar { display: flex; gap: 8px; margin-bottom: 32px; }
    .stat-box { flex: 1; text-align: center; padding: 14px 8px; border-radius: 10px; border: 1px solid #e2e8f0; }
    .stat-box .stat-num { font-size: 24px; font-weight: 800; }
    .stat-box .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; margin-top: 2px; }
    .stat-critical { background: #fef2f2; } .stat-critical .stat-num { color: #dc2626; }
    .stat-serious { background: #fff7ed; } .stat-serious .stat-num { color: #ea580c; }
    .stat-moderate { background: #fefce8; } .stat-moderate .stat-num { color: #ca8a04; }
    .stat-minor { background: #eff6ff; } .stat-minor .stat-num { color: #2563eb; }

    /* WCAG Summary */
    .wcag-summary { margin-bottom: 32px; padding: 16px 20px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; }
    .wcag-summary h3 { font-size: 14px; color: #0369a1; margin-bottom: 8px; }
    .wcag-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .wcag-tag { background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }

    /* Section headers */
    h2 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    h2 .count { font-weight: 400; color: #94a3b8; font-size: 16px; }

    /* Issue cards */
    .issue-card { border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 12px; overflow: hidden; }
    .issue-card-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fafbfc; border-bottom: 1px solid #f1f5f9; }
    .sev-badge { padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .sev-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .sev-serious { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
    .sev-moderate { background: #fefce8; color: #ca8a04; border: 1px solid #fef08a; }
    .sev-minor { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .issue-card-head h3 { font-size: 14px; font-weight: 600; color: #1e293b; flex: 1; }
    .issue-card-body { padding: 14px 16px; }
    .issue-card-body p { font-size: 13px; color: #475569; margin-bottom: 8px; }
    .issue-card-body .wcag-refs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 8px; }
    .issue-card-body .wcag-ref { background: #f3e8ff; color: #7c3aed; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; }
    .issue-card-body .elements { font-size: 11px; color: #94a3b8; margin-bottom: 8px; }
    .code-block { background: #1e293b; color: #e2e8f0; padding: 10px 14px; border-radius: 6px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 8px 0; }
    .help-link { color: #2563eb; font-size: 12px; text-decoration: none; }
    .help-link:hover { text-decoration: underline; }

    /* Footer */
    .report-footer { margin-top: 48px; padding-top: 20px; border-top: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
    .report-footer .left { font-size: 12px; color: #94a3b8; }
    .report-footer .right { font-size: 12px; color: #94a3b8; text-align: right; }
    .report-footer .right strong { color: #475569; }

    /* Print button */
    .print-bar { position: fixed; top: 0; left: 0; right: 0; background: #1e293b; color: #fff; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 100; box-shadow: 0 2px 12px rgba(0,0,0,0.2); }
    .print-bar button { background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .print-bar button:hover { background: #1d4ed8; }
    .print-bar span { font-size: 13px; opacity: 0.7; }
    .spacer { height: 56px; }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <span>📄 Ready to save as PDF</span>
    <button onclick="window.print()">⬇ Save as PDF</button>
  </div>
  <div class="spacer no-print"></div>

  <div class="container">
    <!-- Header -->
    <div class="report-header">
      <h1>♿ Accessibility <span>Audit Report</span></h1>
      <div class="report-branding">
        <strong>Accea Agent</strong>
        Privacy-First Scanner
      </div>
    </div>

    <!-- Meta info -->
    <div class="meta-grid">
      <div class="meta-item"><div class="label">Page URL</div><div class="value">${escapeHtml(pageUrl)}</div></div>
      <div class="meta-item"><div class="label">Page Title</div><div class="value">${escapeHtml(pageTitle)}</div></div>
      <div class="meta-item"><div class="label">Scan Date</div><div class="value">${scanDate}</div></div>
      <div class="meta-item"><div class="label">Engine</div><div class="value">axe-core ${escapeHtml(analysis.metadata?.axeVersion || 'unknown')}</div></div>
    </div>

    <!-- Score -->
    <div class="score-section">
      <div class="score-circle">
        <div class="num">${score}</div>
        <div class="of">/100</div>
      </div>
      <div class="score-details">
        <div class="grade-badge">${grade.label}</div>
        <div class="compliance">${analysis.complianceStatus || 'Unknown'}</div>
        <div class="summary-text">
          ${analysis.totalViolations || 0} violations found across the page.<br>
          ${analysis.totalPasses || 0} accessibility checks passed successfully.
          ${analysis._scanDuration ? `<br>Scan completed in ${analysis._scanDuration}s.` : ''}
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-bar">
      <div class="stat-box stat-critical"><div class="stat-num">${counts.critical || 0}</div><div class="stat-label">Critical</div></div>
      <div class="stat-box stat-serious"><div class="stat-num">${counts.serious || 0}</div><div class="stat-label">Serious</div></div>
      <div class="stat-box stat-moderate"><div class="stat-num">${counts.moderate || 0}</div><div class="stat-label">Moderate</div></div>
      <div class="stat-box stat-minor"><div class="stat-num">${counts.minor || 0}</div><div class="stat-label">Minor</div></div>
    </div>

    <!-- WCAG criteria -->
    ${allWcag.size > 0 ? `
    <div class="wcag-summary">
      <h3>📋 WCAG Criteria Affected</h3>
      <div class="wcag-tags">${[...allWcag].sort().map(w => `<span class="wcag-tag">${w}</span>`).join('')}</div>
    </div>` : ''}

    <!-- Issues by severity -->
    ${['critical', 'serious', 'moderate', 'minor'].map(sev => {
      if (!grouped[sev].length) return '';
      return `
    <h2>${sev.charAt(0).toUpperCase() + sev.slice(1)} Issues <span class="count">(${grouped[sev].length})</span></h2>
    ${grouped[sev].map((issue, idx) => `
    <div class="issue-card">
      <div class="issue-card-head">
        <span class="sev-badge sev-${sev}">${sev}</span>
        <h3>${escapeHtml(issue.title || issue.id)}</h3>
      </div>
      <div class="issue-card-body">
        <p>${escapeHtml(issue.description || '')}</p>
        ${(issue.wcag || []).length ? `<div class="wcag-refs">${issue.wcag.map(w => `<span class="wcag-ref">${w}</span>`).join('')}</div>` : ''}
        ${issue.elementCount ? `<div class="elements">Affects ${issue.elementCount} element${issue.elementCount !== 1 ? 's' : ''} on the page</div>` : ''}
        ${(issue.html || []).slice(0, 3).map(h => `<div class="code-block">${escapeHtml(h)}</div>`).join('')}
        ${issue.helpUrl ? `<a href="${escapeHtml(issue.helpUrl)}" class="help-link" target="_blank">📖 Learn more about this issue →</a>` : ''}
      </div>
    </div>`).join('')}`;
    }).join('')}

    ${needsReview.length > 0 ? `
    <h2 class="page-break">Needs Review <span class="count">(${needsReview.length})</span></h2>
    ${needsReview.map(issue => `
    <div class="issue-card">
      <div class="issue-card-head">
        <span class="sev-badge sev-moderate">Review</span>
        <h3>${escapeHtml(issue.title || issue.id)}</h3>
      </div>
      <div class="issue-card-body">
        <p>${escapeHtml(issue.description || '')}</p>
      </div>
    </div>`).join('')}` : ''}

    <!-- Checklist Results -->
    ${generateChecklistReportSection(issues)}

    <!-- Lighthouse Scores -->
    ${generateLighthouseReportSection()}

    <!-- Footer -->
    <div class="report-footer">
      <div class="left">
        This report was generated locally. No data was sent to external servers.<br>
        Powered by axe-core accessibility testing engine.
      </div>
      <div class="right">
        <strong>Accea Agent</strong><br>
        ${scanDate}
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print dialog after load
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 500);
    });
  </script>
</body>
</html>`;
}

/**
 * Generate checklist section for the PDF report
 */
function generateChecklistReportSection(issues) {
  const issueIds = new Set(issues.map(i => i.id));

  const items = CHECKLIST_ITEMS.map(item => {
    let status = 'pass';
    let detail = '';

    if (item.special === 'mobile') {
      const vpIssue = issues.find(i => i.id === 'meta-viewport');
      status = vpIssue ? 'fail' : 'pass';
      detail = vpIssue ? 'Viewport blocks zoom or scaling' : 'Viewport allows user zoom';
    } else if (item.special === 'lighthouse') {
      if (lighthouseData && !lighthouseData.error) {
        const perfScore = lighthouseData.performance;
        status = perfScore >= 50 ? 'pass' : 'fail';
        detail = `Perf: ${lighthouseData.performance} · A11y: ${lighthouseData.accessibility} · SEO: ${lighthouseData.seo}`;
      } else {
        status = 'warn';
        detail = lighthouseData?.error || 'Not available';
      }
    } else {
      const failing = item.axePass.filter(ruleId => issueIds.has(ruleId));
      if (failing.length > 0) {
        status = 'fail';
        const failIssues = issues.filter(i => failing.includes(i.id));
        const totalElements = failIssues.reduce((s, i) => s + (i.elementCount || 0), 0);
        detail = `${failing.length} rule${failing.length > 1 ? 's' : ''} failing` + (totalElements > 0 ? ` · ${totalElements} element${totalElements > 1 ? 's' : ''}` : '');
      } else {
        status = 'pass';
        detail = 'All checks passed';
      }
    }

    return { ...item, status, detail };
  });

  const passCount = items.filter(i => i.status === 'pass').length;
  const failCount = items.filter(i => i.status === 'fail').length;
  const warnCount = items.filter(i => i.status === 'warn').length;
  const statusIcon = { pass: '✅', fail: '❌', warn: '⚠️', loading: '⏳' };
  const statusColor = { pass: '#16a34a', fail: '#dc2626', warn: '#ca8a04', loading: '#94a3b8' };

  // Group items by status for the PDF table
  const failItems = items.filter(i => i.status === 'fail');
  const warnItems = items.filter(i => i.status === 'warn');
  const passItems = items.filter(i => i.status === 'pass');

  function renderPDFChecklistRow(item) {
    const rules = (item.axePass || []).map(r => {
      const isFailing = issueIds.has(r);
      return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600;margin:1px;background:${isFailing ? '#fef2f2' : '#f0fdf4'};color:${isFailing ? '#dc2626' : '#16a34a'};">${escapeHtml(r)}</span>`;
    }).join('');

    return `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:8px 12px;text-align:center;font-size:16px;">${statusIcon[item.status] || '—'}</td>
        <td style="padding:8px 12px;">
          <div style="font-weight:600;color:#1e293b;">${escapeHtml(item.label)}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escapeHtml(item.desc)}</div>
        </td>
        <td style="padding:8px 12px;color:${statusColor[item.status]};font-size:11px;font-weight:500;">${escapeHtml(item.detail)}</td>
        <td style="padding:8px 12px;">${rules || '<span style="color:#94a3b8;font-size:10px;">—</span>'}</td>
      </tr>`;
  }

  function renderPDFSectionHeader(label, count, color, bgColor) {
    return `
      <tr><td colspan="4" style="padding:10px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${color};background:${bgColor};border-bottom:2px solid ${color}20;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>
        ${label} <span style="font-weight:400;color:#94a3b8;margin-left:4px;">(${count})</span>
      </td></tr>`;
  }

  return `
    <h2 class="page-break">✅ WCAG Compliance Checklist <span class="count">(${passCount}/${items.length} passed)</span></h2>
    <div style="display:grid;grid-template-columns:1fr 1fr ${warnCount > 0 ? '1fr' : ''};gap:4px;margin-bottom:16px;">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#dc2626;">${failCount}</div>
        <div style="font-size:10px;color:#f87171;font-weight:600;text-transform:uppercase;">Failing</div>
      </div>
      ${warnCount > 0 ? `<div style="background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:10px 14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#ca8a04;">${warnCount}</div>
        <div style="font-size:10px;color:#eab308;font-weight:600;text-transform:uppercase;">Warnings</div>
      </div>` : ''}
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#16a34a;">${passCount}</div>
        <div style="font-size:10px;color:#4ade80;font-weight:600;text-transform:uppercase;">Passing</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px;">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;width:50px;">Status</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;">Check</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;">Details</th>
          <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;">Rules</th>
        </tr>
      </thead>
      <tbody>
        ${failItems.length ? renderPDFSectionHeader('Needs Attention', failItems.length, '#dc2626', '#fef2f2') + failItems.map(renderPDFChecklistRow).join('') : ''}
        ${warnItems.length ? renderPDFSectionHeader('Warnings', warnItems.length, '#ca8a04', '#fefce8') + warnItems.map(renderPDFChecklistRow).join('') : ''}
        ${passItems.length ? renderPDFSectionHeader('Passed', passItems.length, '#16a34a', '#f0fdf4') + passItems.map(renderPDFChecklistRow).join('') : ''}
      </tbody>
    </table>`;
}

/**
 * Generate Lighthouse scores section for the PDF report
 */
function generateLighthouseReportSection() {
  if (!lighthouseData || lighthouseData.error) {
    return `
    <h2>📊 Lighthouse Scores</h2>
    <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#94a3b8;font-size:13px;text-align:center;">
      ${lighthouseData?.error ? escapeHtml(lighthouseData.error) : 'Lighthouse scores were not available for this scan.'}
    </div>`;
  }

  const categories = [
    { key: 'performance', label: 'Performance', icon: '⚡' },
    { key: 'accessibility', label: 'Accessibility', icon: '♿' },
    { key: 'bestPractices', label: 'Best Practices', icon: '✅' },
    { key: 'seo', label: 'SEO', icon: '🔍' }
  ];

  return `
    <h2>📊 Lighthouse Scores (via PageSpeed Insights)</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:24px;">
      ${categories.map(cat => {
        const val = lighthouseData[cat.key] ?? '—';
        const numVal = typeof val === 'number' ? val : 0;
        const color = numVal >= 90 ? '#16a34a' : numVal >= 50 ? '#ca8a04' : '#dc2626';
        const bg = numVal >= 90 ? '#f0fdf4' : numVal >= 50 ? '#fefce8' : '#fef2f2';
        const borderColor = numVal >= 90 ? '#bbf7d0' : numVal >= 50 ? '#fef08a' : '#fecaca';
        return `
      <div style="text-align:center;padding:16px 8px;background:${bg};border:1px solid ${borderColor};border-radius:10px;">
        <div style="font-size:18px;margin-bottom:6px;">${cat.icon}</div>
        <div style="font-size:28px;font-weight:800;color:${color};">${val}</div>
        <div style="font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;margin-top:4px;">${cat.label}</div>
      </div>`;
      }).join('')}
    </div>`;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyReportToClipboard(analysis) {
  const score = analysis.auditScore || 0;
  const issues = analysis.issues || [];
  const grade = getGrade(score);
  
  let text = `♿ Accessibility Report\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Score: ${score}/100 (${grade.label})\n`;
  text += `Issues: ${analysis.totalViolations || 0} | Passed: ${analysis.totalPasses || 0}\n\n`;
  
  issues.forEach((issue, i) => {
    text += `${i+1}. [${(issue.severity || '').toUpperCase()}] ${issue.title || issue.id}\n`;
    if (issue.wcag?.length) text += `   WCAG: ${issue.wcag.join(', ')}\n`;
    text += '\n';
  });

  text += `\n— Generated by Accea Agent`;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Report copied to clipboard');
  } catch {
    showToast('Failed to copy');
  }
}

/* ═══════ Confetti 🎊 ═══════ */

/* ═══════ Tips Engine — Lighthouse, SEO & Improvements ═══════ */

/**
 * Maps accessibility issue IDs to their cross-domain impact.
 * Each entry: { seo, lighthouse, quickWin, effort, fix, lhCategory }
 */
const ISSUE_IMPACT_MAP = {
  'html-has-lang': {
    seo: true, seoImpact: 'high',
    seoReason: 'Search engines use lang to index for the correct language/region',
    lighthouse: true, lhBoost: 5, lhCategory: ['Accessibility', 'SEO'],
    quickWin: true, effort: 'S', timeMin: 1,
    fix: 'Add lang="en" (or your language) to the <html> element',
    improveTip: 'Fixing this improves Lighthouse A11y + SEO scores simultaneously'
  },
  'document-title': {
    seo: true, seoImpact: 'high',
    seoReason: 'Page <title> is the #1 on-page SEO ranking factor — appears in search results',
    lighthouse: true, lhBoost: 8, lhCategory: ['Accessibility', 'SEO'],
    quickWin: true, effort: 'S', timeMin: 2,
    fix: 'Add a unique, descriptive <title> tag (50-60 chars)',
    improveTip: 'This single fix can boost both your Lighthouse A11y and SEO by 5-8 points each'
  },
  'image-alt': {
    seo: true, seoImpact: 'high',
    seoReason: 'Google Images uses alt text for indexing — missing alt = missed search traffic',
    lighthouse: true, lhBoost: 10, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 5,
    fix: 'Add descriptive alt="" to all <img> tags (use alt="" only for decorative)',
    improveTip: 'Each image with alt text becomes searchable in Google Images'
  },
  'meta-viewport': {
    seo: true, seoImpact: 'high',
    seoReason: 'Mobile-friendliness is a Google ranking signal — blocked zoom fails mobile audit',
    lighthouse: true, lhBoost: 5, lhCategory: ['Accessibility', 'SEO'],
    quickWin: true, effort: 'S', timeMin: 1,
    fix: 'Remove maximum-scale=1 and user-scalable=no from viewport meta',
    improveTip: 'Fixes both mobile-friendly test and accessibility zoom requirement'
  },
  'link-name': {
    seo: true, seoImpact: 'medium',
    seoReason: 'Anchor text is a ranking signal — descriptive links help Google understand target pages',
    lighthouse: true, lhBoost: 4, lhCategory: ['Accessibility'],
    quickWin: false, effort: 'S', timeMin: 5,
    fix: 'Add descriptive text or aria-label to all links',
    improveTip: 'Better link text = better SEO anchor signals + screen reader navigation'
  },
  'heading-order': {
    seo: true, seoImpact: 'medium',
    seoReason: 'Search engines use heading hierarchy to understand content structure',
    lighthouse: true, lhBoost: 3, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 10,
    fix: 'Use h1→h2→h3 sequentially — only one h1 per page',
    improveTip: 'Proper heading structure helps both crawlers and screen reader navigation'
  },
  'color-contrast': {
    seo: false, seoImpact: 'low',
    seoReason: 'Indirect — better contrast reduces bounce rate, improving engagement signals',
    lighthouse: true, lhBoost: 6, lhCategory: ['Accessibility'],
    quickWin: false, effort: 'M', timeMin: 15,
    fix: 'Increase contrast ratio to ≥4.5:1 for normal text, ≥3:1 for large text',
    improveTip: 'Most impactful visual fix — affects every user with low vision'
  },
  'label': {
    seo: false, seoImpact: 'low',
    seoReason: 'Minimal direct SEO impact but improves form usability',
    lighthouse: true, lhBoost: 5, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 5,
    fix: 'Add <label for="id"> to every form input',
    improveTip: 'Critical for screen readers — also improves click targets for all users'
  },
  'button-name': {
    seo: false, seoImpact: 'low',
    seoReason: 'No direct SEO impact',
    lighthouse: true, lhBoost: 4, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 3,
    fix: 'Add text, aria-label, or aria-labelledby to buttons',
    improveTip: 'Screen readers announce "button" with no name — completely unusable'
  },
  'bypass': {
    seo: false, seoImpact: 'low',
    seoReason: 'No direct SEO impact but improves UX metrics',
    lighthouse: true, lhBoost: 3, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'M', timeMin: 10,
    fix: 'Add a "Skip to main content" link at the top of the page',
    improveTip: 'Keyboard users must tab through all nav links without this'
  },
  'empty-heading': {
    seo: true, seoImpact: 'medium',
    seoReason: 'Empty headings confuse crawlers — they expect meaningful hierarchy',
    lighthouse: true, lhBoost: 2, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 3,
    fix: 'Add text content to empty heading tags or remove them',
    improveTip: 'Empty headings hurt both SEO structure signals and screen reader navigation'
  },
  'landmark-one-main': {
    seo: false, seoImpact: 'low',
    seoReason: 'Semantic HTML helps crawlers understand page structure',
    lighthouse: true, lhBoost: 2, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 2,
    fix: 'Wrap main content in a <main> element',
    improveTip: 'Adding <main> helps screen readers and gives semantic meaning to content'
  },
  'region': {
    seo: false, seoImpact: 'low',
    seoReason: 'Semantic landmarks help crawlers',
    lighthouse: true, lhBoost: 2, lhCategory: ['Accessibility'],
    quickWin: false, effort: 'M', timeMin: 15,
    fix: 'Wrap page sections in landmark elements (<header>, <nav>, <main>, <footer>)',
    improveTip: 'Landmark regions = semantic HTML = better for bots and assistive tech'
  },
  'duplicate-id': {
    seo: false, seoImpact: 'low',
    seoReason: 'Duplicate IDs can break ARIA and label associations',
    lighthouse: true, lhBoost: 2, lhCategory: ['Accessibility', 'Best Practices'],
    quickWin: true, effort: 'S', timeMin: 5,
    fix: 'Ensure all element IDs are unique within the page',
    improveTip: 'Duplicate IDs break label-input associations and ARIA references'
  },
  'focus-visible': {
    seo: false, seoImpact: 'low',
    seoReason: 'No SEO impact',
    lighthouse: true, lhBoost: 3, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 5,
    fix: 'Add :focus-visible styles — never remove outlines without replacements',
    improveTip: 'Keyboard users cannot navigate without visible focus indicators'
  },
  'aria-allowed-attr': {
    seo: false, seoImpact: 'low',
    seoReason: 'No SEO impact',
    lighthouse: true, lhBoost: 3, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 5,
    fix: 'Remove or fix invalid ARIA attributes',
    improveTip: 'Invalid ARIA is worse than no ARIA — it actively confuses assistive tech'
  },
  'aria-valid-attr': {
    seo: false, seoImpact: 'low', seoReason: 'No SEO impact',
    lighthouse: true, lhBoost: 2, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 3,
    fix: 'Fix misspelled or invalid ARIA attribute names',
    improveTip: 'Invalid ARIA attributes are silently ignored — elements become unlabeled'
  },
  'svg-img-alt': {
    seo: true, seoImpact: 'medium',
    seoReason: 'SVG alt text provides additional indexable content',
    lighthouse: true, lhBoost: 3, lhCategory: ['Accessibility'],
    quickWin: true, effort: 'S', timeMin: 3,
    fix: 'Add role="img" and aria-label to SVGs, or <title> inside SVG',
    improveTip: 'SVGs with role=img need labels just like <img> needs alt'
  }
};

/** General SEO tips that always apply */
const GENERAL_SEO_TIPS = [
  { icon: '●', title: 'Add meta description', desc: 'Add <meta name="description"> (150-160 chars) — appears in Google search snippets', tags: ['seo'], impact: 'high' },
  { icon: '●', title: 'Add canonical URL', desc: 'Add <link rel="canonical"> to prevent duplicate content issues', tags: ['seo'], impact: 'medium' },
  { icon: '●', title: 'Open Graph tags', desc: 'Add og:title, og:description, og:image for rich social media previews', tags: ['seo'], impact: 'medium' },
  { icon: '●', title: 'Structured data (JSON-LD)', desc: 'Add Schema.org structured data for rich search results (stars, FAQs, etc.)', tags: ['seo'], impact: 'high' },
  { icon: '●', title: 'Core Web Vitals', desc: 'LCP < 2.5s, INP < 200ms, CLS < 0.1 — these are Google ranking signals', tags: ['lighthouse', 'seo'], impact: 'high' },
  { icon: '●', title: 'Mobile responsiveness', desc: 'Use responsive meta viewport, fluid layouts, and media queries — mobile-first indexing is default', tags: ['lighthouse', 'seo'], impact: 'high' },
  { icon: '●', title: 'Lazy load images & iframes', desc: 'Add loading="lazy" to offscreen images/iframes — reduces initial load time and LCP', tags: ['lighthouse'], impact: 'high' },
  { icon: '●', title: 'Responsive images', desc: 'Use srcset + sizes for art-directed images — serve right size for each screen width', tags: ['lighthouse'], impact: 'medium' },
];

function renderTips() {
  if (!currentAnalysis || !currentAnalysis.issues) {
    els.tipsEmpty.classList.remove('hidden');
    els.lighthouseSection.classList.add('hidden');
    els.quickWins.classList.add('hidden');
    els.seoCrossover.classList.add('hidden');
    els.improvementInsights.classList.add('hidden');
    return;
  }

  els.tipsEmpty.classList.add('hidden');

  const issues = currentAnalysis.issues || [];
  const score = currentAnalysis.auditScore || 0;
  const issueIds = issues.map(i => i.id);

  // ── 1. Lighthouse Scores (real or loading) ──
  renderLighthouseSection();

  // ── 2. Quick Wins ──
  renderQuickWins(issues);

  // ── 3. SEO Crossover ──
  renderSEOCrossover(issues);

  // ── 4. Improvement Insights ──
  renderImprovementInsights(issues, score);
}

/* ═══════ Real Lighthouse Scores ═══════ */

/**
 * Kick off Lighthouse fetching via the service worker (survives popup close/reopen).
 * If the service worker already has fresh cached data it returns it instantly.
 * Otherwise the SW fetches in background and pushes `lighthouse-ready` back to us.
 */
async function fetchLighthouseScores() {
  lighthouseLoading = true;
  lighthouseData = null;

  // Show skeleton loaders immediately
  renderLighthouseSection();
  renderChecklistLighthouse();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const pageUrl = tab?.url;

    if (!pageUrl || pageUrl.startsWith('chrome://') || pageUrl.startsWith('chrome-extension://') ||
        pageUrl.startsWith('about:') || pageUrl.startsWith('file:')) {
      lighthouseLoading = false;
      lighthouseData = { error: 'Cannot analyze internal pages' };
      renderLighthouseSection();
      renderChecklistLighthouse();
      return;
    }

    // Ask service worker — responds immediately with cache hit OR 'fetching'
    // (SW never blocks on the network; it pushes `lighthouse-ready` when done)
    const result = await sendMessage({ action: 'fetch-lighthouse', url: pageUrl });

    if (result?.status === 'ready' && result.data) {
      // Cache hit — instant result
      lighthouseLoading = false;
      lighthouseData = result.data;
      els.lhLoadingHint?.classList.add('hidden');
      renderLighthouseSection();
      renderChecklistLighthouse();
      upgradeScoreCardWithLighthouse();
      return; // done
    }

    if (result?.status === 'error') {
      lighthouseLoading = false;
      lighthouseData = { error: result.error };
      els.lhLoadingHint?.classList.add('hidden');
      renderLighthouseSection();
      renderChecklistLighthouse();
      return;
    }

    // status === 'fetching' — SW is working, we wait for the `lighthouse-ready` push.
    // As a belt-and-suspenders fallback, poll the cache every 3s (handles the case
    // where the push message is dropped because the popup was briefly closed).
    let pollCount = 0;
    const pollTimer = setInterval(async () => {
      pollCount++;
      if (!lighthouseLoading) { clearInterval(pollTimer); return; } // push already arrived
      const polled = await sendMessage({ action: 'get-lighthouse', url: pageUrl });
      if (polled?.status === 'ready' && polled.data) {
        clearInterval(pollTimer);
        lighthouseLoading = false;
        lighthouseData = polled.data;
        els.lhLoadingHint?.classList.add('hidden');
        renderLighthouseSection();
        renderChecklistLighthouse();
        upgradeScoreCardWithLighthouse();
      } else if (pollCount >= 40) { // 40 × 3s = 2 min max wait
        clearInterval(pollTimer);
        lighthouseLoading = false;
        lighthouseData = { error: 'Timed out waiting for Lighthouse' };
        els.lhLoadingHint?.classList.add('hidden');
        renderLighthouseSection();
        renderChecklistLighthouse();
      }
    }, 3000);

    // Show "still loading" hint after 30s
    setTimeout(() => {
      if (lighthouseLoading && els.lhLoadingHint) {
        els.lhLoadingHint.innerHTML = '<span class="lh-pulse"></span> Still fetching Lighthouse — large pages take longer…';
      }
    }, 30000);
  } catch (e) {
    console.warn('fetchLighthouseScores error:', e.message);
    lighthouseLoading = false;
    lighthouseData = { error: e.message };
    els.lhLoadingHint?.classList.add('hidden');
    renderLighthouseSection();
    renderChecklistLighthouse();
  }
}

/**
 * Render Lighthouse section — skeleton while loading, real data when available
 */
function renderLighthouseSection() {
  els.lighthouseSection.classList.remove('hidden');

  if (lighthouseLoading) {
    // Skeleton loaders
    els.lhStatus.textContent = 'Loading…';
    els.lhStatus.className = 'status-pill loading';
    els.lighthouseScores.innerHTML = buildLighthouseSkeletons();
    return;
  }

  if (!lighthouseData || lighthouseData.error) {
    const errMsg = lighthouseData?.error || 'Could not fetch Lighthouse data';
    const isRateLimit = errMsg.toLowerCase().includes('rate limit') || errMsg.includes('429');
    els.lhStatus.textContent = isRateLimit ? 'Rate Limited' : 'Error';
    els.lhStatus.className = 'status-pill error';
    els.lighthouseScores.innerHTML = `<div class="lh-error">${escapeHtml(errMsg)}</div>`;
    return;
  }

  els.lhStatus.textContent = 'Live';
  els.lhStatus.className = 'status-pill live';

  const scores = [
    { label: 'Performance', score: lighthouseData.performance },
    { label: 'Accessibility', score: lighthouseData.accessibility },
    { label: 'Best Practices', score: lighthouseData.bestPractices },
    { label: 'SEO', score: lighthouseData.seo },
  ];

  els.lighthouseScores.innerHTML = scores.map((s, i) => {
    const colorClass = s.score >= 90 ? 'green' : s.score >= 50 ? 'orange' : 'red';
    return `
      <div class="lh-score-card" style="animation-delay:${i * 0.08}s">
        <div class="lh-score-ring ${colorClass}">
          <svg viewBox="0 0 36 36" class="lh-ring-svg">
            <path class="lh-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            <path class="lh-ring-fg ${colorClass}" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" data-score="${s.score}"/>
          </svg>
          <span class="lh-ring-number">${s.score}</span>
        </div>
        <div class="lh-score-label">${s.label}</div>
      </div>
    `;
  }).join('');

  // Animate rings after render
  setTimeout(() => {
    els.lighthouseScores.querySelectorAll('.lh-ring-fg').forEach(ring => {
      const score = ring.dataset.score;
      ring.setAttribute('stroke-dasharray', `${score}, 100`);
    });
  }, 50);
}

function buildLighthouseSkeletons() {
  return ['Performance', 'Accessibility', 'Best Practices', 'SEO'].map((label, i) => `
    <div class="lh-score-card skeleton" style="animation-delay:${i * 0.1}s">
      <div class="lh-score-ring skeleton-ring">
        <div class="lh-skeleton-circle"></div>
      </div>
      <div class="lh-score-label">${label}</div>
    </div>
  `).join('');
}

/**
 * Upgrade the main score card with real Lighthouse accessibility score.
 * Called after fetchLighthouseScores() completes successfully.
 * Falls back gracefully — if Lighthouse failed, the axe-core score stays.
 */
function upgradeScoreCardWithLighthouse() {
  if (!lighthouseData || lighthouseData.error) return;

  const lhScore = lighthouseData.accessibility;
  if (typeof lhScore !== 'number' || lhScore < 0) return;

  // Only upgrade if the score card is visible (a scan has been run)
  if (els.scoreCard.classList.contains('hidden')) return;

  const currentScore = parseInt(els.scoreNumber.textContent, 10) || 0;

  // Animate from current axe-core score to Lighthouse score
  animateCounter(els.scoreNumber, currentScore, lhScore, 600);

  // Update ring
  setTimeout(() => {
    els.scoreArc.setAttribute('stroke-dasharray', `${lhScore}, 100`);
  }, 50);

  // Update ring color
  if (lhScore >= 90) els.scoreArc.style.stroke = 'var(--green)';
  else if (lhScore >= 50) els.scoreArc.style.stroke = 'var(--orange)';
  else els.scoreArc.style.stroke = 'var(--red)';

  // Update grade
  const grade = getGrade(lhScore);
  els.scoreGrade.textContent = grade.label;
  els.scoreGrade.className = `score-grade ${grade.class}`;

  // Update compliance status based on Lighthouse score
  const counts = currentAnalysis?.counts || {};
  const hasCriticals = (counts.critical || 0) > 0;
  let status;
  if (lhScore >= 90 && !hasCriticals) status = 'Compliant';
  else if (lhScore >= 70) status = 'At Risk';
  else status = 'Not Compliant';
  els.scoreStatus.textContent = status;
  els.scoreStatus.className = 'score-status ' + status.toLowerCase().replace(/\s+/g, '-');

  // Update source badge to Lighthouse
  els.scoreSource.textContent = '✦ Lighthouse';
  els.scoreSource.className = 'score-source lighthouse';
  els.scoreSource.title = 'Google Lighthouse accessibility score via PageSpeed Insights API';

  // Update attribution line — loading done
  els.lhLoadingHint.classList.add('hidden');

  // Refresh breakdown panel with Lighthouse data
  const axeScore = currentAnalysis?.auditScore || 0;
  renderScoreBreakdown(axeScore, lighthouseData);

  // If panel is already open keep it; if user hasn't touched it, re-open briefly
  if (!_breakdownUserTouched) {
    autoOpenScoreBreakdown();
  }

  // Brief flash animation to draw attention to the upgrade
  els.scoreCard.classList.add('score-upgraded');
  setTimeout(() => els.scoreCard.classList.remove('score-upgraded'), 1200);
}

/**
 * Render the expandable score breakdown panel.
 * Shows Accea (axe-core) weighted score + Lighthouse benchmark scores.
 */
function renderScoreBreakdown(axeScore, lhData) {
  const rows = [];

  // 1. Accea Score (axe-core weighted)
  rows.push(buildBreakdownRow(
    'Accea Score', axeScore,
    'axe-core', 'Severity-weighted: each rule scored out of 10. Critical costs 10pts, Serious 5, Moderate 2, Minor 1.'
  ));

  // 2. Lighthouse scores
  if (lhData && !lhData.error) {
    rows.push(buildBreakdownRow('Lighthouse A11y', lhData.accessibility, 'Google PageSpeed', 'Real Lighthouse accessibility audit via PageSpeed Insights API (mobile).' ));
    rows.push(buildBreakdownRow('Performance',     lhData.performance,   'Lighthouse',       'Load speed, interactivity &amp; visual stability (Core Web Vitals).'));
    rows.push(buildBreakdownRow('Best Practices',  lhData.bestPractices, 'Lighthouse',       'HTTPS, no console errors, correct image ratios, modern APIs.'));
    rows.push(buildBreakdownRow('SEO',             lhData.seo,           'Lighthouse',       'Meta tags, crawlable links, font sizes, tap target sizing.'));
  } else if (lhData?.error) {
    rows.push(`<div class="breakdown-row loading-row"><span class="breakdown-label">Lighthouse</span><span class="breakdown-loading breakdown-error">Unavailable — ${escapeHtml(lhData.error)}</span></div>`);
  } else {
    rows.push(`<div class="breakdown-row loading-row"><span class="breakdown-label">Lighthouse</span><span class="breakdown-loading"><span class="lh-pulse-sm"></span> Loading — may take 30–60s</span></div>`);
  }

  // 3. WCAG compliance hint
  const wcagLevel = axeScore >= 90 ? 'WCAG 2.1 AA — Likely Compliant' : axeScore >= 70 ? 'WCAG 2.1 AA — Partial' : 'WCAG 2.1 AA — Needs Work';
  const wcagClass = axeScore >= 90 ? 'green' : axeScore >= 70 ? 'orange' : 'red';
  rows.push(`<div class="breakdown-row wcag-row"><span class="breakdown-label">WCAG Level</span><span class="breakdown-wcag ${wcagClass}">${wcagLevel}</span></div>`);

  // 4. Formula explanation — always visible at the bottom of the panel
  rows.push(`
    <div class="breakdown-formula">
      <div class="formula-title">ℹ️ How Accea Score is calculated</div>
      <div class="formula-line"><span class="formula-code">Score = earned ÷ possible × 100</span></div>
      <div class="formula-detail">Each rule contributes 10pts max. Violations lose points by severity:</div>
      <div class="formula-chips">
        <span class="fchip critical">Critical −8</span>
        <span class="fchip serious">Serious −5</span>
        <span class="fchip moderate">Moderate −2</span>
        <span class="fchip minor">Minor −1</span>
      </div>
      <div class="formula-detail">Incomplete/needs-review items are <em>not</em> penalised.</div>
    </div>`);

  els.breakdownRows.innerHTML = rows.join('');
}

function buildBreakdownRow(label, score, source, tooltip) {
  const colorClass = score >= 90 ? 'green' : score >= 50 ? 'orange' : 'red';
  return `
    <div class="breakdown-row">
      <div class="breakdown-label-wrap">
        <span class="breakdown-label">${label}</span>
        <span class="breakdown-src">${source}</span>
      </div>
      <div class="breakdown-bar-wrap">
        <div class="breakdown-bar ${colorClass}" style="width:${score}%"></div>
      </div>
      <span class="breakdown-score ${colorClass}">${score}</span>
    </div>`;
}

function renderQuickWins(issues) {
  const wins = [];

  issues.forEach(issue => {
    const impact = ISSUE_IMPACT_MAP[issue.id];
    if (!impact?.quickWin) return;

    wins.push({
      icon: impact.seo ? '●' : '○',
      title: issue.title || issue.id,
      fix: impact.fix,
      effort: impact.effort,
      timeMin: impact.timeMin,
      lhBoost: impact.lhBoost,
      seo: impact.seo,
      elementCount: issue.elementCount || 1
    });
  });

  // Sort by lhBoost descending (biggest impact first)
  wins.sort((a, b) => (b.lhBoost || 0) - (a.lhBoost || 0));

  if (wins.length === 0) {
    els.quickWins.classList.add('hidden');
    return;
  }

  els.quickWinsList.innerHTML = wins.slice(0, 6).map((w, idx) => `
    <li style="animation-delay:${idx * 0.04}s">
      <span class="tip-icon">${w.icon}</span>
      <div class="tip-content">
        <div class="tip-title">${escapeHtml(w.title)}</div>
        <div class="tip-desc">${escapeHtml(w.fix)}</div>
        <div class="tip-tags">
          <span class="tip-tag effort-${w.effort.toLowerCase()}">~${w.timeMin}min</span>
          <span class="tip-tag a11y">+${w.lhBoost} A11y</span>
          ${w.seo ? '<span class="tip-tag seo">SEO boost</span>' : ''}
          ${w.elementCount > 1 ? `<span class="tip-tag lighthouse">${w.elementCount} elements</span>` : ''}
        </div>
      </div>
    </li>
  `).join('');

  els.quickWins.classList.remove('hidden');
}

function renderSEOCrossover(issues) {
  const seoIssues = [];

  issues.forEach(issue => {
    const impact = ISSUE_IMPACT_MAP[issue.id];
    if (!impact?.seo) return;

    seoIssues.push({
      icon: impact.seoImpact === 'high' ? '●' : impact.seoImpact === 'medium' ? '◐' : '○',
      title: issue.title || issue.id,
      reason: impact.seoReason,
      impact: impact.seoImpact,
      fix: impact.fix
    });
  });

  // Sort: high impact first
  const impactOrder = { high: 0, medium: 1, low: 2 };
  seoIssues.sort((a, b) => (impactOrder[a.impact] || 99) - (impactOrder[b.impact] || 99));

  // Add general SEO tips at the end
  const allTips = [...seoIssues.slice(0, 4)];
  GENERAL_SEO_TIPS.forEach(tip => {
    if (allTips.length < 6) allTips.push(tip);
  });

  if (allTips.length === 0) {
    els.seoCrossover.classList.add('hidden');
    return;
  }

  els.seoCrossoverList.innerHTML = allTips.map((t, idx) => `
    <li style="animation-delay:${idx * 0.04}s">
      <span class="tip-icon">${t.icon}</span>
      <div class="tip-content">
        <div class="tip-title">${escapeHtml(t.title)}</div>
        <div class="tip-desc">${escapeHtml(t.reason || t.desc || '')}</div>
        <div class="tip-tags">
          ${t.impact ? `<span class="impact-badge ${t.impact}">${t.impact.toUpperCase()}</span>` : ''}
          ${(t.tags || []).map(tag => `<span class="tip-tag ${tag}">${tag}</span>`).join('')}
        </div>
      </div>
    </li>
  `).join('');

  els.seoCrossover.classList.remove('hidden');
}

function renderImprovementInsights(issues, score) {
  const insights = [];

  // Analyze what fixing specific issue types would do
  const issueIds = issues.map(i => i.id);
  const counts = currentAnalysis.counts || {};

  // Critical issues insight
  if (counts.critical > 0) {
    const potentialScore = Math.min(100, score + counts.critical * 12);
    insights.push({
      icon: '⚠',
      title: `Fix ${counts.critical} critical issue${counts.critical > 1 ? 's' : ''}`,
      desc: `Score would jump from ${score} → ~${potentialScore}. Critical issues block compliance and can trigger legal risk (ADA Title III).`,
      tags: [{ text: `+${potentialScore - score} pts`, class: 'a11y' }, { text: 'HIGH PRIORITY', class: 'effort-l' }]
    });
  }

  // SEO crossover insight
  const seoIssueCount = issues.filter(i => ISSUE_IMPACT_MAP[i.id]?.seo).length;
  if (seoIssueCount > 0) {
    insights.push({
      icon: '●',
      title: `${seoIssueCount} issues also hurt SEO`,
      desc: `Fixing these accessibility issues will simultaneously improve your Google search ranking signals. Two-for-one impact.`,
      tags: [{ text: 'SEO + A11y', class: 'seo' }, { text: `${seoIssueCount} issues`, class: 'lighthouse' }]
    });
  }

  // Quick wins insight
  const quickFixableCount = issues.filter(i => ISSUE_IMPACT_MAP[i.id]?.quickWin).length;
  const quickFixTime = issues.reduce((sum, i) => {
    const impact = ISSUE_IMPACT_MAP[i.id];
    return sum + (impact?.quickWin ? (impact.timeMin || 5) : 0);
  }, 0);
  if (quickFixableCount > 0) {
    insights.push({
      icon: '▸',
      title: `${quickFixableCount} issues fixable in ~${quickFixTime} minutes`,
      desc: `These are low-effort fixes that collectively have the biggest impact on your scores. Start here.`,
      tags: [{ text: `~${quickFixTime}min`, class: 'effort-s' }, { text: `${quickFixableCount} fixes`, class: 'lighthouse' }]
    });
  }

  // Heading structure insight
  if (issueIds.includes('heading-order') || issueIds.includes('empty-heading')) {
    insights.push({
      icon: '▸',
      title: 'Heading structure needs work',
      desc: 'Fixing heading hierarchy improves both SEO content signals and screen reader navigation. Use one h1, then h2→h3 sequentially.',
      tags: [{ text: 'A11y', class: 'a11y' }, { text: 'SEO', class: 'seo' }]
    });
  }

  // ARIA cleanup insight
  const ariaIssues = issues.filter(i => i.id?.startsWith('aria-'));
  if (ariaIssues.length > 0) {
    insights.push({
      icon: '▸',
      title: `${ariaIssues.length} ARIA issue${ariaIssues.length > 1 ? 's' : ''} detected`,
      desc: 'Invalid ARIA is worse than no ARIA — it actively misleads assistive technology. Fix or remove these attributes.',
      tags: [{ text: 'A11y', class: 'a11y' }, { text: 'Best Practices', class: 'lighthouse' }]
    });
  }

  // Color contrast insight
  if (issueIds.includes('color-contrast')) {
    const contrastIssue = issues.find(i => i.id === 'color-contrast');
    const elemCount = contrastIssue?.elementCount || 0;
    insights.push({
      icon: '●',
      title: `Color contrast fails on ${elemCount} element${elemCount !== 1 ? 's' : ''}`,
      desc: 'Low contrast affects 8% of men (color blindness) and everyone in bright sunlight. Fix text to ≥4.5:1 ratio. This also reduces bounce rate — an indirect SEO signal.',
      tags: [{ text: 'A11y', class: 'a11y' }, { text: `${elemCount} elements`, class: 'effort-m' }]
    });
  }

  // Perfect score encouragement
  if (score >= 90 && issues.length <= 3) {
    insights.push({
      icon: '★',
      title: 'Almost perfect! Just a few tweaks away',
      desc: `You're ${100 - score} points from a perfect 100. Fix the remaining ${issues.length} issue${issues.length !== 1 ? 's' : ''} for full compliance.`,
      tags: [{ text: 'NEARLY THERE', class: 'effort-s' }]
    });
  }

  if (insights.length === 0) {
    els.improvementInsights.classList.add('hidden');
    return;
  }

  els.improvementList.innerHTML = insights.map((ins, idx) => `
    <li style="animation-delay:${idx * 0.05}s">
      <span class="tip-icon">${ins.icon}</span>
      <div class="tip-content">
        <div class="tip-title">${escapeHtml(ins.title)}</div>
        <div class="tip-desc">${escapeHtml(ins.desc)}</div>
        <div class="tip-tags">
          ${ins.tags.map(t => `<span class="tip-tag ${t.class}">${t.text}</span>`).join('')}
        </div>
      </div>
    </li>
  `).join('');

  els.improvementInsights.classList.remove('hidden');
}

/* ═══════ Quick Checklist Tab ═══════ */

/**
 * Essential web parameter checklist.
 * Each item maps to axe rule IDs or is inferred from scan results.
 */
const CHECKLIST_ITEMS = [
  { id: 'lang', label: 'Page Language (lang)', desc: '<html> has a valid lang attribute', icon: SVG.globe, axePass: ['html-has-lang', 'html-lang-valid'] },
  { id: 'title', label: 'Page Title', desc: 'Page has a descriptive <title>', icon: '▪', axePass: ['document-title'] },
  { id: 'viewport', label: 'Meta Viewport', desc: 'Viewport meta allows user zoom', icon: '▪', axePass: ['meta-viewport'] },
  { id: 'images', label: 'Image Alt Text', desc: 'All images have descriptive alt', icon: '▪', axePass: ['image-alt', 'input-image-alt', 'svg-img-alt', 'role-img-alt'] },
  { id: 'headings', label: 'Heading Structure', desc: 'Headings follow proper h1→h6 order', icon: '▪', axePass: ['heading-order', 'empty-heading', 'p-as-heading'] },
  { id: 'contrast', label: 'Color Contrast', desc: 'Text meets WCAG 4.5:1 contrast ratio', icon: '▪', axePass: ['color-contrast'] },
  { id: 'forms', label: 'Form Labels', desc: 'All form inputs have labels', icon: '▪', axePass: ['label', 'select-name', 'input-button-name'] },
  { id: 'buttons', label: 'Button Names', desc: 'All buttons have accessible names', icon: '▪', axePass: ['button-name'] },
  { id: 'links', label: 'Link Names', desc: 'All links have descriptive text', icon: '▪', axePass: ['link-name'] },
  { id: 'landmarks', label: 'Landmarks', desc: 'Page uses <main>, <nav>, <header>, etc.', icon: '▪', axePass: ['landmark-one-main', 'region'] },
  { id: 'aria', label: 'ARIA Usage', desc: 'ARIA attributes are valid and correct', icon: '▪', axePass: ['aria-allowed-attr', 'aria-valid-attr', 'aria-valid-attr-value', 'aria-required-attr', 'aria-roles', 'aria-required-children', 'aria-required-parent'] },
  { id: 'keyboard', label: 'Keyboard Access', desc: 'All interactive elements are keyboard accessible', icon: '▪', axePass: ['keyboard', 'focus-visible', 'tabindex'] },
  { id: 'skiplink', label: 'Skip Link', desc: 'Page has a "skip to content" link', icon: '▪', axePass: ['bypass'] },
  { id: 'ids', label: 'Unique IDs', desc: 'No duplicate element IDs on the page', icon: '▪', axePass: ['duplicate-id', 'duplicate-id-active', 'duplicate-id-aria'] },
  { id: 'mobile', label: 'Mobile Friendly', desc: 'Page works on mobile viewports', icon: '▪', special: 'mobile' },
  { id: 'lighthouse', label: 'Lighthouse Score', desc: 'PageSpeed Insights performance & SEO', icon: '▪', special: 'lighthouse' },
];

function renderChecklist() {
  if (!currentAnalysis || !currentAnalysis.issues) {
    els.checklistEmpty.classList.remove('hidden');
    els.checklistList.innerHTML = '';
    els.checklistLighthouse.classList.add('hidden');
    return;
  }

  els.checklistEmpty.classList.add('hidden');

  const issues = currentAnalysis.issues || [];
  const issueIds = new Set(issues.map(i => i.id));

  const items = CHECKLIST_ITEMS.map(item => {
    let status = 'pass'; // default pass
    let detail = '';

    if (item.special === 'mobile') {
      // Mobile: check if meta-viewport issue exists
      const vpIssue = issues.find(i => i.id === 'meta-viewport');
      status = vpIssue ? 'fail' : 'pass';
      detail = vpIssue ? 'Viewport blocks zoom or scaling' : 'Viewport allows user zoom';
    } else if (item.special === 'lighthouse') {
      if (lighthouseLoading) {
        status = 'loading';
        detail = 'Fetching from PageSpeed Insights…';
      } else if (lighthouseData && !lighthouseData.error) {
        const perfScore = lighthouseData.performance;
        status = perfScore >= 50 ? 'pass' : 'fail';
        detail = `Perf: ${lighthouseData.performance} · A11y: ${lighthouseData.accessibility} · SEO: ${lighthouseData.seo}`;
      } else if (lighthouseData?.error) {
        status = 'warn';
        detail = lighthouseData.error;
      } else {
        status = 'loading';
        detail = 'Waiting for scan…';
      }
    } else {
      // Check if any of the associated axe rules failed
      const failing = item.axePass.filter(ruleId => issueIds.has(ruleId));
      if (failing.length > 0) {
        status = 'fail';
        const failIssues = issues.filter(i => failing.includes(i.id));
        const totalElements = failIssues.reduce((s, i) => s + (i.elementCount || 0), 0);
        detail = `${failing.length} rule${failing.length > 1 ? 's' : ''} failing` + (totalElements > 0 ? ` · ${totalElements} element${totalElements > 1 ? 's' : ''}` : '');
      } else {
        detail = 'All checks passed';
      }
    }

    return { ...item, status, detail, failingRules: item.axePass || [] };
  });

  const passCount = items.filter(i => i.status === 'pass').length;
  const failCount = items.filter(i => i.status === 'fail').length;

  // Build detail HTML for a single checklist item
  function buildItemDetailHTML(item) {
    const failingRules = (item.axePass || []).filter(r => issueIds.has(r));
    const passingRules = (item.axePass || []).filter(r => !issueIds.has(r));
    const failIssues = issues.filter(i => failingRules.includes(i.id));
    const totalElements = failIssues.reduce((s, i) => s + (i.elementCount || 0), 0);

    if (item.special === 'lighthouse') {
      if (lighthouseData && !lighthouseData.error) {
        return `
          <div class="checklist-detail-row"><span class="checklist-detail-label">Scores</span><span class="checklist-detail-value">Performance: ${lighthouseData.performance} · Accessibility: ${lighthouseData.accessibility} · Best Practices: ${lighthouseData.bestPractices} · SEO: ${lighthouseData.seo}</span></div>
          <div class="checklist-detail-tip">💡 Lighthouse scores are fetched from Google PageSpeed Insights API. Scores above 90 are considered good.</div>`;
      }
      return `<div class="checklist-detail-tip">💡 Lighthouse scores are fetched after scan from Google PageSpeed Insights. Make sure the page is publicly accessible.</div>`;
    }
    if (item.special === 'mobile') {
      return `
        <div class="checklist-detail-row"><span class="checklist-detail-label">Check</span><span class="checklist-detail-value">Verifies &lt;meta name="viewport"&gt; allows user zoom and doesn't set maximum-scale=1</span></div>
        <div class="checklist-detail-tip">💡 Users with low vision rely on pinch-to-zoom. Ensure <code>user-scalable=no</code> is not set.</div>`;
    }
    const rulesHTML = [
      ...failingRules.map(r => `<span class="checklist-rule-tag">${escapeHtml(r)}</span>`),
      ...passingRules.map(r => `<span class="checklist-rule-tag passing">${escapeHtml(r)}</span>`)
    ].join('');
    return `
      <div class="checklist-detail-row"><span class="checklist-detail-label">About</span><span class="checklist-detail-value">${escapeHtml(item.desc)}</span></div>
      ${totalElements > 0 ? `<div class="checklist-detail-row"><span class="checklist-detail-label">Impact</span><span class="checklist-detail-value">${failingRules.length} rule${failingRules.length > 1 ? 's' : ''} failing · ${totalElements} element${totalElements > 1 ? 's' : ''} affected</span></div>` : ''}
      <div class="checklist-detail-row"><span class="checklist-detail-label">Rules</span><span class="checklist-detail-value"><div class="checklist-detail-rules">${rulesHTML}</div></span></div>
      ${item.status === 'fail' ? `<div class="checklist-detail-tip">💡 Switch to the Issues tab and filter by these rules to see affected elements and get AI fix suggestions.</div>` : `<div class="checklist-detail-tip">✅ All related axe-core rules are passing for this check.</div>`}`;
  }

  // Render a single checklist item card
  function renderChecklistCard(item, idx) {
    return `
    <div class="checklist-item ${item.status}" style="animation-delay:${idx * 0.03}s" data-checklist-id="${item.id}">
      <div class="checklist-item-header">
        <span class="checklist-icon">${item.icon}</span>
        <div class="checklist-info">
          <div class="checklist-label">${escapeHtml(item.label)}</div>
          <div class="checklist-desc">${escapeHtml(item.detail || item.desc)}</div>
        </div>
        <span class="checklist-status-icon">${item.status === 'pass' ? SVG.checkCircle : item.status === 'fail' ? SVG.xCircle : item.status === 'warn' ? SVG.alertTriangle : '<span class="checklist-spinner"></span>'}</span>
        <svg class="checklist-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="checklist-detail">${buildItemDetailHTML(item)}</div>
    </div>`;
  }

  // Group items by status
  const failItems = items.filter(i => i.status === 'fail');
  const warnItems = items.filter(i => i.status === 'warn');
  const loadingItems = items.filter(i => i.status === 'loading');
  const passItems = items.filter(i => i.status === 'pass');

  let sectionsHTML = `
    <div class="checklist-summary">
      <span class="checklist-pass-count">${passCount}/${items.length} passed</span>
      ${failCount > 0 ? `<span class="checklist-fail-count">${failCount} need attention</span>` : ''}
    </div>`;

  let globalIdx = 0;

  if (failItems.length) {
    sectionsHTML += `
    <div class="checklist-section">
      <div class="checklist-section-header fail">
        <span class="checklist-section-dot"></span>
        <span class="checklist-section-title">Needs Attention</span>
        <span class="checklist-section-count">${failItems.length}</span>
      </div>
      <div class="checklist-section-items">
        ${failItems.map(item => renderChecklistCard(item, globalIdx++)).join('')}
      </div>
    </div>`;
  }

  if (warnItems.length) {
    sectionsHTML += `
    <div class="checklist-section">
      <div class="checklist-section-header warn">
        <span class="checklist-section-dot"></span>
        <span class="checklist-section-title">Warnings</span>
        <span class="checklist-section-count">${warnItems.length}</span>
      </div>
      <div class="checklist-section-items">
        ${warnItems.map(item => renderChecklistCard(item, globalIdx++)).join('')}
      </div>
    </div>`;
  }

  if (loadingItems.length) {
    sectionsHTML += `
    <div class="checklist-section">
      <div class="checklist-section-header loading">
        <span class="checklist-section-dot"></span>
        <span class="checklist-section-title">Checking…</span>
        <span class="checklist-section-count">${loadingItems.length}</span>
      </div>
      <div class="checklist-section-items">
        ${loadingItems.map(item => renderChecklistCard(item, globalIdx++)).join('')}
      </div>
    </div>`;
  }

  if (passItems.length) {
    sectionsHTML += `
    <div class="checklist-section">
      <div class="checklist-section-header pass">
        <span class="checklist-section-dot"></span>
        <span class="checklist-section-title">Passed</span>
        <span class="checklist-section-count">${passItems.length}</span>
      </div>
      <div class="checklist-section-items">
        ${passItems.map(item => renderChecklistCard(item, globalIdx++)).join('')}
      </div>
    </div>`;
  }

  els.checklistList.innerHTML = sectionsHTML;

  // Add click handlers for expand/collapse
  els.checklistList.querySelectorAll('.checklist-item').forEach(el => {
    const header = el.querySelector('.checklist-item-header');
    if (header) {
      header.addEventListener('click', () => {
        el.classList.toggle('expanded');
      });
    }
  });

  // Show Lighthouse scores at top of checklist if available
  renderChecklistLighthouse();
}

/**
 * Render mini Lighthouse score circles at top of checklist tab
 */
function renderChecklistLighthouse() {
  if (lighthouseLoading) {
    els.checklistLighthouse.classList.remove('hidden');
    els.checklistLhScores.innerHTML = ['Perf', 'A11y', 'BP', 'SEO'].map((label, i) => `
      <div class="cl-lh-card skeleton" style="animation-delay:${i * 0.08}s">
        <div class="cl-lh-skeleton-circle"></div>
        <div class="cl-lh-label">${label}</div>
      </div>
    `).join('');
    return;
  }

  if (!lighthouseData || lighthouseData.error) {
    els.checklistLighthouse.classList.add('hidden');
    return;
  }

  els.checklistLighthouse.classList.remove('hidden');
  const scores = [
    { label: 'Perf', score: lighthouseData.performance },
    { label: 'A11y', score: lighthouseData.accessibility },
    { label: 'BP', score: lighthouseData.bestPractices },
    { label: 'SEO', score: lighthouseData.seo },
  ];

  els.checklistLhScores.innerHTML = scores.map((s, i) => {
    const colorClass = s.score >= 90 ? 'green' : s.score >= 50 ? 'orange' : 'red';
    return `
      <div class="cl-lh-card" style="animation-delay:${i * 0.08}s">
        <div class="cl-lh-ring ${colorClass}">
          <svg viewBox="0 0 36 36" class="cl-lh-svg">
            <path class="cl-lh-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            <path class="cl-lh-fg ${colorClass}" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" data-score="${s.score}"/>
          </svg>
          <span class="cl-lh-num">${s.score}</span>
        </div>
        <div class="cl-lh-label">${s.label}</div>
      </div>
    `;
  }).join('');

  // Animate rings
  setTimeout(() => {
    els.checklistLhScores.querySelectorAll('.cl-lh-fg').forEach(ring => {
      ring.setAttribute('stroke-dasharray', `${ring.dataset.score}, 100`);
    });
  }, 50);
}

/* ═══════ End Checklist ═══════ */

/* ═══════ End Tips Engine ═══════ */

function launchConfetti() {
  const canvas = els.confettiCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const colors = ['#e94560', '#533483', '#2ecc71', '#f1c40f', '#3498db', '#a855f7'];
  const particles = [];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 8 + 4,
      h: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rotation += p.rotSpeed;

      if (frame > 40) p.opacity -= 0.015;
      if (p.opacity <= 0) return;
      alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    frame++;
    if (alive && frame < 120) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  requestAnimationFrame(draw);
}

/* ═══════ Highlights ═══════ */

async function toggleHighlights() {
  if (!currentAnalysis?.issues) return;
  
  if (highlightsActive) {
    await clearHighlights();
  } else {
    await sendMessage({
      action: 'highlight',
      tabId: currentTabId,
      issues: currentAnalysis.issues
    });
    highlightsActive = true;
    els.btnHighlight.textContent = '👁️ On';
    els.btnHighlight.classList.add('active');
    els.btnHighlight.title = 'Highlights on — click to hide';
  }
}

async function clearHighlights() {
  await sendMessage({ action: 'clear-highlights', tabId: currentTabId });
  highlightsActive = false;
  els.btnHighlight.textContent = '👁️ Highlight';
  els.btnHighlight.classList.remove('active');
  els.btnHighlight.title = 'Highlight issues on page';
}

/* ═══════ Settings ═══════ */

function showSettings() {
  els.viewMain.classList.add('hidden');
  els.viewSettings.classList.remove('hidden');
}

function hideSettings() {
  els.viewSettings.classList.add('hidden');
  els.viewMain.classList.remove('hidden');
}

async function loadSettings() {
  const response = await sendMessage({ action: 'get-settings' });
  if (!response?.ok) return;

  els.settingPrivacy.checked = response.privacyMode !== false;
  els.settingCloud.checked = response.cloudOptIn === true;
  els.settingServerUrl.value = response.localServerUrl || 'http://localhost:3000';
  els.settingAutoHighlight.checked = response.autoHighlight !== false;
  els.settingBadge.checked = response.showBadge !== false;
  els.settingPsApiKey.value = response.pagespeedApiKey || '';

  if (els.settingPrivacy.checked) {
    els.settingCloud.disabled = true;
  }
}

async function saveCurrentSettings() {
  await sendMessage({
    action: 'save-settings',
    settings: {
      privacyMode: els.settingPrivacy.checked,
      cloudOptIn: els.settingCloud.checked,
      localServerUrl: els.settingServerUrl.value,
      autoHighlight: els.settingAutoHighlight.checked,
      showBadge: els.settingBadge.checked,
      pagespeedApiKey: (els.settingPsApiKey.value || '').trim()
    }
  });
}

/* ═══════ LLM capabilities ═══════ */

async function detectCapabilities() {
  els.capOverall.textContent = '…';
  els.capWindowAI.textContent = '…';
  els.capLocalhost.textContent = '…';

  const response = await sendMessage({ action: 'get-capabilities' });
  if (!response?.ok) return;

  if (response.windowAI) {
    els.capWindowAI.textContent = response.windowAIStatus === 'readily' ? '✓ Ready' : '⬇ Available';
    els.capWindowAI.className = 'cap-status ok';
  } else {
    els.capWindowAI.textContent = '✗ Not available';
    els.capWindowAI.className = 'cap-status no';
  }

  if (response.localhost) {
    els.capLocalhost.textContent = response.localhostLLM ? '✓ Connected' : '⚠ No AI engine';
    els.capLocalhost.className = response.localhostLLM ? 'cap-status ok' : 'cap-status partial';
  } else {
    els.capLocalhost.textContent = '✗ Offline';
    els.capLocalhost.className = 'cap-status no';
  }

  els.capCloud.textContent = els.settingCloud.checked ? '✓ Opted in' : '✗ Opted out';
  els.capCloud.className = els.settingCloud.checked ? 'cap-status ok' : 'cap-status no';

  // Overall AI status — green if any layer is available
  const hasAI = response.windowAI || (response.localhost && response.localhostLLM) || els.settingCloud.checked;
  if (hasAI) {
    const source = response.windowAI ? 'Built-in AI'
                 : (response.localhost && response.localhostLLM) ? 'Local Server'
                 : 'Cloud';
    els.capOverall.textContent = `✓ Available via ${source}`;
    els.capOverall.className = 'cap-status ok';
  } else {
    els.capOverall.textContent = '✗ No AI engine found';
    els.capOverall.className = 'cap-status no';
  }
}

/* ═══════ Toast ═══════ */

function showToast(message, duration = 2500) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), duration);
}

/* ═══════ Helpers ═══════ */

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

function showError(text) {
  els.errorText.textContent = text;
  els.error.classList.remove('hidden');
  setTimeout(() => els.error.classList.add('hidden'), 5000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
