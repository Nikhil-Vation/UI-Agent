/**
 * LLM Router — Cascading fallback for AI-powered fixes
 * 
 * Priority:
 *   1. window.ai (Chrome built-in Gemini Nano) — free, private, fast
 *   2. localhost orchestrator (Ollama) — powerful, private
 *   3. Cloud API — always works, redacted data only
 *   4. Deterministic — no LLM, rule-based suggestions only
 */

export class LLMRouter {
  constructor() {
    this._capabilities = null;
  }

  /**
   * Detect which LLM backends are available
   */
  async detectCapabilities() {
    const caps = { windowAI: false, localhost: false, cloud: false };

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

    // 2. Check localhost orchestrator
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

    // 3. Cloud is always "available" if user opted in (checked at call time)
    caps.cloud = true;

    this._capabilities = caps;
    return caps;
  }

  /**
   * Generate a fix using the best available backend
   */
  async generateFix(issue, pageUrl, config = {}) {
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

    // 2. Try localhost orchestrator
    if (this._capabilities.localhost) {
      try {
        const serverUrl = config.localServerUrl || 'http://localhost:3000';
        const result = await this._fixWithLocalhost(issue, pageUrl, serverUrl);
        if (result) return { ...result, source: 'localhost', private: true };
      } catch (e) {
        console.warn('localhost failed:', e.message);
      }
    }

    // 3. Try cloud API (only if user opted in)
    if (config.cloudOptIn && !config.privacyMode) {
      try {
        const result = await this._fixWithCloud(issue, pageUrl);
        if (result) return { ...result, source: 'cloud', private: false };
      } catch (e) {
        console.warn('cloud failed:', e.message);
      }
    }

    // 4. Deterministic fallback (no LLM)
    return this._deterministicFix(issue);
  }

  /**
   * Use Chrome's built-in AI (Gemini Nano)
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
   * Use localhost orchestrator (/fix endpoint)
   */
  async _fixWithLocalhost(issue, pageUrl, serverUrl) {
    const r = await fetch(`${serverUrl}/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue, url: pageUrl }),
      signal: AbortSignal.timeout(120000)
    });

    if (!r.ok) throw new Error(`Server returned ${r.status}`);
    const data = await r.json();
    return data.fix || null;
  }

  /**
   * Use cloud API (redacted data)
   */
  async _fixWithCloud(issue, pageUrl) {
    const CLOUD_URL = 'https://api.vation-agent.com/fix';
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
   * Deterministic fallback — rule-based fix suggestions (no LLM)
   */
  _deterministicFix(issue) {
    const fixes = {
      'html-has-lang': { fixTitle: 'Add lang attribute', before: '<html>', after: '<html lang="en">', explanation: 'Add the lang attribute to help screen readers identify the page language.', effort: 'S', confidence: 1.0 },
      'image-alt': { fixTitle: 'Add alt text to image', before: '<img src="...">', after: '<img src="..." alt="Descriptive text">', explanation: 'Add descriptive alt text so screen readers can convey the image content.', effort: 'S', confidence: 0.9 },
      'label': { fixTitle: 'Add label to form input', before: '<input type="text">', after: '<label for="field">Label</label>\n<input type="text" id="field">', explanation: 'Associate a label with the input so screen readers announce what the field is for.', effort: 'S', confidence: 0.9 },
      'button-name': { fixTitle: 'Add accessible name to button', before: '<button></button>', after: '<button aria-label="Action description">Action</button>', explanation: 'Buttons need visible text or aria-label for screen readers.', effort: 'S', confidence: 0.9 },
      'link-name': { fixTitle: 'Add accessible name to link', before: '<a href="..."></a>', after: '<a href="...">Descriptive link text</a>', explanation: 'Links need descriptive text so users know where the link goes.', effort: 'S', confidence: 0.9 },
      'color-contrast': { fixTitle: 'Fix color contrast', before: 'color: #aaa; background: #fff;', after: 'color: #595959; background: #fff; /* ratio >= 4.5:1 */', explanation: 'Increase contrast ratio to at least 4.5:1 for normal text (WCAG AA).', effort: 'M', confidence: 0.7 },
      'document-title': { fixTitle: 'Add page title', before: '<head>...</head>', after: '<head>\n  <title>Page Title</title>\n</head>', explanation: 'Every page needs a descriptive title for browser tabs and screen readers.', effort: 'S', confidence: 1.0 },
      'bypass': { fixTitle: 'Add skip navigation link', before: '<body>\n  <nav>...</nav>', after: '<body>\n  <a href="#main" class="skip-link">Skip to main content</a>\n  <nav>...</nav>\n  <main id="main">', explanation: 'Add a skip link so keyboard users can bypass repetitive navigation.', effort: 'M', confidence: 0.9 },
      'meta-viewport': { fixTitle: 'Fix viewport meta tag', before: '<meta name="viewport" content="...user-scalable=no...">', after: '<meta name="viewport" content="width=device-width, initial-scale=1">', explanation: 'Do not disable pinch-to-zoom — users with low vision need to zoom.', effort: 'S', confidence: 1.0 },
    };

    const ruleId = issue.id || '';
    const known = fixes[ruleId];

    if (known) {
      return { ...known, source: 'deterministic', private: true, wcagResolved: issue.wcag || [], issueId: ruleId };
    }

    return {
      fixTitle: `Fix: ${issue.title || issue.id || 'accessibility issue'}`,
      before: issue.html?.[0] || '',
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
