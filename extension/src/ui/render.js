import State from './state.js';
import {
  formatTimestamp,
  severityClass,
  computeChecklist,
  computeScore,
  generateRecommendations,
  getTopPriorityItems,
  getSuggestedFix,
  getPriority,
  escapeHtml
} from './utils.js';

// Render module — reads state from State and updates the DOM (defensive, non-throwing).
// Exposes modal controls for popup controller to call.
const DOM = {
  runBtn: null,
  spinner: null,
  status: null,
  scanUrl: null,
  scanTime: null,
  accessCount: null,
  uiCount: null,
  accessList: null,
  uiList: null,
  accessEmpty: null,
  uiEmpty: null,
  accessToggleCount: null,
  uiToggleCount: null,
  accessContainer: null,
  uiContainer: null,
  sectionToggles: null,
  checklistGrid: null,
  scoreValue: null,
  topPriorityList: null,
  recommendationsList: null,
  actionPlanList: null,
  modalOverlay: null,
  modal: null,
  modalBody: null,
  modalTitle: null,
  modalClose: null
};

export function init() {
  // Cache DOM references (single query per element)
  DOM.runBtn = document.getElementById('runBtn');
  DOM.spinner = document.getElementById('spinner');
  DOM.status = document.getElementById('status');
  DOM.scanUrl = document.getElementById('scanUrl');
  DOM.scanTime = document.getElementById('scanTime');
  DOM.accessCount = document.getElementById('accessCount');
  DOM.uiCount = document.getElementById('uiCount');
  DOM.accessList = document.getElementById('accessList');
  DOM.uiList = document.getElementById('uiList');
  DOM.accessEmpty = document.getElementById('accessEmpty');
  DOM.uiEmpty = document.getElementById('uiEmpty');
  DOM.accessToggleCount = document.getElementById('accessToggleCount');
  DOM.uiToggleCount = document.getElementById('uiToggleCount');
  DOM.accessContainer = document.getElementById('accessContainer');
  DOM.uiContainer = document.getElementById('uiContainer');
  DOM.sectionToggles = document.querySelectorAll('.section-toggle');
  DOM.checklistGrid = document.getElementById('checklistGrid');
  DOM.scoreValue = document.getElementById('scoreValue');
  DOM.topPriorityList = document.getElementById('topPriorityList');
  DOM.recommendationsList = document.getElementById('recommendationsList');
  DOM.actionPlanList = document.getElementById('actionPlanList');
  DOM.modalOverlay = document.getElementById('modalOverlay');
  DOM.modal = document.getElementById('modal');
  DOM.modalBody = document.getElementById('modalBody');
  DOM.modalTitle = document.getElementById('modalTitle');
  DOM.modalClose = document.getElementById('modalClose');

  // Event delegation for collapsible section headers
  document.body.addEventListener('click', (ev) => {
    const btn = ev.target.closest && ev.target.closest('.section-toggle');
    if (!btn) return;
    const key = btn.getAttribute('data-section');
    if (!key) return;
    // toggle via state manager
    State.toggleSection(key);
  });

  // modal close interactions
  if (DOM.modalClose) DOM.modalClose.addEventListener('click', hideModal);
  if (DOM.modalOverlay) DOM.modalOverlay.addEventListener('click', (ev) => {
    if (ev.target === DOM.modalOverlay) hideModal();
  });

  // Escape closes modal (defensive; popup.js also listens)
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') hideModal();
  });

  // React to state changes
  State.subscribe((s) => {
    try { render(s); } catch (e) { console.error('[render] render failed', e); }
  });
}

function render(state) {
  try {
    // Loading state
    if (DOM.runBtn) DOM.runBtn.disabled = !!state.isLoading;
    if (DOM.spinner) DOM.spinner.classList.toggle('visible', !!state.isLoading);
    if (DOM.status) DOM.status.textContent = state.isLoading ? 'Scanning…' : (state.error ? `Error: ${state.error}` : 'Idle');

    // Header / meta
    if (DOM.scanUrl) DOM.scanUrl.textContent = state.url || '—';
    if (DOM.scanTime) DOM.scanTime.textContent = state.timestamp ? formatTimestamp(state.timestamp) : '—';

    // Summary counts
    const aCount = Array.isArray(state.accessibilityIssues) ? state.accessibilityIssues.length : 0;
    const uCount = Array.isArray(state.uiIssues) ? state.uiIssues.length : 0;
    if (DOM.accessCount) DOM.accessCount.textContent = String(aCount);
    if (DOM.uiCount) DOM.uiCount.textContent = String(uCount);
    if (DOM.accessToggleCount) DOM.accessToggleCount.textContent = String(aCount);
    if (DOM.uiToggleCount) DOM.uiToggleCount.textContent = String(uCount);

    // Score
    if (DOM.scoreValue) DOM.scoreValue.textContent = String(computeScore(state.accessibilityIssues || [], state.uiIssues || []));

    // Checklist
    renderChecklist(state.accessibilityIssues || []);

    // Accessibility list
    renderAccessibilityList(state.accessibilityIssues || []);

    // UI issues list
    renderUiList(state.uiIssues || []);

    // Top priority fixes
    renderTopPriority(state.accessibilityIssues || [], state.uiIssues || []);

    // Recommendations / action plan
    renderRecommendations(state.accessibilityIssues || [], state.uiIssues || []);
    renderActionPlan(state.accessibilityIssues || [], state.uiIssues || []);

    // Collapsible panels
    togglePanel('access', !!state.expanded.access);
    togglePanel('ui', !!state.expanded.ui);
  } catch (err) {
    console.error('[render] general render error', err);
  }
}

function togglePanel(key, expanded) {
  try {
    const container = key === 'access' ? DOM.accessContainer : DOM.uiContainer;
    const btn = document.querySelector(`.section-toggle[data-section="${key}"]`);
    if (!container || !btn) return;
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    container.classList.toggle('expanded', !!expanded);
    container.classList.toggle('collapsed', !expanded);
  } catch (e) { /* ignore */ }
}

function renderChecklist(accessibilityIssues) {
  try {
    if (!DOM.checklistGrid) return;
    const checklist = computeChecklist(accessibilityIssues || []);
    DOM.checklistGrid.innerHTML = '';
    for (const item of checklist) {
      const el = document.createElement('div');
      el.className = `checklist-item ${item.status === 'pass' ? 'pass' : 'fail'}`;
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = item.label;
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = item.status === 'pass' ? 'pass' : 'issue detected';
      const badge = document.createElement('span');
      badge.className = `badge ${item.status === 'pass' ? 'badge--ok' : 'badge--serious'}`;
      badge.textContent = item.status === 'pass' ? 'OK' : 'FAIL';
      el.appendChild(label);
      el.appendChild(sub);
      el.appendChild(badge);
      DOM.checklistGrid.appendChild(el);
    }
  } catch (e) { console.error('[render] renderChecklist failed', e); }
}

function renderTopPriority(accessibilityIssues, uiIssues) {
  try {
    if (!DOM.topPriorityList) return;
    DOM.topPriorityList.innerHTML = '';
    const top = getTopPriorityItems(accessibilityIssues || [], uiIssues || [], 4);
    if (!Array.isArray(top) || top.length === 0) {
      const none = document.createElement('div');
      none.className = 'empty';
      none.textContent = 'No top-priority fixes — good job 🎉';
      DOM.topPriorityList.appendChild(none);
      return;
    }

    for (const t of top) {
      const card = document.createElement('div');
      card.className = 'issue-card';
      const header = document.createElement('div');
      header.className = 'issue-header';
      const title = document.createElement('div');
      title.className = 'issue-title';
      title.textContent = t.source === 'accessibility' ? t.id : t.type;
      const meta = document.createElement('div');
      meta.className = 'issue-meta';
      if (t.source === 'accessibility') meta.textContent = `${t.nodesCount || 0} node(s) — ${t.impact || 'none'}`;
      else meta.textContent = `${t.selector || ''}`;
      header.appendChild(title);
      header.appendChild(meta);

      const body = document.createElement('div');
      body.className = 'issue-body';
      body.textContent = t.description || '';

      card.appendChild(header);
      card.appendChild(body);
      DOM.topPriorityList.appendChild(card);
    }
  } catch (e) { console.error('[render] renderTopPriority failed', e); }
}

function renderRecommendations(accessibilityIssues, uiIssues) {
  try {
    if (!DOM.recommendationsList) return;
    DOM.recommendationsList.innerHTML = '';
    const recs = generateRecommendations(accessibilityIssues || [], uiIssues || []);
    if (!Array.isArray(recs) || recs.length === 0) {
      const none = document.createElement('div');
      none.className = 'empty';
      none.textContent = 'No recommendations available';
      DOM.recommendationsList.appendChild(none);
      return;
    }
    for (const r of recs) {
      const li = document.createElement('div');
      li.className = 'issue-card';
      li.style.padding = '8px';
      const t = document.createElement('div');
      t.className = 'issue-title';
      t.textContent = r;
      li.appendChild(t);
      DOM.recommendationsList.appendChild(li);
    }
  } catch (e) { console.error('[render] renderRecommendations failed', e); }
}

function renderActionPlan(accessibilityIssues, uiIssues) {
  try {
    if (!DOM.actionPlanList) return;
    DOM.actionPlanList.innerHTML = '';
    const top = getTopPriorityItems(accessibilityIssues || [], uiIssues || [], 3);
    if (!Array.isArray(top) || top.length === 0) {
      const none = document.createElement('div');
      none.className = 'empty';
      none.textContent = 'No action items — your site looks good';
      DOM.actionPlanList.appendChild(none);
      return;
    }
    let step = 1;
    for (const t of top) {
      const el = document.createElement('div');
      el.className = 'issue-card';
      const h = document.createElement('div');
      h.className = 'issue-title';
      h.textContent = `${step}. ${t.source === 'accessibility' ? t.id : t.type}`;
      const p = document.createElement('div');
      p.className = 'issue-meta';
      p.textContent = t.description || (t.selector || '');
      el.appendChild(h);
      el.appendChild(p);
      DOM.actionPlanList.appendChild(el);
      step++;
    }
  } catch (e) { console.error('[render] renderActionPlan failed', e); }
}

function renderAccessibilityList(list) {
  try {
    // clear
    if (!DOM.accessList) return;
    DOM.accessList.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      DOM.accessEmpty && (DOM.accessEmpty.style.display = 'block');
      return;
    }
    DOM.accessEmpty && (DOM.accessEmpty.style.display = 'none');

    for (let idx = 0; idx < list.length; idx++) {
      const item = list[idx];
      try {
        const card = document.createElement('div');
        card.className = 'issue-card';
        card.dataset.source = 'accessibility';
        card.dataset.index = String(idx);
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const header = document.createElement('div');
        header.className = 'issue-header';

        const title = document.createElement('div');
        title.className = 'issue-title';
        title.textContent = item.id || 'rule';

        const meta = document.createElement('div');
        meta.className = 'issue-meta';
        const badge = document.createElement('span');
        badge.className = `badge ${severityClass(item.impact)}`;
        badge.textContent = item.impact || 'none';

        const priority = document.createElement('span');
        const p = getPriority(item);
        priority.className = `badge badge--priority-${p}`;
        priority.textContent = p.toUpperCase();

        const nodesBadge = document.createElement('span');
        nodesBadge.className = 'badge badge--info';
        nodesBadge.textContent = `${item.nodesCount || 0} node(s)`;

        meta.appendChild(badge);
        meta.appendChild(priority);
        meta.appendChild(nodesBadge);

        header.appendChild(title);
        header.appendChild(meta);

        const body = document.createElement('div');
        body.className = 'issue-body';
        body.textContent = item.description || '';

        // affected nodes (collapsible list)
        const nodes = document.createElement('ul');
        nodes.className = 'nodes-list';
        if (Array.isArray(item.nodes) && item.nodes.length) {
          for (const n of item.nodes) {
            const li = document.createElement('li');
            const sel = document.createElement('code');
            sel.className = 'selector';
            sel.textContent = n || '';
            li.appendChild(sel);
            nodes.appendChild(li);
          }
        }

        card.appendChild(header);
        card.appendChild(body);
        if (nodes.childElementCount) card.appendChild(nodes);

        DOM.accessList.appendChild(card);
      } catch (e) { console.warn('[render] skipped bad accessibility item', e); }
    }
  } catch (err) { console.error('[render] renderAccessibilityList failed', err); }
}

function renderUiList(list) {
  try {
    if (!DOM.uiList) return;
    DOM.uiList.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      DOM.uiEmpty && (DOM.uiEmpty.style.display = 'block');
      return;
    }
    DOM.uiEmpty && (DOM.uiEmpty.style.display = 'none');

    // Render each UI issue as its own card for deterministic UX and modal support
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      try {
        const card = document.createElement('div');
        card.className = 'issue-card';
        card.dataset.source = 'ui';
        card.dataset.index = String(i);
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const header = document.createElement('div');
        header.className = 'issue-header';
        const title = document.createElement('div');
        title.className = 'issue-title';
        title.textContent = it.type || 'ui-issue';
        const meta = document.createElement('div');
        meta.className = 'issue-meta';

        const priority = document.createElement('span');
        const pr = getPriority(it);
        priority.className = `badge badge--priority-${pr}`;
        priority.textContent = pr.toUpperCase();

        const selMeta = document.createElement('span');
        selMeta.className = 'issue-meta';
        selMeta.textContent = it.selector || '';

        header.appendChild(title);
        header.appendChild(priority);
        header.appendChild(selMeta);

        const body = document.createElement('div');
        body.className = 'issue-body';
        body.textContent = it.description || '';

        const sel = document.createElement('div');
        sel.className = 'issue-meta';
        sel.style.marginTop = '6px';
        sel.innerText = it.selector || '';

        card.appendChild(header);
        card.appendChild(body);
        if (sel) card.appendChild(sel);

        DOM.uiList.appendChild(card);
      } catch (e) { console.warn('[render] skipped bad ui item', e); }
    }
  } catch (err) { console.error('[render] renderUiList failed', err); }
}

/* Modal / details rendering */
function hideModal() {
  try {
    if (!DOM.modalOverlay) return;
    DOM.modalOverlay.hidden = true;
    if (DOM.modalBody) DOM.modalBody.innerHTML = '';
  } catch (e) { /* ignore */ }
}

function renderIssueDetailToModal(item, source) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-detail';

  const header = document.createElement('div');
  header.className = 'modal-issue-header';

  const title = document.createElement('div');
  title.className = 'modal-issue-title';
  title.textContent = source === 'accessibility' ? (item.id || 'issue') : (item.type || 'ui-issue');

  const badges = document.createElement('div');
  badges.className = 'modal-issue-meta';
  const pr = getPriority(item || {});
  const priorityBadge = document.createElement('span');
  priorityBadge.className = `badge badge--priority-${pr}`;
  priorityBadge.textContent = pr.toUpperCase();

  if (source === 'accessibility') {
    const sev = document.createElement('span');
    sev.className = `badge ${severityClass(item.impact)}`;
    sev.textContent = item.impact || 'none';
    const nodes = document.createElement('span');
    nodes.className = 'badge badge--info';
    nodes.textContent = `${item.nodesCount || 0} node(s)`;
    badges.appendChild(sev);
    badges.appendChild(priorityBadge);
    badges.appendChild(nodes);
  } else {
    const t = document.createElement('span');
    t.className = 'badge badge--info';
    t.textContent = item.type || 'ui';
    badges.appendChild(t);
    badges.appendChild(priorityBadge);
  }

  header.appendChild(title);
  header.appendChild(badges);

  const desc = document.createElement('div');
  desc.className = 'modal-issue-body';
  desc.textContent = item.description || '';

  const screenshot = document.createElement('div');
  screenshot.className = 'modal-screenshot';
  screenshot.textContent = 'Screenshot preview';

  const suggestion = document.createElement('div');
  suggestion.className = 'modal-issue-meta';
  suggestion.innerHTML = `<strong>Suggested fix:</strong> ${escapeHtml(getSuggestedFix(item))}`;

  wrap.appendChild(header);
  wrap.appendChild(desc);
  wrap.appendChild(screenshot);
  wrap.appendChild(suggestion);

  if (Array.isArray(item.nodes) && item.nodes.length) {
    const nodesTitle = document.createElement('div');
    nodesTitle.className = 'modal-issue-meta';
    nodesTitle.textContent = 'Affected selectors:';
    wrap.appendChild(nodesTitle);
    const list = document.createElement('div');
    list.className = 'code-block';
    list.style.marginTop = '8px';
    list.style.whiteSpace = 'pre-wrap';
    list.textContent = item.nodes.join('\n');
    wrap.appendChild(list);
  } else if (item.selector) {
    const nodesTitle = document.createElement('div');
    nodesTitle.className = 'modal-issue-meta';
    nodesTitle.textContent = 'Affected selector:';
    wrap.appendChild(nodesTitle);
    const selBlock = document.createElement('div');
    selBlock.className = 'code-block';
    selBlock.textContent = item.selector || '';
    wrap.appendChild(selBlock);
  }

  return wrap;
}

function showIssueModal(source, index) {
  try {
    const s = State.getState();
    const arr = source === 'accessibility' ? s.accessibilityIssues : s.uiIssues;
    if (!Array.isArray(arr) || !arr[index]) return;
    const item = arr[index];

    // build modal layout: left list + right detail
    if (!DOM.modalBody) return;
    DOM.modalBody.innerHTML = '';

    const listCol = document.createElement('div');
    listCol.className = 'modal-list';

    // show a compact list of items in the left column for quick nav
    const allIssues = [];
    if (Array.isArray(s.accessibilityIssues)) s.accessibilityIssues.forEach((it, i) => allIssues.push({ source: 'accessibility', index: i, title: it.id || 'rule', meta: `${it.nodesCount || 0} node(s)` }));
    if (Array.isArray(s.uiIssues)) s.uiIssues.forEach((it, i) => allIssues.push({ source: 'ui', index: i, title: it.type || 'ui', meta: it.selector || '' }));

    allIssues.forEach((ai) => {
      const r = document.createElement('div');
      r.className = 'issue-card';
      r.style.padding = '8px';
      r.dataset.source = ai.source;
      r.dataset.index = String(ai.index);
      r.setAttribute('role', 'button');
      r.setAttribute('tabindex', '0');
      const t = document.createElement('div');
      t.className = 'issue-title';
      t.textContent = ai.title;
      const m = document.createElement('div');
      m.className = 'issue-meta';
      m.textContent = ai.meta;
      r.appendChild(t);
      r.appendChild(m);
      listCol.appendChild(r);
    });

    const detailCol = renderIssueDetailToModal(item, source);

    DOM.modalBody.appendChild(listCol);
    DOM.modalBody.appendChild(detailCol);

    if (DOM.modalOverlay) DOM.modalOverlay.hidden = false;
    if (DOM.modalClose) DOM.modalClose.focus();
  } catch (e) {
    console.error('[render] showIssueModal failed', e);
  }
}

function showAllIssuesModal() {
  try {
    const s = State.getState();
    if (!DOM.modalBody) return;
    DOM.modalBody.innerHTML = '';

    const listCol = document.createElement('div');
    listCol.className = 'modal-list';

    const addIssueRow = (source, it, idx) => {
      const r = document.createElement('div');
      r.className = 'issue-card';
      r.dataset.source = source;
      r.dataset.index = String(idx);
      r.setAttribute('role', 'button');
      r.setAttribute('tabindex', '0');

      const t = document.createElement('div');
      t.className = 'issue-title';
      t.textContent = source === 'accessibility' ? (it.id || 'rule') : (it.type || 'ui');
      const m = document.createElement('div');
      m.className = 'issue-meta';
      m.textContent = source === 'accessibility' ? `${it.nodesCount || 0} node(s)` : (it.selector || '');

      r.appendChild(t);
      r.appendChild(m);
      listCol.appendChild(r);
    };

    (Array.isArray(s.accessibilityIssues) ? s.accessibilityIssues : []).forEach((it, i) => addIssueRow('accessibility', it, i));
    (Array.isArray(s.uiIssues) ? s.uiIssues : []).forEach((it, i) => addIssueRow('ui', it, i));

    // initially show details for the first item or a fallback message
    const detailCol = document.createElement('div');
    detailCol.className = 'modal-detail';
    if (Array.isArray(s.accessibilityIssues) && s.accessibilityIssues.length) {
      detailCol.appendChild(renderIssueDetailToModal(s.accessibilityIssues[0], 'accessibility'));
    } else if (Array.isArray(s.uiIssues) && s.uiIssues.length) {
      detailCol.appendChild(renderIssueDetailToModal(s.uiIssues[0], 'ui'));
    } else {
      const none = document.createElement('div');
      none.className = 'empty';
      none.textContent = 'No issues to display — 🎉';
      detailCol.appendChild(none);
    }

    DOM.modalBody.appendChild(listCol);
    DOM.modalBody.appendChild(detailCol);
    if (DOM.modalOverlay) DOM.modalOverlay.hidden = false;
    if (DOM.modalClose) DOM.modalClose.focus();
  } catch (e) {
    console.error('[render] showAllIssuesModal failed', e);
  }
}

export default { init, render, showIssueModal, showAllIssuesModal, hideModal };