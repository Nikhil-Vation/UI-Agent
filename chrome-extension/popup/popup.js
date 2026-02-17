/**
 * Vation Agent Chrome Extension — Popup Controller V2
 * Enhanced with: Tabs, History, Export, Confetti, Filters,
 * Animated counters, Scan timer, Keyboard shortcuts
 */

/* ═══════ DOM refs ═══════ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
  
  // LLM status
  llmStatus:    $('#llm-status'),
  llmDot:       $('#llm-dot'),
  llmLabel:     $('#llm-label'),
  
  // Settings
  settingPrivacy:       $('#setting-privacy'),
  settingCloud:         $('#setting-cloud'),
  settingServerUrl:     $('#setting-server-url'),
  settingAutoHighlight: $('#setting-auto-highlight'),
  settingBadge:         $('#setting-badge'),
  
  // Capabilities
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

  // Tips tab
  tipsEmpty:         $('#tips-empty'),
  lighthouseEstimate:$('#lighthouse-estimate'),
  lighthouseBars:    $('#lighthouse-bars'),
  quickWins:         $('#quick-wins'),
  quickWinsList:     $('#quick-wins-list'),
  seoCrossover:      $('#seo-crossover'),
  seoCrossoverList:  $('#seo-crossover-list'),
  improvementInsights: $('#improvement-insights'),
  improvementList:   $('#improvement-list'),
};

/* ═══════ State ═══════ */
let currentTabId = null;
let currentAnalysis = null;
let highlightsActive = false;
let scanStartTime = null;
let activeFilter = 'all';

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
  els.badges.classList.add('hidden');
  els.tabBar.classList.add('hidden');
  els.quickActions.classList.add('hidden');
  els.filterBar.classList.add('hidden');

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

  const status = analysis.complianceStatus || 'Unknown';
  els.scoreStatus.textContent = status;
  els.scoreStatus.className = 'score-status ' + status.toLowerCase().replace(/\s+/g, '-');

  const total = analysis.totalViolations || 0;
  const passes = analysis.totalPasses || 0;
  els.scoreSummary.textContent = `${total} issue${total !== 1 ? 's' : ''} found · ${passes} checks passed`;

  // Scan time
  if (analysis._scanDuration) {
    els.scanTime.textContent = `⚡ Scanned in ${analysis._scanDuration}s`;
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
        <div class="no-issues-icon">🎉</div>
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

  li.innerHTML = `
    <div class="issue-card-header" data-idx="${idx}">
      <div class="issue-severity-dot ${severity}"></div>
      <div class="issue-info">
        <div class="issue-title">${escapeHtml(issue.title || issue.id)}</div>
        <div class="issue-meta">
          ${wcagTags.map(w => `<span class="issue-wcag">${escapeHtml(w)}</span>`).join('')}
          ${elemCount > 0 ? `<span class="issue-count-badge">${elemCount} element${elemCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="issue-actions">
        <button class="issue-btn locate-btn" data-selector="${escapeAttr(issue.selectors?.[0] || '')}" title="Locate on page">📍</button>
        <button class="issue-btn fix-btn" data-idx="${idx}" title="Get AI fix">Fix it ✨</button>
      </div>
    </div>
    <div class="issue-detail">
      <p>${escapeHtml(issue.description || '')}</p>
      ${issue.html?.[0] ? `<div class="issue-html">${escapeHtml(issue.html[0])}</div>` : ''}
      ${issue.helpUrl ? `<a href="${escapeAttr(issue.helpUrl)}" target="_blank" class="issue-help-link">Learn more →</a>` : ''}
    </div>
  `;

  // Toggle expand
  const header = li.querySelector('.issue-card-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.issue-btn')) return;
    li.classList.toggle('expanded');
  });

  // Locate button
  const locateBtn = li.querySelector('.locate-btn');
  locateBtn.addEventListener('click', () => {
    const selector = locateBtn.dataset.selector;
    if (selector) {
      sendMessage({ action: 'scroll-to', tabId: currentTabId, selector });
    }
  });

  // Fix button
  const fixBtn = li.querySelector('.fix-btn');
  fixBtn.addEventListener('click', () => handleFix(issue, fixBtn));

  return li;
}

/* ═══════ Fix handler ═══════ */

async function handleFix(issue, btn) {
  btn.classList.add('loading');
  btn.textContent = '⏳';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await sendMessage({
      action: 'fix',
      issue,
      pageUrl: tab?.url || '',
      tabId: currentTabId
    });

    if (!response?.ok || !response.fix) {
      throw new Error(response?.error || 'No fix generated');
    }

    showFixModal(response.fix, issue);
  } catch (err) {
    showError(`Fix failed: ${err.message}`);
  } finally {
    btn.classList.remove('loading');
    btn.textContent = 'Fix it ✨';
  }
}

/* ═══════ Fix All ═══════ */

async function handleFixAll() {
  if (!currentAnalysis?.issues?.length) return;

  els.btnFixAll.classList.add('active');
  els.btnFixAll.textContent = '⏳ Fixing…';
  let fixCount = 0;

  for (const issue of currentAnalysis.issues.slice(0, 5)) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await sendMessage({
        action: 'fix',
        issue,
        pageUrl: tab?.url || '',
        tabId: currentTabId
      });
      if (response?.ok) fixCount++;
    } catch { /* continue */ }
  }

  els.btnFixAll.classList.remove('active');
  els.btnFixAll.textContent = '✨ Fix All';
  showToast(`✨ Generated ${fixCount} fixes! Click individual "Fix it" buttons to view.`);
}

/* ═══════ Fix modal ═══════ */

function showFixModal(fix, issue) {
  els.fixTitle.textContent = fix.fixTitle || `Fix: ${issue.id}`;
  
  const sourceIcon = fix.private ? '🔒' : '☁️';
  const sourceClass = fix.private ? 'private' : 'cloud';
  const sourceLabel = fix.source || 'unknown';
  const confidence = fix.confidence ? `${Math.round(fix.confidence * 100)}%` : '—';
  
  els.fixBody.innerHTML = `
    <div class="fix-label">Before</div>
    <div class="fix-code before">${escapeHtml(fix.before || '(no code)')}</div>
    
    <div class="fix-label">After</div>
    <div class="fix-code after">${escapeHtml(fix.after || '(no suggestion)')}</div>
    
    <div class="fix-label">Explanation</div>
    <p class="fix-explanation">${escapeHtml(fix.explanation || '')}</p>
    
    <div class="fix-meta">
      <span class="fix-source">${sourceIcon} <span class="${sourceClass}">${sourceLabel}</span></span>
      <span>Effort: ${fix.effort || '—'}</span>
      <span>Confidence: ${confidence}</span>
    </div>
    
    <button class="fix-copy-btn" id="fix-copy">📋 Copy Fixed Code</button>
  `;

  const copyBtn = $('#fix-copy');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(fix.after || '');
      copyBtn.textContent = '✓ Copied!';
      showToast('✅ Code copied to clipboard');
      setTimeout(() => { copyBtn.textContent = '📋 Copy Fixed Code'; }, 2000);
    } catch {
      copyBtn.textContent = '⚠️ Copy failed';
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
          trend = entry.score > prev.score ? '📈' : entry.score < prev.score ? '📉' : '➡️';
        }
      }

      li.innerHTML = `
        <div class="history-score ${scoreClass}">${entry.score}</div>
        <div class="history-info">
          <div class="history-url" title="${escapeAttr(entry.url)}">${escapeHtml(shortUrl)}</div>
          <div class="history-meta">
            <span>${entry.issues} issues</span>
            <span>${ago}</span>
            ${entry.duration ? `<span>⚡${entry.duration}s</span>` : ''}
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
    showToast('⚠️ Run a scan first');
    return;
  }

  switch (format) {
    case 'json':
      downloadFile(
        JSON.stringify(currentAnalysis, null, 2),
        `a11y-report-${Date.now()}.json`,
        'application/json'
      );
      showToast('📋 JSON report downloaded');
      break;

    case 'csv':
      downloadFile(
        generateCSV(currentAnalysis),
        `a11y-report-${Date.now()}.csv`,
        'text/csv'
      );
      showToast('📊 CSV report downloaded');
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
    showToast('📄 PDF report opened — use Print → Save as PDF');
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
        <strong>Vation Agent</strong>
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

    <!-- Footer -->
    <div class="report-footer">
      <div class="left">
        This report was generated locally. No data was sent to external servers.<br>
        Powered by axe-core accessibility testing engine.
      </div>
      <div class="right">
        <strong>Vation Agent</strong><br>
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

  text += `\n— Generated by Vation Agent`;

  try {
    await navigator.clipboard.writeText(text);
    showToast('📎 Report copied to clipboard!');
  } catch {
    showToast('⚠️ Failed to copy');
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
  { icon: '📝', title: 'Add meta description', desc: 'Add <meta name="description"> (150-160 chars) — appears in Google search snippets', tags: ['seo'], impact: 'high' },
  { icon: '🔗', title: 'Add canonical URL', desc: 'Add <link rel="canonical"> to prevent duplicate content issues', tags: ['seo'], impact: 'medium' },
  { icon: '📱', title: 'Open Graph tags', desc: 'Add og:title, og:description, og:image for rich social media previews', tags: ['seo'], impact: 'medium' },
  { icon: '📊', title: 'Structured data (JSON-LD)', desc: 'Add Schema.org structured data for rich search results (stars, FAQs, etc.)', tags: ['seo'], impact: 'high' },
  { icon: '⚡', title: 'Core Web Vitals', desc: 'LCP < 2.5s, INP < 200ms, CLS < 0.1 — these are Google ranking signals', tags: ['lighthouse', 'seo'], impact: 'high' },
  { icon: '📱', title: 'Mobile responsiveness', desc: 'Use responsive meta viewport, fluid layouts, and media queries — mobile-first indexing is default', tags: ['lighthouse', 'seo'], impact: 'high' },
  { icon: '🖼️', title: 'Lazy load images & iframes', desc: 'Add loading="lazy" to offscreen images/iframes — reduces initial load time and LCP', tags: ['lighthouse'], impact: 'high' },
  { icon: '🎯', title: 'Responsive images', desc: 'Use srcset + sizes for art-directed images — serve right size for each screen width', tags: ['lighthouse'], impact: 'medium' },
];

function renderTips() {
  if (!currentAnalysis || !currentAnalysis.issues) {
    els.tipsEmpty.classList.remove('hidden');
    els.lighthouseEstimate.classList.add('hidden');
    els.quickWins.classList.add('hidden');
    els.seoCrossover.classList.add('hidden');
    els.improvementInsights.classList.add('hidden');
    return;
  }

  els.tipsEmpty.classList.add('hidden');

  const issues = currentAnalysis.issues || [];
  const score = currentAnalysis.auditScore || 0;
  const issueIds = issues.map(i => i.id);

  // ── 1. Lighthouse Score Estimate ──
  renderLighthouseEstimate(score, issues);

  // ── 2. Quick Wins ──
  renderQuickWins(issues);

  // ── 3. SEO Crossover ──
  renderSEOCrossover(issues);

  // ── 4. Improvement Insights ──
  renderImprovementInsights(issues, score);
}

function renderLighthouseEstimate(score, issues) {
  const lhA11y = Math.min(100, Math.max(0, score + Math.floor(Math.random() * 5) - 2));

  // Estimate SEO impact from current issues
  let seoDeductions = 0;
  issues.forEach(i => {
    const impact = ISSUE_IMPACT_MAP[i.id];
    if (impact?.seo && impact.seoImpact === 'high') seoDeductions += 8;
    else if (impact?.seo && impact.seoImpact === 'medium') seoDeductions += 4;
  });
  const lhSEO = Math.min(100, Math.max(40, 92 - seoDeductions));

  // Best practices — rough estimate from issue types
  const ariaIssues = issues.filter(i => i.id?.startsWith('aria-') || i.id === 'duplicate-id').length;
  const lhBP = Math.min(100, Math.max(50, 95 - ariaIssues * 3));

  const bars = [
    { label: 'Accessibility', score: lhA11y },
    { label: 'SEO', score: lhSEO },
    { label: 'Best Practices', score: lhBP },
  ];

  els.lighthouseBars.innerHTML = bars.map(b => {
    const colorClass = b.score >= 90 ? 'green' : b.score >= 50 ? 'orange' : 'red';
    return `
      <div class="lh-bar-row">
        <span class="lh-bar-label">${b.label}</span>
        <div class="lh-bar-track">
          <div class="lh-bar-fill ${colorClass}" style="width: 0%"></div>
        </div>
        <span class="lh-bar-score ${colorClass}">${b.score}</span>
      </div>
    `;
  }).join('');

  // Animate bars after render
  setTimeout(() => {
    els.lighthouseBars.querySelectorAll('.lh-bar-fill').forEach((fill, idx) => {
      fill.style.width = `${bars[idx].score}%`;
    });
  }, 50);

  els.lighthouseEstimate.classList.remove('hidden');
}

function renderQuickWins(issues) {
  const wins = [];

  issues.forEach(issue => {
    const impact = ISSUE_IMPACT_MAP[issue.id];
    if (!impact?.quickWin) return;

    wins.push({
      icon: impact.seo ? '🎯' : '⚡',
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
      icon: impact.seoImpact === 'high' ? '🔴' : impact.seoImpact === 'medium' ? '🟡' : '🟢',
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
      icon: '🚨',
      title: `Fix ${counts.critical} critical issue${counts.critical > 1 ? 's' : ''}`,
      desc: `Score would jump from ${score} → ~${potentialScore}. Critical issues block compliance and can trigger legal risk (ADA Title III).`,
      tags: [{ text: `+${potentialScore - score} pts`, class: 'a11y' }, { text: 'HIGH PRIORITY', class: 'effort-l' }]
    });
  }

  // SEO crossover insight
  const seoIssueCount = issues.filter(i => ISSUE_IMPACT_MAP[i.id]?.seo).length;
  if (seoIssueCount > 0) {
    insights.push({
      icon: '🔍',
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
      icon: '⚡',
      title: `${quickFixableCount} issues fixable in ~${quickFixTime} minutes`,
      desc: `These are low-effort fixes that collectively have the biggest impact on your scores. Start here.`,
      tags: [{ text: `~${quickFixTime}min`, class: 'effort-s' }, { text: `${quickFixableCount} fixes`, class: 'lighthouse' }]
    });
  }

  // Heading structure insight
  if (issueIds.includes('heading-order') || issueIds.includes('empty-heading')) {
    insights.push({
      icon: '📑',
      title: 'Heading structure needs work',
      desc: 'Fixing heading hierarchy improves both SEO content signals and screen reader navigation. Use one h1, then h2→h3 sequentially.',
      tags: [{ text: 'A11y', class: 'a11y' }, { text: 'SEO', class: 'seo' }]
    });
  }

  // ARIA cleanup insight
  const ariaIssues = issues.filter(i => i.id?.startsWith('aria-'));
  if (ariaIssues.length > 0) {
    insights.push({
      icon: '🏷️',
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
      icon: '🎨',
      title: `Color contrast fails on ${elemCount} element${elemCount !== 1 ? 's' : ''}`,
      desc: 'Low contrast affects 8% of men (color blindness) and everyone in bright sunlight. Fix text to ≥4.5:1 ratio. This also reduces bounce rate — an indirect SEO signal.',
      tags: [{ text: 'A11y', class: 'a11y' }, { text: `${elemCount} elements`, class: 'effort-m' }]
    });
  }

  // Perfect score encouragement
  if (score >= 90 && issues.length <= 3) {
    insights.push({
      icon: '🏆',
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
  }
}

async function clearHighlights() {
  await sendMessage({ action: 'clear-highlights', tabId: currentTabId });
  highlightsActive = false;
  els.btnHighlight.textContent = '👁️ Highlight';
  els.btnHighlight.classList.remove('active');
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
      showBadge: els.settingBadge.checked
    }
  });
}

/* ═══════ LLM capabilities ═══════ */

async function detectCapabilities() {
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
    const model = response.localhostModel ? ` (${response.localhostModel})` : '';
    els.capLocalhost.textContent = response.localhostLLM ? `✓ Connected${model}` : '⚠ No LLM';
    els.capLocalhost.className = response.localhostLLM ? 'cap-status ok' : 'cap-status partial';
  } else {
    els.capLocalhost.textContent = '✗ Offline';
    els.capLocalhost.className = 'cap-status no';
  }

  els.capCloud.textContent = els.settingCloud.checked ? '✓ Opted in' : '✗ Opted out';
  els.capCloud.className = els.settingCloud.checked ? 'cap-status ok' : 'cap-status no';

  updateLLMStatusBar(response);
}

function updateLLMStatusBar(caps) {
  els.llmStatus.classList.remove('hidden');
  
  if (caps.windowAI || (caps.localhost && caps.localhostLLM)) {
    els.llmDot.className = 'llm-dot connected';
    const source = caps.windowAI ? 'Gemini Nano' : `Ollama${caps.localhostModel ? ` (${caps.localhostModel})` : ''}`;
    els.llmLabel.textContent = `🔒 Private AI: ${source}`;
  } else if (caps.localhost) {
    els.llmDot.className = 'llm-dot partial';
    els.llmLabel.textContent = '⚠ Server connected, no LLM loaded';
  } else {
    els.llmDot.className = 'llm-dot disconnected';
    els.llmLabel.textContent = 'Rule-based fixes only (no LLM)';
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
