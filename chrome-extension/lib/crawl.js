/**
 * Multi-page crawl — scan an estate, not a URL.
 *
 * Pure logic only: discovery parsing, URL filtering and aggregation. Tab
 * orchestration lives in the service worker because it needs chrome.* APIs.
 */
(function (root) {
  'use strict';

  const DEFAULT_LIMIT = 25;

  // Things that are not pages. Scanning a PDF or an image wastes a tab and
  // produces a meaningless result.
  const NON_PAGE = /\.(pdf|jpe?g|png|gif|webp|svg|avif|ico|css|js|json|xml|zip|mp4|webm|woff2?|ttf)(\?|$)/i;

  /**
   * Extract locations from a sitemap. Handles both a urlset and a sitemapindex —
   * large sites publish the latter, and treating it as a urlset silently yields
   * nested sitemap files instead of pages.
   */
  function parseSitemap(xml) {
    if (!xml || typeof xml !== 'string') return { urls: [], isIndex: false };
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].trim());
    return { urls: locs, isIndex: /<sitemapindex[\s>]/i.test(xml) };
  }

  /**
   * Same-origin, de-duplicated, page-like, capped.
   *
   * Same-origin is a hard rule rather than a preference: crawling off-site would
   * mean scanning third parties who never consented to it.
   */
  function filterCrawlUrls(urls, { origin = '', limit = DEFAULT_LIMIT } = {}) {
    const seen = new Set();
    const out = [];

    for (const raw of (urls || [])) {
      let u;
      try { u = new URL(raw, origin || undefined); } catch { continue; }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      if (origin && u.origin !== origin) continue;
      if (NON_PAGE.test(u.pathname)) continue;

      u.hash = '';
      const key = u.href;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
      if (out.length >= limit) break;
    }
    return out;
  }

  /**
   * Roll page results into an estate-level view.
   *
   * Pages that failed to scan are counted separately and never folded into the
   * totals — a page that could not be reached is not a page with zero issues,
   * and averaging it in would quietly flatter the score.
   */
  function aggregateCrawl(results) {
    const pages = [];
    const failed = [];
    const totals = { critical: 0, serious: 0, moderate: 0, minor: 0, issues: 0 };
    const byRule = new Map();

    for (const r of (results || [])) {
      if (!r || r.error || !r.analysis) {
        failed.push({ url: r?.url || '(unknown)', error: r?.error || 'scan failed' });
        continue;
      }
      const issues = r.analysis.issues || [];
      const counts = r.analysis.counts || {};

      totals.critical += counts.critical || 0;
      totals.serious  += counts.serious  || 0;
      totals.moderate += counts.moderate || 0;
      totals.minor    += counts.minor    || 0;
      totals.issues   += issues.length;

      for (const i of issues) {
        const id = i.ruleId || i.id;
        byRule.set(id, (byRule.get(id) || 0) + 1);
      }

      pages.push({
        url: r.url,
        score: r.analysis.auditScore ?? null,
        issueCount: issues.length,
        critical: counts.critical || 0
      });
    }

    const scored = pages.filter(p => typeof p.score === 'number');
    return {
      pagesScanned: pages.length,
      pagesFailed: failed.length,
      failed,
      totals,
      averageScore: scored.length
        ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length)
        : null,
      worstPages: [...pages].sort((a, b) => b.issueCount - a.issueCount).slice(0, 5),
      // The same rule failing across many pages is one systemic fix, not N fixes.
      commonRules: [...byRule.entries()]
        .map(([ruleId, pageCount]) => ({ ruleId, pageCount }))
        .sort((a, b) => b.pageCount - a.pageCount)
        .slice(0, 10)
    };
  }

  root.Crawl = { parseSitemap, filterCrawlUrls, aggregateCrawl, DEFAULT_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Crawl;
})(typeof globalThis !== 'undefined' ? globalThis : self);
