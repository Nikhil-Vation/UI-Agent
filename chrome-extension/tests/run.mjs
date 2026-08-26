/**
 * Test runner — no dependencies, no install. From chrome-extension/:
 *
 *   npm test          (or)   node tests/run.mjs
 *
 * Covers the pure logic in lib/. Anything needing a real DOM or the chrome.*
 * APIs is verified by hand in the browser — see tests/MANUAL.md.
 */

import { LLMRouter, autonomyFor, elementSignature } from '../lib/llm-router.js';
import {
  assessAltText, assessLinkText, assessDuplicateLinkText,
  assessCandidates, summarizeJudgment, groupFindings,
  assessHeadingText, assessDuplicateHeadingText, assessErrorText
} from '../lib/judgment.js';
import { buildPrompt, runJudgmentNuancePass } from '../lib/judgment-llm.js';
import { findBaseline, shouldAmbientScan, detectRegression } from '../lib/ambient.js';
import { buildChatPrompt, interpretChatCommand, applyChatPlan } from '../lib/chat.js';
import '../lib/trend.js';
import '../lib/vpat.js';
import '../lib/risk.js';
import '../lib/badge.js';
import '../lib/branding.js';
import '../lib/team-sync.js';
import '../lib/fix-export.js';
import '../lib/evidence.js';
import '../lib/audit-log.js';
import '../lib/framework.js';
import '../lib/crawl.js';
import '../lib/keyboard.js';
import '../lib/screenreader.js';
import '../lib/reading-order.js';
import '../lib/impairment.js';
import * as Vision from '../lib/vision.js';

const { buildFixDiff, buildSessionExport } = globalThis.FixExport;
const { buildEvidenceReport, renderEvidenceMarkdown } = globalThis.Evidence;
const { makeAuditEntry, appendEntry, entriesForPage, summarizeAudit, renderAuditMarkdown } = globalThis.AuditLog;
const { detectFramework, formatForFramework, toJsx } = globalThis.Framework;
const { parseSitemap, filterCrawlUrls, aggregateCrawl } = globalThis.Crawl;
const { assessFocusOrder } = globalThis.Keyboard;
const { buildUrlTrend, buildSparklinePoints, directionSymbol } = globalThis.Trend;
const { WCAG_SC_CATALOG, buildVpatDraft, renderVpatMarkdown } = globalThis.Vpat;
const { severityLevel, assessRisk, renderRiskMarkdown } = globalThis.Risk;
const { buildBadgeSvg, buildBadgeEmbed, gradeColor } = globalThis.Badge;
const { estimateTokens, estimateCallCost, formatUSD, addUsage, PRICING } = await import('../lib/cost-meter.js');
const { makeProfile, applyBranding } = globalThis.Branding;
const { buildTeamBundle, importTeamBundle } = globalThis.TeamSync;
const GitHub = await import('../lib/github.js');
const { formatAnnouncement, buildTranscript, assessTranscript, renderTranscriptMarkdown } = globalThis.ScreenReader;
const { assessReadingOrder } = globalThis.ReadingOrder;
const { PRESETS, presetList, buildSvgDefs, applyImpairment, COLOR_MATRICES } = globalThis.Impairment;

let failures = 0;
let count = 0;

function group(name) { console.log(`\n${name}`); }
function ok(condition, message) {
  count++;
  if (!condition) failures++;
  console.log(`  ${condition ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${message}`);
}

const router = new LLMRouter();
const img = (o) => ({ selector: 'img', alt: '', src: '', role: '', ariaHidden: false, html: '<img>', ...o });
const lnk = (o) => ({ selector: 'a', text: '', ariaLabel: '', href: '/x', html: '<a>', ...o });

/* ── 0.1 Privacy gate ─────────────────────────────────────────────── */
group('0.1  Cloud is unreachable while privacy mode is on');

ok(router._cloudAllowed({ privacyMode: true, llmApiKey: 'key' }) === false,
   'a saved API key is not on its own consent to send data out');
ok(router._cloudAllowed({ privacyMode: false, llmApiKey: 'key' }) === true,
   'turning privacy mode off enables the cloud tier');
ok(router._cloudAllowed({}) === false,
   'missing privacyMode fails closed');

{
  let attempted = false;
  globalThis.fetch = async () => { attempted = true; throw new Error('network blocked in test'); };
  router._capabilities = { windowAI: false, gemini: true, localhost: false, cloud: true };
  const result = await router.generateFix(
    { id: 'unknown-rule-xyz', html: ['<div>person@example.com</div>'], selectors: ['div'] },
    'https://example.com',
    { privacyMode: true, llmApiKey: 'REAL_KEY', llmProvider: 'gemini' }
  );
  ok(attempted === false, 'no network call is attempted at all');
  ok(result.source === 'deterministic', 'falls back to the local rule engine');
}

/* ── 0.4 Brand-aware contrast ─────────────────────────────────────── */
group('0.4  Contrast fixes use the page palette, not black on white');

{
  const brand = { colors: [{ hex: '#1a0a2e' }, { hex: '#8b5cf6' }, { hex: '#e2d4ff' }] };
  const fix = router._deterministicFix(
    { id: 'color-contrast', html: ['<span style="color:#999">Buy</span>'], selectors: ['span'] }, brand);
  const fg = fix._cssChanges[0].value;
  const bg = fix._cssChanges[1].value;
  const lum = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    .reduce((a, v, i) => a + [0.2126, 0.7152, 0.0722][i] * v, 0);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  ok(brand.colors.some(c => c.hex.toLowerCase() === fg), 'foreground comes from the brand palette');
  ok(brand.colors.some(c => c.hex.toLowerCase() === bg), 'background comes from the brand palette');
  ok(ratio(fg, bg) >= 4.5, `chosen pair clears 4.5:1 (${ratio(fg, bg).toFixed(2)}:1)`);

  const weak = router._deterministicFix(
    { id: 'color-contrast', html: ['<span>x</span>'], selectors: ['span'] },
    { colors: [{ hex: '#eeeeee' }, { hex: '#f5f5f5' }] });
  ok(weak._cssChanges[0].value === '#000000', 'a palette that cannot pass falls back honestly');
  ok(/falls back/.test(weak.explanation), 'and the explanation says so');
}

/* ── 2.1 Structured output ────────────────────────────────────────── */
group('2.1  Providers are given a schema, not asked nicely for JSON');

{
  const payload = { fixTitle: 'Add alt text', before: '<img>', after: '<img alt="x">',
                    explanation: 'why', effort: 'S', confidence: 0.9 };
  const json = JSON.stringify(payload);
  let sent = null;

  const respond = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
  globalThis.fetch = async (url, init) => {
    sent = JSON.parse(init.body);
    const u = String(url);
    if (u.includes('googleapis')) return respond({ candidates: [{ content: { parts: [{ text: json }] } }] });
    if (u.includes('anthropic'))  return respond({ content: [{ type: 'tool_use', input: payload }] });
    return respond({ choices: [{ message: { content: json } }] });
  };

  const issue = { id: 'image-alt', html: ['<img src="a.jpg">'], selectors: ['img'] };

  for (const provider of ['gemini', 'openai', 'anthropic', 'mistral']) {
    const out = await router._fixWithProvider(issue, 'https://x.com', provider, '', 'KEY');
    ok(out?.fixTitle === 'Add alt text', `${provider}: returns a parsed object`);
  }

  await router._fixWithProvider(issue, 'u', 'gemini', '', 'K');
  ok(!!sent.generationConfig?.responseSchema, 'gemini: responseSchema is sent');
  ok(!('additionalProperties' in sent.generationConfig.responseSchema),
     'gemini: additionalProperties omitted (Gemini rejects it)');

  await router._fixWithProvider(issue, 'u', 'openai', '', 'K');
  ok(sent.response_format?.json_schema?.strict === true, 'openai: strict json_schema');
  ok(sent.response_format.json_schema.schema.additionalProperties === false,
     'openai: additionalProperties false (strict mode requires it)');

  await router._fixWithProvider(issue, 'u', 'anthropic', '', 'K');
  ok(sent.tool_choice?.type === 'tool', 'anthropic: forced tool use (no response_format on that API)');
}

group('2.1  JSON recovery no longer uses a greedy regex');

{
  const trailing = '```json\n{"fixTitle":"ok","confidence":1}\n```\nHope that helps! (note})';
  ok(router._parseFixResponse(trailing)?.fixTitle === 'ok',
     'trailing prose containing } does not break parsing');

  const oldRegex = trailing.replace(/^```json?\s*/i, '').match(/\{[\s\S]*\}/);
  let oldWorked = true;
  try { JSON.parse(oldRegex[0]); } catch { oldWorked = false; }
  ok(oldWorked === false, 'confirms the previous regex genuinely failed on this input');

  ok(router._parseFixResponse('{"a":"brace } in string","b":1}')?.a === 'brace } in string',
     'braces inside string literals are handled');
  ok(router._parseFixResponse('not json') === null, 'garbage returns null rather than throwing');

  const arrayForm = router._parseFullAnalysisResponse(JSON.stringify({
    summary: 's', priority: [], actionPlan: { immediate: [], shortTerm: [], longTerm: [] },
    fixes: [{ ruleId: 'image-alt', fixTitle: 't', before: 'a', after: 'b',
              explanation: 'e', effort: 'S', confidence: 0.9 }]
  }));
  ok(arrayForm.fixes['image-alt']?.fixTitle === 't', 'fixes array is re-keyed by rule id');
  ok(arrayForm.fixes['image-alt'].ruleId === undefined, 'ruleId is stripped from the value');
  ok(router._parseFullAnalysisResponse(JSON.stringify({ fixes: { 'image-alt': { fixTitle: 't' } } }))
       .fixes['image-alt'].fixTitle === 't', 'legacy keyed shape still accepted');
}

/* ── 2.4–2.6 Autonomy, cache, routing ─────────────────────────────── */
group('2.4  Confidence decides how far a fix is trusted');

ok(autonomyFor({ confidence: 0.95 }) === 'auto',   'high confidence applies unattended');
ok(autonomyFor({ confidence: 0.9 })  === 'auto',   'the boundary is inclusive');
ok(autonomyFor({ confidence: 0.8 })  === 'flag',   'medium confidence applies but is flagged');
ok(autonomyFor({ confidence: 0.5 })  === 'propose','low confidence is never applied for the user');
ok(autonomyFor({})                   === 'propose','a missing confidence is treated as low, not high');

group('2.5  Repeated element shapes reuse one fix');

{
  ok(elementSignature('<button class="btn primary" id="save">Save</button>') ===
     elementSignature('<button class="primary btn" id="cancel">Cancel</button>'),
     'same shape with different id, text and class order shares a signature');
  ok(elementSignature('<button class="btn">x</button>') !== elementSignature('<a class="btn">x</a>'),
     'different tags do not share a signature');
  ok(elementSignature('<input type="text">') !== elementSignature('<input type="checkbox">'),
     'input type is part of the shape');

  const r2 = new LLMRouter();
  r2._capabilities = { windowAI: false, gemini: true, localhost: false, cloud: true };
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return { ok: true, status: 200, text: async () => '', json: async () => ({
      candidates: [{ content: { parts: [{ text: '{"fixTitle":"t","before":"b","after":"a","explanation":"e","effort":"S","confidence":0.8}' }] } }] }) };
  };
  const cfg = { privacyMode: false, llmApiKey: 'K', llmProvider: 'gemini' };
  // An unknown rule, so the deterministic handler returns low confidence and the
  // request actually reaches a backend — otherwise there is nothing to cache.
  const mk = (id) => ({ id: 'unknown-rule-for-cache', html: [`<button class="btn" id="${id}"></button>`], selectors: [`#${id}`] });

  await r2.generateFix(mk('a'), 'u', cfg);
  const second = await r2.generateFix(mk('b'), 'u', cfg);
  ok(calls === 1, `the second identical shape is served from cache (${calls} network call)`);
  ok(second.cached === true && /cached/.test(second.source), 'and is labelled as cached');

  // A retry must never be served the answer that just failed.
  const retry = await r2.generateFix(mk('c'), 'u', {
    ...cfg, attempts: [{ fix: { after: 'a' }, failure: 'still present' }]
  });
  ok(retry.cached !== true, 'a retry bypasses the cache');
  ok(calls === 2, 'and actually calls the model again');
}

group('2.7  A batched analysis stays one call');

{
  const r4 = new LLMRouter();
  r4._capabilities = { windowAI: true, gemini: true, localhost: true, cloud: true };
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error('should not be reached'); };

  // An issue the rule engine cannot confidently solve — exactly the case that
  // would otherwise escalate to a model during the post-batch metadata pass.
  const hard = { id: 'unknown-rule-abc', html: ['<div>x</div>'], selectors: ['div'] };

  const out = await r4.generateFix(hard, 'u', {
    privacyMode: false, llmApiKey: 'K', llmProvider: 'gemini', deterministicOnly: true
  });

  ok(out.source === 'deterministic', 'deterministicOnly returns the rule engine answer');
  ok(networkCalls === 0,
     `no backend is consulted even at low confidence (${networkCalls} calls)`);
  ok(out.confidence < 0.7, 'and it is honest that confidence is low rather than inflating it');
}

group('2.6  Difficulty decides which backend leads');

{
  const r3 = new LLMRouter();
  const caps = { windowAI: true, gemini: true, localhost: true };

  const easy = r3._backendOrder(0.6, caps, true);
  ok(easy[0] === 'windowAI', 'a nearly-solved issue leads with the free on-device model');

  const hard = r3._backendOrder(0.2, caps, true);
  ok(hard[0] === 'cloud', 'a hard issue leads with the strong model that has the page tools');

  const noCloud = r3._backendOrder(0.2, caps, false);
  ok(!noCloud.includes('cloud'), 'privacy mode removes the cloud tier from the order entirely');
  ok(noCloud.includes('windowAI') && noCloud.includes('localhost'), 'private backends remain');
}

/* ── 2.2 DOM tools ────────────────────────────────────────────────── */
group('2.2  The model can inspect the page before answering');

{
  const fixPayload = { fixTitle: 'Fix contrast', before: '<p>x</p>',
                       after: '<p style="color:#1a1a1a">x</p>', explanation: 'e',
                       effort: 'S', confidence: 0.9 };

  // A fake page: the real colour is only discoverable through the tool, never
  // from the markup — which is the whole reason tools exist.
  const toolCalls = [];
  const executeTool = async (name, args) => {
    toolCalls.push({ name, args });
    if (name === 'get_computed_style') {
      return { color: 'rgb(153,153,153)', effectiveBackground: { color: 'rgb(255,255,255)', from: 'body' } };
    }
    return { tag: 'p', text: 'x' };
  };

  // Each provider: first response asks for a tool, second submits the fix.
  const scripted = {
    anthropic: [
      { content: [{ type: 'tool_use', id: 't1', name: 'get_computed_style', input: { selector: 'p', properties: ['color'] } }] },
      { content: [{ type: 'tool_use', id: 't2', name: 'submit_fix', input: fixPayload }] }
    ],
    openai: [
      { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', function: { name: 'get_computed_style', arguments: '{"selector":"p","properties":["color"]}' } }] } }] },
      { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c2', function: { name: 'submit_fix', arguments: JSON.stringify(fixPayload) } }] } }] }
    ],
    mistral: [
      { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c1', function: { name: 'get_dom_context', arguments: '{"selector":"p"}' } }] } }] },
      { choices: [{ message: { role: 'assistant', tool_calls: [{ id: 'c2', function: { name: 'submit_fix', arguments: JSON.stringify(fixPayload) } }] } }] }
    ],
    gemini: [
      { candidates: [{ content: { parts: [{ functionCall: { name: 'get_computed_style', args: { selector: 'p', properties: ['color'] } } }] } }] },
      { candidates: [{ content: { parts: [{ functionCall: { name: 'submit_fix', args: fixPayload } }] } }] }
    ]
  };

  for (const provider of ['anthropic', 'openai', 'mistral', 'gemini']) {
    let turn = 0;
    toolCalls.length = 0;
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => scripted[provider][Math.min(turn++, scripted[provider].length - 1)],
      text: async () => ''
    });

    const out = await router._callProviderWithTools(provider, '', 'K', 'prompt', { executeTool });
    ok(out?.fixTitle === 'Fix contrast', `${provider}: tool round-trip returns the submitted fix`);
    ok(toolCalls.length === 1, `${provider}: the inspection tool was actually executed`);
  }
}

group('2.2  Tool loop degrades safely');

{
  // A model that never submits must not hang or throw — it falls back.
  let turn = 0;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    // Single-shot fallback has no `tools` key; the loop always sends one.
    if (!body.tools) {
      return { ok: true, status: 200, text: async () => '',
               json: async () => ({ candidates: [{ content: { parts: [{ text: '{"fixTitle":"fallback","confidence":0.5}' }] } }] }) };
    }
    turn++;
    return { ok: true, status: 200, text: async () => '',
             json: async () => ({ candidates: [{ content: { parts: [{ functionCall: { name: 'get_dom_context', args: { selector: 'p' } } }] } }] }) };
  };

  const out = await router._fixWithProvider(
    { id: 'x', html: ['<p>'], selectors: ['p'] }, 'u', 'gemini', '', 'K', [],
    async () => ({ tag: 'p' })
  );
  ok(out?.fixTitle === 'fallback', 'a model that never submits falls back to the single-shot call');
  ok(turn === 4, `the loop is capped rather than running forever (ran ${turn} rounds)`);
}

group('2.2  Tool definitions are provider-safe');

{
  const { DOM_TOOLS, buildSubmitTool, SUBMIT_TOOL_NAME } = await import('../lib/dom-tools.js');
  ok(DOM_TOOLS.length === 4, 'four inspection tools are defined');
  ok(DOM_TOOLS.every(t => t.parameters?.type === 'object' && Array.isArray(t.parameters.required)),
     'every tool declares an object schema with required fields');
  ok(DOM_TOOLS.some(t => t.name === 'get_computed_style'),
     'computed style is available — contrast cannot be solved from markup alone');
  ok(buildSubmitTool({ type: 'object' }).name === SUBMIT_TOOL_NAME,
     'the terminal submit tool is built from the fix schema');
}

/* ── 2.3 Self-verifying loop ──────────────────────────────────────── */
group('2.3  Retry context reaches the model');

{
  // A rule with a high-confidence deterministic handler. On a first attempt it
  // must short-circuit; once that fix has demonstrably failed it must NOT be
  // returned again, or the retry loop spins forever on the same broken answer.
  const issue = { id: 'html-has-lang', html: ['<html>'], selectors: ['html'] };

  const first = await router.generateFix(issue, 'u', { privacyMode: true });
  ok(first.source === 'deterministic', 'first attempt uses the deterministic handler');

  let promptSeen = null;
  globalThis.fetch = async (url, init) => {
    promptSeen = JSON.parse(init.body).contents[0].parts[0].text;
    return { ok: true, status: 200, json: async () => ({
      candidates: [{ content: { parts: [{ text: '{"fixTitle":"different approach","before":"<html>","after":"<html lang=\\"en\\">","explanation":"e","effort":"S","confidence":0.8}' }] } }]
    }) };
  };
  router._capabilities = { windowAI: false, gemini: true, localhost: false, cloud: true };

  const retry = await router.generateFix(issue, 'u', {
    privacyMode: false,
    llmApiKey: 'K',
    llmProvider: 'gemini',
    attempts: [{ fix: first, failure: 'the violation was still reported after re-scanning' }]
  });

  ok(retry.source === 'gemini',
     'after a failure the deterministic short-circuit is skipped so the answer can change');
  ok(/PREVIOUS ATTEMPTS THAT DID NOT WORK/.test(promptSeen),
     'the prompt tells the model what already failed');
  ok(promptSeen.includes(first.after),
     'the exact fix that failed is included, so it is not proposed again');
  ok(/Do not repeat them/.test(promptSeen), 'and it is instructed not to repeat them');
}

/* ── 3.1 Judgment layer ───────────────────────────────────────────── */
group('3.1  Judgment layer flags what automated checks pass');

ok(assessAltText(img({ alt: 'IMG_4471.jpg', src: '/u/IMG_4471.jpg' })), 'alt is a filename');
ok(assessAltText(img({ alt: 'DSC_0012', src: '/p/DSC_0012.png' })), 'alt is a camera filename');
ok(assessAltText(img({ alt: 'Hero Banner', src: '/img/hero-banner.png' })), 'alt matches the filename slug');
ok(assessAltText(img({ alt: 'image' })), 'alt names the medium');
ok(assessAltText(img({ alt: 'Photo of a man with a laptop' })), 'redundant "photo of" prefix');
ok(assessAltText(img({ alt: 'x'.repeat(200) })), 'alt is far too long');
ok(assessLinkText(lnk({ text: 'Click here' })), '"Click here"');
ok(assessLinkText(lnk({ text: 'Learn more →' })), 'trailing arrow stripped before matching');
ok(assessLinkText(lnk({ text: 'https://example.com/a' })), 'raw URL as link text');

group('3.1  …and must not cry wolf');

ok(!assessAltText(img({ alt: '', src: '/spacer.gif' })), 'empty alt (decorative) is left alone');
ok(!assessAltText(img({ alt: 'image', role: 'presentation' })), 'role=presentation is left alone');
ok(!assessAltText(img({ alt: 'image', ariaHidden: true })), 'aria-hidden is left alone');
ok(!assessAltText(img({ alt: 'Dr Amara Osei presenting results', src: '/IMG_881.jpg' })),
   'good description survives a messy filename');
ok(!assessLinkText(lnk({ text: 'Download the 2026 report' })),
   'descriptive text containing a vague word is fine');
ok(!assessLinkText(lnk({ text: '' })), 'a nameless link is axe\'s job, not ours');

group('3.1  Live-site regression: this is the exact bug found on microsoft.com');

{
  // The real failure: two "Azure" links that go to the SAME page. The nav
  // wrote it as a relative href in the source; the footer wrote it absolute.
  // The COLLECTOR is what makes them comparable — it reads `el.href` (the
  // resolved DOM property), not `getAttribute('href')` (the literal string),
  // so by the time either link reaches this function both are already the
  // fully-qualified URL a browser would actually navigate to. That's what's
  // reproduced here: two absolute strings representing what `.href` yields
  // for a relative nav link and an already-absolute footer link that point
  // at the identical page.
  const azureRelative = lnk({ text: 'Azure', href: 'https://www.microsoft.com/en-us/azure', selector: 'nav a' });
  const azureAbsolute = lnk({ text: 'Azure', href: 'https://www.microsoft.com/en-us/azure', selector: 'footer a' });
  ok(assessDuplicateLinkText([azureRelative, azureAbsolute]).length === 0,
     'the same resolved destination linked twice is NOT a false duplicate-destination finding');

  ok(assessDuplicateLinkText([
    lnk({ text: 'Azure', href: 'https://www.microsoft.com/azure' }),
    lnk({ text: 'Azure', href: 'https://www.microsoft.com/azure/' })
  ]).length === 0, 'a trailing slash alone is not a different destination');

  ok(assessDuplicateLinkText([
    lnk({ text: 'Azure', href: 'https://www.microsoft.com/azure?icid=nav-top' }),
    lnk({ text: 'Azure', href: 'https://www.microsoft.com/azure?icid=footer-promo&ocid=AID123' })
  ]).length === 0, 'tracking/campaign query parameters are not a different destination');

  ok(assessDuplicateLinkText([
    lnk({ text: 'Pricing', href: 'https://www.microsoft.com/azure/pricing#calculator' }),
    lnk({ text: 'Pricing', href: 'https://www.microsoft.com/azure/pricing#faq' })
  ]).length === 0, 'a hash-only jump-link difference on the same page is not a different destination');

  // The check must still catch the real thing it exists for.
  const trulyDifferent = assessDuplicateLinkText([
    lnk({ text: 'Learn more', href: 'https://www.microsoft.com/azure', selector: 'a1' }),
    lnk({ text: 'Learn more', href: 'https://www.microsoft.com/windows', selector: 'a2' }),
    lnk({ text: 'Learn more', href: 'https://www.microsoft.com/surface', selector: 'a3' })
  ]);
  ok(trulyDifferent.length === 1 && trulyDifferent[0].selectors.length === 3,
     'three genuinely different destinations are still caught after normalization');
  ok(/3 different pages/.test(trulyDifferent[0].evidence), 'and the count in the evidence is accurate');

  // An unparseable href must not crash or silently merge with everything else.
  ok(assessDuplicateLinkText([
    lnk({ text: 'Call', href: 'tel:+1-800-555-0100' }),
    lnk({ text: 'Call', href: 'tel:+1-800-555-0199' })
  ]).length === 1, 'non-http schemes still compare correctly, falling back to the literal string');
}

group('3.1  Image src must be a real fetchable URL, not a bare relative path');

{
  // Second instance of the same bug class: alt-text findings carry `imageSrc`
  // forward so "Describe with AI" can fetch(imageSrc) from the SERVICE WORKER,
  // which has no page context to resolve a relative path against. Filename
  // extraction must keep working the same either way — it only reads the
  // last path segment.
  ok(assessAltText(img({ alt: 'hero-banner', src: 'https://example.com/assets/hero-banner.jpg' })),
     'filename-pattern matching still works when src is a full absolute URL');
  const finding = assessAltText(img({ alt: 'IMG_001.jpg', src: 'https://example.com/en-us/IMG_001.jpg' }));
  ok(finding.imageSrc === 'https://example.com/en-us/IMG_001.jpg',
     'the imageSrc carried on the finding is exactly what a fetch() call would need — a real absolute URL, not a bare "/en-us/IMG_001.jpg" the service worker could not resolve');
}

group('3.1  Cross-element check no rule engine can express');

{
  const dupes = assessDuplicateLinkText([
    lnk({ text: 'Read more', href: '/a', selector: 'a:nth-of-type(1)' }),
    lnk({ text: 'Read more', href: '/b', selector: 'a:nth-of-type(2)' }),
    lnk({ text: 'Read more', href: '/c', selector: 'a:nth-of-type(3)' })
  ]);
  ok(dupes.length === 1 && dupes[0].selectors.length === 3, 'three links become one grouped finding');
  ok(assessDuplicateLinkText([lnk({ text: 'Home', href: '/' }), lnk({ text: 'Home', href: '/' })]).length === 0,
     'same text AND same destination is not a problem');

  const all = assessCandidates({
    images: [img({ alt: 'IMG_001.jpg', src: '/IMG_001.jpg' }), img({ alt: 'A red bicycle' })],
    links:  [lnk({ text: 'click here', href: '/1' }), lnk({ text: 'Our pricing', href: '/pricing' })]
  });
  ok(all.length === 2, 'only the two genuinely bad items are flagged');
  ok(all.every(f => f.passedAutomated === true), 'every finding is marked as passing automated checks');
  ok(/passes axe-core and Lighthouse/.test(summarizeJudgment(all, 18)), 'summary makes the Lighthouse point');
  ok(/No additional issues/.test(summarizeJudgment([])), 'a clean page reports honestly');
}

group('3.1  Repeated findings collapse into one card');

{
  // Six images from one template, all with the same useless alt text.
  const sixImages = Array.from({ length: 6 }, (_, i) =>
    img({ alt: 'Picture', selector: `img:nth-of-type(${i + 1})` }));
  const out = assessCandidates({ images: sixImages, links: [] });

  ok(out.length === 1, `six identical images produce one card (got ${out.length})`);
  ok(out[0].occurrences === 6, 'the card records six occurrences');
  ok(out[0].selectors.length === 6, 'all six selectors are kept so each can be located');
  ok(/6 images share/.test(out[0].title), 'title reflects the count');

  // Different bad alt values must NOT be merged together.
  const mixed = assessCandidates({
    images: [img({ alt: 'Picture' }), img({ alt: 'Picture' }), img({ alt: 'image' })],
    links: []
  });
  ok(mixed.length === 2, 'different alt values stay separate cards');
  ok(mixed[0].occurrences === 2 && mixed[1].occurrences === 1, 'each keeps its own count');

  // Grouping must not merge across rules even if evidence collides.
  const crossRule = groupFindings([
    { ruleId: 'alt-text-quality', evidence: '"x"', selectors: ['a'], severity: 'serious' },
    { ruleId: 'link-text-quality', evidence: '"x"', selectors: ['b'], severity: 'serious' }
  ]);
  ok(crossRule.length === 2, 'same evidence under different rules stays separate');

  // The duplicate-destination finding supersedes the vague-text one.
  const readMore = assessCandidates({
    images: [],
    links: [
      lnk({ text: 'Read more', href: '/a', selector: 'a1' }),
      lnk({ text: 'Read more', href: '/b', selector: 'a2' }),
      lnk({ text: 'Read more', href: '/c', selector: 'a3' })
    ]
  });
  ok(readMore.length === 1, `three "Read more" links produce one card, not four (got ${readMore.length})`);
  ok(readMore[0].ruleId === 'duplicate-link-text',
     'the surviving card is the more informative duplicate-destination one');

  // Same text to the SAME destination is not a duplicate problem, so the vague
  // text finding must still come through.
  const sameDest = assessCandidates({
    images: [],
    links: [lnk({ text: 'click here', href: '/x', selector: 'a1' }),
            lnk({ text: 'click here', href: '/x', selector: 'a2' })]
  });
  ok(sameDest.length === 1 && sameDest[0].ruleId === 'link-text-quality',
     'identical destination still reports the vague text');
  ok(sameDest[0].occurrences === 2, 'and groups the two occurrences');

  // Case and invisible-character variants are the same problem. These looked
  // identical in the UI but landed in separate groups before the key was
  // normalised, which is exactly the bug that made grouping appear broken.
  const cased = assessCandidates({
    images: [],
    links: [lnk({ text: 'Learn more', href: '/a', selector: 'a1' }),
            lnk({ text: 'Learn More', href: '/a', selector: 'a2' }),
            lnk({ text: 'Learn more', href: '/a', selector: 'a3' }),
            lnk({ text: 'Learn more​', href: '/a', selector: 'a4' })]
  });
  ok(cased.length === 1, `case and invisible-character variants group together (got ${cased.length})`);
  ok(cased[0].occurrences === 4, 'all four variants counted');
  ok(cased[0].evidence === '"Learn more"', 'displayed evidence keeps the first original casing');

  // Widest-reaching problem first within a severity band.
  const ordered = assessCandidates({
    images: [img({ alt: 'image' }), ...Array.from({ length: 4 }, () => img({ alt: 'Picture' }))],
    links: []
  });
  ok(ordered[0].occurrences === 4, 'the more widespread finding sorts first');
}

/* ── 1.1 Fix export ───────────────────────────────────────────────── */
group('1.1  Fixes can leave the browser as a patch');

{
  const fix = { fixTitle: 'Add alt text', before: '<img src="h.jpg">', after: '<img src="h.jpg" alt="Team">',
                explanation: 'Screen readers need a description.', effort: 'S', confidence: 0.85 };
  const issue = { ruleId: 'image-alt', wcag: ['1.1.1'], selectors: ['main > img'] };
  const diff = buildFixDiff(fix, issue, 'https://example.com');

  ok(diff.includes('- <img src="h.jpg">'), 'before line marked with -');
  ok(diff.includes('+ <img src="h.jpg" alt="Team">'), 'after line marked with +');
  ok(diff.includes('WCAG 1.1.1'), 'WCAG criterion included');
  ok(diff.includes('main > img'), 'selector names the location');
  ok(!/@@ *-?\d+/.test(diff), 'no invented line numbers — the source location is genuinely unknown');

  const multi = buildFixDiff({ before: '<a>\n <b>x</b>\n</a>', after: '<a a="1">\n <b>x</b>\n</a>' }, issue, null);
  ok(multi.split('\n').filter(l => l.startsWith('- ')).length === 3, 'multi-line before fully prefixed');
  ok(/needs a manual review/.test(buildFixDiff({ fixTitle: 'X' }, issue, null)),
     'a fix with no code says so rather than emitting an empty diff');

  const session = buildSessionExport([{ fix, issue }, { fix, issue }], 'https://example.com', { verified: 2 });
  ok(session.includes('Fixes:     2'), 'session export counts fixes');
  ok(session.includes('2 re-tested and confirmed fixed'), 'verification count is surfaced');
}

/* ── 5.1 Evidence pack ────────────────────────────────────────────── */
group('5.1  Applied and verified are different states');

{
  const analysis = {
    metadata: { url: 'https://example.com/a', scanEngine: 'axe-core', wcagVersion: '2.1', levels: ['A','AA'] },
    counts: { passed: 42 },
    issues: [
      { id: 'i1', ruleId: 'image-alt',     title: 'Images need alt', severity: 'critical', wcag: ['1.1.1'], selectors: ['img'] },
      { id: 'i2', ruleId: 'label',         title: 'Inputs need labels', severity: 'critical', wcag: ['1.3.1'], selectors: ['#e'] },
      { id: 'i3', ruleId: 'color-contrast',title: 'Contrast too low', severity: 'serious',  wcag: ['1.4.3'], selectors: ['p'] }
    ]
  };
  const fixes = {
    i1: { fixTitle: 'Add alt text', source: 'deterministic', confidence: 0.9 },
    i2: { fixTitle: 'Add label', source: 'gemini', confidence: 0.8 }
  };

  const report = buildEvidenceReport({
    pageUrl: 'https://example.com/a',
    analysis, fixes,
    appliedIds: ['i1', 'i2'],   // both patched…
    verifiedIds: ['i1'],        // …but only one confirmed by a re-scan
    judgment: [{ ruleId: 'alt-text-quality', title: 'x', severity: 'serious', wcag: ['1.1.1'], evidence: 'alt="IMG_1.jpg"', occurrences: 3 }],
    generatedAt: Date.UTC(2026, 7, 17, 12, 0)
  });

  ok(report.summary.verified === 1, 'only the re-scanned fix counts as verified');
  ok(report.summary.applied === 1, 'the other is reported as applied but unconfirmed');
  ok(report.summary.outstanding === 1, 'untouched issues are outstanding');
  ok(report.items.find(i => i.ruleId === 'label').statusLabel === 'Fix applied, not re-scanned',
     'an applied-but-unverified fix is never labelled as fixed');
  ok(report.summary.totalFound === 3, 'every found issue is accounted for');
  ok(report.summary.judgmentFindings === 1, 'judgment findings are carried into the record');

  const md = renderEvidenceMarkdown(report);
  ok(md.includes('# Accessibility Remediation Record'), 'renders a titled document');
  ok(md.includes('2026-08-17 12:00 UTC'), 'is dated, which is the point of a record');
  ok(md.includes('https://example.com/a'), 'names the page assessed');
  ok(/roughly a third of WCAG/.test(md), 'states automated coverage limits in the document itself');
  ok(/not a statement of conformance/.test(md),
     'explicitly disclaims being a conformance claim');
  ok(md.includes('Fix applied, not re-scanned'), 'the unverified state is visible to the reader');
  ok(md.includes('confidence 80%'), 'records how confident the generated fix was');
  ok(md.includes('pass') && md.includes('Findings beyond automated checks'),
     'judgment findings are presented as separate from automated failures');

  // Nothing claimed when nothing was done.
  const empty = buildEvidenceReport({ analysis: { issues: [] } });
  ok(empty.summary.totalFound === 0 && empty.summary.verified === 0, 'an empty run claims nothing');
  ok(/roughly a third of WCAG/.test(renderEvidenceMarkdown(empty)),
     'limitations appear even in an empty record');
}

/* ── 5.2 Audit trail ──────────────────────────────────────────────── */
group('5.2  The log records events, and state is derived from them');

{
  const at = Date.UTC(2026, 7, 17, 10, 0);
  const mk = (event, issueId, extra = {}) =>
    makeAuditEntry({ event, issueId, ruleId: issueId, pageUrl: 'https://a.test', at: at + (extra._t || 0), ...extra });

  ok(makeAuditEntry({ event: 'applied' }) === null, 'an entry without an issue is rejected');
  ok(makeAuditEntry({ issueId: 'i1' }) === null, 'an entry without an event is rejected');

  // Apply → verify
  let log = [];
  log = appendEntry(log, mk('applied',  'i1', { source: 'gemini', confidence: 0.8, _t: 0 }));
  log = appendEntry(log, mk('verified', 'i1', { attempts: 2, _t: 1000 }));
  let sum = summarizeAudit(log);
  ok(sum.verifiedIds.includes('i1'), 'an applied-then-verified issue is verified');
  ok(!sum.appliedIds.includes('i1'), 'and is not double-counted as merely applied');

  // The case that matters: verified, then rolled back.
  log = appendEntry(log, mk('undone', 'i1', { _t: 2000 }));
  sum = summarizeAudit(log);
  ok(!sum.verifiedIds.includes('i1'),
     'undoing a verified fix clears verification — it is not on the page any more');
  ok(!sum.appliedIds.includes('i1'), 'and it is no longer counted as applied');
  ok(sum.counts.undone === 1, 'the rollback is counted');

  // A failed verification must not leave a stale verified flag.
  let log2 = appendEntry([], mk('applied', 'i2', { _t: 0 }));
  log2 = appendEntry(log2, mk('verified', 'i2', { _t: 100 }));
  log2 = appendEntry(log2, mk('failed',   'i2', { _t: 200 }));
  ok(!summarizeAudit(log2).verifiedIds.includes('i2'),
     'a later failed re-scan revokes verification');

  // Out-of-order arrival must not change the outcome.
  const shuffled = [mk('undone','i3',{_t:300}), mk('applied','i3',{_t:100}), mk('verified','i3',{_t:200})];
  ok(!summarizeAudit(shuffled).verifiedIds.includes('i3'),
     'entries are ordered by timestamp, not array position');

  // Scoping and bounds.
  const mixed = [mk('applied','i1'), makeAuditEntry({ event:'applied', issueId:'i9', pageUrl:'https://b.test', at })];
  ok(entriesForPage(mixed, 'https://a.test').length === 1, 'entries are scoped per page');

  let big = [];
  for (let i = 0; i < 520; i++) big = appendEntry(big, mk('applied', `x${i}`, { _t: i }));
  ok(big.length === 500, 'the log is bounded');
  ok(big[big.length - 1].issueId === 'x519', 'and keeps the most recent entries');

  const md = renderAuditMarkdown(log);
  ok(/## Change log/.test(md), 'renders a change log section');
  ok(/applied/.test(md) && /undone/.test(md),
     'rolled-back changes remain visible rather than being erased');
  ok(/confidence 80%/.test(md), 'records the confidence behind an automated change');
  ok(renderAuditMarkdown([]) === '', 'an empty log renders nothing rather than an empty heading');
}

/* ── 1.2 Framework-aware output ───────────────────────────────────── */
group('1.2  Fixes are emitted in the detected framework dialect');

{
  ok(detectFramework([{ name: 'React' }]) === 'react', 'React is detected');
  ok(detectFramework([{ name: 'React' }, { name: 'Next.js' }]) === 'next',
     'Next.js wins over React, which it also reports');
  ok(detectFramework([{ name: 'Vue.js' }]) === 'vue', 'Vue is detected');
  ok(detectFramework(['Angular']) === 'angular', 'plain strings work as well as objects');
  ok(detectFramework([]) === 'html', 'no framework falls back to HTML');
  ok(detectFramework(null) === 'html', 'missing tech data does not throw');

  // Attribute spelling
  ok(toJsx('<div class="a b">x</div>') === '<div className="a b">x</div>', 'class becomes className');
  ok(toJsx('<label for="e">E</label>') === '<label htmlFor="e">E</label>', 'for becomes htmlFor');
  ok(toJsx('<input tabindex="0" readonly>').includes('tabIndex="0"'), 'tabindex becomes tabIndex');
  ok(toJsx('<input tabindex="0" readonly>').includes('readOnly'), 'bare boolean attributes are renamed too');

  // The attributes that must NOT be touched
  ok(toJsx('<button aria-label="Close" data-test-id="x"></button>')
       === '<button aria-label="Close" data-test-id="x"></button>',
     'aria-* and data-* are left exactly as they are');

  // Void elements
  ok(toJsx('<img src="a.jpg" alt="A cat">') === '<img src="a.jpg" alt="A cat" />',
     'void elements are self-closed for JSX');
  ok(toJsx('<br>') === '<br />', 'bare void elements too');
  ok(toJsx('<input type="text" />') === '<input type="text" />', 'already-closed tags do not double up');

  // Inline styles
  const styled = toJsx('<p style="color: #000; background-color: #fff">t</p>');
  ok(styled.includes("style={{ color: '#000', backgroundColor: '#fff' }}"),
     'inline style becomes a JSX object with camelCased properties');
  ok(toJsx('<p style="--brand: red">t</p>').includes("'--brand': 'red'"),
     'CSS custom properties keep their exact name and are quoted');

  // A realistic contrast fix, end to end
  const contrast = toJsx('<span class="price" style="color: #1a0a2e; background-color: #e2d4ff">£9</span>');
  ok(contrast.includes('className="price"') && contrast.includes('backgroundColor'),
     'a real contrast fix converts cleanly');

  // formatForFramework behaviour
  const react = formatForFramework('<div class="x"></div>', 'react');
  ok(react.code.includes('className') && react.changed === true, 'react output is converted and flagged as changed');
  ok(/Converted to JSX/.test(react.note), 'and explains what it did');

  const vue = formatForFramework('<div class="x"></div>', 'vue');
  ok(vue.code === '<div class="x"></div>', 'Vue output is left as plain HTML');
  ok(vue.changed === false && /needs no conversion/.test(vue.note),
     'and says so plainly rather than inventing a difference');

  const plain = formatForFramework('<div class="x"></div>', 'html');
  ok(plain.code === '<div class="x"></div>' && plain.note === '', 'plain HTML gets no note');

  const noop = formatForFramework('<section><p>hi</p></section>', 'react');
  ok(noop.changed === false && /No JSX-specific changes/.test(noop.note),
     'a snippet needing no conversion says so instead of claiming credit');
}

/* ── 4.1 Multi-page crawl ─────────────────────────────────────────── */
group('4.1  Discovery, filtering and aggregation');

{
  const urlset = `<urlset><url><loc>https://a.test/</loc></url><url><loc>https://a.test/about</loc></url></urlset>`;
  ok(parseSitemap(urlset).urls.length === 2, 'a urlset yields its locations');
  ok(parseSitemap(urlset).isIndex === false, 'and is not mistaken for an index');

  const index = `<sitemapindex><sitemap><loc>https://a.test/s1.xml</loc></sitemap></sitemapindex>`;
  ok(parseSitemap(index).isIndex === true,
     'a sitemapindex is detected — treating it as a urlset would scan .xml files');
  ok(parseSitemap('').urls.length === 0 && parseSitemap(null).urls.length === 0,
     'empty or missing XML does not throw');

  const filtered = filterCrawlUrls([
    'https://a.test/', 'https://a.test/#top', 'https://a.test/',
    'https://a.test/doc.pdf', 'https://a.test/logo.png',
    'https://evil.test/x', 'javascript:alert(1)', 'https://a.test/about'
  ], { origin: 'https://a.test' });

  ok(!filtered.some(u => u.includes('evil.test')), 'off-origin URLs are refused outright');
  ok(!filtered.some(u => /\.(pdf|png)/.test(u)), 'non-page assets are skipped');
  ok(!filtered.some(u => u.startsWith('javascript:')), 'non-http schemes are skipped');
  ok(filtered.filter(u => u === 'https://a.test/').length === 1,
     'duplicates and fragment-only variants collapse to one');
  ok(filterCrawlUrls(Array.from({length:80},(_,i)=>`https://a.test/p${i}`),
     { origin:'https://a.test', limit:25 }).length === 25, 'the crawl is capped');

  const agg = aggregateCrawl([
    { url:'https://a.test/',      analysis:{ auditScore:90, counts:{critical:1,serious:0,moderate:1,minor:0}, issues:[{ruleId:'image-alt'},{ruleId:'label'}] } },
    { url:'https://a.test/about', analysis:{ auditScore:70, counts:{critical:0,serious:2,moderate:0,minor:0}, issues:[{ruleId:'image-alt'}] } },
    { url:'https://a.test/dead',  error:'Timed out loading page' }
  ]);

  ok(agg.pagesScanned === 2 && agg.pagesFailed === 1, 'scanned and failed pages are counted separately');
  ok(agg.averageScore === 80, 'the average ignores pages that never scanned');
  ok(agg.totals.issues === 3, 'issue totals sum across pages');
  ok(agg.commonRules[0].ruleId === 'image-alt' && agg.commonRules[0].pageCount === 2,
     'a rule failing on several pages surfaces as one systemic fix');
  ok(agg.worstPages[0].url === 'https://a.test/', 'worst pages are ranked by issue count');
  ok(agg.failed[0].error === 'Timed out loading page', 'failures keep their reason');
  ok(aggregateCrawl([]).pagesScanned === 0 && aggregateCrawl(null).pagesFailed === 0,
     'an empty crawl aggregates to nothing rather than throwing');
}

/* ── 3.4 Keyboard and focus ───────────────────────────────────────── */
group('3.4  Focus behaviour axe cannot see');

{
  const el = (o) => ({ selector:'x', tag:'button', tabindex:0, visible:true, focusable:true,
                       focusVisible:true, offscreenOnFocus:false, interactive:false,
                       rect:{x:0,y:0}, ...o });
  const ids = (f) => f.map(x => x.ruleId);

  ok(ids(assessFocusOrder({ elements:[el({focusVisible:false}), el()] })).includes('focus-not-visible'),
     'a control with no visible focus change is flagged');
  ok(!ids(assessFocusOrder({ elements:[el(), el()] })).includes('focus-not-visible'),
     'controls that do show focus are not flagged');
  ok(!ids(assessFocusOrder({ elements:[el({focusVisible:false, visible:false})] })).includes('focus-not-visible'),
     'hidden controls are ignored — they are not reachable anyway');

  ok(ids(assessFocusOrder({ elements:[el({offscreenOnFocus:true})] })).includes('focus-offscreen'),
     'focus landing outside the viewport is flagged');

  const unreachable = assessFocusOrder({ elements:[el({focusable:false, interactive:true, tabindex:-1})] });
  ok(ids(unreachable).includes('interactive-not-focusable'), 'clickable non-focusables are flagged');
  ok(unreachable[0].severity === 'critical', 'and rated critical — the control cannot be used at all');

  // Positive tabindex reorders the whole page.
  const scrambled = assessFocusOrder({ elements:[
    el({selector:'a', tabindex:0, rect:{x:0,y:0}}),   el({selector:'b', tabindex:0, rect:{x:0,y:30}}),
    el({selector:'c', tabindex:0, rect:{x:0,y:60}}),  el({selector:'d', tabindex:0, rect:{x:0,y:90}}),
    el({selector:'e', tabindex:5, rect:{x:0,y:120}}), el({selector:'f', tabindex:9, rect:{x:0,y:150}})
  ]});
  ok(ids(scrambled).includes('focus-order-mismatch'), 'a scrambled tab order is detected');
  ok(/positive tabindex/.test(scrambled.find(f=>f.ruleId==='focus-order-mismatch').evidence),
     'and names positive tabindex as the cause when that is why');

  const natural = assessFocusOrder({ elements:[
    el({rect:{x:0,y:0}}), el({rect:{x:0,y:30}}), el({rect:{x:0,y:60}}), el({rect:{x:0,y:90}})
  ]});
  ok(!ids(natural).includes('focus-order-mismatch'), 'a page in natural order is not flagged');

  ok(ids(assessFocusOrder({ elements:[el()], modal:{open:true, backgroundFocusable:7, selector:'#m'} }))
       .includes('modal-focus-escape'), 'a dialog leaving the page behind focusable is flagged');
  ok(!ids(assessFocusOrder({ elements:[el()], modal:{open:true, backgroundFocusable:0} }))
       .includes('modal-focus-escape'), 'a properly trapped dialog is not');

  ok(assessFocusOrder({}).length === 0 && assessFocusOrder({elements:[]}).length === 0,
     'an empty profile produces nothing rather than throwing');
  ok(assessFocusOrder({ elements:[el({focusable:false, interactive:true})] })[0].passedAutomated === true,
     'findings are marked as passing the automated audit');
}

/* ── 3.7 Screen reader preview ────────────────────────────────────── */
group('3.7  What the page sounds like');

{
  ok(formatAnnouncement({ name:'Submit', role:'button' }) === 'Submit, button',
     'name then role, the way a screen reader says it');
  ok(formatAnnouncement({ name:'Email', role:'textbox', states:['required'] }) === 'Email, edit text, required',
     'states follow the role');
  ok(formatAnnouncement({ name:'', role:'button' }) === 'button',
     'an unnamed control announces only its type — which is the point');
  ok(formatAnnouncement({ name:'Pricing', role:'heading', level:2 }) === 'Pricing, heading level 2',
     'heading level is spoken');
  ok(formatAnnouncement({}) === '(nothing announced)', 'nothing to say is stated explicitly');

  const lines = buildTranscript([
    { selector:'a', name:'Home', role:'link' },
    { selector:'b', name:'', role:'button' }
  ]);
  ok(lines[1].unnamed === true && lines[0].unnamed === false, 'unnamed controls are marked');

  const unnamedFindings = assessTranscript([
    { selector:'b1', name:'', role:'button' },
    { selector:'b2', name:'', role:'button' }
  ]);
  ok(unnamedFindings.some(f => f.ruleId === 'announced-without-name'), 'unnamed controls are reported');
  ok(unnamedFindings[0].severity === 'critical', 'and rated critical');

  // The sequence problem — each valid alone, unusable together.
  const runFindings = assessTranscript([
    { selector:'1', name:'Read more', role:'link' },
    { selector:'2', name:'Read more', role:'link' },
    { selector:'3', name:'Read more', role:'link' }
  ]);
  const run = runFindings.find(f => f.ruleId === 'indistinguishable-announcements');
  ok(!!run, 'three identical announcements in a row are flagged');
  ok(run.occurrences === 3 && /all announce as/.test(run.evidence), 'the finding names how many and what');

  ok(!assessTranscript([
    { selector:'1', name:'Read more', role:'link' },
    { selector:'2', name:'Pricing', role:'link' },
    { selector:'3', name:'Read more', role:'link' }
  ]).some(f => f.ruleId === 'indistinguishable-announcements'),
     'identical names that are not consecutive are not a sequence problem');

  ok(assessTranscript([]).length === 0, 'an empty page produces no findings');

  const md = renderTranscriptMarkdown(lines, 'https://a.test');
  ok(md.includes('Home, link') && md.includes('button'), 'the transcript renders the announcements');
  ok(/varies by screen reader/.test(md),
     'and states that it is an approximation rather than literal output');
}

/* ── 3.1 remainder: headings, form errors, LLM nuance ────────────────── */
group('3.1  Heading text quality — the last deterministic gap');

{
  const h = (o) => ({ selector:'h', text:'', level:2, html:'<h2></h2>', ...o });

  ok(assessHeadingText(h({text:'Overview'})), '"Overview" names nothing about the section');
  ok(assessHeadingText(h({text:'Section 3'})), '"Section 3" is a placeholder pattern, not a description');
  ok(!assessHeadingText(h({text:'Shipping rates by region'})), 'a genuinely specific heading is left alone');
  ok(!assessHeadingText(h({text:''})), 'an empty heading is axe\'s job, not ours');

  const dup = assessDuplicateHeadingText([
    h({selector:'a', text:'Details'}), h({selector:'b', text:'Details'}), h({selector:'c', text:'Details'})
  ]);
  ok(dup.length === 1 && dup[0].selectors.length === 3, 'three sections sharing one heading collapse into one finding');
  ok(assessDuplicateHeadingText([h({text:'FAQ'}), h({text:'FAQ'})]).length === 0,
     'two sections sharing a name is common and not flagged — only three or more');
}

group('3.1  Form error message quality');

{
  const f = (o) => ({ selector:'#e', errorText:'', html:'<input>', ...o });

  ok(assessErrorText(f({errorText:'Invalid input'})), '"Invalid input" is correctly wired but says nothing');
  ok(assessErrorText(f({errorText:'Error'})), 'a bare "Error" is flagged');
  ok(!assessErrorText(f({errorText:'Enter a valid email address, e.g. name@example.com'})),
     'an error that actually explains the fix is left alone');
  ok(!assessErrorText(f({errorText:''})), 'no error text at all produces nothing');
}

group('3.1  Headings and errors reach the same panel as everything else');

{
  const out = assessCandidates({
    images: [], links: [],
    headings: [{selector:'h1', text:'Overview', level:2, html:'<h2>Overview</h2>'}],
    errorFields: [{selector:'#e', errorText:'Invalid', html:'<input>'}]
  });
  ok(out.some(f => f.ruleId === 'heading-text-quality'), 'heading findings flow through assessCandidates');
  ok(out.some(f => f.ruleId === 'error-text-quality'), 'error findings flow through assessCandidates');
  ok(out.every(f => f.passedAutomated === true), 'both are marked as passing the automated audit');
  ok(assessCandidates({}).length === 0, 'a payload missing the new fields entirely does not throw');
}

group('3.1  LLM nuance pass — the last stated gap in the judgment layer');

{
  const payload = {
    images: [{selector:'img', alt:'A dog', src:'/a.jpg'}],
    links: [{selector:'a', text:'Home', href:'/'}],
    headings: [{selector:'h1', text:'Getting Started', level:1}]
  };

  ok(/do not repeat any of that/.test(buildPrompt(payload)),
     'the prompt explicitly tells the model not to re-report what the heuristics already catch');
  ok(/false positive here[\s\S]*costs more/i.test(buildPrompt(payload)),
     'the prompt asks for restraint, consistent with the whole judgment layer\'s discipline');

  let seenSchema = null;
  const fakeCall = async (prompt, schema) => {
    seenSchema = schema;
    return { findings: [{ selector:'img', kind:'image', title:'Alt text does not match the image',
      severity:'serious', evidence:'alt="A dog", but the image shows a cat',
      description:'d', suggestedFix:'f' }] };
  };

  const out = await runJudgmentNuancePass(fakeCall, payload);
  ok(!!seenSchema, 'the pass calls the injected provider with a schema, not a bare prompt');
  ok(out.length === 1 && out[0].ruleId === 'judgment-nuance', 'a valid finding is normalized correctly');
  ok(out[0].wcag.includes('1.1.1'), 'the WCAG citation is derived from the finding kind');
  ok(out[0].passedAutomated === true, 'nuance findings are marked the same way as every other judgment finding');

  const malformed = await runJudgmentNuancePass(async () => ({ findings: [{severity:'high'}] }), payload);
  ok(malformed.length === 0, 'a finding missing a selector or title is discarded, not shown as a blank card');

  const empty = await runJudgmentNuancePass(async () => null, payload);
  ok(empty.length === 0, 'a malformed provider response yields no findings rather than throwing');
}

/* ── 4.2 Ambient background scanning ──────────────────────────────── */
group('4.2  Ambient scanning only ever touches pages already opted into');

{
  const hist = (url, score, critical, ts) => ({ url, score, counts: { critical }, timestamp: ts });

  ok(findBaseline([], 'https://a.test/') === null, 'no history means no baseline');
  const history = [hist('https://a.test/', 90, 0, 1000), hist('https://a.test/', 85, 0, 2000)];
  ok(findBaseline(history, 'https://a.test/').timestamp === 2000, 'the most recent entry for the URL is the baseline');

  const past = 0, farEnough = 700000, tooSoon = 5000;   // cooldown is 600000ms
  ok(shouldAmbientScan('https://a.test/', history, true, past, farEnough) === true,
     'a previously-scanned URL, enabled, cooldown elapsed → allowed');
  ok(shouldAmbientScan('https://never-scanned.test/', history, true, past, farEnough) === false,
     'a URL with no baseline is never ambient-scanned, regardless of the setting');
  ok(shouldAmbientScan('https://a.test/', history, false, past, farEnough) === false,
     'the feature being off blocks everything, even a page with a baseline');
  ok(shouldAmbientScan('https://a.test/', history, true, past, tooSoon) === false,
     'still inside the cooldown window is blocked');

  ok(detectRegression(null, {}).regressed === false, 'no baseline means nothing to compare, not a false alarm');
  ok(detectRegression({ score: 90, counts: { critical: 0 } }, { auditScore: 92, counts: { critical: 0 } }).regressed === false,
     'an improvement is never reported — this only ever speaks up about regressions');
  ok(detectRegression({ score: 90, counts: { critical: 0 } }, { auditScore: 88, counts: { critical: 0 } }).regressed === false,
     'a small wobble below the threshold is not a regression');

  const worse = detectRegression({ score: 90, counts: { critical: 0 } }, { auditScore: 78, counts: { critical: 2 } });
  ok(worse.regressed === true, 'a real score drop with new criticals is flagged');
  ok(/2 new critical/.test(worse.message) && /12 points/.test(worse.message),
     'the message states both what got worse, in concrete numbers');
}

/* ── 4.3 Natural language control ─────────────────────────────────── */
group('4.3  Chat instruction becomes a bounded filter, never a free action');

{
  const issues = [
    { id:'i1', ruleId:'image-alt', severity:'critical' },
    { id:'i2', ruleId:'color-contrast', severity:'serious' },
    { id:'i3', ruleId:'label', severity:'critical' },
    { id:'i4', ruleId:'heading-order', severity:'minor' }
  ];

  ok(/image-alt/.test(buildChatPrompt('fix critical issues', issues)),
     'the prompt lists the real rule ids so the model cannot invent one');

  // "fix everything critical but don't touch colors"
  const plan1 = applyChatPlan(issues, { action:'apply', severities:['critical'], includeRuleIds:[], excludeRuleIds:['color-contrast'] });
  ok(plan1.map(i=>i.id).sort().join() === 'i1,i3', 'severity + exclusion combine correctly');
  ok(!plan1.some(i => i.ruleId === 'color-contrast'), 'the excluded rule never appears even if it were also critical');

  // include list overrides severity when the model names specific rules
  const plan2 = applyChatPlan(issues, { action:'list', severities:['critical'], includeRuleIds:['heading-order'], excludeRuleIds:[] });
  ok(plan2.length === 1 && plan2[0].ruleId === 'heading-order',
     'an explicit include list is honored even though that rule is not the requested severity');

  ok(applyChatPlan(issues, null).length === 0, 'a null plan matches nothing rather than everything');
  ok(applyChatPlan(issues, {}).length === 0, 'an empty plan matches nothing — never fall back to "all issues"');

  // Malformed model output must be recoverable, not a crash.
  const safe = await interpretChatCommand(async () => null, 'fix stuff', issues);
  ok(safe.action === 'list' && safe.severities.length === 4,
     'a null/garbage model response degrades to a safe no-op default: list everything, apply nothing');
  ok(Array.isArray(safe.excludeRuleIds) && safe.excludeRuleIds.length === 0,
     'malformed exclude/include arrays default to empty, never undefined');

  let capturedSchema = null;
  const shaped = await interpretChatCommand(async (prompt, schema) => {
    capturedSchema = schema;
    return { action:'apply', severities:['critical','serious'], includeRuleIds:[], excludeRuleIds:['color-contrast'], summary:'ok' };
  }, 'fix everything critical and serious, skip colors', issues);
  ok(!!capturedSchema, 'interpretation goes through the schema-constrained call, same discipline as every other model call');
  ok(shaped.excludeRuleIds.includes('color-contrast'), 'a well-formed response passes through correctly');
}

/* ── 4.4 Historical trend ─────────────────────────────────────────── */
group('4.4  Score history becomes a per-page arc');

{
  const h = [
    { url:'https://a.test/', score:70, timestamp:1000 },
    { url:'https://b.test/', score:99, timestamp:1500 },
    { url:'https://a.test/', score:80, timestamp:2000 },
    { url:'https://a.test/', score:90, timestamp:3000 }
  ];

  const trend = buildUrlTrend(h, 'https://a.test/');
  ok(trend.count === 3, 'only entries for the requested URL are counted');
  ok(trend.entries[0].timestamp === 1000, 'entries are ordered oldest first');
  ok(trend.delta === 20 && trend.direction === 'up', 'delta is measured from first scan to latest, not scan-to-scan');

  ok(buildUrlTrend([], 'https://x.test/').direction === 'flat', 'no history at all is reported as flat, not a crash');
  ok(buildUrlTrend([h[0]], 'https://a.test/').count === 1, 'a single scan has nothing to trend yet');

  const flat = buildUrlTrend([{url:'https://c.test/',score:90,timestamp:1},{url:'https://c.test/',score:91,timestamp:2}], 'https://c.test/');
  ok(flat.direction === 'flat', 'a one-point wobble is reported as flat rather than as an improvement worth announcing');

  ok(directionSymbol('up') === '↑' && directionSymbol('down') === '↓' && directionSymbol('flat') === '→',
     'each direction has a distinct symbol');

  const points = buildSparklinePoints([50, 90, 70], 80, 20);
  ok(points.split(' ').length === 3, 'one point per score');
  ok(buildSparklinePoints([], 80, 20) === '', 'no scores produces no points rather than throwing');
  ok(buildSparklinePoints([75], 80, 20).split(' ').length === 2, 'a single score still renders as a flat two-point line');
}

/* ── 5.3 VPAT / ACR draft ─────────────────────────────────────────── */
group('5.3  A VPAT draft never claims "Supports"');

{
  const issues = [
    { id:'i1', ruleId:'image-alt', wcag:['1.1.1'], title:'Images need alt' },
    { id:'i2', ruleId:'color-contrast', wcag:['1.4.3'], title:'Low contrast' }
  ];
  const draft = buildVpatDraft({ axeIssues: issues, verifiedIds: [] });

  ok(draft.rows.every(r => r.status !== 'Supports'),
     'no row ever claims full "Supports" — that is the entire point of this module');
  ok(draft.rows.find(r => r.id === '1.1.1').status === 'Does Not Support',
     'a criterion with an unresolved violation is marked Does Not Support');
  ok(/Images need alt/.test(draft.rows.find(r => r.id === '1.1.1').remarks),
     'the remark cites the actual finding, not a generic sentence');

  const fixed = buildVpatDraft({ axeIssues: issues, verifiedIds: ['i1'] });
  ok(fixed.rows.find(r => r.id === '1.1.1').status === 'Partially Supports',
     'a verified fix upgrades the row, but only to Partially — never to full Supports');
  ok(fixed.rows.find(r => r.id === '1.4.3').status === 'Does Not Support',
     'an unrelated unresolved criterion is unaffected by a different criterion being fixed');

  const untouched = buildVpatDraft({ axeIssues: [], verifiedIds: [] });
  ok(untouched.rows.every(r => r.status === 'Not Evaluated'),
     'a criterion this scan never touched is Not Evaluated, not assumed passing');

  // A finding that is unresolved anywhere must win over a verified reference
  // elsewhere to the same criterion — one open violation is what matters.
  const mixed = buildVpatDraft({
    axeIssues: [{ id:'a', ruleId:'x', wcag:['2.4.7'] }, { id:'b', ruleId:'y', wcag:['2.4.7'] }],
    verifiedIds: ['a']
  });
  ok(mixed.rows.find(r => r.id === '2.4.7').status === 'Does Not Support',
     'one unresolved reference to a criterion outweighs another that was fixed');

  ok(WCAG_SC_CATALOG.every(sc => /^\d\.\d\.\d$/.test(sc.id)), 'every catalog entry is a real SC number');

  const md = renderVpatMarkdown(draft);
  ok(/machine-generated draft, not a submittable VPAT/.test(md), 'the draft explicitly disclaims being submittable');
  ok(/"Supports" is never used/.test(md), 'the methodology note states the never-Supports rule outright');
}

/* ── 5.4 Business-risk translation ────────────────────────────────── */
group('5.4  Risk copy reuses corrected facts and never fabricates a percentage');

{
  ok(severityLevel({ critical: 1 }) === 'high', 'any critical issue is high risk');
  ok(severityLevel({ serious: 1 }) === 'medium', 'a serious issue with no critical is medium');
  ok(severityLevel({ moderate: 4 }) === 'medium', 'enough moderate issues alone reach medium');
  ok(severityLevel({}) === 'low', 'nothing found is low risk');

  const risk = assessRisk({ critical: 2, serious: 3, moderate: 1, minor: 0 });
  ok(risk.level === 'high', 'counts with a critical roll up to high overall');
  ok(risk.counts.total === 6, 'the total is the sum of all four severities');

  const md = renderRiskMarkdown(risk);
  ok(!/~?\d+% of visitors/.test(md), 'no percentage of this site\'s visitors is ever stated — that was the exact bug 0.6 removed');
  ok(/\$75,000/.test(md) && /\$150,000/.test(md), 'the corrected DOJ penalty figures are reused, not re-derived');
  ok(/4,600/.test(md), 'the lawsuit count figure is reused with its source');
  ok(/CDC/.test(md) && /American Institutes for Research/.test(md), 'external figures are attributed to their source');
  ok(/does not have access to/.test(md), 'the module states plainly that it cannot know this site\'s actual traffic impact');

  const clean = assessRisk({});
  ok(/not a conformance statement/.test(renderRiskMarkdown(clean)),
     'a clean scan still avoids implying full conformance');
}

/* ── 6.3 Public score badge ───────────────────────────────────────── */
group('6.3  Badge is self-contained and honest about staleness');

{
  const svg = buildBadgeSvg({ score: 91, scannedAt: Date.UTC(2026, 0, 15) });
  ok(svg.includes('<svg') && svg.includes('</svg>'), 'produces a well-formed SVG');
  ok(svg.includes('>91<'), 'the score is a real text node, not baked into a raster image');
  ok(svg.includes('2026-01-15'), 'the scan date is printed on the badge itself');
  const withoutNamespace = svg.replace('http://www.w3.org/2000/svg', '');
  ok(!/https?:\/\//.test(withoutNamespace),
     'no external font or resource references beyond the required xmlns namespace URI — fully self-contained');

  ok(gradeColor(95) !== gradeColor(50), 'a high and low score render in visibly different colors');
  ok(buildBadgeSvg({ score: 150 }).includes('>100<'), 'an out-of-range score is clamped rather than rendered raw');
  ok(buildBadgeSvg({ score: -10 }).includes('>0<'), 'clamped on the low end too');

  const realSvg = buildBadgeSvg({ score: 88, scannedAt: Date.UTC(2026,0,15) });
  const embed = buildBadgeEmbed({ score: 88, scannedAt: Date.UTC(2026,0,15), pageUrl: 'https://example.com', svg: realSvg });
  ok(/point-in-time scan, not a live/.test(embed),
     'the embed explicitly disclaims being a live/verified feed — there is no backend to keep it current');
  ok(/Re-scan and replace/.test(embed), 'tells the user how to keep it accurate rather than implying it updates itself');

  // Regression coverage for a real bug found in the phase-completion audit: the
  // embed used to contain a literal, never-substituted "PLACEHOLDER" token in
  // the image src, so the copy-pasted badge silently failed to render.
  ok(!/PLACEHOLDER/.test(embed), 'the embed never contains an unsubstituted placeholder token');
  const srcMatch = embed.match(/!\[[^\]]*\]\((data:image\/svg\+xml;base64,[^)]+)\)/);
  ok(!!srcMatch, 'the embed contains a real markdown image reference');
  ok(atob(srcMatch[1].split(',')[1]).includes('<svg'),
     'decoding the embedded data URI yields the actual SVG — a real, working image, not a stand-in');
  ok(buildBadgeEmbed({ score: 50 }).includes('![Accessibility score: 50](())') === false &&
     !/base64,\)/.test(buildBadgeEmbed({ score: 50 })),
     'calling without an svg does not silently produce a broken empty data URI either');
}

/* ── 6.4 Token cost meter ──────────────────────────────────────────── */
group('6.4  Cost estimates are labeled as estimates, never exact');

{
  ok(estimateTokens('') === 0, 'empty text is zero tokens');
  ok(estimateTokens('x'.repeat(400)) === 100, 'the chars/4 approximation is applied consistently');

  const cost = estimateCallCost('gemini', 4000, 1000);
  ok(cost > 0, 'a real call produces a nonzero estimate');
  ok(estimateCallCost('not-a-real-provider', 1000, 1000) === 0,
     'an unknown provider costs nothing rather than throwing — this must never be able to break a fix');

  ok(PRICING.anthropic.output > PRICING.gemini.output, 'relative provider pricing is at least directionally sane');

  ok(formatUSD(0.001) === '<$0.01', 'a cost too small to show meaningfully reads as a bound, not a misleading $0.00');
  ok(formatUSD(1.5) === '$1.50', 'a real amount is formatted as currency');

  let totals = { total: 0, calls: 0, byProvider: {} };
  totals = addUsage(totals, 'gemini', 0.02);
  totals = addUsage(totals, 'openai', 0.05);
  totals = addUsage(totals, 'gemini', 0.01);
  ok(Math.abs(totals.total - 0.08) < 1e-9, 'running total accumulates across calls');
  ok(totals.calls === 3, 'call count accumulates');
  ok(Math.abs(totals.byProvider.gemini - 0.03) < 1e-9, 'per-provider totals are kept separately');
}

/* ── 6.1 White-label branding ─────────────────────────────────────── */
group('6.1  Branding is additive and markdown-safe');

{
  ok(applyBranding('# Report\nbody', null) === '# Report\nbody',
     'with no active profile, the document is returned completely unchanged');

  const profile = makeProfile({ name: 'Northgate Agency', contact: 'ops@northgate.test' });
  ok(profile.id && profile.name === 'Northgate Agency', 'a profile gets a stable id and keeps the name');
  ok(profile.color === '#8b5cf6', 'an omitted color falls back to a sane default');
  ok(makeProfile({ name: 'x', color: 'not-a-color' }).color === '#8b5cf6', 'an invalid color is rejected, not passed through raw');

  const branded = applyBranding('# Report\nbody', profile);
  ok(branded.startsWith('# Northgate Agency'), 'the branded header leads the document');
  ok(branded.includes('# Report\nbody'), 'the original document content is preserved intact underneath it');
  ok(branded.includes('ops@northgate.test'), 'the contact line is included when supplied');

  const evil = makeProfile({ name: 'Evil | # Corp *`_' });
  const headerLine = applyBranding('x', evil).split('\n')[0].replace(/^#\s/, '');
  ok(!/[|#*_`]/.test(headerLine),
     'markdown-breaking characters in a client name are stripped before they can corrupt the document structure');
}

/* ── 6.2 Team sync ─────────────────────────────────────────────────── */
group('6.2  Team sync stays additive, deduped, and metadata-only');

{
  const bundle = buildTeamBundle({
    auditLog: [{ issueId: 'i1', event: 'verified', at: 100 }],
    scanHistory: [{ url: 'https://a.test/', score: 90, timestamp: 200 }]
  });
  ok(bundle.version === 1, 'the bundle is versioned for forward compatibility');
  ok(!('settings' in bundle) && !JSON.stringify(bundle).includes('apiKey'),
     'the bundle structurally cannot carry settings or API keys — there is no field for them');

  const merged = importTeamBundle(bundle, { auditLog: [], scanHistory: [] });
  ok(merged.added.auditLog === 1 && merged.added.scanHistory === 1, 'importing into empty local data adds everything');

  // Re-importing the identical bundle must add nothing — the whole point of dedup.
  const reImported = importTeamBundle(bundle, merged);
  ok(reImported.added.auditLog === 0 && reImported.added.scanHistory === 0,
     'importing the same bundle twice adds nothing the second time');
  ok(reImported.auditLog.length === 1 && reImported.scanHistory.length === 1,
     'existing local entries are never duplicated or dropped');

  // A second, genuinely different bundle should merge cleanly alongside the first.
  const bundle2 = buildTeamBundle({
    auditLog: [{ issueId: 'i2', event: 'applied', at: 300 }],
    scanHistory: []
  });
  const merged2 = importTeamBundle(bundle2, merged);
  ok(merged2.auditLog.length === 2, 'a genuinely new entry from a second import is added alongside the first');

  ok(importTeamBundle(null, { auditLog: [{issueId:'x'}], scanHistory: [] }).auditLog.length === 1,
     'a malformed/null import file does not wipe out existing local data');
  ok(importTeamBundle({ auditLog: 'not-an-array' }, { auditLog: [], scanHistory: [] }).auditLog.length === 0,
     'a bundle with a malformed field is treated as empty for that field rather than throwing');
}

/* ── 6.5 GitHub pull request generation ───────────────────────────── */
group('6.5  PR content never claims a blind file edit');

{
  const entries = [
    { issue: { id:'i1', ruleId:'image-alt', wcag:['1.1.1'] }, fix:{ confidence:0.9 }, verified:true },
    { issue: { id:'i2', ruleId:'color-contrast', wcag:['1.4.3'] }, fix:{ confidence:0.6 }, verified:false }
  ];

  const { title, body } = GitHub.buildPrSummary(entries, 'https://example.com/pricing');
  ok(/2 issues/.test(title) && /example\.com/.test(title), 'the title states the real count and the scanned host');
  ok(/does not rewrite files.*automatically/s.test(body),
     'the PR body states outright that this does not blindly edit the repo — the whole point of the scoping decision');
  ok(/1 re-scanned and confirmed/.test(body), 'verified vs unverified counts are both stated, honestly');
  ok(/image-alt/.test(body) && /90%/.test(body), 'the per-fix table cites the real rule and confidence');
  ok(GitHub.buildPrSummary([], '').title.includes('0 issues'), 'an empty entry list produces an honest zero, not a crash');
}

group('6.5  The actual GitHub API call sequence');

{
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), method: opts?.method || 'GET', body: opts?.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('/git/ref/heads/')) return { ok:true, status:200, json: async () => ({ object: { sha: 'base-sha' } }) };
    if (String(url).includes('/git/refs'))        return { ok:true, status:201, json: async () => ({}) };
    if (String(url).includes('/contents/'))       return { ok:true, status:201, json: async () => ({}) };
    if (String(url).includes('/pulls'))           return { ok:true, status:201, json: async () => ({ html_url:'https://github.com/o/r/pull/9', number:9 }) };
    return { ok:false, status:404, text: async () => 'not found' };
  };

  const result = await GitHub.createAccessibilityPr({
    token:'ghp_x', owner:'o', repo:'r', baseBranch:'main',
    entries: [{ issue:{ruleId:'x'}, fix:{}, verified:false }],
    pageUrl:'https://x.test', patchContent:'diff content'
  });

  ok(result.number === 9 && result.url.includes('/pull/9'), 'the returned PR number and URL come from the real API response');
  ok(calls.length === 4, `exactly one call per step — get base ref, create branch, commit file, open PR (got ${calls.length})`);
  ok(calls[0].url.includes('/git/ref/heads/main'), 'step 1 reads the base branch ref');
  ok(calls[1].method === 'POST' && calls[1].body.sha === 'base-sha',
     'step 2 creates the new branch FROM the base sha just read, not a stale or guessed one');
  ok(calls[2].url.includes('/contents/') && atob(calls[2].body.content).includes('diff content'),
     'step 3 commits the actual patch content — base64-decoded, it is verbatim what was passed in');
  ok(calls[3].body.head && calls[3].body.base === 'main', 'step 4 opens the PR from the new branch against the requested base');

  let rejected = null;
  try { await GitHub.createAccessibilityPr({ owner:'o', repo:'r' }); } catch (e) { rejected = e; }
  ok(rejected && /token.*required/i.test(rejected.message), 'missing credentials fail fast with a clear message, before any network call');

  globalThis.fetch = async () => ({ ok:false, status:403, text: async () => 'Bad credentials' });
  let apiErr = null;
  try { await GitHub.createAccessibilityPr({ token:'bad', owner:'o', repo:'r', entries:[], patchContent:'' }); }
  catch (e) { apiErr = e; }
  ok(apiErr && /403/.test(apiErr.message), 'a real GitHub API error surfaces with its status code rather than being swallowed');
}

/* ── 3.5 Reading-order mismatch ───────────────────────────────────── */
group('3.5  Reading order vs visual order');

{
  const el = (o) => ({ selector:'x', tag:'p', rect:{x:0,y:0}, cssOrder:0, ...o });

  const explicit = assessReadingOrder([el({selector:'a', cssOrder:3}), el({selector:'b'}), el({selector:'c'})]);
  ok(explicit.some(f => f.ruleId === 'explicit-visual-reorder'),
     'an element with a non-zero CSS order is flagged directly — no heuristic needed');
  ok(/order: 3/.test(explicit.find(f=>f.ruleId==='explicit-visual-reorder').evidence),
     'the evidence cites the actual order value');
  ok(!assessReadingOrder([el(), el(), el()]).some(f => f.ruleId === 'explicit-visual-reorder'),
     'elements with no CSS order set are not flagged by the mechanical check');

  // Natural top-to-bottom order: DOM index already matches visual position.
  const natural = Array.from({length:6}, (_,i) => el({selector:`n${i}`, rect:{x:0,y:i*30}}));
  ok(!assessReadingOrder(natural).some(f => f.ruleId === 'reading-order-mismatch'),
     'a page read in natural top-to-bottom order is not flagged');

  // Scrambled: DOM order and visual (row) order disagree throughout.
  const scrambled = [
    el({selector:'a', rect:{x:0,y:150}}), el({selector:'b', rect:{x:0,y:0}}),
    el({selector:'c', rect:{x:0,y:120}}), el({selector:'d', rect:{x:0,y:30}}),
    el({selector:'e', rect:{x:0,y:90}}),  el({selector:'f', rect:{x:0,y:60}})
  ];
  ok(assessReadingOrder(scrambled).some(f => f.ruleId === 'reading-order-mismatch'),
     'DOM order diverging heavily from visual position is flagged even with no explicit CSS order');

  ok(assessReadingOrder([]).length === 0, 'an empty profile produces nothing');
  ok(assessReadingOrder([el(),el()]).length === 0, 'too few elements to judge a pattern produces no heuristic finding');
}

/* ── 3.8 Impairment simulation ────────────────────────────────────── */
group('3.8  Simulation presets and page application');

{
  ok(presetList().length === Object.keys(PRESETS).length, 'every preset is listed');
  ok(presetList().every(p => p.key && p.label && p.filter), 'each preset carries a key, label and CSS filter');
  ok(Object.values(COLOR_MATRICES).every(m => m.split(/[\s,]+/).filter(Boolean).length === 20),
     'every color-blindness matrix has the 20 values a feColorMatrix requires');

  const svg = buildSvgDefs();
  for (const name of Object.keys(COLOR_MATRICES)) {
    ok(svg.includes(`id="sitescope-${name}"`), `SVG defs include a filter for ${name}`);
  }
  ok(svg.includes('aria-hidden="true"'), 'the injected defs are hidden from assistive tech — they are plumbing, not content');

  ok(PRESETS.protanopia.filter === 'url(#sitescope-protanopia)', 'color presets reference their SVG filter by id');
  ok(/blur/.test(PRESETS.lowVision.filter), 'low vision uses a CSS blur rather than an SVG filter');

  ok(applyImpairment(null, PRESETS, null).active === null, 'passing no key clears the effect');
  ok(applyImpairment('nonexistent', PRESETS, null).active === null, 'an unknown key is treated as no effect, not a throw');
}

/* ── 3.2 / 3.3 Vision analysis ────────────────────────────────────── */
group('3.2  Vision request shaping — image reaches every provider correctly');

{
  const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const dataUrl = `data:image/png;base64,${png1x1}`;

  const stripped = Vision.stripDataUrlPrefix(dataUrl);
  ok(stripped.base64 === png1x1 && stripped.mime === 'image/png', 'the data URL is split into mime and base64 correctly');
  ok(Vision.stripDataUrlPrefix('').base64 === '', 'a missing data URL does not throw');

  ok(Vision.imagePart('gemini', png1x1).inlineData?.data === png1x1, 'gemini gets inlineData');
  ok(Vision.imagePart('anthropic', png1x1).source?.data === png1x1, 'anthropic gets a base64 image source');
  ok(Vision.imagePart('openai', png1x1).image_url?.url.startsWith('data:image/png;base64,'),
     'openai gets a data-url image_url');
  ok(Vision.imagePart('mistral', png1x1).image_url?.url.includes(png1x1), 'mistral shares the same image_url shape as openai');

  let sent = {};
  const respond = (o) => ({ ok:true, status:200, json: async () => o, text: async () => JSON.stringify(o) });
  globalThis.fetch = async (url, init) => {
    sent = { url: String(url), body: JSON.parse(init.body) };
    if (String(url).includes('googleapis'))
      return respond({ candidates: [{ content: { parts: [{ text: '{"findings":[{"title":"Low contrast text over photo","severity":"serious","wcag":["1.4.3"],"evidence":"e","description":"d","suggestedFix":"f"}]}' }] } }] });
    if (String(url).includes('anthropic'))
      return respond({ content: [{ type:'tool_use', input: { findings: [] } }] });
    return respond({ choices: [{ message: { content: '{"findings":[]}' } }] });
  };

  const gem = await Vision.analyzeScreenshot('gemini', '', 'K', dataUrl);
  ok(gem.length === 1 && gem[0].category === 'vision', 'a vision finding is normalized into the shared finding shape');
  ok(gem[0].passedAutomated === true, 'vision findings are marked as passing the automated audit, same as judgment findings');
  ok(gem[0].ruleId.startsWith('vision-'), 'vision findings get a stable, readable rule id');
  ok(!!sent.body.generationConfig?.responseSchema, 'gemini vision call is schema-constrained, same discipline as text fixes');

  for (const p of ['openai','anthropic','mistral']) {
    const out = await Vision.callVisionProvider(p, '', 'K', dataUrl, 'prompt', Vision.VISION_SCHEMA);
    ok(Array.isArray(out.findings), `${p}: vision call round-trips without throwing`);
  }

  // 3.3 — alt text from the image itself
  globalThis.fetch = async () => respond({ candidates: [{ content: { parts: [{ text: '{"altText":"A red touring bicycle leaning against a brick wall"}' }] } }] });
  const alt = await Vision.describeImageFromVision('gemini', '', 'K', dataUrl);
  ok(alt === 'A red touring bicycle leaning against a brick wall',
     'alt text is generated from the actual pixels, not a filename');

  globalThis.fetch = async () => respond({ candidates: [{ content: { parts: [{ text: '{}' }] } }] });
  ok(await Vision.describeImageFromVision('gemini','','K',dataUrl) === null,
     'a response with no altText resolves to null rather than an empty string being treated as real content');

  ok(Vision.normalizeVisionFindings(null).length === 0, 'a malformed/empty vision response yields no findings, not a throw');
  ok(Vision.normalizeVisionFindings({ findings:[{severity:'serious'}] }).length === 0,
     'a finding with no title is discarded rather than shown as a blank card');
}

/* ── Summary ──────────────────────────────────────────────────────── */
console.log(
  failures
    ? `\n\x1b[31m${failures} of ${count} checks failed\x1b[0m\n`
    : `\n\x1b[32mAll ${count} checks passed\x1b[0m\n`
);
process.exit(failures ? 1 : 0);
