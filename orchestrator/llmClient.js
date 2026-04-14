const fetch = globalThis.fetch;
const path = require('path');
const fs = require('fs');

// If the user intends to use Ollama but didn't set a URL, default to localhost:11434
const LLM_API_URL = process.env.LLM_API_URL || (process.env.LLM_API_MODE === 'ollama' ? 'http://localhost:11434' : null); // e.g. http://localhost:8080/generate
const LLM_API_TOKEN = process.env.LLM_API_TOKEN || process.env.HF_API_TOKEN || null;
const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME || null;
// Allow forcing a free/local analysis pass (preferred when you want an OSS/free path)
const LLM_USE_LOCAL = (process.env.LLM_USE_LOCAL === 'true') || (process.env.LLM_API_MODE === 'local');

// ============================================================================
// COMPREHENSIVE DETERMINISTIC ENRICHMENT SYSTEM
// Builds detailed accessibility/UI reports from raw axe + layout data
// ============================================================================

// WCAG criteria database with full metadata
const WCAG_DATABASE = {
  'html-has-lang': { criteria: ['3.1.1'], title: 'Language of Page', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind', 'Low Vision'], severity: 'Critical', effort: 'S' },
  'html-lang-valid': { criteria: ['3.1.1'], title: 'Valid Language Tag', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind', 'Low Vision'], severity: 'Critical', effort: 'S' },
  'image-alt': { criteria: ['1.1.1'], title: 'Non-text Content', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'input-image-alt': { criteria: ['1.1.1'], title: 'Input Image Alt', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'area-alt': { criteria: ['1.1.1', '2.4.4'], title: 'Area Alt Text', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'object-alt': { criteria: ['1.1.1'], title: 'Object Alt Text', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'label': { criteria: ['1.3.1', '4.1.2'], title: 'Form Labels', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind', 'Motor', 'Cognitive'], severity: 'Critical', effort: 'S' },
  'label-title-only': { criteria: ['3.3.2'], title: 'Label Title Only', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind', 'Cognitive'], severity: 'Moderate', effort: 'S' },
  'select-name': { criteria: ['4.1.2', '1.3.1'], title: 'Select Name', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'input-button-name': { criteria: ['4.1.2'], title: 'Button Name', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'button-name': { criteria: ['4.1.2'], title: 'Button Name', section508: ['1194.22(l)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'link-name': { criteria: ['2.4.4', '4.1.2'], title: 'Link Purpose', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind', 'Cognitive'], severity: 'Serious', effort: 'S' },
  'color-contrast': { criteria: ['1.4.3'], title: 'Color Contrast', section508: ['1194.22(j)'], ada: ['Title III'], disabilities: ['Low Vision', 'Cognitive'], severity: 'Serious', effort: 'M' },
  'color-contrast-enhanced': { criteria: ['1.4.6'], title: 'Enhanced Contrast', section508: ['1194.22(j)'], ada: ['Title III'], disabilities: ['Low Vision'], severity: 'Moderate', effort: 'M' },
  'heading-order': { criteria: ['1.3.1', '2.4.6'], title: 'Heading Order', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind', 'Cognitive'], severity: 'Moderate', effort: 'S' },
  'empty-heading': { criteria: ['2.4.6', '1.3.1'], title: 'Empty Heading', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind', 'Cognitive'], severity: 'Moderate', effort: 'S' },
  'document-title': { criteria: ['2.4.2'], title: 'Page Title', section508: ['1194.22(i)'], ada: ['Title III'], disabilities: ['Blind', 'Cognitive'], severity: 'Serious', effort: 'S' },
  'meta-viewport': { criteria: ['1.4.4'], title: 'Meta Viewport', section508: ['1194.22(k)'], ada: ['Title III'], disabilities: ['Low Vision'], severity: 'Critical', effort: 'S' },
  'meta-refresh': { criteria: ['2.2.1', '2.2.4', '3.2.5'], title: 'Meta Refresh', section508: ['1194.22(p)'], ada: ['Title III'], disabilities: ['Cognitive', 'Low Vision'], severity: 'Critical', effort: 'S' },
  'landmark-one-main': { criteria: ['2.4.1'], title: 'Main Landmark', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'landmark-unique': { criteria: ['2.4.1'], title: 'Unique Landmarks', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'region': { criteria: ['2.4.1', '1.3.1'], title: 'Content in Landmarks', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'M' },
  'bypass': { criteria: ['2.4.1'], title: 'Skip Link', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind', 'Motor'], severity: 'Serious', effort: 'M' },
  'focus-visible': { criteria: ['2.4.7'], title: 'Focus Visible', section508: ['1194.22(c)'], ada: ['Title III'], disabilities: ['Motor', 'Low Vision'], severity: 'Serious', effort: 'S' },
  'focus-order-semantics': { criteria: ['2.4.3'], title: 'Focus Order', section508: ['1194.22(c)'], ada: ['Title III'], disabilities: ['Motor', 'Blind'], severity: 'Moderate', effort: 'M' },
  'tabindex': { criteria: ['2.4.3'], title: 'Tabindex Value', section508: ['1194.22(c)'], ada: ['Title III'], disabilities: ['Motor'], severity: 'Serious', effort: 'S' },
  'keyboard': { criteria: ['2.1.1'], title: 'Keyboard Accessible', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Motor', 'Blind'], severity: 'Critical', effort: 'M' },
  'scrollable-region-focusable': { criteria: ['2.1.1'], title: 'Scrollable Focus', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Motor'], severity: 'Serious', effort: 'M' },
  'aria-allowed-attr': { criteria: ['4.1.2'], title: 'ARIA Allowed', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'aria-valid-attr': { criteria: ['4.1.2'], title: 'ARIA Valid', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'aria-valid-attr-value': { criteria: ['4.1.2'], title: 'ARIA Valid Value', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'aria-required-attr': { criteria: ['4.1.2'], title: 'ARIA Required', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'aria-required-children': { criteria: ['1.3.1'], title: 'ARIA Children', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'M' },
  'aria-required-parent': { criteria: ['1.3.1'], title: 'ARIA Parent', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'M' },
  'aria-roles': { criteria: ['4.1.2'], title: 'ARIA Roles', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'aria-hidden-focus': { criteria: ['4.1.2', '1.3.1'], title: 'ARIA Hidden Focus', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind', 'Motor'], severity: 'Serious', effort: 'M' },
  'aria-hidden-body': { criteria: ['4.1.2'], title: 'ARIA Hidden Body', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'duplicate-id': { criteria: ['4.1.1'], title: 'Duplicate IDs', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'duplicate-id-active': { criteria: ['4.1.1'], title: 'Active Duplicate IDs', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'duplicate-id-aria': { criteria: ['4.1.1'], title: 'ARIA Duplicate IDs', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Critical', effort: 'S' },
  'form-field-multiple-labels': { criteria: ['1.3.1'], title: 'Multiple Labels', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'frame-title': { criteria: ['4.1.2', '2.4.1'], title: 'Frame Title', section508: ['1194.22(i)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'frame-tested': { criteria: ['4.1.2'], title: 'Frame Tested', section508: ['1194.22(i)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'M' },
  'list': { criteria: ['1.3.1'], title: 'List Structure', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'listitem': { criteria: ['1.3.1'], title: 'List Item Structure', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'definition-list': { criteria: ['1.3.1'], title: 'Definition List', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'dlitem': { criteria: ['1.3.1'], title: 'DL Item Structure', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'table-duplicate-name': { criteria: ['1.3.1'], title: 'Table Duplicate Name', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'td-headers-attr': { criteria: ['1.3.1'], title: 'TD Headers Attr', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'M' },
  'th-has-data-cells': { criteria: ['1.3.1'], title: 'TH Data Cells', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'M' },
  'scope-attr-valid': { criteria: ['1.3.1'], title: 'Scope Attr Valid', section508: ['1194.22(g)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'autocomplete-valid': { criteria: ['1.3.5'], title: 'Autocomplete Valid', section508: ['1194.22(n)'], ada: ['Title III'], disabilities: ['Cognitive', 'Motor'], severity: 'Serious', effort: 'S' },
  'video-caption': { criteria: ['1.2.2', '1.2.4'], title: 'Video Captions', section508: ['1194.22(b)'], ada: ['Title III'], disabilities: ['Deaf', 'Hard of Hearing'], severity: 'Critical', effort: 'L' },
  'audio-caption': { criteria: ['1.2.2'], title: 'Audio Captions', section508: ['1194.22(b)'], ada: ['Title III'], disabilities: ['Deaf', 'Hard of Hearing'], severity: 'Critical', effort: 'L' },
  'video-description': { criteria: ['1.2.5'], title: 'Video Description', section508: ['1194.22(b)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'L' },
  'blink': { criteria: ['2.2.2'], title: 'Blinking Content', section508: ['1194.22(j)'], ada: ['Title III'], disabilities: ['Cognitive', 'Seizure'], severity: 'Critical', effort: 'S' },
  'marquee': { criteria: ['2.2.2'], title: 'Marquee Element', section508: ['1194.22(j)'], ada: ['Title III'], disabilities: ['Cognitive', 'Seizure'], severity: 'Critical', effort: 'S' },
  'no-autoplay-audio': { criteria: ['1.4.2'], title: 'No Autoplay Audio', section508: ['1194.22(b)'], ada: ['Title III'], disabilities: ['Deaf', 'Cognitive'], severity: 'Moderate', effort: 'S' },
  'server-side-image-map': { criteria: ['2.1.1'], title: 'Server Side Image Map', section508: ['1194.22(f)'], ada: ['Title III'], disabilities: ['Motor'], severity: 'Moderate', effort: 'M' },
  'nested-interactive': { criteria: ['4.1.2'], title: 'Nested Interactive', section508: ['1194.22(l)'], ada: ['Title III'], disabilities: ['Blind', 'Motor'], severity: 'Serious', effort: 'M' },
  'accesskeys': { criteria: ['4.1.1'], title: 'Access Keys', section508: ['1194.22(c)'], ada: ['Title III'], disabilities: ['Motor'], severity: 'Serious', effort: 'S' },
  'landmark-banner-is-top-level': { criteria: ['2.4.1'], title: 'Banner Landmark', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'landmark-contentinfo-is-top-level': { criteria: ['2.4.1'], title: 'Contentinfo Landmark', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'landmark-main-is-top-level': { criteria: ['2.4.1'], title: 'Main Landmark', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'landmark-no-duplicate-banner': { criteria: ['2.4.1'], title: 'Single Banner', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'landmark-no-duplicate-contentinfo': { criteria: ['2.4.1'], title: 'Single Contentinfo', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'landmark-no-duplicate-main': { criteria: ['2.4.1'], title: 'Single Main', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Moderate', effort: 'S' },
  'identical-links-same-purpose': { criteria: ['2.4.9'], title: 'Identical Links', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Cognitive'], severity: 'Moderate', effort: 'S' },
  'p-as-heading': { criteria: ['1.3.1'], title: 'Paragraph as Heading', section508: ['1194.22(o)'], ada: ['Title III'], disabilities: ['Blind', 'Cognitive'], severity: 'Serious', effort: 'S' },
  'svg-img-alt': { criteria: ['1.1.1'], title: 'SVG Image Alt', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'role-img-alt': { criteria: ['1.1.1'], title: 'Role Image Alt', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Serious', effort: 'S' },
  'image-redundant-alt': { criteria: ['1.1.1'], title: 'Redundant Alt', section508: ['1194.22(a)'], ada: ['Title III'], disabilities: ['Blind'], severity: 'Minor', effort: 'S' },
  'target-size': { criteria: ['2.5.8'], title: 'Target Size', section508: ['1194.22(c)'], ada: ['Title III'], disabilities: ['Motor', 'Low Vision'], severity: 'Serious', effort: 'S' }
};

// Fix suggestions database for accessibility issues
const FIX_SUGGESTIONS = {
  'html-has-lang': {
    explanation: 'The <html> element is missing a lang attribute, which tells screen readers what language to use.',
    impact: 'Screen readers cannot determine the page language, leading to mispronunciation of content.',
    problemCode: '<html>',
    fixCode: '<html lang="en">',
    fix: 'Add lang attribute to the root HTML element with the correct language code (e.g., "en" for English).'
  },
  'html-lang-valid': {
    explanation: 'The lang attribute contains an invalid or malformed language tag.',
    impact: 'Screen readers may fail to switch to the correct language pronunciation.',
    problemCode: '<html lang="invalid">',
    fixCode: '<html lang="en">',
    fix: 'Use a valid BCP 47 language tag (e.g., "en", "en-US", "fr", "es").'
  },
  'image-alt': {
    explanation: 'Images must have alternative text to describe their content for screen reader users.',
    impact: 'Users who cannot see images will have no understanding of the image content.',
    problemCode: '<img src="photo.jpg">',
    fixCode: '<img src="photo.jpg" alt="Description of the image content">',
    fix: 'Add descriptive alt text to all <img> elements. Use alt="" for decorative images only.'
  },
  'label': {
    explanation: 'Form controls must have associated labels to be accessible to screen readers.',
    impact: 'Users cannot understand what information to enter in form fields.',
    problemCode: '<input type="text" name="email">',
    fixCode: '<label for="email">Email Address</label>\n<input type="text" id="email" name="email">',
    fix: 'Associate labels using the for/id pattern or wrap inputs in label elements.'
  },
  'button-name': {
    explanation: 'Buttons must have discernible text that describes their purpose.',
    impact: 'Screen reader users cannot determine what the button does.',
    problemCode: '<button><i class="icon-search"></i></button>',
    fixCode: '<button aria-label="Search"><i class="icon-search"></i></button>',
    fix: 'Add text content, aria-label, or aria-labelledby to buttons.'
  },
  'link-name': {
    explanation: 'Links must have discernible text that describes their destination or purpose.',
    impact: 'Users cannot understand where the link will take them.',
    problemCode: '<a href="/page"><img src="arrow.png"></a>',
    fixCode: '<a href="/page" aria-label="Go to next page"><img src="arrow.png" alt=""></a>',
    fix: 'Add descriptive text content, aria-label, or alt text on images within links.'
  },
  'color-contrast': {
    explanation: 'Text must have sufficient contrast against its background for users with low vision.',
    impact: 'Users with low vision or color blindness may not be able to read the text.',
    problemCode: 'color: #999; background: #fff; /* 2.8:1 ratio */',
    fixCode: 'color: #595959; background: #fff; /* 7:1 ratio */',
    fix: 'Increase contrast ratio to at least 4.5:1 for normal text, 3:1 for large text.'
  },
  'heading-order': {
    explanation: 'Headings should follow a logical hierarchical order (h1, h2, h3...).',
    impact: 'Screen reader users use headings to navigate; skipped levels cause confusion.',
    problemCode: '<h1>Title</h1>\n<h3>Subsection</h3> <!-- Missing h2 -->',
    fixCode: '<h1>Title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>',
    fix: 'Ensure heading levels increase sequentially without skipping levels.'
  },
  'document-title': {
    explanation: 'Pages must have a descriptive title that identifies the page content.',
    impact: 'Users cannot identify the page in browser tabs, history, or bookmarks.',
    problemCode: '<title></title>',
    fixCode: '<title>Page Name - Site Name</title>',
    fix: 'Add a unique, descriptive title element in the document head.'
  },
  'meta-viewport': {
    explanation: 'The page may block zooming which prevents users from enlarging content.',
    impact: 'Users with low vision cannot zoom the page to read content.',
    problemCode: '<meta name="viewport" content="..., maximum-scale=1.0">',
    fixCode: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    fix: 'Remove maximum-scale, user-scalable=no, or user-scalable=0 from viewport meta.'
  },
  'bypass': {
    explanation: 'Pages should provide a way to skip repetitive navigation content.',
    impact: 'Keyboard users must tab through all navigation links on every page.',
    problemCode: '<!-- No skip link provided -->',
    fixCode: '<a href="#main-content" class="skip-link">Skip to main content</a>\n...\n<main id="main-content">',
    fix: 'Add a skip link at the start of the page that jumps to main content.'
  },
  'aria-hidden-focus': {
    explanation: 'Elements with aria-hidden="true" should not contain focusable elements.',
    impact: 'Focus can be trapped on invisible elements, confusing screen reader users.',
    problemCode: '<div aria-hidden="true"><button>Click</button></div>',
    fixCode: '<div aria-hidden="true"><button tabindex="-1">Click</button></div>',
    fix: 'Remove focusable elements from aria-hidden containers or add tabindex="-1".'
  },
  'focus-visible': {
    explanation: 'Interactive elements must have a visible focus indicator.',
    impact: 'Keyboard users cannot see which element has focus.',
    problemCode: ':focus { outline: none; }',
    fixCode: ':focus-visible { outline: 2px solid #005fcc; outline-offset: 2px; }',
    fix: 'Ensure focus states are visually distinguishable. Never remove outlines without replacements.'
  },
  'tabindex': {
    explanation: 'Positive tabindex values create unpredictable tab order.',
    impact: 'Keyboard users experience confusing navigation order.',
    problemCode: '<button tabindex="5">First</button>\n<button tabindex="1">Second</button>',
    fixCode: '<button>First</button>\n<button>Second</button>',
    fix: 'Use tabindex="0" to add elements to natural tab order, or tabindex="-1" to remove them.'
  },
  'duplicate-id': {
    explanation: 'Element IDs must be unique within the page.',
    impact: 'ARIA references and label associations may fail.',
    problemCode: '<div id="content">...</div>\n<div id="content">...</div>',
    fixCode: '<div id="content-1">...</div>\n<div id="content-2">...</div>',
    fix: 'Ensure all element IDs are unique within the document.'
  },
  'landmark-one-main': {
    explanation: 'Pages should have exactly one main landmark to identify the primary content.',
    impact: 'Screen reader users cannot quickly navigate to main content.',
    problemCode: '<div class="content">...</div>',
    fixCode: '<main>...</main>',
    fix: 'Wrap the primary content in a <main> element or use role="main".'
  },
  'region': {
    explanation: 'All content should be contained within landmark regions.',
    impact: 'Screen reader users may miss content outside landmarks.',
    problemCode: '<body>\n  <div>Orphan content</div>\n  <main>...</main>\n</body>',
    fixCode: '<body>\n  <header>...</header>\n  <main>All content here</main>\n  <footer>...</footer>\n</body>',
    fix: 'Ensure all visible content is within header, nav, main, aside, or footer landmarks.'
  },
  'video-caption': {
    explanation: 'Videos must have captions for users who are deaf or hard of hearing.',
    impact: 'Users cannot access audio content in videos.',
    problemCode: '<video src="video.mp4"></video>',
    fixCode: '<video src="video.mp4">\n  <track kind="captions" src="captions.vtt" srclang="en">\n</video>',
    fix: 'Add a <track> element with captions or provide a text transcript.'
  },
  'select-name': {
    explanation: 'Select elements must have an accessible name.',
    impact: 'Screen reader users cannot identify the select field purpose.',
    problemCode: '<select>\n  <option>Option 1</option>\n</select>',
    fixCode: '<label for="country">Country</label>\n<select id="country">\n  <option>Option 1</option>\n</select>',
    fix: 'Add a label element associated with the select, or use aria-label.'
  }
};

// Layout/UI issue enrichment
const LAYOUT_FIX_SUGGESTIONS = {
  'horizontal-scroll': {
    explanation: 'The page has horizontal scrolling at this viewport width, usually caused by fixed-width elements.',
    impact: 'Users on small screens cannot see all content without horizontal scrolling, violating responsive design principles.',
    problemCode: '.container { width: 1200px; }',
    fixCode: '.container { max-width: 100%; width: 100%; }',
    fix: 'Use max-width: 100%, avoid fixed pixel widths, and ensure all containers use responsive units.'
  },
  'overflowing-content': {
    explanation: 'Element content (text or children) extends beyond its container boundaries.',
    impact: 'Text may be cut off or hidden, making content inaccessible.',
    problemCode: '.box { width: 200px; /* Long text without wrapping */ }',
    fixCode: '.box { width: 200px; overflow-wrap: anywhere; word-break: break-word; }',
    fix: 'Add overflow-wrap: anywhere and word-break: break-word to text containers.'
  },
  'clipped-element': {
    explanation: 'Element extends outside the viewport, causing content to be hidden or cut off.',
    impact: 'Users cannot see or interact with content outside the visible area.',
    problemCode: '.element { position: absolute; right: -50px; }',
    fixCode: '.element { position: absolute; right: 0; max-width: 100%; }',
    fix: 'Check positioning and width values. Use responsive units and max-width constraints.'
  },
  'small-tap-target': {
    explanation: 'Interactive element is smaller than the recommended 44x44 pixel minimum for touch targets.',
    impact: 'Users with motor impairments or on touch devices may struggle to tap the element.',
    problemCode: '.btn { width: 24px; height: 24px; }',
    fixCode: '.btn { min-width: 44px; min-height: 44px; }',
    fix: 'Ensure interactive elements are at least 44x44 pixels for touch accessibility.'
  },
  'text-clipping': {
    explanation: 'Text is being cut off or clipped by its container.',
    impact: 'Users cannot read the full content.',
    problemCode: '.text { height: 20px; overflow: hidden; }',
    fixCode: '.text { min-height: 20px; overflow: visible; }',
    fix: 'Remove fixed heights or use min-height. Set overflow to visible or auto.'
  }
};

/**
 * Build a comprehensive deterministic analysis from raw Playwright/axe data
 */
function buildDeterministicAnalysis(report) {
  const issues = [];
  const uiIssues = [];
  const passedChecks = [];
  const manualChecks = [];
  let issueCounter = 1;

  // Collect all violations and passes across breakpoints
  for (const r of report.results) {
    const bp = r.breakpoint || `${r.width}x${r.height}`;

    // Process axe violations
    if (r.axe && r.axe.violations && r.axe.violations.length) {
      for (const v of r.axe.violations) {
        const ruleId = v.id;
        const wcagMeta = WCAG_DATABASE[ruleId] || {};
        const fixMeta = FIX_SUGGESTIONS[ruleId] || {};
        const nodes = v.nodes || [];

        // Get selectors and HTML from nodes
        const selectors = nodes.slice(0, 5).map(n => {
          if (Array.isArray(n.target)) return n.target.join(' > ');
          return n.target || '';
        }).filter(s => s);

        const htmlSamples = nodes.slice(0, 3).map(n => (n.html || '').slice(0, 200)).filter(h => h);

        // Map impact to severity
        const impactToSeverity = { critical: 'Critical', serious: 'Critical', moderate: 'Moderate', minor: 'Minor' };
        const severity = impactToSeverity[v.impact] || wcagMeta.severity || 'Moderate';

        // Extract WCAG tags from axe
        const wcagFromTags = (v.tags || []).filter(t => /wcag\d/.test(t)).map(t => {
          const match = t.match(/wcag(\d+)/);
          if (match) {
            const num = match[1];
            if (num.length >= 3) return `${num[0]}.${num[1]}.${num.slice(2)}`;
          }
          return t;
        });

        const issue = {
          id: `ISSUE-${issueCounter++}`,
          ruleId,
          title: v.help || wcagMeta.title || ruleId,
          severity,
          wcagCriteria: wcagMeta.criteria || wcagFromTags,
          section508: wcagMeta.section508 || [],
          ada: wcagMeta.ada || ['Title III'],
          disabilitiesAffected: wcagMeta.disabilities || ['Blind'],
          count: nodes.length,
          selectors,
          breakpoint: bp,
          impact: fixMeta.impact || v.description || 'This issue affects accessibility for assistive technology users.',
          evidence: htmlSamples.length ? htmlSamples[0] : (v.description || 'See selector for affected element.'),
          code: {
            problem: fixMeta.problemCode || (htmlSamples[0] || '<!-- See selector -->'),
            fix: fixMeta.fixCode || '<!-- Apply suggested fix -->'
          },
          suggestedFix: fixMeta.fix || v.help || 'Review the element and apply WCAG guidelines.',
          explanation: fixMeta.explanation || v.description || '',
          effort: wcagMeta.effort || 'S',
          helpUrl: v.helpUrl || `https://dequeuniversity.com/rules/axe/4.6/${ruleId}`
        };

        // Add failure summary if available
        if (nodes[0] && nodes[0].failureSummary) {
          issue.failureSummary = nodes[0].failureSummary;
        }

        issues.push(issue);
      }
    }

    // Track passed checks for metrics
    if (r.axe && r.axe.passes && r.axe.passes.length) {
      for (const p of r.axe.passes) {
        if (!passedChecks.includes(p.id)) passedChecks.push(p.id);
      }
    }

    // Track incomplete (manual) checks
    if (r.axe && r.axe.incomplete && r.axe.incomplete.length) {
      for (const i of r.axe.incomplete) {
        manualChecks.push({
          ruleId: i.id,
          help: i.help,
          count: (i.nodes || []).length,
          breakpoint: bp
        });
      }
    }

    // Process layout issues
    if (r.layoutIssues && r.layoutIssues.length) {
      for (const li of r.layoutIssues) {
        const layoutMeta = LAYOUT_FIX_SUGGESTIONS[li.type] || {};

        const uiIssue = {
          id: `UI-${issueCounter++}`,
          breakpoint: bp,
          type: li.type || 'layout-issue',
          selector: li.selector || 'unknown',
          rect: li.rect || null,
          scrollWidth: li.scrollWidth || null,
          impact: layoutMeta.impact || 'This layout issue affects usability on this viewport.',
          evidence: li.scrollWidth ? `Element width: ${li.scrollWidth}px exceeds container.` : (li.rect ? `Element position: ${JSON.stringify(li.rect)}` : 'Layout measurement detected.'),
          explanation: layoutMeta.explanation || 'Layout issue detected at this breakpoint.',
          code: {
            problem: layoutMeta.problemCode || `/* ${li.selector} causing ${li.type} */`,
            fix: layoutMeta.fixCode || '/* Apply responsive CSS fix */'
          },
          suggestedFix: layoutMeta.fix || 'Review element sizing and positioning for responsive design.',
          effort: 'M'
        };

        uiIssues.push(uiIssue);
      }
    }
  }

  // Calculate metrics
  const criticalCount = issues.filter(i => i.severity === 'Critical').length;
  const moderateCount = issues.filter(i => i.severity === 'Moderate').length;
  const minorCount = issues.filter(i => i.severity === 'Minor').length;
  const totalIssues = issues.length + uiIssues.length;
  const passedCount = passedChecks.length;
  const manualCount = manualChecks.length;

  // Calculate audit score (100 - weighted penalties)
  // UI issues have minimal impact (0.1 each, capped at 10 points max)
  // Accessibility issues are weighted by severity
  const a11yPenalty = (criticalCount * 6) + (moderateCount * 3) + (minorCount * 1);
  const uiPenalty = Math.min(10, Math.ceil(uiIssues.length * 0.1)); // cap UI penalty at 10
  const penalty = a11yPenalty + uiPenalty;
  // Floor at 5 so the score is never completely 0 (shows some progress potential)
  const auditScore = Math.max(5, Math.min(100, 100 - penalty));

  // Determine compliance status
  let complianceStatus = 'Compliant';
  if (criticalCount > 0 || auditScore < 70) {
    complianceStatus = 'Not Compliant';
  } else if (auditScore < 90 || moderateCount > 3) {
    complianceStatus = 'At Risk';
  }

  // Generate recommendations based on issues found
  const recommendations = [];
  const issueTypes = new Set(issues.map(i => i.ruleId));

  if (issueTypes.has('html-has-lang') || issueTypes.has('html-lang-valid')) {
    recommendations.push('Add a valid lang attribute to the <html> element to help screen readers identify the page language.');
  }
  if (issueTypes.has('image-alt')) {
    recommendations.push('Add descriptive alt text to all images. Use alt="" only for purely decorative images.');
  }
  if (issueTypes.has('label') || issueTypes.has('select-name')) {
    recommendations.push('Ensure all form controls have programmatically associated labels using for/id or wrapper patterns.');
  }
  if (issueTypes.has('color-contrast')) {
    recommendations.push('Review color combinations to ensure a minimum 4.5:1 contrast ratio for normal text and 3:1 for large text.');
  }
  if (issueTypes.has('heading-order')) {
    recommendations.push('Restructure headings to follow a logical hierarchy (h1 → h2 → h3) without skipping levels.');
  }
  if (issueTypes.has('button-name') || issueTypes.has('link-name')) {
    recommendations.push('Add descriptive text, aria-label, or aria-labelledby to buttons and links that rely on icons only.');
  }
  if (issueTypes.has('bypass') || issueTypes.has('landmark-one-main')) {
    recommendations.push('Add skip links and ensure proper landmark structure (header, main, footer) for keyboard navigation.');
  }
  if (issueTypes.has('focus-visible')) {
    recommendations.push('Ensure all interactive elements have visible focus indicators. Never remove outlines without alternatives.');
  }
  if (uiIssues.length > 0) {
    recommendations.push('Fix responsive layout issues to ensure content is accessible across all viewport sizes.');
  }
  if (manualCount > 0) {
    recommendations.push('Perform manual testing for incomplete checks, especially for dynamic content and keyboard navigation.');
  }
  recommendations.push('Integrate automated accessibility testing into your CI/CD pipeline using axe-core or similar tools.');
  recommendations.push('Conduct user testing with assistive technology users to validate real-world accessibility.');

  // Generate top fixes (highest impact, sorted by severity)
  const topFixes = issues
    .filter(i => i.severity === 'Critical')
    .slice(0, 5)
    .map(i => ({
      title: i.title,
      impact: i.impact,
      effort: i.effort,
      selector: i.selectors[0] || i.ruleId
    }));

  if (topFixes.length < 5) {
    const additionalFixes = issues
      .filter(i => i.severity !== 'Critical')
      .slice(0, 5 - topFixes.length)
      .map(i => ({
        title: i.title,
        impact: i.impact,
        effort: i.effort,
        selector: i.selectors[0] || i.ruleId
      }));
    topFixes.push(...additionalFixes);
  }

  // Generate action plan
  const actionPlan = [];
  if (criticalCount > 0) {
    actionPlan.push({
      title: `Fix ${criticalCount} critical accessibility issue${criticalCount > 1 ? 's' : ''}`,
      description: 'Address violations that block access for users with disabilities.',
      effort: criticalCount <= 3 ? 'S' : criticalCount <= 8 ? 'M' : 'L',
      owner: 'Dev',
      priority: 'P0'
    });
  }
  if (moderateCount > 0) {
    actionPlan.push({
      title: `Address ${moderateCount} moderate accessibility issue${moderateCount > 1 ? 's' : ''}`,
      description: 'Fix issues that degrade the experience for assistive technology users.',
      effort: moderateCount <= 5 ? 'S' : 'M',
      owner: 'Dev',
      priority: 'P1'
    });
  }
  if (uiIssues.length > 0) {
    actionPlan.push({
      title: `Resolve ${uiIssues.length} responsive/UI issue${uiIssues.length > 1 ? 's' : ''}`,
      description: 'Fix layout issues across mobile, tablet, and desktop viewports.',
      effort: uiIssues.length <= 3 ? 'S' : 'M',
      owner: 'Dev/Design',
      priority: 'P1'
    });
  }
  if (manualCount > 0) {
    actionPlan.push({
      title: `Review ${manualCount} item${manualCount > 1 ? 's' : ''} requiring manual testing`,
      description: 'Test dynamic content, modals, and custom components with keyboard and screen readers.',
      effort: 'M',
      owner: 'QA',
      priority: 'P2'
    });
  }
  actionPlan.push({
    title: 'Add accessibility regression tests to CI/CD',
    description: 'Integrate axe-core or pa11y into build pipeline to catch issues early.',
    effort: 'M',
    owner: 'Dev/DevOps',
    priority: 'P2'
  });
  actionPlan.push({
    title: 'Schedule accessibility training for the team',
    description: 'Ensure developers and designers understand WCAG 2.2 requirements.',
    effort: 'M',
    owner: 'Manager',
    priority: 'P3'
  });

  // Build summary
  const summaryParts = [];
  summaryParts.push(`Analyzed ${report.url} across ${report.results.length} viewport${report.results.length > 1 ? 's' : ''}.`);
  summaryParts.push(`Found ${issues.length} accessibility issue${issues.length !== 1 ? 's' : ''} (${criticalCount} critical, ${moderateCount} moderate, ${minorCount} minor) and ${uiIssues.length} UI/responsive issue${uiIssues.length !== 1 ? 's' : ''}.`);

  if (criticalCount > 0) {
    const topCritical = issues.filter(i => i.severity === 'Critical').slice(0, 2).map(i => i.title).join(', ');
    summaryParts.push(`Top critical issues: ${topCritical}.`);
  }
  summaryParts.push(`Passed ${passedCount} automated checks; ${manualCount} require manual review.`);

  return {
    summary: summaryParts.join(' '),
    auditScore,
    complianceStatus,
    counts: {
      critical: criticalCount,
      moderate: moderateCount,
      minor: minorCount,
      passed: passedCount,
      manual: manualCount,
      notApplicable: 0,
      uiIssues: uiIssues.length
    },
    issues,
    uiIssues,
    recommendations: recommendations.slice(0, 10),
    topFixes,
    actionPlan,
    bestPractices: [
      { title: 'Use Semantic HTML', description: 'Prefer <button>, <nav>, <main>, <article> over generic <div> elements.', effort: 'S' },
      { title: 'Keyboard-First Development', description: 'Test all interactions with keyboard only before mouse/touch.', effort: 'S' },
      { title: 'Focus Management', description: 'Manage focus when opening modals, navigating SPAs, or showing new content.', effort: 'M' },
      { title: 'Accessible Forms', description: 'Group related fields with <fieldset>/<legend>, associate labels, provide clear error messages.', effort: 'M' },
      { title: 'Color Independence', description: 'Never use color as the only means of conveying information.', effort: 'S' },
      { title: 'Responsive & Zoomable', description: 'Support 200% browser zoom and do not disable pinch-to-zoom on mobile.', effort: 'M' }
    ],
    metadata: {
      url: report.url,
      timestamp: report.timestamp,
      breakpoints: report.results.map(r => ({ name: r.breakpoint, width: r.width, height: r.height })),
      scanEngine: 'axe-core',
      wcagVersion: '2.2',
      levels: ['A', 'AA']
    }
  };
}

/**
 * Merge LLM output with deterministic analysis (LLM data takes precedence where present)
 */
function mergeWithLLMOutput(deterministicAnalysis, llmParsed) {
  if (!llmParsed || typeof llmParsed !== 'object') {
    return deterministicAnalysis;
  }

  const merged = { ...deterministicAnalysis };

  // Use LLM summary if it's substantive
  if (llmParsed.summary && typeof llmParsed.summary === 'string' && llmParsed.summary.length > 50) {
    merged.summary = llmParsed.summary;
  }

  // Use LLM audit score if reasonable
  if (typeof llmParsed.auditScore === 'number' && llmParsed.auditScore >= 0 && llmParsed.auditScore <= 100) {
    merged.auditScore = llmParsed.auditScore;
  }

  // Merge LLM issues if they provide additional detail
  if (Array.isArray(llmParsed.issues) && llmParsed.issues.length > 0) {
    // Check if LLM issues have more detail
    const llmHasDetail = llmParsed.issues.some(i => i.code && (i.code.problem || i.code.fix));
    if (llmHasDetail) {
      // Merge by matching rule IDs
      for (const llmIssue of llmParsed.issues) {
        const match = merged.issues.find(di => di.ruleId === llmIssue.ruleId || di.id === llmIssue.id);
        if (match && llmIssue.code) {
          if (llmIssue.code.problem) match.code.problem = llmIssue.code.problem;
          if (llmIssue.code.fix) match.code.fix = llmIssue.code.fix;
        }
      }
    }
  }

  // Merge LLM recommendations if substantive
  if (Array.isArray(llmParsed.recommendations) && llmParsed.recommendations.length > merged.recommendations.length) {
    merged.recommendations = llmParsed.recommendations;
  }

  // Merge LLM topFixes if present
  if (Array.isArray(llmParsed.topFixes) && llmParsed.topFixes.length > 0) {
    merged.topFixes = llmParsed.topFixes;
  }

  // Merge LLM actionPlan if present
  if (Array.isArray(llmParsed.actionPlan) && llmParsed.actionPlan.length > 0) {
    merged.actionPlan = llmParsed.actionPlan;
  }

  return merged;
}

// ============================================================================
// END OF ENRICHMENT SYSTEM
// ============================================================================

function buildPrompt(report, promptTemplatePath) {
  const template = promptTemplatePath && fs.existsSync(promptTemplatePath)
    ? fs.readFileSync(promptTemplatePath, 'utf8')
    : null;

  const truncate = (value, max = 280) => {
    if (!value || typeof value !== 'string') return value;
    if (value.length <= max) return value;
    return value.slice(0, max) + '…';
  };

  // Prompt builder: include summary plus richer axe/layout samples for detailed reporting
  const summary = [];
  summary.push(`URL: ${report.url}`);
  summary.push(`Timestamp: ${report.timestamp}`);
  const violationSamples = [];
  const layoutSamples = [];
  for (const r of report.results) {
    summary.push(`Breakpoint: ${r.breakpoint} (${r.width}x${r.height})`);
    summary.push(`Screenshots: ${path.basename(r.screenshot)}`);
    summary.push(`Accessibility violations: ${r.axe && r.axe.violations ? r.axe.violations.length : 0}`);
    summary.push(`Layout issues detected: ${r.layoutIssues ? r.layoutIssues.length : 0}`);
    if (r.axe) {
      const vCount = r.axe.violations ? r.axe.violations.length : 0;
      const pCount = r.axe.passes ? r.axe.passes.length : 0;
      const iCount = r.axe.incomplete ? r.axe.incomplete.length : 0;
      summary.push(`Axe pass count: ${pCount}; incomplete: ${iCount}`);

      if (r.axe.violations && r.axe.violations.length) {
        for (const v of r.axe.violations.slice(0, 5)) {
          const nodes = (v.nodes || []).slice(0, 2).map(n => ({
            target: Array.isArray(n.target) ? n.target.join(', ') : (n.target || ''),
            html: truncate(n.html || ''),
            failureSummary: truncate(n.failureSummary || '')
          }));
          violationSamples.push({
            breakpoint: r.breakpoint,
            id: v.id,
            impact: v.impact,
            tags: (v.tags || []).slice(0, 6),
            help: v.help,
            helpUrl: v.helpUrl,
            description: v.description,
            nodes
          });
        }
      }
    }

    if (r.layoutIssues && r.layoutIssues.length) {
      for (const li of r.layoutIssues.slice(0, 5)) {
        layoutSamples.push({
          breakpoint: r.breakpoint,
          type: li.type,
          selector: li.selector,
          rect: li.rect || null,
          scrollWidth: li.scrollWidth || null
        });
      }
    }
  }

  const extraContext = [];
  if (violationSamples.length) {
    extraContext.push('Violation samples (per breakpoint):');
    for (const v of violationSamples) {
      extraContext.push(`- [${v.breakpoint}] ${v.id} (${v.impact || 'unknown'}): ${v.help || v.description || ''}`);
      if (v.tags && v.tags.length) extraContext.push(`  tags: ${v.tags.join(', ')}`);
      if (v.helpUrl) extraContext.push(`  helpUrl: ${v.helpUrl}`);
      if (v.nodes && v.nodes.length) {
        for (const n of v.nodes) {
          extraContext.push(`  node: ${n.target || 'unknown'} | html: ${truncate(n.html || '')} | failure: ${truncate(n.failureSummary || '')}`);
        }
      }
    }
  }

  if (layoutSamples.length) {
    extraContext.push('Layout issue samples (per breakpoint):');
    for (const li of layoutSamples) {
      extraContext.push(`- [${li.breakpoint}] ${li.type} | selector: ${li.selector || 'unknown'} | rect: ${li.rect ? JSON.stringify(li.rect) : 'n/a'} | scrollWidth: ${li.scrollWidth || 'n/a'}`);
    }
  }

  const prompt = template
    ? `${template}\n\nInputs:\n${summary.join('\n')}\n${extraContext.length ? '\n' + extraContext.join('\n') : ''}`
    : `You are an expert frontend engineer and accessibility specialist.\nAnalyze the following test run and produce a detailed structured JSON report.\n\n${summary.join('\n')}\n${extraContext.length ? '\n' + extraContext.join('\n') : ''}`;

  return prompt;
}

function localAnalyze(report) {
  // Use the comprehensive deterministic analysis system
  const deterministicAnalysis = buildDeterministicAnalysis(report);

  // Return in the expected format
  return { local: true, analysis: deterministicAnalysis };
}

async function analyzeWithLLM(report, opts = {}) {
  // Always build deterministic analysis first as a baseline
  const deterministicAnalysis = buildDeterministicAnalysis(report);

  // If explicitly requested, or if no external LLM configured, use local rule-based analysis (free/OSS)
  if (LLM_USE_LOCAL || !LLM_API_URL) {
    console.info('Using deterministic analysis (free/open-source). LLM_USE_LOCAL=', LLM_USE_LOCAL, 'LLM_API_URL=', !!LLM_API_URL);

    // Persist parsed local analysis to artifacts (same filename convention)
    try {
      const artifactDir = (report && report.reportPath) ? path.dirname(report.reportPath) : path.join(__dirname, 'artifacts');
      if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
      const baseName = (report && (report.id || (report.reportPath && path.basename(report.reportPath).replace(/-report.json$/,'')))) || 'analysis';
      const parsedPath = path.join(artifactDir, `${baseName}-analysis-parsed.json`);
      const meta = { model: 'deterministic-analyzer-v2', timestamp: new Date().toISOString() };
      const out = { parsed: deterministicAnalysis, meta, validation: 'ok' };
      fs.writeFileSync(parsedPath, JSON.stringify(out, null, 2));
      console.info('Wrote deterministic analysis to', parsedPath);
    } catch (e) {
      console.warn('Failed to write deterministic analysis', e && e.message ? e.message : e);
    }

    return { local: true, analysis: deterministicAnalysis };
  }

  const prompt = buildPrompt(report, opts.promptTemplatePath || path.join(__dirname, '..', 'templates', 'llm-prompts.md'));

  // Generic POST to LLM API that expects { prompt }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (LLM_API_TOKEN) headers['Authorization'] = `Bearer ${LLM_API_TOKEN}`;

    // helper: sleep
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    // helper: fetch with retry + timeout
    async function fetchWithRetry(url, optsFetch = {}, retries = 2, timeoutMs = 20000) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const signal = controller ? controller.signal : undefined;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const res = await fetch(url, { signal, ...optsFetch });
          if (timer) clearTimeout(timer);
          // retry on 5xx server errors
          if (res.status >= 500 && res.status < 600 && attempt < retries) {
            await sleep(250 * Math.pow(2, attempt));
            continue;
          }
          return res;
        } catch (err) {
          if (controller && err && err.name === 'AbortError') {
            // timeout - retry
            if (attempt < retries) { await sleep(250 * Math.pow(2, attempt)); continue; }
          }
          if (attempt < retries) {
            await sleep(250 * Math.pow(2, attempt));
            continue;
          }
          throw err;
        }
      }
    }

    // Detect chat-style endpoints (Hugging Face Router / OpenRouter / OpenAI chat shapes)
    const isChatEndpoint = (LLM_API_URL && (LLM_API_URL.includes('router.huggingface.co') || LLM_API_URL.includes('openrouter') || LLM_API_URL.includes('/chat') || process.env.LLM_API_MODE === 'chat' || opts.chat));
    // Detect local text-generation-webui mode (common free local setup)
    const isWebUIMode = (process.env.LLM_API_MODE === 'webui') || (LLM_API_URL && LLM_API_URL.includes(':7860'));
    // Detect Ollama local server (default port 11434)
    const isOllama = (process.env.LLM_API_MODE === 'ollama') || (LLM_API_URL && LLM_API_URL.includes(':11434'));

    let bodyPayload;
    if (isChatEndpoint) {
      // Use messages/chat completions format
      const modelName = LLM_MODEL_NAME || opts.model || process.env.LLM_MODEL_NAME || null;
      bodyPayload = {
        model: modelName,
        messages: [ { role: 'user', content: prompt } ],
        max_tokens: opts.maxTokens || 1024
      };
    } else if (isWebUIMode) {
      // text-generation-webui expects { model, input, max_new_tokens }
      const modelName = LLM_MODEL_NAME || opts.model || process.env.LLM_MODEL_NAME || null;
      bodyPayload = {
        model: modelName,
        input: prompt,
        max_new_tokens: opts.maxTokens || 1024
      };
    } else if (isOllama) {
      // Ollama expects { model, prompt, max_tokens }
      const modelName = LLM_MODEL_NAME || opts.model || process.env.LLM_MODEL_NAME || null;
      bodyPayload = {
        model: modelName,
        prompt,
        max_tokens: opts.maxTokens || 1024
      };
    } else {
      // Generic single-prompt format
      bodyPayload = { prompt, max_tokens: opts.maxTokens || 1024 };
    }
    // Choose target URL: some routers expect the chat path
    let targetUrl = LLM_API_URL;
    try {
      if (isChatEndpoint && LLM_API_URL && LLM_API_URL.includes('router.huggingface.co')) {
        targetUrl = `${LLM_API_URL.replace(/\/+$/, '')}/chat/completions`;
      }
      if (isWebUIMode && LLM_API_URL) {
        targetUrl = `${LLM_API_URL.replace(/\/+$/, '')}/api/generate`;
      }
      if (isOllama && LLM_API_URL) {
        targetUrl = `${LLM_API_URL.replace(/\/+$/, '')}/api/generate`;
      }
    } catch (e) {}

    const meta = { model: LLM_MODEL_NAME || opts.model || LLM_API_URL, timestamp: new Date().toISOString() };

    const res = await fetchWithRetry(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    }, 3, opts.timeoutMs || 120000);

    if (!res.ok) {
      const text = await res.text();

      // Attempt to persist a failure note so we have an artifact for troubleshooting
      try {
        const artifactDir = (report && report.reportPath) ? path.dirname(report.reportPath) : path.join(__dirname, 'artifacts');
        if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
        const baseName = (report && (report.id || (report.reportPath && path.basename(report.reportPath).replace(/-report.json$/,'')))) || 'analysis';
        const parsedPath = path.join(artifactDir, `${baseName}-analysis-parsed.json`);
        const out = { parsed: null, meta, fetchStatus: res.status, fetchBody: text };
        fs.writeFileSync(parsedPath, JSON.stringify(out, null, 2));
        console.info('Wrote LLM fetch-failure note to', parsedPath);
      } catch (e) {
        console.warn('Failed to write LLM fetch-failure note', e && e.message ? e.message : e);
      }

      return { error: `LLM endpoint returned ${res.status}: ${text}` };
    }

    // Read response body once (text) and attempt to parse JSON from it.
    let body = null;
    let text = null;
    try {
      // Read as text once to avoid 'body already read' errors
      text = await res.text();

      // Handle Ollama NDJSON streaming format: multiple JSON lines with { response: "..." }
      // Stitch all "response" fragments into a single text before further parsing
      if (isOllama && text && text.includes('"response"')) {
        const lines = text.split('\n').filter(l => l.trim());
        let stitched = '';
        let lastObj = null;
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            lastObj = obj;
            if (obj.response) stitched += obj.response;
          } catch (e) { /* skip non-JSON lines */ }
        }
        if (stitched) {
          text = stitched;
          body = stitched;
        } else if (lastObj && lastObj.response) {
          text = lastObj.response;
          body = lastObj.response;
        } else {
          body = text;
        }
      } else {
        try {
          body = JSON.parse(text);
        } catch (e) {
          // Not JSON — keep raw text in `body` as fallback
          body = text;
        }
      }
    } catch (e) {
      // Failed to read body
      text = null;
      body = null;
    }

    // Parse common chat/completion response shapes into a text string
    // `text` already contains the raw response text when available
    if (text === null) text = null;
    let extractedText = null;
    try {
      // OpenAI / OpenRouter / HF Router chat shape
      // Prefer structured extraction from parsed JSON-like body
      if (body && typeof body === 'object' && body.choices && Array.isArray(body.choices) && body.choices.length) {
        const c0 = body.choices[0];
        if (c0.message && (c0.message.content || c0.message)) {
          extractedText = c0.message.content || (typeof c0.message === 'string' ? c0.message : null);
        } else if (c0.text) {
          extractedText = c0.text;
        } else if (c0.delta && c0.delta.content) {
          extractedText = c0.delta.content;
        }
      }

      // text-generation-webui / HF text-generation shape
      if (!extractedText && body && typeof body === 'object') {
        if (body.generated_text) extractedText = body.generated_text;
        else if (Array.isArray(body.data) && body.data.length && body.data[0].generated_text) extractedText = body.data[0].generated_text;
        else if (Array.isArray(body) && body[0] && (body[0].generated_text || body[0].text)) extractedText = body[0].generated_text || body[0].text;
        else if (body.text || body.result || body.output) extractedText = body.text || body.result || body.output;
      }

      // If body is plain string, use it
      if (!extractedText && typeof body === 'string') extractedText = body;

      // Finally, if we have raw text from res.text(), prefer extractedText then raw text
      if (extractedText) {
        text = extractedText;
      } else if (typeof text === 'string' && text.length) {
        // keep text as-is
      } else {
        text = extractedText || text;
      }
    } catch (e) {
      text = (typeof body === 'string') ? body : JSON.stringify(body);
    }

    // Try to strip markdown fences (```json ... ``` or ``` ... ```)
    let parsed = null;
    let parseError = null;
    try {
      let cleaned = (text && typeof text === 'string') ? text.trim() : '';

      // remove ```json or ``` fences
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

      // also remove single ``` fences if present
      cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

      // Attempt JSON.parse first on whole cleaned string
      if (cleaned) {
        try {
          parsed = JSON.parse(cleaned);
        } catch (e) {
          // fall through to substring extraction below
          parseError = String(e);
        }
      }

      // If top-level parse failed, try to extract the first valid JSON block and parse it
      function extractJsonBlock(input) {
        if (!input || typeof input !== 'string') return null;
        let start = -1;
        const stack = [];
        let inString = false;
        let escape = false;
        for (let i = 0; i < input.length; i++) {
          const ch = input[i];
          if (inString) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = false; }
            continue;
          }
          if (ch === '"') { inString = true; continue; }
          if (ch === '{' || ch === '[') {
            if (start === -1) start = i;
            stack.push(ch);
          } else if (ch === '}' || ch === ']') {
            if (!stack.length) continue;
            const last = stack[stack.length - 1];
            if ((ch === '}' && last === '{') || (ch === ']' && last === '[')) {
              stack.pop();
              if (stack.length === 0 && start !== -1) {
                return input.slice(start, i + 1);
              }
            }
          }
        }
        return null;
      }

      if (!parsed && typeof cleaned === 'string' && cleaned.length) {
        const jsonBlock = extractJsonBlock(cleaned);
        if (jsonBlock) {
          try {
            parsed = JSON.parse(jsonBlock);
            parseError = null;
          } catch (e2) {
            parseError = String(e2);
          }
        }
      }

      // If still not parsed, check if the response body contains JSON-like fields
      if (!parsed && body && typeof body === 'object') {
        // common fields that may contain JSON strings
        const candidates = [ 'output', 'result', 'text', 'generated_text', 'data', 'message', 'content' ];
        for (const key of candidates) {
          if (parsed) break;
          const v = body[key];
          if (!v) continue;
          if (typeof v === 'string') {
            try { parsed = JSON.parse(v); parseError = null; break; } catch (e3) { /* ignore */ }
          }
          if (Array.isArray(v) && v.length && typeof v[0] === 'string') {
            try { parsed = JSON.parse(v[0]); parseError = null; break; } catch (e4) { /* ignore */ }
          }
        }
      }

    } catch (e) {
      parseError = String(e);
    }

    // More tolerant schema validation: accept multiple common shapes
    function isValidSchema(obj) {
      if (!obj || typeof obj !== 'object') return false;
      if (typeof obj.summary !== 'string') return false;
      // auditScore may be missing or named differently; accept numeric or missing but warn later
      if (obj.auditScore && typeof obj.auditScore !== 'number') return false;
      const countsOk = !obj.counts || typeof obj.counts === 'object';
      const issuesOk = Array.isArray(obj.issues) || Array.isArray(obj.uiIssues) || Array.isArray(obj.accessibilityIssues);
      const recOk = Array.isArray(obj.recommendations) || Array.isArray(obj.suggestions) || Array.isArray(obj.recs);
      return countsOk && issuesOk && recOk;
    }

    // ALWAYS merge LLM output with deterministic analysis to ensure comprehensive output
    const finalAnalysis = mergeWithLLMOutput(deterministicAnalysis, parsed);

    // Persist parsed JSON alongside report if available - always attempt to write a parsed-attempt file
    try {
      const artifactDir = (report && report.reportPath) ? path.dirname(report.reportPath) : path.join(__dirname, 'artifacts');
      if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

      const baseName = (report && (report.id || (report.reportPath && path.basename(report.reportPath).replace(/-report.json$/,'')))) || 'analysis';
      const parsedPath = path.join(artifactDir, `${baseName}-analysis-parsed.json`);

      const validation = finalAnalysis ? 'ok' : (parsed ? (isValidSchema(parsed) ? 'ok' : 'failed') : 'no-parse');
      const out = { 
        parsed: finalAnalysis, 
        meta: { ...meta, enriched: true, llmParsed: !!parsed }, 
        parseError: parseError || null, 
        validation, 
        rawTextExcerpt: (typeof text === 'string') ? text.slice(0, 8000) : null 
      };

      // If parsing failed, also write a helper diagnostic JSON to make debugging easier
      if (!parsed) {
        try {
          const diagPath = path.join(artifactDir, `${baseName}-analysis-diagnostic.json`);
          const diag = { meta, fetchBody: body, text: (typeof text === 'string' ? text.slice(0, 32000) : text), parseError: parseError || null, hint: 'LLM output was sparse or unparseable; using deterministic enrichment.' };
          fs.writeFileSync(diagPath, JSON.stringify(diag, null, 2));
          console.info('Wrote LLM diagnostic file to', diagPath);
        } catch (diagErr) {
          // non-fatal
        }
      }

      try {
        fs.writeFileSync(parsedPath, JSON.stringify(out, null, 2));
        console.info('Wrote enriched analysis to', parsedPath, 'validation=', validation);
      } catch (writeErr) {
        console.warn('Failed to write enriched analysis to', parsedPath, writeErr && writeErr.message ? writeErr.message : writeErr);
      }
    } catch (e) {
      // don't fail the main flow on path/create errors
      console.warn('Failed to prepare enriched analysis path', e && e.message ? e.message : e);
    }

    return { raw: body, text, prompt, meta, parsed: finalAnalysis, parseError };
  } catch (err) {
    // On error, still return deterministic analysis
    console.warn('LLM call failed, returning deterministic analysis:', err);
    return { local: true, analysis: deterministicAnalysis, error: String(err) };
  }
}

module.exports = { analyzeWithLLM, LLM_API_URL, LLM_MODEL_NAME, LLM_API_TOKEN, LLM_USE_LOCAL };
