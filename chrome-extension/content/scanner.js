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
      /* ── Base highlight ── */
      .${HIGHLIGHT_CLASS} {
        outline: 2.5px dashed #e94560 !important;
        outline-offset: 3px !important;
        position: relative !important;
        transition: outline-color 0.3s ease, box-shadow 0.3s ease !important;
      }

      /* ── Floating label: shows #N · Title (position: absolute, won't shift layout) ── */
      .ua-a11y-label {
        position: absolute !important;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        color: #f0f0f0;
        font-size: 11px;
        font-weight: 600;
        padding: 3px 10px 3px 8px;
        border-radius: 6px;
        white-space: nowrap;
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        pointer-events: none !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        border: 1px solid rgba(233,69,96,0.4);
        animation: ua-label-in 0.3s ease-out;
        letter-spacing: 0.2px;
      }
      .ua-a11y-label .ua-label-num {
        color: #e94560;
        font-weight: 800;
        margin-right: 4px;
      }

      /* ── Numbered badge circle (position: absolute, won't shift layout) ── */
      .ua-a11y-badge {
        position: absolute !important;
        min-width: 22px;
        height: 22px;
        padding: 0 5px;
        background: linear-gradient(135deg, #e94560, #c0392b);
        color: #fff;
        font-size: 10px;
        font-weight: 800;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 2px 8px rgba(233,69,96,0.4);
        pointer-events: none !important;
        animation: ua-badge-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 2px solid #fff;
      }

      /* ── Severity: Critical (red) ── */
      .${HIGHLIGHT_CLASS}[data-ua-severity="critical"] {
        outline-color: #e74c3c !important;
        outline-style: solid !important;
        box-shadow: 0 0 12px rgba(231,76,60,0.2) !important;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="critical"] .ua-a11y-label {
        border-color: rgba(231,76,60,0.5);
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="critical"] .ua-a11y-label .ua-label-num {
        color: #e74c3c;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="critical"] .ua-a11y-badge {
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        box-shadow: 0 2px 8px rgba(231,76,60,0.5);
      }

      /* ── Severity: Serious (orange) ── */
      .${HIGHLIGHT_CLASS}[data-ua-severity="serious"] {
        outline-color: #e67e22 !important;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="serious"] .ua-a11y-label {
        border-color: rgba(230,126,34,0.5);
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="serious"] .ua-a11y-label .ua-label-num {
        color: #e67e22;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="serious"] .ua-a11y-badge {
        background: linear-gradient(135deg, #e67e22, #d35400);
        box-shadow: 0 2px 8px rgba(230,126,34,0.4);
      }

      /* ── Severity: Moderate (soft amber) ── */
      .${HIGHLIGHT_CLASS}[data-ua-severity="moderate"] {
        outline-color: #d4a017 !important;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="moderate"] .ua-a11y-label {
        border-color: rgba(212,160,23,0.5);
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="moderate"] .ua-a11y-label .ua-label-num {
        color: #d4a017;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="moderate"] .ua-a11y-badge {
        background: linear-gradient(135deg, #d4a017, #b8860b);
        box-shadow: 0 2px 8px rgba(212,160,23,0.4);
      }

      /* ── Severity: Minor (blue) ── */
      .${HIGHLIGHT_CLASS}[data-ua-severity="minor"] {
        outline-color: #3498db !important;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="minor"] .ua-a11y-label {
        border-color: rgba(52,152,219,0.5);
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="minor"] .ua-a11y-label .ua-label-num {
        color: #3498db;
      }
      .${HIGHLIGHT_CLASS}[data-ua-severity="minor"] .ua-a11y-badge {
        background: linear-gradient(135deg, #3498db, #2980b9);
        box-shadow: 0 2px 8px rgba(52,152,219,0.4);
      }

      /* ── Spotlight: dramatic pulsing glow on card click ── */
      .ua-a11y-spotlight {
        outline: 3px solid #e94560 !important;
        outline-style: solid !important;
        outline-offset: 4px !important;
        box-shadow: 0 0 0 8px rgba(233,69,96,0.2), 0 0 30px rgba(233,69,96,0.25), inset 0 0 20px rgba(233,69,96,0.05) !important;
        animation: ua-spotlight-pulse 2s ease-in-out infinite !important;
        z-index: 999998 !important;
      }
      @keyframes ua-spotlight-pulse {
        0%   { box-shadow: 0 0 0 8px rgba(233,69,96,0.2), 0 0 30px rgba(233,69,96,0.25); outline-color: #e94560; }
        50%  { box-shadow: 0 0 0 14px rgba(233,69,96,0.1), 0 0 50px rgba(233,69,96,0.15); outline-color: #ff6b81; }
        100% { box-shadow: 0 0 0 8px rgba(233,69,96,0.2), 0 0 30px rgba(233,69,96,0.25); outline-color: #e94560; }
      }

      /* ── Locate flash: quick bright burst ── */
      .ua-a11y-flash {
        animation: ua-flash 2s ease-out !important;
      }
      @keyframes ua-flash {
        0%   { box-shadow: 0 0 0 6px rgba(233,69,96,0.9), 0 0 40px rgba(233,69,96,0.5); }
        20%  { box-shadow: 0 0 0 16px rgba(233,69,96,0.4), 0 0 60px rgba(233,69,96,0.3); }
        100% { box-shadow: none; }
      }

      /* ── Dim overlay for locate ── */
      .ua-a11y-dim-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.35);
        z-index: 999990;
        pointer-events: none;
        animation: ua-dim-in 0.3s ease-out;
      }
      @keyframes ua-dim-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* Elevated z-index when being located */
      .ua-a11y-located {
        z-index: 999995 !important;
        position: relative !important;
      }

      @keyframes ua-badge-pop {
        0%   { transform: scale(0); }
        60%  { transform: scale(1.15); }
        100% { transform: scale(1); }
      }
      @keyframes ua-label-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
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
    issues.forEach((issue, issueIdx) => {
      const issueTitle = issue.title || issue.id;
      for (const selector of (issue.selectors || [])) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            el.classList.add(HIGHLIGHT_CLASS);
            el.setAttribute('data-ua-issue', issue.id);
            el.setAttribute('data-ua-severity', issue.severity);
            el.setAttribute('data-ua-num', String(issueIdx + 1));
            el.setAttribute('data-ua-title', issueTitle);

            // Get element position for fixed positioning
            const rect = el.getBoundingClientRect();
            
            // Add floating label: #N · Issue Title (position: fixed, won't shift layout)
            const label = document.createElement('div');
            label.className = 'ua-a11y-label';
            label.innerHTML = `<span class="ua-label-num">#${issueIdx + 1}</span>${issueTitle}`;
            label.style.top = `${window.scrollY + rect.top - 32}px`;
            label.style.left = `${window.scrollX + rect.left + 4}px`;
            label.setAttribute('data-ua-marker', el.getAttribute('data-ua-num'));
            document.body.appendChild(label);

            // Add numbered badge circle (position: fixed)
            const badge = document.createElement('div');
            badge.className = 'ua-a11y-badge';
            badge.textContent = `${issueIdx + 1}`;
            badge.style.top = `${window.scrollY + rect.top - 10}px`;
            badge.style.left = `${window.scrollX + rect.right - 10}px`;
            badge.setAttribute('data-ua-marker', el.getAttribute('data-ua-num'));
            document.body.appendChild(badge);

            highlighted++;
          }
        } catch (e) { /* invalid selector */ }
      }
    });
    
    // Update marker positions on scroll/resize
    updateMarkerPositions();
    return highlighted;
  }

  /**
   * Remove all highlights
   */
  function clearHighlights() {
    // Remove dim overlay if present
    document.querySelectorAll('.ua-a11y-dim-overlay').forEach(o => o.remove());
    
    // Remove body-level markers (labels and badges)
    document.querySelectorAll('.ua-a11y-badge, .ua-a11y-label').forEach(m => m.remove());
    
    // Clean up highlighted elements
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      el.classList.remove(HIGHLIGHT_CLASS, 'ua-a11y-spotlight', 'ua-a11y-flash', 'ua-a11y-located');
      el.removeAttribute('data-ua-issue');
      el.removeAttribute('data-ua-severity');
      el.removeAttribute('data-ua-num');
      el.removeAttribute('data-ua-title');
    });
    
    // Remove scroll/resize listeners
    window.removeEventListener('scroll', updateMarkerPositions);
    window.removeEventListener('resize', updateMarkerPositions);
  }

  /**
   * Scroll to and dramatically highlight a specific element.
   * Dims the rest of the page so the element pops out.
   */
  function scrollToElement(selector) {
    try {
      const el = document.querySelector(selector);
      if (!el) return false;

      injectHighlightStyles();

      // Remove any previous locate effects
      document.querySelectorAll('.ua-a11y-dim-overlay').forEach(o => o.remove());
      document.querySelectorAll('.ua-a11y-located').forEach(e => e.classList.remove('ua-a11y-located'));
      document.querySelectorAll('.ua-a11y-flash').forEach(e => e.classList.remove('ua-a11y-flash'));

      // Add dim overlay (rest of page darkens)
      const overlay = document.createElement('div');
      overlay.className = 'ua-a11y-dim-overlay';
      document.body.appendChild(overlay);

      // Elevate the target element above the overlay
      el.classList.add('ua-a11y-located');

      // Scroll into view
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Flash animation on the element
      el.classList.add('ua-a11y-flash');

      // Auto-cleanup after 2.5s
      setTimeout(() => {
        overlay.remove();
        el.classList.remove('ua-a11y-located', 'ua-a11y-flash');
      }, 2500);

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Spotlight an element — persistent animated glow that scrolls into view.
   * Clicking a different issue card clears the previous spotlight.
   */
  function spotlightElement(selector) {
    injectHighlightStyles();
    // Clear any existing spotlight
    document.querySelectorAll('.ua-a11y-spotlight').forEach(el => {
      el.classList.remove('ua-a11y-spotlight');
    });
    // Clear any leftover locate effects
    document.querySelectorAll('.ua-a11y-dim-overlay').forEach(o => o.remove());
    document.querySelectorAll('.ua-a11y-located').forEach(e => e.classList.remove('ua-a11y-located'));

    try {
      const el = document.querySelector(selector);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ua-a11y-spotlight');
      // Auto-remove after 5 seconds
      setTimeout(() => { el.classList.remove('ua-a11y-spotlight'); }, 5000);
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

    if (msg.type === 'spotlight') {
      const found = spotlightElement(msg.selector);
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
  console.log('[Accea Agent] Scanner content script loaded');
})();
