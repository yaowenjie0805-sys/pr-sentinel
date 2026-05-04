import { parseUnifiedDiff } from "./diff-parser.js";
import { builtInRules } from "./rules.js";
import { filterChangedFiles } from "./path-filter.js";
import { meetsSeverityThreshold, normalizeSeverity } from "./severity.js";

export function scanDiff(diffText, options = {}) {
  const parsedFiles = parseUnifiedDiff(diffText);
  const files = filterChangedFiles(parsedFiles, options.paths);
  const enabledRules = new Set(options.enabledRules ?? []);
  const excludedRules = new Set(options.excludeRules ?? options.disabledRules ?? []);
  const minSeverity = normalizeSeverity(options.minSeverity ?? "info", "info");
  const activeRules = builtInRules.filter((rule) => {
    const allowedByEnabled = enabledRules.size === 0 || enabledRules.has(rule.id);
    return allowedByEnabled && !excludedRules.has(rule.id);
  });
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
    filesParsed: parsedFiles.length,
    findings: sortFindings(findings),
    summary: summarizeFindings(findings),
  };
}

export function buildScanResult(filesScanned, filesParsed, findings, minSeverity = "info") {
  const filteredFindings = findings.filter((finding) => meetsSeverityThreshold(finding.severity, minSeverity));

  return {
    filesScanned,
    filesParsed,
    findings: sortFindings(filteredFindings),
    summary: summarizeFindings(filteredFindings),
  };
}

export function getScanFiles(diffText, paths) {
  const parsedFiles = parseUnifiedDiff(diffText);
  return {
    parsedFiles,
    files: filterChangedFiles(parsedFiles, paths),
  };
}

function sortFindings(findings) {
  const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
  return [...findings].sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return String(a.path ?? "").localeCompare(String(b.path ?? "")) || (a.line ?? 0) - (b.line ?? 0);
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
