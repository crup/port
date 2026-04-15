import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

const requiredSnippets = [
  'npm install @crup/port',
  'pnpm add @crup/port',
  'https://www.npmjs.com/package/@crup/port',
  'https://crup.github.io/port/'
];

const missing = requiredSnippets.filter((snippet) => !readme.includes(snippet));

if (missing.length > 0) {
  console.error('README is missing required public package references:');
  for (const snippet of missing) {
    console.error(`- ${snippet}`);
  }
  process.exit(1);
}

console.log('README package references look correct.');
