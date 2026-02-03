const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const axeCore = require('axe-core');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_BREAKPOINTS = [
  { name: 'mobile-320', width: 320, height: 800 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1024', width: 1024, height: 900 }
];

async function runTests({ url, breakpoints = DEFAULT_BREAKPOINTS, artifactDir = path.join(__dirname, 'artifacts') }) {
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  const id = uuidv4();
  const out = { id, url, timestamp: new Date().toISOString(), results: [] };
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    // Navigation timeout (ms) can be tuned via env PLAYWRIGHT_NAV_TIMEOUT_MS
    const navTimeout = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '120000', 10);

    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      // Try navigating with a generous timeout; if networkidle times out,
      // fall back to domcontentloaded and record failure artifacts.
      let navigated = false;
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: navTimeout });
        navigated = true;
      } catch (navErr) {
        console.warn(`Navigation (networkidle) failed for ${url} at ${bp.name}: ${navErr.message}`);
        try {
          // Fallback: less strict wait, same timeout
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
          navigated = true;
        } catch (navErr2) {
          console.error(`Fallback navigation also failed for ${url} at ${bp.name}: ${navErr2.message}`);
          // attempt to capture whatever we can for debugging
          const failScreenshotPath = path.join(artifactDir, `${id}-${bp.name}-failed.png`);
          try { await page.screenshot({ path: failScreenshotPath, fullPage: true }); } catch (e) { /* ignore */ }
          const failHtmlPath = path.join(artifactDir, `${id}-${bp.name}-failed.html`);
          try { const html = await page.content(); fs.writeFileSync(failHtmlPath, html); } catch (e) { /* ignore */ }

          // Record an error result for this breakpoint and continue
          out.results.push({
            breakpoint: bp.name,
            width: bp.width,
            height: bp.height,
            error: true,
            errorMessage: navErr2.message,
            screenshot: failScreenshotPath,
            htmlSnapshot: failHtmlPath
          });
          // skip to next breakpoint
          continue;
        }
      }

      // Give the page a small moment to settle
      await page.waitForTimeout(500);

      // Screenshot
      const screenshotPath = path.join(artifactDir, `${id}-${bp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // DOM snapshot (outerHTML of body)
      const dom = await page.evaluate(() => document.documentElement.outerHTML);

      // Inject axe-core and run accessibility scan
      const axeSource = axeCore.source;
      await page.addScriptTag({ content: axeSource });
      const axeResults = await page.evaluate(async () => {
        return await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      });

      // Run simple layout heuristics to detect overflow/clipping/horizontal scroll
      const layoutIssues = await page.evaluate(() => {
        // Helper: build a simple selector
        function getSelector(el) {
          if (!el) return null;
          if (el.id) return `#${el.id}`;
          if (el.className && typeof el.className === 'string' && el.className.trim()) {
            return el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/).join('.');
          }
          return el.tagName.toLowerCase();
        }

        const issues = [];
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const all = Array.from(document.querySelectorAll('body *'));
        for (const el of all) {
          try {
            const style = window.getComputedStyle(el);
            if (!style) continue;
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
            const rect = el.getBoundingClientRect();
            if (!rect || rect.width === 0 || rect.height === 0) continue;

            // overflowing content inside an element (text overflow)
            if (el.scrollWidth > rect.width + 1) {
              issues.push({
                type: 'overflowing-content',
                selector: getSelector(el),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
                scrollWidth: Math.round(el.scrollWidth)
              });
            }

            // element clipped outside viewport horizontally
            if (rect.right > viewportWidth + 1) {
              issues.push({
                type: 'clipped-element',
                selector: getSelector(el),
                rect: { right: Math.round(rect.right), left: Math.round(rect.left) }
              });
            }
          } catch (e) {
            // ignore cross-origin frames or read errors
          }
        }

        // Detect horizontal scrolling on body/html
        const docOverflowX = (document.documentElement && document.documentElement.scrollWidth > (document.documentElement.clientWidth || 0)) || (document.body && document.body.scrollWidth > (document.body.clientWidth || 0));
        if (docOverflowX) {
          issues.push({ type: 'horizontal-scroll', selector: 'html, body' });
        }

        return issues.slice(0, 100);
      });

      out.results.push({
        breakpoint: bp.name,
        width: bp.width,
        height: bp.height,
        screenshot: screenshotPath,
        domSnapshotLength: dom ? dom.length : 0,
        axe: axeResults,
        layoutIssues
      });
    }

    await page.close();
    await context.close();
  } finally {
    await browser.close();
  }

  // write JSON summary
  const reportPath = path.join(artifactDir, `${id}-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
  out.reportPath = reportPath;
  return out;
}

module.exports = { runTests };
