export function formatResult(result, format = "markdown") {
  if (format === "json") {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  return formatMarkdown(result);
}

function formatMarkdown(result) {
  const lines = [
    "# PR Sentinel Report",
    "",
    `Scanned ${result.filesScanned} changed file${result.filesScanned === 1 ? "" : "s"}.`,
    "",
    `Findings: ${result.summary.total} total, ${result.summary.high} high, ${result.summary.medium} medium, ${result.summary.low} low, ${result.summary.info} info.`,
    "",
  ];

  if (result.findings.length === 0) {
    lines.push("No risk signals detected.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| Severity | Rule | Location | Finding |");
  lines.push("| --- | --- | --- | --- |");

  for (const finding of result.findings) {
    const location = finding.line ? `${finding.path}:${finding.line}` : finding.path;
    lines.push(`| ${finding.severity} | ${finding.ruleId} | ${location} | ${escapePipes(finding.title)}: ${escapePipes(finding.message)} |`);
  }

  return `${lines.join("\n")}\n`;
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|");
}
