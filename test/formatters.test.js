import assert from "node:assert/strict";
import test from "node:test";
import { formatResult, toGitHubAnnotations } from "../src/formatters.js";

test("formats AI status finding without path", () => {
  const markdown = formatResult({
    filesScanned: 1,
    summary: { total: 1, high: 0, medium: 0, low: 0, info: 1 },
    findings: [{
      ruleId: "ai-unavailable",
      source: "ai",
      severity: "info",
      title: "AI review unavailable",
      message: "AI review skipped: missing provider credentials",
      path: null,
      line: null,
      recommendation: null,
    }],
  });

  assert.match(markdown, /\| info \| ai-unavailable \| - \|/);
});

test("creates GitHub annotations for line findings only", () => {
  const annotations = toGitHubAnnotations({
    findings: [
      { severity: "high", title: "Risk", message: "Bad", path: "src/a.js", line: 2 },
      { severity: "info", title: "Info", message: "Note", path: null, line: null },
    ],
  });

  assert.equal(annotations.length, 1);
  assert.equal(annotations[0].path, "src/a.js");
  assert.equal(annotations[0].annotation_level, "failure");
});
