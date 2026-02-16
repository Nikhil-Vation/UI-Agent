(async () => {
  process.env.LLM_API_URL = process.env.LLM_API_URL || 'http://10.255.255.1:11434'; // non-routable to simulate slow/failed LLM
  const { analyzeWithLLM } = require('./llmClient');
  const report = { id: 'bench-1', url: 'https://example.com', timestamp: new Date().toISOString(), results: [ { breakpoint: 'desktop', width: 1024, height: 768, screenshot: 'x.png', axe: { violations: [] }, layoutIssues: [] } ] };

  console.time('llm-fast');
  const out = await analyzeWithLLM(report, { fast: true });
  console.timeEnd('llm-fast');
  console.log('returned:', Object.keys(out));
  // wait a short time to let background job attempt (if any)
  await new Promise(r => setTimeout(r, 1200));
  console.log('background should be running (if LLM configured) — check artifacts for parsed files.');
})();