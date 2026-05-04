import assert from "node:assert/strict";
import test from "node:test";
import { createAiAdapter, reviewWithAi } from "../src/ai.js";
import { normalizeConfig } from "../src/config.js";

test("returns info finding when OpenAI key is missing", async () => {
  const config = normalizeConfig({ ai: { provider: "openai", enabled: true } });
  const findings = await reviewWithAi("diff --git a/a.js b/a.js", config, { env: {} });

  assert.equal(findings[0].ruleId, "ai-unavailable");
  assert.match(findings[0].message, /missing provider credentials/);
});

test("returns localized AI status finding when credentials are missing", async () => {
  const config = normalizeConfig({ locale: "zh-CN", ai: { provider: "openai", enabled: true } });
  const findings = await reviewWithAi("diff --git a/a.js b/a.js", config, { env: {} });

  assert.equal(findings[0].title, "AI 审查不可用");
  assert.match(findings[0].message, /缺少模型供应商凭据/);
});

test("passes custom OpenAI model to provider", async () => {
  let requestBody = null;
  const adapter = createAiAdapter(
    { provider: "openai", model: "custom-openai-model", timeoutMs: 1000 },
    { OPENAI_API_KEY: "test-key" },
    async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return okResponse({ output_text: '{"findings":[]}' });
    },
  );

  await adapter.review("diff");

  assert.equal(requestBody.model, "custom-openai-model");
});

test("passes custom Anthropic model to provider", async () => {
  let requestBody = null;
  const adapter = createAiAdapter(
    { provider: "anthropic", model: "custom-anthropic-model", timeoutMs: 1000 },
    { ANTHROPIC_API_KEY: "test-key" },
    async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return okResponse({ content: [{ text: '{"findings":[]}' }] });
    },
  );

  await adapter.review("diff");

  assert.equal(requestBody.model, "custom-anthropic-model");
});

test("passes custom Ollama model and base URL to provider", async () => {
  let requestedUrl = null;
  let requestBody = null;
  const adapter = createAiAdapter(
    { provider: "ollama", model: "qwen2.5-coder", baseUrl: "http://models.internal:11434", timeoutMs: 1000 },
    {},
    async (url, init) => {
      requestedUrl = url;
      requestBody = JSON.parse(init.body);
      return okResponse({ response: '{"findings":[]}' });
    },
  );

  await adapter.review("diff");

  assert.equal(requestedUrl, "http://models.internal:11434/api/generate");
  assert.equal(requestBody.model, "qwen2.5-coder");
});

function okResponse(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    },
  };
}
