const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOTS = ['apps/api/src', 'apps/dashboard/src'];
const DEFAULT_THRESHOLD = 60;

function isUnderSourceRoot(file, sourceRoots) {
  return sourceRoots.some((root) => file === root || file.startsWith(`${root}/`));
}

function isTestFile(file) {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file);
}

function parseAddedLines(diff, sourceRoots) {
  const addedLines = new Map();
  let currentFile;
  let currentLine;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      const file = line.slice('+++ b/'.length);
      currentFile =
        file !== '/dev/null' && isUnderSourceRoot(file, sourceRoots) && !isTestFile(file)
          ? file
          : undefined;
      continue;
    }

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      currentLine = Number(hunk[1]);
      continue;
    }

    if (currentLine === undefined) {
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      if (currentFile) {
        if (!addedLines.has(currentFile)) {
          addedLines.set(currentFile, new Set());
        }
        addedLines.get(currentFile).add(currentLine);
      }
      currentLine += 1;
    } else if (line.startsWith('\\')) {
    } else if (!line.startsWith('-')) {
      currentLine += 1;
    }
  }

  return addedLines;
}

function normalizeCoveragePath(file) {
  return file.split(path.sep).join('/');
}

function getFileCoverage(coverage, relativeFile) {
  const normalizedFile = normalizeCoveragePath(relativeFile);

  for (const [file, data] of Object.entries(coverage)) {
    const normalizedCoverageFile = normalizeCoveragePath(file);
    if (
      normalizedCoverageFile === normalizedFile ||
      normalizedCoverageFile.endsWith(`/${normalizedFile}`)
    ) {
      return data;
    }
  }

  return undefined;
}

function calculateNewLineCoverage(addedLines, coverage) {
  let covered = 0;
  let total = 0;

  for (const [file, lines] of addedLines) {
    const fileCoverage = getFileCoverage(coverage, file);
    if (!fileCoverage) {
      total += lines.size;
      continue;
    }

    const statements = Object.entries(fileCoverage.statementMap ?? {}).map(
      ([statementId, statement]) => ({
        start: statement.start.line,
        end: statement.end.line,
        count: fileCoverage.s?.[statementId] ?? 0,
      }),
    );

    for (const line of lines) {
      const matchingStatements = statements.filter(
        (statement) => line >= statement.start && line <= statement.end,
      );

      if (matchingStatements.length === 0) {
        continue;
      }

      total += 1;
      if (matchingStatements.some((statement) => statement.count > 0)) {
        covered += 1;
      }
    }
  }

  return {
    covered,
    total,
    percentage: total === 0 ? 100 : Math.round((covered / total) * 10000) / 100,
  };
}

function readCoverageFile(coverageFile) {
  if (!fs.existsSync(coverageFile)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
}

function getBaseRef() {
  if (process.env.COVERAGE_BASE) {
    return process.env.COVERAGE_BASE;
  }

  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  return 'origin/main';
}

function main() {
  const baseRef = getBaseRef();
  const diff = execFileSync(
    'git',
    ['diff', '--unified=0', `${baseRef}...HEAD`, '--', ...SOURCE_ROOTS],
    { encoding: 'utf8' },
  );
  const addedLines = parseAddedLines(diff, SOURCE_ROOTS);
  const coverage = {
    ...readCoverageFile('apps/api/coverage/coverage-final.json'),
    ...readCoverageFile('apps/dashboard/coverage/coverage-final.json'),
  };
  const result = calculateNewLineCoverage(addedLines, coverage);
  const threshold = Number(process.env.NEW_CODE_COVERAGE_THRESHOLD ?? DEFAULT_THRESHOLD);

  console.log(
    `New source lines: ${result.covered}/${result.total} covered (${result.percentage}%). ` +
      `Required: ${threshold}%.`,
  );

  if (result.total > 0 && result.percentage < threshold) {
    process.exitCode = 1;
  }
}

module.exports = { calculateNewLineCoverage, parseAddedLines };

if (require.main === module) {
  main();
}
