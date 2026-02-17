const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'axe-core', 'axe.min.js');
const dest = path.join(__dirname, '..', '..', 'extension', 'src', 'content', 'axe-core.min.js');

if (!fs.existsSync(src)) {
  console.error('Source axe.min.js not found at', src);
  process.exit(1);
}

const destDir = path.dirname(dest);
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

fs.copyFileSync(src, dest);
console.log('Copied axe.min.js to extension:', dest);
