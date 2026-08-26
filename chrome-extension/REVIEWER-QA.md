
1. "Is it a wrapper for GLHS or AXE?"

> No. It finds problems that pass both. Automated rules — Lighthouse and
> axe-core included — catch roughly a third of real WCAG issues. SiteScope 360
> finds the rest: alt text that reads "IMG_4471.jpg", links that say "click
> here", six "Read more" links going to six different pages. Every one of
> these findings is on an element that already passed the automated audit.

2. "WCAG has become part of GLHS long back"


> Correct, and that is the floor, not the ceiling. Lighthouse's accessibility
> audit is axe-core under the hood, covering the checks a rule engine can
> express. SiteScope 360 starts where that coverage ends — content quality,
> keyboard behaviour, and screen-reader sequence, none of which are
> expressible as a static rule.

---

### 3. "Where is automation in the solution?"
**✅ SHIPPED**

> The fix is generated, applied to the page, and re-tested automatically. If
> the violation is still there, it tries a different approach and tells you
> what failed. Confidence decides how much is trusted without a person
> checking it — high-confidence fixes apply automatically, everything else is
> flagged or held for review.

*Demo: click Fix & Verify on a live issue. Watch it apply, re-scan, and
confirm.*

---

### 4. "What is the USP?"
**✅ SHIPPED**

> Find it. Fix it. Prove it. Every competing tool stops at the report. This
> one writes the correction, applies it, re-scans to confirm the violation
> is gone, and hands you the patch — in your framework's own dialect.

---

### 5. "No code can be fixed in browser"
**✅ SHIPPED**

> It does more than fix it in the browser — it exports the change. Every fix
> can be copied as a diff, or exported as one patch file for the whole
> session, ready to paste into your codebase or a PR description.

*Demo: click Copy Diff on any fix. Show the patch.*

---

### 6. "How does this work?"
**✅ SHIPPED**

> Four steps, all in the browser, all live: **Scan** the page with axe-core.
> **Fix** — the model writes the correction, using page-inspection tools to
> read real computed styles rather than guessing. **Verify** — re-scan
> confirms the violation cleared. **Export** — the fix leaves as a diff, in
> your framework's syntax, or as a dated compliance record.

---

### 7. "Greenfield — no longer looked at"
**✅ SHIPPED**

> Retargeted. This now leads with live and legacy sites, migrations, and
> continuous coverage — where the volume of real work actually is.

---

### 8. "GLHS does it in minutes"
**✅ SHIPPED**

> Lighthouse scans in seconds. It does not fix anything. The weeks in a
> manual audit are spent on remediation, not detection — and that is the
> part this automates: generate the fix, apply it, verify it, in the same
> few seconds Lighthouse takes to scan.

---

### 9. "GTmetrix does it on live site with load balancing"
**✅ SHIPPED**

> It now scans an entire site, not one page. Point it at a sitemap and it
> crawls every page in background tabs, aggregates the results, and surfaces
> which problems repeat across the most pages — one systemic fix instead of
> forty separate ones.

*Demo: Export tab → Scan Whole Site. Point it at their sitemap.*

---

## Built since this doc was last checked against the code

These six were tracked here as "not yet built." They are now implemented and
covered by the automated suite (`npm test`, 379 checks) — but **none have been
rehearsed as a live demo yet**. Verify each one in the browser before offering
to show it live; "implemented and tested" is not the same claim as "I've
driven this in front of someone."

| Item | What it adds | Where it lives |
|---|---|---|
| Vision analysis (screenshot-based checks) | Catches problems only visible, not in the DOM | `lib/vision.js` |
| Pull request generation | Fix goes straight into a PR instead of a copied diff | `lib/github.js` |
| Ambient / scheduled scanning | Runs on its own, flags regressions after a deploy | `lib/ambient.js` |
| Conversational control | "Fix everything critical, skip colours" | `lib/chat.js` |
| VPAT / ACR draft | Auto-drafts the procurement conformance document | `lib/vpat.js` |
| Team / agency features | Shared workspaces, white-label reports | `lib/team-sync.js`, `lib/branding.js` |

If a reviewer asks about any of them and it hasn't been rehearsed yet, say "that
ships today, let me show you after the call" rather than either overclaiming a
live demo you haven't tried, or calling it roadmap when it already exists —
both are the kind of thing this doc exists to prevent.

---

## The one thing that actually wins this

The deck earns you the meeting. The nine answers above earn you five more
minutes of trust. What closes it is running the four-step demo — scan, fix,
verify, export — on a page **they** choose, not one you prepared. That is
the only thing that fully answers "is it real."
