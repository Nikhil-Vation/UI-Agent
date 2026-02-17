// Overlay Renderer — builds DOM for the Command Center overlay
// Renders score gauge, checklist, issue cards, priorities, and exports

import {
  escapeHtml,
  formatTimestamp,
  severityClass,
  computeChecklist,
  computeScore,
  getTopPriorityItems,
  getSuggestedFix,
  getPriority
} from '../ui/utils.js';

const DOM = {
  scoreText: null,
  scoreFill: null,
  checklistList: null,
  centerContent: null,
  emptyState: null,
  prioritiesList: null,
  exportJson: null,
  exportCopy: null,
  overlayUrl: null,
  overlayTimestamp: null,
  scanStatus: null,
  filterBtns: null
};

let activeFilters = {
  accessibility: true,
  ui: true,
  enrichment: true
};

let currentState = null;

export function initOverlay() {
  // Cache DOM
  DOM.scoreText = document.getElementById('score-text');
  DOM.scoreFill = document.querySelector('.score-gauge .gauge-fill');
  DOM.checklistList = document.getElementById('overlay-checklist');
  DOM.centerContent = document.getElementById('overlay-center-content');
  DOM.emptyState = document.getElementById('overlay-empty-state');
  DOM.prioritiesList = document.getElementById('overlay-priorities');
  DOM.exportJson = document.getElementById('overlay-export-json');
  DOM.exportCopy = document.getElementById('overlay-export-copy');
  DOM.overlayUrl = document.getElementById('overlay-url');
  DOM.overlayTimestamp = document.getElementById('overlay-timestamp');
  DOM.scanStatus = document.getElementById('overlay-scan-status');
  DOM.filterBtns = document.querySelectorAll('.filter-btn');

  // header controls (close/minimize)
  const root = document.getElementById('ui-agent-command-center');
  const btnMin = document.getElementById('overlay-minimize');
  const btnClose = document.getElementById('overlay-close');
  if (btnMin && root) {
    btnMin.addEventListener('click', () => {
      root.classList.toggle('collapsed');
    });
  }
  if (btnClose && root) {
    btnClose.addEventListener('click', () => {
      root.style.display = 'none';
    });
  }

  // Wire filter buttons
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      const filter = btn.dataset.filter;
      activeFilters[filter] = !activeFilters[filter];
      btn.classList.toggle('active', activeFilters[filter]);
      btn.setAttribute('aria-pressed', activeFilters[filter] ? 'true' : 'false');
      // Trigger render with updated filters
      if (currentState) renderOverlay(currentState);
    });
  });

  // Wire export buttons
  if (DOM.exportJson) {
    DOM.exportJson.addEventListener('click', () => {
      exportJSON();
    });
  }

  if (DOM.exportCopy) {
    DOM.exportCopy.addEventListener('click', () => {
      exportSummary();
    });
  }
}

export function renderOverlay(state) {
  currentState = state;
  try {
    // Score gauge
    if (DOM.scoreText) {
      const score = computeScore(state.accessibilityIssues || [], state.uiIssues || []);
      DOM.scoreText.textContent = String(score);
      if (DOM.scoreFill) DOM.scoreFill.style.setProperty('--score', score);
    }

    // Checklist
    renderChecklist(state.accessibilityIssues || []);

    // Metadata
    if (DOM.overlayUrl) DOM.overlayUrl.textContent = state.url || '—';
    if (DOM.overlayTimestamp) DOM.overlayTimestamp.textContent = state.timestamp ? formatTimestamp(state.timestamp) : '—';

    // Scan status
    if (DOM.scanStatus) {
      DOM.scanStatus.textContent = state.isLoading ? 'Scanning...' : (state.error ? `Error: ${state.error}` : 'Ready');
    }

    // Center panel: filtered issues
    renderIssueCards(state.accessibilityIssues || [], state.uiIssues || []);

    // Right sidebar: priorities
    renderPriorities(state.accessibilityIssues || [], state.uiIssues || []);
  } catch (e) {
    console.error('[overlay-render] render failed', e);
  }
}

function renderChecklist(accessibilityIssues) {
  try {
    if (!DOM.checklistList) return;
    const checklist = computeChecklist(accessibilityIssues);
    DOM.checklistList.innerHTML = '';

    for (const item of checklist) {
      const el = document.createElement('div');
      el.className = `checklist-item ${item.status === 'pass' ? 'pass' : 'fail'}`;
      el.setAttribute('role', 'listitem');

      const icon = document.createElement('span');
      icon.className = 'checklist-icon';
      icon.textContent = item.status === 'pass' ? '✓' : '✕';

      const label = document.createElement('span');
      label.className = 'checklist-label';
      label.textContent = item.label;

      el.appendChild(icon);
      el.appendChild(label);
      DOM.checklistList.appendChild(el);

      // micro-animation for state updates (subtle pop)
      el.classList.add('animate-in');
      setTimeout(() => { el.classList.remove('animate-in'); }, 420);
    }
  } catch (e) {
    console.error('[overlay-render] renderChecklist failed', e);
  }
}

function renderIssueCards(accessibilityIssues, uiIssues) {
  try {
    if (!DOM.centerContent || !DOM.emptyState) return;

    DOM.centerContent.innerHTML = '';

    const issues = [];

    // Collect filtered accessibility issues
    if (activeFilters.accessibility) {
      (Array.isArray(accessibilityIssues) ? accessibilityIssues : []).forEach((issue, idx) => {
        issues.push({
          source: 'accessibility',
          index: idx,
          id: issue.id || 'unknown',
          description: issue.description || '',
          impact: issue.impact || 'none',
          nodesCount: issue.nodesCount || 0,
          nodes: issue.nodes || []
        });
      });
    }

    // Collect filtered UI issues
    if (activeFilters.ui) {
      (Array.isArray(uiIssues) ? uiIssues : []).forEach((issue, idx) => {
        issues.push({
          source: 'ui',
          index: idx,
          type: issue.type || 'ui',
          description: issue.description || '',
          selector: issue.selector || ''
        });
      });
    }

    if (issues.length === 0) {
      DOM.centerContent.style.display = 'none';
      DOM.emptyState.hidden = false;
      return;
    }

    DOM.centerContent.style.display = 'flex';
    DOM.emptyState.hidden = true;

    // Render each issue card
    for (const issue of issues) {
      const card = document.createElement('div');
      card.className = 'overlay-issue-card';

      // Header
      const header = document.createElement('div');
      header.className = 'issue-card-header';

      const title = document.createElement('div');
      title.className = 'issue-card-title';
      title.textContent = issue.source === 'accessibility' ? issue.id : issue.type;

      const badges = document.createElement('div');
      badges.className = 'issue-card-badges';

      if (issue.source === 'accessibility') {
        const sevBadge = document.createElement('span');
        sevBadge.className = `overlay-badge badge--severity`;
        sevBadge.textContent = (issue.impact || 'none').toUpperCase();
        badges.appendChild(sevBadge);

        const priority = getPriority(issue);
        const priBadge = document.createElement('span');
        priBadge.className = `overlay-badge badge--priority-${priority}`;
        priBadge.textContent = priority.toUpperCase();
        badges.appendChild(priBadge);
      }

      header.appendChild(title);
      header.appendChild(badges);

      // Description
      const desc = document.createElement('div');
      desc.className = 'issue-card-description';
      desc.textContent = issue.description;

      card.appendChild(header);
      card.appendChild(desc);

      // Code section (affected nodes / selector)
      if (issue.source === 'accessibility' && issue.nodes && issue.nodes.length) {
        const codeSection = document.createElement('div');
        codeSection.className = 'code-section';

        const codeTitle = document.createElement('div');
        codeTitle.className = 'code-section-title';
        codeTitle.textContent = `Affected Selectors (${issue.nodes.length})`;

        const codeBlock = document.createElement('div');
        codeBlock.className = 'code-block';
        codeBlock.textContent = issue.nodes.join('\n');

        codeSection.appendChild(codeTitle);
        codeSection.appendChild(codeBlock);
        card.appendChild(codeSection);
      } else if (issue.source === 'ui' && issue.selector) {
        const codeSection = document.createElement('div');
        codeSection.className = 'code-section';

        const codeTitle = document.createElement('div');
        codeTitle.className = 'code-section-title';
        codeTitle.textContent = 'Selector';

        const codeBlock = document.createElement('div');
        codeBlock.className = 'code-block';
        codeBlock.textContent = issue.selector;

        codeSection.appendChild(codeTitle);
        codeSection.appendChild(codeBlock);
        card.appendChild(codeSection);
      }

      // AI Recommendation — prefer backend/LLM enrichment when present, fall back to deterministic hint
      if (activeFilters.enrichment) {
        const aiRec = document.createElement('div');
        aiRec.className = 'ai-recommendation';

        const aiTitle = document.createElement('div');
        aiTitle.className = 'ai-recommendation-title';
        aiTitle.textContent = 'AI Recommendation';

        const aiText = document.createElement('div');
        aiText.className = 'ai-recommendation-text';

        // prefer enrichment-provided fields when available
        const enrichedHint = issue.suggestedFix || issue.remediation || issue.howToFix || issue.fix || (issue.code && issue.code.fix) || issue.explanation || null;
        aiText.textContent = enrichedHint ? String(enrichedHint) : getSuggestedFix(issue);

        aiRec.appendChild(aiTitle);
        aiRec.appendChild(aiText);

        // If enrichment includes an explicit code fix / snippet, show it as a dedicated code block
        const codeFix = issue.fix || (issue.code && issue.code.fix) || issue.remediation || null;
        if (codeFix) {
          const fixSection = document.createElement('div');
          fixSection.className = 'code-section';

          const fixTitle = document.createElement('div');
          fixTitle.className = 'code-section-title';
          fixTitle.textContent = 'Proposed Fix';

          const fixBlock = document.createElement('div');
          fixBlock.className = 'code-block';
          fixBlock.textContent = String(codeFix);

          fixSection.appendChild(fixTitle);
          fixSection.appendChild(fixBlock);
          aiRec.appendChild(fixSection);
        }

        card.appendChild(aiRec);
      }

      DOM.centerContent.appendChild(card);
    }
  } catch (e) {
    console.error('[overlay-render] renderIssueCards failed', e);
  }
}

function renderPriorities(accessibilityIssues, uiIssues) {
  try {
    if (!DOM.prioritiesList) return;
    DOM.prioritiesList.innerHTML = '';

    const topIssues = getTopPriorityItems(accessibilityIssues, uiIssues, 3);

    if (!Array.isArray(topIssues) || topIssues.length === 0) {
      const empty = document.createElement('div');
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--ov-text-secondary)';
      empty.style.fontSize = '12px';
      empty.textContent = 'No issues';
      DOM.prioritiesList.appendChild(empty);
      return;
    }

    for (const issue of topIssues) {
      const item = document.createElement('div');
      item.className = 'priority-item';
      item.setAttribute('role', 'listitem');

      const itemTitle = document.createElement('div');
      itemTitle.className = 'priority-item-title';
      itemTitle.textContent = issue.source === 'accessibility' ? issue.id : issue.type;

      const itemMeta = document.createElement('div');
      itemMeta.className = 'priority-item-meta';
      if (issue.source === 'accessibility') {
        itemMeta.textContent = `${issue.nodesCount || 0} nodes • ${issue.impact || 'none'}`;
      } else {
        itemMeta.textContent = issue.selector || 'UI issue';
      }

      item.appendChild(itemTitle);
      item.appendChild(itemMeta);
      DOM.prioritiesList.appendChild(item);
    }
  } catch (e) {
    console.error('[overlay-render] renderPriorities failed', e);
  }
}

function exportJSON() {
  try {
    if (!currentState) return;
    const report = {
      timestamp: currentState.timestamp,
      url: currentState.url,
      score: computeScore(currentState.accessibilityIssues || [], currentState.uiIssues || []),
      accessibilityIssues: currentState.accessibilityIssues || [],
      uiIssues: currentState.uiIssues || []
    };

    const json = JSON.stringify(report, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ui-agent-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[overlay-render] exportJSON failed', e);
    alert('Failed to export JSON');
  }
}

function exportSummary() {
  try {
    if (!currentState) return;
    const score = computeScore(currentState.accessibilityIssues || [], currentState.uiIssues || []);
    const aCount = (currentState.accessibilityIssues || []).length;
    const uCount = (currentState.uiIssues || []).length;

    const summary = `
UI-Agent Audit Summary
======================
URL: ${currentState.url || 'N/A'}
Timestamp: ${formatTimestamp(currentState.timestamp)}
Score: ${score}/100

Accessibility Issues: ${aCount}
UI Issues: ${uCount}

Generated by UI-Agent
    `.trim();

    navigator.clipboard.writeText(summary).then(() => {
      alert('Summary copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy summary');
    });
  } catch (e) {
    console.error('[overlay-render] exportSummary failed', e);
  }
}

export default { initOverlay, renderOverlay, renderChecklist, renderIssueCards, renderPriorities };
