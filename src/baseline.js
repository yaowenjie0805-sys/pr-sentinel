import { createHash } from "node:crypto";

const BASELINE_VERSION = 1;

export function createFindingFingerprint(finding) {
  const payload = {
    ruleId: normalizeFingerprintValue(finding.ruleId),
    source: normalizeFingerprintValue(finding.source),
    severity: normalizeFingerprintValue(finding.severity),
    path: normalizeFingerprintValue(finding.path),
    line: normalizeFingerprintValue(finding.line),
    title: normalizeFingerprintValue(finding.title),
    message: normalizeFingerprintValue(finding.message),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function applyBaseline(result, baseline) {
  const baselineFingerprints = new Set((baseline?.findings ?? []).map((finding) => finding.fingerprint).filter(Boolean));
  const findings = (result.findings ?? []).filter((finding) => !baselineFingerprints.has(createFindingFingerprint(finding)));

  return {
    ...result,
    findings,
    summary: summarizeFindings(findings),
  };
}

export function createBaseline(result) {
  return {
    version: BASELINE_VERSION,
    findings: (result.findings ?? []).map((finding) => ({
      fingerprint: createFindingFingerprint(finding),
      ruleId: finding.ruleId ?? null,
      path: finding.path ?? null,
      title: finding.title ?? null,
    })),
  };
}

function normalizeFingerprintValue(value) {
  return value == null ? null : String(value);
}

function summarizeFindings(findings) {
  return findings.reduce(
    (summary, finding) => {
      summary.total += 1;
      if (Object.hasOwn(summary, finding.severity)) {
        summary[finding.severity] += 1;
      }
      return summary;
    },
    { total: 0, high: 0, medium: 0, low: 0, info: 0 },
  );
}
