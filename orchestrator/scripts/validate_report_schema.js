const fs = require('fs');
const path = require('path');

function validateReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') return ['report is not an object'];
  if (typeof report.id !== 'string') errors.push('id missing or not string');
  if (typeof report.url !== 'string') errors.push('url missing or not string');
  if (typeof report.timestamp !== 'string') errors.push('timestamp missing or not string');
  if (!Array.isArray(report.results)) errors.push('results missing or not array');

  if (Array.isArray(report.results)) {
    report.results.forEach((res, i) => {
      if (!res || typeof res !== 'object') return errors.push(`results[${i}] is not an object`);
      if (typeof res.breakpoint !== 'string') errors.push(`results[${i}].breakpoint missing or not string`);
      if (typeof res.screenshot !== 'string') errors.push(`results[${i}].screenshot missing or not string`);
      if (typeof res.axe !== 'object' || res.axe === null) errors.push(`results[${i}].axe missing or not object`);
      if ('domSnapshotLength' in res && typeof res.domSnapshotLength !== 'number') errors.push(`results[${i}].domSnapshotLength not a number`);
      if ('width' in res && typeof res.width !== 'number') errors.push(`results[${i}].width not a number`);
      if ('height' in res && typeof res.height !== 'number') errors.push(`results[${i}].height not a number`);
    });
  }

  return errors;
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node validate_report_schema.js <path-to-report.json>');
    process.exit(2);
  }

  const p = path.resolve(process.cwd(), target);
  if (!fs.existsSync(p)) {
    console.error('File not found:', p);
    process.exit(2);
  }

  const raw = fs.readFileSync(p, 'utf8');
  let report;
  try {
    report = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(2);
  }

  const errors = validateReport(report);
  if (errors.length) {
    console.error('REPORT SCHEMA VALIDATION: FAILED');
    for (const e of errors) console.error(' -', e);
    process.exit(3);
  }

  console.log('REPORT SCHEMA VALIDATION: OK');
}

main().catch(e => { console.error(e); process.exit(1); });