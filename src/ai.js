const DEFAULT_MODELS = {
  openai: "gpt-5.4-mini",
  anthropic: "claude-sonnet-4-5",
  ollama: "llama3.1",
};

export async function reviewWithAi(diffText, config, options = {}) {
  if (!config.ai.enabled) return [];

  const adapter = createAiAdapter(config.ai, options.env ?? process.env, options.fetchImpl ?? fetch);

  if (!adapter.available) {
    return [createAiStatusFinding(`AI review skipped: ${adapter.reason}`)];
  }

  try {
    return await adapter.review(diffText, config);
  } catch (error) {
    if (config.ai.strict) throw error;
    return [createAiStatusFinding(`AI review skipped: ${error.message}`)];
  }
}

export function createAiAdapter(aiConfig, env = process.env, fetchImpl = fetch) {
  const provider = aiConfig.provider;
  const model = aiConfig.model ?? DEFAULT_MODELS[provider];

  if (provider === "openai") {
    return createOpenAiAdapter({ ...aiConfig, model }, env, fetchImpl);
  }

  if (provider === "anthropic") {
    return createAnthropicAdapter({ ...aiConfig, model }, env, fetchImpl);
  }

  return createOllamaAdapter({ ...aiConfig, model }, fetchImpl);
}

function createOpenAiAdapter(aiConfig, env, fetchImpl) {
  if (!env.OPENAI_API_KEY) {
    return unavailable("missing provider credentials");
  }

  return {
    available: true,
    async review(diffText) {
      const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiConfig.model,
          input: buildPrompt(diffText),
        }),
      }, aiConfig.timeoutMs, fetchImpl);
      const data = await readJsonResponse(response);
      const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((item) => item.text).filter(Boolean).join("\n") ?? "";
      return parseAiFindings(text);
    },
  };
}

function createAnthropicAdapter(aiConfig, env, fetchImpl) {
  if (!env.ANTHROPIC_API_KEY) {
    return unavailable("missing provider credentials");
  }

  return {
    available: true,
    async review(diffText) {
      const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiConfig.model,
          max_tokens: 1200,
          messages: [{ role: "user", content: buildPrompt(diffText) }],
        }),
      }, aiConfig.timeoutMs, fetchImpl);
      const data = await readJsonResponse(response);
      const text = data.content?.map((item) => item.text).filter(Boolean).join("\n") ?? "";
      return parseAiFindings(text);
    },
  };
}

function createOllamaAdapter(aiConfig, fetchImpl) {
  return {
    available: true,
    async review(diffText) {
      const baseUrl = aiConfig.baseUrl ?? "http://localhost:11434";
      const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiConfig.model,
          prompt: buildPrompt(diffText),
          stream: false,
        }),
      }, aiConfig.timeoutMs, fetchImpl);
      const data = await readJsonResponse(response);
      return parseAiFindings(data.response ?? "");
    },
  };
}

function unavailable(reason) {
  return {
    available: false,
    reason,
    async review() {
      return [];
    },
  };
}

function buildPrompt(diffText) {
  return `You are PR Sentinel, an enterprise pull request risk reviewer.
Return strict JSON only:
{"findings":[{"severity":"high|medium|low|info","title":"short","message":"specific risk","path":"file path or null","line":number or null,"recommendation":"specific fix"}]}

Review this unified diff:
${String(diffText).slice(0, 60000)}`;
}

function parseAiFindings(text) {
  const jsonText = extractJson(text);
  const parsed = JSON.parse(jsonText);
  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];

  return findings.map((finding, index) => ({
    ruleId: `ai-review-${index + 1}`,
    source: "ai",
    severity: normalizeAiSeverity(finding.severity),
    title: String(finding.title ?? "AI review finding"),
    message: String(finding.message ?? ""),
    path: finding.path ? String(finding.path) : null,
    line: Number.isInteger(finding.line) ? finding.line : null,
    recommendation: finding.recommendation ? String(finding.recommendation) : null,
  }));
}

function extractJson(text) {
  const trimmed = String(text ?? "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not include JSON findings");
  }

  return trimmed.slice(start, end + 1);
}

function normalizeAiSeverity(severity) {
  const value = String(severity ?? "info").toLowerCase();
  return ["high", "medium", "low", "info"].includes(value) ? value : "info";
}

async function fetchWithTimeout(url, init, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("provider timeout");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(response) {
  if (!response.ok) {
    throw new Error(`provider returned HTTP ${response.status}`);
  }

  return response.json();
}

function createAiStatusFinding(message) {
  return {
    ruleId: "ai-unavailable",
    source: "ai",
    severity: "info",
    title: "AI review unavailable",
    message,
    path: null,
    line: null,
    recommendation: "Configure a supported provider key or run with --no-ai.",
  };
}
