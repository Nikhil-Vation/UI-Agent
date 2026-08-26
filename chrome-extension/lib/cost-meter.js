/**
 * Token cost meter — visible spend for BYO-key users.
 *
 * There is no billing API this extension can query — the user's actual cost
 * depends on their specific account, tier, and the provider's exact
 * tokenizer, none of which is available here. Every number this module
 * produces is an ESTIMATE from published list pricing and a standard
 * chars/4 approximation, and it is labeled that way everywhere it is shown,
 * rather than presented with a precision it cannot back up.
 *
 * Scope, stated rather than hidden: this meters LLMRouter's fix-generation
 * calls, which is the highest-volume path — bulk "Apply All" can trigger
 * dozens of calls in one session. Vision, chat, and the judgment nuance pass
 * are comparatively rare, one-shot, user-triggered actions and are not
 * separately metered.
 */

// Approximate published list price, USD per 1M tokens, as of this writing.
// These drift — the meter is explicitly an estimate, not a bill.
const PRICING = {
  gemini:    { input: 0.075, output: 0.30 },   // gemini-2.5-flash tier
  openai:    { input: 0.15,  output: 0.60 },   // gpt-4o-mini tier
  anthropic: { input: 0.80,  output: 4.00 },   // claude-3-5-haiku tier
  mistral:   { input: 0.20,  output: 0.60 }    // mistral-small tier
};

/** Standard rough heuristic: ~4 characters per token for English text. */
function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

/** USD estimate for one call, given the provider's price and both sides of the exchange. */
function estimateCallCost(provider, promptChars, resultChars) {
  const price = PRICING[provider];
  if (!price) return 0;
  const inputTokens  = estimateTokens('x'.repeat(promptChars || 0));
  const outputTokens = estimateTokens('x'.repeat(resultChars || 0));
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

function formatUSD(n) {
  if (n < 0.01) return `<$0.01`;
  return `$${n.toFixed(2)}`;
}

/** Fold one call's cost into a running session total, grouped by provider. */
function addUsage(totals, provider, cost) {
  const next = { ...totals, byProvider: { ...(totals.byProvider || {}) } };
  next.total = (totals.total || 0) + cost;
  next.calls = (totals.calls || 0) + 1;
  next.byProvider[provider] = (next.byProvider[provider] || 0) + cost;
  return next;
}

const CostMeter = { PRICING, estimateTokens, estimateCallCost, formatUSD, addUsage };

export { PRICING, estimateTokens, estimateCallCost, formatUSD, addUsage, CostMeter };
