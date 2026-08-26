/**
 * Agency / white-label mode.
 *
 * No backend, so "multi-client workspaces" means what it can honestly mean
 * here: a small local list of client profiles, stored in chrome.storage.local
 * on the agency's own machine, that stamps a branded header onto whichever
 * markdown document (evidence record, VPAT, session diff, crawl report) gets
 * exported while that profile is active. Nothing is synced anywhere.
 */
(function (root) {
  'use strict';

  function makeProfile({ name, contact = '', color = '#8b5cf6' } = {}) {
    return {
      id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(name || '').trim(),
      contact: String(contact || '').trim(),
      color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#8b5cf6'
    };
  }

  /** Basic markdown-safety: a client-entered name must not break table/heading syntax. */
  function escMd(s) {
    return String(s ?? '').replace(/[|#*_`]/g, '');
  }

  /**
   * Prepend a branded header to an already-built markdown document. Returns the
   * document UNCHANGED when no profile is active — branding is additive, never
   * a required step, so every export still works with zero configuration.
   */
  function applyBranding(markdown, profile) {
    if (!profile || !profile.name) return markdown;
    const header = [
      `# ${escMd(profile.name)}`,
      profile.contact ? escMd(profile.contact) : null,
      `_Prepared using SiteScope 360 · ${new Date().toISOString().slice(0, 10)}_`,
      '', '---', ''
    ].filter(l => l !== null).join('\n');
    return header + '\n' + markdown;
  }

  root.Branding = { makeProfile, applyBranding, escMd };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Branding;
})(typeof globalThis !== 'undefined' ? globalThis : self);
