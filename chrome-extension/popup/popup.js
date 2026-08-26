/**
 * SiteScope 360 Chrome Extension — Popup Controller V2
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
  viewAuth:     $('#view-auth'),
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
  lhScoresRow:      $('#lh-scores-row'),
  lhRings:          $('#lh-rings'),
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
  btnLivePreview:   $('#btn-live-preview'),
  btnLighthouse:    $('#btn-lighthouse'),
  btnClear:     $('#btn-clear'),
  btnDetect:    $('#btn-detect'),
  
  // Fix Sandbox
  livePreviewPanel:       $('#live-preview-panel'),
  btnLivePreviewClose:    $('#btn-live-preview-close'),
  btnApplyAllPatches:     $('#btn-apply-all-patches'),
  btnVerifyScore:         $('#btn-verify-score'),
  btnUndoPatch:       $('#btn-undo-patch'),
  btnResetLivePreview:    $('#btn-reset-live-preview'),
  livePreviewPatchCount:  $('#live-preview-patch-count'),
  livePreviewDomCount:      $('#live-preview-dom-count'),
  livePreviewAvailableCount: $('#live-preview-available-count'),
  livePreviewPatchList:   $('#live-preview-patch-list'),
  
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

  // Lighthouse dedicated tab
  lhTabHeader:       $('#lh-tab-header'),
  lhTabStatus:       $('#lh-tab-status'),
  lhTabUrl:          $('#lh-tab-url'),
  lhTabScores:       $('#lh-tab-scores'),
  lhTabVitals:       $('#lh-tab-vitals'),
  lhTabVitalsGrid:   $('#lh-tab-vitals-grid'),
  lhTabDiagnostics:  $('#lh-tab-diagnostics'),
  lhTabDiagnosticsList: $('#lh-tab-diagnostics-list'),
  lhTabPassed:       $('#lh-tab-passed'),
  lhTabPassedToggle: $('#lh-tab-passed-toggle'),
  lhTabPassedCount:  $('#lh-tab-passed-count'),
  lhTabPassedList:   $('#lh-tab-passed-list'),
  lhTabEmpty:        $('#lh-tab-empty'),
  lhTabLoading:      $('#lh-tab-loading'),
  lhTabLoadingHint:  $('#lh-tab-loading-hint'),

  // UX & Performance tab
  uxpContent:        $('#uxp-content'),
  uxpEmpty:          $('#uxp-empty'),
  
  // Settings
  settingPrivacy:       $('#setting-privacy'),
  settingCloud:         $('#setting-cloud'),
  settingServerUrl:     $('#setting-server-url'),
  settingGeminiApiKey:  $('#setting-llm-api-key'),   // unified key field
  settingLlmProvider:   $('#setting-llm-provider'),
  settingLlmModel:      $('#setting-llm-model'),
  settingAutoHighlight: $('#setting-auto-highlight'),
  settingBadge:         $('#setting-badge'),
  settingPsApiKey:      $('#setting-ps-api-key'),
  
  // Capabilities
  capOverall:   $('#cap-overall'),
  capWindowAI:  $('#cap-windowai'),
  capGemini:    $('#cap-gemini'),
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
  designUpgradesSection: $('#design-upgrades-section'),
  designTokensSection:$('#design-tokens-section'),
  designAnalyticsSection: $('#design-analytics-section'),
  designHostingSection:   $('#design-hosting-section'),
  designTypeScaleSection: $('#design-typescale-section'),
  designPageHealthSection:$('#design-pagehealth-section'),
  designPageStatsSection: $('#design-pagestats-section'),

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

/* ═══════ Auth / Subscription state ═══════ */
const AUTH_STORAGE_KEY  = 'ss360_session';
const USAGE_STORAGE_KEY = 'ss360_usage';
const AUTH_API_BASE     = 'http://localhost:3000'; // backend endpoint (TODO: replace with real endpoint)
const CHECKOUT_URLS     = {
  pro:  'http://localhost:8000/pricing?plan=pro',
};
const MANAGE_URL = 'http://localhost:8000/account.html';

/**
 * Plan capability matrix.
 * scansPerDay: Infinity = unlimited
 */
const PLAN_CAPS = {
  free:  { label: 'Free',  color: '#6b7280', scansPerDay: 3,        ai: false, livePreview: false, lighthouse: false, export: false },
  pro:   { label: 'Pro',   color: '#8b5cf6', scansPerDay: Infinity, ai: true,  livePreview: true,  lighthouse: true,  export: true  },
};

let authSession = null;   // { token, user: { email }, plan: 'free'|'pro'|'team', expiresAt }
let authPlan    = 'free'; // resolved plan shorthand

/* ─── Auth helpers ─── */

async function loadAuthSession() {
  const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  authSession = result[AUTH_STORAGE_KEY] || null;
  authPlan = authSession?.plan || 'free';
  return authSession;
}

async function saveAuthSession(session) {
  authSession = session;
  authPlan = session?.plan || 'free';
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session });
}

async function clearAuthSession() {
  authSession = null;
  authPlan = 'free';
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
}

/**
 * Validate token with server. Falls back to cached plan on network failure.
 * Returns true if valid (or offline with cached plan).
 */
async function validateAuthSession() {
  if (!authSession?.token) return false;

  try {
    const res = await fetch(`${AUTH_API_BASE}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authSession.token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 401 || res.status === 403) {
      // Definitive rejection from server — clear session
      await clearAuthSession();
      return false;
    }
    if (!res.ok) {
      // Server error (5xx) or unexpected — trust cached plan, don't logout
      return !!authSession?.plan;
    }
    const data = await res.json();
    authSession.plan = data.plan || 'free';
    authPlan = authSession.plan;
    await saveAuthSession(authSession);
    return true;
  } catch {
    // Network error (server offline / localhost not running) — trust cached plan
    return !!authSession?.plan;
  }
}

/* ─── Usage / rate-limit helpers ─── */

function _todayKey() { return new Date().toISOString().slice(0, 10); }

async function getUsageToday() {
  const result = await chrome.storage.local.get(USAGE_STORAGE_KEY);
  const u = result[USAGE_STORAGE_KEY] || {};
  return u.date === _todayKey() ? (u.scans || 0) : 0;
}

async function incrementScanUsage() {
  const result = await chrome.storage.local.get(USAGE_STORAGE_KEY);
  const u = result[USAGE_STORAGE_KEY] || {};
  const today = _todayKey();
  const scans = (u.date === today ? (u.scans || 0) : 0) + 1;
  await chrome.storage.local.set({ [USAGE_STORAGE_KEY]: { date: today, scans } });
  return scans;
}

/**
 * Check if a scan is allowed for the current plan.
 * Returns { allowed, scansToday, limit, reason }.
 */
async function checkScanAllowed() {
  const cap = PLAN_CAPS[authPlan] || PLAN_CAPS.free;
  if (cap.scansPerDay === Infinity) return { allowed: true };
  const scansToday = await getUsageToday();
  const allowed = scansToday < cap.scansPerDay;
  return {
    allowed,
    scansToday,
    limit: cap.scansPerDay,
    reason: `Free plan: ${scansToday}/${cap.scansPerDay} scans used today. Upgrade to Pro for unlimited.`,
  };
}

/**
 * Feature gate. Shows paywall if user lacks access.
 * feature: 'ai' | 'livePreview' | 'lighthouse' | 'export'
 * Returns true if allowed.
 */
function requirePlan(feature, featureLabel) {
  const cap = PLAN_CAPS[authPlan] || PLAN_CAPS.free;
  if (cap[feature]) return true;
  showPaywallModal(featureLabel || feature);
  return false;
}

/* ─── Auth API calls ─── */

async function apiSignIn(email, password) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Sign-in failed' };
    return { ok: true, token: data.token, user: data.user, plan: data.plan || 'free' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

async function apiSignUp(email, password) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Sign-up failed' };
    return { ok: true, token: data.token, user: data.user, plan: data.plan || 'free' };
  } catch {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

/* ─── Auth UI functions ─── */

function showAuthView() {
  document.getElementById('view-auth')?.classList.remove('hidden');
  document.getElementById('view-main')?.classList.add('hidden');
  document.getElementById('view-settings')?.classList.add('hidden');
}

function hideAuthView() {
  document.getElementById('view-auth')?.classList.add('hidden');
  document.getElementById('view-main')?.classList.remove('hidden');
}

function updatePlanBadge() {
  const badge = document.getElementById('plan-badge');
  const accountBtn = document.getElementById('btn-account');
  if (!badge) return;

  const cap = PLAN_CAPS[authPlan] || PLAN_CAPS.free;
  badge.textContent = cap.label;
  badge.className = `plan-badge plan-badge-${authPlan}`;

  // The demo tier selector already displays the current tier. Showing the badge
  // alongside it put two identical chips in the header, which read as a bug.
  const tierSelect = document.getElementById('demo-tier-select');
  const selectorVisible = tierSelect && !tierSelect.classList.contains('hidden');
  badge.classList.toggle('hidden', !!selectorVisible);

  accountBtn?.classList.toggle('hidden', !authSession);
}

function updateDemoTierStyle(sel, plan) {
  sel.classList.remove('tier-free','tier-pro','tier-team');
  sel.classList.add(`tier-${plan}`);
}

function showPaywallModal(featureLabel, extraDesc) {
  const modal = document.getElementById('paywall-modal');
  if (!modal) return;
  const title      = document.getElementById('paywall-title');
  const ribbonText = document.getElementById('paywall-ribbon-text');
  const upgradeBtn = document.getElementById('paywall-upgrade-btn');
  const scanCounter = document.getElementById('paywall-scan-counter');
  const priceBlock  = document.getElementById('paywall-price-block');
  const featBlock   = document.getElementById('paywall-features-block');

  if (ribbonText) ribbonText.textContent = 'Pro Feature';
  if (title) title.textContent = featureLabel ? `Unlock ${featureLabel}` : 'Unlock with Pro';
  if (upgradeBtn) upgradeBtn.href = CHECKOUT_URLS.pro;

  // Ensure price + features are visible for the standard upsell
  priceBlock?.classList.remove('hidden');
  featBlock?.classList.remove('hidden');
  scanCounter?.classList.add('hidden');

  modal.classList.remove('hidden');
  modal.focus?.();
}

async function showScanLimitModal(scansToday, limit) {
  const modal        = document.getElementById('paywall-modal');
  if (!modal) return;
  const title        = document.getElementById('paywall-title');
  const ribbonText   = document.getElementById('paywall-ribbon-text');
  const upgradeBtn   = document.getElementById('paywall-upgrade-btn');
  const scanCounter  = document.getElementById('paywall-scan-counter');
  const scanUsed     = document.getElementById('paywall-scan-used');
  const scanFill     = document.getElementById('paywall-scan-fill');
  const priceBlock   = document.getElementById('paywall-price-block');
  const featBlock    = document.getElementById('paywall-features-block');

  if (ribbonText) ribbonText.textContent = 'Daily Limit';
  if (title) title.textContent = `You've used all ${limit} free scans today`;
  if (upgradeBtn) upgradeBtn.href = CHECKOUT_URLS.pro;

  // Hide price + features — not relevant in limit context
  priceBlock?.classList.add('hidden');
  featBlock?.classList.add('hidden');

  if (scanCounter) {
    scanCounter.classList.remove('hidden');
    if (scanUsed) scanUsed.textContent = scansToday;
    document.getElementById('paywall-scan-limit').textContent = limit;
    if (scanFill) scanFill.style.width = `${Math.min(100, (scansToday / limit) * 100)}%`;
  }

  modal.classList.remove('hidden');
}

function closePaywallModal() {
  document.getElementById('paywall-modal')?.classList.add('hidden');
}

function showAccountModal() {
  const modal = document.getElementById('account-modal');
  if (!modal) return;
  const emailEl  = document.getElementById('account-modal-title');
  const planEl   = document.getElementById('account-plan-display');
  const scanInfo = document.getElementById('account-scan-info');
  const manageBtn = document.getElementById('account-manage-btn');

  if (emailEl) emailEl.textContent = authSession?.user?.email || 'Your Account';
  const cap = PLAN_CAPS[authPlan] || PLAN_CAPS.free;
  if (planEl) planEl.textContent = `Current plan: ${cap.label}`;
  if (manageBtn) manageBtn.href = MANAGE_URL;

  // Show scan usage for free users
  getUsageToday().then(scansToday => {
    if (scanInfo) {
      if (authPlan === 'free') {
        scanInfo.textContent = `${scansToday} / ${cap.scansPerDay} scans used today`;
        scanInfo.classList.remove('hidden');
      } else {
        scanInfo.classList.add('hidden');
      }
    }
  });

  modal.classList.remove('hidden');
}

function closeAccountModal() {
  document.getElementById('account-modal')?.classList.add('hidden');
}

/**
 * Full auth initialisation — called first in DOMContentLoaded.
 * Returns { loggedIn, plan }.
 */
async function initAuth() {
  const session = await loadAuthSession();
  if (session) {
    // Token exists — validate silently in background, don't block UI
    validateAuthSession().then(valid => {
      if (!valid) {
        showAuthView();
        updatePlanBadge();
      } else {
        updatePlanBadge();
      }
    });
    updatePlanBadge();
    return { loggedIn: true, plan: authPlan };
  }
  // No session — free tier, no auth gate (user can continue without login)
  updatePlanBadge();
  return { loggedIn: false, plan: 'free' };
}

/* ═══════ State ═══════ */
let currentTabId = null;
let currentAnalysis = null;
let highlightsActive = false;
let scanStartTime = null;
let activeFilter = 'all';

/* ═══════ Scan cache (remembers last scan per tab) ═══════ */
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SCAN_CACHE_KEY = 'scanCache';

// Helper functions for persistent scan cache
async function getScanCache() {
  const result = await chrome.storage.local.get(SCAN_CACHE_KEY);
  return result[SCAN_CACHE_KEY] || {};
}

async function setScanCache(tabId, data) {
  const cache = await getScanCache();
  cache[tabId] = data;
  await chrome.storage.local.set({ [SCAN_CACHE_KEY]: cache });
}

async function getCachedScan(tabId) {
  const cache = await getScanCache();
  return cache[tabId] || null;
}

async function clearExpiredCache() {
  const cache = await getScanCache();
  const now = Date.now();
  let changed = false;
  
  for (const [tabId, data] of Object.entries(cache)) {
    if (data.timestamp && (now - data.timestamp) > CACHE_DURATION_MS) {
      delete cache[tabId];
      changed = true;
    }
  }
  
  if (changed) {
    await chrome.storage.local.set({ [SCAN_CACHE_KEY]: cache });
  }
}

/* ═══════ Lighthouse state ═══════ */
let lighthouseData = null;
let lighthouseLoading = false;
let _lhProgressTimer = null;   // interval driving the fake progress bar
let _lhProgressPct  = 0;       // current displayed percentage

/** Start the animated LH fetch progress bar (fake-progress easing to ~88%). */
function startLhProgressBar() {
  clearInterval(_lhProgressTimer); // clear any stale timer first
  _lhProgressPct = 0;

  // Ease towards 88% over ~28s using diminishing increments
  _lhProgressTimer = setInterval(() => {
    const gap  = 88 - _lhProgressPct;
    const step = Math.max(0.4, gap * 0.055);
    _lhProgressPct = Math.min(88, _lhProgressPct + step);
    const w      = `${_lhProgressPct.toFixed(1)}%`;
    const pctTxt = `${Math.round(_lhProgressPct)}%`;

    const miniF  = document.getElementById('lh-mini-fill');
    const miniP  = document.getElementById('lh-mini-pct');
    const status = document.getElementById('lh-fetch-status');
    if (miniF) miniF.style.width = w;
    if (miniP) miniP.textContent = pctTxt;
    if (status) {
      if      (_lhProgressPct >= 70) status.textContent = 'Almost there…';
      else if (_lhProgressPct >= 40) status.textContent = 'Analysing…';
      else if (_lhProgressPct >= 15) status.textContent = 'Running audits…';
    }
  }, 700);
}

/** Complete the LH progress bar — just stop the timer.
 *  renderDashboardLhRings() called by the same code path will replace
 *  the entire header HTML with the success/error state immediately after. */
function completeLhProgressBar(success = true) {
  clearInterval(_lhProgressTimer);
  _lhProgressTimer = null;
  _lhProgressPct   = 0;
  // No DOM updates here — renderDashboardLhRings replaces the header HTML next.
}

/* ═══════ Suggestion cache (pre-fetched) ═══════ */
const suggestionCache = new Map(); // key: issue.id, value: fix response
let prefetchInProgress = false;
let prefetchTotal = 0;
let prefetchDone = 0;

/* ═══════ Live Preview Mode ═══════ */
let livePreviewActive = false;
const livePreviewPatches = []; // Array of applied patches with undo info
const LIVE_PREVIEW_CACHE_KEY = 'livePreviewPatches';
const PATCHED_ISSUES_CACHE_KEY = 'patchedIssueIds';
const patchedIssueIds = new Set(); // Track which issue IDs have been patched
// Issues confirmed absent by a FRESH SCAN after patching. Deliberately separate
// from patchedIssueIds: "we applied a patch" is not evidence that it worked, and
// the evidence pack depends on that distinction being real.
const verifiedIssueIds = new Set();
// Judgment findings from the last scan, kept so the evidence record can include them.
let lastJudgmentFindings = [];

// Patch types
const PATCH_TYPE = {
  ATTRIBUTE: 'attribute',
  REMOVE_ATTRIBUTE: 'remove-attribute',
  CSS: 'css',
  TEXT: 'text',
  REMOVE: 'remove',
  INSERT: 'insert',
  INNER_HTML: 'innerHTML',
  OUTER_HTML: 'outerHTML'
};

/* ═══════ Typewriter engine ═══════ */

// Deliberately short and disciplined: outcome words the product is actually
// working toward, not feature-marketing claims. The earlier list included
// things like "SEO-Friendly" and "Lighthouse Ready" as if the tool itself
// guarantees them each cycle — that reads as a tool marketing itself before
// a viewer has seen it do anything. These three describe the goal, not a
// capability claim, so cycling through them doesn't have that problem.
const TYPEWRITER_PHRASES = [
  'Accessible',
  'Usable',
  'Inclusive',
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
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tab?.id;

  // ── Auth init (first, so badge + session are ready before any UI) ──
  await initAuth();

  await loadSettings();
  detectCapabilities();
  bindEvents();
  bindAuthEvents();
  startTypewriter();

  // Clear any expired cache entries
  await clearExpiredCache();

  // Check if we have cached scan results for this tab
  if (currentTabId) {
    const cached = await getCachedScan(currentTabId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      // If cache is still fresh (< 5 minutes), restore it
      if (age < CACHE_DURATION_MS) {
        currentAnalysis = cached.analysis;
        
        // Restore patched issue IDs before rendering (so cards show "Patched")
        await loadPatchedIssueIds();
        
        renderResults(currentAnalysis);
        
        // Restore highlights if they were active
        if (cached.highlightsActive) {
          toggleHighlights();
        }
        
        // Dismiss intro
        if (els.introHero && !els.introHero.classList.contains('hidden')) {
          stopTypewriter();
          els.introHero.classList.add('intro-exit');
          setTimeout(() => {
            els.introHero.classList.add('hidden');
          }, 400);
        }
      }
    }
  }

  // Listen for Lighthouse results pushed from the service worker.
  // The SW fetches in background; this fires whether or not the popup was open during fetch.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action !== 'lighthouse-ready') return;
    lighthouseLoading = false;
    if (msg.error) {
      lighthouseData = { error: msg.error };
      completeLhProgressBar(false);
    } else if (msg.data) {
      lighthouseData = msg.data;
      completeLhProgressBar(true);
    }
    renderChecklistLighthouse();
    renderLighthouseTab();
    renderDashboardLhRings();
    renderUXPerfTab();
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
            els.lhLoadingHint?.classList.add('hidden'); // no bar was running, just hide
            renderChecklistLighthouse();
            renderLighthouseTab();
            renderDashboardLhRings();
            renderUXPerfTab();
            upgradeScoreCardWithLighthouse();
          }
        } else if (cached?.status === 'fetching') {
          // SW is still fetching — only enter loading state if we don't already have data
          if (!lighthouseData) {
            lighthouseLoading = true;
            startLhProgressBar();
          }
          renderChecklistLighthouse();
          renderLighthouseTab();
          renderDashboardLhRings();
          renderUXPerfTab();
        } else if (!lighthouseData && currentAnalysis) {
          // No cache, no active fetch, but we have a scan — kick it off now
          fetchLighthouseScores();
        }
      }
    } catch { /* no cached data, that's fine */ }
  }
  } catch (initErr) {
    console.error('[Popup] Init error:', initErr);
    // Show a minimal error so the popup isn't blank
    const errEl = document.getElementById('error');
    const errTxt = document.getElementById('error-text');
    if (errEl && errTxt) {
      errTxt.textContent = 'Failed to initialise extension. Try reloading.';
      errEl.classList.remove('hidden');
    }
  }
});

/* ═══════ Event binding ═══════ */

function bindEvents() {
  // 3.8 — impairment simulation toggle
  const impairmentSelect = document.getElementById('impairment-select');
  // 4.2 — ambient scanning needs the optional notifications permission, and
  // must never silently keep scanning after the user unchecks it.
  const ambientToggle = document.getElementById('setting-ambient-scan');
  ambientToggle?.addEventListener('change', async () => {
    if (ambientToggle.checked) {
      const granted = await chrome.permissions.request({ permissions: ['notifications'] }).catch(() => false);
      if (!granted) {
        showToast('Notifications permission is needed to alert on regressions');
        ambientToggle.checked = false;
        return;
      }
    }
    await sendMessage({ action: 'save-settings', settings: { ambientScanEnabled: ambientToggle.checked } });
    showToast(ambientToggle.checked ? 'Watching scanned pages for regressions' : 'Ambient scanning off');
  });

  // 4.3 — natural language control over the current scan's issue list
  const chatInput  = document.getElementById('chat-input');
  const chatSend   = document.getElementById('chat-send');

  // 6.1 — client profiles (local only; stamps branding onto markdown exports)
  initClientProfiles();

  // 6.2 — team sync: portable export/import, no backend
  document.getElementById('team-export-btn')?.addEventListener('click', exportTeamBundle);
  document.getElementById('team-import-btn')?.addEventListener('click', () => {
    document.getElementById('team-import-file')?.click();
  });
  document.getElementById('team-import-file')?.addEventListener('change', importTeamBundleFile);
  document.getElementById('audit-clear-btn')?.addEventListener('click', async () => {
    if (!confirm('Clear the local remediation change log? This cannot be undone.')) return;
    await sendMessage({ action: 'audit-clear' });
    showToast('Audit log cleared');
  });

  // 6.4 — refresh the estimated spend readout whenever settings opens.
  document.getElementById('cost-meter-reset')?.addEventListener('click', async () => {
    await sendMessage({ action: 'cost-reset' });
    refreshCostMeter();
  });
  const chatStatus = document.getElementById('chat-status');

  async function runChatCommand() {
    const instruction = (chatInput?.value || '').trim();
    if (!instruction) return;
    if (!currentAnalysis?.issues?.length) { showToast('Run a scan first'); return; }

    chatStatus.classList.remove('hidden');
    chatStatus.textContent = 'Thinking…';
    chatSend.disabled = true;

    let res;
    try {
      res = await sendMessage({ action: 'chat-command', instruction, issues: currentAnalysis.issues });
    } catch (e) {
      chatStatus.textContent = e.message || 'Could not interpret that';
      chatSend.disabled = false;
      return;
    }
    chatSend.disabled = false;

    if (!res?.ok) { chatStatus.textContent = res?.error || 'Could not interpret that'; return; }

    const { plan, matchedIssueIds } = res;
    const matchedSet = new Set(matchedIssueIds || []);
    chatStatus.textContent = `${plan.summary || 'Understood.'} Matched ${matchedSet.size} issue${matchedSet.size === 1 ? '' : 's'}.`;

    // "list" just highlights what matched — filter the visible cards to it.
    document.querySelectorAll('#issues-list .issue-card').forEach(card => {
      card.classList.toggle('chat-dimmed', !matchedSet.has(card.dataset.issueId));
    });

    if (plan.action === 'apply' && matchedSet.size) {
      const targets = currentAnalysis.issues.filter(i => matchedSet.has(i.id));
      await applyFilteredIssues(targets);
    }
  }

  chatSend?.addEventListener('click', runChatCommand);
  chatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') runChatCommand(); });

  impairmentSelect?.addEventListener('change', async () => {
    try {
      await sendMessage({ action: 'impairment-apply', tabId: currentTabId, key: impairmentSelect.value || null });
    } catch { showToast('Could not apply simulation'); }
  });

  els.btnScan.addEventListener('click', handleScan);
  els.btnSettings.addEventListener('click', showSettings);
  els.btnBack.addEventListener('click', hideSettings);
  els.btnHighlight.addEventListener('click', toggleHighlights);
  els.btnLivePreview.addEventListener('click', toggleLivePreview);
  els.btnClear.addEventListener('click', clearHighlights);
  els.btnDetect.addEventListener('click', detectCapabilities);
  els.fixClose.addEventListener('click', closeFixModal);
  els.fixModal.addEventListener('click', (e) => {
    if (e.target === els.fixModal) closeFixModal();
  });

  // Fix Sandbox controls
  els.btnLivePreviewClose.addEventListener('click', closeLivePreview);
  els.btnApplyAllPatches.addEventListener('click', applyAllPatches);
  els.btnVerifyScore.addEventListener('click', verifyPatchedScore);
  els.btnUndoPatch.addEventListener('click', undoLastPatch);
  els.btnResetLivePreview.addEventListener('click', resetLivePreview);

  // Demo tier select — changes authPlan for UI preview purposes
  const demoTierSel = document.getElementById('demo-tier-select');
  if (demoTierSel) {
    // Sync initial value
    demoTierSel.value = authPlan || 'free';
    updateDemoTierStyle(demoTierSel, demoTierSel.value);
    demoTierSel.addEventListener('change', () => {
      authPlan = demoTierSel.value;
      updateDemoTierStyle(demoTierSel, authPlan);
      updatePlanBadge();
      refreshTabPaywalls();
    });
  }

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

  // Lighthouse button - switch to dedicated Lighthouse tab
  els.btnLighthouse?.addEventListener('click', () => {
    if (!currentAnalysis?.issues) {
      showToast('Run a scan first to see Lighthouse scores');
      return;
    }
    // ── Pro gate ──
    if (!requirePlan('lighthouse', 'Lighthouse')) return;
    switchTab('lighthouse');
  });

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

  // Provider change → rebuild model dropdown + clear status
  if (els.settingLlmProvider) {
    els.settingLlmProvider.addEventListener('change', () => {
      updateLlmProviderUI(els.settingLlmProvider.value);
      document.getElementById('llm-key-status').textContent = '';
    });
  }

  // Validate key on blur
  els.settingGeminiApiKey.addEventListener('blur', () => {
    const provider = els.settingLlmProvider?.value || 'gemini';
    const model    = els.settingLlmModel?.value || '';
    const key      = (els.settingGeminiApiKey.value || '').trim();
    validateLlmKey(provider, key, model);
  });

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

/* ═══════ Auth event binding ═══════ */

function bindAuthEvents() {
  // Auth tab switcher (Sign In / Sign Up)
  $$('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.authTab;
      $$('[data-auth-tab]').forEach(b => {
        b.classList.toggle('active', b.dataset.authTab === tab);
        b.setAttribute('aria-selected', b.dataset.authTab === tab ? 'true' : 'false');
      });
      document.getElementById('auth-form-signin')?.classList.toggle('hidden', tab !== 'signin');
      document.getElementById('auth-form-signup')?.classList.toggle('hidden', tab !== 'signup');
      document.getElementById('auth-error-signin')?.classList.add('hidden');
      document.getElementById('auth-error-signup')?.classList.add('hidden');
    });
  });

  // Password visibility toggles
  $$('.auth-pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁' : '🙈';
    });
  });

  // Sign In form submit
  document.getElementById('auth-form-signin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('auth-email-signin')?.value.trim();
    const password = document.getElementById('auth-password-signin')?.value;
    const errEl    = document.getElementById('auth-error-signin');
    const submitBtn = document.getElementById('btn-signin');
    if (!email || !password) return;
    setAuthLoading(submitBtn, true);
    if (errEl) errEl.classList.add('hidden');

    const result = await apiSignIn(email, password);
    setAuthLoading(submitBtn, false);

    if (!result.ok) {
      if (errEl) { errEl.textContent = result.error; errEl.classList.remove('hidden'); }
      return;
    }
    await saveAuthSession({ token: result.token, user: result.user, plan: result.plan });
    updatePlanBadge();
    hideAuthView();
    showToast(`Welcome back, ${result.user?.email || 'user'}! 🎉`);
  });

  // Sign Up form submit
  document.getElementById('auth-form-signup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('auth-email-signup')?.value.trim();
    const password = document.getElementById('auth-password-signup')?.value;
    const errEl    = document.getElementById('auth-error-signup');
    const submitBtn = document.getElementById('btn-signup');
    if (!email || !password) return;
    if (password.length < 8) {
      if (errEl) { errEl.textContent = 'Password must be at least 8 characters'; errEl.classList.remove('hidden'); }
      return;
    }
    setAuthLoading(submitBtn, true);
    if (errEl) errEl.classList.add('hidden');

    const result = await apiSignUp(email, password);
    setAuthLoading(submitBtn, false);

    if (!result.ok) {
      if (errEl) { errEl.textContent = result.error; errEl.classList.remove('hidden'); }
      return;
    }
    await saveAuthSession({ token: result.token, user: result.user, plan: result.plan || 'free' });
    updatePlanBadge();
    hideAuthView();
    showToast(`Account created! Welcome to SiteScope 360 🎉`);
  });

  // Continue free
  document.getElementById('btn-continue-free')?.addEventListener('click', () => {
    hideAuthView();
    showToast('Using free tier — 3 scans/day');
  });

  // Account button (header)
  document.getElementById('btn-account')?.addEventListener('click', showAccountModal);

  // Account modal close
  document.getElementById('account-modal-close')?.addEventListener('click', closeAccountModal);
  document.getElementById('account-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('account-modal')) closeAccountModal();
  });

  // Sign Out
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await clearAuthSession();
    closeAccountModal();
    updatePlanBadge();
    showToast('Signed out');
    // Don't force auth view — let them keep using free tier
  });

  // Paywall modal close
  document.getElementById('paywall-close')?.addEventListener('click', closePaywallModal);
  document.getElementById('paywall-dismiss')?.addEventListener('click', closePaywallModal);
  document.getElementById('paywall-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('paywall-modal')) closePaywallModal();
  });

  // Upgrade plan buttons (open checkout in new tab)
  document.getElementById('btn-upgrade-pro')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: CHECKOUT_URLS.pro });
  });
  // team plan removed — only Free and Pro
}

/** Show/hide loading spinner on an auth submit button */
function setAuthLoading(btn, loading) {
  if (!btn) return;
  const text    = btn.querySelector('.auth-btn-text');
  const spinner = btn.querySelector('.auth-btn-spinner');
  btn.disabled = loading;
  text?.classList.toggle('hidden', loading);
  spinner?.classList.toggle('hidden', !loading);
}

/* ═══════ Tab switching ═══════ */

function switchTab(tabName) {
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  $$('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));

  // Quick actions + filter pills + live preview panel are only relevant on the Issues tab
  const isIssues = tabName === 'issues';
  els.quickActions.classList.toggle('hidden', !isIssues);
  els.filterBar.classList.toggle('hidden', !isIssues);

  // Hide live preview panel when switching away from issues tab
  if (!isIssues && livePreviewActive) {
    els.livePreviewPanel.classList.add('hidden');
  } else if (isIssues && livePreviewActive) {
    els.livePreviewPanel.classList.remove('hidden');
  }

  if (tabName === 'export') loadHistory();
  if (tabName === 'tips') renderTips();
  if (tabName === 'checklist') renderChecklist();
  if (tabName === 'design') renderDesignTab();
  if (tabName === 'lighthouse') renderLighthouseTab();
  if (tabName === 'ux-perf') renderUXPerfTab();

  // Show/hide paywall overlay on pro-gated tabs
  refreshTabPaywalls();
}

/**
 * Insert (or show/hide) blur+pricing-card overlay on pro-gated tabs
 * based on the current authPlan (or demo tier select value).
 */
function refreshTabPaywalls() {
  const isPro = authPlan === 'pro' || authPlan === 'team';
  $$('[data-pro-tab]').forEach(tab => {
    let overlay = tab.querySelector('.tab-paywall-overlay');
    if (!overlay) {
      // Build overlay once
      overlay = document.createElement('div');
      overlay.className = 'tab-paywall-overlay';
      overlay.innerHTML = `
        <div class="overlay-pricing-card">
          <div class="opc-ribbon">🔒 Pro Feature</div>
          <div class="opc-title">Unlock with Pro</div>
          <div class="opc-price">$19 <span>/ mo</span></div>
          <ul class="opc-features">
            <li><span class="opc-feat-icon">✓</span> Unlimited scans</li>
            <li><span class="opc-feat-icon">✓</span> AI-powered fix suggestions</li>
            <li><span class="opc-feat-icon">✓</span> Technology insights</li>
            <li><span class="opc-feat-icon">✓</span> Business impact report</li>
            <li><span class="opc-feat-icon">✓</span> Lighthouse report</li>
            <li><span class="opc-feat-icon">✓</span> Export (JSON / PDF)</li>
          </ul>
          <a class="opc-cta" href="${CHECKOUT_URLS.pro}" target="_blank" rel="noopener">Request a Pro Demo →</a>
          <button class="opc-dismiss">Maybe later</button>
        </div>`;
      overlay.querySelector('.opc-dismiss')?.addEventListener('click', () => {
        overlay.classList.add('hidden');
      });
      tab.appendChild(overlay);
    }
    overlay.classList.toggle('hidden', isPro);
  });
}

/* ═══════ Design tab ═══════ */

/* Tech brand colours */
const TECH_COLORS = {
  // Frameworks
  'React':'#61dafb','Next.js':'#ffffff','Vue':'#42b883','Nuxt':'#00dc82',
  'Angular':'#dd0031','Svelte':'#ff3e00','Gatsby':'#663399','Remix':'#f44250',
  'Astro':'#ff5d01','SolidJS':'#2c4f7c','Ember':'#e04e39','Alpine.js':'#77c1d2',
  'htmx':'#36c','Qwik':'#ac7ef4',
  // Libraries
  'jQuery':'#0769ad','Lodash':'#3492ff','GSAP':'#88ce02',
  'GraphQL / Apollo':'#e10098','Axios':'#5a29e4','Moment.js':'#cacaca',
  'Day.js':'#f8c307','Three.js':'#049ef4','D3.js':'#f9a03c',
  'Swiper':'#0080ff','Lottie':'#00a2e8',
  // CSS
  'Tailwind CSS':'#38bdf8','Bootstrap':'#7952b3','Bulma':'#00d1b2',
  'Material UI':'#007fff','Ant Design':'#1677ff','Chakra UI':'#319795',
  'Sass / SCSS':'#cd6799','Less':'#1d365d','styled-components':'#db7093',
  // Build
  'Webpack':'#8dd6f9','Vite':'#bd34fe','Parcel':'#e0a22a','Rollup':'#ec4a37',
  'TypeScript':'#3178c6','Babel':'#f9dc3e','esbuild':'#ffcf00','Turbopack':'#ff6c37',
  // Platform
  'WordPress':'#21759b','Shopify':'#96bf48','Webflow':'#4353ff','Framer':'#0055ff',
  'Drupal':'#0678be','Joomla':'#f44321','Wix':'#faad00','Squarespace':'#222222',
  'Ghost':'#15171a','Contentful':'#2478cc','Storyblok':'#09b3af','Sanity':'#f03e2f',
  // Analytics
  'Google Analytics':'#e37400','Meta Pixel':'#0866ff','Mixpanel':'#7856ff',
  'PostHog':'#f76b15','Hotjar':'#fd3a5c','Segment':'#52bd94','Amplitude':'#196de3',
  'Intercom':'#286efa','Crisp':'#1972f5','Sentry':'#362d59','Datadog':'#774aa4',
  // Hosting
  'Vercel':'#ffffff','Netlify':'#00c7b7','Cloudflare':'#f6821f',
  'AWS':'#ff9900','Firebase':'#ffca28','Supabase':'#3ecf8e','jsDelivr / cdnjs':'#e84d3d',
};

const TECH_CATEGORY_ORDER = ['Framework','Library','CSS','Build','Platform','Analytics','Hosting'];
const TECH_CATEGORY_ICONS = {
  'Framework': '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  'Library':   '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  'CSS':       '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M18.66 5.34l1.41-1.41"/></svg>',
  'Build':     '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  'Platform':  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  'Analytics': '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  'Hosting':   '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
};

/**
 * Tech upgrade suggestions — keyed by detected tech name.
 * Each entry: { to, toColor, reason, gains[] }
 */
const TECH_UPGRADE_MAP = {
  // Frameworks
  'React': {
    to: 'Next.js', toColor: '#ffffff',
    reason: 'React alone has no server-side rendering. Next.js adds SSR/SSG, automatic code splitting and built-in image optimisation — typical LCP improvement of 30–60%.',
    gains: ['Server-side rendering', 'Built-in image optimisation', 'Automatic code splitting', 'Better Core Web Vitals']
  },
  'Vue': {
    to: 'Nuxt', toColor: '#00dc82',
    reason: 'Vue SPA sends all JS to the browser first. Nuxt adds SSR and static generation so pages load pre-rendered HTML — measurably faster FCP and SEO indexing.',
    gains: ['SSR / static generation', 'Faster FCP', 'SEO-friendly rendering', 'File-based routing']
  },
  'jQuery': {
    to: 'Vanilla JS or Alpine.js', toColor: '#77c1d2',
    reason: 'jQuery adds ~87 KB to every page load and forces synchronous DOM operations. Modern JS and Alpine.js achieve the same results with near-zero overhead.',
    gains: ['~87 KB bundle reduction', 'Faster Time-to-Interactive', 'No extra HTTP request', 'Tree-shakeable']
  },
  'Moment.js': {
    to: 'Day.js', toColor: '#f8c307',
    reason: 'Moment.js ships ~67 KB minified and is no longer actively maintained. Day.js is API-compatible at just 2 KB — a 97% bundle size reduction.',
    gains: ['67 KB → 2 KB (97% smaller)', 'Actively maintained', 'Same API surface', 'Tree-shakeable locales']
  },
  'Webpack': {
    to: 'Vite', toColor: '#bd34fe',
    reason: 'Webpack bundles everything upfront, causing slow dev starts and rebuilds. Vite uses native ES modules — dev server starts in <300 ms vs. seconds, and builds are 5–10× faster.',
    gains: ['<300ms dev server start', '5–10× faster builds', 'Native ESM hot reload', 'Smaller output bundles']
  },
  'Bootstrap': {
    to: 'Tailwind CSS', toColor: '#38bdf8',
    reason: 'Bootstrap ships ~150 KB of CSS including styles you never use. Tailwind purges unused classes at build time, resulting in final CSS files of 5–15 KB — a 10× reduction.',
    gains: ['~150 KB → ~10 KB CSS', 'No specificity conflicts', 'Design token consistency', 'Zero unused styles']
  },
  'Gatsby': {
    to: 'Next.js or Astro', toColor: '#ff5d01',
    reason: 'Gatsby\'s build times grow exponentially with content volume and ships heavy JS runtimes. Next.js and Astro offer partial hydration and incremental builds with far better performance scores.',
    gains: ['Faster incremental builds', 'Partial / zero hydration', 'Better Lighthouse scores', 'Smaller JS runtime']
  },
  'WordPress': {
    to: 'Headless WordPress + Next.js', toColor: '#ffffff',
    reason: 'Traditional WordPress renders pages server-side on every request and loads dozens of plugin scripts. A headless setup decouples the CMS from a static front-end — typical Lighthouse performance jumps from 40s to 90s.',
    gains: ['Lighthouse perf 40→90+', 'CDN-served static pages', 'Plugin JS eliminated', 'Full design control']
  },
  'Wix': {
    to: 'Webflow or custom stack', toColor: '#4353ff',
    reason: 'Wix injects large proprietary JS bundles and limits technical control. Migrating to Webflow or a custom stack typically improves performance scores by 20–40 points and removes vendor lock-in.',
    gains: ['20–40pt Lighthouse gain', 'No proprietary bloat', 'Full code ownership', 'Better SEO control']
  },
  'Squarespace': {
    to: 'Webflow or Astro', toColor: '#4353ff',
    reason: 'Squarespace bundles heavy template JS and restricts custom optimisations. A migration typically yields 30–50% faster page loads and full control over performance budgets.',
    gains: ['30–50% faster loads', 'Full performance control', 'No template overhead', 'Better Core Web Vitals']
  },
  'Lodash': {
    to: 'Native ES2020+ methods', toColor: '#22d3ee',
    reason: 'Lodash adds ~70 KB but most of its functions are now native in modern JS (optional chaining, Array.flat, Object.entries etc.). Replacing it eliminates the dependency entirely.',
    gains: ['~70 KB bundle reduction', 'Zero dependencies', 'Tree-shakeable alternatives', 'Faster parse time']
  },
  'Axios': {
    to: 'Native fetch + async/await', toColor: '#22d3ee',
    reason: 'Axios adds ~14 KB and wraps the native Fetch API. Modern browsers have full Fetch support — removing Axios saves the network request, parse time, and 14 KB of JS execution.',
    gains: ['14 KB bundle reduction', 'Zero dependencies', 'Native browser API', 'Smaller JS parse time']
  },
  'Hotjar': {
    to: 'PostHog (open-source)', toColor: '#f76b15',
    reason: 'Hotjar injects a synchronous tracking script that delays page interactivity. PostHog is open-source, privacy-first, self-hostable, and has no measurable impact on TTI.',
    gains: ['No TTI impact', 'Privacy-first / GDPR', 'Self-hostable', 'Product analytics included']
  },
  'Google Analytics': {
    to: 'Plausible or PostHog', toColor: '#f76b15',
    reason: 'GA4 adds ~45 KB and blocks the main thread during cookie consent resolution. Plausible is 1 KB, cookieless and GDPR-compliant with no consent banner needed.',
    gains: ['45 KB → 1 KB script', 'No consent banner needed', 'GDPR compliant', 'Faster TTI']
  },
  'Sass / SCSS': {
    to: 'CSS Custom Properties + PostCSS', toColor: '#38bdf8',
    reason: 'Sass requires a build step and outputs static CSS. Native CSS custom properties (variables) give you dynamic theming at runtime with zero build overhead and full browser support.',
    gains: ['Runtime theming', 'No build step needed', 'Smaller toolchain', 'Dynamic values in JS']
  },
};

/**
 * Render tech upgrade suggestions into the Technology tab.
 * Only shows items where the detected tech has a known upgrade path.
 */
function renderTechUpgrades(tech, container) {
  const suggestions = tech
    .map(item => {
      const upg = TECH_UPGRADE_MAP[item.name];
      if (!upg) return null;
      return { from: item.name, fromColor: TECH_COLORS[item.name] || '#888', ...upg };
    })
    .filter(Boolean);

  if (!suggestions.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="tu-section">
      <div class="tu-header">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        <span class="tu-header-title">Upgrade Opportunities</span>
        <span class="tu-header-badge">${suggestions.length}</span>
      </div>
      <div class="tu-cards">
        ${suggestions.map((s, i) => `
          <div class="tu-card" style="animation-delay:${i * 0.06}s">
            <div class="tu-arrow-row">
              <span class="tu-chip" style="background:${s.fromColor}18;color:${s.fromColor};border-color:${s.fromColor}33">${escHtml(s.from)}</span>
              <svg class="tu-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              <span class="tu-chip tu-chip-to" style="background:${s.toColor}18;color:${s.toColor};border-color:${s.toColor}33">${escHtml(s.to)}</span>
            </div>
            <div class="tu-reason">${escHtml(s.reason)}</div>
            <div class="tu-gains">
              ${s.gains.map(g => `<span class="tu-gain">✓ ${escHtml(g)}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
}

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

  // ── 1. Tech Stack (top) ──
  if (tech.length) {
    const grouped = {};
    for (const item of tech) {
      const cat = item.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item.name);
    }
    const catOrder = [...TECH_CATEGORY_ORDER, 'Other'];
    const sections = catOrder.filter(c => grouped[c]?.length);

    // Build a primary-framework hero line (first Framework item)
    const primaryFramework = grouped['Framework']?.[0] || grouped['Platform']?.[0] || null;
    const primaryColor = primaryFramework ? (TECH_COLORS[primaryFramework] || '#6366f1') : '#6366f1';

    els.designTechSection.innerHTML = `
      <div class="di-stack-card" style="--accent:${primaryColor}">
        <div class="di-stack-header">
          <div class="di-stack-title-row">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <span class="di-stack-title">Tech Stack</span>
            <span class="di-stack-count">${tech.length} detected</span>
          </div>
          ${primaryFramework ? `<div class="di-stack-primary" style="color:${primaryColor};border-color:${primaryColor}33;background:${primaryColor}12">${escHtml(primaryFramework)}</div>` : ''}
        </div>
        <div class="di-stack-accent-bar" style="background:linear-gradient(to right,${primaryColor},${primaryColor}44,transparent)"></div>
        <div class="di-stack-body">
          ${sections.map(cat => {
            const catColor = grouped[cat].reduce((_, t) => TECH_COLORS[t] || _, 'rgba(255,255,255,0.15)');
            return `
            <div class="di-stack-section">
              <div class="di-stack-cat-label">
                ${TECH_CATEGORY_ICONS[cat] || ''}
                <span>${cat}</span>
                <span class="di-stack-cat-count">${grouped[cat].length}</span>
              </div>
              <div class="di-stack-items">
                ${grouped[cat].map(t => {
                  const col = TECH_COLORS[t] || 'rgba(255,255,255,0.18)';
                  return `<div class="di-stack-item" style="--c:${col}" title="${escHtml(t)}">
                    <span class="di-stack-dot" style="background:${col};box-shadow:0 0 6px ${col}88"></span>
                    <span class="di-stack-name">${escHtml(t)}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  } else {
    els.designTechSection.innerHTML = '';
  }

  // ── 1b. Tech Upgrade Suggestions ──
  if (els.designUpgradesSection) renderTechUpgrades(tech, els.designUpgradesSection);

  // ── 2. Page Identity hero card ──
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

  // ── 4. Colour palette ──
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

  // ── 5. Typography ──
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

  // ── 6. CSS Design Tokens ──
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

  // ── 7. Page Health (SEO signals) ──
  const seo = d.seoSignals || {};
  if (Object.keys(seo).length) {
    const signals = [
      { label: 'HTTPS',         ok: seo.hasHTTPS,      tip: 'Page is served over a secure connection' },
      { label: 'Meta desc',     ok: seo.hasDescription, tip: 'Page has a meta description for search snippets' },
      { label: 'Canonical',     ok: seo.hasCanonical,   tip: seo.canonical || 'Canonical URL declared' },
      { label: 'Lang attr',     ok: seo.hasLang,        tip: 'html[lang] set — required for screen readers' },
      { label: 'Viewport',      ok: seo.hasViewport,    tip: 'Viewport meta tag present — enables responsive layout' },
      { label: 'OG image',      ok: seo.hasOgImage,     tip: seo.ogImage || 'Open Graph image for social sharing' },
      { label: 'CSP',           ok: seo.csp,            tip: 'Content Security Policy meta tag present' },
    ];
    const ogImg = seo.ogImage;
    els.designPageHealthSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Page Health
          </span>
          <span class="di-badge" style="background:${signals.filter(s=>s.ok).length===signals.length?'var(--green)18':'var(--orange)18'};color:${signals.filter(s=>s.ok).length===signals.length?'var(--green)':'var(--orange)'}">
            ${signals.filter(s=>s.ok).length}/${signals.length}
          </span>
        </div>
        ${ogImg ? `<div class="di-og-preview"><img src="${escHtml(ogImg)}" alt="OG image" onerror="this.parentNode.style.display='none'"><span class="di-og-label">og:image</span></div>` : ''}
        <div class="di-health-grid">
          ${signals.map(s => `
            <div class="di-health-item ${s.ok ? 'ok' : 'fail'}" title="${escHtml(s.tip)}">
              <span class="di-health-dot"></span>
              <span class="di-health-label">${escHtml(s.label)}</span>
            </div>`).join('')}
        </div>
        ${seo.structuredData?.length ? `
          <div class="di-health-extra">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Structured data: ${seo.structuredData.map(t => escHtml(t)).join(', ')}
          </div>` : ''}
        ${seo.robotsMeta ? `<div class="di-health-extra">🤖 robots: <code>${escHtml(seo.robotsMeta)}</code></div>` : ''}
      </div>`;
  } else {
    els.designPageHealthSection.innerHTML = '';
  }

  // ── 8. Analytics & Tracking ──
  const analyticsItems = tech.filter(t => t.category === 'Analytics');
  if (analyticsItems.length) {
    els.designAnalyticsSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Analytics & Tracking
          </span>
          <span class="di-badge">${analyticsItems.length}</span>
        </div>
        <div class="di-inline-chips">
          ${analyticsItems.map(t => {
            const col = TECH_COLORS[t.name] || 'rgba(255,255,255,0.18)';
            return `<span class="di-chip-pill" style="--c:${col}">${escHtml(t.name)}</span>`;
          }).join('')}
        </div>
        ${analyticsItems.some(t => ['Meta Pixel','Hotjar'].includes(t.name)) ? `
          <div class="di-health-extra" style="color:var(--orange)">
            ⚠️ User-tracking pixels detected — ensure your privacy policy is up to date
          </div>` : ''}
      </div>`;
  } else {
    els.designAnalyticsSection.innerHTML = '';
  }

  // ── 9. Hosting & Infrastructure ──
  const hostItems    = tech.filter(t => t.category === 'Hosting');
  const buildItems   = tech.filter(t => t.category === 'Build');
  if (hostItems.length || buildItems.length) {
    const mkChips = (items) => items.map(t => {
      const col = TECH_COLORS[t.name] || 'rgba(255,255,255,0.18)';
      return `<span class="di-chip-pill" style="--c:${col}">${escHtml(t.name)}</span>`;
    }).join('');
    els.designHostingSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            Hosting & Build
          </span>
          <span class="di-badge">${hostItems.length + buildItems.length}</span>
        </div>
        ${hostItems.length ? `<div class="di-infra-row"><span class="di-infra-label">Hosting</span><div class="di-inline-chips">${mkChips(hostItems)}</div></div>` : ''}
        ${buildItems.length ? `<div class="di-infra-row"><span class="di-infra-label">Build</span><div class="di-inline-chips">${mkChips(buildItems)}</div></div>` : ''}
      </div>`;
  } else {
    els.designHostingSection.innerHTML = '';
  }

  // ── 10. Typography Scale ──
  const typeSizes = d.typeSizes || [];
  if (typeSizes.length) {
    els.designTypeScaleSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
            Type Scale
          </span>
          <span class="di-badge">${typeSizes.length} sizes</span>
        </div>
        <div class="di-typescale-list">
          ${typeSizes.map((sz, i) => {
            const px = parseFloat(sz);
            const previewSz = Math.max(10, Math.min(px, 28));
            return `
              <div class="di-typescale-row">
                <span class="di-typescale-sample" style="font-size:${previewSz}px">Aa</span>
                <span class="di-typescale-val">${sz}</span>
                ${i === 0 ? '<span class="di-typescale-tag">largest</span>' : i === typeSizes.length - 1 ? '<span class="di-typescale-tag">smallest</span>' : ''}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  } else {
    els.designTypeScaleSection.innerHTML = '';
  }

  // ── 11. Page Stats ──
  const ps = d.pageStats || {};
  if (Object.keys(ps).length) {
    const stats = [
      { icon: '🖼', label: 'Images',        val: ps.images,       sub: ps.lazyImages ? `${ps.lazyImages} lazy` : '' },
      { icon: '⚙️', label: 'Scripts',       val: ps.scripts       },
      { icon: '🎨', label: 'Stylesheets',   val: ps.stylesheets   },
      { icon: '🔗', label: 'Links',         val: ps.links,        sub: ps.externalLinks ? `${ps.externalLinks} ext` : '' },
      { icon: '📐', label: 'DOM nodes',     val: ps.domNodes,     sub: ps.domNodes > 1500 ? '⚠ large DOM' : '' },
      { icon: '📝', label: 'Forms',         val: ps.forms         },
      { icon: '🔘', label: 'Buttons',       val: ps.buttons       },
      { icon: '📑', label: 'Headings',      val: ps.headings,     sub: ps.h1Count !== 1 ? `⚠ ${ps.h1Count} H1s` : '1 H1 ✓' },
      { icon: '🪟', label: 'iFrames',       val: ps.iframes       },
    ].filter(s => s.val !== undefined);
    els.designPageStatsSection.innerHTML = `
      <div class="di-card">
        <div class="di-card-header">
          <span class="di-card-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Page Stats
          </span>
        </div>
        <div class="di-pagestats-grid">
          ${stats.map(s => `
            <div class="di-pagestat-item">
              <span class="di-pagestat-icon">${s.icon}</span>
              <span class="di-pagestat-val">${s.val}</span>
              <span class="di-pagestat-label">${escHtml(s.label)}</span>
              ${s.sub ? `<span class="di-pagestat-sub ${s.sub.includes('⚠') ? 'warn' : ''}">${escHtml(s.sub)}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  } else {
    els.designPageStatsSection.innerHTML = '';
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

/* ═══════ Live Preview Mode ═══════ */

async function toggleLivePreview() {
  if (!currentAnalysis?.issues) {
    showToast('Run a scan first to enable AI Preview');
    return;
  }

  // ── Pro gate ──
  if (!requirePlan('livePreview', 'AI Preview')) return;

  if (livePreviewActive) {
    closeLivePreview();
  } else {
    openLivePreview();
  }
}

async function openLivePreview() {
  livePreviewActive = true;
  els.livePreviewPanel.classList.remove('hidden');
  els.btnLivePreview.classList.add('active');
  els.btnLivePreview.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> Sandbox <span style="font-size:9px;opacity:0.8">ON</span>';
  
  // Load any existing patches from storage
  await loadLivePreviewPatches();
  updateLivePreviewUI();
  
  showToast('AI Preview enabled — apply fixes live!');
}

function closeLivePreview() {
  livePreviewActive = false;
  els.livePreviewPanel.classList.add('hidden');
  els.btnLivePreview.classList.remove('active');
  els.btnLivePreview.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> AI Preview';
}

async function applyPatch(issue, fix, { skipVerify = false } = {}) {
  try {
    // Convert the fix's before/after code into DOM changes
    const changes = extractDOMChanges(fix, issue);

    console.log(`[applyPatch] ${issue.id}: ${changes.length} changes to apply for ${issue.selectors?.length || 0} affected nodes`);
    for (const c of changes) {
      console.log(`  → [${c.type}] selector="${c.selector}" attr=${c.attribute || '-'} val=${(c.value || '').substring(0, 60)}`);
    }

    if (changes.length === 0) {
      showToast('⚠️ Could not extract DOM changes from this fix');
      return;
    }
    
    // Apply each change to the page via content script
    let anyApplied = false;
    let failedChanges = 0;
    for (const change of changes) {
      const response = await sendToContentScript(currentTabId, {
        type: 'apply-patch',
        change,
        patchId: change.id || `patch-${Date.now()}`
      });

      if (response?.ok && response.applied > 0) {
        anyApplied = true;
        livePreviewPatches.push({
          id: `patch-${Date.now()}-${Math.random()}`,
          issueId: issue.id,
          issueTitle: issue.title,
          change,
          timestamp: Date.now()
        });
      } else if (response?.ok && response.applied === 0) {
        failedChanges++;
        console.warn(`[applyPatch] Selector matched but 0 elements patched:`, change);
      } else {
        failedChanges++;
        console.warn(`[applyPatch] Patch failed:`, response?.error, change);
      }
    }

    if (!anyApplied) {
      showToast('⚠️ Patch could not be applied — selector may not match this page');
      return;
    }
    
    // Save patches to storage
    await saveLivePreviewPatches();
    updateLivePreviewUI();
    renderPatchList();
    
    // Mark this issue as patched and update button states
    patchedIssueIds.add(issue.id);
    await savePatchedIssueIds();
    updateSuggestButtonStates();

    // ── Mark patched elements green on the live page ──
    sendToContentScript(currentTabId, {
      type: 'mark-patched',
      selectors: issue.selectors || [],
      issueNum: String((currentAnalysis?.issues?.indexOf(issue) ?? -1) + 1),
      issueTitle: issue.title || issue.id
    }).catch(() => {/* content script may not be injected yet */});
    
    const totalChanges = changes.length;
    const successChanges = totalChanges - failedChanges;
    const nodeInfo = totalChanges > 1 ? ` (${successChanges}/${totalChanges} elements)` : '';
    showToast(`✓ Patch applied for: ${issue.title}${nodeInfo}`);

    // Show verify button
    if (els.btnVerifyScore) els.btnVerifyScore.classList.remove('hidden');

    // Auto-verify score after applying patch (skip during batch apply)
    if (!skipVerify) {
      // Small delay to let DOM mutations settle before axe re-scan
      await new Promise(r => setTimeout(r, 300));
      await verifyPatchedScore();
    }
  } catch (err) {
    console.error('Error in applyPatch:', err);
    showToast(`Failed to apply patch: ${err.message}`);
  }
}

/**
 * Confidence gate (mirrors autonomyFor in lib/llm-router.js, which the popup
 * cannot import — it is a classic script, not a module).
 *   >= 0.9  apply without asking
 *   >= 0.7  apply, but flag for review
 *   below   propose only; never touch the page
 */
async function refreshCostMeter() {
  const amountEl = document.getElementById('cost-meter-amount');
  if (!amountEl) return;
  try {
    const res = await sendMessage({ action: 'cost-get' });
    if (res?.ok) amountEl.textContent = res.formatted;
  } catch { /* non-critical display */ }
}

function autonomyFor(fix) {
  const c = typeof fix?.confidence === 'number' ? fix.confidence : 0;
  if (c >= 0.9) return 'auto';
  if (c >= 0.7) return 'flag';
  return 'propose';
}

/**
 * Record one immutable fact about what was done to the page.
 *
 * Fire-and-forget: a failure to write the log must never block or fail the fix
 * the user asked for. The log is a record of work, not a gate on it.
 */
function recordAudit(event, issue, fix, extra = {}) {
  try {
    sendMessage({
      action: 'audit-append',
      entry: {
        event,
        issueId: issue?.id,
        ruleId: issue?.ruleId || issue?.id || '',
        pageUrl: currentAnalysis?.metadata?.url || '',
        summary: fix?.fixTitle || '',
        source: fix?.source || '',
        confidence: typeof fix?.confidence === 'number' ? fix.confidence : null,
        autonomy: fix ? autonomyFor(fix) : '',
        ...extra
      }
    });
  } catch { /* logging must never break remediation */ }
}

/**
 * Crawl the current site.
 *
 * Permissions are requested here rather than declared up front: most users never
 * crawl, and a broad host-permission prompt at install is the single biggest
 * driver of abandonment for an extension whose pitch is privacy.
 */
async function runSiteCrawl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let origin;
  try { origin = new URL(tab.url).origin; }
  catch { showToast('Open a website first'); return; }

  const granted = await chrome.permissions.request({
    permissions: ['tabs'],
    origins: [`${origin}/*`]
  }).catch(() => false);
  if (!granted) { showToast('Site scanning needs permission for this site'); return; }

  showToast('Looking for a sitemap…');
  const found = await sendMessage({ action: 'crawl-discover', origin, limit: 25 });
  const urls = found?.urls || [];
  if (!urls.length) { showToast('No sitemap found for this site'); return; }

  showToast(`Scanning ${urls.length} pages — this runs in background tabs`, 4000);
  const res = await sendMessage({ action: 'crawl-scan', urls });
  const sum = res?.summary;
  if (!sum) { showToast('Crawl failed'); return; }

  downloadFile(brand(renderCrawlReport(sum)), `site-scan-${new Date().toISOString().slice(0,10)}.md`, 'text/markdown');
  showToast(`Scanned ${sum.pagesScanned} pages · ${sum.totals.issues} issues`);
}

function renderCrawlReport(s) {
  const lines = [
    '# Site accessibility scan', '',
    `Pages scanned: ${s.pagesScanned}`,
    `Pages that could not be scanned: ${s.pagesFailed}`,
    s.averageScore !== null ? `Average score: ${s.averageScore}/100` : '',
    `Total issues: ${s.totals.issues} (critical ${s.totals.critical}, serious ${s.totals.serious}, moderate ${s.totals.moderate}, minor ${s.totals.minor})`,
    '', '## Most widespread problems', '',
    'A rule failing across many pages is usually one systemic fix, not many separate ones.', ''
  ];
  for (const r of s.commonRules) lines.push(`- **${r.ruleId}** — on ${r.pageCount} page${r.pageCount > 1 ? 's' : ''}`);
  lines.push('', '## Pages needing most attention', '');
  for (const p of s.worstPages) lines.push(`- ${p.url} — ${p.issueCount} issues${p.critical ? ` (${p.critical} critical)` : ''}`);
  if (s.failed.length) {
    lines.push('', '## Not scanned', '');
    for (const f of s.failed) lines.push(`- ${f.url} — ${f.error}`);
  }
  lines.push('', 'Automated testing covers roughly a third of WCAG success criteria. This is a record of what was checked automatically, not a conformance statement.');
  return lines.filter(l => l !== '').join('\n');
}

/* ═══════ Self-verifying remediation loop ═══════ */

/** Does this rule still appear in a verified analysis? */
function _ruleStillPresent(analysis, issue) {
  const target = issue.ruleId || issue.id;
  return (analysis?.issues || []).some(i => (i.ruleId || i.id) === target);
}

/**
 * Fix one issue and prove it worked.
 *
 *   generate → apply → re-scan → cleared?  ─ yes ─▶ done
 *                                   │
 *                                   no
 *                                   ▼
 *                        undo, tell the model what failed, retry
 *
 * Every primitive here already existed and was driven by hand. The loop is what
 * turns "here is a suggestion" into "31 of 34 fixed, and here is why the rest
 * need a person". A failed attempt is undone before the next one so attempts
 * never stack on top of each other.
 *
 * Returns { ok, fix, attempts, reason }.
 */
async function remediateIssue(issue, { maxAttempts = 3, onProgress = null } = {}) {
  const pageUrl = currentAnalysis?.metadata?.url || '';
  const attempts = [];

  for (let n = 1; n <= maxAttempts; n++) {
    onProgress?.({ phase: 'generating', attempt: n, maxAttempts });

    let response;
    try {
      response = await sendMessage({
        action: 'fix',
        issue,
        pageUrl,
        tabId: currentTabId,
        designInfo: currentAnalysis?.designInfo || null,
        attempts
      });
    } catch (err) {
      return { ok: false, attempts, reason: `Could not generate a fix: ${err.message}` };
    }

    const fix = response?.ok ? response.fix : null;
    if (!fix || !fix.after) {
      return { ok: false, attempts, reason: 'No code fix could be generated for this issue.' };
    }

    onProgress?.({ phase: 'applying', attempt: n, maxAttempts, fix });
    await applyPatch(issue, fix, { skipVerify: true });
    recordAudit('applied', issue, fix);

    // Let DOM mutations settle before axe reads the tree again.
    await new Promise(r => setTimeout(r, 300));

    onProgress?.({ phase: 'verifying', attempt: n, maxAttempts, fix });
    let verify;
    try {
      verify = await sendMessage({ action: 'verify-patches', tabId: currentTabId });
    } catch (err) {
      return { ok: false, attempts, reason: `Could not verify the fix: ${err.message}` };
    }

    if (!verify?.ok || !verify.analysis) {
      return { ok: false, attempts, reason: verify?.error || 'Verification did not return a result.' };
    }

    if (!_ruleStillPresent(verify.analysis, issue)) {
      onProgress?.({ phase: 'verified', attempt: n, maxAttempts, fix });
      verifiedIssueIds.add(issue.id);
      suggestionCache.set(issue.id, fix);
      recordAudit('verified', issue, fix, { attempts: attempts.length + 1 });
      return { ok: true, fix, attempts: attempts.length + 1, verified: true };
    }

    // Still failing — roll back so the next attempt starts from a clean page.
    onProgress?.({ phase: 'retrying', attempt: n, maxAttempts, fix });
    recordAudit('failed', issue, fix, { attempts: attempts.length + 1 });
    await undoLastPatch();
    recordAudit('undone', issue, fix);
    attempts.push({ fix, failure: 'the violation was still reported after re-scanning' });
  }

  return {
    ok: false,
    attempts,
    reason: `Tried ${attempts.length} different fixes; the violation was still reported each time. This one needs a person.`
  };
}

/**
 * Verify patched score — lightweight re-run of axe on the patched DOM.
 * Updates the score card in-place so the user can see the improvement.
 */
async function verifyPatchedScore() {
  const btn = els.btnVerifyScore;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Verifying…';
  }

  try {
    const response = await sendMessage({ action: 'verify-patches', tabId: currentTabId });

    if (!response?.ok || !response.analysis) {
      throw new Error(response?.error || 'Verify failed');
    }

    // oldAxeScore = the raw axe score from the last scan/verify
    const oldAxeScore = currentAnalysis?.auditScore || 0;
    // originalAxeScore = the very first scan — never changes across multiple verifies
    const originalAxeScore = currentAnalysis?._originalAxeScore ?? oldAxeScore;
    const newAxeScore = response.analysis.auditScore || 0;
    const axeDelta = newAxeScore - oldAxeScore; // improvement vs last state

    // ── REGRESSION GUARD ──────────────────────────────────────────────────────
    // Compare against the ORIGINAL scan baseline so repeated verifies don't
    // accumulate errors. If the new axe score is worse than the very first scan,
    // the patch introduced real new violations — auto-undo it.
    if (newAxeScore < originalAxeScore) {
      showToast(
        `⚠️ Patch introduced new violations (axe: ${originalAxeScore} → ${newAxeScore}). Auto-undoing…`,
        4000
      );
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Verify Score`;
      }
      await undoLastPatch();
      return;
    }
    // ── END REGRESSION GUARD ──────────────────────────────────────────────────

    // Capture old issue IDs before overwriting currentAnalysis
    const oldIssueIds = new Set((currentAnalysis?.issues || []).map(i => i.id));

    // Preserve metadata across verify
    const designInfo = currentAnalysis?.designInfo || null;
    const lockedOriginalAxeScore = originalAxeScore; // keep across overwrite
    currentAnalysis = response.analysis;
    currentAnalysis.designInfo = designInfo;
    currentAnalysis._originalAxeScore = lockedOriginalAxeScore; // never reset until rescan

    // Any patched issue that is absent from this fresh scan is now *proven* fixed,
    // not merely edited. This is the only place verification is granted.
    const stillPresent = new Set((currentAnalysis.issues || []).map(i => i.id));
    for (const id of oldIssueIds) {
      if (!stillPresent.has(id) && patchedIssueIds.has(id)) {
        verifiedIssueIds.add(id);
        recordAudit('verified', { id, ruleId: id }, suggestionCache.get(id));
      }
    }

    // ── SCORE DISPLAY ─────────────────────────────────────────────────────────
    // The displayed score may be the Lighthouse-upgraded value (e.g. 71) while
    // the raw axe score is lower (e.g. 49). Animating 71→53 looks like a drop
    // even when the patch improved things. Instead, shift the DISPLAYED score
    // by the same delta as the axe improvement so the visual always moves in
    // the right direction.
    const displayedScore = parseInt(els.scoreNumber.textContent, 10) || oldAxeScore;
    const newDisplayedScore = Math.max(0, Math.min(100, displayedScore + axeDelta));
    animateCounter(els.scoreNumber, displayedScore, newDisplayedScore, 600);

    setTimeout(() => {
      els.scoreArc.setAttribute('stroke-dasharray', `${newDisplayedScore}, 100`);
    }, 50);

    // Score color — based on displayed value (which may be Lighthouse-based)
    if (newDisplayedScore >= 90) els.scoreArc.style.stroke = 'var(--green)';
    else if (newDisplayedScore >= 70) els.scoreArc.style.stroke = 'var(--orange)';
    else els.scoreArc.style.stroke = 'var(--red)';

    // Grade
    const grade = getGrade(newDisplayedScore, currentAnalysis?.counts);
    els.scoreGrade.textContent = grade.label;
    els.scoreGrade.className = `score-grade ${grade.class}`;

    // Source badge
    els.scoreSource.textContent = lighthouseData?.accessibility ? '✦ Lighthouse (patched)' : 'axe-core (patched)';
    els.scoreSource.className = `score-source ${lighthouseData?.accessibility ? 'lighthouse' : 'axe'}`;
    els.scoreSource.classList.remove('hidden');

    // Summary text
    const total = response.analysis.totalViolations || 0;
    const passes = response.analysis.totalPasses || 0;
    els.scoreSummary.textContent = `${total} issue${total !== 1 ? 's' : ''} found · ${passes} checks passed`;

    // Compliance status
    const status = response.analysis.complianceStatus || 'Unknown';
    els.scoreStatus.textContent = status;
    els.scoreStatus.className = 'score-status ' + status.toLowerCase().replace(/\s+/g, '-');

    // Severity badges
    const counts = response.analysis.counts || {};
    els.badgeCritical.textContent = `${counts.critical || 0} Critical`;
    els.badgeSerious.textContent = `${counts.serious || 0} Serious`;
    els.badgeModerate.textContent = `${counts.moderate || 0} Moderate`;
    els.badgeMinor.textContent = `${counts.minor || 0} Minor`;

    // Score breakdown
    renderScoreBreakdown(newAxeScore, null);

    // ── Re-render the issue list with the updated analysis ──
    const newIssueIds = new Set((response.analysis.issues || []).map(i => i.id));
    const resolvedIds = [...oldIssueIds].filter(id => !newIssueIds.has(id));

    const newIssues = currentAnalysis.issues || [];
    els.issueCount.textContent = `(${newIssues.length})`;
    els.issuesList.innerHTML = '';
    if (newIssues.length === 0) {
      els.issuesList.innerHTML = `
        <li class="no-issues">
          <div class="no-issues-icon">${SVG.checkCircle}</div>
          <div class="no-issues-text">All Issues Fixed!</div>
          <div class="no-issues-sub">No accessibility issues remaining</div>
        </li>`;
      // (celebration animation removed — this is a compliance tool)
    } else {
      newIssues.forEach((issue, idx) => {
        els.issuesList.appendChild(createIssueCard(issue, idx));
      });
    }

    // Toast — reference displayed score delta so it matches what the user sees
    const resolvedMsg = resolvedIds.length > 0 ? ` · ${resolvedIds.length} issue${resolvedIds.length !== 1 ? 's' : ''} resolved` : '';
    if (axeDelta > 0) {
      showToast(`🎉 Score improved: ${displayedScore} → ${newDisplayedScore} (+${axeDelta})${resolvedMsg}`);
    } else if (axeDelta === 0 && resolvedIds.length > 0) {
      showToast(`✓ ${resolvedIds.length} issue${resolvedIds.length !== 1 ? 's' : ''} resolved — score maintained at ${newDisplayedScore}${resolvedMsg}`);
    } else {
      showToast(`Score unchanged at ${newDisplayedScore}. Try applying more fixes.`);
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Verify Score`;
    }
  } catch (err) {
    console.error('Verify failed:', err);
    showToast(`Verify failed: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Verify Score`;
    }
  }
}

function extractDOMChanges(fix, issue) {
  const ruleId = issue.id || '';

  // ── Collect ALL selectors for this violation ──
  // Each violation rule can affect multiple DOM nodes; we must patch every one
  // so axe removes the entire rule on re-scan (score only changes when a full
  // violation rule is cleared, not when individual nodes are fixed).
  const allSelectors = (issue.selectors || []).filter(Boolean);
  const allHtml = issue.html || [];

  // Page-level rules often have empty selectors — use a sensible default
  const pageRuleSelectors = {
    'html-has-lang': 'html',
    'html-lang-valid': 'html',
    'document-title': 'head',
    'meta-viewport': 'meta[name="viewport"]',
    'frame-title': 'iframe:not([title])',
    'bypass': 'body',
    'landmark-one-main': 'body > div:not([role]):not(header):not(footer):not(nav):not(aside)',
    'region': 'body',
    'page-has-heading-one': 'body',
  };

  // Ensure we have at least one selector
  if (allSelectors.length === 0) {
    const fallback = pageRuleSelectors[ruleId] || issue.target?.[0]?.selector;
    if (fallback) allSelectors.push(fallback);
  }

  if (allSelectors.length === 0) {
    console.warn('[extractDOMChanges] No selectors found for issue:', ruleId);
    return [];
  }

  // For _patchHint 'insertAdjacent' and 'childRole' (operate on a single parent, not per-node), only apply once.
  // 'attribute' is intentionally NOT here — each node re-derives its own parent selector.
  // CSS and insertAdjacentWithAttr apply per-node.
  const singleShotHints = new Set(['insertAdjacent', 'childRole']);

  // Generate changes for each affected node
  const allChanges = [];
  const selectorCount = allSelectors.length;

  for (let nodeIdx = 0; nodeIdx < Math.max(selectorCount, 1); nodeIdx++) {
    let selector = allSelectors[nodeIdx] || allSelectors[0];

    // Fix up page-level selectors
    if (!selector || selector === 'html') {
      selector = pageRuleSelectors[ruleId] || selector;
    }
    if (!selector) continue;

    // For single-shot hints (page-level inserts, CSS), only generate once
    if (nodeIdx > 0 && fix._patchHint && singleShotHints.has(fix._patchHint)) break;
    // insertAdjacentWithAttr: insert once but set attrs on all nodes
    // (handled inside the _patchHint block below)

    // Use the per-node HTML if available, otherwise fall back to fix.before/after
    const nodeHtml = allHtml[nodeIdx] || '';

    const changes = _extractDOMChangesForNode(fix, issue, ruleId, selector, nodeHtml, nodeIdx, selectorCount);
    allChanges.push(...changes);
  }

  console.log(`[extractDOMChanges] ${ruleId}: ${allChanges.length} total changes for ${selectorCount} node(s)`, allChanges);
  return allChanges;
}

/**
 * Extract DOM changes for a single node (selector) within a violation.
 * Called once per affected element to ensure all nodes get patched.
 */
function _extractDOMChangesForNode(fix, issue, ruleId, selector, nodeHtml, nodeIdx, totalNodes) {
  const changes = [];

  const afterCode = fix.after || '';
  const beforeCode = fix.before || '';

  // ── Priority 0: Use _patchHint from deterministic handlers ──
  // These have exact instructions on how to apply the fix.
  // Some are single-shot (insertAdjacent for page-level), others per-node (css, attrs).

  if (fix._patchHint === 'css' && fix._cssChanges) {
    // CSS changes apply per-node (e.g. color-contrast on each element)
    for (const cssChange of fix._cssChanges) {
      changes.push({
        type: PATCH_TYPE.CSS,
        selector,
        property: cssChange.property,
        value: cssChange.value,
        id: `${ruleId}-css-${cssChange.property}-n${nodeIdx}-${Date.now()}`
      });
    }
    return changes;
  }

  if (fix._patchHint === 'insertAdjacent' && fix._insertHTML) {
    // Page-level inserts (document-title, bypass, h1) — only once (nodeIdx===0)
    if (nodeIdx === 0) {
      changes.push({
        type: 'insertAdjacent',
        selector: fix._insertSelector || selector,
        position: fix._insertPosition || 'beforebegin',
        value: fix._insertHTML,
        id: `${ruleId}-insert-${Date.now()}`
      });
    }
    return changes;
  }

  if (fix._patchHint === 'insertAdjacentWithAttr') {
    // For rules like 'label' and 'select-name', each node needs its own insert.
    // Re-derive per-node attribute values and insert HTML.
    if (fix._attrChanges) {
      for (const ac of fix._attrChanges) {
        // For 'id' attribute, make it unique per node
        let attrValue = ac.value;
        if (ac.attribute === 'id' && nodeIdx > 0) {
          attrValue = `${ac.value}-${nodeIdx + 1}`;
        }
        changes.push({
          type: PATCH_TYPE.ATTRIBUTE,
          selector,
          attribute: ac.attribute,
          value: attrValue,
          id: `${ruleId}-attr-${ac.attribute}-n${nodeIdx}-${Date.now()}`
        });
      }
    }
    // Insert adjacent HTML for EACH node (e.g. each input needs its own <label>)
    if (fix._insertHTML) {
      let insertHTML = fix._insertHTML;
      // Update the 'for' attribute in the label to match the per-node id
      if (nodeIdx > 0 && fix._attrChanges?.some(ac => ac.attribute === 'id')) {
        const idChange = fix._attrChanges.find(ac => ac.attribute === 'id');
        const newId = `${idChange.value}-${nodeIdx + 1}`;
        insertHTML = insertHTML.replace(/for="[^"]*"/, `for="${newId}"`);
        // Also derive a better label from the node's HTML if available
        if (nodeHtml) {
          const nameMatch = nodeHtml.match(/name\s*=\s*["']([^"']*)["']/i);
          if (nameMatch) {
            const labelText = nameMatch[1].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
            insertHTML = insertHTML.replace(/>([^<]*)<\/label>/i, `>${labelText}</label>`);
          }
        }
      }
      changes.push({
        type: 'insertAdjacent',
        selector,
        position: fix._insertPosition || 'beforebegin',
        value: insertHTML,
        id: `${ruleId}-insert-n${nodeIdx}-${Date.now()}`
      });
    }
    return changes;
  }

  // Handle _patchHint: 'childRole' — add role to direct children of parent
  if (fix._patchHint === 'childRole' && fix._parentSelector && fix._childRole) {
    if (nodeIdx === 0) {
      changes.push({
        type: 'childRole',
        selector: fix._parentSelector,
        childRole: fix._childRole,
        id: `${ruleId}-childRole-${Date.now()}`
      });
    }
    return changes;
  }

  // Handle _patchHint: 'attribute' — each node derives its own target selector
  if (fix._patchHint === 'attribute' && fix._fallbackAttr) {
    // _fallbackSelector is computed from node 0's selector in the LLM router.
    // For nodes beyond the first, re-derive the parent selector from THIS node's selector
    // so every li gets its own parent container patched (not just node 0's parent).
    let targetSel;
    if (nodeIdx === 0) {
      // Use the pre-computed fallback, guarding against empty result
      targetSel = fix._fallbackSelector || selector;
    } else {
      // Re-derive parent selector from this node's selector using the same strip logic
      targetSel = selector
        ? (selector.replace(/ ?[>+~] ?li[^,]*$/i, '').replace(/ li[^,]*$/i, '').trim() || selector)
        : selector;
    }
    changes.push({
      type: PATCH_TYPE.ATTRIBUTE,
      selector: targetSel,
      attribute: fix._fallbackAttr,
      value: fix._fallbackValue || '',
      id: `${ruleId}-fallback-${fix._fallbackAttr}-n${nodeIdx}-${Date.now()}`
    });
    return changes;
  }

  // Skip fixes that are CSS comments, multi-line HTML restructuring, or empty
  if (!afterCode || afterCode.startsWith('/*') || afterCode.startsWith('<!--')) {
    console.log('[extractDOMChanges] Skipping non-applicable after code:', afterCode.substring(0, 80));
    return changes;
  }

  // ── Multi-node strategy: For nodes beyond the first, re-derive the fix ──
  // The fix.before/after are for the FIRST node. For subsequent nodes, we know
  // WHAT attribute changed (from diffing before/after), and apply the same
  // attribute change to each node's selector directly.
  // This is critical: axe won't clear a violation rule until ALL nodes are fixed.

  // Helper: extract attr pattern from the original fix (what changed)
  const _inferAttrPatternFromFix = () => {
    const parseA = (html) => {
      const map = {};
      const re = /([\w-]+)\s*=\s*["']([^"']*)["']/g;
      let m;
      while ((m = re.exec(html)) !== null) map[m[1].toLowerCase()] = m[2];
      return map;
    };
    const bAttrs = parseA(beforeCode);
    const aAttrs = parseA(afterCode);
    const diffs = [];
    for (const [attr, val] of Object.entries(aAttrs)) {
      if (bAttrs[attr] !== val) diffs.push({ attr, val, isNew: !(attr in bAttrs), removed: false });
    }
    // Also detect attributes present in before but absent in after (removals)
    for (const attr of Object.keys(bAttrs)) {
      if (!(attr in aAttrs)) diffs.push({ attr, val: null, isNew: false, removed: true });
    }
    return diffs;
  };

  // For nodes 1+, apply inferred attribute pattern directly (much more reliable)
  if (nodeIdx > 0) {
    const patterns = _inferAttrPatternFromFix();
    if (patterns.length > 0) {
      for (const p of patterns) {
        // Handle REMOVED attributes (e.g. aria-allowed-role strips the role attr)
        if (p.removed) {
          changes.push({
            type: PATCH_TYPE.REMOVE_ATTRIBUTE,
            selector,
            attribute: p.attr,
            id: `${ruleId}-rm-${p.attr}-n${nodeIdx}-${Date.now()}`
          });
          continue;
        }
        // For dynamic values (like alt text derived from filename), re-derive from this node
        let value = p.val;
        if (p.attr === 'alt' && nodeHtml) {
          const srcMatch = nodeHtml.match(/src\s*=\s*["']([^"']*)["']/i);
          if (srcMatch) {
            const filename = srcMatch[1].split('/').pop()?.split('?')[0] || '';
            if (filename) {
              value = filename.replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').replace(/\b\w/g, c => c.toUpperCase()).trim();
            }
          }
        }
        if (p.attr === 'aria-label' && nodeHtml) {
          // For landmark-unique: each node needs a DISTINCT aria-label.
          // Derive from its id, class, or selector index so landmarks don't share the same label.
          const idMatch = nodeHtml.match(/\bid\s*=\s*["']([^"']+)["']/i);
          const clsMatch = nodeHtml.match(/\bclass\s*=\s*["']([^"']+)["']/i);
          const humanise = s => s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
          if (idMatch) {
            value = humanise(idMatch[1]);
          } else if (clsMatch) {
            value = humanise(clsMatch[1].split(/\s+/)[0]);
          } else {
            // Fallback: append the node index so at least the labels differ
            value = `${p.val} ${nodeIdx + 1}`;
          }
        }
        changes.push({
          type: PATCH_TYPE.ATTRIBUTE,
          selector,
          attribute: p.attr,
          value,
          id: `${ruleId}-${p.attr}-n${nodeIdx}-${Date.now()}`
        });
      }
      if (changes.length > 0) return changes;
    }
    // If no attr patterns found, fall through to regular strategies below
  }

  // ── Strategy 1: Diff attributes between before and after HTML ──
  // Extract all attr="value" pairs from both, then find what's NEW or CHANGED
  const parseAttrs = (html) => {
    const map = {};
    const re = /([\w-]+)\s*=\s*["']([^"']*)["']/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const name = m[1].toLowerCase();
      // Only skip truly non-a11y structural attrs
      if (['src', 'href', 'action', 'method', 'width', 'height', 'charset'].includes(name)) continue;
      // Skip event handlers and data-* attrs
      if (name.startsWith('on') || name.startsWith('data-')) continue;
      map[name] = m[2];
    }
    return map;
  };

  const beforeAttrs = parseAttrs(beforeCode);
  const afterAttrs = parseAttrs(afterCode);

  for (const [attr, value] of Object.entries(afterAttrs)) {
    if (beforeAttrs[attr] !== value) {
      changes.push({
        type: PATCH_TYPE.ATTRIBUTE,
        selector,
        attribute: attr,
        value,
        id: `${ruleId}-${attr}-n${nodeIdx}-${Date.now()}`
      });
    }
  }

  // ── Strategy 1c: Detect REMOVED attributes (present in before, absent in after) ──
  // Critical for fixes like aria-allowed-role that work by *removing* an invalid attr.
  for (const [attr] of Object.entries(beforeAttrs)) {
    if (!(attr in afterAttrs)) {
      changes.push({
        type: PATCH_TYPE.REMOVE_ATTRIBUTE,
        selector,
        attribute: attr,
        id: `${ruleId}-rm-${attr}-n${nodeIdx}-${Date.now()}`
      });
    }
  }

  // ── Strategy 1b: Detect inline style changes ──
  const beforeStyle = beforeCode.match(/style\s*=\s*["']([^"']*)["']/i)?.[1] || '';
  const afterStyle = afterCode.match(/style\s*=\s*["']([^"']*)["']/i)?.[1] || '';
  if (afterStyle && afterStyle !== beforeStyle) {
    // Parse individual CSS properties
    const parseCSS = (str) => {
      const map = {};
      str.split(';').forEach(part => {
        const [prop, ...vals] = part.split(':');
        if (prop && vals.length) {
          const cssProp = prop.trim();
          // Convert CSS property to camelCase for el.style
          const jsProp = cssProp.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          map[jsProp] = vals.join(':').trim();
        }
      });
      return map;
    };
    const beforeCSS = parseCSS(beforeStyle);
    const afterCSS = parseCSS(afterStyle);
    for (const [prop, val] of Object.entries(afterCSS)) {
      if (beforeCSS[prop] !== val) {
        // Only add CSS changes if we didn't already add style as an attribute
        const alreadyHasStyleAttr = changes.some(c => c.attribute === 'style');
        if (!alreadyHasStyleAttr) {
          changes.push({
            type: PATCH_TYPE.CSS,
            selector,
            property: prop,
            value: val,
            id: `${ruleId}-css-${prop}-n${nodeIdx}-${Date.now()}`
          });
        }
      }
    }
    // Remove the 'style' attribute change if we parsed individual CSS properties
    const styleAttrIdx = changes.findIndex(c => c.attribute === 'style');
    const hasCSSChanges = changes.some(c => c.type === PATCH_TYPE.CSS);
    if (styleAttrIdx !== -1 && hasCSSChanges) {
      changes.splice(styleAttrIdx, 1);
    }
  }

  // ── Strategy 2: If no attr diffs found, look for key accessibility attrs ──
  //     that appear in afterCode but not in beforeCode
  if (changes.length === 0) {
    const a11yAttrs = [
      'lang', 'alt', 'title', 'role', 'tabindex', 'scope', 'for',
      'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
      'aria-expanded', 'aria-haspopup', 'aria-controls', 'aria-live',
      'aria-checked', 'aria-selected', 'aria-pressed', 'aria-required',
      'aria-invalid', 'aria-disabled', 'aria-level', 'aria-valuenow',
      'aria-valuemin', 'aria-valuemax', 'aria-roledescription',
      'aria-current', 'aria-modal', 'aria-busy',
    ];

    for (const attr of a11yAttrs) {
      const afterMatch = afterCode.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
      const beforeMatch = beforeCode.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));

      if (afterMatch && (!beforeMatch || beforeMatch[1] !== afterMatch[1])) {
        changes.push({
          type: PATCH_TYPE.ATTRIBUTE,
          selector,
          attribute: attr,
          value: afterMatch[1],
          id: `${ruleId}-${attr}-n${nodeIdx}-${Date.now()}`
        });
      }
    }
  }

  // ── Strategy 3: Parse the explanation text as a last resort ──
  if (changes.length === 0) {
    const explanation = fix.explanation || '';
    const combined = afterCode + ' ' + explanation;

    const lastResortAttrs = [
      [/(aria-[\w-]+)\s*=\s*["']([^"']+)["']/i],
      [/\brole\s*=\s*["']([^"']+)["']/i, 'role'],
      [/\balt\s*=\s*["']([^"']+)["']/i, 'alt'],
      [/\blang\s*=\s*["']([^"']+)["']/i, 'lang'],
      [/\btitle\s*=\s*["']([^"']+)["']/i, 'title'],
      [/\btabindex\s*=\s*["']([^"']+)["']/i, 'tabindex'],
      [/\bfor\s*=\s*["']([^"']+)["']/i, 'for'],
    ];

    for (const [regex, fixedName] of lastResortAttrs) {
      const m = combined.match(regex);
      if (m) {
        const attrName = fixedName || m[1];
        const attrValue = fixedName ? m[1] : m[2];
        // Don't duplicate
        if (!changes.some(c => c.attribute === attrName)) {
          changes.push({
            type: PATCH_TYPE.ATTRIBUTE,
            selector,
            attribute: attrName,
            value: attrValue,
            id: `${ruleId}-${attrName}-n${nodeIdx}-${Date.now()}`
          });
        }
      }
    }
  }

  // ── Strategy 4: innerHTML / text-content change ──
  // If after code has the same root tag but different inner content, patch innerHTML.
  // Handles: adding visible text to a button/link, changing heading text, etc.
  // Note: only apply structural changes (innerHTML/outerHTML) for the first node,
  // since fix.after was generated for node 0's specific HTML.
  if (changes.length === 0 && afterCode && beforeCode && nodeIdx === 0) {
    const getInnerHTML = (html) => {
      const m = html.trim().match(/^<[^>]+>([\s\S]*)<\/[\w]+>\s*$/i);
      return m ? m[1].trim() : null;
    };
    const getRootTag = (html) => {
      const m = html.trim().match(/^<([\w]+)/i);
      return m ? m[1].toLowerCase() : null;
    };

    const beforeTag = getRootTag(beforeCode);
    const afterTag = getRootTag(afterCode);
    const beforeInner = getInnerHTML(beforeCode);
    const afterInner = getInnerHTML(afterCode);

    // Same root tag, inner content changed → inject innerHTML change
    if (beforeTag && beforeTag === afterTag && afterInner !== null && beforeInner !== afterInner) {
      changes.push({
        type: PATCH_TYPE.INNER_HTML,
        selector,
        value: afterInner,
        id: `${ruleId}-innerHTML-n${nodeIdx}-${Date.now()}`
      });
    }

    // Tag name changed (div→section, div→main, etc.) → outerHTML replace
    if (changes.length === 0 && beforeTag && afterTag && beforeTag !== afterTag) {
      changes.push({
        type: PATCH_TYPE.OUTER_HTML,
        selector,
        value: afterCode.trim(),
        id: `${ruleId}-outerHTML-tagchange-n${nodeIdx}-${Date.now()}`
      });
    }
  }

  // ── Strategy 5: full outerHTML replace (last resort for structural rewrites) ──
  // If we have a complete after snippet and still no changes, replace outerHTML.
  // Only for node 0 — fix.after is specific to the first element.
  if (changes.length === 0 && nodeIdx === 0 && afterCode && afterCode.trim().startsWith('<')) {
    // Reject fixes that are clearly CSS comments or placeholders
    if (!afterCode.trim().startsWith('/*')) {
      changes.push({
        type: PATCH_TYPE.OUTER_HTML,
        selector,
        value: afterCode.trim(),
        id: `${ruleId}-outerHTML-n${nodeIdx}-${Date.now()}`
      });
    }
  }

  console.log(`[extractDOMChanges] ${ruleId}: ${changes.length} changes from selector "${selector}"`, changes);
  return changes;
}

async function undoLastPatch() {
  if (livePreviewPatches.length === 0) return;
  
  const patch = livePreviewPatches.pop();
  
  try {
    const response = await sendToContentScript(currentTabId, {
      type: 'undo-patch',
      patchId: patch.id
    });
    
    if (response?.ok) {
      // Remove patched state for this issue if no other patches remain for it
      const undoneIssueId = patch.issueId;
      const stillPatched = livePreviewPatches.some(p => p.issueId === undoneIssueId);
      if (!stillPatched && undoneIssueId) {
        patchedIssueIds.delete(undoneIssueId);
        await savePatchedIssueIds();
        updateSuggestButtonStates();
      }
      
      await saveLivePreviewPatches();
      updateLivePreviewUI();
      renderPatchList();
      showToast('✓ Patch undone');
    } else {
      livePreviewPatches.push(patch);
      showToast(`Failed to undo: ${response?.error || 'unknown error'}`);
    }
  } catch (err) {
    // Re-add if undo failed
    livePreviewPatches.push(patch);
    showToast(`Failed to undo: ${err.message}`);
  }
}

async function resetLivePreview() {
  if (livePreviewPatches.length === 0) return;
  
  if (!confirm(`Reset all ${livePreviewPatches.length} patches? This will revert all changes.`)) {
    return;
  }
  
  try {
    const response = await sendToContentScript(currentTabId, {
      type: 'reset-patches'
    });
    
    if (response?.ok) {
      livePreviewPatches.length = 0;
      const key = `${LIVE_PREVIEW_CACHE_KEY}_${currentTabId}`;
      await chrome.storage.local.remove(key);
      updateLivePreviewUI();
      renderPatchList();
      
      // Clear patched state for all issues
      patchedIssueIds.clear();
      await savePatchedIssueIds();
      updateSuggestButtonStates();
      if (els.btnVerifyScore) els.btnVerifyScore.classList.add('hidden');
      
      showToast('✓ All patches cleared');
    } else {
      showToast(`Failed to reset: ${response?.error || 'unknown error'}`);
    }
  } catch (err) {
    showToast(`Failed to reset: ${err.message}`);
  }
}

/**
 * Apply All Patches — batch-apply all AI suggestions at once.
 * If an issue doesn't have a cached suggestion, generate one on the fly.
 */
/**
 * Apply-all, scoped to a specific subset of issues rather than the whole scan.
 * Shares the exact same generate/confidence-gate/apply logic as "Apply All" —
 * a chat instruction like "fix everything critical" must be trusted exactly as
 * much as clicking the button, not more.
 */
async function applyFilteredIssues(issues) {
  if (!issues?.length) { showToast('Nothing matched that instruction'); return; }

  let applied = 0, failed = 0, generated = 0, flagged = 0, proposed = 0;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab?.url || '';

  for (const issue of issues) {
    if (patchedIssueIds.has(issue.id)) continue;
    let fix = suggestionCache.get(issue.id);
    if (!fix) {
      try {
        const response = await sendMessage({
          action: 'fix', issue, pageUrl, tabId: currentTabId,
          designInfo: currentAnalysis?.designInfo || null
        });
        if (response?.ok && response.fix) { fix = response.fix; suggestionCache.set(issue.id, fix); generated++; }
      } catch { /* continue to next issue */ }
    }
    if (!fix) { failed++; continue; }

    const trust = autonomyFor(fix);
    if (trust === 'propose') { proposed++; continue; }
    if (trust === 'flag') flagged++;

    try {
      await applyPatch(issue, fix, { skipVerify: true });
      recordAudit('applied', issue, fix);
      applied++;
    } catch (err) {
      console.warn('Chat apply — failed for', issue.id, err);
      failed++;
    }
  }

  const parts = [`Applied ${applied}`];
  if (flagged)  parts.push(`${flagged} worth reviewing`);
  if (proposed) parts.push(`${proposed} left for you to approve`);
  if (failed)   parts.push(`${failed} failed`);
  showToast(`✓ ${parts.join(' · ')}`);

  if (applied > 0) { updateSuggestButtonStates(); setTimeout(() => verifyPatchedScore(), 800); }
}

async function applyAllPatches() {
  if (!currentAnalysis?.issues?.length) {
    showToast('No issues to fix');
    return;
  }
  
  const btn = els.btnApplyAllPatches;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Generating & Applying…';
  
  let applied = 0;
  let failed = 0;
  let generated = 0;
  let flagged = 0;    // applied, but confidence warrants a look
  let proposed = 0;   // deliberately not applied — shown for review only
  const issues = currentAnalysis.issues;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab?.url || '';
  
  for (const issue of issues) {
    // Skip already-patched issues
    if (patchedIssueIds.has(issue.id)) continue;
    
    let fix = suggestionCache.get(issue.id);
    
    // If not cached, generate fix on the fly
    if (!fix) {
      try {
        btn.innerHTML = `<span class="spinner-sm"></span> Fixing ${issue.id}…`;
        const response = await sendMessage({
          action: 'fix',
          issue,
          pageUrl,
          tabId: currentTabId,
          designInfo: currentAnalysis?.designInfo || null
        });
        if (response?.ok && response.fix) {
          fix = response.fix;
          suggestionCache.set(issue.id, fix);
          generated++;
        }
      } catch { /* continue to next issue */ }
    }
    
    if (!fix) { failed++; continue; }

    // Confidence gate: a low-confidence fix is shown but never applied on the
    // user's behalf. One wrong bulk edit costs more trust than ten skipped ones.
    const trust = autonomyFor(fix);
    if (trust === 'propose') { proposed++; continue; }
    if (trust === 'flag') flagged++;

    try {
      await applyPatch(issue, fix, { skipVerify: true });
      recordAudit('applied', issue, fix);
      applied++;
    } catch (err) {
      console.warn('Apply all — failed for', issue.id, err);
      failed++;
    }
  }

  btn.innerHTML = `${SVG.checkCircle} ${applied} Applied!`;
  setTimeout(() => {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Apply All Patches`;
    btn.disabled = suggestionCache.size === 0;
  }, 2500);
  
  // Report what was held back as prominently as what was applied — a silent skip
  // looks like a failure, and an unexplained edit looks like a liberty.
  const parts = [`Applied ${applied} patches`];
  if (flagged  > 0) parts.push(`${flagged} worth reviewing`);
  if (proposed > 0) parts.push(`${proposed} left for you to approve`);
  if (failed   > 0) parts.push(`${failed} failed`);
  showToast(`✓ ${parts.join(' · ')}`);

  // Auto-verify score after batch apply — wait for DOM mutations to settle
  if (applied > 0) {
    updateSuggestButtonStates();
    setTimeout(() => verifyPatchedScore(), 800);
  }
}

function updateLivePreviewUI() {
  const patchCount = livePreviewPatches.length;
  const domCount = livePreviewPatches.reduce((sum, p) => sum + (p.change ? 1 : 0), 0);
  
  els.livePreviewPatchCount.textContent = patchCount;
  els.livePreviewDomCount.textContent = domCount;
  
  els.btnUndoPatch.disabled = patchCount === 0;
  els.btnResetLivePreview.disabled = patchCount === 0;
  
  // Apply All is enabled when there are cached suggestions not yet applied
  const unappliedCount = [...suggestionCache.keys()].filter(id => !patchedIssueIds.has(id)).length;
  els.btnApplyAllPatches.disabled = unappliedCount === 0;
  if (els.livePreviewAvailableCount) els.livePreviewAvailableCount.textContent = unappliedCount;
}

function renderPatchList() {
  if (livePreviewPatches.length === 0) {
    els.livePreviewPatchList.innerHTML = '<div class="live-preview-empty">No patches applied yet. Click "Apply Fix" on any issue to test it live.</div>';
    return;
  }
  
  els.livePreviewPatchList.innerHTML = livePreviewPatches.map((patch, idx) => `
    <div class="sandbox-patch-item">
      <div class="sandbox-patch-num">${idx + 1}</div>
      <div class="sandbox-patch-info">
        <div class="sandbox-patch-title">${escapeHtml(patch.issueTitle)}</div>
        <div class="sandbox-patch-meta">${patch.change.type} · ${patch.change.selector || 'global'}</div>
      </div>
      <button class="sandbox-patch-remove" data-idx="${idx}" title="Remove this patch" aria-label="Remove patch">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `).join('');
  
  // Bind remove buttons
  $$('.sandbox-patch-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.idx);
      livePreviewPatches.splice(idx, 1);
      await saveLivePreviewPatches();
      updateLivePreviewUI();
      renderPatchList();
    });
  });
}

async function saveLivePreviewPatches() {
  // Store patches per-tab with URL for reload persistence
  const tab = await chrome.tabs.get(currentTabId);
  const key = `${LIVE_PREVIEW_CACHE_KEY}_${currentTabId}`;
  
  await chrome.storage.local.set({
    [key]: {
      tabId: currentTabId,
      url: tab.url,
      patches: livePreviewPatches,
      timestamp: Date.now()
    }
  });
}

async function loadLivePreviewPatches() {
  const key = `${LIVE_PREVIEW_CACHE_KEY}_${currentTabId}`;
  const result = await chrome.storage.local.get(key);
  const cached = result[key];
  
  if (cached && cached.tabId === currentTabId) {
    livePreviewPatches.length = 0;
    livePreviewPatches.push(...cached.patches);
    
    // Re-apply patches to DOM after reload
    for (const patch of cached.patches) {
      if (patch.change) {
        await sendToContentScript(currentTabId, {
          type: 'apply-patch',
          change: patch.change,
          patchId: patch.id
        });
      }
    }
  }
}

/**
 * Persist patched issue IDs per tab so they survive across rescans.
 */
async function savePatchedIssueIds() {
  const key = `${PATCHED_ISSUES_CACHE_KEY}_${currentTabId}`;
  await chrome.storage.local.set({
    [key]: {
      tabId: currentTabId,
      ids: [...patchedIssueIds],
      timestamp: Date.now()
    }
  });
}

/**
 * Load patched issue IDs from storage (called on popup open and after rescan).
 */
async function loadPatchedIssueIds() {
  const key = `${PATCHED_ISSUES_CACHE_KEY}_${currentTabId}`;
  const result = await chrome.storage.local.get(key);
  const cached = result[key];
  
  if (cached && cached.tabId === currentTabId && cached.ids) {
    patchedIssueIds.clear();
    cached.ids.forEach(id => patchedIssueIds.add(id));
  }
}

/* ═══════ Scan ═══════ */

async function handleScan() {
  if (!currentTabId) {
    showError('No active tab found');
    return;
  }

  // ── Scan rate-limit gate (free plan) ──
  const scanCheck = await checkScanAllowed();
  if (!scanCheck.allowed) {
    await showScanLimitModal(scanCheck.scansToday, scanCheck.limit);
    return;
  }
  // Count this scan
  await incrementScanUsage();

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
  els.badges.classList.add('hidden');
  els.tabBar.classList.add('hidden');
  document.getElementById('impairment-bar')?.classList.add('hidden');
  document.getElementById('chat-bar')?.classList.add('hidden');
  els.quickActions.classList.add('hidden');
  els.filterBar.classList.add('hidden');
  if (els.btnVerifyScore) els.btnVerifyScore.classList.add('hidden');
  updatePrefetchStatus('hide');

  // Fake progress bar
  scanStartTime = Date.now();
  animateProgress();

  // ── Clear stale patch state from any previous session ──
  // A fresh scan is always a clean slate — the page is scanned as-is.
  // If the user previously applied patches they can re-apply after the scan.
  livePreviewPatches.length = 0;
  patchedIssueIds.clear();
  await Promise.all([
    saveLivePreviewPatches(),
    savePatchedIssueIds()
  ]);
  updateLivePreviewUI();
  renderPatchList();

  try {
    const response = await sendMessage({ action: 'scan', tabId: currentTabId });

    if (!response?.ok) {
      throw new Error(response?.error || 'Scan failed');
    }

    currentAnalysis = response.analysis;
    const duration = ((Date.now() - scanStartTime) / 1000).toFixed(1);
    currentAnalysis._scanDuration = duration;
    // Lock the original axe score so verifyPatchedScore always compares against the
    // very first scan baseline — not a previous verify result.
    currentAnalysis._originalAxeScore = currentAnalysis.auditScore;

    // Actively highlight issues on the page (don't rely on service worker step 7)
    highlightsActive = false; // will be set to true by toggleHighlights
    await toggleHighlights();

    // Cache the scan results for this tab (persistent storage)
    await setScanCache(currentTabId, {
      analysis: currentAnalysis,
      timestamp: Date.now(),
      highlightsActive: true
    });

    renderResults(response.analysis);
    saveToHistory(response.analysis);

    // Pre-fetch code suggestions in background so they're ready instantly
    // Keep suggestion cache entries for issues that still exist after rescan
    const newIssueIds = new Set(response.analysis.issues.map(i => i.id));
    for (const key of suggestionCache.keys()) {
      if (!newIssueIds.has(key)) suggestionCache.delete(key);
    }
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

  // Grade badge — counts come from this analysis, which may not be committed to
  // currentAnalysis yet at this point in the render.
  const grade = getGrade(score, analysis.counts);
  els.scoreGrade.textContent = grade.label;
  els.scoreGrade.className = `score-grade ${grade.class}`;
  els.scoreGrade.classList.remove('hidden');

  // Score source badge — initially axe-core, upgraded when Lighthouse arrives
  els.scoreSource.textContent = 'axe-core';
  els.scoreSource.className = 'score-source axe';
  els.scoreSource.title = 'Score from axe-core engine — Lighthouse score loading…';
  els.scoreSource.classList.remove('hidden');

  // Show loading dashboard rings until Lighthouse data arrives
  renderDashboardLhRings();

  // Info button + initial breakdown — reset to full chip (unseen) on every new scan
  els.scoreInfoBtn.classList.remove('hidden', 'seen', 'active');
  els.scoreInfoBtn.setAttribute('aria-expanded', 'false');
  renderScoreBreakdown(score, null);

  // Always-visible attribution — Lighthouse loads silently in background
  els.scoreAttribution.classList.remove('hidden');
  els.lhLoadingHint.classList.add('hidden');

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

  // Severity badges
  const counts = analysis.counts || {};
  els.badgeCritical.textContent = `${counts.critical || 0} Critical`;
  els.badgeSerious.textContent = `${counts.serious || 0} Serious`;
  els.badgeModerate.textContent = `${counts.moderate || 0} Moderate`;
  els.badgeMinor.textContent = `${counts.minor || 0} Minor`;
  els.badges.classList.remove('hidden');

  // Show tabs, then switch to issues (which also shows quick actions + filter bar)
  els.tabBar.classList.remove('hidden');
  document.getElementById('impairment-bar')?.classList.remove('hidden');
  document.getElementById('chat-bar')?.classList.remove('hidden');
  switchTab('issues');

  // Update highlight button to reflect auto-highlight state from scan
  if (highlightsActive) {
    els.btnHighlight.textContent = '👁️ On';
    els.btnHighlight.classList.add('active');
    els.btnHighlight.title = 'Highlights on — click to hide';
  }

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
    // (celebration animation removed — this is a compliance tool)
  } else {
    issues.forEach((issue, idx) => {
      els.issuesList.appendChild(createIssueCard(issue, idx));
    });
  }

  els.issuesContainer.classList.remove('hidden');
  highlightsActive = true;

  // Findings on elements the automated audit passed — runs after the main
  // render so the issue list is never held up waiting for it.
  runJudgmentScan(analysis.counts?.passed ?? null);
}

/* ═══════ Beyond automated checks ═══════ */

/**
 * Ask the service worker for issues that axe-core and Lighthouse pass.
 *
 * Deliberately non-blocking and non-fatal: this is additive information, so a
 * failure here must never disturb the main results the user already has.
 */
async function runJudgmentScan(automatedPassCount) {
  const container = $('#judgment-container');
  const list      = $('#judgment-list');
  const countEl   = $('#judgment-count');
  const summaryEl = $('#judgment-summary');
  if (!container || !list) return;

  container.classList.add('hidden');
  list.innerHTML = '';
  lastJudgmentFindings = [];

  let response;
  try {
    response = await sendMessage({
      action: 'judgment-scan',
      tabId: currentTabId,
      automatedPassCount
    });
  } catch {
    return;
  }
  if (!response?.ok || !Array.isArray(response.findings) || !response.findings.length) return;

  lastJudgmentFindings = response.findings;
  countEl.textContent = `(${response.findings.length})`;
  summaryEl.textContent = response.summary || '';

  for (const finding of response.findings) {
    list.appendChild(createJudgmentCard(finding));
  }
  container.classList.remove('hidden');
}

function createJudgmentCard(finding) {
  const li = document.createElement('li');
  li.className = `issue-card judgment-card sev-${finding.severity}`;

  const selectors = finding.selectors || [];
  const count = finding.occurrences || 1;

  li.innerHTML = `
    <div class="issue-head">
      <span class="issue-sev sev-${finding.severity}">${escHtml(finding.severity)}</span>
      <span class="judgment-tag" title="These elements pass axe-core and Lighthouse">Passes automated checks</span>
      ${count > 1 ? `<span class="judgment-count" title="${count} elements affected">×${count}</span>` : ''}
    </div>
    <h3 class="issue-title">${escHtml(finding.title)}</h3>
    ${finding.evidence ? `<div class="judgment-evidence">${escHtml(finding.evidence)}</div>` : ''}
    <p class="issue-desc">${escHtml(finding.description || '')}</p>
    ${finding.suggestedFix ? `<p class="judgment-fix"><strong>Fix:</strong> ${escHtml(finding.suggestedFix)}</p>` : ''}
    <div class="issue-meta">
      <span>${escHtml((finding.wcag || []).map(w => `WCAG ${w}`).join(', '))}</span>
      ${selectors.length ? `<button class="judgment-locate" type="button">Show me${count > 1 ? ` <span class="judgment-locate-idx">1/${count}</span>` : ''}</button>` : ''}
    </div>
  `;

  // With several affected elements the button walks through them one per click,
  // so a grouped finding stays as inspectable as an individual one.
  const locate = li.querySelector('.judgment-locate');
  let index = 0;
  locate?.addEventListener('click', () => {
    const selector = selectors[index % selectors.length];
    sendMessage({ action: 'scroll-to', tabId: currentTabId, selector });
    index++;
    const idxEl = locate.querySelector('.judgment-locate-idx');
    if (idxEl) idxEl.textContent = `${(index % selectors.length) + 1}/${selectors.length}`;
  });

  // 3.3 — describe the actual image instead of leaving the reader to guess
  // from a bad filename. Only offered where the finding carries a real src.
  if (finding.ruleId === 'alt-text-quality' && finding.imageSrc) {
    const visBtn = document.createElement('button');
    visBtn.className = 'judgment-vision-btn';
    visBtn.type = 'button';
    visBtn.textContent = 'Describe with AI';
    visBtn.addEventListener('click', async () => {
      visBtn.disabled = true;
      visBtn.textContent = 'Looking at the image…';
      try {
        const res = await sendMessage({ action: 'vision-alt', tabId: currentTabId, imageSrc: finding.imageSrc });
        if (res?.ok && res.altText) {
          visBtn.replaceWith(Object.assign(document.createElement('div'), {
            className: 'judgment-vision-result',
            textContent: `Suggested alt text: "${res.altText}"`
          }));
        } else {
          visBtn.textContent = res?.error || 'Could not describe this image';
          visBtn.disabled = false;
        }
      } catch (e) {
        visBtn.textContent = e.message || 'Failed';
        visBtn.disabled = false;
      }
    });
    li.querySelector('.issue-meta')?.appendChild(visBtn);
  }

  return li;
}

/**
 * Grade must agree with the compliance status shown beside it.
 *
 * Previously any score ≥ 70 returned "Grade A — meets WCAG 2.1 AA", which could
 * sit directly next to an "At Risk" status on the same card. Grade A now requires
 * what compliance actually calls compliant, and any critical violation caps the
 * grade regardless of score.
 *
 * The wording is also narrowed: automated checks cover roughly a third of WCAG,
 * so passing them is not "meets WCAG 2.1 AA" — it is passing the automated subset.
 */
function getGrade(score, counts = null) {
  const critical = counts?.critical || 0;

  if (score >= 90 && critical === 0) return {
    label: 'Grade A',
    class: 'a',
    summary: 'Passes all automated WCAG 2.1 AA checks — manual review still required',
    nextLevel: null,
    missing: ['Run the "Beyond automated checks" pass and a manual keyboard/screen-reader review']
  };
  if (score >= 70 && critical === 0) return {
    label: 'Grade B',
    class: 'b',
    summary: 'Close — no critical violations, but issues remain',
    nextLevel: 'A',
    missing: [
      'Resolve the remaining moderate and minor violations',
      'Confirm colour contrast reaches 4.5:1 for normal text'
    ]
  };
  if (score >= 40) return {
    label: 'Grade C',
    class: 'c',
    summary: critical > 0
      ? `Partial compliance — ${critical} critical violation${critical > 1 ? 's' : ''} block assistive technology`
      : 'Partial compliance — significant issues remain',
    nextLevel: 'B',
    missing: [
      'Eliminate all Critical & Serious violations (each costs 5–10 pts)',
      'Fix color contrast issues to reach ≥4.5:1 ratio',
      'Add missing alt text to all meaningful images',
      'Ensure all interactive elements are keyboard-accessible'
    ]
  };
  return {
    label: 'Grade D',
    class: 'c',
    summary: 'Fails basic accessibility requirements',
    nextLevel: 'C',
    missing: [
      'Multiple critical violations block assistive technology users',
      'Page likely fails ADA / EN 301 549 legal compliance',
      'Address all Critical violations immediately (legal exposure)',
      'Add ARIA labels, semantic HTML structure, and keyboard focus indicators',
      'Ensure every image has alt text and every form field has a label'
    ]
  };
}

/* Auto-collapse timer handle — cancelled if user manually toggles */
let _breakdownAutoTimer = null;

function toggleScoreBreakdown() {
  clearTimeout(_breakdownAutoTimer);

  // After first click: collapse chip to icon-only (hide label + pulse dot)
  els.scoreInfoBtn.classList.add('seen');
  els.scoreInfoBtn.setAttribute('aria-expanded',
    els.scoreBreakdown.classList.contains('expanded') ? 'false' : 'true');

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
  li.dataset.issueId = issue.id;

  // Pre-stamp patched state if already known
  if (patchedIssueIds.has(issue.id)) li.classList.add('patched');

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
        <button class="issue-btn fix-btn${patchedIssueIds.has(issue.id) ? ' patched' : ''}" data-idx="${idx}" title="Get AI code suggestion">${patchedIssueIds.has(issue.id) ? SVG.checkCircle + ' Patched' : SVG.suggest + ' Suggest'}</button>
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
        sendToContentScript(currentTabId, { type: 'spotlight', selector });
      }
    }
  });

  // Locate button — scroll to element on page + flash card
  const locateBtn = li.querySelector('.locate-btn');
  locateBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPageLevel) {
      // Show/toggle page-level banner instead of scrolling
      sendToContentScript(currentTabId, { type: 'show-page-banner' });
      li.classList.add('locating');
      setTimeout(() => li.classList.remove('locating'), 1500);
      return;
    }
    const selector = locateBtn.dataset.selector;
    if (selector) {
      sendToContentScript(currentTabId, { type: 'scroll-to', selector });
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
  // ── Pro gate ──
  if (!requirePlan('ai', 'AI Suggestions')) return;

  const isPatched = patchedIssueIds.has(issue.id);
  
  // Check cache first — instant if pre-fetched
  const cached = suggestionCache.get(issue.id);
  if (cached) {
    showFixModal(cached, issue);
    // Don't reset "Patched" buttons — keep their state
    if (!isPatched) {
      btn.innerHTML = SVG.checkCircle + ' Ready';
      setTimeout(() => { btn.innerHTML = SVG.suggest + ' Suggest'; }, 1200);
    }
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
      tabId: currentTabId,
      designInfo: currentAnalysis?.designInfo || null
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
    // Preserve "Patched" state if already applied
    if (isPatched) {
      btn.innerHTML = SVG.checkCircle + ' Patched';
      btn.classList.add('patched');
    } else {
      btn.innerHTML = suggestionCache.has(issue.id) ? SVG.checkCircle + ' Ready' : SVG.suggest + ' Suggest';
      if (suggestionCache.has(issue.id)) {
        setTimeout(() => { btn.innerHTML = SVG.suggest + ' Suggest'; }, 1200);
      }
    }
  }
}

/* ═══════ Fix All ═══════ */

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

  updatePrefetchStatus('working');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab?.url || '';

  // ── Strategy A: Full-page analysis (one LLM call for everything) ──
  // Send all violations + page context to Gemini in one shot.
  // Gemini understands the whole picture, prioritises, and returns fixes for all issues.
  const uncachedIssues = issues.filter(iss => !suggestionCache.has(iss.id));

  if (uncachedIssues.length > 0) {
    try {
      console.log(`[prefetch] Sending ${uncachedIssues.length} issues to LLM for full-page analysis…`);
      const response = await sendMessage({
        action: 'analyze-all',
        issues: uncachedIssues,
        pageUrl,
        designInfo: currentAnalysis.designInfo || null,
        tabId: currentTabId
      });

      if (response?.ok && response.result?.fixes) {
        const { fixes, summary, priority, actionPlan } = response.result;

        // Store full-page narrative on analysis for display
        if (summary)    currentAnalysis.llmSummary    = summary;
        if (priority)   currentAnalysis.llmPriority   = priority;
        if (actionPlan) currentAnalysis.llmActionPlan = actionPlan;
        console.log('[prefetch] LLM full analysis summary:', summary);
        console.log('[prefetch] LLM priority order:', priority);

        // Cache fix for each issue from the bulk response.
        // IMPORTANT: Prefer deterministic fixes over Gemini's generic before/after,
        // because deterministic fixes carry _patchHint metadata (css, attribute,
        // childRole etc.) that extractDOMChanges relies on to generate changes.
        // Gemini's before/after is generic HTML that often can't be parsed.
        for (const issue of issues) {
          if (suggestionCache.has(issue.id)) continue;

          // 1. Try the deterministic path first (instant, has _patchHint metadata)
          let bestFix = null;
          try {
            // deterministicOnly: the batch call above already produced a fix for every
            // issue. This pass only exists to pick up the rule engine's _patchHint
            // metadata, so it must never reach a model — otherwise one batched call
            // silently becomes one call per issue.
            const detResp = await sendMessage({ action: 'fix', issue, pageUrl, tabId: currentTabId, designInfo: currentAnalysis?.designInfo || null, deterministicOnly: true });
            if (detResp?.ok && detResp.fix && detResp.fix.confidence >= 0.7) {
              bestFix = detResp.fix;
            }
          } catch { /* ignore — fall through to Gemini fix */ }

          // 2. Fall back to Gemini's full-analysis fix if deterministic didn't work
          if (!bestFix) {
            const geminiFix = fixes[issue.id];
            if (geminiFix) bestFix = { ...geminiFix, source: 'gemini-full' };
          }

          if (bestFix) {
            suggestionCache.set(issue.id, bestFix);
            prefetchDone++;
          }
        }

        updateSuggestButtonStates();
        if (livePreviewActive) updateLivePreviewUI();
        console.log(`[prefetch] Full-page analysis cached ${prefetchDone} fixes`);
      }
    } catch (e) {
      console.warn('[prefetch] Full-page analysis failed, falling back to per-issue:', e.message);
    }
  }

  // ── Strategy B: Per-issue fallback (deterministic or individual LLM calls) ──
  // For any issues still not cached (full analysis failed or returned no fix for them).
  const stillUncached = issues.filter(iss => !suggestionCache.has(iss.id));

  if (stillUncached.length > 0) {
    console.log(`[prefetch] Falling back to per-issue for ${stillUncached.length} remaining issues`);

    // Dedup by rule ID
    const uniqueRules = new Map();
    const ruleOrder = [];
    for (const issue of stillUncached) {
      if (!uniqueRules.has(issue.id)) {
        uniqueRules.set(issue.id, issue);
        ruleOrder.push(issue.id);
      }
    }

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
            tabId: currentTabId,
            designInfo: currentAnalysis?.designInfo || null
          });
          if (response?.ok && response.fix) {
            for (const iss of issues) {
              if (iss.id === ruleId && !suggestionCache.has(iss.id)) {
                suggestionCache.set(iss.id, response.fix);
              }
            }
          }
        } catch { /* silent */ }
        prefetchDone += issues.filter(iss => iss.id === ruleId).length;
        updatePrefetchStatus('working');
      });

      await Promise.all(promises);
      updateSuggestButtonStates();
      if (livePreviewActive) updateLivePreviewUI();
    }
  }

  prefetchInProgress = false;
  updatePrefetchStatus('done');
}

/**
 * Update the prefetch status banner.
 * Suggestions load silently in the background — banner stays hidden.
 * Button states are still updated via updateSuggestButtonStates().
 * @param {'working'|'done'|'hide'} state
 */
function updatePrefetchStatus(state) {
  // Always keep hidden — prefetching runs in background silently
  if (els.prefetchStatus) els.prefetchStatus.classList.add('hidden');
}

/**
 * Update all Suggest buttons to show ✅ if their suggestion is cached
 */
function updateSuggestButtonStates() {
  document.querySelectorAll('.fix-btn').forEach(btn => {
    const idx = parseInt(btn.dataset.idx, 10);
    const issue = currentAnalysis?.issues?.[idx];
    if (!issue) return;
    
    // Priority 1: If this issue has been patched, show permanent "Patched" state
    if (patchedIssueIds.has(issue.id)) {
      btn.innerHTML = SVG.checkCircle + ' Patched';
      btn.classList.add('patched');
      btn.classList.remove('cached');
      // Stamp the card itself so the whole row gets the green treatment
      btn.closest('.issue-card')?.classList.add('patched');
      return;
    }
    
    // Priority 2: If cached (pre-fetched), briefly flash "Ready" then back to "Suggest"
    if (suggestionCache.has(issue.id) && !btn.classList.contains('loading')) {
      btn.innerHTML = SVG.checkCircle + ' Ready';
      btn.classList.add('cached');
      setTimeout(() => {
        // Don't revert if it got patched in the meantime
        if (btn.classList.contains('cached') && !patchedIssueIds.has(issue.id)) {
          btn.innerHTML = SVG.suggest + ' Suggest';
        }
      }, 2000);
    }
  });
}

/* ═══════ Fix modal ═══════ */

function showFixModal(fix, issue) {
  els.fixTitle.textContent = fix.fixTitle || `Suggestion: ${issue.id}`;

  // Emit the fix in the dialect this codebase actually uses. Handing a React
  // developer `class="btn"` makes them translate it before they can use it.
  const framework = globalThis.Framework.detectFramework(currentAnalysis?.designInfo?.tech);
  const fw = globalThis.Framework.formatForFramework(fix.after || '', framework);
  
  const sourceIcon = fix.private ? SVG.lock : SVG.cloud;
  const sourceClass = fix.private ? 'private' : 'cloud';
  const sourceLabel = fix.source || 'unknown';
  const confidence = fix.confidence ? `${Math.round(fix.confidence * 100)}%` : '—';
  
  // Apply Fix button — always visible so users can apply patches directly
  const sandboxBtn = `
    <button class="fix-apply-btn" id="fix-apply">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Apply Fix to Page
    </button>
  `;
  
  els.fixBody.innerHTML = `
    <div class="fix-label">Current Code</div>
    <div class="fix-code before">${escapeHtml(fix.before || '(no code)')}</div>
    
    <div class="fix-label">Suggested Fix${fw.changed ? ` <span class="fix-fw-tag">${escapeHtml(fw.label)}</span>` : ''}</div>
    <div class="fix-code after">${escapeHtml(fw.code || '(no suggestion)')}</div>
    ${fw.note ? `<p class="fix-fw-note">${escapeHtml(fw.note)}</p>` : ''}
    
    <div class="fix-label">Explanation</div>
    <p class="fix-explanation">${escapeHtml(fix.explanation || '')}</p>
    
    <div class="fix-meta">
      <span class="fix-source">${sourceIcon} <span class="${sourceClass}">${sourceLabel}</span></span>
      <span>Effort: ${fix.effort || '—'}</span>
      <span>Confidence: ${confidence}</span>
    </div>
    
    <div class="fix-actions">
      <button class="fix-copy-btn" id="fix-copy">${SVG.copy} Copy Code</button>
      <button class="fix-copy-btn" id="fix-copy-diff">${SVG.copy} Copy Diff</button>
      ${sandboxBtn}
      <button class="fix-apply-btn fix-auto-btn" id="fix-auto">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Fix &amp; Verify
      </button>
    </div>
    <div id="fix-auto-status" class="fix-auto-status hidden" role="status" aria-live="polite"></div>
  `;

  const copyBtn = $('#fix-copy');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fw.code || fix.after || '');
      copyBtn.innerHTML = SVG.check + ' Copied!';
      showToast('Code copied to clipboard');
      setTimeout(() => { copyBtn.innerHTML = SVG.copy + ' Copy Code'; }, 2000);
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
  });

  // Copy the change as a patch — survives the page refresh that discards the
  // live DOM edit, so the fix can actually reach the codebase.
  const diffBtn = $('#fix-copy-diff');
  diffBtn?.addEventListener('click', async () => {
    try {
      const pageUrl = currentAnalysis?.metadata?.url || '';
      const diff = globalThis.FixExport.buildFixDiff(
        { ...fix, after: fw.code || fix.after }, issue, pageUrl);
      await navigator.clipboard.writeText(diff);
      diffBtn.innerHTML = SVG.check + ' Copied!';
      showToast('Diff copied — paste into your editor or ticket');
      setTimeout(() => { diffBtn.innerHTML = SVG.copy + ' Copy Diff'; }, 2000);
    } catch {
      diffBtn.textContent = 'Copy failed';
    }
  });
  
  // Fix & Verify — the full loop: apply, re-scan, retry on failure, escalate.
  const autoBtn = $('#fix-auto');
  const status  = $('#fix-auto-status');
  autoBtn?.addEventListener('click', async () => {
    autoBtn.disabled = true;
    status.classList.remove('hidden', 'is-ok', 'is-fail');
    status.classList.add('is-running');

    const label = {
      generating: (a, m) => `Generating a fix… (attempt ${a} of ${m})`,
      applying:   ()     => 'Applying to the page…',
      verifying:  ()     => 'Re-scanning to check it worked…',
      retrying:   (a, m) => `That didn't clear it — undoing and trying a different approach (${a} of ${m})…`,
      verified:   ()     => 'Verified.'
    };

    const result = await remediateIssue(issue, {
      onProgress: ({ phase, attempt, maxAttempts }) => {
        status.textContent = label[phase]?.(attempt, maxAttempts) || '';
      }
    });

    status.classList.remove('is-running');
    if (result.ok) {
      status.classList.add('is-ok');
      status.textContent = result.attempts > 1
        ? `Fixed and verified — the violation is gone. Took ${result.attempts} attempts.`
        : 'Fixed and verified — the violation is gone.';
      showToast('Fix verified against a fresh scan');
    } else {
      status.classList.add('is-fail');
      status.textContent = result.reason;
    }
    autoBtn.disabled = false;
  });

  // Apply Fix button
  const applyBtn = $('#fix-apply');
  applyBtn?.addEventListener('click', async () => {
    applyBtn.disabled = true;
    applyBtn.innerHTML = '<span class="spinner-sm"></span> Applying & Verifying...';
    await applyPatch(issue, fix);
    applyBtn.innerHTML = SVG.checkCircle + ' Done!';
    setTimeout(() => { closeFixModal(); }, 800);
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

      // 4.4 — full arc for this URL across all history, not just the one-step
      // arrow above. Only rendered once there is more than a single data point.
      const arc = globalThis.Trend?.buildUrlTrend(history, entry.url);
      const sparkHtml = (arc && arc.count > 1) ? `
        <svg class="history-sparkline" viewBox="0 0 80 20" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${globalThis.Trend.buildSparklinePoints(arc.entries.map(e => e.score))}" />
        </svg>
        <span class="history-delta history-delta-${arc.direction}">
          ${globalThis.Trend.directionSymbol(arc.direction)} ${arc.delta > 0 ? '+' : ''}${arc.delta} over ${arc.count} scans
        </span>` : '';

      li.innerHTML = `
        <div class="history-score ${scoreClass}">${entry.score}</div>
        <div class="history-info">
          <div class="history-url" title="${escapeAttr(entry.url)}">${escapeHtml(shortUrl)}</div>
          <div class="history-meta">
            <span>${entry.issues} issues</span>
            <span>${ago}</span>
            ${entry.duration ? `<span>${entry.duration}s</span>` : ''}
          </div>
          ${sparkHtml}
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

/* ═══════ 6.1 — Client profiles ═══════ */

let activeClientProfile = null;

async function initClientProfiles() {
  const sel = document.getElementById('client-profile-select');
  if (!sel) return;

  const { clientProfiles = [], activeClientProfileId = '' } = await chrome.storage.local.get(['clientProfiles', 'activeClientProfileId']);
  sel.innerHTML = '<option value="">None — unbranded exports</option>' +
    clientProfiles.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  sel.value = activeClientProfileId || '';
  activeClientProfile = clientProfiles.find(p => p.id === activeClientProfileId) || null;

  sel.addEventListener('change', async () => {
    const { clientProfiles: list = [] } = await chrome.storage.local.get('clientProfiles');
    activeClientProfile = list.find(p => p.id === sel.value) || null;
    await chrome.storage.local.set({ activeClientProfileId: sel.value || '' });
  });

  document.getElementById('client-profile-add')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('client-profile-name');
    const name = (nameInput?.value || '').trim();
    if (!name) { showToast('Enter a client name first'); return; }

    const profile = globalThis.Branding.makeProfile({ name });
    const { clientProfiles: list = [] } = await chrome.storage.local.get('clientProfiles');
    const updated = [...list, profile];
    await chrome.storage.local.set({ clientProfiles: updated, activeClientProfileId: profile.id });

    nameInput.value = '';
    await initClientProfiles();
    showToast(`"${name}" added and set active`);
  });
}

/** Applied uniformly at the point every markdown export is downloaded. */
function brand(markdown) {
  return globalThis.Branding.applyBranding(markdown, activeClientProfile);
}

/* ═══════ 6.2 — Team sync ═══════ */

async function exportTeamBundle() {
  const auditRes = await sendMessage({ action: 'audit-get', pageUrl: null });
  const histRes  = await sendMessage({ action: 'get-history' });
  const bundle = globalThis.TeamSync.buildTeamBundle({
    auditLog: auditRes?.ok ? auditRes.entries : [],
    scanHistory: histRes?.ok ? histRes.history : []
  });
  downloadFile(JSON.stringify(bundle, null, 2), `sitescope-team-${new Date().toISOString().slice(0,10)}.json`, 'application/json');
  showToast(`Exported ${bundle.auditLog.length} audit entries, ${bundle.scanHistory.length} scans`);
}

async function importTeamBundleFile(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // allow re-selecting the same file later
  if (!file) return;

  let bundle;
  try {
    bundle = JSON.parse(await file.text());
  } catch {
    showToast('That file is not a valid team export');
    return;
  }

  // Dedupe happens HERE, against the real existing data, before anything is
  // written — audit-merge just appends what it's given, so sending it entries
  // that were already deduped client-side is what keeps this additive-only.
  const [auditRes, histRes] = await Promise.all([
    sendMessage({ action: 'audit-get', pageUrl: null }),
    sendMessage({ action: 'get-history' })
  ]);
  const merged = globalThis.TeamSync.importTeamBundle(bundle, {
    auditLog: auditRes?.ok ? auditRes.entries : [],
    scanHistory: histRes?.ok ? histRes.history : []
  });
  const newAuditEntries = merged.auditLog.slice((auditRes?.ok ? auditRes.entries.length : 0));

  if (newAuditEntries.length) await sendMessage({ action: 'audit-merge', entries: newAuditEntries });
  await chrome.storage.local.set({ scanHistory: merged.scanHistory });

  showToast(`Imported ${merged.added.auditLog} audit entries, ${merged.added.scanHistory} scan${merged.added.scanHistory === 1 ? '' : 's'}`);
  loadHistory();
}

async function handleExport(format) {
  if (!currentAnalysis) {
    showToast('Run a scan first');
    return;
  }

  // ── Pro gate ──
  if (!requirePlan('export', 'Export')) return;

  switch (format) {
    case 'evidence': {
      // A dated record of work done and proven. Verified status comes only from
      // issues confirmed absent by a re-scan — never from "a patch was applied".
      // Derive status from the persisted audit log where possible: the in-memory
      // sets only cover the current popup session, and a compliance record that
      // forgets everything when a window closes is not a record.
      const pageUrl = currentAnalysis.metadata?.url || '';
      let appliedIds = [...patchedIssueIds];
      let verifiedIds = [...verifiedIssueIds];
      let auditEntries = [];
      try {
        const audit = await sendMessage({ action: 'audit-get', pageUrl });
        if (audit?.ok && audit.summary) {
          auditEntries = audit.entries || [];
          appliedIds  = [...new Set([...appliedIds,  ...audit.summary.appliedIds])];
          verifiedIds = [...new Set([...verifiedIds, ...audit.summary.verifiedIds])];
        }
      } catch { /* fall back to this session's state */ }

      const report = globalThis.Evidence.buildEvidenceReport({
        pageUrl,
        pageTitle: currentAnalysis.metadata?.title || '',
        analysis: currentAnalysis,
        fixes: Object.fromEntries(suggestionCache),
        appliedIds,
        verifiedIds,
        judgment: lastJudgmentFindings
      });
      const risk = globalThis.Risk.assessRisk(currentAnalysis.counts || {});
      downloadFile(
        brand(
          globalThis.Evidence.renderEvidenceMarkdown(report) +
            '\n' + globalThis.Risk.renderRiskMarkdown(risk) +
            '\n' + globalThis.AuditLog.renderAuditMarkdown(auditEntries)
        ),
        `accessibility-record-${new Date().toISOString().slice(0, 10)}.md`,
        'text/markdown'
      );
      showToast(
        report.summary.verified > 0
          ? `Evidence record downloaded — ${report.summary.verified} fixes verified`
          : 'Evidence record downloaded'
      );
      break;
    }

    case 'session': {
      const entries = (currentAnalysis.issues || [])
        .map(issue => ({ issue, fix: suggestionCache.get(issue.id) }))
        .filter(e => e.fix);
      if (!entries.length) { showToast('No fixes generated yet'); break; }
      downloadFile(
        brand(globalThis.FixExport.buildSessionExport(
          entries, currentAnalysis.metadata?.url || '', { verified: verifiedIssueIds.size })),
        `accessibility-fixes-${new Date().toISOString().slice(0, 10)}.patch.txt`,
        'text/plain'
      );
      showToast(`${entries.length} fixes exported`);
      break;
    }

    case 'vision': {
      let vis;
      try {
        vis = await sendMessage({ action: 'vision-scan', tabId: currentTabId });
      } catch (e) { showToast(e.message || 'Visual scan failed'); break; }
      if (!vis?.ok) { showToast(vis?.error || 'Visual scan failed'); break; }
      if (!vis.findings?.length) { showToast('No visual-only issues found'); break; }
      lastJudgmentFindings = [...lastJudgmentFindings, ...vis.findings];
      const list = document.getElementById('judgment-list');
      const container = document.getElementById('judgment-container');
      if (list && container) {
        for (const f of vis.findings) list.appendChild(createJudgmentCard(f));
        container.classList.remove('hidden');
      }
      showToast(`${vis.findings.length} visual-only issue${vis.findings.length > 1 ? 's' : ''} found`);
      break;
    }

    case 'transcript': {
      const sr = await sendMessage({ action: 'screenreader-scan', tabId: currentTabId });
      if (!sr?.ok || !sr.transcript?.length) { showToast('Could not read the page'); break; }
      downloadFile(
        globalThis.ScreenReader.renderTranscriptMarkdown(sr.transcript, sr.url),
        `screen-reader-preview-${new Date().toISOString().slice(0, 10)}.md`,
        'text/markdown'
      );
      const unnamed = sr.transcript.filter(l => l.unnamed).length;
      showToast(unnamed ? `${sr.transcript.length} announcements — ${unnamed} unnamed` : `${sr.transcript.length} announcements`);
      break;
    }

    case 'crawl':
      await runSiteCrawl();
      break;

    case 'badge': {
      const svg = globalThis.Badge.buildBadgeSvg({ score: currentAnalysis.auditScore || 0 });
      const embed = globalThis.Badge.buildBadgeEmbed({
        score: currentAnalysis.auditScore || 0, pageUrl: currentAnalysis.metadata?.url || '', svg
      });
      // The markdown embed already carries a working, self-contained data-URI
      // image — nothing for the user to manually substitute. The raw .svg is
      // included too, for anyone who'd rather host the file than inline it.
      downloadFile(
        `${embed}\n\n<!-- Raw SVG, if you'd rather host the file than inline it: -->\n${svg}`,
        `sitescope-badge-${new Date().toISOString().slice(0, 10)}.md`,
        'text/markdown'
      );
      showToast('Badge downloaded — ready to paste, no editing needed');
      break;
    }

    case 'github-pr': {
      const entries = (currentAnalysis.issues || [])
        .map(issue => ({ issue, fix: suggestionCache.get(issue.id), verified: verifiedIssueIds.has(issue.id) }))
        .filter(e => e.fix);
      if (!entries.length) { showToast('No fixes generated yet — apply or generate at least one fix first'); break; }

      const granted = await chrome.permissions.request({ origins: ['https://api.github.com/*'] }).catch(() => false);
      if (!granted) { showToast('GitHub access permission is needed to open a PR'); break; }

      const pageUrl = currentAnalysis.metadata?.url || '';
      const patchContent = globalThis.FixExport.buildSessionExport(entries, pageUrl, { verified: verifiedIssueIds.size });

      showToast('Opening pull request…', 4000);
      let res;
      try {
        res = await sendMessage({ action: 'github-open-pr', entries, pageUrl, patchContent });
      } catch (e) {
        showToast(e.message || 'Could not open the pull request');
        break;
      }
      if (!res?.ok) { showToast(res?.error || 'Could not open the pull request'); break; }

      showToast(`Pull request opened: #${res.number}`);
      window.open(res.url, '_blank', 'noopener');
      break;
    }

    case 'vpat': {
      const draft = globalThis.Vpat.buildVpatDraft({
        axeIssues: currentAnalysis.issues || [],
        otherFindings: lastJudgmentFindings || [],
        verifiedIds: [...verifiedIssueIds],
        pageUrl: currentAnalysis.metadata?.url || ''
      });
      downloadFile(
        brand(globalThis.Vpat.renderVpatMarkdown(draft)),
        `vpat-draft-${new Date().toISOString().slice(0, 10)}.md`,
        'text/markdown'
      );
      const openCount = draft.rows.filter(r => r.status === 'Does Not Support').length;
      showToast(openCount ? `VPAT draft downloaded — ${openCount} criteria show open issues` : 'VPAT draft downloaded');
      break;
    }

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
  const grade = getGrade(score, currentAnalysis?.counts);
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
        <strong>SiteScope 360</strong>
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
        <strong>SiteScope 360</strong><br>
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
  const grade = getGrade(score, currentAnalysis?.counts);
  
  let text = `♿ Accessibility Report\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Score: ${score}/100 (${grade.label})\n`;
  text += `Issues: ${analysis.totalViolations || 0} | Passed: ${analysis.totalPasses || 0}\n\n`;
  
  issues.forEach((issue, i) => {
    text += `${i+1}. [${(issue.severity || '').toUpperCase()}] ${issue.title || issue.id}\n`;
    if (issue.wcag?.length) text += `   WCAG: ${issue.wcag.join(', ')}\n`;
    text += '\n';
  });

  text += `\n— Generated by SiteScope 360`;

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
    els.quickWins.classList.add('hidden');
    els.seoCrossover.classList.add('hidden');
    els.improvementInsights.classList.add('hidden');
    return;
  }

  els.tipsEmpty.classList.add('hidden');

  const issues = currentAnalysis.issues || [];
  const score = currentAnalysis.auditScore || 0;
  const issueIds = issues.map(i => i.id);

  // ── 1. Business Impact Insights (top — most eye-opening) ──
  renderImprovementInsights(issues, score);

  // ── 2. Quick Wins ──
  renderQuickWins(issues);

  // ── 4. SEO Crossover ──
  renderSEOCrossover(issues);
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

  // Show the progress bar immediately
  els.lhLoadingHint?.classList.remove('hidden');
  startLhProgressBar();

  // Show skeleton loaders immediately
  renderChecklistLighthouse();
  renderLighthouseTab();
  renderDashboardLhRings();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const pageUrl = tab?.url;

    if (!pageUrl || pageUrl.startsWith('chrome://') || pageUrl.startsWith('chrome-extension://') ||
        pageUrl.startsWith('about:') || pageUrl.startsWith('file:')) {
      lighthouseLoading = false;
      lighthouseData = { error: 'Cannot analyze internal pages' };
      completeLhProgressBar(false);
      renderChecklistLighthouse();
      renderLighthouseTab();
      renderDashboardLhRings();
      return;
    }

    // Ask service worker — responds immediately with cache hit OR 'fetching'
    // (SW never blocks on the network; it pushes `lighthouse-ready` when done)
    const result = await sendMessage({ action: 'fetch-lighthouse', url: pageUrl });

    if (result?.status === 'ready' && result.data) {
      // Cache hit — instant result
      lighthouseLoading = false;
      lighthouseData = result.data;
      completeLhProgressBar(true);
      renderChecklistLighthouse();
      renderLighthouseTab();
      renderDashboardLhRings();
      renderUXPerfTab();
      upgradeScoreCardWithLighthouse();
      return; // done
    }

    if (result?.status === 'error') {
      lighthouseLoading = false;
      lighthouseData = { error: result.error };
      completeLhProgressBar(false);
      renderChecklistLighthouse();
      renderLighthouseTab();
      renderDashboardLhRings();
      renderUXPerfTab();
      return;
    }

    // status === 'fetching' — SW is working, we wait for the `lighthouse-ready` push.
    // We poll using fetch-lighthouse (not get-lighthouse) so that if the MV3 service worker
    // was killed and restarted mid-fetch, the poll automatically re-kicks the fetch.
    let pollCount = 0;
    const pollTimer = setInterval(async () => {
      pollCount++;
      if (!lighthouseLoading) { clearInterval(pollTimer); return; }
      // fetch-lighthouse: returns 'ready' (cache hit), 'fetching' (in-progress or re-kicked), or 'error'
      const polled = await sendMessage({ action: 'fetch-lighthouse', url: pageUrl });
      if (polled?.status === 'ready' && polled.data) {
        clearInterval(pollTimer);
        lighthouseLoading = false;
        lighthouseData = polled.data;
        completeLhProgressBar(true);
        renderChecklistLighthouse();
        renderLighthouseTab();
        renderDashboardLhRings();
        renderUXPerfTab();
        upgradeScoreCardWithLighthouse();
      } else if (polled?.status === 'error') {
        clearInterval(pollTimer);
        lighthouseLoading = false;
        lighthouseData = { error: polled.error };
        completeLhProgressBar(false);
        renderChecklistLighthouse();
        renderLighthouseTab();
        renderDashboardLhRings();
        renderUXPerfTab();
      } else if (pollCount >= 40) { // 40 × 3s = 2 min max wait
        clearInterval(pollTimer);
        lighthouseLoading = false;
        lighthouseData = { error: 'Timed out waiting for Lighthouse' };
        completeLhProgressBar(false);
        renderChecklistLighthouse();
        renderLighthouseTab();
        renderDashboardLhRings();
        renderUXPerfTab();
      }
    }, 3000);

    // Update status label after 30s to reassure user
    setTimeout(() => {
      if (lighthouseLoading) {
        const status = document.getElementById('lh-fetch-status');
        if (status) status.textContent = 'Large page — still working…';
        if (els.lhTabLoadingHint) {
          els.lhTabLoadingHint.textContent = 'Still fetching — large pages take longer…';
        }
      }
    }, 30000);
  } catch (e) {
    console.warn('fetchLighthouseScores error:', e.message);
    lighthouseLoading = false;
    lighthouseData = { error: e.message };
    completeLhProgressBar(false);
    renderChecklistLighthouse();
    renderLighthouseTab();
    renderDashboardLhRings();
  }
}

/**
 * Render Lighthouse section — skeleton while loading, real data when available
 */
/* ═══════ Lighthouse Dedicated Tab ═══════ */

function renderLighthouseTab() {
  if (!els.lhTabScores) return;

  // Loading state — only show spinner when data has NOT arrived yet
  const lhHasData = lighthouseData && !lighthouseData.error;
  if (!lhHasData && !lighthouseData) {
    els.lhTabEmpty?.classList.add('hidden');
    els.lhTabLoading?.classList.remove('hidden');
    els.lhTabScores.innerHTML = '';
    els.lhTabVitals?.classList.add('hidden');
    els.lhTabDiagnostics?.classList.add('hidden');
    els.lhTabPassed?.classList.add('hidden');
    els.lhTabStatus.textContent = 'Loading…';
    els.lhTabStatus.className = 'status-pill loading';
    return;
  }

  els.lhTabLoading?.classList.add('hidden');

  // Error state
  if (lighthouseData.error) {
    els.lhTabEmpty?.classList.add('hidden');
    els.lhTabStatus.textContent = 'Error';
    els.lhTabStatus.className = 'status-pill error';
    const isRateLimit = lighthouseData.error.toLowerCase().includes('rate limit');
    els.lhTabScores.innerHTML = `
      <div class="lh-error">
        ${escapeHtml(lighthouseData.error)}
        ${isRateLimit ? `<div class="lh-error-action">
          <button class="action-chip" id="lh-goto-settings" style="margin-top:8px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Add API Key in Settings
          </button>
        </div>` : ''}
      </div>`;
    document.getElementById('lh-goto-settings')?.addEventListener('click', () => showSettings());
    els.lhTabVitals?.classList.add('hidden');
    els.lhTabDiagnostics?.classList.add('hidden');
    els.lhTabPassed?.classList.add('hidden');
    return;
  }

  // Success — render full report
  els.lhTabEmpty?.classList.add('hidden');
  els.lhTabStatus.textContent = 'Live';
  els.lhTabStatus.className = 'status-pill live';

  // Show the URL being analyzed
  if (els.lhTabUrl && currentAnalysis?.url) {
    try {
      const u = new URL(currentAnalysis.url);
      els.lhTabUrl.textContent = u.hostname + u.pathname;
    } catch { els.lhTabUrl.textContent = currentAnalysis.url || ''; }
  }

  // ── Category score rings ──
  const scores = [
    { label: 'Performance', score: lighthouseData.performance, icon: '⚡' },
    { label: 'Accessibility', score: lighthouseData.accessibility, icon: '♿' },
    { label: 'Best Practices', score: lighthouseData.bestPractices, icon: '✅' },
    { label: 'SEO', score: lighthouseData.seo, icon: '🔍' },
  ];

  els.lhTabScores.innerHTML = scores.map((s, i) => {
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
        <div class="lh-score-label">${s.icon} ${s.label}</div>
      </div>
    `;
  }).join('');

  // Animate rings
  setTimeout(() => {
    els.lhTabScores.querySelectorAll('.lh-ring-fg').forEach(ring => {
      const score = ring.dataset.score;
      ring.setAttribute('stroke-dasharray', `${score}, 100`);
    });
  }, 50);

  // ── Core Web Vitals ──
  const m = lighthouseData.metrics || {};
  const vitals = [
    { key: 'largest-contentful-paint', label: 'LCP', fullName: 'Largest Contentful Paint', good: 2500, poor: 4000, unit: 'ms' },
    { key: 'first-contentful-paint', label: 'FCP', fullName: 'First Contentful Paint', good: 1800, poor: 3000, unit: 'ms' },
    { key: 'total-blocking-time', label: 'TBT', fullName: 'Total Blocking Time', good: 200, poor: 600, unit: 'ms' },
    { key: 'cumulative-layout-shift', label: 'CLS', fullName: 'Cumulative Layout Shift', good: 0.1, poor: 0.25, unit: '' },
    { key: 'speed-index', label: 'SI', fullName: 'Speed Index', good: 3400, poor: 5800, unit: 'ms' },
    { key: 'interactive', label: 'TTI', fullName: 'Time to Interactive', good: 3800, poor: 7300, unit: 'ms' },
  ];

  const vitalsWithData = vitals.filter(v => m[v.key]);
  if (vitalsWithData.length > 0) {
    els.lhTabVitals?.classList.remove('hidden');
    els.lhTabVitalsGrid.innerHTML = vitalsWithData.map(v => {
      const metric = m[v.key];
      const numVal = metric.numericValue;
      const display = metric.displayValue || (numVal != null ? formatMetricValue(numVal, v.unit) : '—');
      let rating = 'good';
      if (numVal != null) {
        if (numVal > v.poor) rating = 'poor';
        else if (numVal > v.good) rating = 'needs-improvement';
      } else if (metric.score != null) {
        if (metric.score < 0.5) rating = 'poor';
        else if (metric.score < 0.9) rating = 'needs-improvement';
      }
      return `
        <div class="lh-vital-card ${rating}">
          <div class="lh-vital-header">
            <span class="lh-vital-abbr">${v.label}</span>
            <span class="lh-vital-indicator ${rating}"></span>
          </div>
          <div class="lh-vital-value">${display}</div>
          <div class="lh-vital-name">${v.fullName}</div>
          <div class="lh-vital-thresholds">
            <span class="lh-threshold good">Good: ≤${formatThreshold(v.good, v.unit)}</span>
            <span class="lh-threshold poor">Poor: &gt;${formatThreshold(v.poor, v.unit)}</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    els.lhTabVitals?.classList.add('hidden');
  }

  // ── Diagnostics (failing audits) ──
  const diags = lighthouseData.diagnostics || [];
  if (diags.length > 0) {
    els.lhTabDiagnostics?.classList.remove('hidden');
    els.lhTabDiagnosticsList.innerHTML = diags.slice(0, 30).map(d => {
      const scoreColor = d.score === null ? 'neutral' : d.score < 0.5 ? 'fail' : 'warn';
      const scorePercent = d.score !== null ? Math.round(d.score * 100) : '—';
      return `
        <div class="lh-diag-item ${scoreColor}">
          <div class="lh-diag-icon ${scoreColor}">
            ${scoreColor === 'fail' ? '✗' : scoreColor === 'warn' ? '△' : '—'}
          </div>
          <div class="lh-diag-content">
            <div class="lh-diag-title">${escapeHtml(d.title)}</div>
            ${d.displayValue ? `<div class="lh-diag-value">${escapeHtml(d.displayValue)}</div>` : ''}
            ${d.description ? `<div class="lh-diag-desc">${escapeHtml(d.description).substring(0, 120)}</div>` : ''}
          </div>
          <div class="lh-diag-score ${scoreColor}">${scorePercent}${typeof scorePercent === 'number' ? '%' : ''}</div>
        </div>
      `;
    }).join('');
  } else {
    els.lhTabDiagnostics?.classList.add('hidden');
  }

  // ── Passed audits (collapsible) ──
  const passed = lighthouseData.passedAudits || [];
  if (passed.length > 0) {
    els.lhTabPassed?.classList.remove('hidden');
    els.lhTabPassedCount.textContent = passed.length;
    els.lhTabPassedList.innerHTML = passed.map(p => `
      <div class="lh-passed-item">
        <span class="lh-passed-check">✓</span>
        <span class="lh-passed-title">${escapeHtml(p.title)}</span>
      </div>
    `).join('');

    // Toggle handler
    els.lhTabPassedToggle?.addEventListener('click', () => {
      els.lhTabPassedList.classList.toggle('collapsed');
      els.lhTabPassedToggle.classList.toggle('expanded');
    });
  } else {
    els.lhTabPassed?.classList.add('hidden');
  }
}

function formatMetricValue(value, unit) {
  if (unit === 'ms') {
    if (value >= 1000) return (value / 1000).toFixed(1) + ' s';
    return Math.round(value) + ' ms';
  }
  if (typeof value === 'number' && value < 1) {
    return value.toFixed(3);
  }
  return String(value);
}

function formatThreshold(value, unit) {
  if (unit === 'ms') {
    if (value >= 1000) return (value / 1000).toFixed(1) + 's';
    return value + 'ms';
  }
  return String(value);
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

  // Only act if the score card is visible (a scan has been run)
  if (els.scoreCard.classList.contains('hidden')) return;

  // ── DO NOT touch the main ring number, arc, grade, or status ──
  // The main ring always reflects the axe-core score (what was actually
  // found on this page). Lighthouse is a different methodology and a
  // different score — swapping the ring number would falsely imply the
  // page improved. Instead, show the LH A11Y score as a reference badge.

  // Keep source badge as axe-core — LH score shows in the rings header instead
  // (no change to scoreSource text here)

  // Populate dashboard rings with real Lighthouse scores
  renderDashboardLhRings();

  // Hide the loading hint
  els.lhLoadingHint.classList.add('hidden');

  // Refresh breakdown panel with Lighthouse data alongside axe score
  const axeScore = currentAnalysis?.auditScore || 0;
  renderScoreBreakdown(axeScore, lighthouseData);
}

/**
 * Render the expandable score breakdown panel.
 * Shows SiteScope 360 (axe-core) weighted score + Lighthouse benchmark scores.
 */
function renderScoreBreakdown(axeScore, lhData) {
  const rows = [];
  const grade = getGrade(axeScore, currentAnalysis?.counts);

  // 1. SiteScope 360 Score (axe-core weighted)
  rows.push(buildBreakdownRow(
    'SiteScope Score', axeScore,
    'axe-core', 'Severity-weighted ratio: pass weight ÷ (pass + violation weight) × 100. Critical costs 10pts, Serious 5, Moderate 2, Minor 1.'
  ));

  // 2. Grade card with what’s missing to reach the next level
  if (grade.missing?.length) {
    const nextLabel = grade.nextLevel ? `To reach Grade ${grade.nextLevel}:` : 'To reach 100:';
    rows.push(`
      <div class="breakdown-grade-card grade-${grade.class}">
        <div class="breakdown-grade-header">
          <span class="breakdown-grade-badge grade-${grade.class}">${grade.label}</span>
          <span class="breakdown-grade-summary">${grade.summary}</span>
        </div>
        <div class="breakdown-grade-next">${nextLabel}</div>
        <ul class="breakdown-grade-list">
          ${grade.missing.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
        </ul>
      </div>`);
  }

  // 3. Lighthouse scores
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

  // 4. WCAG compliance hint
  const wcagLevel = axeScore >= 90 ? 'WCAG 2.1 AA — Likely Compliant' : axeScore >= 70 ? 'WCAG 2.1 AA — Partial' : 'WCAG 2.1 AA — Needs Work';
  const wcagClass = axeScore >= 90 ? 'green' : axeScore >= 70 ? 'orange' : 'red';
  rows.push(`<div class="breakdown-row wcag-row"><span class="breakdown-label">WCAG Level</span><span class="breakdown-wcag ${wcagClass}">${wcagLevel}</span></div>`);

  // 5. Formula explanation
  rows.push(`
    <div class="breakdown-formula">
      <div class="formula-title">ℹ️ How the SiteScope Score is calculated</div>
      <div class="formula-line"><span class="formula-code">Score = pass‑weight ÷ (pass‑weight + violation‑weight) × 100</span></div>
      <div class="formula-detail">Violations are weighted by severity (not subtracted):</div>
      <div class="formula-chips">
        <span class="fchip critical">Critical ×10</span>
        <span class="fchip serious">Serious ×5</span>
        <span class="fchip moderate">Moderate ×2</span>
        <span class="fchip minor">Minor ×1</span>
      </div>
      <div class="formula-detail">Incomplete / needs-review items are <em>not</em> penalised.</div>
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
  const cards = [];
  const counts = currentAnalysis.counts || {};
  const totalIssues = issues.length;

  // ─── Card 1: Legal / compliance fire alarm ───────────────────────────────
  if (counts.critical > 0) {
    cards.push({
      urgency: 'critical',
      icon: '⚖️',
      stat: `${counts.critical}`,
      statLabel: `critical violation${counts.critical > 1 ? 's' : ''}`,
      title: `${counts.critical} critical violation${counts.critical > 1 ? 's' : ''} carry legal exposure`,
      // Corrected: the $55k–$150k figures are DOJ civil penalty *maximums* for a
      // first and subsequent violation — not costs incurred before proceedings.
      // The previous copy also claimed every 2023 lawsuit began with a critical
      // violation, which is not something anyone can know.
      desc: `Around 4,600 web accessibility lawsuits were filed in the US in 2023 (UsableNet). The ADA, Canada's AODA and the EU's EN 301 549 apply regardless of company size, and DOJ civil penalties for ADA violations run up to $75,000 for a first violation and $150,000 for subsequent ones. Critical violations are the ones that block assistive technology outright, so they carry the most exposure.`,
      cta: 'Address these first',
      ctaClass: 'icard-cta-critical',
      tags: [{ label: 'ADA Risk', cls: 'itag-legal' }, { label: 'EN 301 549', cls: 'itag-legal' }, { label: 'Fix First', cls: 'itag-urgent' }]
    });
  }

  // ─── Card 2: Audience reach ───────────────────────────────────────────────
  // The headline number here used to be `Math.round(totalIssues / 3) + 4` shown
  // as "~N% of visitors can't use your site" — a figure derived from the issue
  // count and presented as a measurement. Anyone who asked where it came from
  // would have discredited every other number on the screen. It now reports what
  // was actually measured, and cites the external statistic as what it is.
  if (totalIssues > 0) {
    const critAmt = counts.critical > 0
      ? ` including ${counts.critical} critical barrier${counts.critical > 1 ? 's' : ''} that block screen readers entirely`
      : '';
    cards.push({
      urgency: counts.critical > 0 ? 'high' : 'medium',
      icon: '',
      stat: `${totalIssues}`,
      statLabel: `barrier${totalIssues > 1 ? 's' : ''} found on this page`,
      title: 'Some visitors cannot complete tasks on this page',
      desc: `This page has ${totalIssues} accessibility issue${totalIssues > 1 ? 's' : ''}${critAmt}. Around 1 in 4 US adults has a disability (CDC), and working-age people with disabilities hold an estimated $490B in disposable income (American Institutes for Research). How much of that audience this page affects depends on your traffic — the count above is what was measured here.`,
      cta: 'Review these issues',
      ctaClass: 'icard-cta-high',
      tags: [{ label: `${totalIssues} measured`, cls: 'itag-revenue' }, { label: 'Reach', cls: 'itag-revenue' }, { label: 'Retention', cls: 'itag-perf' }]
    });
  }

  // ─── Card 3: Markup quality that search engines also read ─────────────────
  // Rewritten: the previous copy claimed "Google is penalising your site" and
  // that these issues "may be why you're on page 2". Accessibility is not a
  // Google ranking factor and there is no penalty — the claim was false and the
  // page-2 line was unfalsifiable. What IS true is that the same markup carries
  // meaning to both screen readers and crawlers, which is enough on its own.
  const seoIssues = issues.filter(i => ISSUE_IMPACT_MAP[i.id]?.seo);
  if (seoIssues.length > 0) {
    cards.push({
      urgency: 'medium',
      icon: '',
      stat: `${seoIssues.length}`,
      statLabel: `issue${seoIssues.length > 1 ? 's' : ''} also affecting markup quality`,
      title: 'These fixes improve how machines read the page',
      desc: `Alt text, heading structure and element labels describe your content to screen readers — and search crawlers read the same markup to understand what a page is about. Fixing these ${seoIssues.length} issue${seoIssues.length > 1 ? 's' : ''} improves both at once. Accessibility is not a Google ranking factor, so treat this as better-structured content rather than a ranking change.`,
      cta: 'Review these issues',
      ctaClass: 'icard-cta-high',
      tags: [{ label: 'Semantic markup', cls: 'itag-seo' }, { label: 'Crawlability', cls: 'itag-seo' }, { label: 'Shared fix', cls: 'itag-perf' }]
    });
  }

  // ─── Card 4: Brand trust erosion (contrast) ───────────────────────────────
  const contrastIssue = issues.find(i => i.id === 'color-contrast');
  if (contrastIssue) {
    const n = contrastIssue.elementCount || 'Multiple';
    cards.push({
      urgency: 'medium',
      icon: '',
      stat: `${n}`,
      statLabel: 'text elements fail contrast',
      title: `${n} text element${n === 1 ? '' : 's'} fall below the required contrast ratio`,
      // The 50ms credibility figure was attributed to Stanford; it is from
      // Lindgaard et al. at Carleton University, and it measures visual appeal
      // judgements rather than contrast specifically. Removed rather than fixed —
      // the measured failure count is the stronger argument on its own.
      desc: `WCAG requires 4.5:1 contrast for body text and 3:1 for large text. These ${n} element${n === 1 ? '' : 's'} fall below that, which affects readers with low vision, and anyone reading on a phone in daylight.`,
      cta: 'Review contrast',
      ctaClass: 'icard-cta-medium',
      tags: [{ label: 'Brand Trust', cls: 'itag-brand' }, { label: 'Mobile UX', cls: 'itag-perf' }, { label: 'Readability', cls: 'itag-brand' }]
    });
  }

  // ─── Card 5: Keyboard / screen reader users blocked ───────────────────────
  const ariaIssues  = issues.filter(i => i.id?.startsWith('aria-'));
  const kbIssues    = issues.filter(i => ['tabindex','focus','keyboard'].some(k => i.id?.includes(k)));
  const blockedCount = ariaIssues.length + kbIssues.length;
  if (blockedCount > 0) {
    cards.push({
      urgency: counts.critical > 0 ? 'high' : 'medium',
      icon: '',
      stat: `${blockedCount}`,
      statLabel: 'barriers for keyboard users',
      title: `${blockedCount} ARIA and focus issue${blockedCount > 1 ? 's' : ''} affect keyboard navigation`,
      desc: `People using a keyboard, a switch device, or a screen reader (JAWS, VoiceOver, NVDA) navigate by focus order and ARIA roles. These ${blockedCount} issue${blockedCount > 1 ? 's' : ''} make parts of the page harder or impossible to reach that way. Whether any given element is fully blocking depends on the assistive technology, so confirm with a keyboard-only pass.`,
      cta: 'Review these issues',
      ctaClass: 'icard-cta-medium',
      tags: [{ label: 'Screen Readers', cls: 'itag-legal' }, { label: 'JAWS / VoiceOver', cls: 'itag-brand' }, { label: `${blockedCount} barriers`, cls: 'itag-urgent' }]
    });
  }

  // ─── Card 6: Quick wins ROI ───────────────────────────────────────────────
  const quickWins = issues.filter(i => ISSUE_IMPACT_MAP[i.id]?.quickWin);
  const totalMins = quickWins.reduce((s, i) => s + (ISSUE_IMPACT_MAP[i.id]?.timeMin || 5), 0);
  if (quickWins.length > 0) {
    cards.push({
      urgency: 'low',
      icon: '',
      stat: `~${totalMins}min`,
      statLabel: 'estimated dev time',
      title: `${quickWins.length} fix${quickWins.length > 1 ? 'es' : ''} are single-line changes`,
      desc: `These are one-line code changes — alt text on an image, a <label> on a form field, an aria-label on a button. Each removes a real barrier. The time estimate assumes the markup is easy to locate in your codebase; templated or component-generated pages may take longer.`,
      cta: 'Start here',
      ctaClass: 'icard-cta-low',
      tags: [{ label: `${quickWins.length} fixes`, cls: 'itag-perf' }, { label: `~${totalMins}min`, cls: 'itag-perf' }, { label: 'Highest ROI', cls: 'itag-revenue' }]
    });
  }

  // ─── Card 7: Near-perfect encouragement ──────────────────────────────────
  if (score >= 90 && totalIssues <= 3) {
    cards.push({
      urgency: 'low',
      icon: '',
      stat: `${100 - score}pts`,
      statLabel: 'from a perfect automated score',
      title: `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} left on the automated checks`,
      // Removed advice to advertise "WCAG 2.1 AA compliance" in investor and
      // client materials off the back of an automated scan. Automated checks
      // cover roughly a third of WCAG, so that claim would not be supportable —
      // and the user, not this tool, carries the consequences of making it.
      desc: `Only ${totalIssues} issue${totalIssues !== 1 ? 's' : ''} remain on the automated checks. Worth knowing before you claim conformance anywhere: automated testing covers roughly a third of WCAG success criteria. A clean score here is a good sign, not a conformance statement — that needs manual keyboard and screen-reader review too.`,
      cta: 'Finish the automated checks',
      ctaClass: 'icard-cta-low',
      tags: [{ label: 'WCAG 2.1 AA', cls: 'itag-seo' }, { label: 'Trust Signal', cls: 'itag-brand' }, { label: 'Top 3%', cls: 'itag-revenue' }]
    });
  }

  if (cards.length === 0) {
    els.improvementInsights.classList.add('hidden');
    return;
  }

  const urgencyRank = { high: 0, medium: 1, low: 2, critical: 3 };
  cards.sort((a, b) => (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9));

  els.improvementList.innerHTML = cards.map((c, idx) => `
    <div class="insight-card insight-card-${c.urgency}" style="animation-delay:${idx * 0.06}s">
      <div class="icard-accent"></div>
      <div class="icard-body">
        <div class="icard-top">
          <span class="icard-icon">${c.icon}</span>
          <div class="icard-stat-block">
            <span class="icard-stat">${escapeHtml(c.stat)}</span>
            <span class="icard-stat-label">${escapeHtml(c.statLabel)}</span>
          </div>
        </div>
        <div class="icard-title">${escapeHtml(c.title)}</div>
        <div class="icard-desc">${escapeHtml(c.desc)}</div>
        <div class="icard-footer">
          <div class="icard-tags">${c.tags.map(t => `<span class="itag ${t.cls}">${t.label}</span>`).join('')}</div>
          <span class="icard-cta ${c.ctaClass}">${escapeHtml(c.cta)} →</span>
        </div>
      </div>
    </div>
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
      if (lighthouseLoading) {
        return `<div class="checklist-detail-tip">⏳ Fetching Lighthouse scores from PageSpeed Insights — this takes 10–30s…</div>`;
      }
      if (lighthouseData?.error) {
        const isRateLimit = lighthouseData.error.toLowerCase().includes('rate limit');
        return `<div class="checklist-detail-tip">⚠️ ${escapeHtml(lighthouseData.error)}${isRateLimit ? ' — open ⚙️ Settings → Lighthouse to add your API key.' : ''}</div>`;
      }
      return `<div class="checklist-detail-tip">💡 Scores will appear here automatically after a scan completes.</div>`;
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
function renderDashboardLhRings() {
  if (!els.lhRings) return;

  const chevron = `<svg class="lh-rings-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`;

  const hasData  = lighthouseData && !lighthouseData.error;
  const hasError = !lighthouseLoading && lighthouseData?.error;

  // ── Error: hide entirely, mark tab failed ─────────────────────
  if (hasError) {
    els.lhRings.classList.add('hidden');
    els.lhRings.classList.remove('lh-rings--open');
    _markLhTabFailed(lighthouseData.error || 'Lighthouse unavailable');
    return;
  }

  // Make visible
  els.lhRings.classList.remove('hidden');

  // ── Loading: show progress bar only when data has NOT arrived yet ──
  if (!hasData) {
    els.lhRings.classList.remove('lh-rings--open');
    els.lhRings.innerHTML = `
      <div class="lh-rings-header">
        <span class="lh-rings-dot lh-rings-dot--pulse"></span>
        <span class="lh-rings-title">GOOGLE LIGHTHOUSE</span>
        <span class="lh-rings-fetching-inline">
          <span id="lh-fetch-status" class="lh-fetch-status-text">Fetching…</span>
          <span class="lh-mini-track"><span id="lh-mini-fill" class="lh-mini-fill"></span></span>
          <span id="lh-mini-pct" class="lh-mini-pct">0%</span>
        </span>
      </div>`;
    return;
  }

  // ── Success: lighthouseData is present and valid ───────────────
  lighthouseLoading = false; // ensure flag is consistent
  _markLhTabFailed(null);

  const scores = [
    { label: 'Performance',    score: lighthouseData.performance   },
    { label: 'Accessibility',  score: lighthouseData.accessibility  },
    { label: 'Best Practices', score: lighthouseData.bestPractices  },
    { label: 'SEO',            score: lighthouseData.seo            },
  ];

  els.lhRings.innerHTML = `
    <div class="lh-rings-header lh-rings-toggle" role="button" tabindex="0" aria-expanded="false">
      <span class="lh-rings-dot lh-rings-dot--green"></span>
      <span class="lh-rings-title">GOOGLE LIGHTHOUSE</span>
      ${chevron}
    </div>
    <div class="lh-rings-body">
      <div class="lh-rings-grid">
        ${scores.map((s, i) => {
          const colorClass = s.score >= 90 ? 'green' : s.score >= 50 ? 'orange' : 'red';
          const color = colorClass === 'green' ? 'var(--green)' : colorClass === 'orange' ? 'var(--orange)' : 'var(--red)';
          return `
            <div class="lh-ring-card just-arrived" style="animation-delay:${i * 0.08}s">
              <div class="cl-lh-ring ${colorClass}">
                <svg viewBox="0 0 36 36" class="cl-lh-svg">
                  <path class="cl-lh-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  <path class="cl-lh-fg ${colorClass}" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" data-score="${s.score}"/>
                </svg>
                <span class="cl-lh-num" style="color:${color}">${s.score}</span>
              </div>
              <div class="cl-lh-label">${s.label}</div>
            </div>`;
        }).join('')}
      </div>
      ${(() => {
        const m = lighthouseData.metrics || {};
        const vitals = [
          { key: 'largest-contentful-paint', name: 'Page Load Speed', good: 2500, poor: 4000 },
          { key: 'first-contentful-paint',   name: 'First Content',   good: 1800, poor: 3000 },
          { key: 'total-blocking-time',       name: 'Responsiveness',  good: 200,  poor: 600  },
          { key: 'cumulative-layout-shift',   name: 'Visual Stability',good: 0.1,  poor: 0.25 },
          { key: 'speed-index',               name: 'Visual Speed',    good: 3400, poor: 5800 },
          { key: 'interactive',               name: 'Interactive',     good: 3800, poor: 7300 },
        ];
        const statusLabel = (s) => s === 'good' ? 'Fast ✓' : s === 'avg' ? 'Needs work' : 'Slow ✗';
        const items = vitals.map(v => {
          const entry = m[v.key];
          if (entry == null) return '';
          const raw = typeof entry === 'object' ? entry.numericValue : entry;
          if (raw == null) return '';
          const display = (typeof entry === 'object' && entry.displayValue) ? entry.displayValue
            : (raw >= 1000 ? (raw / 1000).toFixed(1) + 's' : Math.round(raw) + 'ms');
          const status = raw <= v.good ? 'good' : raw <= v.poor ? 'avg' : 'poor';
          return `<div class="lh-vital-item lh-vital--${status}">
            <span class="lh-vital-name">${v.name}</span>
            <span class="lh-vital-status">${statusLabel(status)}</span>
            <span class="lh-vital-val">${display}</span>
          </div>`;
        }).filter(Boolean).join('');
        return items ? `<div class="lh-vitals-strip">${items}</div>` : '';
      })()}
    </div>`;

  // Auto-open with a tick delay so the transition fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      els.lhRings.classList.add('lh-rings--open');
      els.lhRings.querySelector('.lh-rings-toggle')?.setAttribute('aria-expanded', 'true');
      // Animate arcs after body has expanded
      setTimeout(() => {
        els.lhRings.querySelectorAll('.cl-lh-fg').forEach(ring => {
          ring.setAttribute('stroke-dasharray', `${ring.dataset.score}, 100`);
        });
      }, 80);
    });
  });

  // Click to toggle
  els.lhRings.querySelector('.lh-rings-toggle')?.addEventListener('click', () => {
    const isOpen = els.lhRings.classList.toggle('lh-rings--open');
    els.lhRings.querySelector('.lh-rings-toggle')?.setAttribute('aria-expanded', String(isOpen));
  });
}

function _markLhTabFailed(tip) {
  const btn = document.querySelector('.tab-btn[data-tab="ux-perf"]');
  if (!btn) return;
  btn.querySelectorAll('.tab-lh-fail').forEach(el => el.remove());
  if (tip) {
    const dot = document.createElement('span');
    dot.className = 'tab-lh-fail';
    dot.title = tip;
    btn.appendChild(dot);
    btn.classList.add('tab-lh-failed');
  } else {
    btn.classList.remove('tab-lh-failed');
  }
}

// LH rings removed from Checks tab — they live on the dashboard accordion instead.
function renderChecklistLighthouse() { /* no-op */ }

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
  if (!currentAnalysis?.issues) {
    showToast('Run a scan first');
    return;
  }
  
  if (highlightsActive) {
    await clearHighlights();
  } else {
    const issueCount = currentAnalysis.issues.length;
    console.log('[Popup] toggleHighlights: sending', issueCount, 'issues to tab', currentTabId);
    if (issueCount === 0) {
      showToast('No issues to highlight');
      return;
    }
    const response = await sendToContentScript(currentTabId, {
      type: 'highlight-issues',
      issues: currentAnalysis.issues.map(i => ({ ...i, isPageLevel: PAGE_LEVEL_RULES.has(i.id) }))
    });
    console.log('[Popup] Highlight response:', JSON.stringify(response));
    
    if (response?.ok) {
      highlightsActive = true;
      els.btnHighlight.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> On';
      els.btnHighlight.classList.add('active');
      els.btnHighlight.title = 'Highlights on — click to hide';
      showToast(`✅ ${response.highlighted || 0} elements highlighted`);
    } else {
      console.error('[Popup] Highlight failed:', response);
      showToast('❌ Highlight failed: ' + (response?.error || 'unknown'));
    }
  }
}

async function clearHighlights() {
  await sendToContentScript(currentTabId, { type: 'clear-highlights' });
  highlightsActive = false;
  els.btnHighlight.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Highlight';
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
  const savedProvider = response.llmProvider || (response.geminiApiKey ? 'gemini' : 'none');
  if (els.settingLlmProvider) els.settingLlmProvider.value = savedProvider;
  updateLlmProviderUI(savedProvider);
  if (els.settingLlmModel && response.llmModel) els.settingLlmModel.value = response.llmModel;
  els.settingGeminiApiKey.value = response.llmApiKey || response.geminiApiKey || '';
  els.settingAutoHighlight.checked = response.autoHighlight !== false;
  els.settingBadge.checked = response.showBadge !== false;
  refreshCostMeter();
  const ambientEl = document.getElementById('setting-ambient-scan');
  if (ambientEl) ambientEl.checked = response.ambientScanEnabled === true;

  const ghToken  = document.getElementById('setting-github-token');
  const ghOwner  = document.getElementById('setting-github-owner');
  const ghRepo   = document.getElementById('setting-github-repo');
  const ghBranch = document.getElementById('setting-github-branch');
  if (ghToken)  ghToken.value  = response.githubToken || '';
  if (ghOwner)  ghOwner.value  = response.githubOwner || '';
  if (ghRepo)   ghRepo.value   = response.githubRepo  || '';
  if (ghBranch) ghBranch.value = response.githubBaseBranch || 'main';
  els.settingPsApiKey.value = response.pagespeedApiKey || '';

  if (els.settingPrivacy.checked) {
    els.settingCloud.disabled = true;
  }
}

/* ── LLM provider/model config ── */
const LLM_PROVIDERS = {
  none:      { label: 'None',      models: [],                                                         hint: 'Using Chrome built-in AI or local server only.',           keyLink: '#',                                           keyPlaceholder: '' },
  gemini:    { label: 'Gemini',    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'], hint: 'Free tier: 15 req/min · 1,500 req/day',                  keyLink: 'https://aistudio.google.com/app/apikey',      keyPlaceholder: 'AIza…' },
  openai:    { label: 'OpenAI',    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4-turbo'],  hint: 'Pay-as-you-go. gpt-4o-mini is cheapest & fastest.',      keyLink: 'https://platform.openai.com/api-keys',        keyPlaceholder: 'sk-…' },
  anthropic: { label: 'Anthropic', models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'], hint: 'claude-3-5-haiku is fastest & most affordable.', keyLink: 'https://console.anthropic.com/settings/keys',  keyPlaceholder: 'sk-ant-…' },
  mistral:   { label: 'Mistral',   models: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'], hint: 'mistral-small is fast & low cost.',             keyLink: 'https://console.mistral.ai/api-keys/',        keyPlaceholder: 'your-mistral-key…' }
};

function updateLlmProviderUI(provider) {
  const cfg = LLM_PROVIDERS[provider] || LLM_PROVIDERS.none;
  const modelRow = document.getElementById('llm-model-row');
  const keyRow   = document.getElementById('llm-key-row');
  const hintEl   = document.getElementById('llm-provider-hint');
  const keyLink  = document.getElementById('llm-key-link');
  const keyInput = els.settingGeminiApiKey;

  // Update hint & key link
  if (hintEl) hintEl.textContent = cfg.hint;
  if (keyLink) { keyLink.href = cfg.keyLink; keyLink.textContent = cfg.keyLink === '#' ? '' : '(get key)'; }
  if (keyInput) keyInput.placeholder = cfg.keyPlaceholder || 'Paste your API key…';

  if (provider === 'none') {
    if (modelRow) modelRow.style.display = 'none';
    if (keyRow)   keyRow.style.display   = 'none';
    return;
  }
  if (modelRow) modelRow.style.display = '';
  if (keyRow)   keyRow.style.display   = '';

  // Rebuild model dropdown
  const modelSel = els.settingLlmModel;
  if (modelSel) {
    modelSel.innerHTML = cfg.models.map((m, i) =>
      `<option value="${m}"${i === 0 ? ' selected' : ''}>${m}${i === 0 ? ' ⭐' : ''}</option>`
    ).join('');
  }
}

async function validateLlmKey(provider, key, model) {
  const statusEl = document.getElementById('llm-key-status');
  if (!statusEl) return;
  if (!key || provider === 'none') { statusEl.textContent = ''; return; }
  statusEl.textContent = '⏳ Validating…';
  statusEl.style.color = 'var(--text-muted)';
  try {
    let res;
    if (provider === 'gemini') {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(key)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }] }) }
      );
    } else if (provider === 'openai') {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
      });
    } else if (provider === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: model || 'claude-3-5-haiku-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] })
      });
    } else if (provider === 'mistral') {
      res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: model || 'mistral-small-latest', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 })
      });
    }
    if (res && res.ok) {
      statusEl.textContent = `✓ Key valid — ${LLM_PROVIDERS[provider]?.label} connected`;
      statusEl.style.color = '#4ade80';
    } else {
      const err = await res?.json().catch(() => ({}));
      const msg = err?.error?.message || err?.message || `HTTP ${res?.status}`;
      statusEl.textContent = `✗ ${msg}`;
      statusEl.style.color = '#f87171';
    }
  } catch (e) {
    statusEl.textContent = '✗ Network error — check permissions';
    statusEl.style.color = '#f87171';
  }
}

async function saveCurrentSettings() {
  const provider = (els.settingLlmProvider?.value || 'gemini');
  const model    = (els.settingLlmModel?.value || '');
  const apiKey   = (els.settingGeminiApiKey.value || '').trim();
  await sendMessage({
    action: 'save-settings',
    settings: {
      privacyMode:    els.settingPrivacy.checked,
      cloudOptIn:     els.settingCloud.checked,
      localServerUrl: els.settingServerUrl.value,
      llmProvider:    provider,
      llmModel:       model,
      geminiApiKey:   provider === 'gemini'    ? apiKey : '',
      llmApiKey:      apiKey,
      autoHighlight:  els.settingAutoHighlight.checked,
      showBadge:      els.settingBadge.checked,
      pagespeedApiKey: (els.settingPsApiKey.value || '').trim(),
      githubToken:      (document.getElementById('setting-github-token')?.value || '').trim(),
      githubOwner:       (document.getElementById('setting-github-owner')?.value || '').trim(),
      githubRepo:        (document.getElementById('setting-github-repo')?.value || '').trim(),
      githubBaseBranch:  (document.getElementById('setting-github-branch')?.value || '').trim() || 'main'
    }
  });
  await validateLlmKey(provider, apiKey, model);
}

/* ═══════ LLM capabilities ═══════ */

async function detectCapabilities() {
  els.capOverall.textContent = '…';
  els.capWindowAI.textContent = '…';
  els.capGemini.textContent = '…';
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

  if (response.gemini) {
    els.capGemini.textContent = '✓ API key set';
    els.capGemini.className = 'cap-status ok';
  } else {
    els.capGemini.textContent = '✗ No API key';
    els.capGemini.className = 'cap-status no';
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
  const hasAI = response.windowAI || response.gemini || (response.localhost && response.localhostLLM) || els.settingCloud.checked;
  if (hasAI) {
    const source = response.windowAI ? 'Built-in AI'
                 : response.gemini ? 'Gemini API'
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
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Popup] sendMessage error:', chrome.runtime.lastError.message, 'for action:', msg.action);
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      console.error('[Popup] sendMessage threw:', err);
      resolve({ ok: false, error: err.message });
    }
  });
}

/**
 * Send a message DIRECTLY to the content script in the active tab.
 * Bypasses the service worker entirely — popup → content script.
 * Auto-injects scanner.js if the content script isn't responding.
 */
async function sendToContentScript(tabId, message) {
  if (!tabId) {
    console.error('[Popup] sendToContentScript: no tabId!');
    return { ok: false, error: 'No tab ID' };
  }
  console.log('[Popup] sendToContentScript:', message.type, 'to tab', tabId);

  // First attempt: try sending directly
  let response = await _tabSendMessage(tabId, message);
  console.log('[Popup] First attempt response:', JSON.stringify(response));
  if (response && response.ok === true) return response;

  // Content script not loaded — inject it
  console.log('[Popup] Content script not responding, injecting scanner.js...');
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/scanner.js']
    });
    // Wait longer for the script to initialize and register its listener
    await new Promise(r => setTimeout(r, 400));
  } catch (injectErr) {
    console.error('[Popup] Failed to inject content script:', injectErr);
    return { ok: false, error: 'Cannot inject: ' + injectErr.message };
  }

  // Retry after injection
  response = await _tabSendMessage(tabId, message);
  console.log('[Popup] Second attempt response:', JSON.stringify(response));
  return response;
}

function _tabSendMessage(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Popup] _tabSendMessage error:', chrome.runtime.lastError.message);
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { ok: false, error: 'No response' });
        }
      });
    } catch (err) {
      console.error('[Popup] _tabSendMessage threw:', err);
      resolve({ ok: false, error: err.message });
    }
  });
}

function showError(text) {
  els.errorText.textContent = text;
  els.error.classList.remove('hidden');
  setTimeout(() => els.error.classList.add('hidden'), 5000);
}

/* ═══════ UX & Performance Tab ═══════ */

function renderUXPerfTab() {
  const content = els.uxpContent;
  const empty   = els.uxpEmpty;
  if (!content || !empty) return;

  if (!currentAnalysis) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  content.classList.remove('hidden');

  const d      = currentAnalysis?.designInfo || {};
  const colors = d.colors || [];
  const fonts  = d.fonts  || [];
  const meta   = d.meta   || {};
  const tokens = d.tokens || {};
  const tech   = d.tech   || [];
  const issues = currentAnalysis?.issues || [];
  const lh     = lighthouseData;

  const uxCards   = buildUXInsightCards(colors, fonts, meta, tokens, issues);
  const lhReady = lighthouseData && !lighthouseData.error;
  const perfCards = (!lhReady && !lighthouseData)
    ? [{ status: 'loading', title: 'Fetching Lighthouse…', feedback: 'PageSpeed Insights is running in the background. Results will appear here automatically in 10–30 seconds.' }]
    : buildPerfInsightCards(lh, tech, fonts);
  const bpCards = (!lhReady && !lighthouseData)
    ? [{ status: 'loading', title: 'Fetching Lighthouse…', feedback: 'Best Practices audit will appear here once Lighthouse completes.' }]
    : buildBestPracticesCards(lh);

  content.innerHTML = `
    <div class="uxp-section">
      <div class="uxp-section-header">
        <div class="uxp-section-icon ux-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <div class="uxp-section-meta">
          <div class="uxp-section-title">UX Analysis</div>
        </div>
      </div>
      <div class="uxp-cards">${uxCards.map(c => renderUXPCard(c)).join('')}</div>
    </div>
    <div class="uxp-section">
      <div class="uxp-section-header">
        <div class="uxp-section-icon perf-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <div class="uxp-section-meta">
          <div class="uxp-section-title">Performance Review</div>
        </div>
      </div>
      <div class="uxp-cards">${perfCards.map(c => renderUXPCard(c)).join('')}</div>
    </div>
    <div class="uxp-section">
      <div class="uxp-section-header">
        <div class="uxp-section-icon bp-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="uxp-section-meta">
          <div class="uxp-section-title">Best Practices</div>
        </div>
      </div>
      <div class="uxp-cards">${bpCards.map(c => renderUXPCard(c)).join('')}</div>
    </div>
  `;
}

function renderUXPCard({ status, title, feedback, action, metric }) {
  const icon = status === 'good' ? '✓' : status === 'warning' ? '△' : status === 'loading' ? '…' : '✗';
  return `
    <div class="uxp-card ${escapeHtml(status)}">
      <div class="uxp-card-header">
        <span class="uxp-status-dot ${escapeHtml(status)}">${icon}</span>
        <span class="uxp-card-title">${escapeHtml(title)}</span>
        ${metric ? `<span class="uxp-card-metric">${escapeHtml(String(metric))}</span>` : ''}
      </div>
      <p class="uxp-card-feedback">${escapeHtml(feedback)}</p>
      ${action ? `<div class="uxp-card-action">💡 ${escapeHtml(action)}</div>` : ''}
    </div>`;
}

function buildUXInsightCards(colors, fonts, meta, tokens, issues) {
  const cards = [];

  // These cards report what was measured on the page. Aesthetic verdicts have
  // been removed deliberately: this tool measures a rendered DOM, which gives it
  // no standing to judge "design rigour" or call a palette a "hallmark of an
  // inconsistent design system". A designer who reads that dismisses the panel,
  // and the measurement — which is genuinely useful — goes with it.

  // 1. Colour Palette
  const colorCount = colors.length;
  if (colorCount > 20) {
    cards.push({ status: 'warning', title: 'Colour Palette',
      feedback: `${colorCount} distinct colours detected in computed styles. Large palettes are harder to keep consistent, though the count includes any colour used by third-party embeds and generated states.`,
      action: 'Check whether these map to a defined set of roles — primary, surface, text, error — or accumulated ad hoc.' });
  } else if (colorCount >= 4) {
    cards.push({ status: 'good', title: 'Colour Palette',
      feedback: `${colorCount} distinct colours detected.` });
  } else if (colorCount > 0) {
    cards.push({ status: 'good', title: 'Colour Palette',
      feedback: `${colorCount} distinct colour${colorCount === 1 ? '' : 's'} detected.` });
  }

  // 2. Typography
  const fontCount = fonts.length;
  if (fontCount > 3) {
    cards.push({ status: 'warning', title: 'Typography',
      feedback: `${fontCount} font families in computed styles. Each additional web font is a separate network request. Note that one family loaded at several weights, and fonts inside third-party embeds, both add to this count.`,
      action: 'Check how many are actually yours, and whether weight variations could replace a family.' });
  } else if (fontCount > 0) {
    cards.push({ status: 'good', title: 'Typography',
      feedback: `${fontCount} font famil${fontCount === 1 ? 'y' : 'ies'} detected.` });
  } else {
    cards.push({ status: 'good', title: 'Typography',
      feedback: 'No custom web fonts detected — the page uses system fonts, which load without an extra request.' });
  }

  // 3. Responsiveness
  const hasViewport = !!meta.viewport;
  if (hasViewport) {
    const vp = meta.viewport || '';
    const blocksZoom = vp.includes('user-scalable=no') || vp.includes('maximum-scale=1');
    if (blocksZoom) {
      cards.push({ status: 'critical', title: 'Zoom Accessibility Blocked',
        feedback: 'The viewport meta disables user zoom (user-scalable=no or maximum-scale=1). This is a critical UX violation — users with low vision depend on browser zoom. It also violates WCAG 1.4.4 and can be flagged in legal audits.',
        action: 'Remove user-scalable=no and maximum-scale=1 from the viewport meta tag immediately.' });
    } else {
      cards.push({ status: 'good', title: 'Viewport',
        feedback: 'Viewport meta is present and user zoom is enabled.' });
    }
  } else {
    cards.push({ status: 'critical', title: 'No Viewport Meta Tag',
      feedback: 'No viewport meta tag detected, so this page renders at desktop width on phones and requires pinch-and-pan to read. Mobile-friendliness is a confirmed Google ranking signal.',
      action: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to your <head>.' });
  }

  // 4. Contrast & Readability
  const contrastIssues = issues.filter(i => (i.id || '').includes('color-contrast'));
  const totalContrastElements = contrastIssues.reduce((s, i) => s + (i.elementCount || 1), 0);
  if (contrastIssues.length > 0) {
    const hasCritical = contrastIssues.some(i => i.severity === 'critical' || i.severity === 'serious');
    cards.push({ status: hasCritical ? 'critical' : 'warning', title: 'Contrast',
      feedback: `${totalContrastElements} element${totalContrastElements === 1 ? '' : 's'} fall below the required contrast ratio. WCAG requires 4.5:1 for body text and 3:1 for large text.`,
      action: 'Check text and background pairs with a contrast checker — browser DevTools has one built in.' });
  } else {
    cards.push({ status: 'good', title: 'Contrast',
      feedback: 'No contrast failures detected in the automated check. Text over images and gradients often cannot be measured automatically, so spot-check those by eye.' });
  }

  // 5. Design tokens — reported as an observation, not a prescription. Whether a
  // site should use CSS custom properties is an architecture decision that
  // depends on context this tool cannot see.
  const tokenCount = Object.keys(tokens).length;
  if (tokenCount > 10) {
    cards.push({ status: 'good', title: 'CSS Custom Properties',
      feedback: `${tokenCount} CSS custom properties detected, which usually indicates a token-driven stylesheet.` });
  } else if (tokenCount > 0) {
    cards.push({ status: 'good', title: 'CSS Custom Properties',
      feedback: `${tokenCount} CSS custom propert${tokenCount === 1 ? 'y' : 'ies'} detected.` });
  } else {
    cards.push({ status: 'good', title: 'CSS Custom Properties',
      feedback: 'No CSS custom properties detected. Styling values appear to be set directly rather than through tokens.' });
  }

  return cards;
}

function buildPerfInsightCards(lh, tech = [], fonts = []) {
  const cards = [];

  if (!lh || lh.error) {
    const isRateLimit = lh?.error?.toLowerCase().includes('rate limit');
    const isInternal  = lh?.error?.toLowerCase().includes('internal');
    if (isRateLimit) {
      cards.push({ status: 'critical', title: 'Rate Limited',
        feedback: 'Google is rate-limiting anonymous PageSpeed requests. Add a free API key in Settings — takes 30 seconds and gives you 25,000 free requests/day.',
        action: 'Open ⚙️ Settings → Lighthouse → paste your free API key from console.cloud.google.com' });
    } else if (isInternal) {
      cards.push({ status: 'warning', title: 'Page Not Publicly Accessible',
        feedback: 'PageSpeed Insights can only analyse publicly accessible URLs. Local (localhost), intranet, or file:// pages cannot be reached by Google\'s servers.',
        action: 'Deploy your page or test on a publicly accessible staging URL.' });
    } else if (lh?.error) {
      cards.push({ status: 'warning', title: 'Lighthouse Unavailable',
        feedback: lh.error });
    } else {
      cards.push({ status: 'warning', title: 'Waiting for Lighthouse',
        feedback: 'Performance data is being fetched in the background. This takes 10–30 seconds. Results will appear here automatically when ready.' });
    }
    // Still show tech & font cards even without Lighthouse
    _buildTechPerfCards(cards, tech, fonts);
    return cards;
  }

  const perfScore = lh.performance || 0;
  const m        = lh.metrics || {};
  const diags    = lh.diagnostics || [];

  // 1. Overall Performance Score
  if (perfScore >= 90) {
    cards.push({ status: 'good', title: 'Performance Score', metric: `${perfScore}/100`,
      feedback: `Score ${perfScore}/100 — excellent. Your page loads fast, interacts quickly, and stays visually stable. This puts you in the top tier and directly improves Core Web Vitals rankings in Google Search.` });
  } else if (perfScore >= 50) {
    cards.push({ status: 'warning', title: 'Performance Score', metric: `${perfScore}/100`,
      feedback: `Score ${perfScore}/100 — needs work. Real users on mid-range devices or slower networks will experience perceptible delays. Every 100ms of latency can reduce conversion rates by 1%. Prioritise the largest opportunities first.`,
      action: 'Focus on LCP and TBT first — they have the highest user-perceived impact.' });
  } else {
    cards.push({ status: 'critical', title: 'Performance Score', metric: `${perfScore}/100`,
      feedback: `Score ${perfScore}/100 — critical. Severe performance issues are directly harming user retention and SEO rankings. Google uses Core Web Vitals as a ranking signal. Pages scoring below 50 typically suffer from unoptimised assets, render-blocking scripts, or zero caching strategy.`,
      action: 'Immediately audit: image sizes, render-blocking scripts/CSS, server response times (TTFB), and caching headers.' });
  }

  // 2. LCP
  const lcp = m['largest-contentful-paint'];
  if (lcp) {
    const lcpVal = lcp.numericValue;
    if (lcpVal <= 2500) {
      cards.push({ status: 'good', title: 'Largest Contentful Paint (LCP)', metric: lcp.displayValue,
        feedback: `LCP at ${lcp.displayValue} — within the good threshold (≤2.5s). Your largest above-the-fold element loads promptly. Maintain this by keeping hero images optimised and served from a CDN close to your users.` });
    } else if (lcpVal <= 4000) {
      cards.push({ status: 'warning', title: 'Largest Contentful Paint (LCP)', metric: lcp.displayValue,
        feedback: `LCP at ${lcp.displayValue} — needs improvement (target ≤2.5s). Common culprits: unoptimised hero images, render-blocking CSS, slow server TTFB, or missing resource hints (preload/preconnect).`,
        action: 'Preload your LCP image with <link rel="preload"> and serve it from a CDN. Eliminate render-blocking resources above the fold.' });
    } else {
      cards.push({ status: 'critical', title: 'Largest Contentful Paint (LCP)', metric: lcp.displayValue,
        feedback: `LCP at ${lcp.displayValue} — poor (>4s). Users are staring at an incomplete page for over 4 seconds. Root causes: large uncompressed images, synchronous third-party scripts blocking render, or slow server TTFB (>800ms).`,
        action: 'Fix TTFB first (server response), then image compression (WebP/AVIF), then remove render-blocking resources.' });
    }
  }

  // 3. CLS
  const cls = m['cumulative-layout-shift'];
  if (cls) {
    const clsVal = cls.numericValue;
    if (clsVal <= 0.1) {
      cards.push({ status: 'good', title: 'Layout Stability (CLS)', metric: clsVal?.toFixed(3),
        feedback: `CLS ${clsVal?.toFixed(3)} — stable. Elements don't jump as the page loads, signalling well-crafted HTML/CSS with explicit dimensions on images and embeds. Users can interact confidently without mis-clicking shifted elements.` });
    } else {
      cards.push({ status: clsVal > 0.25 ? 'critical' : 'warning', title: 'Layout Stability (CLS)', metric: clsVal?.toFixed(3),
        feedback: `CLS ${clsVal?.toFixed(3)} — layout is shifting${clsVal > 0.25 ? ' severely' : ''}. Images/ads/iframes without explicit dimensions, dynamically injected content, and web fonts causing FOUT are the primary causes. Every layout shift erodes user trust.`,
        action: 'Add explicit width/height to all images and iframes. Use font-display:swap and reserve space for dynamic content with min-height.' });
    }
  }

  // 4. Total Blocking Time
  const tbt = m['total-blocking-time'];
  if (tbt) {
    const tbtVal = tbt.numericValue;
    if (tbtVal <= 200) {
      cards.push({ status: 'good', title: 'Interactivity (TBT)', metric: tbt.displayValue,
        feedback: `TBT at ${tbt.displayValue} — the main thread is responsive. JavaScript is not blocking user input during load, meaning users can scroll and interact immediately.` });
    } else {
      cards.push({ status: tbtVal > 600 ? 'critical' : 'warning', title: 'Interactivity (TBT)', metric: tbt.displayValue,
        feedback: `TBT at ${tbt.displayValue} — main thread overloaded. JavaScript is blocking user input for extended periods. Large synchronous JS bundles, unoptimised third-party scripts, and missing code splitting are the usual culprits.`,
        action: 'Implement code splitting (dynamic import()), defer non-critical scripts, and move heavy computation to Web Workers.' });
    }
  }

  // 5. TTFB — Server Response Time
  const ttfb = m['server-response-time'];
  if (ttfb) {
    const ttfbVal = ttfb.numericValue;
    if (ttfbVal <= 800) {
      cards.push({ status: 'good', title: 'Server Response Time (TTFB)', metric: ttfb.displayValue,
        feedback: `TTFB at ${ttfb.displayValue} — your server responds quickly. Good hosting, caching, or a CDN edge network is in place. This is the foundation everything else builds on.` });
    } else {
      cards.push({ status: ttfbVal > 1800 ? 'critical' : 'warning', title: 'Server Response Time (TTFB)', metric: ttfb.displayValue,
        feedback: `TTFB at ${ttfb.displayValue} — server is slow to respond (target ≤800ms). This is a pure infrastructure problem: slow origin server, no CDN, unoptimised database queries, or cold-start serverless functions. It caps how fast every other metric can be.`,
        action: 'Add a CDN (Cloudflare, Vercel Edge, Fastly), enable server-side caching, and profile your slowest backend routes.' });
    }
  }

  // 6. DOM Size
  const domSize = m['dom-size'];
  if (domSize) {
    const nodeCount = domSize.numericValue;
    if (nodeCount <= 800) {
      cards.push({ status: 'good', title: 'DOM Complexity', metric: `${nodeCount} nodes`,
        feedback: `${nodeCount} DOM nodes — lean and efficient. The browser has less work to do for layout, style recalculation, and repaints. This directly benefits scroll performance and animation smoothness.` });
    } else if (nodeCount <= 1500) {
      cards.push({ status: 'warning', title: 'DOM Complexity', metric: `${nodeCount} nodes`,
        feedback: `${nodeCount} DOM nodes — approaching the danger zone (Lighthouse flags >1,500). Large DOMs slow down style recalculation, forced reflows, and memory usage. Common causes: rendering full lists without virtualisation, nested wrapper divs, and leaving hidden elements in the DOM.`,
        action: 'Virtualise long lists (react-window, TanStack Virtual), lazy-render off-screen sections, and audit deeply nested component trees.' });
    } else {
      cards.push({ status: 'critical', title: 'DOM Complexity', metric: `${nodeCount} nodes`,
        feedback: `${nodeCount} DOM nodes — critically large. Every scroll event, animation, and interaction triggers expensive browser recalculations across thousands of nodes. This is a primary cause of janky 60fps failures and high memory usage on mobile.`,
        action: 'Audit with Chrome DevTools Performance panel. Virtualise lists, defer off-screen content, and flatten deeply nested structures.' });
    }
  }

  // 7. Page Weight
  const pageWeight = m['total-byte-weight'];
  if (pageWeight) {
    const bytes = pageWeight.numericValue;
    const kb = Math.round(bytes / 1024);
    if (kb <= 1600) {
      cards.push({ status: 'good', title: 'Total Page Weight', metric: `${kb} KB`,
        feedback: `${kb} KB total transfer — well within budget. Lean pages load faster on every connection type and reduce data costs for users on mobile plans. Maintain this discipline as features are added.` });
    } else if (kb <= 4000) {
      cards.push({ status: 'warning', title: 'Total Page Weight', metric: `${kb} KB`,
        feedback: `${kb} KB total transfer — heavier than ideal (target ≤1,600 KB). Common culprits: uncompressed images, unminified JS/CSS bundles, large web fonts, and third-party scripts loading their own dependencies.`,
        action: 'Convert images to WebP/AVIF, enable Brotli/gzip on your server, audit bundle sizes with webpack-bundle-analyzer or similar.' });
    } else {
      cards.push({ status: 'critical', title: 'Total Page Weight', metric: `${kb} KB`,
        feedback: `${kb} KB total transfer — critically overweight. Users on 3G connections will wait 10+ seconds. This is often caused by shipping entire UI libraries when only a fraction is used, or embedding high-resolution images without compression.`,
        action: 'Audit with Chrome DevTools Network tab sorted by size. Aggressively tree-shake JS bundles and use next-gen image formats.' });
    }
  }

  // 8. JS Boot Time
  const bootup = m['bootup-time'];
  if (bootup) {
    const bootVal = bootup.numericValue;
    if (bootVal <= 2000) {
      cards.push({ status: 'good', title: 'JavaScript Execution', metric: bootup.displayValue,
        feedback: `JS executes in ${bootup.displayValue} — scripts parse and run quickly. Low boot time means the browser can begin rendering and responding to user input without waiting for heavy JavaScript processing.` });
    } else {
      cards.push({ status: bootVal > 5000 ? 'critical' : 'warning', title: 'JavaScript Execution', metric: bootup.displayValue,
        feedback: `JS takes ${bootup.displayValue} to execute — too slow. This directly delays Time to Interactive. Parsing and executing large bundles on every page load is expensive, especially on low-end mobile CPUs where execution can take 5× longer than on a desktop.`,
        action: 'Code-split aggressively. Defer non-critical scripts. Use dynamic import() for routes and heavy components. Profile with Chrome DevTools Coverage tab to find unused code.' });
    }
  }

  // 9. Top 5 Diagnostics
  const actionableDiags = diags.filter(d => d.score !== null && d.score < 0.9).slice(0, 5);
  if (actionableDiags.length > 0) {
    const diagFeedback = actionableDiags
      .map((d, i) => `${i + 1}. ${d.title}${d.displayValue ? ' — ' + d.displayValue : ''}`)
      .join('\n');
    cards.push({ status: 'warning', title: `${actionableDiags.length} Optimisation Opportunities`,
      feedback: `Lighthouse flagged these specific issues ranked by impact:\n${diagFeedback}`,
      action: 'Address these in order — the first item has the highest potential score improvement.' });
  }

  // 10. Tech stack & font loading (always shown)
  _buildTechPerfCards(cards, tech, fonts);

  return cards;
}

function _buildTechPerfCards(cards, tech, fonts) {
  // Analytics bloat
  const analyticsTools = (tech || []).filter(t => t.category === 'Analytics');
  if (analyticsTools.length >= 3) {
    cards.push({ status: 'warning', title: 'Analytics Overload', metric: `${analyticsTools.length} tools`,
      feedback: `${analyticsTools.map(t => t.name).join(', ')} — ${analyticsTools.length} analytics/tracking scripts detected. Each adds to main-thread blocking time and increases TBT. Multiple tools often collect overlapping data.`,
      action: 'Audit which analytics tools are actively used. Remove or consolidate. Load non-critical trackers with defer or load them after user interaction.' });
  }

  // Multiple frameworks
  const frameworks = (tech || []).filter(t => t.category === 'Framework');
  if (frameworks.length >= 2) {
    cards.push({ status: 'critical', title: 'Multiple JS Frameworks', metric: frameworks.map(f => f.name).join(' + '),
      feedback: `${frameworks.map(f => f.name).join(' and ')} detected simultaneously. Running multiple frontend frameworks is a serious architectural red flag — it dramatically inflates bundle size, increases parse time, and creates hydration conflicts. This is almost never intentional.`,
      action: 'Audit script loading. Ensure only one framework owns the UI. Remove legacy framework remnants from previous migrations.' });
  }

  // jQuery on a modern framework
  const hasJQuery  = (tech || []).some(t => t.name === 'jQuery');
  const hasModernFw = (tech || []).some(t => ['React','Vue','Angular','Svelte','Next.js','Nuxt'].includes(t.name));
  if (hasJQuery && hasModernFw) {
    cards.push({ status: 'warning', title: 'jQuery + Modern Framework',
      feedback: 'jQuery is loaded alongside a modern component framework. jQuery adds ~30 KB (minified+gzipped) and provides functionality already built into React/Vue/Angular. This is a common remnant of incremental migrations.',
      action: 'Audit jQuery usage. Replace $.ajax() with fetch(), DOM manipulation with framework state, and remove jQuery once no direct usages remain.' });
  }

  // Font loading
  const fontCount = (fonts || []).length;
  if (fontCount > 3) {
    cards.push({ status: 'warning', title: 'Web Font Load Cost', metric: `${fontCount} families`,
      feedback: `${fontCount} font families detected. Each web font is a render-blocking network request if not preloaded. More fonts = more requests, more bytes, and longer time before text becomes visible (FOUT/FOIT).`,
      action: 'Limit to 2 font families maximum. Use font-display:swap to prevent invisible text. Preload critical fonts with <link rel="preload">.' });
  } else if (fontCount === 0) {
    cards.push({ status: 'good', title: 'Web Font Load Cost',
      feedback: 'No web fonts detected — relying on system fonts. Zero font loading cost means text renders instantly with no network round-trips. Ideal for performance-critical applications.' });
  }
}

/**
 * Build Best Practices insight cards from Lighthouse data.
 * Covers Security, Efficiency, and UX/Correctness — matching what Lighthouse audits.
 */
function buildBestPracticesCards(lh) {
  const cards = [];

  if (!lh || lh.error) {
    cards.push({ status: 'warning', title: 'Best Practices Unavailable',
      feedback: lh?.error || 'Lighthouse data not yet available.' });
    return cards;
  }

  const bpScore = lh.bestPractices || 0;
  const diags   = lh.diagnostics   || [];
  const passed  = lh.passedAudits  || [];
  const allAudits = [...diags, ...passed];
  const byId = {};
  for (const a of allAudits) byId[a.id] = a;

  const ok    = (id) => byId[id]?.score === 1;
  const audit = (id) => byId[id];

  // ── Overall score ─────────────────────────────────────────────
  if (bpScore >= 90) {
    cards.push({ status: 'good', title: 'Best Practices Score', metric: `${bpScore}/100`,
      feedback: `Score ${bpScore}/100 — excellent. The page follows modern web standards: secure connections, no deprecated APIs, and clean browser hygiene.` });
  } else if (bpScore >= 50) {
    cards.push({ status: 'warning', title: 'Best Practices Score', metric: `${bpScore}/100`,
      feedback: `Score ${bpScore}/100 — some issues found. A few outdated or insecure patterns are in use. Fixing them improves security, compatibility, and user trust.` });
  } else {
    cards.push({ status: 'critical', title: 'Best Practices Score', metric: `${bpScore}/100`,
      feedback: `Score ${bpScore}/100 — serious issues. The page has multiple violations of modern web standards that affect security and reliability.` });
  }

  // ══ SECURITY ══════════════════════════════════════════════════

  if (ok('uses-https')) {
    cards.push({ status: 'good', title: '🔒 Secure Connection (HTTPS)',
      feedback: 'All resources are served over HTTPS. Data between the user and server is encrypted — protecting against interception. Required for service workers, geolocation, and most modern browser APIs.' });
  } else if (audit('uses-https')) {
    cards.push({ status: 'critical', title: '🔒 Insecure Connection (HTTP)',
      feedback: 'Resources are being loaded over HTTP. This exposes user data to interception and triggers browser "Not Secure" warnings, directly damaging trust.',
      action: 'Migrate all resources to HTTPS. Get a free TLS certificate from Let\'s Encrypt and redirect all HTTP traffic to HTTPS.' });
  }

  if (ok('csp-xss')) {
    cards.push({ status: 'good', title: '🛡️ Content Security Policy',
      feedback: 'A strict Content Security Policy (CSP) is in place — one of the most effective defences against Cross-Site Scripting (XSS). Injected malicious scripts are blocked from running.' });
  } else if (audit('csp-xss')) {
    cards.push({ status: 'warning', title: '🛡️ No Strict Content Security Policy',
      feedback: 'The page lacks a strict CSP. Without it, injected scripts can steal session cookies, redirect users, or exfiltrate data. Critical for any site handling user data or authentication.',
      action: 'Add a Content-Security-Policy HTTP header. Start with default-src \'self\' and progressively allow trusted origins. Use nonces for inline scripts.' });
  }

  if (ok('no-vulnerable-libraries')) {
    cards.push({ status: 'good', title: '📦 No Vulnerable Libraries',
      feedback: 'No JavaScript libraries with known CVEs detected. Keeping dependencies up to date is one of the most impactful and often overlooked security practices.' });
  } else if (audit('no-vulnerable-libraries')) {
    const a = audit('no-vulnerable-libraries');
    cards.push({ status: 'critical', title: '📦 Vulnerable Libraries Detected',
      feedback: `${a.displayValue || 'Known vulnerable JS libraries are in use.'} Attackers actively target sites using old jQuery, lodash, and similar libraries with known exploits.`,
      action: 'Run npm audit or check snyk.io. Update or replace vulnerable packages. Remove unused libraries entirely.' });
  }

  // ══ EFFICIENCY ════════════════════════════════════════════════

  if (ok('uses-http2')) {
    cards.push({ status: 'good', title: '⚡ HTTP/2 Protocol',
      feedback: 'Resources are served over HTTP/2. Multiplexed connections load multiple files in parallel over one connection — significantly faster than HTTP/1.1 which serialises requests.' });
  } else if (audit('uses-http2')) {
    const a = audit('uses-http2');
    cards.push({ status: 'warning', title: '⚡ Still Using HTTP/1.1',
      feedback: `${a.displayValue ? a.displayValue + '. ' : ''}HTTP/1.1 loads resources one at a time per connection. Upgrading to HTTP/2 typically reduces load time by 20–50% for pages with multiple assets.`,
      action: 'Enable HTTP/2 on your server, or use a CDN like Cloudflare, Vercel, or Netlify — all support HTTP/2 by default.' });
  }

  if (ok('no-document-write')) {
    cards.push({ status: 'good', title: '✅ No document.write()',
      feedback: 'No use of document.write() detected. This outdated API blocks HTML parsing. The page uses modern non-blocking DOM APIs instead.' });
  } else if (audit('no-document-write')) {
    cards.push({ status: 'warning', title: '⚠️ document.write() in Use',
      feedback: 'document.write() blocks HTML parsing — the browser pauses rendering while the script runs. On slow connections this can add seconds of delay and cannot be parallelised.',
      action: 'Replace with document.createElement() / appendChild(). Many legacy ad and analytics scripts still use this — audit all third-party scripts.' });
  }

  if (ok('errors-in-console')) {
    cards.push({ status: 'good', title: '✅ No Browser Console Errors',
      feedback: 'No JavaScript errors during page load. A clean console signals well-tested code. Console errors often indicate silently broken functionality that users experience without knowing.' });
  } else if (audit('errors-in-console')) {
    const a = audit('errors-in-console');
    cards.push({ status: 'warning', title: '⚠️ JavaScript Errors on Load',
      feedback: `${a.displayValue ? a.displayValue + '. ' : ''}JavaScript errors during load indicate broken code paths. Each error is a potential feature failure — broken forms, missing UI, or failed API calls users experience silently.`,
      action: 'Fix all errors in Chrome DevTools → Console before deployment. Add error monitoring (Sentry, Datadog) to catch regressions in production.' });
  }

  // ══ UX / CORRECTNESS ══════════════════════════════════════════

  if (ok('image-aspect-ratio')) {
    cards.push({ status: 'good', title: '🖼️ Images Correctly Proportioned',
      feedback: 'All images render at their natural aspect ratio — none are stretched or squashed.' });
  } else if (audit('image-aspect-ratio')) {
    const a = audit('image-aspect-ratio');
    cards.push({ status: 'warning', title: '🖼️ Images Displaying Incorrectly',
      feedback: `${a.displayValue ? a.displayValue + '. ' : ''}Images rendered at the wrong aspect ratio look unprofessional and signal a lack of QA. Common cause: CSS overriding dimensions without maintaining ratio.`,
      action: 'Add explicit width/height attributes to <img> elements. Use CSS object-fit: cover or aspect-ratio to control display without distortion.' });
  }

  if (ok('image-size-responsive')) {
    cards.push({ status: 'good', title: '📱 Images Sized for Device',
      feedback: 'Images are appropriately sized for the screen resolution. No oversized images are being downloaded and scaled down — saving bandwidth and load time, especially on mobile.' });
  } else if (audit('image-size-responsive')) {
    const a = audit('image-size-responsive');
    cards.push({ status: 'warning', title: '📱 Oversized Images for Screen',
      feedback: `${a.displayValue ? a.displayValue + '. ' : ''}Serving desktop-resolution images to mobile devices wastes 3–4× more bandwidth than needed and slows mobile load significantly.`,
      action: 'Use srcset and sizes attributes to serve appropriately-sized images per device. Image CDNs (Cloudinary, Imgix) automate this.' });
  }

  if (ok('deprecations')) {
    cards.push({ status: 'good', title: '✅ No Deprecated APIs',
      feedback: 'No deprecated browser APIs detected. The page uses supported, modern APIs that won\'t break in future browser updates.' });
  } else if (audit('deprecations')) {
    cards.push({ status: 'warning', title: '⚠️ Deprecated Browser APIs',
      feedback: 'Deprecated APIs are being called. These are scheduled for removal from browsers — they will silently break for users on updated browsers without warning.',
      action: 'Check Chrome DevTools → Console for deprecation warnings and replace each with the modern equivalent before browser support is dropped.' });
  }

  if (cards.length === 1) {
    cards.push({ status: 'good', title: 'Detailed Audit',
      feedback: 'No specific best-practice issues were flagged by Lighthouse for this page.' });
  }

  return cards;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
