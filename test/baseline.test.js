import assert from "node:assert/strict";
import test from "node:test";
import { applyBaseline, createBaseline, createFindingFingerprint } from "../src/baseline.js";

const firstFinding = {
  ruleId: "secret-api-key",
  source: "rule",
  severity: "high",
  path: "src/config.js",
  line: 12,
  title: "Possible secret committed",
  message: "A newly added line looks like credential material.",
};

const secondFinding = {
  ruleId: "missing-tests",
  source: "rule",
  severity: "medium",
  path: "src/service.js",
  line: 4,
  title: "Source changed without tests",
  message: "This PR changes source code but no test files were detected in the diff.",
};

test("creates deterministic finding fingerprints from stable finding fields", () => {
  const fingerprint = createFindingFingerprint(firstFinding);
  const sameFingerprint = createFindingFingerprint({ ...firstFinding, recommendation: "Move it to a secret store." });
  const changedFingerprint = createFindingFingerprint({ ...firstFinding, line: 13 });

  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(fingerprint, sameFingerprint);
  assert.notEqual(fingerprint, changedFingerprint);
});

test("creates a versioned baseline with compact finding metadata", () => {
  const baseline = createBaseline({ findings: [firstFinding, secondFinding] });

  assert.deepEqual(baseline, {
    version: 1,
    findings: [
      {
        fingerprint: createFindingFingerprint(firstFinding),
        ruleId: "secret-api-key",
        path: "src/config.js",
        title: "Possible secret committed",
      },
      {
        fingerprint: createFindingFingerprint(secondFinding),
        ruleId: "missing-tests",
        path: "src/service.js",
        title: "Source changed without tests",
      },
    ],
  });
});

test("applies a baseline without mutating the original result and recomputes summary", () => {
  const result = {
    filesScanned: 2,
    filesParsed: 2,
    findings: [firstFinding, secondFinding],
    summary: { total: 2, high: 1, medium: 1, low: 0, info: 0 },
  };
  const baseline = createBaseline({ findings: [firstFinding] });

  const filtered = applyBaseline(result, baseline);

  assert.deepEqual(filtered.findings, [secondFinding]);
  assert.deepEqual(filtered.summary, { total: 1, high: 0, medium: 1, low: 0, info: 0 });
  assert.deepEqual(result.findings, [firstFinding, secondFinding]);
  assert.notEqual(filtered, result);
});

test("keeps all findings when baseline is empty or missing", () => {
  const result = {
    findings: [firstFinding],
    summary: { total: 1, high: 1, medium: 0, low: 0, info: 0 },
  };

  assert.deepEqual(applyBaseline(result, null).findings, [firstFinding]);
  assert.deepEqual(applyBaseline(result, { version: 1, findings: [] }).summary, result.summary);
});
