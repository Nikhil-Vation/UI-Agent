/**
 * Evidence pack — a dated record of what was found, what was fixed, and what
 * was proven fixed.
 *
 * This is the document a compliance or legal team actually needs, and the whole
 * value of it is that it does not overclaim. Three rules follow from that:
 *
 *   1. "Fixed" and "verified" are different states. A patch that was applied but
 *      never re-scanned is reported as applied, not as fixed. Only a fix whose
 *      violation was confirmed absent by a fresh scan is called verified.
 *   2. The scope limitations are part of the report, not a footnote. Automated
 *      testing covers roughly a third of WCAG success criteria, so a clean run
 *      is evidence of work done — never a conformance statement.
 *   3. Every number traces to something measured. Nothing is estimated,
 *      extrapolated, or inferred.
 */
(function (root) {
  'use strict';


const EVIDENCE_STATUS = {
  VERIFIED:   'fixed-verified',
  APPLIED:    'fixed-unverified',
  OUTSTANDING:'outstanding'
};

const STATUS_LABEL = {
  [EVIDENCE_STATUS.VERIFIED]:    'Fixed and verified',
  [EVIDENCE_STATUS.APPLIED]:     'Fix applied, not re-scanned',
  [EVIDENCE_STATUS.OUTSTANDING]: 'Outstanding'
};

/**
 * Scope limitations, stated in the report itself.
 *
 * Deliberately prominent. A reader who discovers a limitation you disclosed
 * trusts the rest of the document; one who discovers a limitation you hid stops
 * trusting all of it.
 */
const LIMITATIONS = [
  'Automated testing detects roughly a third of WCAG success criteria. This report covers only what can be checked automatically.',
  'Manual review — keyboard-only navigation, screen reader testing, and cognitive load assessment — is required for a conformance claim and is not included here.',
  'Findings apply to the single page and page state listed above, at the time listed. Content behind interaction, authentication, or different viewports was not assessed.',
  'Fixes marked "applied, not re-scanned" have not been confirmed. Only items marked verified were re-tested after the change.'
];

function isoDate(d) {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/**
 * Assemble the report from measured data.
 *
 * `verifiedIds` must contain only issues confirmed absent by a re-scan —
 * populating it from "we applied a patch" would defeat the entire purpose.
 */
function buildEvidenceReport({
  pageUrl = '',
  pageTitle = '',
  analysis = {},
  fixes = {},
  appliedIds = [],
  verifiedIds = [],
  judgment = [],
  generatedAt = Date.now()
} = {}) {
  const applied  = new Set(appliedIds);
  const verified = new Set(verifiedIds);
  const issues   = analysis.issues || [];

  const items = issues.map(issue => {
    const key = issue.id;
    const fix = fixes[key] || null;

    let status = EVIDENCE_STATUS.OUTSTANDING;
    if (verified.has(key))     status = EVIDENCE_STATUS.VERIFIED;
    else if (applied.has(key)) status = EVIDENCE_STATUS.APPLIED;

    return {
      ruleId: issue.ruleId || issue.id,
      title: issue.title || issue.ruleId || issue.id,
      severity: issue.severity || 'moderate',
      wcag: issue.wcag || issue.wcagCriteria || [],
      elementCount: issue.elementCount || (issue.selectors || []).length || 0,
      selectors: (issue.selectors || []).slice(0, 3),
      status,
      statusLabel: STATUS_LABEL[status],
      remediation: fix ? {
        summary: fix.fixTitle || '',
        source: fix.source || 'unknown',
        confidence: typeof fix.confidence === 'number' ? fix.confidence : null
      } : null
    };
  });

  const count = (s) => items.filter(i => i.status === s).length;

  return {
    meta: {
      tool: 'SiteScope 360',
      pageUrl,
      pageTitle,
      generatedAt: isoDate(generatedAt),
      scanEngine: analysis.metadata?.scanEngine || 'axe-core',
      wcagVersion: analysis.metadata?.wcagVersion || '2.1',
      conformanceLevel: (analysis.metadata?.levels || ['A', 'AA']).join('/')
    },
    summary: {
      totalFound: items.length,
      verified:    count(EVIDENCE_STATUS.VERIFIED),
      applied:     count(EVIDENCE_STATUS.APPLIED),
      outstanding: count(EVIDENCE_STATUS.OUTSTANDING),
      judgmentFindings: judgment.length,
      automatedChecksPassed: analysis.counts?.passed ?? null
    },
    items,
    judgment: judgment.map(j => ({
      ruleId: j.ruleId,
      title: j.title,
      severity: j.severity,
      wcag: j.wcag || [],
      evidence: j.evidence || '',
      occurrences: j.occurrences || 1
    })),
    limitations: LIMITATIONS
  };
}

/* ═══════════════════════════════════════════
   Rendering
   ═══════════════════════════════════════════ */

function table(rows) {
  if (!rows.length) return '';
  const widths = rows[0].map((_, col) =>
    Math.max(...rows.map(r => String(r[col] ?? '').length)));
  const line = (r) => '| ' + r.map((c, i) => String(c ?? '').padEnd(widths[i])).join(' | ') + ' |';
  const sep  = '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';
  return [line(rows[0]), sep, ...rows.slice(1).map(line)].join('\n');
}

/** Render the report as Markdown suitable for attaching to a compliance file. */
function renderEvidenceMarkdown(report) {
  const { meta, summary, items, judgment, limitations } = report;
  const out = [];

  out.push('# Accessibility Remediation Record');
  out.push('');
  out.push(table([
    ['Field', 'Value'],
    ['Page', meta.pageUrl || '(not recorded)'],
    ['Title', meta.pageTitle || '(not recorded)'],
    ['Generated', meta.generatedAt],
    ['Tool', meta.tool],
    ['Scan engine', meta.scanEngine],
    ['Standard', `WCAG ${meta.wcagVersion} level ${meta.conformanceLevel}`]
  ]));
  out.push('');

  out.push('## Summary');
  out.push('');
  out.push(table([
    ['Outcome', 'Count'],
    ['Issues found', String(summary.totalFound)],
    ['Fixed and verified by re-scan', String(summary.verified)],
    ['Fix applied, not re-scanned', String(summary.applied)],
    ['Outstanding', String(summary.outstanding)],
    ...(summary.automatedChecksPassed !== null
      ? [['Automated checks passed', String(summary.automatedChecksPassed)]] : []),
    ...(summary.judgmentFindings
      ? [['Additional findings beyond automated checks', String(summary.judgmentFindings)]] : [])
  ]));
  out.push('');

  if (items.length) {
    out.push('## Issues');
    out.push('');
    out.push(table([
      ['Rule', 'Severity', 'WCAG', 'Elements', 'Status'],
      ...items.map(i => [
        i.ruleId,
        i.severity,
        (i.wcag || []).join(', ') || '—',
        String(i.elementCount || '—'),
        i.statusLabel
      ])
    ]));
    out.push('');

    const remediated = items.filter(i => i.remediation);
    if (remediated.length) {
      out.push('### Remediation detail');
      out.push('');
      for (const i of remediated) {
        const conf = i.remediation.confidence !== null
          ? ` (confidence ${Math.round(i.remediation.confidence * 100)}%)` : '';
        out.push(`- **${i.ruleId}** — ${i.remediation.summary || 'fix applied'}`);
        out.push(`  Status: ${i.statusLabel}. Generated by: ${i.remediation.source}${conf}.`);
        if (i.selectors.length) out.push(`  Elements: \`${i.selectors.join('`, `')}\``);
      }
      out.push('');
    }
  }

  if (judgment.length) {
    out.push('## Findings beyond automated checks');
    out.push('');
    out.push('These were identified on elements that **pass** axe-core and Lighthouse. They are reported for completeness and are not automated-check failures.');
    out.push('');
    out.push(table([
      ['Finding', 'Severity', 'WCAG', 'Occurrences', 'Evidence'],
      ...judgment.map(j => [
        j.ruleId, j.severity, (j.wcag || []).join(', ') || '—',
        String(j.occurrences), j.evidence || '—'
      ])
    ]));
    out.push('');
  }

  out.push('## Scope and limitations');
  out.push('');
  for (const l of limitations) out.push(`- ${l}`);
  out.push('');
  out.push('---');
  out.push('');
  out.push('This document records remediation work performed and verified. It is not a statement of conformance with WCAG or any legal standard.');

  return out.join('\n');
}

  root.Evidence = {
    buildEvidenceReport,
    renderEvidenceMarkdown,
    EVIDENCE_STATUS,
    LIMITATIONS
  };

  // Also usable as an ES module import in the test runner.
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Evidence;
})(typeof globalThis !== 'undefined' ? globalThis : self);
