import { formatSarif } from "./sarif.js";
import { getUiText } from "./locales.js";

export function formatResult(result, format = "markdown", options = {}) {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  if (format === "sarif") {
    return `${JSON.stringify(formatSarif(result), null, 2)}\n`;
  }

  return formatMarkdown(result, options);
}

function formatMarkdown(result, options = {}) {
  const ui = getUiText(options.locale ?? result.locale);
  const lines = [
    `# ${ui?.reportTitle ?? "PR Sentinel Report"}`,
    "",
    ui?.scannedFiles ? ui.scannedFiles(result.filesScanned) : `Scanned ${result.filesScanned} changed file${result.filesScanned === 1 ? "" : "s"}.`,
    "",
    ui?.findingsSummary ? ui.findingsSummary(result.summary) : `Findings: ${result.summary.total} total, ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.low} low, ${result.summary.info} info.`,
    "",
  ];

  if (result.findings.length === 0) {
    lines.push(ui?.noFindings ?? "No risk signals detected.");
    return `${lines.join("\n")}\n`;
  }

  lines.push(`| ${ui?.table.severity ?? "Severity"} | ${ui?.table.rule ?? "Rule"} | ${ui?.table.location ?? "Location"} | ${ui?.table.finding ?? "Finding"} |`);
  lines.push("| --- | --- | --- | --- |");

  for (const finding of result.findings) {
    const location = finding.path ? (finding.line ? `${finding.path}:${finding.line}` : finding.path) : "-";
    lines.push(`| ${finding.severity} | ${finding.ruleId} | ${location} | ${escapePipes(finding.title)}: ${escapePipes(finding.message)} |`);
  }

  return `${lines.join("\n")}\n`;
}

export function toGitHubAnnotations(result) {
  const ui = getUiText(result.locale);
  return result.findings
    .filter((finding) => finding.path && finding.line)
    .map((finding) => ({
      path: finding.path,
      start_line: finding.line,
      end_line: finding.line,
      annotation_level: toAnnotationLevel(finding.severity),
      title: finding.title,
      message: finding.recommendation
        ? `${finding.message}\n\n${ui?.recommendation ?? "Recommendation"}: ${finding.recommendation}`
        : finding.message,
    }))
    .slice(0, 50);
}

function toAnnotationLevel(severity) {
  if (severity === "high" || severity === "medium") return "failure";
  if (severity === "low") return "warning";
  return "notice";
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|");
}
