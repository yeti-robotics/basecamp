const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateNewLineCoverage, parseAddedLines } = require('./check-new-code-coverage.cjs');

test('finds added lines only inside the configured source directories', () => {
  const diff = [
    'diff --git a/apps/api/src/example.ts b/apps/api/src/example.ts',
    '--- a/apps/api/src/example.ts',
    '+++ b/apps/api/src/example.ts',
    '@@ -1,0 +1,3 @@',
    '+export const first = 1;',
    '+export const second = 2;',
    '+',
    'diff --git a/apps/dashboard/app/page.tsx b/apps/dashboard/app/page.tsx',
    '--- a/apps/dashboard/app/page.tsx',
    '+++ b/apps/dashboard/app/page.tsx',
    '@@ -1,0 +1,1 @@',
    '+export default function Page() {}',
  ].join('\n');

  assert.deepEqual(
    parseAddedLines(diff, ['apps/api/src', 'apps/dashboard/src']),
    new Map([['apps/api/src/example.ts', new Set([1, 2, 3])]]),
  );
});

test('excludes test and spec files in both API and dashboard source', () => {
  for (const file of [
    'apps/api/src/example.spec.ts',
    'apps/dashboard/src/example.test.tsx',
    'apps/dashboard/src/example.spec.jsx',
    'apps/dashboard/src/example.test.js',
  ]) {
    const diff = [`+++ b/${file}`, '@@ -0,0 +1,1 @@', '+test("example", () => {});'].join('\n');
    assert.deepEqual(parseAddedLines(diff, ['apps/api/src', 'apps/dashboard/src']), new Map());
  }
});

test('includes dashboard application source when configured', () => {
  for (const root of ['app', 'components', 'lib']) {
    const file = `apps/dashboard/${root}/example.tsx`;
    const diff = [`+++ b/${file}`, '@@ -0,0 +1,1 @@', '+export const example = 1;'].join('\n');
    assert.deepEqual(
      parseAddedLines(diff, [`apps/dashboard/${root}`]),
      new Map([[file, new Set([1])]]),
    );
  }
});

test('counts executable added lines covered by Istanbul statements', () => {
  const coverage = {
    '/workspace/apps/api/src/example.ts': {
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
        1: { start: { line: 2 }, end: { line: 2 } },
      },
      s: { 0: 1, 1: 0 },
    },
  };

  assert.deepEqual(
    calculateNewLineCoverage(new Map([['apps/api/src/example.ts', new Set([1, 2, 3])]]), coverage),
    { covered: 1, total: 2, percentage: 50 },
  );
});
