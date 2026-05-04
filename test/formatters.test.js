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

test("formats SARIF through formatResult", () => {
  const output = formatResult({
    findings: [{ ruleId: "risk", severity: "high", message: "Bad", path: "src/a.js", line: 1 }],
  }, "sarif");
  const sarif = JSON.parse(output);

  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].results[0].ruleId, "risk");
});

test("formats markdown in Simplified Chinese", () => {
  const markdown = formatResult({
    locale: "zh-CN",
    filesScanned: 1,
    summary: { total: 1, high: 1, medium: 0, low: 0, info: 0 },
    findings: [{
      ruleId: "secret-api-key",
      severity: "high",
      title: "可能提交了敏感密钥",
      message: "新增代码看起来像凭据材料。",
      path: "src/config.js",
      line: 1,
    }],
  }, "markdown", { locale: "zh-CN" });

  assert.match(markdown, /# PR Sentinel 报告/);
  assert.match(markdown, /严重级别/);
  assert.match(markdown, /可能提交了敏感密钥/);
});
