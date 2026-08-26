/**
 * Public score badge — an embeddable, self-contained SVG a site owner can put
 * in a README or footer. The free acquisition channel: every badge links back
 * to the tool that produced it.
 *
 * "Verifiable" here means something specific and honest, not a live third-party
 * verification service — this product has no backend to host one, and claiming
 * otherwise would be exactly the kind of overclaim the rest of it exists to
 * avoid. What IS true: the score is a real SVG <text> element, not a flattened
 * image, so it's inspectable by view-source; the scan date is printed on the
 * badge itself, so staleness is visible rather than hidden; and the badge is
 * explicit that it reflects one point-in-time scan, not a live feed.
 */
(function (root) {
  'use strict';

  function gradeColor(score) {
    if (score >= 90) return '#10b981';
    if (score >= 70) return '#d4a017';
    return '#e74c3c';
  }

  function escXml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** Self-contained shields.io-style badge. No external fonts, no network calls. */
  function buildBadgeSvg({ score, scannedAt = Date.now() } = {}) {
    const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
    const color = gradeColor(s);
    const dateLabel = new Date(scannedAt).toISOString().slice(0, 10);
    const labelW = 92, valueW = 40, w = labelW + valueW, h = 20;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="accessibility score: ${s}">
  <title>SiteScope 360 — scanned ${escXml(dateLabel)}</title>
  <linearGradient id="ssb-sheen" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity="0"/></linearGradient>
  <clipPath id="ssb-clip"><rect width="${w}" height="${h}" rx="3"/></clipPath>
  <g clip-path="url(#ssb-clip)">
    <rect width="${labelW}" height="${h}" fill="#1a0a2e"/>
    <rect x="${labelW}" width="${valueW}" height="${h}" fill="${color}"/>
    <rect width="${w}" height="${h}" fill="url(#ssb-sheen)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="14">a11y score</text>
    <text x="${labelW + valueW / 2}" y="14">${s}</text>
  </g>
</svg>`;
  }

  /**
   * Base64-encode the SVG as a data URI. `btoa` cannot handle the SVG's
   * non-Latin1 characters directly (an em dash, an accented name in a client
   * profile) — the escape/encodeURIComponent round trip is the standard way
   * to get arbitrary UTF-8 text through `btoa`, which only accepts Latin1.
   */
  function svgToDataUri(svg) {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }

  /**
   * Markdown embed a user copies into a README. Explicit about what the badge
   * does and doesn't claim — deliberately not styled as a live/dynamic badge.
   * Takes the already-built SVG rather than rebuilding it, so the embedded
   * image and the standalone SVG file this ships alongside can never drift
   * apart into two different badges.
   */
  function buildBadgeEmbed({ score, scannedAt = Date.now(), pageUrl = '', svg = '' } = {}) {
    const dateLabel = new Date(scannedAt).toISOString().slice(0, 10);
    const s = Math.round(score ?? 0);
    const src = svg ? svgToDataUri(svg) : '';
    return [
      `![Accessibility score: ${s}](${src})`,
      '',
      `Scanned ${dateLabel} with SiteScope 360${pageUrl ? ` — ${pageUrl}` : ''}.`,
      'This reflects one point-in-time scan, not a live or continuously updated result.',
      'Re-scan and replace this badge to keep it current.'
    ].join('\n');
  }

  root.Badge = { gradeColor, buildBadgeSvg, buildBadgeEmbed, svgToDataUri };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Badge;
})(typeof globalThis !== 'undefined' ? globalThis : self);
