Accessibility Coverage & Implementation Plan
===========================================

This document maps the accessibility and responsiveness areas we cover to the checks, LLM templates, and developer actions.

High-level goals
----------------
- Automate rule-based checks (axe + Playwright) for the POUR principles.
- Use an LLM to synthesize results, prioritize issues, and generate remediation guidance and test stubs.
- Keep LLM outputs auditable by storing prompts, model metadata, and responses in `artifacts/`.

Key checks and mapping
----------------------
- `lang` attribute: detect missing `document.documentElement.lang` and suggest correct language tag.
- Images & alt: `axe` image-alt rules; LLM suggests alt text.
- Color contrast: compute contrast from computed styles; LLM suggests color pairs or CSS token updates.
- Forms: ensure `label` associations or `aria-label`; LLM suggests markup fixes.
- Keyboard navigation: Playwright keyboard-only tab walkthrough and focus order logs; LLM generates remediation steps.
- ARIA: run `axe` ARIA rules; LLM explains proper ARIA usage.
- Responsiveness: run at multiple breakpoints, check for horizontal scroll and touch target sizes; LLM suggests responsive CSS changes.

Prompt & Model
--------------
- Templates live in `../templates/llm-prompts.md` and additional templates will be added for remediation and test generation.
- Configure hosted LLM with `LLM_API_URL` and optionally `LLM_API_TOKEN` in environment.

Artifacts
---------
- Raw runner report: `artifacts/{id}-report.json`
- LLM analysis: `artifacts/{id}-analysis.json` (includes prompt, model metadata, and LLM output)

Next steps
----------
1. Implement the LLM adapter for the hosted endpoint and run a prototype audit.
2. Add per-issue remediation templates and Playwright test generator templates.
3. Integrate embeddings + RAG for improved factuality.
