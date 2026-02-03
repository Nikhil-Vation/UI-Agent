// Runs the local fallback analyzer by forcing LLM_API_URL to empty before requiring the client
process.env.LLM_API_URL = '';
const fs = require('fs');
const path = require('path');
const { analyzeWithLLM } = require('./llmClient');

async function main() {
  const report = {
    url: 'http://localhost:8000/demo.html',
    timestamp: new Date().toISOString(),
    results: [ { breakpoint: 'mobile', width: 375, height: 812, screenshot: 'screenshot-mobile.png', axe: { violations: [] }, layoutIssues: [] } ]
  };

  const out = await analyzeWithLLM(report);
  fs.writeFileSync(path.join(__dirname, 'local_fallback_output.json'), JSON.stringify(out, null, 2));
  console.log('Wrote local_fallback_output.json');
}

main().catch(e => { console.error(e); process.exit(1); });
