// Utility helpers: XSS-safe escaping, normalizers, severity mapping and audit helpers

export function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatTimestamp(ts) {
  try {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleString();
  } catch (e) {
    return String(ts || '');
  }
}

export const severityClass = (impact) => {
  switch ((impact || '').toLowerCase()) {
    case 'minor': return 'badge--minor';
    case 'moderate': return 'badge--moderate';
    case 'serious': return 'badge--serious';
    case 'critical': return 'badge--critical';
    case 'none': return 'badge--ok';
    default: return 'badge--info';
  }
};

export const severityRank = (impact) => {
  switch ((impact || '').toLowerCase()) {
    case 'critical': return 4;
    case 'serious': return 3;
    case 'moderate': return 2;
    case 'minor': return 1;
    default: return 0;
  }
};

// A small checklist mapping (rule-key => human label, match function). We mark a rule as FAIL if any
// accessibility issue ID matches the rule pattern. This provides a compact health grid.
export const CHECKLIST_RULES = [
  { key: 'document-title', label: 'Document title', match: id => /document-title/i.test(id) },
  { key: 'image-alt', label: 'Images have alt', match: id => /image-alt/i.test(id) },
  { key: 'color-contrast', label: 'Color contrast', match: id => /contrast/i.test(id) || /color-contrast/i.test(id) },
  { key: 'link-name', label: 'Links have names', match: id => /link-name/i.test(id) },
  { key: 'button-name', label: 'Buttons have names', match: id => /button-name|button-name-.*|name/i.test(id) },
  { key: 'form-labels', label: 'Form elements labeled', match: id => /label|label-title/i.test(id) },
  { key: 'heading-order', label: 'Headings order', match: id => /heading-order|heading/i.test(id) },
  { key: 'focus-order', label: 'Keyboard focus', match: id => /focus-order|tabindex/i.test(id) }
];

export function computeChecklist(accessibilityIssues = []) {
  const ids = (Array.isArray(accessibilityIssues) ? accessibilityIssues.map(i => (i.id || '').toLowerCase()) : []);
  return CHECKLIST_RULES.map(r => {
    const matched = ids.some(id => r.match(id));
    return { key: r.key, label: r.label, status: matched ? 'fail' : 'pass', matches: matched };
  });
}

// Simple score: start at 100, subtract weighted penalties for issues. Deterministic and accessibility weigh differently.
export function computeScore(accessibilityIssues = [], uiIssues = []) {
  const a = Array.isArray(accessibilityIssues) ? accessibilityIssues.length : 0;
  const u = Array.isArray(uiIssues) ? uiIssues.length : 0;
  let score = 100 - Math.min(90, a * 5 + u * 2);
  if (score < 0) score = 0;
  return Math.round(score);
}

// Generate concise recommendations based on common failure signals
export function generateRecommendations(accessibilityIssues = [], uiIssues = []) {
  const recs = new Set();
  const ids = (Array.isArray(accessibilityIssues) ? accessibilityIssues.map(i => (i.id || '').toLowerCase()) : []);

  if (ids.some(id => id.includes('contrast') || id.includes('color-contrast'))) recs.add('Improve color contrast — ensure text meets WCAG AA contrast ratios.');
  if (ids.some(id => id.includes('image-alt'))) recs.add('Add meaningful alt text for images to support screen readers.');
  if (ids.some(id => id.includes('label') || id.includes('input') || id.includes('name'))) recs.add('Provide labels or aria-labels for form controls.');
  if (ids.some(id => id.includes('heading-order'))) recs.add('Correct heading hierarchy to maintain semantic structure.');
  if (uiIssues && Array.isArray(uiIssues) && uiIssues.some(u => (u.type || '').includes('tap-target'))) recs.add('Increase tap target sizes to at least 44×44px for better touch reliability.');
  if (ids.some(id => id.includes('link-name') || id.includes('button-name'))) recs.add('Ensure interactive elements have descriptive accessible names.');
  if (!recs.size) recs.add('No specific recommendations detected — perform manual review of key pages.');

  return Array.from(recs).slice(0, 6);
}

// Top priority items: sort accessibility issues by severity and node count, include UI issues with high impact
export function getTopPriorityItems(accessibilityIssues = [], uiIssues = [], limit = 4) {
  const a = (Array.isArray(accessibilityIssues) ? accessibilityIssues.slice() : []).map(i => ({
    source: 'accessibility', id: i.id || 'unknown', description: i.description || '', impact: i.impact || 'none', nodesCount: i.nodesCount || 0
  }));
  const u = (Array.isArray(uiIssues) ? uiIssues.slice() : []).map(i => ({ source: 'ui', type: i.type || 'ui', selector: i.selector || '', description: i.description || '' }));

  a.sort((x, y) => (severityRank(y.impact) - severityRank(x.impact)) || (y.nodesCount - x.nodesCount));
  // pick top accessibility then UI
  const topA = a.slice(0, Math.max(0, limit));
  const topU = u.slice(0, Math.max(0, limit - topA.length));
  const list = topA.concat(topU).slice(0, limit);
  return list;
}

// Normalize a deterministic `report` (content-script -> popup) into the audit structure
export function normalizeDeterministicReport(report = {}) {
  const out = { url: report.url || '', timestamp: report.timestamp || Date.now(), accessibilityIssues: [], uiIssues: [] };

  try {
    const violations = (report.axe && Array.isArray(report.axe.violations)) ? report.axe.violations : [];
    out.accessibilityIssues = violations.map(v => ({
      id: v.id || 'unknown',
      description: v.description || '',
      impact: v.impact || v.impact === 0 ? String(v.impact) : (v.impact || 'none'),
      nodesCount: (Array.isArray(v.nodes) ? v.nodes.length : 0),
      nodes: (Array.isArray(v.nodes) ? v.nodes.map(n => (Array.isArray(n.target) ? n.target[0] : (n.target || ''))) : [])
    }));
  } catch (e) {
    console.warn('[utils] normalizeDeterministicReport: failed to normalize axe violations', e);
  }

  try {
    const h = report.heuristics || {};
    const pushUi = (type, obj) => out.uiIssues.push(Object.assign({ type }, obj));

    (Array.isArray(h.tapTargets) ? h.tapTargets : []).forEach(t => pushUi('tap-target', { selector: t.selector || '', description: `small target ${t.rect ? (t.rect.w + '×' + t.rect.h) : ''}`, rect: t.rect || null }));
    (Array.isArray(h.headingOrder) ? h.headingOrder : []).forEach(hx => pushUi('heading-order', { selector: hx.selector || '', description: `heading jump from H${hx.from} to H${hx.to}`, from: hx.from, to: hx.to }));
    (Array.isArray(h.unlabeledInputs) ? h.unlabeledInputs : []).forEach(u => pushUi('unlabeled-input', { selector: u.selector || '', description: `unlabeled input (${u.type || 'text'})`, inputType: u.type || 'text' }));
  } catch (e) {
    console.warn('[utils] normalizeDeterministicReport: failed to normalize heuristics', e);
  }

  return out;
}

// Normalize backend response shape: { success, summary, accessibilityIssues, uiIssues }
export function normalizeBackendPayload(payload = {}) {
  const out = { url: '', timestamp: Date.now(), accessibilityIssues: [], uiIssues: [], summary: payload.summary || {} };
  try {
    if (Array.isArray(payload.accessibilityIssues)) out.accessibilityIssues = payload.accessibilityIssues.map(ai => ({
      id: ai.id || ai.rule || 'unknown',
      description: ai.description || '',
      impact: ai.impact || 'none',
      nodesCount: ai.nodes ? (Array.isArray(ai.nodes) ? ai.nodes.length : 0) : (ai.nodesCount || 0),
      nodes: Array.isArray(ai.nodes) ? ai.nodes.map(n => n.selector || n) : []
    }));
    if (Array.isArray(payload.uiIssues)) out.uiIssues = payload.uiIssues.map(ui => ({
      type: ui.type || 'unknown',
      selector: ui.selector || ui.element || '',
      description: ui.description || ''
    }));
  } catch (e) {
    console.warn('[utils] normalizeBackendPayload failed', e);
  }
  return out;
}

// Suggest a concise, deterministic fix hint for an issue (used in the detail modal)
export function getSuggestedFix(issue = {}) {
  try {
    const key = (issue.id || issue.type || '').toLowerCase();
    if (key.includes('contrast')) return 'Increase foreground/background contrast to meet WCAG AA (4.5:1 for normal text).';
    if (key.includes('image-alt') || key.includes('image')) return 'Add meaningful alt text or mark decorative images with empty alt="".';
    if (key.includes('label') || key.includes('unlabeled-input') || key.includes('input')) return 'Provide <label> elements or aria-label attributes for inputs.';
    if (key.includes('heading-order') || key.includes('heading')) return 'Fix heading hierarchy (e.g., H2 should not skip from H1 to H4).';
    if (key.includes('link-name') || key.includes('button-name')) return 'Use descriptive link/button text and avoid vague labels like "click here".';
    if (key.includes('tap-target')) return 'Increase tap target size (recommended ≥44×44px) and add spacing between interactive elements.';
    return 'Review rule documentation and apply semantic HTML or ARIA fixes as appropriate.';
  } catch (e) {
    return 'Refer to guidance for this rule.';
  }
}

// Map issue severity / node count to a human priority (high / medium / low)
export function getPriority(issue = {}) {
  try {
    const rank = severityRank((issue.impact || issue.severity || 'none'));
    const nodes = (issue.nodesCount || (Array.isArray(issue.nodes) ? issue.nodes.length : 0)) || 0;
    if (rank >= 3) return 'high';
    if (rank === 2) return 'medium';
    if (rank === 1) return 'low';
    // fallback: many affected nodes increases priority
    if (nodes >= 6) return 'medium';
    if (nodes >= 12) return 'high';
    return 'low';
  } catch (e) {
    return 'low';
  }
}
