#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
import { formatResult } from "../src/formatters.js";
import { getGitHubDiffCommand, publishGitHubReport } from "../src/github.js";
import { reviewWithAi } from "../src/ai.js";
import { buildScanResult, scanDiff } from "../src/scanner.js";
import { meetsSeverityThreshold } from "../src/severity.js";
import { applyBaseline, createBaseline } from "../src/baseline.js";
import { formatSarif } from "../src/sarif.js";

try {
  await main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(2);
}

async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (command !== "scan") {
    throw new Error(`Unknown command: ${command}`);
  }

  const config = await loadConfig({
    configPath: args.config,
    overrides: {
      failOn: args["fail-on"],
      minSeverity: args["min-severity"],
      excludeRule: args["exclude-rule"],
      noAi: args["no-ai"],
      aiProvider: args["ai-provider"],
      aiModel: args["ai-model"],
      baseline: args.baseline,
      updateBaseline: args["update-baseline"],
    },
  });
  const diffText = await loadDiff(args);
  const ruleResult = scanDiff(diffText, {
    minSeverity: "info",
    enabledRules: config.rules.enabled,
    disabledRules: config.rules.disabled,
    paths: config.paths,
  });
  const aiFindings = await reviewWithAi(diffText, config);
  const fullResult = buildScanResult(
    ruleResult.filesScanned,
    ruleResult.filesParsed,
    [...ruleResult.findings, ...aiFindings],
    config.minSeverity,
  );
  const baseline = await loadBaseline(config.baseline.path);
  const result = baseline ? applyBaseline(fullResult, baseline) : fullResult;
  const output = formatResult(result, args.format ?? "markdown");

  process.stdout.write(output);

  if (args["write-report"]) {
    await writeFile(args["write-report"], output);
  }

  if (args["write-sarif"]) {
    await writeFile(args["write-sarif"], `${JSON.stringify(formatSarif(result), null, 2)}\n`);
  }

  if (config.baseline.update) {
    await writeFile(config.baseline.path, `${JSON.stringify(createBaseline(fullResult), null, 2)}\n`);
  }

  try {
    await publishGitHubReport(result, output, config);
  } catch (error) {
    process.stderr.write(`Warning: failed to publish GitHub report: ${error.message}\n`);
  }

  if (result.findings.some((finding) => meetsSeverityThreshold(finding.severity, config.failOn))) {
    process.exitCode = 1;
  }
}

async function loadBaseline(path) {
  if (!path) return null;

  try {
    await access(path);
  } catch {
    return null;
  }

  return JSON.parse(await readFile(path, "utf8"));
}

async function loadDiff(parsedArgs) {
  if (parsedArgs.diff) {
    return readFile(parsedArgs.diff, "utf8");
  }

  const [command, commandArgs] = getGitHubDiffCommand();
  const diff = spawnSync(command, commandArgs, { encoding: "utf8" });

  if (diff.status !== 0) {
    throw new Error(diff.stderr || "Failed to read git diff.");
  }

  return diff.stdout;
}

function parseArgs(argv) {
  const parsed = {};
  let command = "scan";
  let index = 0;

  if (argv[0] && !argv[0].startsWith("-")) {
    command = argv[0];
    index = 1;
  }

  for (; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--no-ai") {
      parsed["no-ai"] = true;
      continue;
    }

    if (arg === "--update-baseline") {
      parsed["update-baseline"] = true;
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

  return { command, args: parsed };
}

function printHelp() {
  process.stdout.write(`pr-sentinel

Usage:
  pr-sentinel scan [options]
  pr-sentinel [options]

Options:
  --config <path>          Read .pr-sentinel.yml from a custom path.
  --diff <path>            Read a unified diff from a file. Defaults to git diff base...HEAD.
  --format <markdown|json|sarif> Output format. Defaults to markdown.
  --fail-on <severity>     Exit 1 when a finding meets this severity. Use none to never fail.
  --min-severity <level>   Hide findings below this severity.
  --exclude-rule <ids>     Comma-separated rule ids to skip.
  --no-ai                  Disable AI review for this run.
  --ai-provider <name>     openai, anthropic, or ollama.
  --ai-model <model>       Custom provider model name.
  --baseline <path>        Filter findings already recorded in a baseline file.
  --update-baseline        Write the current full findings to the baseline file.
  --write-report <path>    Write the report to a file.
  --write-sarif <path>     Write a SARIF report alongside the main report.
  --help                   Show this help.

Environment:
  OPENAI_API_KEY           Enables OpenAI AI review.
  ANTHROPIC_API_KEY        Enables Anthropic AI review.
  GITHUB_TOKEN             Enables PR comments and Checks annotations.
  PR_SENTINEL_BASE         Git base ref for automatic diff mode.
  PR_SENTINEL_HEAD         Git head ref for automatic diff mode.
`);
}
