/**
 * Keyboard and focus simulation.
 *
 * axe analyses a DOM snapshot. Keyboard behaviour is dynamic — whether focus is
 * visible, where it lands, and whether it can escape are properties of the page
 * *running*, not of its markup. That is why this finds things no rule engine can,
 * and it is the honest basis for the claim.
 *
 * Scope boundary worth being straight about: detecting an arbitrary focus trap
 * requires dispatching real key events and observing a handler that may call
 * preventDefault. That is not done here. What IS detected is structural and
 * measurable — invisible focus, focus landing off-screen, tab order diverging
 * from visual order, interactive elements keyboard users cannot reach, and a
 * modal that leaves the page behind it focusable.
 */
(function (root) {
  'use strict';

  const FINDING = {
    invisible:   'focus-not-visible',
    offscreen:   'focus-offscreen',
    order:       'focus-order-mismatch',
    unreachable: 'interactive-not-focusable',
    modal:       'modal-focus-escape'
  };

  const base = (ruleId, severity, wcag) => ({
    ruleId, severity, wcag, category: 'keyboard', passedAutomated: true
  });

  /** Row-then-column reading order, tolerant of a few pixels of misalignment. */
  function visualOrder(elements) {
    return elements
      .map((el, i) => ({ i, el }))
      .sort((a, b) => {
        const rowA = Math.round((a.el.rect?.y ?? 0) / 24);
        const rowB = Math.round((b.el.rect?.y ?? 0) / 24);
        return rowA - rowB || (a.el.rect?.x ?? 0) - (b.el.rect?.x ?? 0);
      })
      .map(x => x.i);
  }

  /**
   * The order the browser will actually use: positive tabindex first in ascending
   * order, then everything else in DOM order. Authors reach for positive tabindex
   * expecting it to nudge one element; it silently reorders the whole page.
   */
  function tabOrder(elements) {
    const positive = elements
      .map((el, i) => ({ i, t: el.tabindex }))
      .filter(x => x.t > 0)
      .sort((a, b) => a.t - b.t || a.i - b.i)
      .map(x => x.i);
    const natural = elements
      .map((el, i) => ({ i, t: el.tabindex }))
      .filter(x => !(x.t > 0))
      .map(x => x.i);
    return [...positive, ...natural];
  }

  function assessFocusOrder(profile = {}) {
    const elements = Array.isArray(profile.elements) ? profile.elements : [];
    const findings = [];

    const invisible = elements.filter(e => e.focusable && e.visible && !e.focusVisible);
    if (invisible.length) {
      findings.push({
        ...base(FINDING.invisible, 'serious', ['2.4.7']),
        title: 'Focus is not visible on some controls',
        occurrences: invisible.length,
        selectors: invisible.map(e => e.selector),
        evidence: `${invisible.length} control${invisible.length > 1 ? 's show' : ' shows'} no visible change when focused`,
        description: 'Someone navigating by keyboard cannot tell where they are on the page. This is measured by focusing each control and comparing its computed style before and after — a check that cannot be made from markup alone.',
        suggestedFix: 'Give :focus-visible a clear outline. Never remove an outline without replacing it.'
      });
    }

    const offscreen = elements.filter(e => e.focusable && e.visible && e.focusVisible && e.offscreenOnFocus);
    if (offscreen.length) {
      findings.push({
        ...base(FINDING.offscreen, 'serious', ['2.4.7', '2.4.3']),
        title: 'Focus moves to something off-screen',
        occurrences: offscreen.length,
        selectors: offscreen.map(e => e.selector),
        evidence: `${offscreen.length} control${offscreen.length > 1 ? 's are' : ' is'} outside the viewport when focused`,
        description: 'Focus lands somewhere the user cannot see, so the page appears to stop responding to the keyboard.',
        suggestedFix: 'Ensure focused elements scroll into view, and that off-screen menus are removed from the tab order until opened.'
      });
    }

    const unreachable = elements.filter(e => e.interactive && !e.focusable);
    if (unreachable.length) {
      findings.push({
        ...base(FINDING.unreachable, 'critical', ['2.1.1']),
        title: 'Interactive elements cannot be reached by keyboard',
        occurrences: unreachable.length,
        selectors: unreachable.map(e => e.selector),
        evidence: `${unreachable.length} clickable element${unreachable.length > 1 ? 's have' : ' has'} no keyboard access`,
        description: 'These respond to a mouse click but are not in the tab order, so keyboard and switch users cannot operate them at all.',
        suggestedFix: 'Use a real <button>, or add tabindex="0" together with keydown handling for Enter and Space.'
      });
    }

    // Order comparison only means something once there is an order to compare.
    const focusable = elements.filter(e => e.focusable && e.visible);
    if (focusable.length > 2) {
      const tab = tabOrder(focusable);
      const visual = visualOrder(focusable);
      const mismatches = tab.filter((v, i) => v !== visual[i]).length;
      // A little divergence is normal in real layouts; a third of the page is not.
      if (mismatches > Math.max(2, focusable.length * 0.3)) {
        const positives = focusable.filter(e => e.tabindex > 0);
        findings.push({
          ...base(FINDING.order, 'serious', ['2.4.3']),
          title: 'Tab order does not follow the visual order',
          occurrences: mismatches,
          selectors: (positives.length ? positives : focusable).slice(0, 5).map(e => e.selector),
          evidence: positives.length
            ? `${positives.length} element${positives.length > 1 ? 's use' : ' uses'} a positive tabindex, which reorders the whole page`
            : `${mismatches} of ${focusable.length} controls are reached in a different order than they appear`,
          description: 'Keyboard users move through the page in an order that does not match what they see, which makes forms and navigation confusing to follow.',
          suggestedFix: positives.length
            ? 'Replace positive tabindex values with 0 and let DOM order define the sequence.'
            : 'Align the DOM order with the visual order rather than repositioning with CSS.'
        });
      }
    }

    if (profile.modal?.open && profile.modal.backgroundFocusable) {
      findings.push({
        ...base(FINDING.modal, 'critical', ['2.4.3']),
        title: 'Focus can leave an open dialog',
        occurrences: 1,
        selectors: [profile.modal.selector].filter(Boolean),
        evidence: `${profile.modal.backgroundFocusable} focusable element${profile.modal.backgroundFocusable > 1 ? 's remain' : ' remains'} behind the open dialog`,
        description: 'Tabbing moves out of the dialog and into the page behind it, which a screen reader user cannot see is still there.',
        suggestedFix: 'Trap focus inside the dialog while it is open, and mark the rest of the page inert or aria-hidden.'
      });
    }

    const weight = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    findings.sort((a, b) => (weight[a.severity] ?? 9) - (weight[b.severity] ?? 9) || b.occurrences - a.occurrences);
    return findings.map((f, i) => ({ ...f, id: `KEYBOARD-${i + 1}` }));
  }

  /**
   * Measure focus behaviour on the live page.
   *
   * Serialized into the MAIN world, so it must be self-contained. It really does
   * focus each control and diff the computed style — that measurement is the
   * whole point and cannot be inferred from markup.
   */
  function collectFocusProfile() {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],details,iframe,[contenteditable="true"]';
    const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

    const cssPath = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let n = el;
      while (n && n.nodeType === 1 && parts.length < 4) {
        let p = n.tagName.toLowerCase();
        if (n.classList.length) p += `.${CSS.escape(n.classList[0])}`;
        const parent = n.parentElement;
        if (parent) {
          const twins = [...parent.children].filter(c => c.tagName === n.tagName);
          if (twins.length > 1) p += `:nth-of-type(${twins.indexOf(n) + 1})`;
        }
        parts.unshift(p);
        n = n.parentElement;
      }
      return parts.join(' > ');
    };

    const isVisible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // Signature of the visual treatment that indicates focus.
    const focusSignature = (el) => {
      const s = getComputedStyle(el);
      return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor].join('|');
    };

    const previouslyFocused = document.activeElement;
    const elements = [];
    const candidates = [...document.querySelectorAll(FOCUSABLE)].slice(0, 120);

    for (const el of candidates) {
      const visible = isVisible(el);
      const tabindexAttr = el.getAttribute('tabindex');
      const tabindex = tabindexAttr === null ? 0 : parseInt(tabindexAttr, 10) || 0;
      const disabled = el.disabled === true;
      const focusable = visible && !disabled && tabindex > -1;

      let focusVisible = true;
      let offscreenOnFocus = false;

      if (focusable) {
        const before = focusSignature(el);
        try {
          el.focus({ preventScroll: true });
          focusVisible = focusSignature(el) !== before;
          const r = el.getBoundingClientRect();
          offscreenOnFocus = r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
        } catch { /* element refused focus */ }
      }

      const r = el.getBoundingClientRect();
      elements.push({
        selector: cssPath(el), tag: el.tagName.toLowerCase(), tabindex,
        visible, focusable, focusVisible, offscreenOnFocus, interactive: false,
        rect: { x: Math.round(r.left), y: Math.round(r.top + scrollY) },
        html: clip(el.outerHTML, 200)
      });
    }

    // Things that behave like controls but are not focusable: a keyboard user
    // cannot operate them at all, and axe cannot see the click handler.
    const pseudo = [...document.querySelectorAll('[onclick],[role="button"],[role="link"],[role="tab"],[role="menuitem"]')]
      .filter(el => !el.matches(FOCUSABLE) && isVisible(el))
      .slice(0, 40);
    for (const el of pseudo) {
      const r = el.getBoundingClientRect();
      elements.push({
        selector: cssPath(el), tag: el.tagName.toLowerCase(), tabindex: -1,
        visible: true, focusable: false, focusVisible: false, offscreenOnFocus: false,
        interactive: true, rect: { x: Math.round(r.left), y: Math.round(r.top + scrollY) },
        html: clip(el.outerHTML, 200)
      });
    }

    const dialog = document.querySelector('[role="dialog"][aria-modal="true"],dialog[open]');
    let modal = null;
    if (dialog && isVisible(dialog)) {
      const outside = [...document.querySelectorAll(FOCUSABLE)].filter(
        el => !dialog.contains(el) && isVisible(el) &&
              !el.closest('[inert]') && el.closest('[aria-hidden="true"]') === null);
      modal = { open: true, selector: cssPath(dialog), backgroundFocusable: outside.length };
    }

    try { previouslyFocused && previouslyFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
    return { elements, modal, url: location.href };
  }

  root.Keyboard = { assessFocusOrder, collectFocusProfile, FINDING };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Keyboard;
})(typeof globalThis !== 'undefined' ? globalThis : self);
