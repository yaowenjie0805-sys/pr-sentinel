import assert from "node:assert/strict";
import test from "node:test";
import { formatSarif } from "../src/sarif.js";

test("formats line findings as SARIF results with locations", () => {
  const sarif = formatSarif({
    findings: [
      {
        ruleId: "secret-api-key",
        severity: "high",
        title: "Possible secret committed",
        message: "A newly added line looks like credential material.",
        path: "src/config.js",
        line: 12,
      },
      {
        ruleId: "public-api-change",
        severity: "low",
        title: "Public API surface changed",
        message: "Exports changed in this file.",
        path: "src/index.js",
        line: 3,
      },
    ],
  });

  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.$schema, "https://json.schemastore.org/sarif-2.1.0.json");
  assert.equal(sarif.runs[0].tool.driver.name, "PR Sentinel");
  assert.deepEqual(
    sarif.runs[0].tool.driver.rules.map((rule) => rule.id),
    ["secret-api-key", "public-api-change"],
  );
  assert.equal(sarif.runs[0].results[0].ruleId, "secret-api-key");
  assert.equal(sarif.runs[0].results[0].level, "error");
  assert.equal(sarif.runs[0].results[0].message.text, "A newly added line looks like credential material.");
  assert.deepEqual(sarif.runs[0].results[0].locations, [
    {
      physicalLocation: {
        artifactLocation: {
          uri: "src/config.js",
        },
        region: {
          startLine: 12,
        },
      },
    },
  ]);
  assert.equal(sarif.runs[0].results[1].level, "warning");
});

test("formats no-line and no-path findings", () => {
  const sarif = formatSarif({
    findings: [
      {
        ruleId: "dependency-change",
        severity: "medium",
        title: "Dependency graph changed",
        message: "Check license and compatibility impact.",
        path: "package.json",
        line: null,
      },
      {
        ruleId: "ai-unavailable",
        severity: "info",
        title: "AI review unavailable",
        message: "AI review skipped: missing provider credentials",
        path: null,
        line: null,
      },
    ],
  });

  assert.equal(sarif.runs[0].results[0].level, "error");
  assert.deepEqual(sarif.runs[0].results[0].locations, [
    {
      physicalLocation: {
        artifactLocation: {
          uri: "package.json",
        },
      },
    },
  ]);
  assert.equal(sarif.runs[0].results[1].level, "note");
  assert.equal(Object.hasOwn(sarif.runs[0].results[1], "locations"), false);
});
