import assert from "node:assert/strict";
import test from "node:test";
import { publishGitHubReport } from "../src/github.js";

test("publishes PR comment and check annotations", async () => {
  const calls = [];
  const result = {
    summary: { total: 1, high: 1, medium: 0, low: 0, info: 0 },
    findings: [{ severity: "high", title: "Risk", message: "Bad", path: "src/a.js", line: 1 }],
  };
  const published = await publishGitHubReport(
    result,
    "# Report",
    { github: { comment: true, annotations: true } },
    {
      GITHUB_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_SHA: "abc123",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_REF: "refs/pull/42/merge",
    },
    async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 201 };
    },
  );

  assert.deepEqual(published, { comment: true, annotations: true });
  assert.match(calls[0].url, /issues\/42\/comments$/);
  assert.match(calls[1].url, /check-runs$/);
  assert.equal(calls[1].body.output.annotations[0].path, "src/a.js");
});
