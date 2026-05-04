const SARIF_VERSION = "2.1.0";
const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";

export function formatSarif(result, options = {}) {
  const findings = Array.isArray(result?.findings) ? result.findings : [];

  return {
    version: SARIF_VERSION,
    $schema: options.schema ?? SARIF_SCHEMA,
    runs: [
      {
        tool: {
          driver: {
            name: "PR Sentinel",
            rules: buildRules(findings),
          },
        },
        results: findings.map(toSarifResult),
      },
    ],
  };
}

function buildRules(findings) {
  const rules = new Map();

  for (const finding of findings) {
    const ruleId = String(finding.ruleId ?? "pr-sentinel");
    if (rules.has(ruleId)) continue;

    rules.set(ruleId, {
      id: ruleId,
      name: ruleId,
      shortDescription: {
        text: String(finding.title ?? ruleId),
      },
    });
  }

  return [...rules.values()];
}

function toSarifResult(finding) {
  const sarifResult = {
    ruleId: String(finding.ruleId ?? "pr-sentinel"),
    level: toSarifLevel(finding.severity),
    message: {
      text: String(finding.message ?? finding.title ?? ""),
    },
  };

  if (finding.path) {
    sarifResult.locations = [
      {
        physicalLocation: {
          artifactLocation: {
            uri: String(finding.path),
          },
          ...toRegion(finding.line),
        },
      },
    ];
  }

  return sarifResult;
}

function toRegion(line) {
  return Number.isInteger(line) && line > 0
    ? { region: { startLine: line } }
    : {};
}

function toSarifLevel(severity) {
  if (severity === "high" || severity === "medium") return "error";
  if (severity === "low") return "warning";
  return "note";
}
