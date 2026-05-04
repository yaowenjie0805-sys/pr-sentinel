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
