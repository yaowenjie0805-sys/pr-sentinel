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
const GITHUB_WORKFLOW_PATH = /^\.github\/workflows\/.+\.ya?ml$/i;
const DOCKERFILE_PATH = /(^|\/)(Dockerfile|Dockerfile\.[^/]+)$/i;
const KUBERNETES_MANIFEST_PATH = /(^|\/)(k8s|kubernetes|manifests|charts|helm)\/|(^|\/).+\.(ya?ml)$/i;
const TERRAFORM_PATH = /\.tf$/i;
const SQL_MIGRATION_PATH = /\.(sql)$/i;

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
  {
    id: "github-actions-broad-permissions",
    severity: "high",
    evaluate(file) {
      if (!GITHUB_WORKFLOW_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/^\s*permissions:\s*(write-all|read-all)\s*$/i.test(line.content) || /^\s*contents:\s*write\s*$/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "github-actions-broad-permissions",
            severity: "high",
            title: "Broad GitHub Actions permissions",
            message: "Workflow permissions grant broad write access. Use least-privilege permissions for the specific job.",
            recommendation: "Replace write-all or repository-wide write scopes with the narrow permissions required by the workflow.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "github-actions-pull-request-target",
    severity: "high",
    evaluate(file) {
      if (!GITHUB_WORKFLOW_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/^\s*pull_request_target:\s*$/i.test(line.content) || /^\s*-\s*pull_request_target\s*$/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "github-actions-pull-request-target",
            severity: "high",
            title: "pull_request_target workflow trigger added",
            message: "pull_request_target runs with elevated token permissions and can be dangerous when combined with untrusted PR code.",
            recommendation: "Use pull_request when possible, or avoid checking out/running untrusted head code with privileged credentials.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "github-actions-unpinned-action",
    severity: "medium",
    evaluate(file) {
      if (!GITHUB_WORKFLOW_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        const match = line.content.match(/^\s*(?:-\s*)?uses:\s*([^@\s]+\/[^@\s]+)@([^\s#]+)\s*$/i);
        if (match && !/^[a-f0-9]{40}$/i.test(match[2])) {
          findings.push(createFinding({
            ruleId: "github-actions-unpinned-action",
            severity: "medium",
            title: "GitHub Action is not pinned to a commit SHA",
            message: "Third-party Actions pinned to tags or branches can change without review.",
            recommendation: "Pin external Actions to a full commit SHA and review updates deliberately.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "dockerfile-root-user",
    severity: "medium",
    evaluate(file) {
      if (!DOCKERFILE_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/^\s*USER\s+(root|0)\s*$/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "dockerfile-root-user",
            severity: "medium",
            title: "Docker image runs as root",
            message: "The Dockerfile explicitly switches to the root user, increasing container breakout impact.",
            recommendation: "Create and run as a non-root user unless root is strictly required.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "dockerfile-curl-shell",
    severity: "medium",
    evaluate(file) {
      if (!DOCKERFILE_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/\b(curl|wget)\b.+\|\s*(sh|bash)\b/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "dockerfile-curl-shell",
            severity: "medium",
            title: "Remote install script executed in Dockerfile",
            message: "Piping a remote script directly into a shell makes builds hard to audit and vulnerable to upstream compromise.",
            recommendation: "Download, verify checksum/signature, and execute a pinned artifact instead.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "kubernetes-privileged-container",
    severity: "high",
    evaluate(file) {
      if (!KUBERNETES_MANIFEST_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/^\s*privileged:\s*true\s*$/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "kubernetes-privileged-container",
            severity: "high",
            title: "Kubernetes privileged container enabled",
            message: "Privileged containers bypass many container isolation boundaries.",
            recommendation: "Remove privileged mode and grant only the specific capabilities required.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "kubernetes-host-namespace",
    severity: "high",
    evaluate(file) {
      if (!KUBERNETES_MANIFEST_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/^\s*(hostNetwork|hostPID|hostIPC):\s*true\s*$/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "kubernetes-host-namespace",
            severity: "high",
            title: "Kubernetes host namespace access enabled",
            message: "Host namespace access can expose node networking or process isolation boundaries.",
            recommendation: "Avoid host namespace access unless the workload is a tightly controlled node agent.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "terraform-public-ingress",
    severity: "high",
    evaluate(file) {
      if (!TERRAFORM_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/cidr_blocks\s*=\s*\[.*"0\.0\.0\.0\/0"/i.test(line.content) || /ipv6_cidr_blocks\s*=\s*\[.*"::\/0"/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "terraform-public-ingress",
            severity: "high",
            title: "Terraform security group allows public ingress",
            message: "A security group rule allows traffic from the public internet.",
            recommendation: "Restrict CIDR ranges to trusted networks and document any intentional public exposure.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "terraform-iam-wildcard",
    severity: "high",
    evaluate(file) {
      if (!TERRAFORM_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/"Action"\s*:\s*"\*"/i.test(line.content) || /actions?\s*=\s*\[.*"\*"/i.test(line.content) || /"Resource"\s*:\s*"\*"/i.test(line.content) || /resources?\s*=\s*\[.*"\*"/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "terraform-iam-wildcard",
            severity: "high",
            title: "Terraform IAM wildcard permission",
            message: "Wildcard IAM actions or resources can grant broader access than intended.",
            recommendation: "Scope IAM policies to explicit actions and resources.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "sql-destructive-migration",
    severity: "high",
    evaluate(file) {
      if (!MIGRATION_PATH.test(file.path) && !SQL_MIGRATION_PATH.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/\bDROP\s+(TABLE|COLUMN|DATABASE)\b/i.test(line.content) || /\bTRUNCATE\s+TABLE\b/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "sql-destructive-migration",
            severity: "high",
            title: "Destructive SQL migration",
            message: "This migration can delete schema or data.",
            recommendation: "Confirm backups, rollback strategy, and phased deploy compatibility before merging.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
  {
    id: "npm-install-script",
    severity: "medium",
    evaluate(file) {
      if (!/(^|\/)package\.json$/i.test(file.path)) return [];
      const findings = [];

      for (const line of file.addedLines) {
        if (/"(preinstall|install|postinstall)"\s*:/i.test(line.content)) {
          findings.push(createFinding({
            ruleId: "npm-install-script",
            severity: "medium",
            title: "npm install lifecycle script added",
            message: "Install lifecycle scripts run during dependency installation and can execute arbitrary commands.",
            recommendation: "Avoid install scripts when possible, or document why this script is required and safe.",
            file,
            line,
          }));
        }
      }

      return findings;
    },
  },
];

function createFinding({ ruleId, severity, title, message, recommendation = null, file, line }) {
  return {
    ruleId,
    source: "rule",
    severity,
    title,
    message,
    path: file.path,
    line: line?.newLine ?? line?.oldLine ?? null,
    recommendation,
  };
}

function isLikelySourceFile(path) {
  return /\.(cjs|mjs|js|jsx|ts|tsx|py|go|rs|java|kt|cs|rb|php|swift)$/i.test(path);
}
