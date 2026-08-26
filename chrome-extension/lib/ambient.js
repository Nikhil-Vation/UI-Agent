/**
 * Ambient background scanning.
 *
 * The trust boundary here matters more than the feature: this scans pages the
 * user did NOT just click a button for, so it only ever operates on a page the
 * user has already scanned manually at least once. A URL with no prior scan in
 * history is never touched — ambient scanning widens what happens to pages
 * already opted into, it does not widen which pages get scanned.
 *
 * It also only ever speaks up about regressions. A page getting better in the
 * background is not something worth interrupting someone for.
 */

const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000;   // don't re-scan the same URL more than once per 10 min
const SCORE_DROP_THRESHOLD = 5;               // a few points of noise is normal; this is a real regression

/**
 * Most recent history entry for this exact URL, or null if the user has never
 * scanned it — which is the signal that gates whether ambient scanning may run.
 */
function findBaseline(history, url) {
  const matches = (history || []).filter(e => e.url === url);
  if (!matches.length) return null;
  return matches.reduce((latest, e) => (e.timestamp > latest.timestamp ? e : latest));
}

/**
 * Whether an ambient (unattended) scan of this URL is allowed right now.
 * `lastAmbientScanAt` is a per-tab in-memory timestamp the caller tracks —
 * kept outside this function so it stays a pure decision given its inputs.
 */
function shouldAmbientScan(url, history, enabled, lastAmbientScanAt = 0, now = Date.now()) {
  if (!enabled || !url) return false;
  if (!findBaseline(history, url)) return false;               // never scan an unopted-in page
  if (now - lastAmbientScanAt < DEFAULT_COOLDOWN_MS) return false;
  return true;
}

/**
 * Compare a fresh scan against the baseline. Only ever reports a regression —
 * an improvement or a flat result returns `regressed: false` and no message.
 */
function detectRegression(baseline, freshAnalysis) {
  if (!baseline || !freshAnalysis) return { regressed: false };

  const prevScore = baseline.score ?? 100;
  const newScore  = freshAnalysis.auditScore ?? 100;
  const prevCritical = baseline.counts?.critical ?? 0;
  const newCritical  = freshAnalysis.counts?.critical ?? 0;

  const scoreDropped   = prevScore - newScore >= SCORE_DROP_THRESHOLD;
  const criticalsAdded = newCritical > prevCritical;

  if (!scoreDropped && !criticalsAdded) return { regressed: false };

  const parts = [];
  if (criticalsAdded) parts.push(`${newCritical - prevCritical} new critical issue${newCritical - prevCritical > 1 ? 's' : ''}`);
  if (scoreDropped)   parts.push(`score dropped ${prevScore - newScore} points`);

  return {
    regressed: true,
    scoreDelta: newScore - prevScore,
    criticalDelta: newCritical - prevCritical,
    message: `This page got worse since it was last scanned: ${parts.join(', ')}.`
  };
}

const AMBIENT = { DEFAULT_COOLDOWN_MS, SCORE_DROP_THRESHOLD };

export { findBaseline, shouldAmbientScan, detectRegression, AMBIENT };
