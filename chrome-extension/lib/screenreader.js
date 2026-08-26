/**
 * Screen reader announcement preview.
 *
 * Renders what a screen reader would say moving through the page. Most people
 * shipping inaccessible pages have never heard one, and a list of rule
 * violations does not convey the experience — "button, button, button, link,
 * link" does, instantly.
 *
 * Honest about what it is: an approximation of the accessible name computation,
 * not a screen reader. Real output varies by product (JAWS, NVDA, VoiceOver),
 * verbosity setting and browser. The transcript says so, because presenting an
 * approximation as literal output would be the easiest thing here to overclaim.
 */
(function (root) {
  'use strict';

  const ROLE_PHRASE = {
    link: 'link', button: 'button', checkbox: 'check box', radio: 'radio button',
    textbox: 'edit text', combobox: 'combo box', listbox: 'list box', slider: 'slider',
    tab: 'tab', menuitem: 'menu item', image: 'image', heading: 'heading',
    navigation: 'navigation landmark', main: 'main landmark', banner: 'banner landmark',
    contentinfo: 'content info landmark', search: 'search landmark', form: 'form landmark',
    region: 'region', dialog: 'dialog', switch: 'switch', separator: 'separator'
  };

  /** One announcement line: name, then role, then state — the usual SR order. */
  function formatAnnouncement(item) {
    if (!item) return '';
    const parts = [];

    if (item.name) parts.push(item.name);

    let role = ROLE_PHRASE[item.role] || item.role || '';
    if (item.role === 'heading' && item.level) role = `heading level ${item.level}`;
    if (role) parts.push(role);

    for (const s of (item.states || [])) parts.push(s);

    // An unnamed control is the thing worth hearing: the announcement is just
    // the role, which tells the listener nothing about what it does.
    return parts.join(', ') || '(nothing announced)';
  }

  function buildTranscript(items) {
    return (items || []).map(item => ({
      selector: item.selector,
      announcement: formatAnnouncement(item),
      unnamed: !item.name && item.role !== 'heading'
    }));
  }

  /**
   * Findings drawn from the transcript as a whole.
   *
   * Deliberately not a per-element name check — axe already reports a button with
   * no accessible name. What it cannot see is the *sequence*: several controls in
   * a row that sound identical are individually valid and collectively unusable.
   */
  function assessTranscript(items) {
    const lines = buildTranscript(items);
    const findings = [];

    const unnamed = lines.filter(l => l.unnamed);
    if (unnamed.length) {
      findings.push({
        ruleId: 'announced-without-name', severity: 'critical', wcag: ['4.1.2'],
        category: 'screenreader', passedAutomated: true,
        title: 'Controls announce only their type, not their purpose',
        occurrences: unnamed.length,
        selectors: unnamed.map(l => l.selector),
        evidence: unnamed.slice(0, 3).map(l => `"${l.announcement}"`).join(' · '),
        description: 'A screen reader reads these out as just "button" or "link" with no indication of what they do.',
        suggestedFix: 'Give each control visible text, or an aria-label describing its action.'
      });
    }

    // Runs of identical announcements.
    let run = [];
    const runs = [];
    for (const line of lines) {
      if (run.length && run[0].announcement === line.announcement) run.push(line);
      else { if (run.length >= 3) runs.push([...run]); run = [line]; }
    }
    if (run.length >= 3) runs.push(run);

    for (const r of runs) {
      findings.push({
        ruleId: 'indistinguishable-announcements', severity: 'serious', wcag: ['2.4.4'],
        category: 'screenreader', passedAutomated: true,
        title: 'Several controls in a row sound identical',
        occurrences: r.length,
        selectors: r.map(l => l.selector),
        evidence: `${r.length} in sequence all announce as "${r[0].announcement}"`,
        description: 'Each is valid on its own, but heard one after another there is no way to tell them apart or know which one to activate.',
        suggestedFix: 'Make each name describe its own destination or action.'
      });
    }

    const weight = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    findings.sort((a, b) => (weight[a.severity] ?? 9) - (weight[b.severity] ?? 9));
    return findings.map((f, i) => ({ ...f, id: `SR-${i + 1}` }));
  }

  function renderTranscriptMarkdown(lines, pageUrl) {
    const out = ['# Screen reader preview', ''];
    if (pageUrl) out.push(`Page: ${pageUrl}`, '');
    out.push('What a screen reader user would hear moving through this page, in order.', '');
    out.push('```');
    for (const l of (lines || [])) out.push(l.announcement);
    out.push('```', '');
    out.push('Approximation of the accessible name computation, not literal output — actual wording varies by screen reader (JAWS, NVDA, VoiceOver), verbosity setting and browser.');
    return out.join('\n');
  }

  /**
   * Collect the navigation surface from the live page.
   *
   * Focusable controls, headings and landmarks — the three things screen reader
   * users actually jump between. Serialized into the MAIN world, so self-contained.
   */
  function collectAnnouncements() {
    const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

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

    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    // Accessible name, in specification precedence order.
    const accName = (el) => {
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const text = labelledby.split(/\s+/)
          .map(id => document.getElementById(id)?.textContent || '')
          .join(' ').trim();
        if (text) return clip(text, 80);
      }
      const label = el.getAttribute('aria-label');
      if (label && label.trim()) return clip(label, 80);

      if (el.id) {
        const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (forLabel?.textContent.trim()) return clip(forLabel.textContent, 80);
      }
      const wrapping = el.closest('label');
      if (wrapping?.textContent.trim()) return clip(wrapping.textContent, 80);

      const tag = el.tagName.toLowerCase();
      if (tag === 'img') return clip(el.getAttribute('alt') || '', 80);
      if (tag === 'input') {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        if (t === 'submit' || t === 'button') return clip(el.value || '', 80);
        if (el.placeholder) return clip(el.placeholder, 80);
        return '';
      }
      if (el.textContent?.trim()) return clip(el.textContent, 80);
      return clip(el.getAttribute('title') || '', 80);
    };

    const roleOf = (el) => {
      const explicit = el.getAttribute('role');
      if (explicit) return explicit.split(/\s+/)[0];
      const tag = el.tagName.toLowerCase();
      if (tag === 'a') return el.hasAttribute('href') ? 'link' : '';
      if (tag === 'button') return 'button';
      if (tag === 'select') return 'combobox';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'img') return 'image';
      if (tag === 'nav') return 'navigation';
      if (tag === 'main') return 'main';
      if (tag === 'header') return 'banner';
      if (tag === 'footer') return 'contentinfo';
      if (/^h[1-6]$/.test(tag)) return 'heading';
      if (tag === 'input') {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        if (t === 'checkbox') return 'checkbox';
        if (t === 'radio') return 'radio';
        if (t === 'submit' || t === 'button' || t === 'reset') return 'button';
        return 'textbox';
      }
      return '';
    };

    const statesOf = (el) => {
      const s = [];
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') s.push('unavailable');
      if (el.getAttribute('aria-expanded') === 'true') s.push('expanded');
      if (el.getAttribute('aria-expanded') === 'false') s.push('collapsed');
      if (el.checked || el.getAttribute('aria-checked') === 'true') s.push('checked');
      if (el.required || el.getAttribute('aria-required') === 'true') s.push('required');
      if (el.getAttribute('aria-current')) s.push('current');
      return s;
    };

    const selector = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"]),' +
                     'h1,h2,h3,h4,h5,h6,nav,main,header,footer,[role]';

    return {
      items: [...document.querySelectorAll(selector)]
        .filter(visible)
        .filter(el => el.getAttribute('aria-hidden') !== 'true')
        .slice(0, 150)
        .map(el => ({
          selector: cssPath(el),
          name: accName(el),
          role: roleOf(el),
          level: /^h[1-6]$/.test(el.tagName.toLowerCase()) ? Number(el.tagName[1]) : null,
          states: statesOf(el)
        }))
        .filter(i => i.role || i.name),
      url: location.href
    };
  }

  root.ScreenReader = {
    formatAnnouncement, buildTranscript, assessTranscript,
    renderTranscriptMarkdown, collectAnnouncements
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ScreenReader;
})(typeof globalThis !== 'undefined' ? globalThis : self);
