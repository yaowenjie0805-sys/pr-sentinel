#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { appendGitHubSummary, getGitHubDiffCommand } from "../src/github.js";
import { scanDiff } from "../src/scanner.js";
import { formatResult } from "../src/formatters.js";
import { meetsSeverityThreshold, normalizeSeverity } from "../src/severity.js";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

const diffText = await loadDiff(args);
const result = scanDiff(diffText, {
  minSeverity: args["min-severity"] ?? "info",
  excludeRules: splitList(args["exclude-rule"]),
});
const output = formatResult(result, args.format ?? "markdown");

process.stdout.write(output);
await appendGitHubSummary(output);

const failOn = String(args["fail-on"] ?? "high").toLowerCase() === "none"
  ? "none"
  : normalizeSeverity(args["fail-on"] ?? "high", "high");
const shouldFail = result.findings.some((finding) => meetsSeverityThreshold(finding.severity, failOn));

if (shouldFail) {
  process.exitCode = 1;
}

async function loadDiff(parsedArgs) {
  if (parsedArgs.diff) {
    return readFile(parsedArgs.diff, "utf8");
  }

  const [command, commandArgs] = getGitHubDiffCommand();
  const diff = spawnSync(command, commandArgs, { encoding: "utf8" });

  if (diff.status !== 0) {
    process.stderr.write(diff.stderr || "Failed to read git diff.\n");
    process.exit(2);
  }

  return diff.stdout;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];

    if (inlineValue === undefined) index += 1;
    parsed[rawKey] = value;
  }

  return parsed;
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printHelp() {
  process.stdout.write(`pr-sentinel

Usage:
  pr-sentinel [options]

Options:
  --diff <path>             Read a unified diff from a file. Defaults to git diff base...HEAD.
  --format <markdown|json>  Output format. Defaults to markdown.
  --fail-on <severity>      Exit 1 when a finding meets this severity. Use none to never fail. Defaults to high.
  --min-severity <severity> Hide findings below this severity. Defaults to info.
  --exclude-rule <ids>      Comma-separated rule ids to skip.
  --help                    Show this help.

Environment:
  PR_SENTINEL_BASE          Git base ref for automatic diff mode.
  PR_SENTINEL_HEAD          Git head ref for automatic diff mode.
`);
}
