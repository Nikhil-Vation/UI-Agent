const { runTests } = require('./playwrightRunner');

async function bench() {
  const url = 'https://example.com';
  console.time('scan');
  const res = await runTests({ url, breakpoints: [ { name: 'desktop-1024', width: 1024, height: 768 }, { name: 'mobile-375', width: 375, height: 812 } ] });
  console.timeEnd('scan');
  console.log('results:', { id: res.id, resultCount: res.results.length, reportPath: res.reportPath });
}

bench().catch(e => { console.error(e); process.exit(1); });