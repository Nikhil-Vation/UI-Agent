/**
 * Historical trend — scan history already persists; this turns it into a
 * per-page arc instead of a flat list of past scans.
 */
(function (root) {
  'use strict';

  /** Entries for one exact URL, oldest first — the shape everything else here builds on. */
  function entriesForUrl(history, url) {
    return (history || [])
      .filter(e => e.url === url)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Summarize the arc for a URL: first score, latest score, direction and
   * magnitude of the change. `direction` is 'flat' below a small threshold so a
   * one-point wobble between runs doesn't get reported as "worse".
   */
  function buildUrlTrend(history, url) {
    const entries = entriesForUrl(history, url);
    if (entries.length < 2) return { entries, count: entries.length, delta: 0, direction: 'flat' };

    const first = entries[0];
    const latest = entries[entries.length - 1];
    const delta = (latest.score ?? 0) - (first.score ?? 0);
    const direction = delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';

    return { entries, count: entries.length, first, latest, delta, direction };
  }

  /**
   * Normalize a list of scores to an SVG polyline `points` string.
   * A single point still renders as a flat line rather than throwing on
   * division by zero — a one-scan page has a trend of "nothing to show yet",
   * not a broken sparkline.
   */
  function buildSparklinePoints(scores, width = 80, height = 20) {
    const vals = (scores || []).filter(s => typeof s === 'number');
    if (!vals.length) return '';
    if (vals.length === 1) return `0,${height / 2} ${width},${height / 2}`;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const stepX = width / (vals.length - 1);

    return vals
      .map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
      .join(' ');
  }

  function directionSymbol(direction) {
    return direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  }

  root.Trend = { entriesForUrl, buildUrlTrend, buildSparklinePoints, directionSymbol };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Trend;
})(typeof globalThis !== 'undefined' ? globalThis : self);
