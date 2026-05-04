import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig, parseSimpleYaml } from "../src/config.js";

test("parses nested yaml config", () => {
  const config = parseSimpleYaml(`failOn: medium
rules:
  disabled:
    - large-change
paths:
  exclude:
    - dist/**
ai:
  provider: anthropic
  model: custom-model
github:
  comment: false
`);

  assert.equal(config.failOn, "medium");
  assert.deepEqual(config.rules.disabled, ["large-change"]);
  assert.deepEqual(config.paths.exclude, ["dist/**"]);
  assert.equal(config.ai.provider, "anthropic");
  assert.equal(config.ai.model, "custom-model");
  assert.equal(config.github.comment, false);
});

test("normalizes defaults and custom AI model", () => {
  const config = normalizeConfig({
    locale: "zh-CN",
    ai: {
      provider: "ollama",
      model: "qwen2.5-coder",
      baseUrl: "http://models.internal:11434",
    },
  });

  assert.equal(config.failOn, "high");
  assert.equal(config.locale, "zh-CN");
  assert.equal(config.ai.provider, "ollama");
  assert.equal(config.ai.model, "qwen2.5-coder");
  assert.equal(config.ai.baseUrl, "http://models.internal:11434");
});

test("rejects invalid provider", () => {
  assert.throws(() => normalizeConfig({ ai: { provider: "unknown" } }), /Invalid ai.provider/);
});

test("rejects invalid locale", () => {
  assert.throws(() => normalizeConfig({ locale: "fr" }), /Invalid locale/);
});
