# Verifying the changes

Two layers: the automated suite covers the logic, and a browser pass covers
everything that needs a real DOM or the `chrome.*` APIs.

## 1. Automated — 30 seconds

From `chrome-extension/`:

```bash
npm test
```

No install, no dependencies. Expect **all 379 checks passed**. Exit code is 1 on
failure, so it drops straight into CI when you want it.

What it proves, by phase (not exhaustive — the suite also covers 2.2–2.7, 3.2–3.8,
4.1–4.4, 5.1–5.4 and 6.1–6.5; see ROADMAP.md for the full phase list):

| | Checks |
|---|---|
| 0.1 Privacy gate | A saved API key does not authorise egress; with privacy mode on, **zero** network calls are attempted |
| 0.4 Brand contrast | The chosen pair comes from the page palette and clears 4.5:1; a palette that cannot pass falls back and says so |
| 2.1 Structured output | Each of the four providers receives a schema in its own dialect; the balanced-brace parser handles input the old regex failed on |
| 3.1 Judgment layer | Flags bad alt and link text, and — importantly — leaves the control cases alone |
| 3.2 Vision analysis | Each provider's multimodal shape (inlineData / base64 / image_url) round-trips without throwing |
| 3.8 Impairment simulation | Every preset's feColorMatrix has the 20 values a filter requires |
| 6.5 PR generation | The 4-call API sequence (ref → branch → commit → PR) runs in the right order from the right base |
| 1.1 Fix export | Diff format is correct and invents no line numbers |

## 2. Browser — 5 minutes

**Reload first.** `chrome://extensions/` → reload icon on the SiteScope 360 card.
Service worker and `lib/` changes need this; popup changes only need the popup
reopened.

Open `tests/fixture.html` in a tab (drag the file into Chrome). It is built to
**pass** axe-core and Lighthouse while still being unpleasant with a screen
reader — which is exactly the case the judgment layer exists for.

### The demo, in order

1. **Scan.** Accessibility issues should be zero or near zero. That is the point:
   the automated audit is happy.
2. **Scroll to "Beyond automated checks."** Expect exactly **5 findings**, each
   tagged *Passes automated checks*:
   - `alt="IMG_4471.jpg"` — filename as alt text
   - `alt="image"` — names the medium
   - `"click here"`
   - a raw URL used as link text
   - *3 links read "Read more" but go to 3 different pages*

   Five, not eight: repeated findings are grouped. The three `"Read more"` links
   collapse into the single duplicate-destination card, which already says both
   that the text is uninformative and that the destinations differ.

   On a real site expect cards carrying a **×N** chip — six images with
   `alt="Picture"` is one card, not six. **Show me** then walks through the
   affected elements one per click and shows `2/6` as it goes.
3. **Check the controls were not flagged.** The panniers photo, "download the
   2026 frame fitting guide", the labelled email field, and the decorative image
   must all be absent. Any of them appearing is a false positive.
4. **Click "Show me"** on a finding — the page should scroll to the element and
   flash it.
5. **Open a real violation → Apply Fix → verify** the outline turns green.
6. **Copy Diff**, paste into an editor. Expect a patch with `- ` / `+ ` lines and
   a selector rather than a line number.

### Credibility fixes to confirm by eye

- **No confetti**, ever — including on a perfect score.
- **The intro word does not cycle**; it reads "Accessible" and stays.
- **One PRO badge** in the header, not two.
- **Grade agrees with status.** A score of 89 must not show "Grade A" next to
  "At Risk". Grade A now needs ≥ 90 with zero criticals, and the wording says
  *passes all automated WCAG 2.1 AA checks*, not *meets WCAG 2.1 AA*.
- **Tips tab** — the audience card leads with the measured issue count. There
  should be **no "~N% of visitors"** figure anywhere; that number used to be
  `issues / 3 + 4` presented as a measurement.
- **No "Google is penalising your site."** The SEO card now says plainly that
  accessibility is not a ranking factor.
- **UX Analysis** should read as measurements — "5 font families detected" —
  with no verdicts about design rigour or polish.

### Privacy gate, if you have a key saved

With **Privacy Mode on**, open DevTools → Network on the service worker and run a
fix. There should be no request to `generativelanguage.googleapis.com`,
`api.openai.com`, `api.anthropic.com` or `api.mistral.ai`. Turn Privacy Mode off
and the call appears — with redacted content.

## 3. Reading the diff

```bash
git -C .. diff --stat -- chrome-extension
git -C .. diff -- chrome-extension/lib/llm-router.js
```

All of `lib/` beyond the original scanner/router pair, plus `tests/`, `ROADMAP.md`
and `presentation/`, are untracked or modified — `git status` lists them
separately. Nothing has been committed.
