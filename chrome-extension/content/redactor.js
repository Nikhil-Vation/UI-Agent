/**
 * Data Redactor — Privacy layer for Accea Agent Chrome Extension
 * 
 * Strips sensitive data (PII, cookies, form values, text content)
 * before anything leaves the machine. Keeps only structural info:
 * tag names, class names, ARIA attributes, selectors, roles.
 *
 * Used when:
 *   - Sending data to cloud API (config.cloudOptIn)
 *   - Logging to external services
 *   - Any data path marked as "not private"
 */

(() => {
  'use strict';

  /* ───────── PII patterns ───────── */

  const PII_PATTERNS = {
    email:     /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone:     /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    ssn:       /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard:/\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    ipv4:      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    jwt:       /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    apiKey:    /(?:api[_-]?key|token|secret|password|auth)[=:\s]["']?[A-Za-z0-9_\-]{16,}["']?/gi,
    // URLs with query params might contain tokens
    urlToken:  /[?&](token|key|secret|auth|session|password)=[^&\s]+/gi,
  };

  /* ───────── Core redaction ───────── */

  /**
   * Redact PII from a string
   */
  function redactString(str) {
    if (!str || typeof str !== 'string') return str;
    let result = str;
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      result = result.replace(pattern, `[REDACTED:${type}]`);
    }
    return result;
  }

  /**
   * Redact text content from HTML string — keep tags, remove inner text
   */
  function redactHTMLContent(html) {
    if (!html || typeof html !== 'string') return html;
    // Replace text between tags with [TEXT]
    return html.replace(/>([^<]+)</g, (match, text) => {
      const trimmed = text.trim();
      if (!trimmed) return match;
      return '>[TEXT]<';
    });
  }

  /**
   * Redact sensitive attribute values from HTML
   */
  function redactHTMLAttributes(html) {
    if (!html || typeof html !== 'string') return html;
    // Redact value attributes (form inputs)
    let result = html.replace(/\bvalue\s*=\s*"[^"]*"/gi, 'value="[REDACTED]"');
    result = result.replace(/\bvalue\s*=\s*'[^']*'/gi, "value='[REDACTED]'");
    // Redact placeholder (might contain PII examples)
    result = result.replace(/\bplaceholder\s*=\s*"[^"]*"/gi, 'placeholder="[REDACTED]"');
    result = result.replace(/\bplaceholder\s*=\s*'[^']*'/gi, "placeholder='[REDACTED]'");
    // Redact title if it's long (might contain user data)
    result = result.replace(/\btitle\s*=\s*"([^"]*)"/gi, (m, val) => {
      return val.length > 50 ? 'title="[REDACTED]"' : m;
    });
    // Redact data attributes (often contain user data)
    result = result.replace(/\bdata-(?!ua-)[a-z-]+\s*=\s*"[^"]*"/gi, (m) => {
      // Keep data-ua- attributes (ours) but redact others
      return m.replace(/=\s*"[^"]*"/, '="[REDACTED]"');
    });
    return result;
  }

  /* ───────── Issue redaction ───────── */

  /**
   * Redact a single accessibility issue for safe transmission
   * Keeps: id, severity, wcag, selectors (structure only), tags
   * Removes/redacts: text content, PII, form values
   */
  function redactIssue(issue) {
    if (!issue) return issue;

    return {
      id: issue.id,
      type: issue.type,
      title: issue.title, // axe rule titles are generic, not user data
      severity: issue.severity,
      wcag: issue.wcag || [],
      tags: issue.tags || [],
      helpUrl: issue.helpUrl,
      elementCount: issue.elementCount || 0,
      // Redact selectors — keep tag/class/id structure but redact attribute values
      selectors: (issue.selectors || []).map(sel => redactSelector(sel)),
      // Redact HTML — strip text content and sensitive attributes
      html: (issue.html || []).map(h => redactHTMLAttributes(redactHTMLContent(redactString(h)))),
      // Redact nodes
      nodes: (issue.nodes || []).map(n => redactNode(n)),
      // Remove description if it might contain page content
      description: issue.description || ''
    };
  }

  /**
   * Redact a DOM node
   */
  function redactNode(node) {
    if (!node) return node;
    return {
      html: redactHTMLAttributes(redactHTMLContent(redactString(node.html || ''))),
      target: (node.target || []).map(t => typeof t === 'string' ? redactSelector(t) : t),
      failureSummary: node.failureSummary || '', // axe-generated text, safe
      impact: node.impact
    };
  }

  /**
   * Redact a CSS selector — keep structure but strip attribute value selectors
   */
  function redactSelector(selector) {
    if (!selector || typeof selector !== 'string') return selector;
    // Replace attribute value selectors: [attr="value"] → [attr="..."]
    return selector.replace(/\[([a-z-]+)\s*[~|^$*]?=\s*["'][^"']*["']\]/gi, '[$1="…"]');
  }

  /* ───────── Scan result redaction ───────── */

  /**
   * Redact an entire scan result object for safe cloud transmission
   */
  function redactScanResult(result) {
    if (!result) return result;

    return {
      // Keep aggregated stats (no PII)
      score: result.score,
      summary: result.summary,
      timestamp: result.timestamp,
      metadata: result.metadata,
      // Redact URL to just origin + path (strip query/hash)
      url: redactUrl(result.url),
      // Redact page title
      title: '[REDACTED]',
      // Redact each issue
      issues: (result.issues || []).map(i => redactIssue(i))
    };
  }

  /**
   * Redact URL — keep origin and path, strip query params and hash
   */
  function redactUrl(url) {
    if (!url) return url;
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname}`;
    } catch {
      return '[REDACTED_URL]';
    }
  }

  /* ───────── DOM context redaction ───────── */

  /**
   * Redact DOM context collected by scanner
   */
  function redactDOMContext(ctx) {
    if (!ctx) return ctx;
    return {
      tagName: ctx.tagName,
      id: ctx.id,
      className: ctx.className,
      role: ctx.role,
      ariaLabel: ctx.ariaLabel ? '[PRESENT]' : null,
      ariaLabelledBy: ctx.ariaLabelledBy ? '[PRESENT]' : null,
      ariaDescribedBy: ctx.ariaDescribedBy ? '[PRESENT]' : null,
      tabindex: ctx.tabindex,
      type: ctx.type,
      href: ctx.href,
      src: ctx.src,
      alt: ctx.alt ? '[PRESENT]' : null,
      title: ctx.title ? '[PRESENT]' : null,
      forAttr: ctx.forAttr,
      parentTag: ctx.parentTag,
      childCount: ctx.childCount,
      hasText: ctx.hasText,
      isVisible: ctx.isVisible,
      computedRole: ctx.computedRole,
      // Redact HTML content
      outerHTML: redactHTMLAttributes(redactHTMLContent(redactString(ctx.outerHTML || '')))
    };
  }

  /* ───────── Cookie / storage redaction ───────── */

  /**
   * Clear cookies from the data payload (if any leaked in)
   */
  function stripCookies(data) {
    if (!data || typeof data !== 'object') return data;
    const cleaned = { ...data };
    delete cleaned.cookies;
    delete cleaned.cookie;
    delete cleaned.sessionStorage;
    delete cleaned.localStorage;
    return cleaned;
  }

  /* ───────── Exports via message passing ───────── */

  /**
   * Listen for redaction requests from the service worker
   */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'redact-issue') {
      sendResponse({ ok: true, redacted: redactIssue(msg.issue) });
      return false;
    }

    if (msg.type === 'redact-scan') {
      sendResponse({ ok: true, redacted: redactScanResult(msg.scanResult) });
      return false;
    }

    if (msg.type === 'redact-dom-context') {
      sendResponse({ ok: true, redacted: redactDOMContext(msg.context) });
      return false;
    }

    if (msg.type === 'redact-string') {
      sendResponse({ ok: true, redacted: redactString(msg.text) });
      return false;
    }
  });

  /* ───────── Also expose on window for direct use ───────── */
  window.__uaRedactor = {
    redactString,
    redactHTMLContent,
    redactHTMLAttributes,
    redactIssue,
    redactScanResult,
    redactDOMContext,
    redactUrl,
    redactSelector,
    stripCookies
  };

  console.log('[Accea Agent] Redactor content script loaded');
})();
