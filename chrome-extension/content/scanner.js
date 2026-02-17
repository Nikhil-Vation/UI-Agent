/**
 * Content Script — Accessibility Scanner (Highlighting & DOM helpers)
 * 
 * NOTE: axe-core scanning now happens in the MAIN world via
 * chrome.scripting.executeScript in the service worker.
 * This content script handles:
 *   - Highlighting issues on the page
 *   - Scrolling to elements
 *   - Collecting DOM context for LLM
 *   - Responding to pings
 */

(() => {
  'use strict';

  /* ───────── DOM Info Collection ───────── */

  /**
   * Collect minimal structural DOM info for an issue (used for LLM context).
   * Deliberately strips text content for privacy.
   */
  function collectDOMContext(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return null;

      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || null,
        role: el.getAttribute('role') || null,
        ariaLabel: el.getAttribute('aria-label') || null,
        ariaLabelledBy: el.getAttribute('aria-labelledby') || null,
        ariaDescribedBy: el.getAttribute('aria-describedby') || null,
        tabindex: el.getAttribute('tabindex'),
        type: el.getAttribute('type') || null,
        href: el.hasAttribute('href') ? '[present]' : null,
        src: el.hasAttribute('src') ? '[present]' : null,
        alt: el.getAttribute('alt'),
        title: el.getAttribute('title'),
        forAttr: el.getAttribute('for') || null,
        parentTag: el.parentElement?.tagName?.toLowerCase() || null,
        childCount: el.children.length,
        hasText: (el.textContent || '').trim().length > 0,
        // Computed styles relevant to accessibility
        isVisible: isElementVisible(el),
        computedRole: getComputedRole(el),
        outerHTML: truncateHTML(el.outerHTML, 500)
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if element is visually visible
   */
  function isElementVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           el.offsetWidth > 0 &&
           el.offsetHeight > 0;
  }

  /**
   * Get computed ARIA role
   */
  function getComputedRole(el) {
    try {
      return el.computedRole || el.getAttribute('role') || null;
    } catch {
      return el.getAttribute('role') || null;
    }
  }

  /**
   * Truncate HTML string
   */
  function truncateHTML(html, maxLen) {
    if (!html) return '';
    if (html.length <= maxLen) return html;
    return html.slice(0, maxLen) + '…';
  }

  /* ───────── Highlight elements ───────── */

  const HIGHLIGHT_CLASS = 'ua-a11y-highlight';
  const HIGHLIGHT_STYLE_ID = 'ua-a11y-highlight-style';

  /**
   * Inject highlight styles into the page
   */
  function injectHighlightStyles() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 3px solid #e74c3c !important;
        outline-offset: 2px !important;
        position: relative !important;
      }
      .${HIGHLIGHT_CLASS}::after {
        content: attr(data-ua-issue);
        position: absolute;
        top: -22px;
        left: 0;
        background: #e74c3c;
        color: #fff;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        pointer-events: none;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="serious"] {
        outline-color: #e67e22 !important;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="serious"]::after {
        background: #e67e22;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="moderate"] {
        outline-color: #f39c12 !important;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="moderate"]::after {
        background: #f39c12;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="minor"] {
        outline-color: #3498db !important;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="minor"]::after {
        background: #3498db;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Highlight elements with accessibility issues on the page
   */
  function highlightIssues(issues) {
    clearHighlights();
    injectHighlightStyles();

    let highlighted = 0;
    for (const issue of issues) {
      for (const selector of (issue.selectors || [])) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            el.classList.add(HIGHLIGHT_CLASS);
            el.setAttribute('data-ua-issue', issue.id);
            el.setAttribute('data-ua-severity', issue.severity);
            highlighted++;
          }
        } catch (e) { /* invalid selector */ }
      }
    }
    return highlighted;
  }

  /**
   * Remove all highlights
   */
  function clearHighlights() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      el.classList.remove(HIGHLIGHT_CLASS);
      el.removeAttribute('data-ua-issue');
      el.removeAttribute('data-ua-severity');
    });
  }

  /**
   * Scroll to and flash a specific element
   */
  function scrollToElement(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash effect
      el.style.transition = 'box-shadow 0.3s ease';
      el.style.boxShadow = '0 0 0 4px rgba(231, 76, 60, 0.6)';
      setTimeout(() => { el.style.boxShadow = ''; }, 2000);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ───────── Message handler ───────── */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'highlight-issues') {
      const count = highlightIssues(msg.issues || []);
      sendResponse({ ok: true, highlighted: count });
      return false;
    }

    if (msg.type === 'clear-highlights') {
      clearHighlights();
      sendResponse({ ok: true });
      return false;
    }

    if (msg.type === 'scroll-to') {
      const found = scrollToElement(msg.selector);
      sendResponse({ ok: true, found });
      return false;
    }

    if (msg.type === 'get-dom-context') {
      const context = collectDOMContext(msg.selector);
      sendResponse({ ok: true, context });
      return false;
    }

    if (msg.type === 'ping') {
      sendResponse({ ok: true, ready: true });
      return false;
    }
  });

  /* ───────── Init log ───────── */
  console.log('[Vation Agent] Scanner content script loaded');
})();
