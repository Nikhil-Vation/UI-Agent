# LLM Role and Data Flow in UI-Agent

## 🎯 Overview

The LLM (Large Language Model) plays an **optional enhancement role** in this project. The system is designed to work perfectly without an LLM using **deterministic enrichment**, but the LLM can provide additional insights, contextual understanding, and natural language summaries.

---

## 🔄 Complete Data Flow with LLM

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          STEP-BY-STEP DATA FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

1. USER SUBMITS URL
   ↓
   
2. PLAYWRIGHT SCANS (playwrightRunner.js)
   • Launches headless browser
   • Tests 4 breakpoints (320, 375, 768, 1024px)
   • Injects axe-core library
   • Runs WCAG 2.0 A/AA scan
   • Detects layout issues (overflow, horizontal scroll, clipping)
   
   OUTPUT: Raw Report
   {
     "id": "uuid",
     "url": "https://example.com",
     "results": [
       {
         "breakpoint": "mobile-320",
         "axe": {
           "violations": [
             {
               "id": "html-has-lang",
               "impact": "serious",
               "help": "html element must have a lang attribute",
               "nodes": [{ "target": ["html"], "html": "<html>..." }]
             }
           ]
         },
         "layoutIssues": [
           { "type": "horizontal-scroll", "selector": "html, body" }
         ]
       }
     ]
   }
   ↓
   
3. LLM CLIENT ANALYSIS (llmClient.js)
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ A. DETERMINISTIC ENRICHMENT (ALWAYS RUNS FIRST)                          │
   │    buildDeterministicAnalysis(rawReport)                                 │
   │                                                                           │
   │    Transforms raw axe data into detailed issues using:                   │
   │    • WCAG_DATABASE: 60+ rules with metadata                              │
   │      - WCAG criteria (e.g., "3.1.1")                                     │
   │      - Section 508 compliance                                            │
   │      - ADA requirements                                                  │
   │      - Disabilities affected (Blind, Motor, etc.)                        │
   │      - Severity levels                                                   │
   │      - Effort estimates (S/M/L)                                          │
   │                                                                           │
   │    • FIX_SUGGESTIONS: Code fix templates                                 │
   │      - Problem code example                                              │
   │      - Fixed code example                                                │
   │      - Detailed explanation                                              │
   │      - Impact description                                                │
   │                                                                           │
   │    • LAYOUT_FIX_SUGGESTIONS: Responsive design fixes                     │
   │                                                                           │
   │    OUTPUT: Comprehensive deterministic analysis                          │
   │    {                                                                     │
   │      "summary": { ... },                                                 │
   │      "issues": [ /* 8 issues with full metadata */ ],                    │
   │      "uiIssues": [ /* 13 layout issues */ ],                             │
   │      "recommendations": [ /* 12 actionable suggestions */ ],             │
   │      "topFixes": [ /* 5 priority fixes */ ],                             │
   │      "actionPlan": {                                                     │
   │        "immediate": [...],                                               │
   │        "shortTerm": [...],                                               │
   │        "longTerm": [...]                                                 │
   │      },                                                                  │
   │      "bestPractices": [...]                                              │
   │    }                                                                     │
   └──────────────────────────────────────────────────────────────────────────┘
   ↓
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ B. LLM ENHANCEMENT (OPTIONAL, ONLY IF CONFIGURED)                        │
   │    localAnalyze(rawReport, deterministicAnalysis)                        │
   │                                                                           │
   │    1. BUILD PROMPT                                                       │
   │       • Uses template from templates/llm-prompts.md                      │
   │       • Includes URL, timestamp, breakpoint info                         │
   │       • Adds violation samples (up to 5 per breakpoint)                  │
   │       • Adds layout issue samples                                        │
   │       • Adds context about passed/incomplete checks                      │
   │                                                                           │
   │    PROMPT EXAMPLE:                                                       │
   │    """                                                                   │
   │    URL: https://automationbookstore.dev/                                │
   │    Timestamp: 2026-02-02T10:30:00.000Z                                  │
   │    Breakpoint: mobile-320 (320x800)                                     │
   │    Accessibility violations: 8                                          │
   │    Layout issues: 1                                                     │
   │                                                                           │
   │    Violation samples:                                                   │
   │    - [mobile-320] html-has-lang (serious): html element must have       │
   │      a lang attribute                                                   │
   │    - [mobile-320] image-alt (critical): Images must have alternative    │
   │      text                                                               │
   │    ...                                                                  │
   │                                                                           │
   │    Please produce a detailed JSON report with summary, auditScore,      │
   │    issues[], recommendations[], etc.                                    │
   │    """                                                                   │
   │                                                                           │
   │    2. CALL LLM API                                                       │
   │       • Supports multiple LLM backends:                                  │
   │         - Ollama (localhost:11434) - FREE LOCAL                          │
   │         - OpenAI / OpenRouter                                            │
   │         - HuggingFace                                                    │
   │         - text-generation-webui                                          │
   │         - Custom endpoints                                               │
   │                                                                           │
   │    API REQUEST:                                                          │
   │    POST http://localhost:11434/api/generate                             │
   │    {                                                                     │
   │      "model": "llama3.1:8b",                                             │
   │      "prompt": "...",                                                    │
   │      "max_tokens": 1024                                                  │
   │    }                                                                     │
   │                                                                           │
   │    3. PARSE LLM RESPONSE                                                 │
   │       • Handles multiple response formats:                               │
   │         - OpenAI: { "choices": [{ "message": { "content": "..." }}] }   │
   │         - Ollama NDJSON: Multiple lines with { "response": "..." }      │
   │         - Plain text: Direct JSON string                                │
   │       • Strips markdown fences (```json ... ```)                         │
   │       • Extracts first valid JSON block if embedded in text              │
   │       • Validates schema (summary, auditScore, issues, etc.)             │
   │                                                                           │
   │    LLM OUTPUT EXAMPLE:                                                   │
   │    {                                                                     │
   │      "summary": "Site scored 10; critical issues with lang attribute    │
   │                  and image alt text. 8 violations found.",               │
   │      "auditScore": 10,                                                   │
   │      "complianceStatus": "Not Compliant",                                │
   │      "issues": [                                                         │
   │        {                                                                 │
   │          "title": "Missing lang attribute on HTML element",              │
   │          "severity": "Critical",                                         │
   │          "wcagCriteria": ["3.1.1"],                                      │
   │          "code": {                                                       │
   │            "problem": "<html>",                                          │
   │            "fix": "<html lang=\"en\">"                                   │
   │          },                                                              │
   │          "suggestedFix": "Add lang=\"en\" to the <html> tag"            │
   │        }                                                                 │
   │      ],                                                                  │
   │      "recommendations": [                                                │
   │        "Add lang attribute to HTML element",                             │
   │        "Add alt text to all images",                                     │
   │        "Review form field labels"                                        │
   │      ]                                                                   │
   │    }                                                                     │
   │                                                                           │
   │    4. MERGE WITH DETERMINISTIC DATA                                      │
   │       mergeWithLLMOutput(deterministicAnalysis, llmParsedOutput)        │
   │                                                                           │
   │       • Deterministic data is ALWAYS the base                            │
   │       • LLM output enhances/refines only if:                             │
   │         - It has valid schema                                            │
   │         - It has more detailed recommendations                           │
   │         - It has better code examples                                    │
   │       • If LLM parsing fails → use 100% deterministic data               │
   │       • If LLM succeeds → merge best of both:                            │
   │         - Use deterministic issues (guaranteed complete)                 │
   │         - Enhance code examples from LLM if better                       │
   │         - Use LLM recommendations if more detailed                       │
   │         - Keep deterministic scoring (more reliable)                     │
   └──────────────────────────────────────────────────────────────────────────┘
   ↓
   
4. FINAL ENRICHED ANALYSIS
   {
     "summary": {
       "url": "https://automationbookstore.dev/",
       "auditScore": 36,
       "complianceStatus": "Not Compliant",
       "counts": { "critical": 8, "serious": 0, "moderate": 0, "minor": 0 }
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
         "suggestedFix": "Add lang attribute to root HTML element",
         "explanation": "The <html> element is missing a lang attribute...",
         "effort": "S",
         "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/html-has-lang"
       }
     ],
     "uiIssues": [...],
     "recommendations": [...],
     "topFixes": [...],
     "actionPlan": {...},
     "bestPractices": [...]
   }
   ↓
   
5. SAVE ARTIFACTS
   • {uuid}-report.json          ← Raw Playwright/axe data
   • {uuid}-analysis.json         ← LLM raw response (if used)
   • {uuid}-analysis-parsed.json  ← Final enriched analysis (deterministic + LLM)
   ↓
   
6. RETURN TO ORCHESTRATOR
   {
     "report": { /* raw playwright data */ },
     "analysis": { /* enriched analysis */ },
     "artifacts": {
       "screenshots": [...],
       "reportUrl": "http://localhost:3000/artifacts/{uuid}-report.json",
       "analysisUrl": "http://localhost:3000/artifacts/{uuid}-analysis-parsed.json"
     }
   }
   ↓
   
7. DEMO.HTML EXTRACTS ANALYSIS
   • Gets body.analysis from API response
   • Checks for body.analysis.parsed (enriched data)
   • Passes to widget for rendering
   ↓
   
8. WIDGET RENDERS DASHBOARD
   • Score ring, stat cards, compliance badges
   • Expandable issue cards with code fixes
   • UI issues, recommendations, action plan
   • Export buttons (JSON, CSV, Print)
```

---

## 🤖 LLM Configuration

The system supports multiple LLM backends through environment variables:

### Option 1: Ollama (FREE LOCAL - RECOMMENDED)
```bash
# Run Ollama locally
ollama serve
ollama run llama3.1:8b

# In .env
LLM_API_MODE=ollama
LLM_API_URL=http://localhost:11434
LLM_MODEL_NAME=llama3.1:8b
```

### Option 2: OpenAI / OpenRouter
```bash
# In .env
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_API_TOKEN=sk-...
LLM_MODEL_NAME=gpt-4
```

### Option 3: HuggingFace
```bash
# In .env
LLM_API_URL=https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct
LLM_API_TOKEN=hf_...
LLM_MODEL_NAME=meta-llama/Llama-3.1-8B-Instruct
```

### Option 4: No LLM (Deterministic Only)
```bash
# In .env
LLM_USE_LOCAL=true
# Or simply don't set LLM_API_URL
```

---

## 📊 What the LLM Adds (When Configured)

| Feature | Deterministic (Always) | LLM Enhancement (Optional) |
|---------|----------------------|---------------------------|
| **Issue Detection** | ✅ Complete (from axe-core) | 🔄 Rephrases for clarity |
| **WCAG Mapping** | ✅ 60+ rules in database | 🔄 May add context |
| **Code Fixes** | ✅ Template-based examples | ✨ Contextual examples |
| **Severity** | ✅ Calculated from impact | ✅ Same |
| **Effort Estimates** | ✅ Pre-defined (S/M/L) | ✅ Same |
| **Recommendations** | ✅ Rule-based (12+ items) | ✨ Natural language synthesis |
| **Action Plan** | ✅ Phased timeline | ✨ Custom prioritization |
| **Summary** | ✅ Structured metrics | ✨ Narrative explanation |
| **Best Practices** | ✅ Category-based tips | ✨ Contextual advice |

---

## 🎯 Key Design Principles

### 1. **Deterministic-First Architecture**
The system ALWAYS generates a complete analysis using deterministic enrichment. This ensures:
- ✅ No dependency on external LLM services
- ✅ Consistent, reliable results
- ✅ Fast execution (no API latency)
- ✅ Free to run (no API costs)

### 2. **LLM as Enhancement Layer**
The LLM is **optional** and only adds:
- 🎨 Better natural language explanations
- 🔍 Contextual insights based on the specific site
- 📝 More detailed recommendations
- 💡 Creative problem-solving suggestions

### 3. **Graceful Degradation**
If the LLM:
- ❌ Is not configured → Uses 100% deterministic data
- ❌ Times out → Returns deterministic data
- ❌ Returns invalid JSON → Uses deterministic data
- ❌ Is unreachable → Falls back to deterministic data

### 4. **Smart Merging**
When LLM output is valid:
```javascript
function mergeWithLLMOutput(deterministic, llmParsed) {
  // Start with complete deterministic data
  const merged = { ...deterministic };
  
  // Enhance only if LLM provides better data
  if (llmParsed && llmParsed.issues && llmParsed.issues.length > 0) {
    // Match issues by rule ID and enhance code examples
    for (const llmIssue of llmParsed.issues) {
      const match = merged.issues.find(i => i.ruleId === llmIssue.ruleId);
      if (match && llmIssue.code) {
        // Use LLM code if more detailed
        if (llmIssue.code.problem) match.code.problem = llmIssue.code.problem;
        if (llmIssue.code.fix) match.code.fix = llmIssue.code.fix;
      }
    }
  }
  
  // Use LLM recommendations if more comprehensive
  if (llmParsed.recommendations && llmParsed.recommendations.length > merged.recommendations.length) {
    merged.recommendations = llmParsed.recommendations;
  }
  
  return merged;
}
```

---

## 🔍 Response Parsing (LLM)

The LLM response goes through sophisticated parsing to handle various formats:

### Step 1: Extract Text
```javascript
// Handles multiple LLM response formats
if (body.choices && body.choices[0].message.content) {
  text = body.choices[0].message.content;  // OpenAI format
}
else if (body.response) {
  text = body.response;  // Ollama format
}
else if (body.generated_text) {
  text = body.generated_text;  // HuggingFace format
}
```

### Step 2: Handle Ollama NDJSON Streaming
```javascript
// Ollama returns multiple JSON lines
// { "response": "part1" }
// { "response": "part2" }
// { "response": "part3", "done": true }

const lines = text.split('\n');
let stitched = '';
for (const line of lines) {
  const obj = JSON.parse(line);
  if (obj.response) stitched += obj.response;
}
text = stitched;  // Complete response
```

### Step 3: Strip Markdown Fences
```javascript
// Remove ```json ... ``` or ``` ... ```
cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
```

### Step 4: Extract JSON Block
```javascript
// Find first valid JSON object in text using bracket matching
function extractJsonBlock(input) {
  // Traverse string character by character
  // Track opening/closing braces and brackets
  // Handle string escaping properly
  // Return first complete JSON object found
}
```

### Step 5: Validate Schema
```javascript
function isValidSchema(obj) {
  return (
    obj.summary &&                    // Must have summary
    typeof obj.summary === 'string' &&
    (obj.issues || obj.accessibilityIssues) &&  // Must have issues array
    (obj.recommendations || obj.suggestions)     // Must have recommendations
  );
}
```

---

## 📁 File Artifacts

After analysis, multiple files are saved:

| File | Content | Source |
|------|---------|--------|
| `{uuid}-report.json` | Raw Playwright/axe results | playwrightRunner.js |
| `{uuid}-analysis.json` | Raw LLM response (if used) | llmClient.js (LLM API) |
| `{uuid}-analysis-parsed.json` | Final enriched analysis | llmClient.js (merged) |
| `{uuid}-analysis-diagnostic.json` | Debug info if LLM fails | llmClient.js (error case) |

### Example: `analysis-parsed.json` Structure
```json
{
  "parsed": {
    "summary": { ... },
    "issues": [ ... ],
    "uiIssues": [ ... ],
    "recommendations": [ ... ],
    "topFixes": [ ... ],
    "actionPlan": { ... },
    "bestPractices": [ ... ]
  },
  "meta": {
    "model": "llama3.1:8b",
    "timestamp": "2026-02-02T10:30:00.000Z",
    "enriched": true,
    "llmParsed": true
  },
  "parseError": null,
  "validation": "ok",
  "rawTextExcerpt": "..." 
}
```

---

## 🎓 Summary

The LLM in this project serves as an **optional enhancement layer** that:

1. ✅ **Does NOT replace** the deterministic enrichment system
2. 🎨 **Enhances** code examples and explanations with context
3. 📝 **Provides** natural language summaries and insights
4. 🔄 **Improves** recommendations with creative problem-solving
5. 🛡️ **Falls back** gracefully if unavailable or misconfigured

The system is designed to be:
- 🚀 **Fast** - Works without LLM latency
- 💰 **Free** - No API costs required
- 🔒 **Reliable** - Deterministic results always available
- 🎯 **Accurate** - Based on proven WCAG database
- ✨ **Enhanced** - Better with LLM, but not dependent on it

This architecture ensures that the tool is **production-ready** whether you're running:
- A free local setup (no LLM)
- A local Ollama instance (free LLM)
- A paid API service (enhanced LLM)
