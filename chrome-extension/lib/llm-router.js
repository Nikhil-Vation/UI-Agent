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

import { DOM_TOOLS, SUBMIT_TOOL_NAME, buildSubmitTool } from './dom-tools.js';
import { estimateCallCost } from './cost-meter.js';

/* ═══════════════════════════════════════════
   Color helpers — used to fix contrast with the page's own palette
   ═══════════════════════════════════════════ */

function hexToRgb(hex) {
  if (!hex) return null;
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16)
  };
}

/** WCAG relative luminance */
function relativeLuminance({ r, g, b }) {
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1–21) */
function contrastRatio(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 0;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick an accessible foreground/background pair from the page's own brand palette.
 *
 * Among all passing pairs we deliberately choose the one with the LOWEST passing
 * ratio — it clears the threshold while staying as close as possible to the
 * original design intent. Maximum contrast would always collapse to black on
 * white, which is exactly the fix designers reject.
 *
 * Falls back to black on white only when no pair in the palette can reach the target.
 */
function pickAccessiblePair(designInfo, target = 4.5) {
  const palette = [...new Set(
    (designInfo?.colors || [])
      .map(c => (typeof c === 'string' ? c : c?.hex))
      .filter(hex => hexToRgb(hex))
      .map(hex => String(hex).toLowerCase())
  )];

  let best = null;
  for (const bg of palette) {
    for (const fg of palette) {
      if (fg === bg) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio >= target && (!best || ratio < best.ratio)) {
        best = { fg, bg, ratio };
      }
    }
  }

  if (best) return { ...best, fromBrand: true };
  return {
    fg: '#000000',
    bg: '#ffffff',
    ratio: contrastRatio('#000000', '#ffffff'),
    fromBrand: false
  };
}

/* ═══════════════════════════════════════════
   Response schemas — every provider is forced to return this shape
   ═══════════════════════════════════════════ */

const FIX_PROPERTIES = {
  fixTitle:    { type: 'string',  description: 'Short title for the fix' },
  before:      { type: 'string',  description: 'The problematic code' },
  after:       { type: 'string',  description: 'The corrected code' },
  explanation: { type: 'string',  description: 'One or two sentences on why this fixes it' },
  effort:      { type: 'string',  enum: ['S', 'M', 'L'] },
  confidence:  { type: 'number',  description: 'Confidence from 0.0 to 1.0' }
};

const FIX_SCHEMA = {
  type: 'object',
  properties: FIX_PROPERTIES,
  required: Object.keys(FIX_PROPERTIES)
};

/**
 * Full-page analysis.
 *
 * `fixes` is an ARRAY here, not an object keyed by rule ID. Dynamic keys cannot be
 * expressed in the strict-schema dialects OpenAI and Gemini accept, so the wire
 * format carries `ruleId` on each entry and `_normalizeFullAnalysis` folds it back
 * into the keyed object the rest of the extension expects.
 */
const FULL_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary:  { type: 'string', description: 'Two or three sentences on the page state' },
    priority: { type: 'array', items: { type: 'string' }, description: 'Rule IDs, most urgent first' },
    actionPlan: {
      type: 'object',
      properties: {
        immediate: { type: 'array', items: { type: 'string' } },
        shortTerm: { type: 'array', items: { type: 'string' } },
        longTerm:  { type: 'array', items: { type: 'string' } }
      },
      required: ['immediate', 'shortTerm', 'longTerm']
    },
    fixes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ruleId: { type: 'string' }, ...FIX_PROPERTIES },
        required: ['ruleId', ...Object.keys(FIX_PROPERTIES)]
      }
    }
  },
  required: ['summary', 'priority', 'actionPlan', 'fixes']
};

/**
 * OpenAI and Mistral strict mode require `additionalProperties: false` on every
 * object node. Gemini rejects that keyword outright, so schemas are adapted per
 * provider from the one canonical definition above.
 */
function toStrictSchema(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'object') {
    const props = {};
    for (const [k, v] of Object.entries(node.properties || {})) props[k] = toStrictSchema(v);
    return { ...node, properties: props, additionalProperties: false };
  }
  if (node.type === 'array') return { ...node, items: toStrictSchema(node.items) };
  return node;
}

/** Gemini accepts an OpenAPI subset — drop anything outside it. */
function toGeminiSchema(node) {
  if (!node || typeof node !== 'object') return node;
  const out = {};
  if (node.type) out.type = node.type;
  if (node.enum) out.enum = node.enum;
  if (node.description) out.description = node.description;
  if (node.type === 'object') {
    out.properties = {};
    for (const [k, v] of Object.entries(node.properties || {})) out.properties[k] = toGeminiSchema(v);
    if (node.required) out.required = node.required;
  }
  if (node.type === 'array') out.items = toGeminiSchema(node.items);
  return out;
}

/**
 * Extract the first complete JSON object from text.
 *
 * Replaces the previous greedy `/\{[\s\S]*\}/` match, which spanned from the first
 * brace to the LAST one anywhere in the response and therefore broke whenever a
 * model added trailing prose containing a closing brace. This walks the string
 * tracking depth, and ignores braces inside string literals and escapes.
 *
 * Only used for backends that cannot enforce a schema (on-device, local server).
 */
function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Strip markdown code fences a model may have wrapped the JSON in. */
function stripCodeFence(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

/**
 * Fold the schema's `fixes` array back into the rule-ID-keyed object the rest of
 * the extension consumes. Accepts the legacy keyed-object shape unchanged, since
 * the local orchestrator still returns it.
 */
function normalizeFullAnalysis(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.fixes) return null;

  if (Array.isArray(parsed.fixes)) {
    const keyed = {};
    for (const fix of parsed.fixes) {
      if (!fix || !fix.ruleId) continue;
      const { ruleId, ...rest } = fix;
      keyed[ruleId] = rest;
    }
    return { ...parsed, fixes: keyed };
  }

  return typeof parsed.fixes === 'object' ? parsed : null;
}

/* ═══════════════════════════════════════════
   Autonomy policy (2.4)
   ═══════════════════════════════════════════ */

/**
 * How far a fix may be trusted without a human looking at it.
 *
 * Deliberately conservative. The cost of a wrong auto-applied fix is not one bad
 * element — it is the user no longer trusting any of them.
 */
export function autonomyFor(fix) {
  const c = typeof fix?.confidence === 'number' ? fix.confidence : 0;
  if (c >= 0.9) return 'auto';      // apply without asking
  if (c >= 0.7) return 'flag';      // apply, but mark it for review
  return 'propose';                 // show it; do not touch the page
}

/* ═══════════════════════════════════════════
   Fix cache (2.5)
   ═══════════════════════════════════════════ */

const FIX_CACHE_TTL = 30 * 60 * 1000;   // 30 min, mirroring the Lighthouse cache

/**
 * Signature of an element for caching purposes: shape only, no content.
 *
 * A design system renders the same broken button forty times. They differ by id,
 * text and data attributes but are one problem with one fix, so those are
 * stripped and only tag + classes + role remain.
 */
export function elementSignature(html) {
  const raw = String(html || '').trim();
  if (!raw) return 'none';

  const tag = (raw.match(/^<(\w+)/) || [])[1]?.toLowerCase() || 'unknown';
  const cls = (raw.match(/\bclass\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
  const role = (raw.match(/\brole\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
  const type = (raw.match(/\btype\s*=\s*["']([^"']*)["']/i) || [])[1] || '';

  const classes = cls.split(/\s+/).filter(Boolean).sort().slice(0, 4).join('.');
  return [tag, classes, role, type].join('|');
}

export class LLMRouter {
  constructor() {
    this._capabilities = null;
    this._fixCache = new Map();   // signature → { fix, at }
    this._onUsage = null;         // optional (provider, costUSD) callback — see setUsageRecorder
  }

  /**
   * 6.4 — inject a callback fired after every successful network call to a
   * provider, with an estimated USD cost. A callback rather than a hard
   * dependency: this module has no opinion on where usage gets persisted, and
   * a router used outside the extension (tests, the local orchestrator) should
   * not require storage wiring just to generate a fix.
   */
  setUsageRecorder(fn) {
    this._onUsage = typeof fn === 'function' ? fn : null;
  }

  _recordUsage(provider, promptChars, resultChars) {
    if (!this._onUsage) return;
    try {
      this._onUsage(provider, estimateCallCost(provider, promptChars, resultChars));
    } catch { /* usage tracking must never break a fix */ }
  }

  /* ── Fix cache ── */

  _cacheKey(issue) {
    return `${issue?.id || 'unknown'}::${elementSignature((issue?.html || [])[0])}`;
  }

  _cacheGet(issue) {
    const entry = this._fixCache.get(this._cacheKey(issue));
    if (!entry) return null;
    if (Date.now() - entry.at > FIX_CACHE_TTL) {
      this._fixCache.delete(this._cacheKey(issue));
      return null;
    }
    return entry.fix;
  }

  _cacheSet(issue, fix) {
    if (!fix || !fix.after) return;
    this._fixCache.set(this._cacheKey(issue), { fix, at: Date.now() });
  }

  /**
   * Backend order for this issue (2.6).
   *
   * The deterministic engine's confidence is a free difficulty signal: a rule it
   * nearly solved is a small problem, one it could not touch at all needs the
   * strongest model and the page tools. Sending both to the same backend wastes
   * capability on one and starves the other.
   */
  _backendOrder(difficulty, caps, cloudAllowed) {
    const order = [];
    const cloud = cloudAllowed && caps.gemini;

    if (difficulty >= 0.4) {
      // Nearly solved — on-device is enough and costs nothing.
      if (caps.windowAI) order.push('windowAI');
      if (cloud) order.push('cloud');
    } else {
      // Genuinely hard — lead with the strong model, which also has the tools.
      if (cloud) order.push('cloud');
      if (caps.windowAI) order.push('windowAI');
    }
    if (caps.localhost) order.push('localhost');
    return order;
  }

  /**
   * Whether this request is allowed to reach a third-party LLM host.
   *
   * Privacy mode is the master switch and defaults to ON, so a saved API key is
   * NOT on its own sufficient consent to send page content off the machine.
   */
  _cloudAllowed(config = {}) {
    return config.privacyMode === false;
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

    // 2. Check configured LLM provider API key
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['geminiApiKey', 'llmApiKey', 'llmProvider']);
        const key = result.llmApiKey || result.geminiApiKey || '';
        caps.gemini = !!(key && key.trim());   // reuse cap name — means "cloud LLM available"
        caps.llmProvider = result.llmProvider || (key ? 'gemini' : 'none');
        caps.llmApiKey   = key;
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
    // Previous attempts at this same issue that were applied, re-scanned, and
    // found NOT to have cleared the violation.
    const attempts = Array.isArray(config.attempts) ? config.attempts : [];

    // 0. Try deterministic fix FIRST — instant for known rules (no LLM needed).
    //
    // Skipped once an attempt has already failed: the deterministic handler is a
    // pure function of the issue, so it would return the identical fix that just
    // failed verification and the retry loop would spin forever. A failed attempt
    // is precisely the signal that this case needs judgement, not a rule.
    const deterministicResult = this._deterministicFix(issue, config.designInfo);
    if (!attempts.length && deterministicResult.confidence >= 0.7) {
      return deterministicResult;
    }

    // Deterministic-only: caller wants the rule engine's answer and nothing else.
    //
    // Used after a batch analysis, where fixes for every issue already came back
    // in one call and the per-issue pass exists only to recover the `_patchHint`
    // metadata that the rule engine attaches. Without this flag that pass would
    // fall through to a model on every issue whose deterministic confidence is
    // below 0.7 — turning "one call for forty issues" back into forty calls.
    if (config.deterministicOnly) return deterministicResult;

    // A cached fix for this element shape — the same broken component repeated
    // across a page is one problem, not forty. Skipped on a retry: the cache
    // would hand back the very answer that just failed verification.
    if (!attempts.length) {
      const cached = this._cacheGet(issue);
      if (cached) return { ...cached, source: `${cached.source || 'llm'} (cached)`, cached: true };
    }

    const cloudAllowed = this._cloudAllowed(config);

    if (!this._capabilities) {
      await this.detectCapabilities();
    }

    const prompt = this._buildFixPrompt(issue, pageUrl, attempts);
    const apiKey   = config.llmApiKey || config.geminiApiKey;
    const provider = config.llmProvider || (apiKey ? 'gemini' : 'none');
    const model    = config.llmModel || '';

    const backends = this._backendOrder(deterministicResult.confidence, this._capabilities, cloudAllowed);

    for (const backend of backends) {
      try {
        if (backend === 'windowAI') {
          const result = await this._fixWithWindowAI(prompt);
          if (result) {
            const out = { ...result, source: 'window.ai', private: true };
            this._cacheSet(issue, out);
            return out;
          }
        }

        if (backend === 'cloud' && apiKey && provider !== 'none') {
          const result = await this._fixWithProvider(
            issue, pageUrl, provider, model, apiKey, attempts, config.executeTool);
          if (result) {
            // A third-party host saw this payload — it is redacted, but not private.
            const out = { ...result, source: provider, private: false };
            this._cacheSet(issue, out);
            return out;
          }
        }

        if (backend === 'localhost') {
          const serverUrl = config.localServerUrl || 'http://localhost:3000';
          const result = await this._fixWithLocalhost(issue, pageUrl, serverUrl, attempts);
          if (result) {
            const out = { ...result, source: 'localhost', private: true };
            this._cacheSet(issue, out);
            return out;
          }
        }
      } catch (e) {
        console.warn(`[LLMRouter] ${backend} failed:`, e.message);
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

  /**
   * Full-page analysis — send ALL violations to Gemini in one prompt.
   * Returns { fixes: Map<ruleId, fix>, summary, priority, actionPlan }
   * This is the "true agent" mode: Gemini understands the whole page context,
   * decides priority, and generates all fixes in a single call.
   */
  async generateFullAnalysis(issues, pageUrl, designInfo, config = {}) {
    if (!this._capabilities) await this.detectCapabilities();

    // Build the full-page prompt
    const prompt = this._buildFullAnalysisPrompt(issues, pageUrl, designInfo);

    // Try configured cloud LLM provider first
    const apiKey   = config.llmApiKey || config.geminiApiKey;
    const provider = config.llmProvider || (apiKey ? 'gemini' : 'none');
    const model    = config.llmModel || '';
    if (this._cloudAllowed(config) && this._capabilities.gemini && apiKey && provider !== 'none') {
      try {
        const result = await this._fullAnalysisWithProvider(prompt, provider, model, apiKey);
        if (result) return { ...result, source: provider, private: false };
      } catch (e) {
        console.warn(`[LLMRouter] Full analysis via ${provider} failed:`, e.message);
      }
    }

    // Try window.ai
    if (this._capabilities.windowAI) {
      try {
        const session = await self.ai.languageModel.create({
          systemPrompt: 'You are an expert accessibility engineer. Respond with valid JSON only.'
        });
        const response = await this._promptWindowAI(session, prompt, FULL_ANALYSIS_SCHEMA);
        session.destroy();
        const result = this._parseFullAnalysisResponse(response);
        if (result) return { ...result, source: 'window.ai', private: true };
      } catch (e) {
        console.warn('[LLMRouter] Full analysis via window.ai failed:', e.message);
      }
    }

    // Try localhost
    if (this._capabilities.localhost) {
      try {
        const serverUrl = config.localServerUrl || 'http://localhost:3000';
        const r = await fetch(`${serverUrl}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issues, url: pageUrl, designInfo }),
          signal: AbortSignal.timeout(60000)
        });
        if (r.ok) {
          const data = await r.json();
          const normalized = normalizeFullAnalysis(data.result);
          if (normalized) return { ...normalized, source: 'localhost', private: true };
        }
      } catch (e) {
        console.warn('[LLMRouter] Full analysis via localhost failed:', e.message);
      }
    }

    return null; // caller falls back to per-issue deterministic
  }

  /**
   * Build the full-page analysis prompt.
   * Gives Gemini the WHOLE picture: all violations, severity, selectors, HTML,
   * tech stack, and asks for a structured JSON response with fixes for everything.
   */
  _buildFullAnalysisPrompt(issues, pageUrl, designInfo) {
    const tech = designInfo?.tech?.map(t => t.name).join(', ') || 'unknown';
    const colors = designInfo?.colors?.slice(0, 4).map(c => c.hex).join(', ') || '';

    const issueList = issues.map((issue, i) => {
      const selectors = (issue.selectors || []).slice(0, 3).join(', ');
      const html = (issue.html || []).slice(0, 2).join(' | ');
      return `${i + 1}. [${issue.severity?.toUpperCase()}] ${issue.id} — ${issue.title}
   Selectors: ${selectors || 'page-level'}
   HTML: ${html || 'n/a'}
   WCAG: ${(issue.wcag || []).join(', ') || 'n/a'}`;
    }).join('\n\n');

    return `You are an expert accessibility engineer performing a full WCAG audit.

PAGE: ${pageUrl || 'unknown'}
TECH STACK: ${tech}
${colors ? `BRAND COLORS: ${colors}` : ''}
TOTAL VIOLATIONS: ${issues.length}

VIOLATIONS:
${issueList}

For EACH violation above, provide a precise code fix using the actual HTML snippets provided.
Also provide an overall analysis.

Respond with ONLY this JSON structure (no markdown, no explanation outside JSON).
Note that "fixes" is an ARRAY and each entry carries its own "ruleId":
{
  "summary": "2-3 sentence plain-English summary of the page's accessibility state",
  "priority": ["ruleId1", "ruleId2"],
  "actionPlan": {
    "immediate": ["fix X because critical"],
    "shortTerm": ["fix Y"],
    "longTerm": ["improve Z"]
  },
  "fixes": [
    {
      "ruleId": "the axe rule id this fix addresses",
      "fixTitle": "short title",
      "before": "problematic HTML",
      "after": "fixed HTML",
      "explanation": "why this fixes it",
      "effort": "S|M|L",
      "confidence": 0.0
    }
  ]
}`;
  }

  /**
   * Call Gemini with the full-page prompt.
   */
  async _fullAnalysisWithProvider(prompt, provider, model, apiKey) {
    const parsed = await this._callProvider(provider, model, apiKey, prompt, {
      temperature: 0.4,
      maxTokens: 8192,
      schema: FULL_ANALYSIS_SCHEMA,
      schemaName: 'accessibility_page_analysis'
    });
    return normalizeFullAnalysis(parsed);
  }

  /**
   * Unified provider caller with native structured output.
   *
   * Every provider is given the schema in its own dialect, so the response is
   * valid JSON of the right shape by construction rather than by parsing hope:
   *   - Gemini    → responseMimeType + responseSchema
   *   - OpenAI    → response_format: json_schema (strict)
   *   - Anthropic → forced tool use (no response_format on this API)
   *   - Mistral   → response_format: json_schema
   *
   * Returns a parsed object. Throws if the provider returned nothing usable.
   */
  async _callProvider(provider, model, apiKey, promptText, opts = {}) {
    const temp      = opts.temperature ?? 0.7;
    const maxTokens = opts.maxTokens   ?? 2048;
    const timeout   = opts.timeout     ?? 30000;
    const schema    = opts.schema     || FIX_SCHEMA;
    const name      = opts.schemaName || 'accessibility_fix';
    const system    = 'You are an expert accessibility engineer.';

    // Instrumenting `post` itself, rather than every branch's return point,
    // captures usage for every real network call in one place — including
    // every round of the multi-turn tool loop below, which is more accurate
    // than one estimate per top-level call.
    const post = async (url, body, headers) => {
      const bodyStr = JSON.stringify(body);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: bodyStr,
        signal: AbortSignal.timeout(timeout)
      });
      if (!r.ok) {
        const e = await r.text();
        throw new Error(`${provider} ${r.status}: ${e}`);
      }
      const json = await r.json();
      this._recordUsage(provider, bodyStr.length, JSON.stringify(json).length);
      return json;
    };

    if (provider === 'gemini') {
      const m = model || 'gemini-2.5-flash';
      const d = await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: promptText }] }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: {
            temperature: temp,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            responseSchema: toGeminiSchema(schema)
          }
        }
      );
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
      return this._parseStructured(text, provider);
    }

    if (provider === 'openai') {
      const m = model || 'gpt-4o-mini';
      const d = await post('https://api.openai.com/v1/chat/completions', {
        model: m,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: promptText }
        ],
        max_tokens: maxTokens,
        temperature: temp,
        response_format: {
          type: 'json_schema',
          json_schema: { name, strict: true, schema: toStrictSchema(schema) }
        }
      }, { 'Authorization': `Bearer ${apiKey}` });
      return this._parseStructured(d.choices?.[0]?.message?.content, provider);
    }

    if (provider === 'anthropic') {
      const m = model || 'claude-3-5-haiku-20241022';
      // The Messages API has no response_format — a forced tool call is the
      // supported way to guarantee schema-valid output.
      const d = await post('https://api.anthropic.com/v1/messages', {
        model: m,
        max_tokens: maxTokens,
        temperature: temp,
        system,
        messages: [{ role: 'user', content: promptText }],
        tools: [{ name, description: 'Return the result in this exact shape.', input_schema: schema }],
        tool_choice: { type: 'tool', name }
      }, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });

      const toolUse = (d.content || []).find(c => c.type === 'tool_use');
      if (toolUse?.input) return toolUse.input;   // already a parsed object
      return this._parseStructured((d.content || []).find(c => c.type === 'text')?.text, provider);
    }

    if (provider === 'mistral') {
      const m = model || 'mistral-small-latest';
      const d = await post('https://api.mistral.ai/v1/chat/completions', {
        model: m,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: promptText }
        ],
        max_tokens: maxTokens,
        temperature: temp,
        response_format: {
          type: 'json_schema',
          json_schema: { name, strict: true, schema: toStrictSchema(schema) }
        }
      }, { 'Authorization': `Bearer ${apiKey}` });
      return this._parseStructured(d.choices?.[0]?.message?.content, provider);
    }

    throw new Error(`Unknown provider: ${provider}`);
  }

  /**
   * Multi-turn tool loop: let the model inspect the page before answering.
   *
   * The final answer is itself a tool call (`submit_fix`), which keeps one
   * mechanism across all four providers — the model calls inspection tools until
   * it knows enough, then submits. Without that, each provider would need its own
   * "are we done yet" heuristic.
   *
   * `executeTool(name, args)` runs a tool against the real page and resolves to a
   * plain object. Returns the submitted fix, or null if the model never submitted
   * within `maxRounds`.
   */
  async _callProviderWithTools(provider, model, apiKey, prompt, opts = {}) {
    const { schema = FIX_SCHEMA, executeTool, maxRounds = 4, timeout = 45000 } = opts;
    const tools = [...DOM_TOOLS, buildSubmitTool(schema)];
    const system = 'You are an expert accessibility engineer. Inspect the page with the ' +
                   'provided tools when the markup alone is ambiguous, then call submit_fix.';

    const post = async (url, body, headers) => {
      const bodyStr = JSON.stringify(body);
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: bodyStr,
        signal: AbortSignal.timeout(timeout)
      });
      if (!r.ok) throw new Error(`${provider} ${r.status}: ${await r.text()}`);
      const json = await r.json();
      this._recordUsage(provider, bodyStr.length, JSON.stringify(json).length);
      return json;
    };

    /* ── Anthropic ── */
    if (provider === 'anthropic') {
      const messages = [{ role: 'user', content: prompt }];
      const defs = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));

      for (let round = 0; round < maxRounds; round++) {
        const d = await post('https://api.anthropic.com/v1/messages', {
          model: model || 'claude-3-5-haiku-20241022',
          max_tokens: 2048, system, messages, tools: defs
        }, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });

        const calls = (d.content || []).filter(c => c.type === 'tool_use');
        const submit = calls.find(c => c.name === SUBMIT_TOOL_NAME);
        if (submit) return submit.input;
        if (!calls.length) return this._parseStructured((d.content || []).find(c => c.type === 'text')?.text, provider);

        messages.push({ role: 'assistant', content: d.content });
        messages.push({
          role: 'user',
          content: await Promise.all(calls.map(async c => ({
            type: 'tool_result',
            tool_use_id: c.id,
            content: JSON.stringify(await executeTool(c.name, c.input || {}))
          })))
        });
      }
      return null;
    }

    /* ── OpenAI and Mistral share the chat-completions tool shape ── */
    if (provider === 'openai' || provider === 'mistral') {
      const url = provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.mistral.ai/v1/chat/completions';
      const defaultModel = provider === 'openai' ? 'gpt-4o-mini' : 'mistral-small-latest';
      const messages = [{ role: 'system', content: system }, { role: 'user', content: prompt }];
      const defs = tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: toStrictSchema(t.parameters) }
      }));

      for (let round = 0; round < maxRounds; round++) {
        const d = await post(url, {
          model: model || defaultModel, messages, tools: defs, tool_choice: 'auto', max_tokens: 2048
        }, { 'Authorization': `Bearer ${apiKey}` });

        const message = d.choices?.[0]?.message;
        const calls = message?.tool_calls || [];
        if (!calls.length) return this._parseStructured(message?.content, provider);

        const submit = calls.find(c => c.function?.name === SUBMIT_TOOL_NAME);
        if (submit) return this._parseStructured(submit.function.arguments, provider);

        messages.push(message);
        for (const call of calls) {
          let args = {};
          try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* malformed args */ }
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(await executeTool(call.function.name, args))
          });
        }
      }
      return null;
    }

    /* ── Gemini ── */
    if (provider === 'gemini') {
      const contents = [{ role: 'user', parts: [{ text: prompt }] }];
      const declarations = tools.map(t => ({
        name: t.name, description: t.description, parameters: toGeminiSchema(t.parameters)
      }));

      for (let round = 0; round < maxRounds; round++) {
        const d = await post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`,
          {
            contents,
            systemInstruction: { parts: [{ text: system }] },
            tools: [{ functionDeclarations: declarations }]
          }
        );

        const parts = d.candidates?.[0]?.content?.parts || [];
        const calls = parts.filter(p => p.functionCall).map(p => p.functionCall);
        if (!calls.length) return this._parseStructured(parts.find(p => p.text)?.text, provider);

        const submit = calls.find(c => c.name === SUBMIT_TOOL_NAME);
        if (submit) return submit.args;

        contents.push({ role: 'model', parts });
        contents.push({
          role: 'user',
          parts: await Promise.all(calls.map(async c => ({
            functionResponse: { name: c.name, response: await executeTool(c.name, c.args || {}) }
          })))
        });
      }
      return null;
    }

    throw new Error(`Unknown provider: ${provider}`);
  }

  /**
   * Parse a structured-output response. Schema enforcement means this is plain
   * JSON.parse in practice; the fence strip and balanced-brace scan only cover a
   * provider that ignores its own schema directive.
   */
  _parseStructured(text, provider) {
    if (!text) throw new Error(`Empty response from ${provider}`);
    try {
      return JSON.parse(text);
    } catch {
      const recovered = extractJsonObject(stripCodeFence(text));
      if (recovered) return recovered;
      throw new Error(`${provider} returned unparseable output`);
    }
  }

  /**
   * Parse the full-analysis JSON response from the LLM.
   * Returns { summary, priority, actionPlan, fixes } or null.
   */
  /**
   * Parse a full-analysis response from a backend that cannot enforce a schema
   * (on-device model, local server). Accepts both the array wire format and the
   * legacy rule-ID-keyed object.
   */
  _parseFullAnalysisResponse(text) {
    if (!text) return null;
    const cleaned = stripCodeFence(text);
    try {
      return normalizeFullAnalysis(JSON.parse(cleaned));
    } catch {
      return normalizeFullAnalysis(extractJsonObject(cleaned));
    }
  }

  /**
   * Use Chrome's built-in AI (on-device)
   */
  async _fixWithWindowAI(prompt) {
    const session = await self.ai.languageModel.create({
      systemPrompt: 'You are an expert accessibility engineer. Respond with valid JSON only.'
    });

    const response = await this._promptWindowAI(session, prompt, FIX_SCHEMA);
    session.destroy();

    return this._parseFixResponse(response);
  }

  /**
   * Prompt the on-device model, constraining output to the schema when the
   * browser supports it. `responseConstraint` is only available in newer Chrome
   * builds, so an unsupported-option error falls back to an unconstrained call.
   */
  async _promptWindowAI(session, prompt, schema) {
    try {
      return await session.prompt(prompt, { responseConstraint: schema });
    } catch (e) {
      console.warn('[LLMRouter] on-device schema constraint unavailable:', e.message);
      return session.prompt(prompt);
    }
  }

  /**
   * Use Gemini API
   */
  async _fixWithProvider(issue, pageUrl, provider, model, apiKey, attempts = [], executeTool = null) {
    const prompt = this._buildFixPrompt(issue, pageUrl, attempts);

    // With a live page to inspect, let the model look before it answers. Falls
    // back to the single-shot schema call if the tool loop ends without a
    // submission, so a model that ignores the tools still produces a fix.
    if (typeof executeTool === 'function') {
      try {
        const viaTools = await this._callProviderWithTools(provider, model, apiKey, prompt, {
          schema: FIX_SCHEMA, executeTool
        });
        if (viaTools) return viaTools;
        console.warn('[LLMRouter] tool loop ended without submit_fix — falling back to single-shot');
      } catch (e) {
        console.warn('[LLMRouter] tool loop failed, falling back to single-shot:', e.message);
      }
    }

    // No JSON shape instructions needed in the prompt — the schema enforces it.
    return this._callProvider(provider, model, apiKey, prompt, {
      schema: FIX_SCHEMA,
      schemaName: 'accessibility_fix'
    });
  }

  /**
   * Use localhost orchestrator (/fix endpoint)
   */
  async _fixWithLocalhost(issue, pageUrl, serverUrl, attempts = []) {
    const r = await fetch(`${serverUrl}/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue, url: pageUrl, attempts }),
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
  _deterministicFix(issue, designInfo = null) {
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
        return { fixTitle: 'Add alt text to image', before, after, explanation: `Add descriptive alt text to this image. "${alt}" was derived from the filename — review and improve it.`, effort: 'S', confidence: 0.85, _fixAttr: 'alt', _fixAttrDerive: 'src-filename' };
      },

      'input-image-alt': () => {
        const before = rawHtml || '<input type="image">';
        return { fixTitle: 'Add alt to image input', before, after: setAttr(before, 'alt', 'Submit'), explanation: 'Image inputs need alt text describing their function (e.g., "Submit", "Search").', effort: 'S', confidence: 0.9, _fixAttr: 'alt' };
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
          return {
            fixTitle: 'Add label to form input', before,
            after: `<label for="${id}">${labelText}</label>`,
            explanation: `Add a <label> linked to this input's id="${id}". "${labelText}" is derived from the field name — adjust to match your UI.`,
            effort: 'S', confidence: 0.9,
            _patchHint: 'insertAdjacent',
            _insertSelector: selector,
            _insertPosition: 'beforebegin',
            _insertHTML: `<label for="${id}">${labelText}</label>`
          };
        }
        const genId = `field-${name.replace(/\s+/g, '-').toLowerCase()}`;
        return {
          fixTitle: 'Add label to form input', before,
          after: setAttr(before, 'id', genId),
          explanation: `This input has no id or label. Added id="${genId}" and a matching <label>.`,
          effort: 'S', confidence: 0.85,
          _patchHint: 'insertAdjacentWithAttr',
          _attrChanges: [{ attribute: 'id', value: genId }],
          _insertSelector: selector,
          _insertPosition: 'beforebegin',
          _insertHTML: `<label for="${genId}">${labelText}</label>`
        };
      },

      'select-name': () => {
        const before = rawHtml || '<select></select>';
        const id = getAttr(before, 'id') || 'select-field';
        const name = getAttr(before, 'name') || 'option';
        const labelText = humanise(name);
        return {
          fixTitle: 'Add label to select', before,
          after: setAttr(before, 'id', id),
          explanation: `Select elements need an associated <label> for screen readers.`,
          effort: 'S', confidence: 0.9,
          _patchHint: 'insertAdjacentWithAttr',
          _attrChanges: [{ attribute: 'id', value: id }],
          _insertSelector: selector,
          _insertPosition: 'beforebegin',
          _insertHTML: `<label for="${id}">${labelText}</label>`
        };
      },

      'color-contrast': () => {
        // Prefer a compliant pair from the page's OWN palette over black-on-white,
        // which designers reject because it discards the brand.
        const before = rawHtml || '<span>text</span>';
        const pair = pickAccessiblePair(designInfo);
        const ratio = pair.ratio.toFixed(2);

        const existingStyle = getAttr(before, 'style') || '';
        const contrastCss = `color: ${pair.fg}; background-color: ${pair.bg};`;
        const newStyle = existingStyle
          ? existingStyle.replace(/;?\s*$/, `; ${contrastCss}`)
          : contrastCss;
        const after = setAttr(before, 'style', newStyle);

        return {
          fixTitle: 'Fix color contrast',
          before,
          after,
          explanation: pair.fromBrand
            ? `Applied ${pair.fg} on ${pair.bg} — both taken from this page's own palette — for a ${ratio}:1 ratio, clearing the 4.5:1 minimum while staying on brand.`
            : `No pair in the detected palette reaches 4.5:1, so this falls back to black on white (${ratio}:1). Replace with brand colors that meet the ratio.`,
          effort: 'S',
          confidence: pair.fromBrand ? 0.85 : 0.8,
          _patchHint: 'css',
          _cssChanges: [
            { property: 'color', value: pair.fg },
            { property: 'backgroundColor', value: pair.bg }
          ]
        };
      },

      'document-title': () => ({
        fixTitle: 'Add page title',
        before: '<head>...</head>',
        after: '<title>Page Title</title>',
        explanation: 'Every page needs a unique, descriptive <title> for browser tabs and screen readers.',
        effort: 'S',
        confidence: 1.0,
        _patchHint: 'insertAdjacent',
        _insertSelector: 'head',
        _insertPosition: 'afterbegin',
        _insertHTML: '<title>Page Title</title>'
      }),

      'bypass': () => ({
        fixTitle: 'Add skip navigation link',
        before: '<body>',
        after: '<a href="#main-content" class="skip-link" style="position:absolute;left:-9999px;z-index:999;padding:8px 16px;background:#000;color:#fff;">Skip to main content</a>',
        explanation: 'Add a skip link so keyboard users can jump past navigation to the main content.',
        effort: 'S',
        confidence: 0.9,
        _patchHint: 'insertAdjacent',
        _insertSelector: 'body',
        _insertPosition: 'afterbegin',
        _insertHTML: '<a href="#main-content" class="skip-link" style="position:absolute;left:-9999px;z-index:999;padding:8px 16px;background:#000;color:#fff;">Skip to main content</a>'
      }),

      'meta-viewport': () => {
        const before = rawHtml || '<meta name="viewport">';
        return { fixTitle: 'Fix viewport meta tag', before, after: '<meta name="viewport" content="width=device-width, initial-scale=1">', explanation: 'Remove user-scalable=no and maximum-scale restrictions — users with low vision need to pinch-to-zoom.', effort: 'S', confidence: 1.0 };
      },

      'page-has-heading-one': () => ({
        fixTitle: 'Add h1 heading',
        before: '<body>',
        after: '<h1>Page Heading</h1>',
        explanation: 'Every page should have an <h1> heading. It helps screen readers understand the page structure.',
        effort: 'S',
        confidence: 0.9,
        _patchHint: 'insertAdjacent',
        _insertSelector: 'main, [role="main"], body > div:first-child, body',
        _insertPosition: 'afterbegin',
        _insertHTML: '<h1 style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">Page Heading</h1>'
      }),

      'landmark-one-main': () => {
        const tag = getTag(rawHtml);
        if (rawHtml && tag && tag !== 'main') {
          const before = rawHtml;
          const after = before.replace(new RegExp(`^<${tag}`, 'i'), '<main').replace(new RegExp(`</${tag}>\\s*$`, 'i'), '</main>');
          return { fixTitle: 'Use <main> landmark', before, after, explanation: `Change this <${tag}> to <main> to define the primary content region for screen reader navigation.`, effort: 'S', confidence: 0.85 };
        }
        // Fallback: add role="main" to the most likely content container
        return {
          fixTitle: 'Add main landmark',
          before: rawHtml || '<div>...</div>',
          after: rawHtml ? setAttr(rawHtml, 'role', 'main') : '<div role="main">...</div>',
          explanation: 'Added role="main" to define the primary content region. Ideally change this element to a <main> tag.',
          effort: 'S', confidence: 0.8,
          _patchHint: 'attribute',
          _fallbackSelector: 'body > div:not([role]):not(header):not(footer):not(nav):not(aside)',
          _fallbackAttr: 'role',
          _fallbackValue: 'main'
        };
      },

      'region': () => {
        const before = rawHtml || '<div>...</div>';
        const cls = getAttr(before, 'class') || 'content';
        const label = humanise(cls.split(/\s+/)[0]);
        // Use role="region" + aria-label — both are simple attribute patches
        const after = setAttr(setAttr(before, 'role', 'region'), 'aria-label', label);
        return { fixTitle: 'Add landmark region', before, after, explanation: `Added role="region" and aria-label="${label}" so screen readers can navigate by region.`, effort: 'S', confidence: 0.8 };
      },

      'list': () => {
        const before = rawHtml || '<div>...</div>';
        const tag = getTag(before);
        if (tag === 'ul' || tag === 'ol') {
          // Real <ul>/<ol> has non-<li> children — add role="listitem" to those children
          return {
            fixTitle: 'Fix list children',
            before,
            after: before,
            explanation: `This <${tag}> contains non-<li> children. Adding role="listitem" to direct children so the list structure is valid for screen readers.`,
            effort: 'S', confidence: 0.85,
            _patchHint: 'childRole',
            _parentSelector: selector,
            _childRole: 'listitem'
          };
        }
        if (tag === 'div' || tag === 'span') {
          return { fixTitle: 'Use proper list markup', before, after: setAttr(before, 'role', 'list'), explanation: 'Added role="list" so screen readers announce this as a list with item count.', effort: 'S', confidence: 0.8 };
        }
        return { fixTitle: 'Use proper list markup', before, after: setAttr(before, 'role', 'list'), explanation: 'Replace non-semantic markup with <ul>/<ol> and <li> so screen readers announce list structure and item count.', effort: 'M', confidence: 0.7 };
      },

      'listitem': () => {
        const before = rawHtml || '<li>...</li>';
        const tag = getTag(before);
        if (tag !== 'li') {
          return { fixTitle: 'Fix list item markup', before, after: setAttr(before, 'role', 'listitem'), explanation: 'Added role="listitem" to fix the list item semantics for screen readers.', effort: 'S', confidence: 0.85 };
        }
        // If it's already <li> but outside a list, we need to wrap — use insertAdjacent
        // The parent container needs role="list"
        // Strip the terminal li segment to target the parent container.
        // Guard: if the result is empty (e.g. selector was just "li"), keep original selector.
        const parentSel = selector
          ? (selector.replace(/ ?[>+~] ?li[^,]*$/i, '').replace(/ li[^,]*$/i, '').trim() || selector)
          : null;
        return {
          fixTitle: 'Fix list item parent',
          before,
          after: before,
          explanation: 'This <li> is not inside a <ul>, <ol>, or <menu>. The parent container needs role="list".',
          effort: 'S', confidence: 0.8,
          _patchHint: 'attribute',
          _fallbackSelector: parentSel,
          _fallbackAttr: 'role',
          _fallbackValue: 'list'
        };
      },

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

      'td-headers-attr': () => {
        const before = rawHtml || '<td>';
        const headers = getAttr(before, 'headers');
        if (headers) {
          // Remove invalid headers attribute — let axe re-evaluate
          return { fixTitle: 'Fix table header association', before, after: removeAttr(before, 'headers'), explanation: 'Removed invalid headers attribute. Ensure <th> elements have id attributes that <td> headers can reference.', effort: 'S', confidence: 0.8 };
        }
        return null; // Let LLM handle
      },

      'scope-attr-valid': () => {
        const before = rawHtml || '<th>';
        return { fixTitle: 'Fix scope attribute', before, after: setAttr(before, 'scope', 'col'), explanation: 'Use a valid scope value: "col", "row", "colgroup", or "rowgroup".', effort: 'S', confidence: 0.9 };
      },

      'landmark-unique': () => {
        // Landmarks need unique role/label combinations — add aria-label to differentiate
        const before = rawHtml || '<nav>';
        const tag = getTag(before);
        const role = getAttr(before, 'role') || tag;
        const cls = getAttr(before, 'class') || '';
        // Derive a sensible label from class name, id, or tag
        const id = getAttr(before, 'id') || '';
        let label = '';
        if (id) label = humanise(id);
        else if (cls) label = humanise(cls.split(/\s+/)[0]);
        else label = humanise(role) + ' section';
        const after = setAttr(before, 'aria-label', label);
        return { fixTitle: 'Add unique landmark label', before, after, explanation: `Multiple "${role}" landmarks exist — add a unique aria-label to each so screen readers can distinguish them.`, effort: 'S', confidence: 0.85 };
      },

      'aria-allowed-role': () => {
        // Role is not appropriate for this element — remove it
        const before = rawHtml || '<div role="invalid">';
        const role = getAttr(before, 'role');
        if (role) {
          const after = removeAttr(before, 'role');
          return { fixTitle: 'Remove inappropriate ARIA role', before, after, explanation: `The role="${role}" is not valid for this element type. Removing it lets the browser use the correct implicit role.`, effort: 'S', confidence: 0.85 };
        }
        return null; // No role to remove → LLM
      },

      'aria-required-children': () => {
        // Certain ARIA roles require specific child roles (e.g. role="list" needs role="listitem" children)
        const before = rawHtml || '<div role="list">';
        const role = getAttr(before, 'role') || '';
        // Map of parent role → required child role
        const childRoleMap = {
          'list': 'listitem', 'listbox': 'option', 'menu': 'menuitem',
          'menubar': 'menuitem', 'tablist': 'tab', 'tree': 'treeitem',
          'grid': 'row', 'table': 'row', 'rowgroup': 'row',
          'row': 'cell', 'treegrid': 'row', 'feed': 'article',
          'radiogroup': 'radio', 'group': 'listitem',
        };
        const requiredChildRole = childRoleMap[role];
        if (requiredChildRole) {
          // Strategy: add role to direct children that lack it
          return {
            fixTitle: `Add required child roles for ${role}`,
            before,
            after: before,
            explanation: `Elements with role="${role}" must contain children with role="${requiredChildRole}". Adding the required role to each direct child.`,
            effort: 'S', confidence: 0.8,
            _patchHint: 'childRole',
            _parentSelector: selector,
            _childRole: requiredChildRole
          };
        }
        // If we don't know the required child, remove the parent role as fallback
        if (role) {
          return { fixTitle: 'Remove ARIA role missing required children', before, after: removeAttr(before, 'role'), explanation: `The role="${role}" requires specific child roles that are missing. Removing the role to use implicit semantics.`, effort: 'S', confidence: 0.75 };
        }
        return null;
      },

      'aria-required-parent': () => {
        // Element has a role that requires a specific parent role
        const before = rawHtml || '<div role="listitem">';
        const role = getAttr(before, 'role') || '';
        const parentRoleMap = {
          'listitem': 'list', 'option': 'listbox', 'menuitem': 'menu',
          'tab': 'tablist', 'treeitem': 'tree', 'row': 'grid',
          'cell': 'row', 'gridcell': 'row', 'columnheader': 'row',
          'rowheader': 'row', 'article': 'feed',
        };
        const requiredParentRole = parentRoleMap[role];
        if (requiredParentRole) {
          return {
            fixTitle: `Add required parent role for ${role}`,
            before,
            after: before,
            explanation: `This element with role="${role}" must be inside an element with role="${requiredParentRole}".`,
            effort: 'S', confidence: 0.8,
            _patchHint: 'attribute',
            _fallbackSelector: selector ? selector.replace(/ > [^>]+$/, '').replace(/ [^> ]+$/, '') : null,
            _fallbackAttr: 'role',
            _fallbackValue: requiredParentRole
          };
        }
        return null;
      },

      'definition-list': () => {
        const before = rawHtml || '<dl>';
        return { fixTitle: 'Fix definition list structure', before, after: before, explanation: 'Ensure <dl> contains only <dt>, <dd>, <div>, <script>, or <template> children. Wrap non-conforming children in proper <dt>/<dd> pairs.', effort: 'M', confidence: 0.7 };
      },

      'dlitem': () => {
        const before = rawHtml || '<dt>';
        return {
          fixTitle: 'Wrap in definition list',
          before, after: before,
          explanation: 'This <dt>/<dd> element must be inside a <dl>. The parent container needs to be a <dl>.',
          effort: 'S', confidence: 0.8,
          _patchHint: 'attribute',
          _fallbackSelector: selector ? selector.replace(/ > (dt|dd).*$/i, '').replace(/ (dt|dd).*$/i, '') : null,
          _fallbackAttr: 'role',
          _fallbackValue: 'definition'
        };
      },

      'empty-heading': () => {
        const before = rawHtml || '<h2></h2>';
        return { fixTitle: 'Add content to heading', before, after: before.replace(/>(\s*)<\/h/i, '>Heading content</h'), explanation: 'This heading is empty. Add descriptive text so screen readers can announce the section.', effort: 'S', confidence: 0.85 };
      },

      'empty-table-header': () => {
        const before = rawHtml || '<th></th>';
        return { fixTitle: 'Add content to table header', before, after: before.replace(/>(\s*)<\/th/i, '>Column header</th'), explanation: 'This table header is empty. Add descriptive text so screen readers can identify the column.', effort: 'S', confidence: 0.85 };
      },

      'duplicate-id-active': () => {
        const before = rawHtml || '<div id="duplicate">';
        const id = getAttr(before, 'id');
        if (id) {
          const uniqueId = `${id}-${Math.random().toString(36).substring(2, 6)}`;
          return { fixTitle: 'Fix duplicate id', before, after: setAttr(before, 'id', uniqueId), explanation: `Multiple elements share id="${id}". Each id must be unique on the page.`, effort: 'S', confidence: 0.85 };
        }
        return null;
      },

      'duplicate-id-aria': () => {
        const before = rawHtml || '<div id="duplicate">';
        const id = getAttr(before, 'id');
        if (id) {
          const uniqueId = `${id}-${Math.random().toString(36).substring(2, 6)}`;
          return { fixTitle: 'Fix duplicate ARIA id', before, after: setAttr(before, 'id', uniqueId), explanation: `Multiple elements share id="${id}" referenced by ARIA. Each id must be unique.`, effort: 'S', confidence: 0.85 };
        }
        return null;
      },

      'form-field-multiple-labels': () => {
        const before = rawHtml || '<input>';
        return { fixTitle: 'Fix multiple labels', before, after: before, explanation: 'This form field has multiple <label> elements. Keep one label and remove duplicates, or combine them using aria-labelledby.', effort: 'S', confidence: 0.7 };
      },

      'scrollable-region-focusable': () => {
        const before = rawHtml || '<div style="overflow: auto">';
        const after = setAttr(before, 'tabindex', '0');
        return { fixTitle: 'Make scrollable region focusable', before, after, explanation: 'Scrollable regions must be keyboard-accessible. Added tabindex="0" so keyboard users can scroll.', effort: 'S', confidence: 0.9 };
      },

      'autocomplete-valid': () => {
        const before = rawHtml || '<input>';
        const ac = getAttr(before, 'autocomplete') || '';
        if (ac) {
          return { fixTitle: 'Fix autocomplete value', before, after: removeAttr(before, 'autocomplete'), explanation: `The autocomplete value "${ac}" is invalid for this input type. Remove it or use a valid token like "name", "email", "tel".`, effort: 'S', confidence: 0.8 };
        }
        return null;
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

  /**
   * `attempts` are fixes that were applied to the real page, re-scanned, and
   * found not to have cleared the violation. Feeding them back is what turns a
   * one-shot suggestion into a loop that can actually converge — without them
   * the model has no way to know it already tried something and it did not work.
   */
  _buildFixPrompt(issue, pageUrl, attempts = []) {
    const history = attempts.length
      ? `\nPREVIOUS ATTEMPTS THAT DID NOT WORK — the violation was still present after applying each of these. Do not repeat them; try a different approach:\n${
          attempts.map((a, i) =>
            `${i + 1}. ${a.fix?.fixTitle || 'attempt'}\n   applied: ${a.fix?.after || '(none)'}\n   result:  ${a.failure || 'violation still present after re-scan'}`
          ).join('\n')
        }\n`
      : '';

    return `Given this accessibility issue, generate a minimal working code fix.
${history}

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

  /**
   * Parse a single-fix response from a backend that cannot enforce a schema.
   * Providers go through `_parseStructured` instead.
   */
  _parseFixResponse(text) {
    if (!text) return null;
    const cleaned = stripCodeFence(text);
    try {
      return JSON.parse(cleaned);
    } catch {
      return extractJsonObject(cleaned);
    }
  }
}
