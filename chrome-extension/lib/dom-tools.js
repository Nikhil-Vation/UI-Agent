/**
 * DOM Tools — let the model ask the page questions instead of guessing.
 *
 * Without these, a fix is generated from `issue.html` truncated to a couple of
 * hundred characters plus a selector. The model cannot see the computed colour
 * behind a contrast failure, cannot tell whether a label already exists
 * elsewhere in the form, and cannot read the surrounding text that would name a
 * button sensibly. It guesses, and on the hard cases it guesses wrong — which is
 * precisely where the LLM is used, since the rule engine already handles the easy
 * ones.
 *
 * The final answer is itself a tool (`submit_fix`). That keeps one mechanism
 * across all four providers: the model calls inspection tools until it knows
 * enough, then calls submit_fix with the schema-shaped answer.
 */

/* ═══════════════════════════════════════════
   Tool definitions — provider-neutral
   ═══════════════════════════════════════════ */

export const DOM_TOOLS = [
  {
    name: 'get_dom_context',
    description:
      'Inspect one element: its tag, attributes, ARIA role, visibility, parent chain and text content. ' +
      'Use this before deciding what an element is for.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_computed_style',
    description:
      'Read resolved CSS values for an element, following inheritance and cascade. ' +
      'Essential for contrast problems: the real foreground and background colours are ' +
      'almost never in the inline HTML.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element' },
        properties: {
          type: 'array',
          items: { type: 'string' },
          description: 'CSS property names, e.g. ["color","backgroundColor","fontSize"]'
        }
      },
      required: ['selector', 'properties']
    }
  },
  {
    name: 'query_selector_all',
    description:
      'Find every element matching a selector, with a brief summary of each. ' +
      'Use to check whether something already exists — a <label> for this field, ' +
      'another element with this id, an existing landmark.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to search for' },
        limit: { type: 'number', description: 'Maximum results to return (default 10)' }
      },
      required: ['selector']
    }
  },
  {
    name: 'get_sibling_context',
    description:
      'Read the elements immediately around a target, plus its parent. ' +
      'Use when naming something — nearby headings and text usually say what a ' +
      'control is for far better than its own markup does.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for the element' }
      },
      required: ['selector']
    }
  }
];

/** The terminal tool. Calling it ends the loop and returns the fix. */
export const SUBMIT_TOOL_NAME = 'submit_fix';

export function buildSubmitTool(schema) {
  return {
    name: SUBMIT_TOOL_NAME,
    description:
      'Submit the final fix. Call this once you have gathered enough context. ' +
      'The "after" value must be real code that resolves the violation.',
    parameters: schema
  };
}

/* ═══════════════════════════════════════════
   Page-side implementation
   ═══════════════════════════════════════════ */

/**
 * Execute one tool against the live document.
 *
 * Serialized into the page's MAIN world by chrome.scripting.executeScript, so it
 * must be entirely self-contained: no imports, no closure over module scope, and
 * everything it returns must be structured-cloneable.
 */
export function runDomTool(name, args) {
  const MAX_HTML = 400;
  const MAX_TEXT = 200;

  const clip = (s, n) => {
    const str = String(s ?? '');
    return str.length > n ? str.slice(0, n) + '…' : str;
  };

  const attrs = (el) => {
    const out = {};
    for (const a of el.attributes) out[a.name] = clip(a.value, 120);
    return out;
  };

  const visible = (el) => {
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' &&
           el.offsetWidth > 0 && el.offsetHeight > 0;
  };

  const describe = (el) => ({
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: [...el.classList].slice(0, 6),
    role: el.getAttribute('role') || null,
    text: clip((el.textContent || '').replace(/\s+/g, ' ').trim(), MAX_TEXT),
    html: clip(el.outerHTML, MAX_HTML)
  });

  const one = (selector) => {
    try { return document.querySelector(selector); } catch { return null; }
  };

  try {
    if (name === 'get_dom_context') {
      const el = one(args.selector);
      if (!el) return { error: `No element matches ${args.selector}` };

      const parents = [];
      let p = el.parentElement;
      while (p && parents.length < 4) {
        parents.push({
          tag: p.tagName.toLowerCase(),
          id: p.id || null,
          classes: [...p.classList].slice(0, 4),
          role: p.getAttribute('role') || null
        });
        p = p.parentElement;
      }

      return {
        ...describe(el),
        attributes: attrs(el),
        visible: visible(el),
        childCount: el.children.length,
        hasDirectText: [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()),
        parents
      };
    }

    if (name === 'get_computed_style') {
      const el = one(args.selector);
      if (!el) return { error: `No element matches ${args.selector}` };

      const style = window.getComputedStyle(el);
      const out = {};
      for (const prop of (args.properties || [])) out[prop] = style[prop] ?? null;

      // A transparent background resolves to the nearest painted ancestor, which
      // is what actually sits behind the text. Contrast cannot be computed
      // without it, and the model has no other way to find it.
      if ((args.properties || []).some(p => /background/i.test(p))) {
        let node = el;
        let effective = null;
        while (node) {
          const bg = window.getComputedStyle(node).backgroundColor;
          if (bg && bg !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg)) {
            effective = { color: bg, from: node === el ? 'self' : node.tagName.toLowerCase() };
            break;
          }
          node = node.parentElement;
        }
        out.effectiveBackground = effective;
      }

      return out;
    }

    if (name === 'query_selector_all') {
      let list;
      try { list = document.querySelectorAll(args.selector); }
      catch { return { error: `Invalid selector: ${args.selector}` }; }

      const limit = Math.min(args.limit || 10, 25);
      return {
        count: list.length,
        elements: [...list].slice(0, limit).map(describe)
      };
    }

    if (name === 'get_sibling_context') {
      const el = one(args.selector);
      if (!el) return { error: `No element matches ${args.selector}` };

      const brief = (n) => n ? describe(n) : null;
      return {
        parent: brief(el.parentElement),
        previous: brief(el.previousElementSibling),
        next: brief(el.nextElementSibling),
        // Nearest preceding heading — usually the best clue to what a control is for
        nearestHeading: (() => {
          const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
          let best = null;
          for (const h of headings) {
            if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = h;
          }
          return best ? { tag: best.tagName.toLowerCase(), text: clip(best.textContent.trim(), MAX_TEXT) } : null;
        })()
      };
    }

    return { error: `Unknown tool: ${name}` };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}
