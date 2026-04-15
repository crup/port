import { readFileSync } from 'node:fs';

const [basePath, headPath] = process.argv.slice(2);

if (!basePath || !headPath) {
  console.error('Usage: node scripts/size-compare.mjs <base-json> <head-json>');
  process.exit(1);
}

const base = JSON.parse(readFileSync(basePath, 'utf8'));
const head = JSON.parse(readFileSync(headPath, 'utf8'));

function formatDelta(value) {
  return `${value >= 0 ? '+' : ''}${value} B`;
}

console.log('| Metric | Base | Head | Delta |');
console.log('| --- | ---: | ---: | ---: |');
console.log(
  `| Raw total | ${base.totals.rawBytes} | ${head.totals.rawBytes} | ${formatDelta(head.totals.rawBytes - base.totals.rawBytes)} |`
);
console.log(
  `| Gzip total | ${base.totals.gzipBytes} | ${head.totals.gzipBytes} | ${formatDelta(head.totals.gzipBytes - base.totals.gzipBytes)} |`
);
