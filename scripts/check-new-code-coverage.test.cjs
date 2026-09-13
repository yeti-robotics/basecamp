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
    'diff --git a/apps/api/src/example.spec.ts b/apps/api/src/example.spec.ts',
    '--- /dev/null',
    '+++ b/apps/api/src/example.spec.ts',
    '@@ -0,0 +1,1 @@',
    '+test("example", () => {});',
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
