import { writeFile } from "node:fs/promises";
import { toGitHubAnnotations } from "./formatters.js";

export async function appendGitHubSummary(markdown, env = process.env) {
  if (!env.GITHUB_STEP_SUMMARY) return false;
  await writeFile(env.GITHUB_STEP_SUMMARY, markdown, { flag: "a" });
  return true;
}

export function getGitHubDiffCommand(env = process.env) {
  const base = env.PR_SENTINEL_BASE ?? `origin/${env.GITHUB_BASE_REF ?? "main"}`;
  const head = env.PR_SENTINEL_HEAD ?? "HEAD";
  return ["git", ["diff", "--no-ext-diff", "--unified=0", `${base}...${head}`]];
}

export async function publishGitHubReport(result, markdown, config, env = process.env, fetchImpl = fetch) {
  await appendGitHubSummary(markdown, env);

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY || !env.GITHUB_SHA) {
    return { comment: false, annotations: false };
  }

  const [owner, repo] = env.GITHUB_REPOSITORY.split("/");
  const apiBase = env.GITHUB_API_URL ?? "https://api.github.com";
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const published = { comment: false, annotations: false };

  if (config.github.comment && getPullRequestNumber(env)) {
    const issueNumber = getPullRequestNumber(env);
    await githubFetch(fetchImpl, `${apiBase}/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: markdown }),
    });
    published.comment = true;
  }

  if (config.github.annotations) {
    const annotations = toGitHubAnnotations(result);
    await githubFetch(fetchImpl, `${apiBase}/repos/${owner}/${repo}/check-runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "PR Sentinel",
        head_sha: env.GITHUB_SHA,
        status: "completed",
        conclusion: result.summary.high > 0 ? "failure" : "success",
        output: {
          title: "PR Sentinel Report",
          summary: `Found ${result.summary.total} risk signal(s).`,
          annotations,
        },
      }),
    });
    published.annotations = true;
  }

  return published;
}

function getPullRequestNumber(env) {
  if (env.GITHUB_EVENT_NAME !== "pull_request" && env.GITHUB_EVENT_NAME !== "pull_request_target") {
    return null;
  }

  const refMatch = env.GITHUB_REF?.match(/refs\/pull\/(\d+)\/merge/);
  return env.PR_SENTINEL_PR_NUMBER ?? refMatch?.[1] ?? null;
}

async function githubFetch(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);

  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}`);
  }

  return response;
}
