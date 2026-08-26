/**
 * Audit log — an append-only record of what was done to a page.
 *
 * Deliberately event-sourced rather than a mutable status per issue. A fix that
 * was applied, undone, and applied again is three facts, and a compliance reader
 * is entitled to see all three. Overwriting a status would quietly erase the
 * middle one, and "the log says it was fixed" would stop being checkable.
 *
 * Current state is therefore always *derived* (`summarizeAudit`), never stored.
 * Nothing in here can claim an outcome that was not recorded as an event.
 */
(function (root) {
  'use strict';

  const MAX_ENTRIES = 500;

  const EVENT = {
    APPLIED:  'applied',   // a patch was written to the DOM
    VERIFIED: 'verified',  // a fresh scan confirmed the violation is gone
    FAILED:   'failed',    // a fresh scan still reported the violation
    UNDONE:   'undone'     // the patch was rolled back
  };

  /**
   * Build one immutable event.
   *
   * `source` and `confidence` record *which* model produced the fix and how sure
   * it was — the two questions a reviewer asks first about an automated change.
   */
  function makeAuditEntry({
    event,
    issueId,
    ruleId = '',
    pageUrl = '',
    summary = '',
    source = '',
    confidence = null,
    autonomy = '',
    attempts = null,
    at = Date.now()
  }) {
    if (!event || !issueId) return null;
    return {
      at,
      event,
      issueId,
      ruleId,
      pageUrl,
      summary,
      source,
      confidence: typeof confidence === 'number' ? confidence : null,
      autonomy,
      attempts: typeof attempts === 'number' ? attempts : null
    };
  }

  /** Append, keeping the log bounded. Oldest entries fall off the front. */
  function appendEntry(log, entry, cap = MAX_ENTRIES) {
    if (!entry) return Array.isArray(log) ? log : [];
    const next = [...(Array.isArray(log) ? log : []), entry];
    return next.length > cap ? next.slice(next.length - cap) : next;
  }

  /** Entries for one page, oldest first. */
  function entriesForPage(log, pageUrl) {
    if (!Array.isArray(log)) return [];
    if (!pageUrl) return [...log];
    return log.filter(e => e.pageUrl === pageUrl);
  }

  /**
   * Derive current state per issue from the event stream.
   *
   * Last event wins, with one exception: `undone` clears verification outright.
   * A fix that was verified and then rolled back is not on the page any more, and
   * reporting it as verified would be the single most misleading thing this log
   * could do.
   */
  function summarizeAudit(entries) {
    const byIssue = new Map();

    for (const e of (entries || []).slice().sort((a, b) => a.at - b.at)) {
      const prev = byIssue.get(e.issueId) || { issueId: e.issueId, ruleId: e.ruleId, applied: false, verified: false };

      if (e.event === EVENT.APPLIED) {
        prev.applied = true;
        prev.summary = e.summary || prev.summary;
        prev.source = e.source || prev.source;
        prev.confidence = e.confidence ?? prev.confidence;
        prev.autonomy = e.autonomy || prev.autonomy;
      } else if (e.event === EVENT.VERIFIED) {
        prev.verified = true;
        prev.attempts = e.attempts ?? prev.attempts;
      } else if (e.event === EVENT.FAILED) {
        prev.verified = false;
      } else if (e.event === EVENT.UNDONE) {
        prev.applied = false;
        prev.verified = false;
      }

      prev.ruleId = prev.ruleId || e.ruleId;
      prev.lastEvent = e.event;
      prev.lastAt = e.at;
      byIssue.set(e.issueId, prev);
    }

    const all = [...byIssue.values()];
    return {
      issues: all,
      appliedIds:  all.filter(i => i.applied && !i.verified).map(i => i.issueId),
      verifiedIds: all.filter(i => i.verified).map(i => i.issueId),
      counts: {
        applied:  all.filter(i => i.applied && !i.verified).length,
        verified: all.filter(i => i.verified).length,
        undone:   all.filter(i => i.lastEvent === EVENT.UNDONE).length
      }
    };
  }

  /** Render the raw event stream for the evidence record. */
  function renderAuditMarkdown(entries) {
    const list = (entries || []).slice().sort((a, b) => a.at - b.at);
    if (!list.length) return '';

    const out = ['## Change log', '',
      'Every recorded action, in order. Includes changes that were later rolled back.', ''];

    for (const e of list) {
      const when = new Date(e.at).toISOString().replace('T', ' ').slice(0, 16);
      const conf = e.confidence !== null ? `, confidence ${Math.round(e.confidence * 100)}%` : '';
      const by   = e.source ? ` by ${e.source}${conf}` : '';
      out.push(`- \`${when}\` **${e.event}** — ${e.ruleId || e.issueId}${by}` +
               (e.summary ? `  \n  ${e.summary}` : ''));
    }
    out.push('');
    return out.join('\n');
  }

  root.AuditLog = {
    EVENT, MAX_ENTRIES,
    makeAuditEntry, appendEntry, entriesForPage, summarizeAudit, renderAuditMarkdown
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.AuditLog;
})(typeof globalThis !== 'undefined' ? globalThis : self);
