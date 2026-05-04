import assert from "node:assert/strict";
import test from "node:test";
import { localizeResult, normalizeLocale } from "../src/locales.js";

test("normalizes supported locales", () => {
  assert.equal(normalizeLocale("zh_cn"), "zh-CN");
  assert.equal(normalizeLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeLocale("en-US"), "en");
});

test("localizes known finding text", () => {
  const result = localizeResult({
    findings: [{
      ruleId: "secret-api-key",
      title: "Possible secret committed",
      message: "English",
      recommendation: null,
    }],
  }, "zh-CN");

  assert.equal(result.locale, "zh-CN");
  assert.equal(result.findings[0].title, "可能提交了敏感密钥");
  assert.match(result.findings[0].message, /凭据材料/);
});
