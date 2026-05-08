const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targets = ['App.js', 'index.js', 'src'];

function collectJsFiles(entry) {
  const fullPath = path.join(root, entry);
  if (!fs.existsSync(fullPath)) return [];

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) return fullPath.endsWith('.js') ? [fullPath] : [];

  return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((dirent) => {
    const child = path.join(entry, dirent.name);
    if (dirent.isDirectory()) return collectJsFiles(child);
    return dirent.name.endsWith('.js') ? [path.join(root, child)] : [];
  });
}

const files = targets.flatMap(collectJsFiles).sort();
let failed = false;

files.forEach((file) => {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    failed = true;
    const relative = path.relative(root, file);
    console.error(`Syntax check failed: ${relative}`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
  }
});

if (failed) process.exit(1);
console.log(`Syntax check passed for ${files.length} files.`);
