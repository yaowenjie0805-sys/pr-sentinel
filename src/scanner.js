import { parseUnifiedDiff } from "./diff-parser.js";
import { builtInRules } from "./rules.js";
import { meetsSeverityThreshold, normalizeSeverity } from "./severity.js";

export function scanDiff(diffText, options = {}) {
  const files = parseUnifiedDiff(diffText);
  const excludedRules = new Set(options.excludeRules ?? []);
  const minSeverity = normalizeSeverity(options.minSeverity ?? "info", "info");
  const activeRules = builtInRules.filter((rule) => !excludedRules.has(rule.id));
  const context = { changedFiles: files };
  const findings = [];

  for (const file of files) {
    for (const rule of activeRules) {
      for (const finding of rule.evaluate(file, context)) {
        if (meetsSeverityThreshold(finding.severity, minSeverity)) {
          findings.push(finding);
        }
      }
    }
  }

  return {
    filesScanned: files.length,
    findings: sortFindings(findings),
    summary: summarizeFindings(findings),
  };
}

function sortFindings(findings) {
  const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
  return [...findings].sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0);
  });
}

function summarizeFindings(findings) {
  return findings.reduce(
    (summary, finding) => {
      summary.total += 1;
      summary[finding.severity] += 1;
      return summary;
    },
    { total: 0, high: 0, medium: 0, low: 0, info: 0 },
  );
}
