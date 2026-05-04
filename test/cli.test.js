import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../bin/pr-sentinel.js", import.meta.url));
const sampleDiff = fileURLToPath(new URL("./fixtures/sample.diff", import.meta.url));

test("CLI degrades when AI credentials are missing", () => {
  const result = spawnSync(process.execPath, [cli, "scan", "--diff", sampleDiff, "--fail-on", "none"], {
    encoding: "utf8",
    env: cleanEnv(),
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /AI review skipped: missing provider credentials/);
});

test("CLI no-ai skips AI status finding", () => {
  const result = spawnSync(process.execPath, [cli, "scan", "--diff", sampleDiff, "--fail-on", "none", "--no-ai"], {
    encoding: "utf8",
    env: cleanEnv(),
  });

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stdout, /AI review skipped/);
});

test("CLI fails on high finding by default", () => {
  const result = spawnSync(process.execPath, [cli, "scan", "--diff", sampleDiff, "--no-ai"], {
    encoding: "utf8",
    env: cleanEnv(),
  });

  assert.equal(result.status, 1);
});

test("CLI writes SARIF and baseline files", () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-sentinel-"));
  const sarifPath = join(dir, "report.sarif");
  const baselinePath = join(dir, "baseline.json");
  const result = spawnSync(process.execPath, [
    cli,
    "scan",
    "--diff",
    sampleDiff,
    "--fail-on",
    "none",
    "--no-ai",
    "--write-sarif",
    sarifPath,
    "--baseline",
    baselinePath,
    "--update-baseline",
  ], {
    encoding: "utf8",
    env: cleanEnv(),
  });

  assert.equal(result.status, 0);
  assert.equal(JSON.parse(readFileSync(sarifPath, "utf8")).version, "2.1.0");
  assert.equal(JSON.parse(readFileSync(baselinePath, "utf8")).version, 1);
});

test("CLI supports Chinese output", () => {
  const result = spawnSync(process.execPath, [
    cli,
    "scan",
    "--diff",
    sampleDiff,
    "--fail-on",
    "none",
    "--no-ai",
    "--locale",
    "zh-CN",
  ], {
    encoding: "utf8",
    env: cleanEnv(),
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /PR Sentinel 报告/);
  assert.match(result.stdout, /可能提交了敏感密钥/);
});

function cleanEnv() {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  delete env.ANTHROPIC_API_KEY;
  delete env.GITHUB_TOKEN;
  delete env.GITHUB_STEP_SUMMARY;
  return env;
}
