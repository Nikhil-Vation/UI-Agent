/**
 * Vision analysis — problems only visible in a rendered screenshot.
 *
 * The DOM is not the page. Text can sit on a busy photo and stay perfectly
 * legible to axe while unreadable to a person; a focus ring can exist in CSS
 * and be invisible against its background; a layout can collapse at 200% zoom
 * without a single invalid attribute. None of that is inspectable from markup —
 * it requires looking at pixels, which is what this does.
 *
 * This is the one part of the product that costs real money per call and needs
 * a capable multimodal model, so it is opt-in and gated on the same
 * `_cloudAllowed` privacy check as every other cloud-reaching path — screenshots
 * are page content, and privacy mode must cover them exactly like DOM text.
 */

const VISION_FINDING_PROPS = {
  title:        { type: 'string' },
  severity:     { type: 'string', enum: ['critical', 'serious', 'moderate', 'minor'] },
  wcag:         { type: 'array', items: { type: 'string' } },
  evidence:     { type: 'string', description: 'What is visible in the screenshot that causes the problem' },
  description:  { type: 'string' },
  suggestedFix: { type: 'string' }
};

const VISION_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: VISION_FINDING_PROPS,
        required: Object.keys(VISION_FINDING_PROPS)
      }
    }
  },
  required: ['findings']
};

const ALT_SCHEMA = {
  type: 'object',
  properties: { altText: { type: 'string', description: 'A concise, literal description of what the image shows' } },
  required: ['altText']
};

const VISION_PROMPT = `You are reviewing a screenshot of a rendered web page for visual accessibility
problems that CANNOT be detected by reading HTML — only by looking at the image. Report only
what genuinely requires vision to notice. Do not report anything checkable from markup, such as
a missing alt attribute or a missing label element — those are already covered elsewhere.

Look specifically for:
- Text overlaid on a busy image or gradient where it is hard to read
- Meaning conveyed by color alone (e.g. only red/green distinguishes states)
- Content that appears cut off, overlapping, or clipped
- Interactive elements with no visible focus or hover treatment
- Touch targets that look too small to tap reliably

Respond with a JSON object matching the given schema. If nothing qualifies, return an empty
findings array rather than inventing something.`;

/**
 * Format the same base64 screenshot for each provider's multimodal input shape.
 * Kept as one small map rather than four branches repeated per caller.
 */
function imagePart(provider, base64, mime = 'image/png') {
  if (provider === 'gemini')
    return { inlineData: { mimeType: mime, data: base64 } };
  if (provider === 'anthropic')
    return { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };
  // OpenAI and Mistral both take a data-URL image_url content part.
  return { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } };
}

function stripDataUrlPrefix(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  return m ? { mime: m[1], base64: m[2] } : { mime: 'image/png', base64: dataUrl || '' };
}

/**
 * One multimodal call, schema-constrained where the dialect supports it.
 * Returns the parsed object. Screenshot dimensions keep the request small —
 * these prompts are the most token-expensive thing in the product.
 */
async function callVisionProvider(provider, model, apiKey, screenshotDataUrl, prompt, schema, opts = {}) {
  const { mime, base64 } = stripDataUrlPrefix(screenshotDataUrl);
  const timeout = opts.timeout ?? 45000;

  const post = async (url, body, headers) => {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeout)
    });
    if (!r.ok) throw new Error(`${provider} ${r.status}: ${await r.text()}`);
    return r.json();
  };

  if (provider === 'gemini') {
    const m = model || 'gemini-2.5-flash';
    const d = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }, imagePart('gemini', base64, mime)] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.3 }
      }
    );
    return JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  }

  if (provider === 'openai') {
    const d = await post('https://api.openai.com/v1/chat/completions', {
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, imagePart('openai', base64, mime)] }],
      response_format: { type: 'json_schema', json_schema: { name: 'vision_findings', strict: true, schema } },
      max_tokens: 1500
    }, { Authorization: `Bearer ${apiKey}` });
    return JSON.parse(d.choices?.[0]?.message?.content || '{}');
  }

  if (provider === 'anthropic') {
    const d = await post('https://api.anthropic.com/v1/messages', {
      model: model || 'claude-3-5-haiku-20241022', max_tokens: 1500,
      messages: [{ role: 'user', content: [imagePart('anthropic', base64, mime), { type: 'text', text: prompt }] }],
      tools: [{ name: 'report_findings', description: 'Report the findings', input_schema: schema }],
      tool_choice: { type: 'tool', name: 'report_findings' }
    }, { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
    return (d.content || []).find(c => c.type === 'tool_use')?.input || {};
  }

  if (provider === 'mistral') {
    const d = await post('https://api.mistral.ai/v1/chat/completions', {
      model: model || 'pixtral-12b-2409',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, imagePart('mistral', base64, mime)] }],
      response_format: { type: 'json_schema', json_schema: { name: 'vision_findings', strict: true, schema } },
      max_tokens: 1500
    }, { Authorization: `Bearer ${apiKey}` });
    return JSON.parse(d.choices?.[0]?.message?.content || '{}');
  }

  throw new Error(`Vision not supported for provider: ${provider}`);
}

/** Normalize provider output into the same shape as judgment findings, so it merges into one panel. */
function normalizeVisionFindings(raw) {
  const findings = Array.isArray(raw?.findings) ? raw.findings : [];
  return findings
    .filter(f => f && f.title)
    .map((f, i) => ({
      id: `VISION-${i + 1}`,
      ruleId: 'vision-' + (f.title || 'finding').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
      title: f.title, severity: f.severity || 'moderate', wcag: f.wcag || [],
      evidence: f.evidence || '', description: f.description || '',
      suggestedFix: f.suggestedFix || '', category: 'vision', passedAutomated: true, occurrences: 1
    }));
}

/**
 * 3.3 — describe an image from its pixels rather than its filename.
 * Deliberately a separate, cheaper call from full-page vision analysis: most
 * `image-alt` violations don't need a full-page screenshot, just the one image.
 */
async function describeImageFromVision(provider, model, apiKey, imageDataUrl) {
  const prompt = 'Describe what this image shows in one concise sentence suitable as alt text. ' +
                 'Describe the content and purpose, not the fact that it is an image.';
  const result = await callVisionProvider(provider, model, apiKey, imageDataUrl, prompt, ALT_SCHEMA, { timeout: 20000 });
  return typeof result?.altText === 'string' ? result.altText.trim() : null;
}

/** Full-page pass: capture already done by caller (service worker owns chrome.tabs.*). */
async function analyzeScreenshot(provider, model, apiKey, screenshotDataUrl) {
  const raw = await callVisionProvider(provider, model, apiKey, screenshotDataUrl, VISION_PROMPT, VISION_SCHEMA);
  return normalizeVisionFindings(raw);
}

export {
  VISION_SCHEMA, ALT_SCHEMA, VISION_PROMPT,
  imagePart, stripDataUrlPrefix, callVisionProvider,
  normalizeVisionFindings, describeImageFromVision, analyzeScreenshot
};
