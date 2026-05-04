const SECRET_PATTERNS = [
  {
    id: "secret-api-key",
    pattern: /\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*["']?[A-Za-z0-9_\-.]{16,}/i,
    title: "Possible secret committed",
  },
  {
    id: "secret-private-key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    title: "Private key material committed",
  },
  {
    id: "secret-aws-access-key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    title: "AWS access key committed",
  },
];

const MIGRATION_PATH = /(^|\/)(migrations?|schema|prisma)\/|(^|\/)schema\.(sql|prisma)$/i;
const TEST_PATH = /(^|\/)(__tests__|tests?|spec)\/|(\.test|\.spec)\.[cm]?[jt]sx?$/i;
const LOCKFILE_PATH = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|go\.sum)$/i;
const DEPENDENCY_MANIFEST = /(^|\/)(package\.json|pyproject\.toml|requirements.*\.txt|Cargo\.toml|go\.mod)$/i;
const PUBLIC_API_EXPORT = /^\s*export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+\w+/;

export const builtInRules = [
  {
    id: "possible-secret",
    severity: "high",
    evaluate(file) {
      const findings = [];

      for (const line of file.addedLines) {
        for (const secret of SECRET_PATTERNS) {
          if (secret.pattern.test(line.content)) {
            findings.push(createFinding({
              ruleId: secret.id,
              severity: "high",
              title: secret.title,
              message: "A newly added line looks like credential material. Rotate the value if it is real and move it to a secret store.",
              file,
              line,
            }));
          }
        }
      }

      return findings;
    },
  },
  {
    id: "database-migration",
    severity: "medium",
    evaluate(file) {
      if (!MIGRATION_PATH.test(file.path)) return [];

      return [
        createFinding({
          ruleId: "database-migration",
          severity: "medium",
          title: "Database migration changed",
          message: "Review rollout, rollback, and backward compatibility. Add data safety notes when this PR deploys with older app versions.",
          file,
          line: file.addedLines[0] ?? null,
        }),
      ];
    },
  },
  {
    id: "dependency-change",
    severity: "medium",
    evaluate(file) {
      if (!DEPENDENCY_MANIFEST.test(file.path) && !LOCKFILE_PATH.test(file.path)) return [];

      return [
        createFinding({
          ruleId: "dependency-change",
          severity: "medium",
          title: "Dependency graph changed",
          message: "Check license, supply-chain, lockfile, and compatibility impact before merging.",
          file,
          line: file.addedLines[0] ?? null,
        }),
      ];
    },
  },
  {
    id: "missing-tests",
    severity: "medium",
    evaluate(file, context) {
      if (TEST_PATH.test(file.path) || !isLikelySourceFile(file.path)) return [];
      if (context.changedFiles.some((changedFile) => TEST_PATH.test(changedFile.path))) return [];
      if (file.addedLines.length + file.removedLines.length < 8) return [];

      return [
        createFinding({
          ruleId: "missing-tests",
          severity: "medium",
          title: "Source changed without tests",
          message: "This PR changes source code but no test files were detected in the diff.",
          file,
          line: file.addedLines[0] ?? null,
        }),
      ];
    },
  },
  {
    id: "public-api-change",
    severity: "low",
    evaluate(file) {
      if (!isLikelySourceFile(file.path)) return [];
      const changedExports = [
        ...file.addedLines.filter((line) => PUBLIC_API_EXPORT.test(line.content)),
        ...file.removedLines.filter((line) => PUBLIC_API_EXPORT.test(line.content)),
      ];

      if (changedExports.length === 0) return [];

      return [
        createFinding({
          ruleId: "public-api-change",
          severity: "low",
          title: "Public API surface changed",
          message: "Exports changed in this file. Confirm downstream compatibility and update docs when needed.",
          file,
          line: changedExports[0],
        }),
      ];
    },
  },
  {
    id: "large-change",
    severity: "low",
    evaluate(file) {
      const changedLineCount = file.addedLines.length + file.removedLines.length;
      if (changedLineCount < 250) return [];

      return [
        createFinding({
          ruleId: "large-change",
          severity: "low",
          title: "Large file change",
          message: `This file changes ${changedLineCount} lines. Consider splitting the PR or adding focused review notes.`,
          file,
          line: file.addedLines[0] ?? null,
        }),
      ];
    },
  },
];

function createFinding({ ruleId, severity, title, message, file, line }) {
  return {
    ruleId,
    source: "rule",
    severity,
    title,
    message,
    path: file.path,
    line: line?.newLine ?? line?.oldLine ?? null,
    recommendation: null,
  };
}

function isLikelySourceFile(path) {
  return /\.(cjs|mjs|js|jsx|ts|tsx|py|go|rs|java|kt|cs|rb|php|swift)$/i.test(path);
}
