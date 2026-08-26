/**
 * Impairment simulation.
 *
 * Filters applied over the live page to show, rather than tell, what a visual
 * impairment does to it. No model, no network — SVG filter matrices and CSS,
 * the same technique browser DevTools uses for its own vision-deficiency
 * emulation. This is the fastest thing in the product to turn a skeptic:
 * the effect is on their own page, instantly, and needs no explanation.
 *
 * The color matrices are the standard Brettel/Viénot approximations used by
 * Chrome DevTools and most accessibility tooling — not invented here.
 */
(function (root) {
  'use strict';

  const COLOR_MATRICES = {
    protanopia:   '0.567,0.433,0,0,0  0.558,0.442,0,0,0  0,0.242,0.758,0,0  0,0,0,1,0',
    deuteranopia: '0.625,0.375,0,0,0  0.7,0.3,0,0,0  0,0.3,0.7,0,0  0,0,0,1,0',
    tritanopia:   '0.95,0.05,0,0,0  0,0.433,0.567,0,0  0,0.475,0.525,0,0  0,0,0,1,0',
    achromatopsia:'0.299,0.587,0.114,0,0  0.299,0.587,0.114,0,0  0.299,0.587,0.114,0,0  0,0,0,1,0'
  };

  const PRESETS = {
    protanopia:    { label: 'Protanopia (red-blind)',      filter: 'url(#sitescope-protanopia)' },
    deuteranopia:  { label: 'Deuteranopia (green-blind)',  filter: 'url(#sitescope-deuteranopia)' },
    tritanopia:    { label: 'Tritanopia (blue-blind)',     filter: 'url(#sitescope-tritanopia)' },
    achromatopsia: { label: 'Achromatopsia (no color)',    filter: 'url(#sitescope-achromatopsia)' },
    lowVision:     { label: 'Low vision (blur)',           filter: 'blur(2.5px) contrast(0.9)' },
    contrastLoss:  { label: 'Contrast sensitivity loss',   filter: 'contrast(0.55) brightness(1.08)' }
  };

  function presetList() {
    return Object.entries(PRESETS).map(([key, v]) => ({ key, ...v }));
  }

  /** SVG feColorMatrix defs, injected once so the CSS filter: url(#id) refs resolve. */
  function buildSvgDefs() {
    const filters = Object.entries(COLOR_MATRICES).map(([name, values]) => `
      <filter id="sitescope-${name}" color-interpolation-filters="linearRGB">
        <feColorMatrix type="matrix" values="${values}"/>
      </filter>`).join('');
    return `<svg id="sitescope-impairment-defs" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
      <defs>${filters}</defs></svg>`;
  }

  /**
   * Apply a preset to the live page. Runs in the MAIN world, so it takes the
   * preset table and SVG markup as arguments rather than closing over the
   * module — nothing outside this function's own scope survives serialization
   * across chrome.scripting.executeScript.
   * `key: null` removes the effect and cleans up the injected defs.
   */
  function applyImpairment(key, presets, svgDefsHtml) {
    // This runs in the page's MAIN world in the browser, where `document`
    // always exists. The guard exists only so the return-value contract can be
    // unit tested in Node without a DOM.
    if (typeof document === 'undefined') return { active: (key && presets[key]) ? key : null };

    document.getElementById('sitescope-impairment-defs')?.remove();
    document.documentElement.style.filter = '';
    if (!key || !presets[key]) return { active: null };

    if (svgDefsHtml) {
      const holder = document.createElement('div');
      holder.innerHTML = svgDefsHtml;
      document.body.appendChild(holder.firstElementChild);
    }
    document.documentElement.style.filter = presets[key].filter;
    return { active: key };
  }

  root.Impairment = { PRESETS, presetList, buildSvgDefs, applyImpairment, COLOR_MATRICES };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Impairment;
})(typeof globalThis !== 'undefined' ? globalThis : self);
