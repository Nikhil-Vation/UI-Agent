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

  // Guard against duplicate injection
  if (window.__sitescope360_scanner_loaded) return;
  window.__sitescope360_scanner_loaded = true;

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
      /* ── Page-level banner strip ── */
      .ua-a11y-page-banner {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 2147483647 !important;
        display: flex !important;
      }
      .ua-a11y-page-banner.ua-hidden {
        display: none !important;
        flex-direction: column !important;
        gap: 0 !important;
        pointer-events: none !important;
      }
      .ua-a11y-page-item {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 7px 14px !important;
        background: repeating-linear-gradient(
          -45deg,
          rgba(26,10,46,0.93),
          rgba(26,10,46,0.93) 10px,
          rgba(50,10,80,0.93) 10px,
          rgba(50,10,80,0.93) 20px
        ) !important;
        border-bottom: 2px solid rgba(139,92,246,0.55) !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        color: #e2d4ff !important;
        letter-spacing: 0.2px !important;
        animation: ua-banner-in 0.35s ease-out !important;
        pointer-events: none !important;
      }
      .ua-a11y-page-item:first-child {
        border-top: 2px solid rgba(139,92,246,0.55) !important;
      }
      .ua-a11y-page-icon {
        font-size: 14px !important;
        line-height: 1 !important;
        filter: drop-shadow(0 0 4px rgba(200,150,255,0.7)) !important;
      }
      .ua-a11y-page-num {
        background: rgba(139,92,246,0.7) !important;
        color: #fff !important;
        font-size: 10px !important;
        font-weight: 800 !important;
        border-radius: 10px !important;
        padding: 1px 7px !important;
        flex-shrink: 0 !important;
      }
      .ua-a11y-page-label {
        opacity: 0.7 !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.8px !important;
        margin-left: auto !important;
        background: rgba(139,92,246,0.25) !important;
        padding: 1px 6px !important;
        border-radius: 4px !important;
        border: 1px solid rgba(139,92,246,0.4) !important;
        flex-shrink: 0 !important;
      }
      @keyframes ua-banner-in {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* ── Base highlight ── */
      .${HIGHLIGHT_CLASS} {
        outline: 2.5px dashed #e94560 !important;
        outline-offset: 3px !important;
        transition: outline-color 0.3s ease, box-shadow 0.3s ease !important;
      }

      /* ── Floating label: shows #N · Title ── */
      .ua-a11y-label {
        position: fixed !important;
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

      /* ── Numbered badge circle ── */
      .ua-a11y-badge {
        position: fixed !important;
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

      /* ── Patched element: solid green outline + faded error tint ── */
      .ua-a11y-patched {
        outline: 2.5px solid #10b981 !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 4px rgba(16,185,129,0.15) !important;
        transition: outline-color 0.4s ease, box-shadow 0.4s ease !important;
      }
      /* Patched badge: green circle with ✓ */
      .ua-a11y-badge-patched {
        position: fixed !important;
        min-width: 22px;
        height: 22px;
        padding: 0 5px;
        background: linear-gradient(135deg, #10b981, #059669) !important;
        color: #fff;
        font-size: 13px;
        font-weight: 900;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 2px 10px rgba(16,185,129,0.5) !important;
        pointer-events: none !important;
        border: 2px solid #fff;
        animation: ua-badge-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      /* Patched floating label: green tint */
      .ua-a11y-label-patched {
        background: linear-gradient(135deg, #064e3b, #065f46) !important;
        border-color: rgba(16,185,129,0.6) !important;
        color: #6ee7b7 !important;
      }
      .ua-a11y-label-patched .ua-label-num {
        color: #10b981 !important;
      }
      /* Brief entrance glow on patch */
      @keyframes ua-patch-glow {
        0%   { box-shadow: 0 0 0 8px rgba(16,185,129,0.5), 0 0 30px rgba(16,185,129,0.4); }
        60%  { box-shadow: 0 0 0 14px rgba(16,185,129,0.2), 0 0 50px rgba(16,185,129,0.2); }
        100% { box-shadow: 0 0 0 4px rgba(16,185,129,0.15); }
      }
      .ua-a11y-patch-flash {
        animation: ua-patch-glow 0.9s ease-out forwards !important;
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

    // Collect page-level issues — DON'T show banner yet, only on demand
    const pageLevelIssues = issues.filter(i => i.isPageLevel);
    if (pageLevelIssues.length > 0) {
      // Build the banner but keep it hidden until user requests it
      document.querySelector('.ua-a11y-page-banner')?.remove();
      const banner = document.createElement('div');
      banner.className = 'ua-a11y-page-banner ua-hidden';
      pageLevelIssues.forEach((issue, idx) => {
        const issueIdx = issues.indexOf(issue);
        const row = document.createElement('div');
        row.className = 'ua-a11y-page-item';
        row.setAttribute('data-ua-page-issue', issue.id);
        row.innerHTML =
          `<span class="ua-a11y-page-icon">⚠️</span>` +
          `<span class="ua-a11y-page-num">#${issueIdx + 1}</span>` +
          `<span>${issue.title || issue.id}</span>` +
          `<span class="ua-a11y-page-label">Page-level</span>`;
        banner.appendChild(row);
        highlighted++;
      });
      document.body.appendChild(banner);
    }

    issues.forEach((issue, issueIdx) => {
      // Page-level issues are shown in the banner — skip element outline
      if (issue.isPageLevel) return;

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

            // Get element position (viewport coords for position:fixed)
            const rect = el.getBoundingClientRect();
            
            // Add floating label: #N · Issue Title (position: fixed overlay)
            const label = document.createElement('div');
            label.className = 'ua-a11y-label';
            label.innerHTML = `<span class="ua-label-num">#${issueIdx + 1}</span>${issueTitle}`;
            label.style.top = `${rect.top - 28}px`;
            label.style.left = `${rect.left + 4}px`;
            label.setAttribute('data-ua-marker', el.getAttribute('data-ua-num'));
            document.body.appendChild(label);

            // Add numbered badge circle (position: fixed overlay)
            const badge = document.createElement('div');
            badge.className = 'ua-a11y-badge';
            badge.textContent = `${issueIdx + 1}`;
            badge.style.top = `${rect.top - 10}px`;
            badge.style.left = `${rect.right - 10}px`;
            badge.setAttribute('data-ua-marker', el.getAttribute('data-ua-num'));
            document.body.appendChild(badge);

            highlighted++;
          }
        } catch (e) { /* invalid selector */ }
      }
    });
    
    // Update marker positions on scroll/resize
    window.addEventListener('scroll', updateMarkerPositions, { passive: true });
    window.addEventListener('resize', updateMarkerPositions, { passive: true });
    return highlighted;
  }

  /**
   * Reposition floating labels and badges when user scrolls or resizes.
   */
  function updateMarkerPositions() {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      const num = el.getAttribute('data-ua-num');
      if (!num) return;
      const rect = el.getBoundingClientRect();

      // Find label and badge by matching data-ua-marker
      const label = document.querySelector(`.ua-a11y-label[data-ua-marker="${num}"]`);
      const badge = document.querySelector(`.ua-a11y-badge[data-ua-marker="${num}"]`);

      if (label) {
        label.style.top = `${rect.top - 28}px`;
        label.style.left = `${rect.left + 4}px`;
      }
      if (badge) {
        badge.style.top = `${rect.top - 10}px`;
        badge.style.left = `${rect.right - 10}px`;
      }
    });
  }

  /**
   * Mark all elements for a given issue as patched on the live page.
   * Replaces the red dashed outline + badge with a green solid outline + ✓ badge.
   * @param {string[]} selectors  - All CSS selectors for nodes of this issue
   * @param {string}   issueNum   - The display number (e.g. "3")
   * @param {string}   issueTitle - Short title for the label
   */
  function markPatched(selectors, issueNum, issueTitle) {
    injectHighlightStyles();
    for (const selector of (selectors || [])) {
      try {
        document.querySelectorAll(selector).forEach(el => {
          // Swap highlight class → patched class
          el.classList.remove(HIGHLIGHT_CLASS);
          el.classList.add('ua-a11y-patched', 'ua-a11y-patch-flash');
          // Remove flash class after animation
          setTimeout(() => el.classList.remove('ua-a11y-patch-flash'), 950);

          const num = el.getAttribute('data-ua-num') || issueNum;

          // Upgrade existing floating label to green
          const label = document.querySelector(`.ua-a11y-label[data-ua-marker="${num}"]`);
          if (label) {
            label.classList.add('ua-a11y-label-patched');
            label.innerHTML = `<span class="ua-label-num">✓</span>${issueTitle || el.getAttribute('data-ua-title') || 'Fixed'}`;
          }

          // Swap existing red badge → green ✓ badge
          const oldBadge = document.querySelector(`.ua-a11y-badge[data-ua-marker="${num}"]`);
          if (oldBadge) {
            oldBadge.classList.remove('ua-a11y-badge');
            oldBadge.classList.add('ua-a11y-badge-patched');
            oldBadge.textContent = '✓';
          }
        });
      } catch (e) { /* invalid selector — skip */ }
    }
  }

  /**
   * Remove all highlights
   */
  function clearHighlights() {
    // Remove dim overlay if present
    document.querySelectorAll('.ua-a11y-dim-overlay').forEach(o => o.remove());
    
    // Remove body-level markers (labels, badges, and page-level banners)
    document.querySelectorAll('.ua-a11y-badge, .ua-a11y-label, .ua-a11y-page-banner').forEach(m => m.remove());
    
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

  /* ───────── Sandbox Mode: Apply Patches ───────── */

  // Track applied patches for undo
  const appliedPatches = new Map(); // patchId -> { element, originalValue, change }

  function applyPatch(change, patchId) {
    try {
      // For insertAdjacent, try comma-separated selectors in order (first match wins)
      let elements;
      if (change.type === 'insertAdjacent' && change.selector.includes(',')) {
        const selectors = change.selector.split(',').map(s => s.trim());
        for (const sel of selectors) {
          try {
            const found = document.querySelectorAll(sel);
            if (found.length > 0) {
              elements = found;
              break;
            }
          } catch { /* invalid selector, try next */ }
        }
        if (!elements || elements.length === 0) {
          return { ok: false, error: 'No elements match any selector' };
        }
      } else {
        elements = document.querySelectorAll(change.selector);
        if (elements.length === 0) return { ok: false, error: 'No elements match selector' };
      }

      let applied = 0;
      elements.forEach(el => {
        if (change.type === 'attribute') {
          // Store original value for undo
          const original = el.getAttribute(change.attribute);
          appliedPatches.set(`${patchId}-${applied}`, {
            element: el,
            change,
            original
          });

          // Apply the change
          el.setAttribute(change.attribute, change.value);
          
          // Visual feedback: brief green glow
          el.style.transition = 'box-shadow 0.3s ease';
          el.style.boxShadow = '0 0 0 3px rgba(46, 213, 115, 0.5)';
          setTimeout(() => {
            el.style.boxShadow = '';
          }, 800);

          applied++;
        } else if (change.type === 'remove-attribute') {
          // Store original value for undo (the attr being removed)
          const original = el.getAttribute(change.attribute);
          if (original !== null) {
            appliedPatches.set(`${patchId}-${applied}`, {
              element: el,
              change,
              original
            });
            el.removeAttribute(change.attribute);

            // Visual feedback
            el.style.transition = 'box-shadow 0.3s ease';
            el.style.boxShadow = '0 0 0 3px rgba(46, 213, 115, 0.5)';
            setTimeout(() => { el.style.boxShadow = ''; }, 800);

            applied++;
          }
        } else if (change.type === 'css') {
          const original = el.style[change.property];
          appliedPatches.set(`${patchId}-${applied}`, {
            element: el,
            change,
            original
          });

          el.style[change.property] = change.value;
          applied++;
        } else if (change.type === 'innerHTML') {
          const original = el.innerHTML;
          appliedPatches.set(`${patchId}-${applied}`, {
            element: el,
            change: { ...change, _originalType: 'innerHTML' },
            original
          });

          el.innerHTML = change.value;

          // Visual feedback
          el.style.transition = 'box-shadow 0.3s ease';
          el.style.boxShadow = '0 0 0 3px rgba(46, 213, 115, 0.5)';
          setTimeout(() => { el.style.boxShadow = ''; }, 800);

          applied++;
        } else if (change.type === 'outerHTML') {
          const original = el.outerHTML;
          // outerHTML replacement swaps the element — keep a reference via parent
          const parent = el.parentNode;
          const nextSibling = el.nextSibling;
          appliedPatches.set(`${patchId}-${applied}`, {
            element: el,
            change: { ...change, _originalType: 'outerHTML', _parent: parent, _nextSibling: nextSibling },
            original
          });

          el.outerHTML = change.value;
          applied++;
        } else if (change.type === 'insertAdjacent') {
          // Only insert once (first matched element), not for every match
          if (applied > 0) return;

          // Insert new HTML adjacent to the element (beforebegin, afterbegin, beforeend, afterend)
          const position = change.position || 'beforebegin';
          const insertedHTML = change.value;

          el.insertAdjacentHTML(position, insertedHTML);

          // Find the inserted node for undo tracking
          let insertedNode = null;
          if (position === 'beforebegin') {
            insertedNode = el.previousElementSibling;
          } else if (position === 'afterend') {
            insertedNode = el.nextElementSibling;
          } else if (position === 'afterbegin') {
            insertedNode = el.firstElementChild;
          } else if (position === 'beforeend') {
            insertedNode = el.lastElementChild;
          }

          appliedPatches.set(`${patchId}-${applied}`, {
            element: insertedNode,
            change: { ...change, _originalType: 'insertAdjacent', _insertedNode: insertedNode },
            original: null // nothing was there before
          });

          // Visual feedback
          if (insertedNode) {
            insertedNode.style.transition = 'box-shadow 0.3s ease';
            insertedNode.style.boxShadow = '0 0 0 3px rgba(46, 213, 115, 0.5)';
            setTimeout(() => {
              if (insertedNode.style) insertedNode.style.boxShadow = '';
            }, 800);
          }

          applied++;
        }
      });

      // ── Handle 'childRole': add role attribute to direct children of matched parent ──
      if (change.type === 'childRole' && change.childRole) {
        elements.forEach(parent => {
          const children = parent.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            // Skip script/template/style
            const tag = child.tagName.toLowerCase();
            if (['script', 'template', 'style', 'link', 'meta'].includes(tag)) continue;
            // Skip if child already has the correct role
            if (child.getAttribute('role') === change.childRole) continue;

            const origRole = child.getAttribute('role');
            appliedPatches.set(`${patchId}-child-${i}`, {
              element: child,
              change: { type: 'attribute', attribute: 'role' },
              original: origRole
            });
            child.setAttribute('role', change.childRole);
            applied++;
          }
        });
      }

      return { ok: true, applied, total: elements.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function undoPatch(patchId) {
    let undone = 0;
    
    // Find all sub-patches for this patchId
    for (const [key, patch] of appliedPatches.entries()) {
      if (key.startsWith(patchId)) {
        const { element, change, original } = patch;
        
        if (change.type === 'attribute') {
          if (original === null) {
            element.removeAttribute(change.attribute);
          } else {
            element.setAttribute(change.attribute, original);
          }
        } else if (change.type === 'remove-attribute') {
          // Restore the previously removed attribute
          if (original !== null) {
            element.setAttribute(change.attribute, original);
          }
        } else if (change.type === 'css') {
          element.style[change.property] = original || '';
        } else if (change.type === 'innerHTML' || change._originalType === 'innerHTML') {
          element.innerHTML = original;
        } else if (change.type === 'outerHTML' || change._originalType === 'outerHTML') {
          // Re-insert the original element in its original position
          const parent = change._parent;
          const nextSib = change._nextSibling;
          if (parent) {
            const temp = document.createElement('div');
            temp.innerHTML = original;
            const restored = temp.firstChild;
            if (restored) {
              if (nextSib && nextSib.parentNode === parent) {
                parent.insertBefore(restored, nextSib);
              } else {
                parent.appendChild(restored);
              }
            }
          }
        } else if (change._originalType === 'insertAdjacent') {
          // Remove the inserted node
          const inserted = change._insertedNode;
          if (inserted && inserted.parentNode) {
            inserted.parentNode.removeChild(inserted);
          }
        }
        
        appliedPatches.delete(key);
        undone++;
      }
    }
    
    return { ok: true, undone };
  }

  function resetAllPatches() {
    for (const [, patch] of appliedPatches.entries()) {
      const { element, change, original } = patch;
      
      if (change.type === 'attribute') {
        if (original === null) {
          element.removeAttribute(change.attribute);
        } else {
          element.setAttribute(change.attribute, original);
        }
      } else if (change.type === 'remove-attribute') {
        // Restore the previously removed attribute
        if (original !== null) {
          element.setAttribute(change.attribute, original);
        }
      } else if (change.type === 'css') {
        element.style[change.property] = original || '';
      } else if (change.type === 'innerHTML' || change._originalType === 'innerHTML') {
        element.innerHTML = original;
      } else if (change.type === 'outerHTML' || change._originalType === 'outerHTML') {
        const parent = change._parent;
        const nextSib = change._nextSibling;
        if (parent) {
          const temp = document.createElement('div');
          temp.innerHTML = original;
          const restored = temp.firstChild;
          if (restored) {
            if (nextSib && nextSib.parentNode === parent) {
              parent.insertBefore(restored, nextSib);
            } else {
              parent.appendChild(restored);
            }
          }
        }
      } else if (change._originalType === 'insertAdjacent') {
        const inserted = change._insertedNode;
        if (inserted && inserted.parentNode) {
          inserted.parentNode.removeChild(inserted);
        }
      }
    }
    
    appliedPatches.clear();
    return { ok: true };
  }

  /* ───────── Message handler ───────── */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('[Accea Scanner] Received message:', msg.type, msg);

    try {
      if (msg.type === 'highlight-issues') {
        const count = highlightIssues(msg.issues || []);
        console.log('[Accea Scanner] Highlighted', count, 'issues');
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

      if (msg.type === 'show-page-banner') {
        const banner = document.querySelector('.ua-a11y-page-banner');
        if (banner) {
          const isVisible = !banner.classList.contains('ua-hidden');
          banner.classList.toggle('ua-hidden');
          sendResponse({ ok: true, visible: !isVisible });
        } else {
          sendResponse({ ok: false, error: 'No page-level issues' });
        }
        return false;
      }

      if (msg.type === 'get-dom-context') {
        const context = collectDOMContext(msg.selector);
        sendResponse({ ok: true, context });
        return false;
      }

      if (msg.type === 'apply-patch') {
        const result = applyPatch(msg.change, msg.patchId);
        console.log('[Accea Scanner] apply-patch result:', result);
        sendResponse(result);
        return false;
      }

      if (msg.type === 'mark-patched') {
        markPatched(msg.selectors, msg.issueNum, msg.issueTitle);
        sendResponse({ ok: true });
        return false;
      }

      if (msg.type === 'undo-patch') {
        const result = undoPatch(msg.patchId);
        sendResponse(result);
        return false;
      }

      if (msg.type === 'reset-patches') {
        const result = resetAllPatches();
        sendResponse(result);
        return false;
      }

      if (msg.type === 'ping') {
        sendResponse({ ok: true, ready: true });
        return false;
      }
    } catch (err) {
      console.error('[Accea Scanner] Error handling message:', msg.type, err);
      sendResponse({ ok: false, error: err.message });
      return false;
    }

    // Unhandled message type — don't call sendResponse, just return false
    return false;
  });

  /* ───────── Init log ───────── */
  console.log('[Accea Agent] Scanner content script loaded');
})();
