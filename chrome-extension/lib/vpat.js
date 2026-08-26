/**
 * VPAT / ACR draft generation.
 *
 * A VPAT (Voluntary Product Accessibility Template) is the standardized,
 * criterion-by-criterion conformance report enterprise procurement demands.
 * Filling one out by hand is normally a paid consulting exercise.
 *
 * The honest constraint that shapes this whole file: automated and heuristic
 * testing covers a fraction of what any single WCAG success criterion actually
 * requires. A criterion can never be marked "Supports" from this data — that
 * would be the exact overclaim the rest of this product has spent real effort
 * removing (see the evidence pack and the report-content pass). The three
 * honest states are:
 *
 *   Does Not Support   — an unresolved violation was found against this criterion
 *   Partially Supports — every violation found was fixed and VERIFIED, but the
 *                         criterion covers more than any scanner can check
 *   Not Evaluated       — nothing in this scan tests this criterion at all
 *
 * The draft is exactly that — a draft. It says so on every page.
 */
(function (root) {
  'use strict';

  // Level A/AA success criteria this product has actual test coverage paths
  // for, at least in part. Not the full WCAG catalog — listing criteria this
  // tool cannot speak to at all would just be padding, and every row not
  // listed here is implicitly "not evaluated" by omission, which is honest.
  const WCAG_SC_CATALOG = [
    { id: '1.1.1', name: 'Non-text Content', level: 'A' },
    { id: '1.3.1', name: 'Info and Relationships', level: 'A' },
    { id: '1.3.2', name: 'Meaningful Sequence', level: 'A' },
    { id: '1.4.3', name: 'Contrast (Minimum)', level: 'AA' },
    { id: '1.4.4', name: 'Resize Text', level: 'AA' },
    { id: '2.1.1', name: 'Keyboard', level: 'A' },
    { id: '2.4.1', name: 'Bypass Blocks', level: 'A' },
    { id: '2.4.2', name: 'Page Titled', level: 'A' },
    { id: '2.4.3', name: 'Focus Order', level: 'A' },
    { id: '2.4.4', name: 'Link Purpose (In Context)', level: 'A' },
    { id: '2.4.6', name: 'Headings and Labels', level: 'AA' },
    { id: '2.4.7', name: 'Focus Visible', level: 'AA' },
    { id: '3.1.1', name: 'Language of Page', level: 'A' },
    { id: '3.3.2', name: 'Labels or Instructions', level: 'A' },
    { id: '3.3.3', name: 'Error Suggestion', level: 'AA' },
    { id: '4.1.1', name: 'Parsing', level: 'A' },
    { id: '4.1.2', name: 'Name, Role, Value', level: 'A' }
  ];

  /**
   * Collapse a mixed list of issues/findings (axe, judgment, keyboard, screen
   * reader, reading order — each already carries a `wcag` array) into two sets:
   * criteria with an unresolved reference, and criteria where every reference
   * was verified. Unresolved always wins if a criterion appears in both, since
   * "one violation still open" is what a reader needs to know, not an average.
   */
  function collectCoverage(items, verifiedIds) {
    const verified = new Set(verifiedIds || []);
    const unresolved = new Map(); // scId -> [example evidence strings]
    const resolvedOnly = new Set();

    for (const item of (items || [])) {
      const scs = item.wcag || item.wcagCriteria || [];
      const isVerified = verified.has(item.id);
      for (const sc of scs) {
        if (isVerified) {
          if (!unresolved.has(sc)) resolvedOnly.add(sc);
        } else {
          if (!unresolved.has(sc)) unresolved.set(sc, []);
          const ex = item.title || item.ruleId || item.id;
          if (unresolved.get(sc).length < 2 && ex) unresolved.get(sc).push(ex);
          resolvedOnly.delete(sc);
        }
      }
    }
    return { unresolved, resolvedOnly };
  }

  /**
   * Build the draft. `axeIssues` and `otherFindings` are kept as separate
   * arguments rather than pre-merged, because only axe issues currently have a
   * verify concept at all — judgment/keyboard/screen-reader/reading-order
   * findings have no auto-fix path yet, so every reference from them counts as
   * unresolved by construction, never partially-supported.
   */
  function buildVpatDraft({ axeIssues = [], otherFindings = [], verifiedIds = [], pageUrl = '', generatedAt = Date.now() } = {}) {
    const { unresolved, resolvedOnly } = collectCoverage(
      [...axeIssues, ...otherFindings.map(f => ({ ...f, id: `nf-${f.id}` }))],
      verifiedIds
    );

    const rows = WCAG_SC_CATALOG.map(sc => {
      if (unresolved.has(sc.id)) {
        const examples = unresolved.get(sc.id);
        return {
          ...sc, status: 'Does Not Support',
          remarks: `Automated/heuristic testing found an unresolved issue against this criterion${examples.length ? `: ${examples.join('; ')}` : '.'}`
        };
      }
      if (resolvedOnly.has(sc.id)) {
        return {
          ...sc, status: 'Partially Supports',
          remarks: 'Violations found by this tool against this criterion were fixed and confirmed by re-scan. This criterion covers requirements beyond what automated or heuristic testing can check, so full support is not claimed.'
        };
      }
      return {
        ...sc, status: 'Not Evaluated',
        remarks: 'Not covered by this scan. Requires manual assessment.'
      };
    });

    return { pageUrl, generatedAt: new Date(generatedAt).toISOString(), rows };
  }

  function renderVpatMarkdown(draft) {
    const out = [
      '# Accessibility Conformance Report (Draft)', '',
      '**This is a machine-generated draft, not a submittable VPAT.** Every row below reflects',
      'only what this tool actually tested. It must be reviewed by someone qualified to assess',
      'the full criterion — including everything outside this tool\'s reach — before it is used',
      'in procurement or compliance filing.', '',
      `Page: ${draft.pageUrl || '(not recorded)'}  `,
      `Generated: ${draft.generatedAt}`, '',
      '| Criteria | Level | Conformance | Remarks |',
      '|---|---|---|---|'
    ];
    for (const r of draft.rows) {
      out.push(`| ${r.id} ${r.name} | ${r.level} | ${r.status} | ${r.remarks.replace(/\|/g, '/')} |`);
    }
    out.push('', 'Conformance levels used: **Does Not Support** — a violation was found and is still open. ' +
      '**Partially Supports** — violations found were fixed and verified, but the criterion covers more than ' +
      'this tool can check. **Not Evaluated** — not covered by this scan. "Supports" is never used, because ' +
      'no automated or heuristic tool can confirm full conformance to a WCAG criterion on its own.');
    return out.join('\n');
  }

  root.Vpat = { WCAG_SC_CATALOG, collectCoverage, buildVpatDraft, renderVpatMarkdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Vpat;
})(typeof globalThis !== 'undefined' ? globalThis : self);
