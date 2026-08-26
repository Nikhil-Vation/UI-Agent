# Where AI Is Actually Used

`ARCHITECTURE.md` has a summary table for this. This file is the expanded
version — every place in the product that calls an AI model, in plain
sentences: where it happens, what triggers it, and what it's actually asked
to do. If a capability isn't listed here, it doesn't use AI, full stop.

There are **seven** places AI gets called. Not seven features — seven call
sites. Everything else in the product is rule-based logic that only hands
off to one of these seven when it genuinely needs to.

---

## 1. Writing a fix for an issue the rule engine can't confidently solve

**Where:** `lib/llm-router.js`, the `generateFix` function. Triggered every
time you click **Fix & Verify** or **Apply All**.

**How it's used:** Before AI is even considered, roughly forty hand-written
rule handlers try to solve the issue outright — deriving alt text from a
filename, matching a label to its input, fixing an invalid ARIA value. If
one of those handlers is confident (a fixed threshold, 70% or higher), its
answer is used and **no AI call happens at all**. Only when nothing in that
rule set is confident does the request go to an AI provider — on-device
Chrome AI first if available, then whichever cloud provider is configured,
then a local server as a last resort. The AI is given the issue, the WCAG
rule it violates, and the actual HTML, and is forced to answer in a fixed
shape: a title, the before code, the after code, a one-line explanation, an
effort estimate, and a confidence score. It cannot reply with anything
outside that shape.

**Why AI specifically:** These are the cases where a fixed rule genuinely
doesn't know the right answer — a button with ambiguous purpose, a heading
that's technically fine but contextually wrong. That needs judgment, not a
lookup table.

---

## 2. Understanding a whole page at once

**Where:** `lib/llm-router.js`, the `generateFullAnalysis` function.
Triggered when you scan a page and the extension pre-fetches suggestions for
every issue in one pass, rather than one AI call per issue.

**How it's used:** Every violation found on the page — not just one — is
sent to the AI in a single request, along with the detected tech stack and
brand colors. It's asked to return a plain-English summary of the page's
state, a priority order for which issues matter most, a phased action plan
(immediate / short-term / long-term), and a fix for each issue, all in one
structured response.

**Why AI specifically:** Prioritizing forty issues on a real page needs
context a rule can't have — which ones actually block a user's task versus
which are cosmetic. And batching this into one call instead of forty is
also just cheaper and faster.

---

## 3. Looking at the real page before answering, not guessing from a snippet

**Where:** `lib/dom-tools.js` plus the tool-calling loop inside
`lib/llm-router.js` (`_callProviderWithTools`). Runs as part of call #1
above, only for the harder cases.

**How it's used:** Instead of handing the AI a short, possibly-truncated
piece of HTML and hoping that's enough, the AI is given **tools** it can
call before it has to answer — ask for the element's full context and ARIA
attributes, ask for the *actual computed* CSS color (not what's written in
a stylesheet, what the browser actually renders), search for other matching
elements on the page, or look at the elements immediately around it. It can
call these as many times as it needs, then submits its final answer through
the same fixed-shape mechanism as call #1.

**Why AI specifically:** A contrast fix based on a guessed color is often
wrong. A contrast fix based on the real, browser-computed color is usually
right. Letting the model ask before answering is what makes that
difference possible.

---

## 4. Trying again, informed by what already failed

**Where:** Still `generateFix`, but with a critical difference — this is
what happens on the second and third attempt inside the **Fix & Verify**
loop (`remediateIssue` in `popup.js`), after the first fix was applied and
the re-scan showed the violation was still there.

**How it's used:** The exact fix that just failed is included in the next
request, along with the fact that it didn't work. The rule-engine
short-circuit from call #1 is deliberately skipped on a retry — a rule
handler is a pure function, so asking it again would just return the same
answer that already failed. Only the AI can genuinely try something
different, because it's the only part of the system that can be told
"that didn't work, try another approach."

**Why AI specifically:** This is what turns "here's a suggestion" into "31
of 34 fixed, and here's exactly why the other 3 need a person" — a system
that can't learn from its own failed attempt would just loop forever or
give up after one try.

---

## 5. A second look at what the free checks already let through

**Where:** `lib/judgment-llm.js`, the `runJudgmentNuancePass` function.
Runs automatically after every scan, but **only if** cloud AI is reachable
and an API key is configured — it's skipped entirely under Privacy Mode,
same as every other cloud call.

**How it's used:** The free heuristic layer (see `ARCHITECTURE.md` for what
that catches on its own, at zero cost) already flags the obvious cases —
alt text that's a filename, "click here" links. This pass shows the AI only
what that layer explicitly let through, and asks it to look for the
genuinely ambiguous remainder: alt text that's grammatically fine but
actually describes the wrong thing, a heading that sounds specific but
doesn't match what follows it. The prompt tells it outright: a false
finding here costs more trust than a missed one, so stay quiet unless
you're confident.

**Why AI specifically:** A fixed vocabulary list can catch "click here." It
cannot catch alt text that's well-written but factually wrong — that needs
something that can actually compare the description to the content.

---

## 6. Finding problems only visible in a screenshot

**Where:** `lib/vision.js`, the `analyzeScreenshot` function. Triggered by
the **Visual Scan** button in the Export tab — this one is manual, not
automatic, since it's the most expensive call in the product.

**How it's used:** The visible part of the tab is captured as an image and
sent to a model capable of reading images (all four supported providers
can). The prompt explicitly rules out anything checkable from markup —
missing alt attributes, missing labels — since those are already covered
by calls #1 and #5. It's asked to look only for what genuinely requires
sight: text sitting on a busy background, a focus indicator that exists in
the code but is invisible against its surroundings, meaning conveyed only
through color, layout that's visibly broken.

**Why AI specifically:** None of this exists anywhere in the page's HTML —
it's purely a property of how the page *renders*. There's no data structure
to write a rule against; you have to actually look.

---

## 7. Describing what an image actually shows

**Where:** `lib/vision.js`, the `describeImageFromVision` function.
Triggered by the **Describe with AI** button that appears on a judgment
finding when an image's alt text has already been flagged as poor quality.

**How it's used:** This fetches the specific flagged image's real pixel
data — not a screenshot of the whole tab, just that one image — and asks
for a single concise, literal sentence describing what it shows. It's a
narrower, cheaper version of call #6, used only when there's already a
known problem to solve rather than scanning the whole page speculatively.

**Why AI specifically:** Writing accurate alt text requires knowing what's
actually in the picture. A filename or surrounding text can't substitute
for that.

---

## 8. Turning a typed instruction into a safe, bounded action

**Where:** `lib/chat.js`, the `interpretChatCommand` function. Triggered by
typing into the chat box — e.g. *"fix everything critical but don't touch
colors"* — and pressing **Go**.

**How it's used:** The AI receives your instruction and the real list of
rule IDs found on the current page, and is forced to reply with a fixed
structure: whether to apply fixes or just list matches, which severities to
include, which specific rules to include or exclude, and a one-sentence
confirmation of what it understood. It does **not** touch your issues
directly. A completely separate, plain function — no AI, no network call —
takes that structured answer and does the actual filtering. If the AI
returns something malformed or empty, that function can only narrow the
result to nothing; it has no path to accidentally select issues you never
asked about.

**Why AI specifically:** Turning free-form English into a structured filter
is exactly what language understanding is for. Keeping the *execution* of
that filter in plain code — not AI — is what makes a bad AI answer harmless
instead of dangerous.

---

## How the same call works across four different providers

Every one of the seven call sites above can run on Gemini, OpenAI,
Anthropic, or Mistral, using whichever one you've configured with your own
API key — plus on-device Chrome AI for the simpler cases, with no cloud
call at all. This works through one shared function in `lib/llm-router.js`
that speaks each provider's native dialect for enforcing a fixed response
shape: Gemini's `responseSchema`, OpenAI and Mistral's `json_schema` mode,
and Anthropic's forced tool-call mechanism (its API has no equivalent
built-in setting, so a tool call is used to get the same guarantee). The
call site itself — the fix generator, the vision module, the chat
interpreter — never has to know which provider answered; it always gets
back the same shape either way.

---

## What is deliberately *not* AI

Worth stating as plainly as the usage above, because the boundary matters
as much as the capability:

- **The initial scan** — axe-core, a rule engine, zero AI.
- **Keyboard, focus, and screen-reader checks** — measured directly from
  the page's real behavior, not inferred by a model.
- **Whether a fix auto-applies, gets flagged, or is only shown** — a fixed
  confidence-score threshold, not an AI judgment call.
- **Verification** — a second, independent re-scan with the same rule
  engine. The system never simply trusts its own fix.
- **The compliance evidence pack and VPAT draft** — assembled entirely from
  data already collected elsewhere. A conformance document whose contents
  came from "the AI felt confident" would not hold up to scrutiny, so
  nothing in it is AI-generated.
- **The estimated cost meter** — arithmetic against a published pricing
  table, not a model call.
- **Multi-page crawling and regression detection** — orchestration and
  score comparison; the individual page scans it triggers may eventually
  reach AI through call #1, but the crawling and comparison logic itself
  never does.
