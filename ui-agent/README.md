# AI Accelerator Widget (UI-Agent)

This folder contains a headless, plug-and-play Web Component you can drop into any static site or frontend app. It requires no backend — the component renders analysis results you pass to it.

Files
- `ai-accelerator-widget.js` — the Web Component (ES module). Exports default and registers `<ai-accelerator-widget>`.
- `ai-accelerator-widget.css` — visual styles (imported by the module).
- `demo.html` — simple demo showing usage.

Usage
1. Copy the `ui-agent` folder into your project or serve it statically.
2. In an ES-module-aware page, import and insert the component:

```html
<script type="module">
  import './ui-agent/ai-accelerator-widget.js';
  const w = document.createElement('ai-accelerator-widget');
  document.body.appendChild(w);
  // pass a report object (the component is headless and will not fetch anything itself)
  w.setReport(reportJson);
</script>
```

Notes
- The component is intentionally headless: it does not call any backend or external API.
- Provide screenshots as usable URLs (or data URLs) in the `report.results[*].screenshot` fields.
- Events: the component dispatches an `export` CustomEvent when you press Export.
