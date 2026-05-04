import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeSeverity } from "./severity.js";

export const DEFAULT_CONFIG = Object.freeze({
  locale: "en",
  failOn: "high",
  minSeverity: "info",
  rules: {
    enabled: [],
    disabled: [],
  },
  paths: {
    include: [],
    exclude: [],
  },
  baseline: {
    path: ".pr-sentinel-baseline.json",
    update: false,
  },
  ai: {
    enabled: true,
    provider: "openai",
    model: null,
    strict: false,
    timeoutMs: 15000,
    baseUrl: null,
  },
  github: {
    comment: true,
    annotations: true,
  },
});

export async function loadConfig(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const configPath = await resolveConfigPath(options.configPath, cwd);
  const fileConfig = configPath ? parseSimpleYaml(await readFile(configPath, "utf8")) : {};
  const merged = deepMerge(DEFAULT_CONFIG, fileConfig, normalizeCliOverrides(options.overrides ?? {}));
  return normalizeConfig(merged);
}

export function normalizeConfig(config = {}) {
  const merged = deepMerge(DEFAULT_CONFIG, config);
  const failOn = String(merged.failOn ?? "high").toLowerCase();

  if (!["none", "info", "low", "medium", "high"].includes(failOn)) {
    throw new Error(`Invalid failOn severity: ${merged.failOn}`);
  }

  const minSeverity = normalizeSeverity(merged.minSeverity, "info");
  const provider = String(merged.ai?.provider ?? "openai").toLowerCase();

  if (!["openai", "anthropic", "ollama"].includes(provider)) {
    throw new Error(`Invalid ai.provider: ${merged.ai?.provider}`);
  }

  return {
    locale: normalizeLocale(merged.locale),
    failOn,
    minSeverity,
    rules: {
      enabled: toArray(merged.rules?.enabled),
      disabled: toArray(merged.rules?.disabled),
    },
    paths: {
      include: toArray(merged.paths?.include),
      exclude: toArray(merged.paths?.exclude),
    },
    baseline: {
      path: merged.baseline?.path ? String(merged.baseline.path) : ".pr-sentinel-baseline.json",
      update: Boolean(merged.baseline?.update),
    },
    ai: {
      enabled: Boolean(merged.ai?.enabled),
      provider,
      model: merged.ai?.model ? String(merged.ai.model) : null,
      strict: Boolean(merged.ai?.strict),
      timeoutMs: Number(merged.ai?.timeoutMs ?? 15000),
      baseUrl: merged.ai?.baseUrl ? String(merged.ai.baseUrl) : null,
    },
    github: {
      comment: Boolean(merged.github?.comment),
      annotations: Boolean(merged.github?.annotations),
    },
  };
}

export function parseSimpleYaml(text) {
  const root = {};
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((raw) => ({ raw, indent: raw.match(/^\s*/)[0].length, text: raw.trim() }))
    .filter((line) => line.text && !line.text.startsWith("#"));
  const stack = [{ indent: -1, value: root }];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    while (line.indent <= stack.at(-1).indent) stack.pop();
    const parent = stack.at(-1).value;

    if (line.text.startsWith("- ")) {
      if (!Array.isArray(parent)) {
        throw new Error(`Invalid YAML list item: ${line.raw}`);
      }
      parent.push(parseScalar(line.text.slice(2)));
      continue;
    }

    const match = line.text.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) {
      throw new Error(`Invalid YAML line: ${line.raw}`);
    }

    const [, key, valueText = ""] = match;
    if (valueText === "") {
      const next = lines[index + 1];
      const value = next && next.indent > line.indent && next.text.startsWith("- ") ? [] : {};
      parent[key] = value;
      stack.push({ indent: line.indent, value });
    } else {
      parent[key] = parseScalar(valueText);
    }
  }

  return root;
}

function parseScalar(valueText) {
  const value = valueText.trim();

  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(",").map((item) => parseScalar(item)) : [];
  }

  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^\d+$/.test(value)) return Number(value);
  return value.replace(/^["']|["']$/g, "");
}

async function resolveConfigPath(configPath, cwd) {
  if (configPath) return resolve(cwd, configPath);

  const defaultPath = resolve(cwd, ".pr-sentinel.yml");
  try {
    await access(defaultPath);
    return defaultPath;
  } catch {
    return null;
  }
}

function normalizeCliOverrides(overrides) {
  const config = {};

  if (overrides.failOn) config.failOn = overrides.failOn;
  if (overrides.locale) config.locale = overrides.locale;
  if (overrides.minSeverity) config.minSeverity = overrides.minSeverity;
  if (overrides.excludeRule) config.rules = { disabled: toArray(overrides.excludeRule) };
  if (overrides.baseline) config.baseline = { path: overrides.baseline };
  if (overrides.updateBaseline) config.baseline = { ...(config.baseline ?? {}), update: true };
  if (overrides.noAi) config.ai = { enabled: false };
  if (overrides.aiProvider || overrides.aiModel) {
    config.ai = {
      ...(config.ai ?? {}),
      provider: overrides.aiProvider,
      model: overrides.aiModel,
    };
  }

  return config;
}

function normalizeLocale(locale) {
  const normalized = String(locale ?? "en").toLowerCase();
  if (normalized === "zh-cn" || normalized === "zh_cn") return "zh-CN";
  if (normalized === "en" || normalized === "en-us") return "en";
  throw new Error(`Invalid locale: ${locale}`);
}

function deepMerge(...values) {
  const result = {};

  for (const value of values) {
    if (!isPlainObject(value)) continue;

    for (const [key, nextValue] of Object.entries(value)) {
      if (nextValue === undefined) continue;
      result[key] = isPlainObject(nextValue) && isPlainObject(result[key])
        ? deepMerge(result[key], nextValue)
        : cloneValue(nextValue);
    }
  }

  return result;
}

function cloneValue(value) {
  if (Array.isArray(value)) return [...value];
  if (isPlainObject(value)) return deepMerge(value);
  return value;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}
