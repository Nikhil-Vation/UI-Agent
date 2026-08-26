/**
 * Opt-in team sync — WITHOUT a backend, deliberately.
 *
 * The roadmap note this closes out says it plainly: a full synced backend
 * would trade away the privacy claim that is this product's main
 * differentiator. So "sync" here means a portable JSON bundle a team member
 * explicitly exports and shares however they already share files — Slack,
 * email, a shared drive — and another member explicitly imports. Nothing
 * transmits automatically, nothing phones home, and nothing requires an
 * account.
 *
 * Metadata-only is enforced structurally, not by convention: the bundle
 * builder only ever reads `auditLog` and `scanHistory`, and never touches
 * settings — so there is no code path through which an API key could end up
 * in an exported file.
 */
(function (root) {
  'use strict';

  const BUNDLE_VERSION = 1;

  function buildTeamBundle({ auditLog = [], scanHistory = [] } = {}) {
    return {
      version: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      auditLog,
      scanHistory
    };
  }

  /** A stable enough identity for one entry to dedupe imports against what's already local. */
  function auditKey(e) { return `${e.issueId}|${e.event}|${e.at}`; }
  function historyKey(e) { return `${e.url}|${e.timestamp}`; }

  /**
   * Merge an imported bundle into existing local data. Always additive — never
   * removes or overwrites a local entry, and never imports anything that isn't
   * shaped like the two arrays this bundle is scoped to. A newer/older version
   * number is accepted as long as the two arrays are present; only the fields
   * this module actually understands are read.
   */
  function importTeamBundle(bundle, existing = {}) {
    if (!bundle || typeof bundle !== 'object') {
      return { auditLog: existing.auditLog || [], scanHistory: existing.scanHistory || [], added: { auditLog: 0, scanHistory: 0 } };
    }

    const existingAudit = Array.isArray(existing.auditLog) ? existing.auditLog : [];
    const existingHistory = Array.isArray(existing.scanHistory) ? existing.scanHistory : [];
    const incomingAudit = Array.isArray(bundle.auditLog) ? bundle.auditLog : [];
    const incomingHistory = Array.isArray(bundle.scanHistory) ? bundle.scanHistory : [];

    const seenAudit = new Set(existingAudit.map(auditKey));
    const newAudit = incomingAudit.filter(e => e && e.issueId && !seenAudit.has(auditKey(e)));

    const seenHistory = new Set(existingHistory.map(historyKey));
    const newHistory = incomingHistory.filter(e => e && e.url && !seenHistory.has(historyKey(e)));

    return {
      auditLog: [...existingAudit, ...newAudit],
      scanHistory: [...existingHistory, ...newHistory],
      added: { auditLog: newAudit.length, scanHistory: newHistory.length }
    };
  }

  root.TeamSync = { BUNDLE_VERSION, buildTeamBundle, importTeamBundle };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.TeamSync;
})(typeof globalThis !== 'undefined' ? globalThis : self);
