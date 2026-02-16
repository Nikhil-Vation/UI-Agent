const { runTests } = require('./playwrightRunner');
const { analyzeWithLLM } = require('./llmClient');

async function bench() {
  console.time('full-scan');
  const res = await runTests({ url: 'https://example.com', breakpoints: [ { name: 'desktop-1024', width: 1024, height: 768 }, { name: 'mobile-375', width: 375, height: 812 } ] });
  const analysis = await analyzeWithLLM(res, { fast: true });
  console.timeEnd('full-scan');
  console.log('analysis keys:', Object.keys(analysis));
}

bench().catch(e => { console.error(e); process.exit(1); });