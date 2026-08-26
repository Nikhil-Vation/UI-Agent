/**
 * Judgment Layer — finds accessibility problems that automated checks pass.
 *
 * axe-core and Lighthouse ask "is there alt text?" and "does this link have a
 * name?". They cannot ask "is any of it useful?", because usefulness is not a
 * property you can express as a rule over the DOM.
 *
 * Every finding here comes from an element that PASSED the automated checks —
 * that is the entire point, and why findings carry `passedAutomated: true`.
 *
 * The heuristics below run with no model and no network. An LLM pass can layer
 * on top for nuance, but the deterministic core is what makes the result instant,
 * free, and identical every run.
 */

/* ═══════════════════════════════════════════
   Vocabulary
   ═══════════════════════════════════════════ */

/** Link text that is grammatically fine and tells a screen reader user nothing. */
/** Heading text that names nothing specific about the section it introduces. */
export const VAGUE_HEADING_TEXT = new Set([
  'section', 'overview', 'introduction', 'details', 'information', 'more info',
  'untitled', 'heading', 'title', 'content', 'stuff', 'misc', 'other', 'general',
  'chapter', 'part', 'topic', 'summary'
]);

/** Error text that states a field is wrong without saying how to fix it. */
export const VAGUE_ERROR_TEXT = new Set([
  'error', 'invalid', 'wrong', 'incorrect', 'invalid input', 'invalid value',
  'this field is invalid', 'field is invalid', 'not valid', 'error occurred',
  'something went wrong', 'please fix', 'fix this field', 'bad input'
]);

export const VAGUE_LINK_TEXT = new Set([
  'click here', 'click', 'here', 'read more', 'more', 'learn more', 'see more',
  'find out more', 'more info', 'more information', 'details', 'view', 'view more',
  'this', 'this page', 'link', 'go', 'go here', 'continue', 'next', 'download',
  'submit', 'open', 'start', 'info', 'read', 'see', 'explore'
]);

/** Words that describe the medium rather than the content. */
const GENERIC_ALT = new Set([
  'image', 'images', 'photo', 'photos', 'picture', 'pictures', 'logo', 'icon',
  'graphic', 'banner', 'thumbnail', 'img', 'pic', 'spacer', 'placeholder',
  'illustration', 'figure', 'screenshot', 'avatar', 'photograph'
]);

/** Camera and export naming conventions that leak into alt text. */
const FILENAME_ALT = /^(img|image|dsc|dscn|p|pic|photo|screen ?shot|screenshot|untitled|download|asset|file)[-_ ]?\d+$/i;

const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|svg|avif|bmp|tiff?)$/i;

const REDUNDANT_PREFIX = /^(an? )?(image|picture|photo|graphic|icon|logo) (of|showing|depicting)\b/i;

const ALT_TOO_LONG = 150;

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function normalize(text) {
  return String(text ?? '')
    // Non-breaking spaces, zero-width joiners and BOMs are invisible in the UI but
    // make two identical-looking strings compare unequal, which silently defeats
    // grouping. Fold them before anything else looks at the text.
    .replace(/[   -   　]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip punctuation and case so "Click here!" and "click here" compare equal. */
function comparable(text) {
  return normalize(text).toLowerCase().replace(/[.!?:;,→>»…\-–—]+$/g, '').trim();
}

/** Last path segment of a URL, without extension or query. */
function filenameOf(src) {
  if (!src) return '';
  const path = String(src).split(/[?#]/)[0];
  const last = path.split('/').filter(Boolean).pop() || '';
  return last.replace(IMAGE_EXTENSION, '');
}

/** Loose equality between alt text and a filename: "hero-banner" ≈ "Hero Banner". */
function looksLikeFilename(alt, src) {
  const a = normalize(alt).toLowerCase().replace(IMAGE_EXTENSION, '');
  if (!a) return false;
  if (IMAGE_EXTENSION.test(normalize(alt))) return true;
  if (FILENAME_ALT.test(a)) return true;

  const file = filenameOf(src).toLowerCase();
  if (!file) return false;

  const flatten = (s) => s.replace(/[-_\s]+/g, '');
  return flatten(a) === flatten(file);
}

/* ═══════════════════════════════════════════
   Image alt text quality
   ═══════════════════════════════════════════ */

/**
 * Assess one image that already has alt text.
 * Returns a finding, or null when the alt text looks genuinely descriptive.
 */
export function assessAltText(img) {
  const alt = normalize(img.alt);

  // Empty alt is a deliberate signal for decorative images — not our business.
  if (!alt) return null;
  // Explicitly decorative: the author already told assistive tech to skip it.
  if (img.role === 'presentation' || img.role === 'none' || img.ariaHidden) return null;

  const base = {
    ruleId: 'alt-text-quality',
    title: 'Alt text is present but not descriptive',
    category: 'judgment',
    severity: 'serious',
    wcag: ['1.1.1'],
    selectors: [img.selector],
    html: img.html ? [img.html] : [],
    passedAutomated: true,
    // Carried through so the UI can offer a vision-based re-describe (3.3)
    // without having to re-query the DOM for an element the finding already knows about.
    imageSrc: img.src || ''
  };

  if (looksLikeFilename(alt, img.src)) {
    return {
      ...base,
      evidence: `alt="${alt}"`,
      description: 'The alt text is a filename, not a description. A screen reader will read it out character by character.',
      suggestedFix: 'Describe what the image shows and why it matters on this page.'
    };
  }

  if (GENERIC_ALT.has(alt.toLowerCase())) {
    return {
      ...base,
      evidence: `alt="${alt}"`,
      description: `"${alt}" names the medium, not the content. Every image on the page is an image — this adds nothing.`,
      suggestedFix: 'Replace with a description of what is actually shown.'
    };
  }

  if (REDUNDANT_PREFIX.test(alt)) {
    return {
      ...base,
      severity: 'moderate',
      evidence: `alt="${alt}"`,
      description: 'Screen readers already announce this element as an image, so the prefix is read twice.',
      suggestedFix: `Drop the prefix — describe the subject directly.`
    };
  }

  if (alt.length > ALT_TOO_LONG) {
    return {
      ...base,
      severity: 'moderate',
      evidence: `alt is ${alt.length} characters`,
      description: 'Alt text this long is read as one uninterrupted block with no way to skip or re-read part of it.',
      suggestedFix: 'Keep alt text to a short description and move the detail into visible text or a caption.'
    };
  }

  return null;
}

/* ═══════════════════════════════════════════
   Link text quality
   ═══════════════════════════════════════════ */

/**
 * Assess one link that already has an accessible name.
 * Returns a finding, or null when the text describes its destination.
 */
export function assessLinkText(link) {
  const text = normalize(link.text) || normalize(link.ariaLabel);
  if (!text) return null;   // no name at all is an axe violation, not ours

  const base = {
    ruleId: 'link-text-quality',
    title: 'Link text does not describe its destination',
    category: 'judgment',
    severity: 'serious',
    wcag: ['2.4.4'],
    selectors: [link.selector],
    html: link.html ? [link.html] : [],
    passedAutomated: true
  };

  if (VAGUE_LINK_TEXT.has(comparable(text))) {
    return {
      ...base,
      evidence: `"${text}"`,
      description: 'Screen reader users often navigate by pulling up a list of every link on the page. Out of context this one says nothing about where it goes.',
      suggestedFix: 'Name the destination in the link itself — "Read the 2026 accessibility report" rather than "read more".'
    };
  }

  if (/^(https?:\/\/|www\.)/i.test(text)) {
    return {
      ...base,
      severity: 'moderate',
      evidence: `"${text}"`,
      description: 'A raw URL is read out character by character, including the protocol and every slash.',
      suggestedFix: 'Use the page or document title as the link text instead of the address.'
    };
  }

  return null;
}

/* ═══════════════════════════════════════════
   Heading text quality
   ═══════════════════════════════════════════ */

/**
 * Assess one heading that already has text.
 * A heading with generic text passes every automated check — axe has no rule
 * that can tell "Overview" apart from a heading that actually names its section.
 */
export function assessHeadingText(heading) {
  const text = normalize(heading.text);
  if (!text) return null;   // an empty heading is axe's job (empty-heading), not ours

  const base = {
    ruleId: 'heading-text-quality',
    title: 'Heading does not describe its section',
    category: 'judgment',
    severity: 'moderate',
    wcag: ['2.4.6'],
    selectors: [heading.selector],
    html: heading.html ? [heading.html] : [],
    passedAutomated: true
  };

  if (VAGUE_HEADING_TEXT.has(comparable(text)) || /^(section|part|chapter)\s*\d*$/i.test(text)) {
    return {
      ...base,
      evidence: `<h${heading.level}>${text}</h${heading.level}>`,
      description: 'Screen reader users often jump between headings to get an outline of the page. A heading like this gives no indication of what the section actually covers.',
      suggestedFix: 'Name the specific content of the section — "Shipping rates" rather than "Details".'
    };
  }

  return null;
}

/**
 * Same problem as duplicate link text, applied to headings: several sections
 * that all announce the same name give a screen reader user no way to tell,
 * from the outline alone, which one they actually want.
 */
export function assessDuplicateHeadingText(headings) {
  const byText = new Map();
  for (const h of (headings || [])) {
    const text = comparable(h.text);
    if (!text) continue;
    if (!byText.has(text)) byText.set(text, []);
    byText.get(text).push(h);
  }

  const findings = [];
  for (const [text, group] of byText) {
    if (group.length < 3) continue;   // two sections sharing a name is common and usually fine
    findings.push({
      ruleId: 'duplicate-heading-text',
      title: 'The same heading text is reused across several sections',
      category: 'judgment',
      severity: 'moderate',
      wcag: ['2.4.6'],
      selectors: group.map(h => h.selector),
      html: group.slice(0, 2).map(h => h.html).filter(Boolean),
      passedAutomated: true,
      evidence: `${group.length} headings all read "${group[0].text}"`,
      description: 'Jumping between headings with a screen reader, these are indistinguishable — there is no way to tell which section is which from the outline.',
      suggestedFix: 'Make each heading specific to its own section.'
    });
  }
  return findings;
}

/* ═══════════════════════════════════════════
   Form error message quality
   ═══════════════════════════════════════════ */

/**
 * Assess a form field's associated error text.
 *
 * axe's `aria-invalid`/label checks confirm an error is announced at all; they
 * cannot judge whether the announcement is USEFUL. "Invalid input" is
 * perfectly wired up and tells nobody what to do next.
 */
export function assessErrorText(field) {
  const text = normalize(field.errorText);
  if (!text) return null;

  if (VAGUE_ERROR_TEXT.has(comparable(text))) {
    return {
      ruleId: 'error-text-quality',
      title: 'Error message does not explain how to fix the problem',
      category: 'judgment',
      severity: 'serious',
      wcag: ['3.3.3'],
      selectors: [field.selector],
      html: field.html ? [field.html] : [],
      passedAutomated: true,
      evidence: `"${text}"`,
      description: `The field is correctly marked invalid and the message is correctly announced — but "${text}" does not say what is wrong or how to correct it.`,
      suggestedFix: 'State the actual requirement — "Enter a valid email address" or "Password must be at least 8 characters" rather than "Invalid input".'
    };
  }
  return null;
}

/* ═══════════════════════════════════════════
   Cross-element checks
   ═══════════════════════════════════════════ */

/**
 * Reduce a URL to the thing that actually determines "is this the same page":
 * origin + path. This exists because a real site links the same destination
 * through several different literal strings — a relative `/azure` next to an
 * absolute `https://azure.microsoft.com/`, a trailing slash on one and not
 * the other, a `?icid=nav` tracking parameter appended to one instance and
 * not another, a `#pricing` jump link on an otherwise identical URL. None of
 * that is a second destination to a person clicking the link, so none of it
 * may count as one here.
 *
 * Query strings are dropped entirely rather than partially — deny-listing
 * known tracking parameters is a losing game against a large site's actual
 * variety, and the failure mode of stripping too much (missing a rare case
 * where the query string is genuinely the only thing distinguishing two
 * destinations) is far cheaper than the failure mode of stripping too little
 * (a false finding, live, on a real site — which is exactly the bug this
 * function exists to fix). When this can't be resolved to a real URL at all,
 * the literal string is kept so obviously-different values still compare
 * as different rather than silently collapsing together.
 */
function destinationKey(href) {
  try {
    const u = new URL(href);
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    return String(href || '').trim();
  }
}

/**
 * Identical link text pointing at different destinations.
 *
 * Each link passes on its own — the problem only exists in the relationship
 * between them, which is why rule engines miss it entirely.
 */
export function assessDuplicateLinkText(links) {
  const byText = new Map();

  for (const link of links) {
    const text = comparable(normalize(link.text) || normalize(link.ariaLabel));
    if (!text || !link.href) continue;
    if (!byText.has(text)) byText.set(text, []);
    byText.get(text).push(link);
  }

  const findings = [];
  for (const [text, group] of byText) {
    const destinations = new Set(group.map(l => destinationKey(l.href)));
    if (group.length < 2 || destinations.size < 2) continue;

    findings.push({
      ruleId: 'duplicate-link-text',
      _matchKey: text,   // lets assessCandidates suppress the redundant vague-text finding
      title: 'Same link text, different destinations',
      category: 'judgment',
      severity: 'moderate',
      wcag: ['2.4.4'],
      selectors: group.map(l => l.selector),
      html: group.slice(0, 2).map(l => l.html).filter(Boolean),
      passedAutomated: true,
      evidence: `${group.length} links read "${normalize(group[0].text) || text}" but go to ${destinations.size} different pages`,
      description: 'In a screen reader\'s list of links these are indistinguishable, so there is no way to tell which one leads where.',
      suggestedFix: 'Give each link text unique to its destination, or distinguish them with aria-label.'
    });
  }

  return findings;
}

/* ═══════════════════════════════════════════
   Entry point
   ═══════════════════════════════════════════ */

/** Headline for a group of identical findings. */
const GROUP_TITLE = {
  'alt-text-quality':  (n) => `${n} images share the same non-descriptive alt text`,
  'link-text-quality': (n) => `${n} links use the same vague text`
};

/**
 * Merge findings that report the same problem on the same value.
 *
 * A page built from one template produces the same finding on every instance —
 * six images with `alt="Picture"` is one problem to fix, not six. Left ungrouped
 * the panel becomes a wall of near-identical cards and stops being read at all.
 */
export function groupFindings(findings) {
  const groups = new Map();

  for (const finding of findings) {
    // Key on the *comparable* form, not the raw evidence: "Learn more" and
    // "Learn More" are the same problem and must land in the same group, even
    // though their evidence strings differ. The first member's evidence is what
    // gets displayed, so the original casing is still what the user sees.
    const key = `${finding.ruleId}::${comparable(finding.evidence || '')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(finding);
  }

  return [...groups.values()].map(group => {
    const [first] = group;
    if (group.length === 1) return { ...first, occurrences: 1 };

    const title = GROUP_TITLE[first.ruleId]?.(group.length) || first.title;
    return {
      ...first,
      title,
      occurrences: group.length,
      selectors: group.flatMap(f => f.selectors || []),
      html: group.slice(0, 2).flatMap(f => f.html || [])
    };
  });
}

/**
 * Run every judgment check over candidates collected from the page.
 * `payload` is { images: [...], links: [...] } from the MAIN-world collector.
 */
export function assessCandidates(payload = {}) {
  const images = Array.isArray(payload.images) ? payload.images : [];
  const links  = Array.isArray(payload.links)  ? payload.links  : [];
  const headings = Array.isArray(payload.headings) ? payload.headings : [];
  const errorFields = Array.isArray(payload.errorFields) ? payload.errorFields : [];

  const duplicates = assessDuplicateLinkText(links);
  const duplicateHeadings = assessDuplicateHeadingText(headings);

  // A "read more" repeated across the page produces both a vague-text finding
  // and a duplicate-destination finding. The duplicate one already says the text
  // is uninformative AND that the destinations differ, so it strictly dominates —
  // reporting both is the same complaint twice.
  const coveredByDuplicate = new Set(duplicates.map(d => d._matchKey));

  const findings = groupFindings([
    ...images.map(assessAltText).filter(Boolean),
    ...links.map(assessLinkText).filter(Boolean)
      .filter(f => !coveredByDuplicate.has(comparable(f.evidence.replace(/^"|"$/g, '')))),
    ...duplicates,
    ...headings.map(assessHeadingText).filter(Boolean),
    ...duplicateHeadings,
    ...errorFields.map(assessErrorText).filter(Boolean)
  ]);

  // Worst first; within a severity, the most widespread problem first, since a
  // finding on 12 elements is more worth someone's attention than one on 1.
  const weight = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  findings.sort((a, b) =>
    (weight[a.severity] ?? 9) - (weight[b.severity] ?? 9) ||
    (b.occurrences || 1) - (a.occurrences || 1) ||
    a.ruleId.localeCompare(b.ruleId)
  );

  return findings.map((f, i) => {
    const { _matchKey, ...rest } = f;
    return { ...rest, id: `JUDGMENT-${i + 1}` };
  });
}

/**
 * Headline for the demo that matters: these all passed the automated audit.
 */
export function summarizeJudgment(findings, automatedPassCount = null) {
  if (!findings.length) {
    return 'No additional issues found beyond the automated checks.';
  }
  const n = findings.length;
  const noun = n === 1 ? 'issue' : 'issues';
  const passed = automatedPassCount === null ? '' : ` The automated audit passed ${automatedPassCount} checks on this page.`;
  return `Found ${n} ${noun} that automated checks cannot detect — every one of these passes axe-core and Lighthouse.${passed}`;
}

/**
 * Collect judgment candidates from the live page.
 *
 * Serialized into the MAIN world by chrome.scripting.executeScript, so it must
 * be entirely self-contained — no imports, no closure over module scope.
 */
export function collectJudgmentCandidates() {
  const cssPath = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.classList.length) {
        const cls = [...node.classList].slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
        part += cls;
      }
      const parent = node.parentElement;
      if (parent) {
        const twins = [...parent.children].filter(c => c.tagName === node.tagName);
        if (twins.length > 1) part += `:nth-of-type(${twins.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (node.id) { parts[0] = `#${CSS.escape(node.id)}`; break; }
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const visible = (el) => {
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  };

  const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + '…' : s || '');

  const images = [...document.querySelectorAll('img[alt]')]
    .filter(visible)
    .slice(0, 200)
    .map(el => ({
      selector: cssPath(el),
      alt: el.getAttribute('alt') || '',
      // `.src` (resolved property), not getAttribute('src') (the raw string).
      // This value later gets fetched directly from the SERVICE WORKER for
      // "Describe with AI" — a relative path like "/images/hero.jpg" has no
      // correct base to resolve against there, so it would 404 against the
      // extension's own origin instead of the page's, or in the worst case
      // silently fetch the wrong resource. The filename-pattern check
      // (looksLikeFilename) also uses this field and is unaffected either
      // way, since it only reads the last path segment.
      src: el.src || '',
      role: el.getAttribute('role') || '',
      ariaHidden: el.getAttribute('aria-hidden') === 'true',
      html: clip(el.outerHTML, 300)
    }));

  const links = [...document.querySelectorAll('a[href]')]
    .filter(visible)
    .slice(0, 300)
    .map(el => ({
      selector: cssPath(el),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      ariaLabel: el.getAttribute('aria-label') || '',
      // `.href` (the DOM property), not getAttribute('href') (the raw string).
      // The property is resolved by the browser to a full absolute URL, so a
      // relative "/azure" and an absolute "https://azure.microsoft.com/" that
      // point at the same page collect as the same string instead of two.
      href: el.href || '',
      html: clip(el.outerHTML, 300)
    }));

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(visible)
    .slice(0, 100)
    .map(el => ({
      selector: cssPath(el),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      level: Number(el.tagName[1]),
      html: clip(el.outerHTML, 200)
    }));

  // Fields with an active validation error: aria-invalid="true" plus whatever
  // aria-describedby actually points at, which is what a screen reader reads
  // out as the error message.
  const errorFields = [...document.querySelectorAll('[aria-invalid="true"]')]
    .filter(visible)
    .slice(0, 100)
    .map(el => {
      const describedBy = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      const errorText = describedBy
        .map(id => document.getElementById(id)?.textContent || '')
        .join(' ').replace(/\s+/g, ' ').trim();
      return {
        selector: cssPath(el),
        fieldName: el.getAttribute('name') || el.getAttribute('id') || '',
        errorText,
        html: clip(el.outerHTML, 200)
      };
    })
    .filter(f => f.errorText);

  return { images, links, headings, errorFields, url: window.location.href };
}
