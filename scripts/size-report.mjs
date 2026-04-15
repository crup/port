import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const asJson = process.argv.includes('--json');

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(2)} kB`;
  }

  return `${(kb / 1024).toFixed(2)} MB`;
}

const files = readdirSync(distDir)
  .filter((entry) => entry.endsWith('.js') || entry.endsWith('.mjs'))
  .map((entry) => {
    const filePath = path.join(distDir, entry);
    const source = readFileSync(filePath);

    return {
      file: path.relative(rootDir, filePath),
      rawBytes: statSync(filePath).size,
      gzipBytes: gzipSync(source).length
    };
  })
  .sort((left, right) => left.file.localeCompare(right.file));

const totalRawBytes = files.reduce((sum, file) => sum + file.rawBytes, 0);
const totalGzipBytes = files.reduce((sum, file) => sum + file.gzipBytes, 0);

if (asJson) {
  process.stdout.write(
    JSON.stringify(
      {
        files,
        totals: {
          rawBytes: totalRawBytes,
          gzipBytes: totalGzipBytes
        }
      },
      null,
      2
    )
  );
  process.stdout.write('\n');
  process.exit(0);
}

console.log('# Bundle size');
console.log('');
console.log('| File | Raw | Gzip |');
console.log('| --- | ---: | ---: |');

for (const file of files) {
  console.log(`| \`${file.file}\` | ${formatBytes(file.rawBytes)} | ${formatBytes(file.gzipBytes)} |`);
}

console.log(`| Total | ${formatBytes(totalRawBytes)} | ${formatBytes(totalGzipBytes)} |`);
