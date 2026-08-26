/**
 * Fix Export — turn an applied fix into something that leaves the browser.
 *
 * A patch applied to the live DOM disappears on refresh. This renders the same
 * change as text a developer can paste into the codebase or attach to a ticket.
 *
 * Loaded as a classic script by the popup (which is not a module) and attaches
 * to globalThis.FixExport.
 */
(function (root) {
  'use strict';

  /** Prefix every line of a block, so multi-line snippets stay aligned. */
  function prefixLines(text, marker) {
    return String(text ?? '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => marker + line)
      .join('\n');
  }

  function wrapComment(text, width) {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      if (line && (line + ' ' + word).length > width) { lines.push(line); line = word; }
      else line = line ? line + ' ' + word : word;
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * Render one fix as a unified-diff-style patch.
   *
   * The hunk header carries the CSS selector rather than a line number: the
   * scan runs against a rendered page, so the source location genuinely isn't
   * known. Claiming a line number would be worse than naming the selector.
   */
  function buildFixDiff(fix, issue, pageUrl) {
    if (!fix) return '';

    const ruleId   = issue?.ruleId || issue?.id || fix.issueId || 'accessibility-issue';
    const wcag     = (issue?.wcag || fix.wcagResolved || []).join(', ');
    const selector = (issue?.selectors && issue.selectors[0]) || '(page level)';
    const before   = fix.before || '';
    const after    = fix.after  || '';

    const head = [
      `# ${fix.fixTitle || 'Accessibility fix'}`,
      pageUrl ? `# Page:     ${pageUrl}` : null,
      `# Rule:     ${ruleId}${wcag ? `  (WCAG ${wcag})` : ''}`,
      `# Element:  ${selector}`,
      fix.effort ? `# Effort:   ${fix.effort}` : null,
      typeof fix.confidence === 'number' ? `# Confidence: ${Math.round(fix.confidence * 100)}%` : null
    ].filter(Boolean);

    const body = [];
    if (before || after) {
      body.push('--- current');
      body.push('+++ fixed');
      if (before) body.push(prefixLines(before, '- '));
      if (after)  body.push(prefixLines(after,  '+ '));
    } else {
      body.push('# No code change available — this issue needs a manual review.');
    }

    const why = fix.explanation
      ? ['', ...wrapComment(fix.explanation, 76).map(l => `# ${l}`)]
      : [];

    return [...head, '', ...body, ...why].join('\n');
  }

  /** Just the corrected code, for pasting straight into an editor. */
  function buildFixSnippet(fix) {
    return fix?.after || '';
  }

  /**
   * Render every fix for a page as one document, ordered as given so the
   * priority the analysis produced is preserved.
   *
   * `entries` is [{ fix, issue }, …].
   */
  function buildSessionExport(entries, pageUrl, meta) {
    const list = (entries || []).filter(e => e && e.fix);

    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const header = [
      '# ═══════════════════════════════════════════',
      '# SiteScope 360 — accessibility fixes',
      pageUrl ? `# Page:      ${pageUrl}` : null,
      `# Generated: ${stamp}`,
      `# Fixes:     ${list.length}`,
      meta?.verified != null ? `# Verified:  ${meta.verified} re-tested and confirmed fixed` : null,
      '# ═══════════════════════════════════════════'
    ].filter(Boolean);

    if (!list.length) {
      return [...header, '', '# No fixes generated for this page.'].join('\n');
    }

    const blocks = list.map((entry, i) =>
      [`# ── ${i + 1} of ${list.length} ──`, '', buildFixDiff(entry.fix, entry.issue, null)].join('\n')
    );

    return [...header, '', blocks.join('\n\n\n')].join('\n');
  }

  root.FixExport = { buildFixDiff, buildFixSnippet, buildSessionExport };

  // Also expose as an ES module binding when imported by the service worker.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.FixExport;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
