const fs = require('fs');
const path = require('path');
const { analyzeWithLLM } = require('./llmClient');

async function main() {
  const sampleReportPath = path.join(__dirname, 'sample_report.json');
  let report = null;
  if (fs.existsSync(sampleReportPath)) {
    report = JSON.parse(fs.readFileSync(sampleReportPath, 'utf8'));
  } else {
    // Minimal dummy report
    report = {
      url: 'http://localhost:8000/demo.html',
      timestamp: new Date().toISOString(),
      results: [ { breakpoint: 'desktop', width: 1280, height: 800, screenshot: 'screenshot.png', axe: { violations: [] }, layoutIssues: [] } ]
    };
  }

  const res = await analyzeWithLLM(report, { chat: true });
  fs.writeFileSync(path.join(__dirname, 'llm_client_run_output.json'), JSON.stringify(res, null, 2));
  console.log('Wrote llm_client_run_output.json');
}

main().catch(err => { console.error(err); process.exit(1); });
