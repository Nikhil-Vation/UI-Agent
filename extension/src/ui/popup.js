import State from './state.js';
import Render from './render.js';
import { escapeHtml, normalizeDeterministicReport, normalizeBackendPayload } from './utils.js';

// Controller: wiring for user interactions, scan trigger, and message handling.
// Rendering and DOM updates are delegated to `render.js`; state is centralized in `state.js`.

document.addEventListener('DOMContentLoaded', () => {
  console.log('[popup] mounted');
  Render.init();

  const runBtn = document.getElementById('runBtn');
  const showMoreBtn = document.getElementById('showMoreBtn');

  let lastFocused = null;

  function startScan() {
    try {
      State.clear();
      State.setLoading(true);
      console.log('[popup] requesting RUN_SCAN');
      chrome.runtime.sendMessage({ type: 'RUN_SCAN' }, (resp) => {
        if (chrome.runtime.lastError) {
          console.error('[popup] sendMessage error', chrome.runtime.lastError);
          State.setError('Failed to request scan');
          return;
        }
        console.log('[popup] RUN_SCAN response', resp);
      });
    } catch (e) {
      console.error('[popup] startScan failed', e);
      State.setError('Scan request failed');
    }
  }

  if (runBtn) {
    runBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      startScan();
    });
  }

  // Show full-screen issue list modal
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      lastFocused = document.activeElement;
      Render.showAllIssuesModal();
    });
  }

  // Delegate issue-card clicks --> open detail modal (preserve controller-only event handling)
  document.body.addEventListener('click', (ev) => {
    const card = ev.target.closest && ev.target.closest('.issue-card[data-source]');
    if (!card) return;
    const source = card.dataset.source;
    const idx = parseInt(card.dataset.index || '-1', 10);
    if (!source || Number.isNaN(idx)) return;
    lastFocused = document.activeElement;
    Render.showIssueModal(source, idx);
  });

  // Keyboard: open card on Enter, close modal on Escape (modal handles ESC too but keep as fallback)
  document.body.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      const focused = document.activeElement;
      if (focused && focused.classList && focused.classList.contains('issue-card') && focused.dataset.source) {
        const source = focused.dataset.source;
        const idx = parseInt(focused.dataset.index || '-1', 10);
        if (source && !Number.isNaN(idx)) Render.showIssueModal(source, idx);
      }
    }
    if (ev.key === 'Escape') {
      Render.hideModal();
      if (lastFocused) lastFocused.focus();
    }
  });

  // Auto-trigger a scan when popup opens (keeps existing behavior)
  try {
    startScan();
  } catch (e) { /* ignore */ }

  // Receive deterministic results immediately from extension (content-script -> service-worker -> popup)
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || !msg.type) return;
    try {
      if (msg.type === 'DETERMINISTIC_RESULT') {
        console.log('[popup] received DETERMINISTIC_RESULT');
        const normalized = normalizeDeterministicReport(msg.report || {});
        State.setResults({ url: normalized.url, timestamp: normalized.timestamp, accessibilityIssues: normalized.accessibilityIssues, uiIssues: normalized.uiIssues });
      }

      // backend enrichment (via service-worker SSE) or direct backend response forwarded
      else if (msg.type === 'ENRICHMENT_UPDATE') {
        console.log('[popup] received ENRICHMENT_UPDATE');
        const payload = msg.payload || {};
        // If backend returns the standardized shape, normalize and merge safely
        if (payload && payload.success) {
          const normalized = normalizeBackendPayload(payload || {});
          State.mergeBackendEnrichment({ accessibilityIssues: normalized.accessibilityIssues, uiIssues: normalized.uiIssues, summary: payload.summary });
        } else {
          // forward raw enrichment payload into state if it contains arrays (defensive)
          if (payload.accessibilityIssues || payload.uiIssues) {
            State.mergeBackendEnrichment({ accessibilityIssues: payload.accessibilityIssues, uiIssues: payload.uiIssues, summary: payload.summary });
          }
        }
      }
    } catch (err) {
      console.error('[popup] onMessage handler failed', err);
      State.setError('Internal popup error');
    }
  });

});