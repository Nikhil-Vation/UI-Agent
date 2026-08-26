/**
 * LLM nuance pass over the deterministic judgment layer.
 *
 * The heuristics in judgment.js are precise but literal — a fixed vocabulary of
 * vague phrases, filename patterns, generic words. They catch the common cases
 * on purpose, at zero cost and with zero false positives, and say nothing about
 * anything outside that vocabulary. This pass asks a model to look at what the
 * heuristics let through and flag genuinely ambiguous cases they cannot: alt
 * text that is grammatically fine but misleading, a heading that is specific-
 * sounding but unrelated to what follows it, phrasing a native heuristic list
 * was never going to anticipate.
 *
 * Text-only — no screenshot, no DOM re-walk. This layers on top of what
 * `collectJudgmentCandidates` already gathered, so it costs one schema-
 * constrained call, not a second page pass.
 */

const NUANCE_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          selector:     { type: 'string' },
          kind:         { type: 'string', enum: ['image', 'link', 'heading'] },
          title:        { type: 'string' },
          severity:     { type: 'string', enum: ['critical', 'serious', 'moderate', 'minor'] },
          evidence:     { type: 'string' },
          description:  { type: 'string' },
          suggestedFix: { type: 'string' }
        },
        required: ['selector', 'kind', 'title', 'severity', 'evidence', 'description', 'suggestedFix']
      }
    }
  },
  required: ['findings']
};

const WCAG_BY_KIND = { image: ['1.1.1'], link: ['2.4.4'], heading: ['2.4.6'] };

function buildPrompt(payload) {
  const fmt = (list, fields) => (list || []).slice(0, 60)
    .map(item => `- ${item.selector} :: ${fields.map(f => `${f}="${item[f] ?? ''}"`).join(' ')}`)
    .join('\n') || '(none)';

  return `You are reviewing content ALREADY CHECKED by deterministic rules for accessibility
problems those rules cannot catch. The rules already flagged filenames-as-alt-text, generic
words ("image", "click here"), and raw URLs — do not repeat any of that.

Look only for cases that are technically fine-sounding but actually misleading or unhelpful:
alt text that is grammatically correct but does not match what a reasonable person would
describe, a heading that sounds specific but is generic or misleading in context, link text
that reads naturally but does not indicate where it actually goes.

If you are not confident something is a real problem, do not report it. A false positive here
costs more credibility than a missed finding.

IMAGES (selector :: alt, src):
${fmt(payload.images, ['alt', 'src'])}

LINKS (selector :: text, href):
${fmt(payload.links, ['text', 'href'])}

HEADINGS (selector :: text, level):
${fmt(payload.headings, ['text', 'level'])}

Respond with the given schema. Return an empty findings array if nothing qualifies.`;
}

/**
 * Run the nuance pass. `callProvider` is injected rather than imported, so this
 * module has no dependency on LLMRouter's internals or provider credentials —
 * the service worker already owns both and passes the bound call through.
 */
async function runJudgmentNuancePass(callProvider, payload) {
  const prompt = buildPrompt(payload);
  const raw = await callProvider(prompt, NUANCE_SCHEMA);
  const findings = Array.isArray(raw?.findings) ? raw.findings : [];

  return findings
    .filter(f => f && f.selector && f.title)
    .map((f, i) => ({
      id: `NUANCE-${i + 1}`,
      ruleId: 'judgment-nuance',
      title: f.title,
      severity: f.severity || 'moderate',
      wcag: WCAG_BY_KIND[f.kind] || [],
      selectors: [f.selector],
      html: [],
      evidence: f.evidence || '',
      description: f.description || '',
      suggestedFix: f.suggestedFix || '',
      category: 'judgment-llm',
      passedAutomated: true,
      occurrences: 1
    }));
}

export { NUANCE_SCHEMA, buildPrompt, runJudgmentNuancePass };
