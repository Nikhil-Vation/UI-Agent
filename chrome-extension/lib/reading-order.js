/**
 * Reading-order mismatch.
 *
 * axe reads the DOM tree; it has no idea what the page looks like. CSS can
 * make those two things disagree — flex/grid `order`, floats, absolute
 * positioning — and every automated check still passes, because the markup is
 * perfectly valid. A screen reader follows the DOM, so it narrates the page in
 * an order a sighted user has never seen.
 */
(function (root) {
  'use strict';

  const READABLE = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,td,th,blockquote,figcaption';

  function base(ruleId, severity) {
    return { ruleId, severity, wcag: ['1.3.2'], category: 'reading-order', passedAutomated: true };
  }

  /**
   * `elements` are content nodes in DOM order, each carrying `rect` and, when
   * the browser reports one, the CSS `order` the element was placed under.
   */
  function assessReadingOrder(elements = []) {
    const findings = [];

    // Mechanical, zero-false-positive check first: an explicit flex/grid
    // `order` is a direct admission that visual position was moved away from
    // DOM position. No heuristic needed — the author declared the mismatch.
    const reordered = elements.filter(e => e.cssOrder && e.cssOrder !== 0);
    if (reordered.length) {
      findings.push({
        ...base('explicit-visual-reorder', 'serious'),
        title: 'Content is visually reordered with CSS',
        occurrences: reordered.length,
        selectors: reordered.map(e => e.selector),
        evidence: `${reordered.length} element${reordered.length > 1 ? 's set' : ' sets'} a CSS order — e.g. \`order: ${reordered[0].cssOrder}\` on <${reordered[0].tag}>`,
        description: 'The visual position no longer matches the document order, so a screen reader announces this content in a different sequence than a sighted user sees it in.',
        suggestedFix: 'Match source order to visual order rather than reordering with CSS. If the layout genuinely needs it, confirm the reading order still makes sense.'
      });
    }

    // Heuristic pass over everything else: DOM order vs a simple row-then-column
    // visual reading, tolerant of a few pixels — the same shape check used for
    // keyboard tab order, applied here to reading content rather than focus.
    const candidates = elements.filter(e => !e.cssOrder);
    if (candidates.length > 4) {
      const domOrder = candidates.map((_, i) => i);
      const visualOrder = candidates
        .map((el, i) => ({ i, row: Math.round((el.rect?.y ?? 0) / 24), x: el.rect?.x ?? 0 }))
        .sort((a, b) => a.row - b.row || a.x - b.x)
        .map(x => x.i);

      const mismatched = domOrder.filter((v, i) => v !== visualOrder[i]);
      if (mismatched.length > Math.max(3, candidates.length * 0.25)) {
        const sample = mismatched.slice(0, 5).map(i => candidates[i]);
        findings.push({
          ...base('reading-order-mismatch', 'moderate'),
          title: 'Reading order does not follow the visual layout',
          occurrences: mismatched.length,
          selectors: sample.map(e => e.selector),
          evidence: `${mismatched.length} of ${candidates.length} content elements are positioned out of their document order`,
          description: 'Likely caused by floats or absolute positioning rather than an explicit CSS order. The page reads correctly by eye but not in the sequence a screen reader follows.',
          suggestedFix: 'Check whether floated or absolutely positioned elements land where the DOM puts them, and reorder the source if not.'
        });
      }
    }

    return findings.map((f, i) => ({ ...f, id: `READORDER-${i + 1}` }));
  }

  /** Serialized into the MAIN world; self-contained. */
  function collectReadingOrderProfile() {
    const cssPath = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parts = [];
      let n = el;
      while (n && n.nodeType === 1 && parts.length < 4) {
        let p = n.tagName.toLowerCase();
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

    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    return {
      elements: [...document.querySelectorAll(READABLE)]
        .filter(visible)
        .slice(0, 200)
        .map(el => {
          const r = el.getBoundingClientRect();
          const order = parseInt(getComputedStyle(el).order, 10);
          return {
            selector: cssPath(el), tag: el.tagName.toLowerCase(),
            rect: { x: Math.round(r.left), y: Math.round(r.top + scrollY) },
            cssOrder: Number.isFinite(order) ? order : 0
          };
        }),
      url: location.href
    };
  }

  root.ReadingOrder = { assessReadingOrder, collectReadingOrderProfile };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ReadingOrder;
})(typeof globalThis !== 'undefined' ? globalThis : self);
