/**
 * LLM Router — Cascading fallback for AI-powered fixes
 * 
 * Priority:
 *   1. window.ai (Chrome built-in on-device AI) — free, private, fast
 *   2. Gemini API (Google's generative AI) — free tier, private, reliable
 *   3. localhost orchestrator (local LLM) — powerful, private
 *   4. Cloud API — always works, redacted data only
 *   5. Deterministic — no LLM, rule-based suggestions only
 */

export class LLMRouter {
  constructor() {
    this._capabilities = null;
  }

  /**
   * Detect which LLM backends are available
   */
  async detectCapabilities() {
    const caps = { windowAI: false, gemini: false, localhost: false, cloud: false };

    // 1. Check window.ai (Chrome built-in)
    try {
      if (typeof self !== 'undefined' && self.ai && self.ai.languageModel) {
        const availability = await self.ai.languageModel.capabilities();
        caps.windowAI = availability.available === 'readily' || availability.available === 'after-download';
        caps.windowAIStatus = availability.available;
      }
    } catch (e) {
      caps.windowAI = false;
    }

    // 2. Check Gemini API (needs API key from settings)
    try {
      // Get API key from chrome.storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get('geminiApiKey');
        caps.gemini = !!(result.geminiApiKey && result.geminiApiKey.trim());
      }
    } catch (e) {
      caps.gemini = false;
    }

    // 3. Check localhost orchestrator
    try {
      const r = await fetch('http://localhost:3000/health', { signal: AbortSignal.timeout(3000) });
      if (r.ok) {
        const data = await r.json();
        caps.localhost = true;
        caps.localhostLLM = data.llm === 'ok';
        caps.localhostModel = data.llmModel || null;
      }
    } catch (e) {
      caps.localhost = false;
    }

    // 4. Cloud is always "available" if user opted in (checked at call time)
    caps.cloud = true;

    this._capabilities = caps;
    return caps;
  }

  /**
   * Generate a fix using the best available backend
   */
  async generateFix(issue, pageUrl, config = {}) {
    // 0. Try deterministic fix FIRST — instant for known rules (no LLM needed)
    const deterministicResult = this._deterministicFix(issue);
    if (deterministicResult.confidence >= 0.7) {
      return deterministicResult;
    }

    if (!this._capabilities) {
      await this.detectCapabilities();
    }

    const prompt = this._buildFixPrompt(issue, pageUrl);

    // 1. Try window.ai (Chrome built-in)
    if (this._capabilities.windowAI) {
      try {
        const result = await this._fixWithWindowAI(prompt);
        if (result) return { ...result, source: 'window.ai', private: true };
      } catch (e) {
        console.warn('window.ai failed:', e.message);
      }
    }

    // 2. Try Gemini API
    if (this._capabilities.gemini && config.geminiApiKey) {
      try {
        const result = await this._fixWithGemini(issue, pageUrl, config.geminiApiKey);
        if (result) return { ...result, source: 'gemini', private: true };
      } catch (e) {
        console.warn('Gemini API failed:', e.message);
      }
    }

    // 3. Try localhost orchestrator
    if (this._capabilities.localhost) {
      try {
        const serverUrl = config.localServerUrl || 'http://localhost:3000';
        const result = await this._fixWithLocalhost(issue, pageUrl, serverUrl);
        if (result) return { ...result, source: 'localhost', private: true };
      } catch (e) {
        console.warn('localhost failed:', e.message);
      }
    }

    // 4. Try cloud API (only if user opted in)
    if (config.cloudOptIn && !config.privacyMode) {
      try {
        const result = await this._fixWithCloud(issue, pageUrl);
        if (result) return { ...result, source: 'cloud', private: false };
      } catch (e) {
        console.warn('cloud failed:', e.message);
      }
    }

    // 5. Return deterministic fallback (low-confidence generic)
    return deterministicResult;
  }
    return deterministicResult;
  }

  /**
   * Use Chrome's built-in AI (on-device)
   */
  async _fixWithWindowAI(prompt) {
    const session = await self.ai.languageModel.create({
      systemPrompt: 'You are an expert accessibility engineer. Respond with valid JSON only.'
    });

    const response = await session.prompt(prompt);
    session.destroy();

    return this._parseFixResponse(response);
  }

  /**
   * Use Gemini API
   */
  async _fixWithGemini(issue, pageUrl, apiKey) {
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    
    const prompt = this._buildFixPrompt(issue, pageUrl);
    
    const requestBody = {
      contents: [{
        parts: [{
          text: `You are an expert accessibility engineer. Analyze this accessibility issue and provide a fix in valid JSON format.\n\n${prompt}\n\nRespond with JSON only: { "fixTitle": "...", "before": "...", "after": "...", "explanation": "...", "effort": "S/M/L", "confidence": 0.0-1.0 }`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const r = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    });

    if (!r.ok) {
      const errorText = await r.text();
      throw new Error(`Gemini API returned ${r.status}: ${errorText}`);
    }

    const data = await r.json();
    
    // Extract text from Gemini response structure
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Invalid Gemini API response structure');
    }

    return this._parseFixResponse(responseText);
  }

  /**
   * Use localhost orchestrator (/fix endpoint)
   */
  async _fixWithLocalhost(issue, pageUrl, serverUrl) {
    const r = await fetch(`${serverUrl}/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue, url: pageUrl }),
      signal: AbortSignal.timeout(30000)
    });

    if (!r.ok) throw new Error(`Server returned ${r.status}`);
    const data = await r.json();
    return data.fix || null;
  }

  /**
   * Use cloud API (redacted data)
   */
  async _fixWithCloud(issue, pageUrl) {
    const CLOUD_URL = 'https://api.accea-agent.com/fix';
    const r = await fetch(CLOUD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue, url: pageUrl }),
      signal: AbortSignal.timeout(30000)
    });

    if (!r.ok) throw new Error(`Cloud API returned ${r.status}`);
    const data = await r.json();
    return data.fix || null;
  }

  /**
   * Deterministic fixes — context-aware, using actual page HTML from axe-core.
   * Parses the real element HTML and generates precise before/after code.
   */
  _deterministicFix(issue) {
    const ruleId = issue.id || '';
    const rawHtml = (issue.html?.[0] || '').trim();
    const selector = issue.selectors?.[0] || '';

    // ── Helpers ──

    /** Extract an attribute value from an HTML string */
    const getAttr = (html, attr) => {
      const m = html.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
      return m ? m[1] : null;
    };

    /** Inject or replace an attribute in the first HTML tag */
    const setAttr = (html, attr, value) => {
      const existing = new RegExp(`(\\s)${attr}\\s*=\\s*["'][^"']*["']`, 'i');
      if (existing.test(html)) return html.replace(existing, `$1${attr}="${value}"`);
      return html.replace(/>/, ` ${attr}="${value}">`);
    };

    /** Remove an attribute from an HTML tag */
    const removeAttr = (html, attr) =>
      html.replace(new RegExp(`\\s+${attr}\\s*=\\s*["'][^"']*["']`, 'gi'), '');

    /** Extract the tag name */
    const getTag = (html) => {
      const m = html.match(/^<(\w+)/);
      return m ? m[1].toLowerCase() : '';
    };

    /** Humanise a filename or CSS name into a readable label */
    const humanise = (str) =>
      str.replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').replace(/\b\w/g, c => c.toUpperCase()).trim();

    // ── Rule handlers — each receives rawHtml and returns a fix object or null ──

    const rules = {

      'html-has-lang': () => {
        const before = rawHtml || '<html>';
        return { fixTitle: 'Add lang attribute', before, after: setAttr(before, 'lang', 'en'), explanation: 'Add the lang attribute to <html> so screen readers identify the page language.', effort: 'S', confidence: 1.0 };
      },

      'html-lang-valid': () => {
        const before = rawHtml || '<html lang="">';
        return { fixTitle: 'Fix lang attribute value', before, after: setAttr(before, 'lang', 'en'), explanation: 'Replace the invalid lang value with a valid BCP 47 code (e.g., "en", "fr", "es").', effort: 'S', confidence: 1.0 };
      },

      'image-alt': () => {
        const before = rawHtml || '<img src="...">';
        const src = getAttr(before, 'src') || '';
        const filename = src.split('/').pop()?.split('?')[0] || '';
        const alt = filename ? humanise(filename) : 'Descriptive text about this image';
        const after = setAttr(before, 'alt', alt);
        return { fixTitle: 'Add alt text to image', before, after, explanation: `Add descriptive alt text to this image. "${alt}" was derived from the filename — review and improve it.`, effort: 'S', confidence: 0.85 };
      },

      'input-image-alt': () => {
        const before = rawHtml || '<input type="image">';
        return { fixTitle: 'Add alt to image input', before, after: setAttr(before, 'alt', 'Submit'), explanation: 'Image inputs need alt text describing their function (e.g., "Submit", "Search").', effort: 'S', confidence: 0.9 };
      },

      'button-name': () => {
        const before = rawHtml || '<button></button>';
        const existingLabel = getAttr(before, 'aria-label');
        if (existingLabel !== null && !existingLabel.trim()) {
          return { fixTitle: 'Fix empty aria-label on button', before, after: setAttr(before, 'aria-label', 'Describe this action'), explanation: 'The aria-label is empty — fill in a concise description of what this button does.', effort: 'S', confidence: 0.85 };
        }
        const innerMatch = before.match(/>([^<]*)</);
        const hasText = innerMatch && innerMatch[1].trim();
        if (!hasText) {
          return { fixTitle: 'Add accessible name to button', before, after: setAttr(before, 'aria-label', 'Describe this action'), explanation: 'This button has no visible text or label. Add aria-label to describe its purpose for screen readers.', effort: 'S', confidence: 0.9 };
        }
        return null; // complex case → LLM
      },

      'link-name': () => {
        const before = rawHtml || '<a href=""></a>';
        const href = getAttr(before, 'href') || '';
        const innerMatch = before.match(/>([^<]*)</);
        const hasText = innerMatch && innerMatch[1].trim();
        if (!hasText) {
          let linkText = 'Descriptive link text';
          if (href && href !== '#' && href !== 'javascript:void(0)') {
            const last = href.split('/').filter(Boolean).pop()?.split('?')[0];
            if (last) linkText = humanise(last);
          }
          // Insert text inside the link AND add aria-label as backup
          const after = setAttr(before.replace(/>(\s*)<\/a>/i, `>${linkText}</a>`), 'aria-label', linkText);
          return { fixTitle: 'Add accessible name to link', before, after, explanation: `This link has no text. "${linkText}" was derived from the URL — review and make it descriptive.`, effort: 'S', confidence: 0.8 };
        }
        return null; // has text but still flagged → LLM
      },

      'label': () => {
        const before = rawHtml || '<input>';
        const id = getAttr(before, 'id');
        const type = getAttr(before, 'type') || 'text';
        const name = getAttr(before, 'name') || type;
        const labelText = humanise(name);
        if (id) {
          return { fixTitle: 'Add label to form input', before, after: `<label for="${id}">${labelText}</label>\n${before}`, explanation: `Add a <label> linked to this input's id="${id}". "${labelText}" is derived from the field name — adjust to match your UI.`, effort: 'S', confidence: 0.9 };
        }
        const genId = `field-${name.replace(/\s+/g, '-').toLowerCase()}`;
        const withId = setAttr(before, 'id', genId);
        return { fixTitle: 'Add label to form input', before, after: `<label for="${genId}">${labelText}</label>\n${withId}`, explanation: `This input has no id or label. Added id="${genId}" and a matching <label>.`, effort: 'S', confidence: 0.85 };
      },

      'select-name': () => {
        const before = rawHtml || '<select></select>';
        const id = getAttr(before, 'id') || 'select-field';
        const name = getAttr(before, 'name') || 'option';
        const labelText = humanise(name);
        return { fixTitle: 'Add label to select', before, after: `<label for="${id}">${labelText}</label>\n${setAttr(before, 'id', id)}`, explanation: `Select elements need an associated <label> for screen readers.`, effort: 'S', confidence: 0.9 };
      },

      'color-contrast': () => {
        // Color contrast can't be reliably fixed from HTML alone — needs computed styles
        return { fixTitle: 'Fix color contrast', before: rawHtml || '(element with low contrast)', after: '/* Increase text/background contrast to at least 4.5:1 (normal text) or 3:1 (large text). Use a contrast checker like https://webaim.org/resources/contrastchecker/ */', explanation: `This element's text doesn't have enough contrast against its background. Adjust foreground or background colors to meet WCAG AA ratios.`, effort: 'M', confidence: 0.5 };
      },

      'document-title': () => ({
        fixTitle: 'Add page title', before: '<head>...</head>', after: '<head>\n  <title>Your Page Title — Site Name</title>\n</head>', explanation: 'Every page needs a unique, descriptive <title> for browser tabs and screen readers.', effort: 'S', confidence: 1.0
      }),

      'bypass': () => ({
        fixTitle: 'Add skip navigation link',
        before: '<body>\n  <nav>...</nav>',
        after: '<body>\n  <a href="#main-content" class="skip-link">Skip to main content</a>\n  <nav>...</nav>\n  <main id="main-content">...</main>\n\n<style>\n.skip-link { position: absolute; left: -9999px; z-index: 999; padding: 8px 16px; background: #000; color: #fff; }\n.skip-link:focus { left: auto; top: 0; }\n</style>',
        explanation: 'Add a skip link so keyboard users can jump past navigation to the main content.', effort: 'M', confidence: 0.9
      }),

      'meta-viewport': () => {
        const before = rawHtml || '<meta name="viewport">';
        return { fixTitle: 'Fix viewport meta tag', before, after: '<meta name="viewport" content="width=device-width, initial-scale=1">', explanation: 'Remove user-scalable=no and maximum-scale restrictions — users with low vision need to pinch-to-zoom.', effort: 'S', confidence: 1.0 };
      },

      'landmark-one-main': () => {
        const tag = getTag(rawHtml);
        if (rawHtml && tag && tag !== 'main') {
          const before = rawHtml;
          const after = before.replace(new RegExp(`^<${tag}`, 'i'), '<main').replace(new RegExp(`</${tag}>\\s*$`, 'i'), '</main>');
          return { fixTitle: 'Use <main> landmark', before, after, explanation: `Change this <${tag}> to <main> to define the primary content region for screen reader navigation.`, effort: 'S', confidence: 0.85 };
        }
        return { fixTitle: 'Add main landmark', before: rawHtml || '<div class="content">...</div>', after: '<main class="content">...</main>', explanation: 'Wrap primary page content in a <main> element so assistive technology can jump to it.', effort: 'S', confidence: 0.8 };
      },

      'region': () => {
        const tag = getTag(rawHtml);
        const before = rawHtml || '<div>...</div>';
        if (tag === 'div') {
          const cls = getAttr(before, 'class') || 'content';
          const label = humanise(cls.split(/\s+/)[0]);
          const after = setAttr(before.replace(/^<div/i, '<section').replace(/<\/div>\s*$/i, '</section>'), 'aria-label', label);
          return { fixTitle: 'Wrap in landmark region', before, after, explanation: `Convert this <div> to <section aria-label="${label}"> so screen readers can navigate by region.`, effort: 'S', confidence: 0.75 };
        }
        return { fixTitle: 'Add landmark region', before, after: setAttr(before, 'role', 'region'), explanation: 'Add role="region" with an aria-label so screen readers can identify this section.', effort: 'S', confidence: 0.7 };
      },

      'list': () => ({
        fixTitle: 'Use proper list markup', before: rawHtml || '<div>...</div>', after: '<ul>\n  <li><!-- item content --></li>\n</ul>', explanation: 'Replace non-semantic markup with <ul>/<ol> and <li> so screen readers announce list structure and item count.', effort: 'M', confidence: 0.7
      }),

      'listitem': () => ({
        fixTitle: 'Fix list item parent', before: rawHtml || '<li>...</li>', after: '<ul>\n  ' + (rawHtml || '<li>...</li>') + '\n</ul>', explanation: 'This <li> is not inside a <ul>, <ol>, or <menu>. Wrap it in the correct list container.', effort: 'S', confidence: 0.9
      }),

      'heading-order': () => {
        const tag = getTag(rawHtml);
        const level = tag ? parseInt(tag[1]) : null;
        if (level && level > 1) {
          const fixed = `h${level - 1}`;
          const before = rawHtml;
          const after = before.replace(new RegExp(`^<${tag}`, 'i'), `<${fixed}`).replace(new RegExp(`</${tag}>\\s*$`, 'i'), `</${fixed}>`);
          return { fixTitle: 'Fix heading hierarchy', before, after, explanation: `This <${tag}> skips a heading level. Change it to <${fixed}> so the hierarchy goes h1→h2→h3 sequentially.`, effort: 'S', confidence: 0.8 };
        }
        return null; // can't determine → LLM
      },

      'aria-roles': () => {
        const before = rawHtml || '<div role="">';
        const role = getAttr(before, 'role') || '';
        return { fixTitle: 'Fix invalid ARIA role', before, after: setAttr(before, 'role', 'region'), explanation: `The role "${role}" is not valid. Replace with a valid WAI-ARIA role (e.g., region, button, navigation).`, effort: 'S', confidence: 0.75 };
      },

      'aria-required-attr': () => {
        const before = rawHtml || '<div>';
        const role = getAttr(before, 'role') || '';
        const requiredMap = {
          'checkbox': 'aria-checked="false"', 'radio': 'aria-checked="false"',
          'combobox': 'aria-expanded="false"', 'switch': 'aria-checked="false"',
          'slider': 'aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"',
          'progressbar': 'aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"',
          'scrollbar': 'aria-controls="target-id" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"',
          'tab': 'aria-selected="false"', 'treeitem': 'aria-selected="false"',
          'separator': 'aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"',
          'heading': 'aria-level="2"',
        };
        const attrs = requiredMap[role] || 'aria-label="description"';
        const after = before.replace(/>/, ` ${attrs}>`);
        return { fixTitle: 'Add required ARIA attributes', before, after, explanation: `Elements with role="${role}" require specific ARIA attributes to work with assistive technology.`, effort: 'S', confidence: 0.9 };
      },

      'aria-valid-attr': () => {
        const before = rawHtml || '<div>';
        const validAria = new Set(['aria-activedescendant','aria-atomic','aria-autocomplete','aria-busy','aria-checked','aria-colcount','aria-colindex','aria-colspan','aria-controls','aria-current','aria-describedby','aria-details','aria-disabled','aria-dropeffect','aria-errormessage','aria-expanded','aria-flowto','aria-grabbed','aria-haspopup','aria-hidden','aria-invalid','aria-keyshortcuts','aria-label','aria-labelledby','aria-level','aria-live','aria-modal','aria-multiline','aria-multiselectable','aria-orientation','aria-owns','aria-placeholder','aria-posinset','aria-pressed','aria-readonly','aria-relevant','aria-required','aria-roledescription','aria-rowcount','aria-rowindex','aria-rowspan','aria-selected','aria-setsize','aria-sort','aria-valuemax','aria-valuemin','aria-valuenow','aria-valuetext']);
        let after = before;
        const found = [...before.matchAll(/\s(aria-[\w-]+)\s*=/gi)].map(m => m[1].toLowerCase());
        const invalid = found.filter(a => !validAria.has(a));
        if (invalid.length) {
          for (const attr of invalid) after = removeAttr(after, attr);
          return { fixTitle: 'Remove invalid ARIA attributes', before, after, explanation: `Removed invalid attribute${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}. Only spec-defined aria-* attributes are allowed.`, effort: 'S', confidence: 0.95 };
        }
        return null; // no invalid attrs found from HTML alone → LLM
      },

      'aria-valid-attr-value': () => {
        const before = rawHtml || '<div>';
        let after = before;
        after = after.replace(/aria-(hidden|checked|disabled|expanded|pressed|selected|required|readonly|modal|busy|atomic|multiselectable)\s*=\s*["'](yes|no|Yes|No|YES|NO)["']/gi,
          (_, attr, val) => `aria-${attr}="${val.toLowerCase().startsWith('y') ? 'true' : 'false'}"`);
        if (after !== before) {
          return { fixTitle: 'Fix ARIA attribute values', before, after, explanation: 'ARIA boolean attributes require "true"/"false" — not "yes"/"no".', effort: 'S', confidence: 0.95 };
        }
        return null; // can't auto-fix from HTML → LLM
      },

      'tabindex': () => {
        const before = rawHtml || '<div tabindex="5">';
        const val = parseInt(getAttr(before, 'tabindex'));
        if (val > 0) {
          return { fixTitle: 'Fix tabindex value', before, after: setAttr(before, 'tabindex', '0'), explanation: `tabindex="${val}" creates unpredictable tab order. Use 0 (natural order) or -1 (programmatic only).`, effort: 'S', confidence: 0.95 };
        }
        return null;
      },

      'frame-title': () => {
        const before = rawHtml || '<iframe src=""></iframe>';
        const src = getAttr(before, 'src') || '';
        let title = 'Embedded content';
        if (src) {
          try { title = humanise(new URL(src, 'https://x.com').hostname.replace('www.', '')) + ' content'; } catch { /* fallback */ }
        }
        return { fixTitle: 'Add iframe title', before, after: setAttr(before, 'title', title), explanation: `Add a title describing this iframe's content for screen reader users. "${title}" is derived from the URL.`, effort: 'S', confidence: 0.9 };
      },

      'td-headers-attr': () => ({
        fixTitle: 'Fix table header association', before: rawHtml || '<td>', after: '<!-- Ensure <td headers="..."> references valid <th id="..."> IDs in the same table -->\n' + (rawHtml || '<td>'), explanation: 'The headers attribute must point to valid <th> element IDs in the same table.', effort: 'M', confidence: 0.6
      }),

      'scope-attr-valid': () => {
        const before = rawHtml || '<th>';
        return { fixTitle: 'Fix scope attribute', before, after: setAttr(before, 'scope', 'col'), explanation: 'Use a valid scope value: "col", "row", "colgroup", or "rowgroup".', effort: 'S', confidence: 0.9 };
      },
    };

    // ── Execute ──

    const handler = rules[ruleId];
    if (handler) {
      const result = handler();
      if (result) {
        return { ...result, source: 'deterministic', private: true, wcagResolved: issue.wcag || [], issueId: ruleId };
      }
    }

    // Unknown rule or handler returned null → low confidence, will fall through to LLM
    return {
      fixTitle: `Suggestion: ${issue.title || issue.id || 'accessibility issue'}`,
      before: rawHtml || '',
      after: '',
      explanation: issue.description || `Review and fix this ${issue.severity || ''} accessibility issue.`,
      effort: 'M',
      confidence: 0.3,
      source: 'deterministic',
      private: true,
      helpUrl: issue.helpUrl || '',
      wcagResolved: issue.wcag || [],
      issueId: issue.id
    };
  }

  _buildFixPrompt(issue, pageUrl) {
    return `Given this accessibility issue, generate a minimal working code fix.

ISSUE:
- Rule: ${issue.id || 'unknown'}
- Title: ${issue.title || ''}
- Severity: ${issue.severity || ''}
- WCAG: ${JSON.stringify(issue.wcag || [])}
- Selectors: ${JSON.stringify(issue.selectors || [])}
- HTML: ${(issue.html || []).slice(0, 2).join('\n')}
- Description: ${issue.description || ''}
${pageUrl ? `- Page: ${pageUrl}` : ''}

Respond with ONLY a JSON object:
{
  "fixTitle": "short title",
  "before": "problematic code",
  "after": "fixed code",
  "explanation": "1-2 sentences",
  "effort": "S|M|L",
  "confidence": 0.0-1.0
}`;
  }

  _parseFixResponse(text) {
    if (!text) return null;
    let cleaned = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch (e2) { /* fall through */ }
      }
      return null;
    }
  }
}
