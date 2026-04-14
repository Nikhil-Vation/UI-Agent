/**
 * SiteScope 360 — Auth & Subscription Module
 *
 * Tiers:
 *   free  — 3 scans / day, no AI suggestions, no Live Preview
 *   pro   — unlimited scans, AI suggestions, Live Preview, priority Lighthouse
 *   team  — pro + team seats (future)
 *
 * Auth flow:
 *   1. Check chrome.storage.local for a cached session token
 *   2. Validate token against AUTH_API_URL (lightweight /me endpoint)
 *   3. If invalid/expired → show login gate
 *   4. On login success → cache token + user object
 *
 * Free usage (no account):
 *   - User can dismiss login gate and use free tier
 *   - Daily scan counter stored in storage
 */

/* ─── Config ─── */
export const AUTH_API_URL  = 'http://localhost:3000';  // TODO: replace with real endpoint
export const CHECKOUT_URL  = 'http://localhost:8000/pricing'; // TODO: replace with Stripe checkout
export const STORAGE_KEY   = 'ss360_session';
export const USAGE_KEY     = 'ss360_usage';

export const PLANS = {
  free: {
    label:       'Free',
    color:       '#6b7280',
    scansPerDay:  3,
    aiSuggestions: false,
    livePreview:  false,
    lighthouse:   false,
  },
  pro: {
    label:       'Pro',
    color:       '#8b5cf6',
    scansPerDay:  Infinity,
    aiSuggestions: true,
    livePreview:  true,
    lighthouse:   true,
    price:        '$9 / mo',
  },
  team: {
    label:       'Team',
    color:       '#06b6d4',
    scansPerDay:  Infinity,
    aiSuggestions: true,
    livePreview:  true,
    lighthouse:   true,
    price:        '$29 / mo',
  },
};

/* ─── Session helpers ─── */

export async function getSession() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

export async function saveSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

/**
 * Validate the cached token with the server.
 * Returns { valid, user, plan } or { valid: false }.
 * Fails gracefully — if server is unreachable, use cached plan.
 */
export async function validateSession(session) {
  if (!session?.token) return { valid: false };

  try {
    const res = await fetch(`${AUTH_API_URL}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return { valid: false };
    const data = await res.json();
    return { valid: true, user: data.user, plan: data.plan };
  } catch {
    // Network error — trust cached plan (offline support)
    if (session.plan) {
      return { valid: true, user: session.user, plan: session.plan, offline: true };
    }
    return { valid: false };
  }
}

/**
 * Attempt to sign in with email + password.
 * Returns { ok, token, user, plan, error }.
 */
export async function signIn(email, password) {
  try {
    const res = await fetch(`${AUTH_API_URL}/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Sign-in failed' };

    return { ok: true, token: data.token, user: data.user, plan: data.plan };
  } catch (err) {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

/**
 * Sign up a new user.
 * Returns { ok, token, user, plan, error }.
 */
export async function signUp(email, password) {
  try {
    const res = await fetch(`${AUTH_API_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Sign-up failed' };

    return { ok: true, token: data.token, user: data.user, plan: data.plan || 'free' };
  } catch (err) {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

/* ─── Usage / rate limiting ─── */

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function getUsage() {
  const result = await chrome.storage.local.get(USAGE_KEY);
  const usage = result[USAGE_KEY] || {};
  const today = todayKey();
  return {
    scansToday: usage.date === today ? (usage.scans || 0) : 0,
    date: today,
  };
}

export async function incrementScanCount() {
  const result = await chrome.storage.local.get(USAGE_KEY);
  const usage = result[USAGE_KEY] || {};
  const today = todayKey();
  const scans = (usage.date === today ? (usage.scans || 0) : 0) + 1;
  await chrome.storage.local.set({ [USAGE_KEY]: { date: today, scans } });
  return scans;
}

/**
 * Check if the user can perform a scan.
 * Returns { allowed, reason, scansToday, limit }.
 */
export async function canScan(plan) {
  const planDef = PLANS[plan] || PLANS.free;
  if (planDef.scansPerDay === Infinity) return { allowed: true };

  const { scansToday } = await getUsage();
  const allowed = scansToday < planDef.scansPerDay;
  return {
    allowed,
    scansToday,
    limit: planDef.scansPerDay,
    reason: allowed ? null : `Free plan limit: ${planDef.scansPerDay} scans/day. Upgrade to Pro for unlimited scans.`,
  };
}
