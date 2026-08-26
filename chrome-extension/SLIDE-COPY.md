# SiteScope 360 — slide copy (drop-in replacements)

Same slide, same sections. Each block below replaces the text already in that
slot. No new sections.

---

## 1 · Eyebrow  *(unchanged)*

ACCESSIBILITY · CHROME EXTENSION

## 2 · Title  *(unchanged)*

SiteScope 360

## 3 · Subtitle

**Find it. Fix it. Prove it.**

## 4 · Intro paragraph

Built on axe-core and benchmarked against Google Lighthouse — and it goes past
both. SiteScope 360 writes the fix, applies it to the page, and re-tests to prove
the violation is gone.

## 5 · USP  *(one bullet becomes three)*

- Other tools stop at the report. This one delivers the fix and proves it worked.
- Finds the problems that pass Lighthouse and axe — the ones a checklist cannot see.
- Runs on any website, any platform. Nothing to install, nothing to integrate.

---

## 6 · Key Features  *(all three replaced)*

**Finds What the Checklists Miss**
Automated rules catch roughly a third of real WCAG problems. SiteScope 360 flags
what passes them — alt text reading "IMG_4471.jpg", links that say "click here",
six "Read more" links going to six different pages.

**Fixes, Verifies, Ships**
Generates the correction, applies it, re-scans to confirm it cleared, and tries a
different approach if it didn't. Hands you the patch in your framework's own
dialect.

**Evidence You Can File**
A dated record of what was found, fixed and verified — mapped to WCAG, with a
full change log for compliance and legal.

---

## 7 · Where It Fits  *(cards 01, 03 and 04 rewritten; 02, 05, 06 tightened)*

**01 — Live & Legacy Sites**  [MOST SITES]
Most sites were never built accessible. Scan what is already live, fix it, and
prove the fix held.

**02 — Platform Migration**  [ZERO REGRESSION]
Baseline the source, scan the new build continuously, catch regressions before
they ship.

**03 — Continuous Coverage**  [WHOLE ESTATE]
Check every release across your sites instead of auditing one page a quarter.

**04 — Audit Remediation**  [THE EXPENSIVE PART]
An audit tells you what is wrong. This does the fixing that comes after — the
part that actually takes weeks.

**05 — Pre-Launch Gate**  [QUALITY GATE]
Nothing deploys carrying critical violations.

**06 — Client Pitches**  [DEAL CLOSER]
Scan a prospect's live site and show them what their current tooling missed.

---

## 8 · Footer line

Works with any website — Adobe, WordPress, Drupal, Sitecore or custom. Nothing to
install into your platform. Private by default; cloud AI is opt-in and redacted.

---

# Which note each change answers

| Reviewer's note | Where it is answered now |
|---|---|
| "What is the USP?" | Subtitle + USP bullet 1 |
| "Is it a wrapper for GLHS or AXE?" | Intro names both, then Key Feature 1 shows what they miss |
| "WCAG has become part of GLHS long back" | Key Feature 1 — Lighthouse covers about a third; this covers what it passes |
| "Is it a replacement to GLHS or GT Metrix?" | Intro: *goes past both*. GTmetrix is not mentioned — it is a performance tool |
| "Where is automation in the solution?" | Key Feature 2 — applies, re-scans, retries, reports |
| "No code can be fixed in browser" | Key Feature 2 — *hands you the patch in your framework's dialect* |
| "How does this work?" | Intro + Key Feature 2 read as one sequence: write → apply → re-test → hand over |
| "Greenfield — no longer looked at" | Card 01 replaced with live and legacy sites |
| "GLHS does it in minutes" | Card 04 no longer claims to replace audits — it claims the remediation after one |
| "GTmetrix does live sites with load balancing" | Card 03 — continuous coverage across the estate |

# Removed, and why

- **"~4% visitors blocked, $490B market at stake"** — the 4% was calculated as
  `issues ÷ 3 + 4` and shown as a measurement. It has been taken out of the
  product, so leaving it on the slide is now the bigger risk.
- **"Lighthouse + axe-core" as a headline feature** — moved into the intro as
  foundation rather than headline. As a feature it argued the reviewer's case.
- **"Replace 2–4 week manual audits with a scan in seconds"** — Lighthouse also
  scans in seconds. Unwinnable framing.
- **"and Lighthouse" in card 05** — one fewer place inviting the wrapper question.

# Forward-looking capability, and how it is placed

Pull requests, multi-page crawling, conversational control and vision checks are
now implemented and covered by the automated suite (`npm test`, 379 checks) —
this section previously said "not yet shipped," which stopped being true once
`lib/github.js`, `lib/crawl.js`, `lib/chat.js` and `lib/vision.js` landed. They
still appear only in **Where It Fits**, which describes *use cases* rather than
a feature inventory, so no change is needed there — cards 02, 03 and 06 already
read correctly for an estate-wide, PR-capable tool. Nothing in **Key Features**
claims anything that cannot be demonstrated today.

**Caveat that still matters:** implemented and unit-tested is not the same claim
as rehearsed live. None of these four have been walked through as a live demo
yet — confirm each one in the browser before offering to show it in a meeting,
rather than either overclaiming a demo you haven't tried or calling it roadmap
when it already exists.

Practical effect: every sentence on the slide survives "show me". If asked about
scale, the honest answer is that both page-level and estate-wide (whole-site)
scanning ship today — a far better position than being caught underselling a
feature the reviewer then finds already exists.
