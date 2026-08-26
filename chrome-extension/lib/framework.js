/**
 * Framework-aware fix output.
 *
 * A fix handed to a React developer as `class="btn"` is a fix they have to
 * translate before using, and tools that hand you the wrong dialect get
 * dismissed as not really understanding the codebase.
 *
 * The honest scope of this is narrower than it first appears. Vue, Angular and
 * Svelte templates accept plain HTML attributes — `class` and `for` are correct
 * in all three — so there is genuinely nothing to convert, and inventing
 * differences to look thorough would produce worse output than doing nothing.
 * JSX is the real exception, and that is where the work is.
 */
(function (root) {
  'use strict';

  /** Attributes JSX spells differently. aria-* and data-* are deliberately absent: JSX takes them verbatim. */
  const JSX_ATTRIBUTES = {
    class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly',
    maxlength: 'maxLength', minlength: 'minLength', colspan: 'colSpan', rowspan: 'rowSpan',
    contenteditable: 'contentEditable', spellcheck: 'spellCheck', srcset: 'srcSet',
    crossorigin: 'crossOrigin', usemap: 'useMap', novalidate: 'noValidate', enctype: 'encType',
    formaction: 'formAction', accesskey: 'accessKey', autofocus: 'autoFocus',
    autoplay: 'autoPlay', datetime: 'dateTime', frameborder: 'frameBorder',
    allowfullscreen: 'allowFullScreen', autocomplete: 'autoComplete', inputmode: 'inputMode',
    cellpadding: 'cellPadding', cellspacing: 'cellSpacing'
  };

  const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);

  const FRAMEWORKS = {
    react:   { label: 'React (JSX)', transform: 'jsx' },
    preact:  { label: 'Preact (JSX)', transform: 'jsx' },
    next:    { label: 'Next.js (JSX)', transform: 'jsx' },
    vue:     { label: 'Vue', transform: 'none' },
    angular: { label: 'Angular', transform: 'none' },
    svelte:  { label: 'Svelte', transform: 'none' },
    html:    { label: 'HTML', transform: 'none' }
  };

  /**
   * Identify the framework from the detected tech stack.
   * Checked most specific first — Next.js also reports React.
   */
  function detectFramework(tech) {
    const names = (tech || [])
      .map(t => String(typeof t === 'string' ? t : t?.name || '').toLowerCase())
      .filter(Boolean);

    const has = (needle) => names.some(n => n.includes(needle));

    if (has('next')) return 'next';
    if (has('preact')) return 'preact';
    if (has('react')) return 'react';
    if (has('angular')) return 'angular';
    if (has('svelte')) return 'svelte';
    if (has('vue') || has('nuxt')) return 'vue';
    return 'html';
  }

  /** `color: red; font-size: 12px` → `{{ color: 'red', fontSize: '12px' }}` */
  function styleToJsxObject(styleValue) {
    const pairs = String(styleValue || '')
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .map(decl => {
        const idx = decl.indexOf(':');
        if (idx === -1) return null;
        const prop = decl.slice(0, idx).trim();
        const value = decl.slice(idx + 1).trim();
        if (!prop) return null;
        // Custom properties keep their exact name and must be quoted.
        const key = prop.startsWith('--')
          ? `'${prop}'`
          : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return `${key}: '${value.replace(/'/g, "\\'")}'`;
      })
      .filter(Boolean);

    return pairs.length ? `{{ ${pairs.join(', ')} }}` : null;
  }

  /**
   * Convert an HTML snippet to JSX.
   *
   * Operates on the attribute text of each tag rather than parsing the whole
   * document, because the input is a fragment — often a single element — and a
   * full parse would need a DOM that the service worker does not have.
   */
  function toJsx(html) {
    if (!html) return '';

    return String(html).replace(/<([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)(\/?)>/g,
      (match, tag, attrText, selfClose) => {
        const lower = tag.toLowerCase();
        let attrs = attrText || '';

        // style="..." → style={{ ... }}
        attrs = attrs.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi, (m, _q, value) => {
          const obj = styleToJsxObject(value);
          return obj ? ` style=${obj}` : '';
        });

        // Rename attributes JSX spells differently, leaving aria-/data-/on* alone.
        attrs = attrs.replace(/(\s)([a-zA-Z][\w-]*)(\s*=)/g, (m, space, name, eq) => {
          const key = name.toLowerCase();
          if (key.startsWith('aria-') || key.startsWith('data-')) return m;
          const mapped = JSX_ATTRIBUTES[key];
          return mapped ? `${space}${mapped}${eq}` : m;
        });

        // Bare boolean attributes (`disabled`, `checked`) also need renaming.
        attrs = attrs.replace(/(\s)([a-zA-Z][\w-]*)(?=\s|$)/g, (m, space, name) => {
          const key = name.toLowerCase();
          if (key.startsWith('aria-') || key.startsWith('data-')) return m;
          const mapped = JSX_ATTRIBUTES[key];
          return mapped ? `${space}${mapped}` : m;
        });

        // JSX has no void elements — they must close explicitly. Trailing slash
        // and whitespace are stripped first so an already-closed tag does not
        // end up with a doubled space before the new one.
        const close = (VOID_ELEMENTS.has(lower) || selfClose) ? ' />' : '>';
        return `<${tag}${attrs.replace(/\s*\/?\s*$/, '')}${close}`;
      });
  }

  /**
   * Format a code snippet for the detected framework.
   *
   * `note` explains what happened — including "nothing needed to change", which
   * is the truthful answer for template-based frameworks and more useful than
   * silence.
   */
  function formatForFramework(code, framework) {
    const key = FRAMEWORKS[framework] ? framework : 'html';
    const spec = FRAMEWORKS[key];

    if (spec.transform === 'jsx') {
      const converted = toJsx(code);
      return {
        framework: key,
        label: spec.label,
        code: converted,
        changed: converted !== code,
        note: converted !== code
          ? 'Converted to JSX: attribute names and inline styles use React spelling.'
          : 'No JSX-specific changes were needed for this snippet.'
      };
    }

    return {
      framework: key,
      label: spec.label,
      code,
      changed: false,
      note: key === 'html'
        ? ''
        : `${spec.label} templates accept plain HTML attributes, so this snippet needs no conversion.`
    };
  }

  root.Framework = { detectFramework, formatForFramework, toJsx, FRAMEWORKS };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.Framework;
})(typeof globalThis !== 'undefined' ? globalThis : self);
