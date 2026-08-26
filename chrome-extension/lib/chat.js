/**
 * Natural language control over a scan.
 *
 * "Fix everything critical but don't touch colors" only works if the model's
 * output is a structured, bounded plan rather than free text — so this asks
 * for a schema-constrained filter over the ACTUAL issue list from the current
 * scan, not an open-ended action. The model cannot invent a rule id or an
 * action that doesn't exist; `applyChatPlan` only ever operates on issues that
 * were really found.
 */

const CHAT_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    action:         { type: 'string', enum: ['apply', 'list'] },
    severities:      { type: 'array', items: { type: 'string', enum: ['critical', 'serious', 'moderate', 'minor'] } },
    includeRuleIds: { type: 'array', items: { type: 'string' } },
    excludeRuleIds: { type: 'array', items: { type: 'string' } },
    summary:        { type: 'string', description: 'One sentence confirming what you understood the instruction to mean' }
  },
  required: ['action', 'severities', 'includeRuleIds', 'excludeRuleIds', 'summary']
};

function buildChatPrompt(instruction, issues) {
  const ruleList = [...new Set((issues || []).map(i => i.ruleId || i.id))].slice(0, 80);
  return `You translate a user's instruction into a structured filter over an accessibility
scan's issue list — you do not fix anything yourself, you only decide which issues the
instruction refers to.

RULE IDS FOUND ON THIS PAGE:
${ruleList.join(', ') || '(none)'}

USER INSTRUCTION: "${instruction}"

"action" is "apply" if the user wants issues fixed, "list" if they just want to see or filter
them. "severities" is which severities to include — all four if the user didn't mention severity.
"excludeRuleIds" MUST use exact rule ids from the list above — e.g. an instruction like "don't
touch colors" means excluding "color-contrast", not inventing a new field. Leave arrays empty
rather than guessing when the instruction doesn't specify something.`;
}

async function interpretChatCommand(callProvider, instruction, issues) {
  const raw = await callProvider(buildChatPrompt(instruction, issues), CHAT_PLAN_SCHEMA);
  return {
    action: raw?.action === 'apply' ? 'apply' : 'list',
    severities: Array.isArray(raw?.severities) && raw.severities.length
      ? raw.severities : ['critical', 'serious', 'moderate', 'minor'],
    includeRuleIds: Array.isArray(raw?.includeRuleIds) ? raw.includeRuleIds : [],
    excludeRuleIds: Array.isArray(raw?.excludeRuleIds) ? raw.excludeRuleIds : [],
    summary: typeof raw?.summary === 'string' ? raw.summary : ''
  };
}

/**
 * Pure filter — no network, no model. Kept separate from interpretation so the
 * actual issue selection is deterministic and fully testable regardless of
 * what any model returns: a bad or malformed plan can only ever narrow the
 * result to nothing, never expand it into issues the user didn't ask for.
 */
function applyChatPlan(issues, plan) {
  if (!plan) return [];
  const severities = new Set(plan.severities || []);
  const include = new Set(plan.includeRuleIds || []);
  const exclude = new Set(plan.excludeRuleIds || []);

  return (issues || []).filter(issue => {
    const ruleId = issue.ruleId || issue.id;
    if (exclude.has(ruleId)) return false;
    if (include.size > 0) return include.has(ruleId);
    return severities.has((issue.severity || '').toLowerCase());
  });
}

export { CHAT_PLAN_SCHEMA, buildChatPrompt, interpretChatCommand, applyChatPlan };
