# SiteScope 360 — Pitch Script

A spoken script, not slide bullets. Read it out loud once before presenting —
if a line feels awkward in your mouth, change it, that's what this draft is for.

**Runtime:** ~9 minutes narrated, ~13 with the live demo block. Cut sections
marked *(optional)* to fit a shorter slot.

**Demo dependency:** every **[DEMO]** block has a **[NO-DEMO FALLBACK]** right
under it. If you're not driving a laptop, skip straight to the fallback line —
the pitch stands on its own either way.

---

## The 2-minute version

For when you get thirty seconds in a hallway, not a meeting slot. Covers the
whole tool end to end — problem, solution, how it works, proof, close. Read
it out loud once; it lands around two minutes at a natural pace.

> Every accessibility tool on the market — Lighthouse, axe, WAVE, GTmetrix —
> does the same job: it tells you what's broken. That part's been free for
> years. The expensive part is everything after — a developer reading each
> violation, working out the right fix, writing it, and someone else
> confirming it actually worked. That's where a two-to-four-week audit cycle
> really goes. SiteScope 360 is built for that second half. It finds what
> Lighthouse and axe already pass and still isn't good enough — content
> that's technically fine but genuinely unusable, keyboard behavior no
> static check can see. Then it writes the fix, applies it, and — for the
> flagship single-issue flow — re-scans the same element to prove the
> violation is actually gone before it ever reports success.
>
> Most of that runs on free, instant, rule-based logic — AI only gets
> involved for the genuinely ambiguous cases. The result ships as something
> a developer can actually use — a real diff, or a real pull request, in
> their own framework's syntax — and as something compliance can actually
> file: a dated, honestly-scoped evidence report
> that never claims more than what was tested. Every other tool in this
> space stops at the report. We finish the job.

---

## 1. Open on the cost, not the tool (30 sec)

> Every accessibility tool on the market — Lighthouse, axe, WAVE, GTmetrix —
> does the same thing: it tells you what's broken. That part's been free for
> years.
>
> The expensive part is what happens *after*. A developer reads the
> violation, works out the right fix, writes it, and someone else confirms
> it actually worked. That cycle is where the two-to-four-week accessibility
> audit actually goes.
>
> SiteScope 360 is built for that second half. Find it. Fix it. Prove it.

That line — **find it, fix it, prove it** — is the whole pitch in four words.
Everything after this is evidence for that sentence.

---

## 2. The thesis, stated precisely (45 sec)

> Here's the claim, and I want to be precise about it: automated accessibility
> checks — Lighthouse's audit included — mechanically verify roughly a third
> of what WCAG actually requires. That's not a knock on Lighthouse. It's a
> ceiling built into what a static rule engine can check at all. A rule can
> confirm an `alt` attribute exists. It cannot tell you whether the words in
> it mean anything.
>
> SiteScope 360 starts exactly where that ceiling is. It finds what passes
> the automated audit and is still useless. It writes the fix. It re-scans to
> *prove* the fix worked, not just claim it did. And it ships the result as
> something a developer can actually use — a diff, a pull request, in their
> own framework's syntax.

---

## 3. Show, don't tell — the wrapper objection, killed live

This is the section that matters most if anyone in the room already thinks
"isn't this just Lighthouse with a nicer UI?" Don't wait for them to ask.

### **[DEMO]**

> Let's use a page you pick — not one I prepared.

1. Run Lighthouse (or the built-in scan) on the page. Let the accessibility
   score land — often 90+.
2. Run SiteScope 360's judgment scan. Point at the **Beyond automated
   checks** panel.
3. Read one finding out loud verbatim — ideally an `alt="IMG_4471.jpg"` or a
   run of "Read more" links pointing at different pages. Let the room see the
   *Passes automated checks* tag on the card.

> That's the whole objection answered in one screen. Lighthouse passed this
> page. We didn't.

### **[NO-DEMO FALLBACK]**

> Concretely: an image with `alt="IMG_4471.jpg"` passes every automated
> check — the attribute exists, rule satisfied. We flag it, because the
> question a rule engine literally cannot ask is whether that text describes
> anything. We also catch what no single-element check can ever see — three
> links on a page that each individually pass, all reading "Read more," each
> pointing somewhere different. Automated tools check one element at a time.
> We compare elements to each other. That's a different category of
> analysis, not a better rule.

---

## 4. Fix it, verify it (60 sec)

### **[DEMO]**

1. Open one real violation. Click **Fix & Verify**.
2. Narrate the status line as it updates: *generating → applying →
   re-scanning*.
3. Let it land on **verified** — the outline turns green.

> It didn't just apply a patch and hope. It re-ran the exact same check
> against the exact same element and confirmed the violation is gone. If it
> hadn't cleared, it would have tried a different approach automatically —
> up to three attempts — before telling us honestly that this one needs a
> person.

### **[NO-DEMO FALLBACK]**

> The loop is: generate a fix, apply it, re-scan, and if it's still broken,
> retry with full memory of what didn't work — the model is handed the exact
> failed patch and told explicitly what to avoid, so attempt two is informed,
> not repeated. Confidence decides how much of this runs unattended: high
> confidence applies on its own, medium applies and flags itself for review,
> anything lower is shown but never touched without a person.

---

## 5. Ship it where developers actually work (45 sec)

### **[DEMO]** *(optional — skip if the room is non-technical)*

1. Click **Copy Diff** on the fix from step 4.
2. Paste it into any editor. Point out: real selector, real WCAG citation,
   before/after — not a screenshot of a suggestion.

> If the page is React, this comes out as `className` and a proper JSX style
> object, not raw HTML the developer has to translate first. If it's Vue or
> Angular, we leave it as plain HTML — because those templates already accept
> it as-is, and pretending a conversion was needed would just be dishonest.
>
> And if the repo is connected, this doesn't stop at a copied diff — it opens
> as a real pull request. Real branch, real commit, ready for review.

> One thing I want to be upfront about: it does *not* silently rewrite files
> in your codebase. There's no reliable way for a browser extension to know
> which of possibly several source files produced a given element on the
> page — claiming that confidence would be worse than not having the feature
> at all. So the PR documents every fix for a human to review and merge. It
> finishes the job right at the edge of what it can verify, and stops there.

---

## 6. The evidence, for whoever isn't in this room (60 sec)

This is the section for legal, procurement, or whoever signs the budget and
isn't watching the demo.

> Everything so far has been about developers. This part is for compliance.
>
> Every scan produces a dated record — what was found, what was fixed, and
> critically, what was *verified* versus what was merely applied. Those are
> different states in the data, not just in the wording: a patch that was
> applied but never re-confirmed is reported as applied, never as fixed.
>
> It can also draft a VPAT — the conformance report procurement asks for —
> criterion by criterion. And here's the discipline I'd ask you to hold us
> to: it never marks a criterion as "Supports." Automated and heuristic
> testing covers a fraction of what any single WCAG criterion actually
> requires, and claiming full support would be exactly the kind of overclaim
> that gets a vendor's accessibility statement thrown out in due diligence.
> Three honest states only — does not support, partially supports, not
> evaluated — and it says so on the document itself.

---

## 7. Objections, answered before they're raised *(optional — use if time-boxed)*

Pick two or three that fit the room. Full answers live in `REVIEWER-QA.md`
if you need to go deeper live.

**"Isn't this just Lighthouse with extra steps?"**
> Lighthouse's accessibility category *is* axe-core. We don't compete with
> it, we start where its coverage ends.

**"Does it scale past one page?"**
> Point it at a sitemap and it crawls the site in background tabs, then
> ranks findings by how many pages share the same broken pattern — one
> systemic fix instead of forty separate ones.

**"What happens to our data?"**
> Nothing leaves the machine by default. Cloud AI is opt-in, and anything
> that could leave is redacted first — and fails closed, meaning if
> redaction can't run, the raw content is withheld rather than sent anyway.

**"What's still on the roadmap, not shipped?"**
> Say it plainly if asked — don't let a forward-looking claim slip in as
> present tense. As of this pitch, everything described above is shipped and
> demoable.
>
> This script doesn't narrate every shipped feature — it's a 9-minute pitch,
> not a walkthrough. Three that are built and tested but not mentioned above:
> screenshot-based vision analysis (catches problems that only exist visually,
> not in markup), background/ambient scanning after the first manual scan of a
> page, and plain-English chat control over which issues to fix. If asked, these
> are "yes, shipped, not part of tonight's walkthrough" — not "not built yet."
> Team/agency white-labelling exists too but is genuinely a secondary feature
> for most audiences; mention only if relevant. Anything truly not covered
> anywhere in this script or in ROADMAP.md, treat as not built.

---

## 8. The close (20 sec)

> Every other tool in this space stops at the report. We finish the job —
> we find the issue, fix it, prove the fix held, and hand it to a developer
> in a form they can actually use. That's not a bigger feature list. It's a
> different finish line.
>
> [State the actual ask here: a pilot, a follow-up demo on their own site,
> a budget conversation — whatever this specific meeting needs.]

---

## Speaker notes

- **Let them pick the URL in section 3.** A prepared demo page gets
  discounted; a URL they choose in the room doesn't. This is the single
  highest-leverage moment in the whole script.
- **Don't over-promise in Q&A.** If asked about something not in this
  script, it's fine to say "that's roadmap, not shipped" — a reviewer who
  catches one overclaim discounts everything that came before it.
- **If the demo breaks live**, don't debug it in front of the room. Say "let
  me follow up with that on a call" and move to the no-demo fallback for
  that section. The fallback lines exist for exactly this.
