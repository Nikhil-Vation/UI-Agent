/**
 * Business-risk translation.
 *
 * Restates technical severity as legal and revenue exposure for a reader who
 * doesn't parse "3 critical, 5 serious" but does understand "lawsuit risk" and
 * "market reach". Every external figure here was already fact-checked once —
 * during the 0.6 report-content pass that removed a fabricated "~4% of
 * visitors" statistic and corrected a DOJ penalty figure that had been misquoted
 * as a pre-proceeding cost. This module reuses those corrected facts rather than
 * re-deriving new ones, specifically so that discipline doesn't quietly erode
 * the next time this kind of copy gets written.
 *
 * The one rule that matters most: never compute a percentage of THIS site's
 * traffic that is supposedly affected. There is no way to know that without
 * real analytics data, and the previous version of this exact copy invented one.
 */
(function (root) {
  'use strict';

  function severityLevel(counts = {}) {
    const critical = counts.critical || 0;
    const serious  = counts.serious  || 0;
    const moderate = counts.moderate || 0;
    if (critical > 0) return 'high';
    if (serious > 0 || moderate > 3) return 'medium';
    return 'low';
  }

  /**
   * Pure function: counts in, a structured, sourced risk statement out.
   * No page content, no LLM call — every sentence here is either a fixed fact
   * or a direct restatement of the counts already computed elsewhere.
   */
  function assessRisk(counts = {}) {
    const critical = counts.critical || 0;
    const serious  = counts.serious  || 0;
    const moderate = counts.moderate || 0;
    const minor    = counts.minor    || 0;
    const total = critical + serious + moderate + minor;
    const level = severityLevel(counts);

    const statements = [];

    if (critical > 0) {
      statements.push({
        heading: 'Legal exposure',
        body: `${critical} critical issue${critical > 1 ? 's' : ''} block assistive technology outright — the category regulators and plaintiffs' counsel treat as the clearest evidence of non-compliance. Around 4,600 web accessibility lawsuits were filed in the US in 2023 (UsableNet). DOJ civil penalties for ADA violations run up to $75,000 for a first violation and $150,000 for subsequent ones. Company size is not a defense under the ADA, Canada's AODA, or the EU's EN 301 549.`
      });
    } else if (total > 0) {
      statements.push({
        heading: 'Legal exposure',
        body: `No critical issues were found, which materially reduces exposure — critical violations are what most enforcement actions center on. ${serious + moderate} remaining issue${(serious + moderate) !== 1 ? 's' : ''} of lower severity should still be addressed; they are the kind of finding that surfaces in a third-party audit.`
      });
    } else {
      statements.push({ heading: 'Legal exposure', body: 'No automated or heuristic violations were found on this page. This is not a conformance statement — see the scope limitations below — but it is a materially lower-risk position than a page with open critical issues.' });
    }

    statements.push({
      heading: 'Market reach',
      body: `An estimated 1 in 4 US adults has a disability (CDC), and working-age people with disabilities hold an estimated $490B in disposable income (American Institutes for Research). How much of a given site's actual traffic this affects depends on real analytics this tool does not have access to — no percentage of this site's visitors is claimed here.`
    });

    if (total > 0) {
      statements.push({
        heading: 'Cost of remediation',
        body: `Detection is not the expensive part — automated scanning has been free for years. The cost is a person reading each violation, understanding the correct fix, writing it, and someone else confirming it worked. That is the cycle this tool automates: generate the fix, apply it, re-scan to confirm, in roughly the time a scan itself takes.`
      });
    }

    return { level, counts: { critical, serious, moderate, minor, total }, statements };
  }

  function renderRiskMarkdown(risk) {
    const out = ['## Business risk summary', '', `Overall level: **${risk.level.toUpperCase()}**`, ''];
    for (const s of risk.statements) out.push(`**${s.heading}.** ${s.body}`, '');
    out.push('This section restates the findings above in business terms. It draws only on the counts already measured on this page and on cited external figures — nothing here is estimated or extrapolated from this page\'s specific traffic.');
    return out.join('\n');
  }

  root.Risk = { severityLevel, assessRisk, renderRiskMarkdown };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Risk;
})(typeof globalThis !== 'undefined' ? globalThis : self);
