const fs = require('fs');
const path = require('path');

function validateAnalysis(obj) {
  const errs = [];
  if (!obj || typeof obj !== 'object') return ['analysis file is not an object'];
  if (!obj.analysis || typeof obj.analysis !== 'object') return ['missing top-level "analysis" object'];
  const a = obj.analysis;
  if (typeof a.summary !== 'string') errs.push('analysis.summary missing or not string');
  if (typeof a.auditScore !== 'number') errs.push('analysis.auditScore missing or not number');
  if (!a.counts || typeof a.counts !== 'object') errs.push('analysis.counts missing or not object');
  if (!Array.isArray(a.issues)) errs.push('analysis.issues missing or not array');
  if (!Array.isArray(a.uiIssues)) errs.push('analysis.uiIssues missing or not array');
  if (!Array.isArray(a.recommendations)) errs.push('analysis.recommendations missing or not array');
  if (!a.metadata || typeof a.metadata !== 'object') errs.push('analysis.metadata missing or not object');
  return errs;
}

async function main() {
  const target = process.argv[2];
  if (!target) { console.error('Usage: node validate_analysis_schema.js <path-to-analysis.json>'); process.exit(2); }
  const p = path.resolve(process.cwd(), target);
  if (!fs.existsSync(p)) { console.error('File not found:', p); process.exit(2); }
  const raw = fs.readFileSync(p, 'utf8');
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { console.error('Invalid JSON:', e.message); process.exit(2); }
  const errors = validateAnalysis(obj);
  if (errors.length) { console.error('ANALYSIS SHAPE VALIDATION: FAILED'); for (const e of errors) console.error(' -', e); process.exit(3); }
  console.log('ANALYSIS SHAPE VALIDATION: OK');
}

main().catch(e => { console.error(e); process.exit(1); });