import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { scanDiff } from "../src/scanner.js";

test("detects risk signals in sample diff", async () => {
  const diff = await readFile(new URL("./fixtures/sample.diff", import.meta.url), "utf8");
  const result = scanDiff(diff);

  assert.equal(result.filesScanned, 3);
  assert.ok(result.findings.some((finding) => finding.ruleId === "secret-api-key"));
  assert.ok(result.findings.some((finding) => finding.ruleId === "database-migration"));
  assert.ok(result.findings.some((finding) => finding.ruleId === "dependency-change"));
  assert.ok(result.findings.some((finding) => finding.ruleId === "missing-tests"));
  assert.ok(result.findings.some((finding) => finding.ruleId === "public-api-change"));
});

test("suppresses missing-tests when tests are present", () => {
  const diff = `diff --git a/src/math.js b/src/math.js
index 1111111..2222222 100644
--- a/src/math.js
+++ b/src/math.js
@@ -1,2 +1,11 @@
 export function add(a, b) {
+  if (Number.isNaN(a) || Number.isNaN(b)) {
+    return 0;
+  }
+  if (a === null || b === null) {
+    return 0;
+  }
+  if (a === undefined || b === undefined) {
+    return 0;
+  }
   return a + b;
 }
diff --git a/src/math.test.js b/src/math.test.js
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/math.test.js
@@ -0,0 +1 @@
+test("add", () => {});
`;

  const result = scanDiff(diff);

  assert.equal(result.findings.some((finding) => finding.ruleId === "missing-tests"), false);
});

test("supports min severity filter", async () => {
  const diff = await readFile(new URL("./fixtures/sample.diff", import.meta.url), "utf8");
  const result = scanDiff(diff, { minSeverity: "high" });

  assert.deepEqual([...new Set(result.findings.map((finding) => finding.severity))], ["high"]);
});

test("detects high-value engineering risk rules", () => {
  const diff = `diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 1111111..2222222 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,0 +1,7 @@
+on:
+  pull_request_target:
+permissions: write-all
+jobs:
+  test:
+    steps:
+      - uses: vendor/example-action@v1
diff --git a/Dockerfile b/Dockerfile
index 1111111..2222222 100644
--- a/Dockerfile
+++ b/Dockerfile
@@ -1,0 +1,3 @@
+FROM node:22
+RUN curl https://example.com/install.sh | sh
+USER root
diff --git a/k8s/deployment.yml b/k8s/deployment.yml
index 1111111..2222222 100644
--- a/k8s/deployment.yml
+++ b/k8s/deployment.yml
@@ -1,0 +1,4 @@
+securityContext:
+  privileged: true
+hostNetwork: true
+hostPID: true
diff --git a/infra/main.tf b/infra/main.tf
index 1111111..2222222 100644
--- a/infra/main.tf
+++ b/infra/main.tf
@@ -1,0 +1,4 @@
+cidr_blocks = ["0.0.0.0/0"]
+ipv6_cidr_blocks = ["::/0"]
+actions = ["*"]
+resources = ["*"]
diff --git a/prisma/migrations/202605040002_drop.sql b/prisma/migrations/202605040002_drop.sql
index 1111111..2222222 100644
--- a/prisma/migrations/202605040002_drop.sql
+++ b/prisma/migrations/202605040002_drop.sql
@@ -1,0 +1,2 @@
+DROP TABLE users;
+TRUNCATE TABLE audit_log;
diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -1,0 +1,5 @@
+{
+  "scripts": {
+    "postinstall": "node scripts/setup.js"
+  }
+}
`;
  const result = scanDiff(diff);
  const ruleIds = new Set(result.findings.map((finding) => finding.ruleId));

  assert.ok(ruleIds.has("github-actions-broad-permissions"));
  assert.ok(ruleIds.has("github-actions-pull-request-target"));
  assert.ok(ruleIds.has("github-actions-unpinned-action"));
  assert.ok(ruleIds.has("dockerfile-root-user"));
  assert.ok(ruleIds.has("dockerfile-curl-shell"));
  assert.ok(ruleIds.has("kubernetes-privileged-container"));
  assert.ok(ruleIds.has("kubernetes-host-namespace"));
  assert.ok(ruleIds.has("terraform-public-ingress"));
  assert.ok(ruleIds.has("terraform-iam-wildcard"));
  assert.ok(ruleIds.has("sql-destructive-migration"));
  assert.ok(ruleIds.has("npm-install-script"));
});
