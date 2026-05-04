import { writeFile } from "node:fs/promises";

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
