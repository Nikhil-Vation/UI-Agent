# UI-Agent Architecture & Data Flow

## 🏗️ System Overview

This document provides a comprehensive visual and technical breakdown of how the UI-Agent accessibility and UI quality checking system works.

---

## 📊 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER INTERFACE                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                         demo.html (Landing Page)                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │  🌐 URL Input: https://example.com                        [Run ➤]        │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  │                                    ▼                                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐    │   │
│  │  │              <ai-accelerator-widget> Web Component                       │    │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │    │   │
│  │  │  │  Score   │ │ Critical │ │ Serious  │ │ Moderate │ │  Minor   │      │    │   │
│  │  │  │   Ring   │ │  Issues  │ │  Issues  │ │  Issues  │ │  Issues  │      │    │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │    │   │
│  │  │  ┌────────────────────────────────────────────────────────────────┐    │    │   │
│  │  │  │  Issues List | UI Issues | Top Fixes | Recommendations | Plan  │    │    │   │
│  │  │  └────────────────────────────────────────────────────────────────┘    │    │   │
│  │  └─────────────────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                         │                                               │
│                              HTTP Request│POST /run                                     │
│                                         ▼                                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               ORCHESTRATOR SERVER                                        │
│                                 (Express.js - Port 3000)                                │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              index.js (Main Entry)                                 │  │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  POST /run        → Runs full accessibility analysis                        │  │  │
│  │  │  GET  /meta       → Fetches page metadata (title, favicon)                  │  │  │
│  │  │  GET  /llm/test   → Tests LLM connectivity                                  │  │  │
│  │  │  GET  /artifacts  → Serves screenshots, reports (static files)             │  │  │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                         │                                               │
│               ┌─────────────────────────┼─────────────────────────┐                    │
│               ▼                         ▼                         ▼                    │
│  ┌────────────────────┐   ┌────────────────────────┐   ┌────────────────────┐         │
│  │  playwrightRunner  │   │      llmClient.js       │   │   artifacts/       │         │
│  │       .js          │   │  (Analysis Engine)      │   │   (Storage)        │         │
│  └────────────────────┘   └────────────────────────┘   └────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               STEP-BY-STEP DATA FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │  1. USER INPUT   │
    │  ────────────────│
    │  Enter URL and   │
    │  click "Run"     │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐        POST /run { url: "https://..." }
    │  2. DEMO.HTML    │ ─────────────────────────────────────────────────────┐
    │  ────────────────│                                                       │
    │  • Captures URL  │                                                       │
    │  • Shows loading │                                                       │
    │  • Scrolls to    │                                                       │
    │    results area  │                                                       │
    └──────────────────┘                                                       │
                                                                               │
                                                                               ▼
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │  3. ORCHESTRATOR (index.js)                                                       │
    │  ─────────────────────────────────────────────────────────────────────────────── │
    │                                                                                   │
    │  app.post('/run', async (req, res) => {                                          │
    │      const { url } = req.body;                                                   │
    │                                                                                   │
    │      // Step 3a: Run Playwright tests                                            │
    │      const result = await runner.runTests({ url, artifactDir });                 │
    │                                                                                   │
    │      // Step 3b: Analyze with LLM/Deterministic engine                           │
    │      const analysis = await llm.analyzeWithLLM(result);                          │
    │                                                                                   │
    │      // Step 3c: Save and return results                                         │
    │      res.json({ report: result, analysis, artifacts });                          │
    │  });                                                                              │
    └──────────────────────────────────────────────────────────────────────────────────┘
                    │                              │
                    ▼                              ▼
    ┌──────────────────────────┐    ┌──────────────────────────────────────────────────┐
    │  4. PLAYWRIGHT RUNNER    │    │  5. LLM CLIENT (Analysis Engine)                  │
    │  ────────────────────────│    │  ─────────────────────────────────────────────── │
    │  playwrightRunner.js     │    │  llmClient.js                                     │
    │                          │    │                                                   │
    │  For each breakpoint:    │    │  ┌─────────────────────────────────────────────┐ │
    │  • mobile-320 (320px)    │    │  │  DETERMINISTIC ENRICHMENT                   │ │
    │  • mobile-375 (375px)    │    │  │  ─────────────────────────────────────────  │ │
    │  • tablet-768 (768px)    │    │  │  • WCAG_DATABASE (60+ rules)                │ │
    │  • desktop-1024 (1024px) │    │  │  • FIX_SUGGESTIONS (code fixes)             │ │
    │                          │    │  │  • LAYOUT_FIX_SUGGESTIONS                   │ │
    │  Actions per breakpoint: │    │  │  • buildDeterministicAnalysis()             │ │
    │  ┌────────────────────┐  │    │  └─────────────────────────────────────────────┘ │
    │  │ 1. Set viewport    │  │    │                    │                             │
    │  │ 2. Navigate to URL │  │    │                    ▼                             │
    │  │ 3. Screenshot      │  │    │  ┌─────────────────────────────────────────────┐ │
    │  │ 4. Inject axe-core │  │    │  │  LLM ENHANCEMENT (Optional)                 │ │
    │  │ 5. Run a11y scan   │  │    │  │  ─────────────────────────────────────────  │ │
    │  │ 6. Detect layout   │  │    │  │  • Ollama (localhost:11434)                 │ │
    │  │    issues          │  │    │  │  • OpenAI API compatible                    │ │
    │  └────────────────────┘  │    │  │  • HuggingFace                              │ │
    │                          │    │  │  • Custom LLM endpoint                      │ │
    └──────────┬───────────────┘    │  └─────────────────────────────────────────────┘ │
               │                     │                    │                             │
               │                     │                    ▼                             │
               │                     │  ┌─────────────────────────────────────────────┐ │
               │                     │  │  OUTPUT: Merged Analysis                    │ │
               │                     │  │  ─────────────────────────────────────────  │ │
               │                     │  │  • summary (score, counts, compliance)      │ │
               │                     │  │  • issues[] (detailed a11y violations)      │ │
               │                     │  │  • uiIssues[] (layout/responsive bugs)      │ │
               │                     │  │  • recommendations[]                        │ │
               │                     │  │  • topFixes[]                               │ │
               │                     │  │  • actionPlan (immediate/short/long-term)   │ │
               │                     │  │  • bestPractices[]                          │ │
               │                     │  └─────────────────────────────────────────────┘ │
               │                     └──────────────────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │  6. ARTIFACTS GENERATED                                                           │
    │  ─────────────────────────────────────────────────────────────────────────────── │
    │                                                                                   │
    │  orchestrator/artifacts/                                                          │
    │  ├── {uuid}-mobile-320.png      ← Screenshot at 320px width                      │
    │  ├── {uuid}-mobile-375.png      ← Screenshot at 375px width                      │
    │  ├── {uuid}-tablet-768.png      ← Screenshot at 768px width                      │
    │  ├── {uuid}-desktop-1024.png    ← Screenshot at 1024px width                     │
    │  ├── {uuid}-report.json         ← Raw Playwright/axe results                     │
    │  └── {uuid}-analysis.json       ← Enriched analysis with fixes                   │
    │                                                                                   │
    └──────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │  7. RESPONSE TO CLIENT                                                            │
    │  ─────────────────────────────────────────────────────────────────────────────── │
    │                                                                                   │
    │  {                                                                                │
    │    "report": { id, url, timestamp, results[], reportPath },                      │
    │    "analysis": { summary, issues[], uiIssues[], recommendations[], ... },        │
    │    "artifacts": { screenshots[], reportUrl, analysisUrl }                        │
    │  }                                                                                │
    │                                                                                   │
    └──────────────────────────────────────────────────────────────────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │  8. WIDGET RENDERING                                                              │
    │  ─────────────────────────────────────────────────────────────────────────────── │
    │                                                                                   │
    │  ai-accelerator-widget.js                                                         │
    │                                                                                   │
    │  ┌────────────────────────────────────────────────────────────────────────────┐  │
    │  │  loadData(analysis) → Parses response and renders:                         │  │
    │  │                                                                            │  │
    │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
    │  │  │ Score Ring   │  │ Stats Cards  │  │ Compliance   │  │ Issues List  │   │  │
    │  │  │ (0-100)      │  │ (Counts)     │  │ Status Grid  │  │ (Expandable) │   │  │
    │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │
    │  │                                                                            │  │
    │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
    │  │  │ UI Issues    │  │ Top Fixes    │  │ Recommend-   │  │ Action Plan  │   │  │
    │  │  │ Grid         │  │ Priority     │  │ ations       │  │ Timeline     │   │  │
    │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │
    │  └────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                   │
    └──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure & Responsibilities

```
UI-Agent/
│
├── 📂 orchestrator/                    # Backend Server
│   │
│   ├── 📄 index.js                     # Express.js server entry point
│   │   └── Routes:
│   │       ├── POST /run               # Main analysis endpoint
│   │       ├── GET  /meta              # Fetch page metadata
│   │       ├── GET  /llm/test          # Test LLM connectivity
│   │       └── GET  /artifacts/*       # Serve static files
│   │
│   ├── 📄 playwrightRunner.js          # Browser automation & scanning
│   │   └── Functions:
│   │       └── runTests({ url, breakpoints })
│   │           ├── Launch Chromium (headless)
│   │           ├── For each breakpoint:
│   │           │   ├── Set viewport size
│   │           │   ├── Navigate to URL
│   │           │   ├── Take full-page screenshot
│   │           │   ├── Inject axe-core
│   │           │   ├── Run WCAG 2.0 A/AA scan
│   │           │   └── Detect layout issues
│   │           └── Save report JSON
│   │
│   ├── 📄 llmClient.js                 # Analysis & enrichment engine
│   │   └── Components:
│   │       ├── WCAG_DATABASE           # 60+ accessibility rules
│   │       │   └── { criteria, title, section508, ada, disabilities, severity, effort }
│   │       │
│   │       ├── FIX_SUGGESTIONS         # Code fix templates
│   │       │   └── { explanation, impact, problemCode, fixCode, fix }
│   │       │
│   │       ├── LAYOUT_FIX_SUGGESTIONS  # Responsive design fixes
│   │       │   └── { explanation, impact, problemCode, fixCode, fix }
│   │       │
│   │       ├── buildDeterministicAnalysis(report)
│   │       │   └── Transforms raw axe data into detailed issues
│   │       │
│   │       ├── mergeWithLLMOutput(deterministic, llmOutput)
│   │       │   └── Combines LLM insights with deterministic data
│   │       │
│   │       └── analyzeWithLLM(report, opts)
│   │           └── Main entry: builds analysis + optional LLM enhancement
│   │
│   ├── 📂 artifacts/                   # Generated files storage
│   │   ├── {uuid}-mobile-320.png
│   │   ├── {uuid}-mobile-375.png
│   │   ├── {uuid}-tablet-768.png
│   │   ├── {uuid}-desktop-1024.png
│   │   ├── {uuid}-report.json
│   │   └── {uuid}-analysis.json
│   │
│   └── 📄 package.json                 # Node.js dependencies
│       └── Dependencies:
│           ├── express
│           ├── playwright
│           ├── axe-core
│           └── uuid
│
├── 📂 ui-agent/                        # Frontend Components
│   │
│   ├── 📄 demo.html                    # Main landing page
│   │   └── Features:
│   │       ├── URL input form
│   │       ├── Progress indicator
│   │       ├── Site metadata display
│   │       └── Widget host container
│   │
│   ├── 📄 ai-accelerator-widget.js     # Web Component
│   │   └── class AIAcceleratorWidget extends HTMLElement
│   │       ├── runAnalysis(url, endpoint)    # Trigger new scan
│   │       ├── loadData(data)                # Load existing data
│   │       ├── _renderDashboard()            # Main render
│   │       ├── _renderScoreAndStats()        # Score ring + cards
│   │       ├── _renderIssuesSection()        # A11y issues list
│   │       ├── _renderUIIssuesSection()      # Layout issues
│   │       ├── _renderTopFixes()             # Priority fixes
│   │       ├── _renderRecommendations()      # Suggestions
│   │       ├── _renderActionPlan()           # Timeline phases
│   │       └── _renderBestPractices()        # Tips
│   │
│   ├── 📄 ai-accelerator-widget.css    # Modern dashboard styles
│   │   └── Features:
│   │       ├── Dark theme (slate blue)
│   │       ├── CSS custom properties
│   │       ├── Responsive grid layouts
│   │       ├── Animated score ring
│   │       ├── Card-based design
│   │       └── Print-friendly styles
│   │
│   └── 📄 landing.css                  # Landing page styles
│
├── 📂 templates/
│   └── 📄 llm-prompts.md               # LLM prompt templates
│
└── 📂 docs/
    ├── 📄 ACCESSIBILITY.md             # Accessibility guidelines
    └── 📄 ARCHITECTURE.md              # This file
```

---

## 🔧 Component Details

### 1. Playwright Runner (`playwrightRunner.js`)

```javascript
// Core scanning logic
async function runTests({ url, breakpoints, artifactDir }) {
    // 1. Generate unique ID for this run
    const id = uuidv4();
    
    // 2. Launch headless Chromium
    const browser = await chromium.launch({ headless: true });
    
    // 3. For each breakpoint (320, 375, 768, 1024px)
    for (const bp of breakpoints) {
        // 3a. Set viewport dimensions
        await page.setViewportSize({ width: bp.width, height: bp.height });
        
        // 3b. Navigate and wait for network idle
        await page.goto(url, { waitUntil: 'networkidle' });
        
        // 3c. Capture full-page screenshot
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // 3d. Inject axe-core accessibility engine
        await page.addScriptTag({ content: axeCore.source });
        
        // 3e. Run WCAG 2.0 A/AA compliance scan
        const axeResults = await page.evaluate(() => 
            axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })
        );
        
        // 3f. Detect layout issues (overflow, clipping, horizontal scroll)
        const layoutIssues = await page.evaluate(() => {
            // Check for elements overflowing containers
            // Check for horizontal scrollbar
            // Check for clipped elements outside viewport
        });
    }
    
    // 4. Save report JSON and return
    fs.writeFileSync(reportPath, JSON.stringify(out, null, 2));
    return out;
}
```

### 2. LLM Client (`llmClient.js`)

```javascript
// Deterministic enrichment flow
function buildDeterministicAnalysis(report) {
    const issues = [];
    const uiIssues = [];
    
    for (const result of report.results) {
        // Process each axe violation
        for (const violation of result.axe.violations) {
            const wcagMeta = WCAG_DATABASE[violation.id];  // Lookup metadata
            const fixMeta = FIX_SUGGESTIONS[violation.id]; // Lookup fix
            
            issues.push({
                id: `ISSUE-${n}`,
                title: violation.help,
                severity: mapImpactToSeverity(violation.impact),
                wcagCriteria: wcagMeta.criteria,      // e.g., ['1.1.1']
                section508: wcagMeta.section508,      // e.g., ['1194.22(a)']
                ada: wcagMeta.ada,                    // e.g., ['Title III']
                disabilitiesAffected: wcagMeta.disabilities,
                selectors: extractSelectors(violation.nodes),
                code: {
                    problem: fixMeta.problemCode,
                    fix: fixMeta.fixCode
                },
                suggestedFix: fixMeta.fix,
                effort: wcagMeta.effort  // S/M/L
            });
        }
        
        // Process layout issues
        for (const layoutIssue of result.layoutIssues) {
            const layoutMeta = LAYOUT_FIX_SUGGESTIONS[layoutIssue.type];
            uiIssues.push({
                type: layoutIssue.type,
                breakpoint: result.breakpoint,
                selector: layoutIssue.selector,
                explanation: layoutMeta.explanation,
                suggestedFix: layoutMeta.fix
            });
        }
    }
    
    // Calculate score and generate recommendations
    return {
        summary: { auditScore, complianceStatus, counts },
        issues,
        uiIssues,
        recommendations,
        topFixes,
        actionPlan: { immediate, shortTerm, longTerm },
        bestPractices
    };
}
```

### 3. Widget Component (`ai-accelerator-widget.js`)

```javascript
class AIAcceleratorWidget extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    
    // Load data and render dashboard
    loadData(data) {
        this._data = data;
        this._render();
    }
    
    _renderDashboard() {
        return `
            ${this._renderHeader()}           // URL and title
            ${this._renderScoreAndStats()}    // Score ring + stat cards
            ${this._renderComplianceStatus()} // WCAG/508/ADA badges
            ${this._renderIssuesSection()}    // Expandable issue cards
            ${this._renderUIIssuesSection()}  // Layout issues grid
            ${this._renderTopFixes()}         // Priority list
            ${this._renderRecommendations()}  // Numbered suggestions
            ${this._renderActionPlan()}       // Timeline phases
            ${this._renderBestPractices()}    // Tips cards
            ${this._renderFooter()}           // Timestamp
        `;
    }
}

customElements.define('ai-accelerator-widget', AIAcceleratorWidget);
```

---

## 🌊 Request Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE REQUEST LIFECYCLE                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

Time ─────────────────────────────────────────────────────────────────────────────────────►

 t=0ms      t=50ms        t=500ms           t=2-5s              t=5-10s        t=10-15s
   │          │              │                  │                   │              │
   ▼          ▼              ▼                  ▼                   ▼              ▼
┌──────┐  ┌───────┐    ┌──────────┐      ┌───────────┐       ┌──────────┐   ┌──────────┐
│ User │  │ Show  │    │  Fetch   │      │ Playwright│       │   LLM    │   │  Render  │
│Click │→ │Loading│ →  │ Metadata │  →   │   Scan    │   →   │ Analyze  │ → │Dashboard │
│"Run" │  │ State │    │ (title,  │      │ (4 break- │       │ (Enrich  │   │ (Widget  │
│      │  │       │    │  favicon)│      │  points)  │       │  + LLM)  │   │  update) │
└──────┘  └───────┘    └──────────┘      └───────────┘       └──────────┘   └──────────┘
   │                         │                  │                   │              │
   │                         │                  │                   │              │
   │     Progress: 5%    Progress: 15%    Progress: 35-70%    Progress: 70-95%   100%
   │          ▼              ▼                  ▼                   ▼              ▼
   │     ┌─────────────────────────────────────────────────────────────────────────────┐
   │     │ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
   │     │ ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
   │     │ █████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
   │     │ ██████████████████████████████████████████████████████████████████████████████│
   │     └─────────────────────────────────────────────────────────────────────────────┘
   │
   │
   └────────────────────────────────────────────────────────────────────────────────────►
                                        User Experience
```

---

## 📊 Data Structures

### Raw Report (from Playwright)

```json
{
  "id": "fba960bf-bbe9-4393-a364-fa968c138931",
  "url": "https://automationbookstore.dev/",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "results": [
    {
      "breakpoint": "mobile-320",
      "width": 320,
      "height": 800,
      "screenshot": "./artifacts/fba960bf-mobile-320.png",
      "axe": {
        "violations": [
          {
            "id": "html-has-lang",
            "impact": "serious",
            "help": "html element must have a lang attribute",
            "nodes": [{ "target": ["html"], "html": "<html>..." }]
          }
        ],
        "passes": [...],
        "incomplete": [...]
      },
      "layoutIssues": [
        {
          "type": "horizontal-scroll",
          "selector": "html, body"
        }
      ]
    }
  ]
}
```

### Enriched Analysis (from LLM Client)

```json
{
  "summary": {
    "url": "https://automationbookstore.dev/",
    "auditScore": 36,
    "complianceStatus": "Not Compliant",
    "counts": {
      "critical": 5,
      "serious": 2,
      "moderate": 1,
      "minor": 0,
      "total": 8
    }
  },
  "issues": [
    {
      "id": "ISSUE-1",
      "ruleId": "html-has-lang",
      "title": "<html> element must have a lang attribute",
      "severity": "Critical",
      "wcagCriteria": ["3.1.1"],
      "section508": ["1194.22(a)"],
      "ada": ["Title III"],
      "disabilitiesAffected": ["Blind", "Low Vision"],
      "selectors": ["html"],
      "code": {
        "problem": "<html>",
        "fix": "<html lang=\"en\">"
      },
      "suggestedFix": "Add lang attribute to the root HTML element",
      "effort": "S"
    }
  ],
  "uiIssues": [
    {
      "id": "UI-9",
      "breakpoint": "mobile-320",
      "type": "horizontal-scroll",
      "selector": "html, body",
      "suggestedFix": "Use max-width: 100%, avoid fixed pixel widths"
    }
  ],
  "recommendations": [
    "Add a valid lang attribute to the <html> element",
    "Add descriptive alt text to all images",
    "Fix responsive layout issues"
  ],
  "topFixes": [
    {
      "title": "Add lang attribute to HTML",
      "impact": "Critical - affects all screen reader users",
      "effort": "5 minutes"
    }
  ],
  "actionPlan": {
    "immediate": ["Fix critical accessibility violations"],
    "shortTerm": ["Address moderate issues", "Add skip links"],
    "longTerm": ["Implement comprehensive testing"]
  },
  "bestPractices": [
    {
      "category": "Images",
      "title": "Always provide alt text",
      "description": "Every image should have descriptive alt text"
    }
  ]
}
```

---

## 🚀 Running the System

```bash
# Terminal 1: Start Orchestrator (Port 3000)
cd orchestrator
npm install
node index.js

# Terminal 2: Start UI Server (Port 8000)
cd ui-agent
python3 -m http.server 8000

# Terminal 3: (Optional) Start Ollama for LLM enhancement
ollama serve
ollama run llama3.1:8b

# Open browser
open http://localhost:8000/demo.html
```

---

## 🔑 Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Browser Automation | Playwright | Headless Chrome for screenshots & DOM access |
| Accessibility Scanning | axe-core | WCAG 2.0 A/AA violation detection |
| Backend Server | Express.js | REST API orchestration |
| LLM Integration | Ollama | Local LLM for enhanced analysis (optional) |
| Frontend Widget | Web Components | Encapsulated, reusable dashboard |
| Styling | CSS Custom Properties | Modern dark theme, responsive design |
| Data Format | JSON | All artifacts and reports |

---

## 📈 Scoring Algorithm

```
Audit Score = 100 - (Critical × 8) - (Serious × 5) - (Moderate × 3) - (Minor × 1) - (UI Issues × 2)

Example:
- 5 Critical issues:  5 × 8 = 40
- 2 Serious issues:   2 × 5 = 10
- 1 Moderate issue:   1 × 3 = 3
- 0 Minor issues:     0 × 1 = 0
- 5 UI issues:        5 × 2 = 10
                      ─────────
Total Penalty:              63
Audit Score:         100 - 63 = 37

Compliance Status:
- Score ≥ 90 and 0 Critical → "Compliant"
- Score ≥ 70 and ≤3 Moderate → "At Risk"
- Otherwise → "Not Compliant"
```
