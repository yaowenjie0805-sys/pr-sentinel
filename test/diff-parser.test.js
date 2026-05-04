import assert from "node:assert/strict";
import test from "node:test";
import { parseUnifiedDiff } from "../src/diff-parser.js";

test("parses files and added lines from unified diff", () => {
  const diff = `diff --git a/src/a.js b/src/a.js
index 1111111..2222222 100644
--- a/src/a.js
+++ b/src/a.js
@@ -1 +1,2 @@
 const a = 1;
+const b = 2;
`;

  const files = parseUnifiedDiff(diff);

  assert.equal(files.length, 1);
  assert.equal(files[0].path, "src/a.js");
  assert.equal(files[0].addedLines.length, 1);
  assert.equal(files[0].addedLines[0].newLine, 2);
  assert.equal(files[0].addedLines[0].content, "const b = 2;");
});

test("handles new files", () => {
  const diff = `diff --git a/test/a.test.js b/test/a.test.js
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/test/a.test.js
@@ -0,0 +1 @@
+test("works", () => {});
`;

  const files = parseUnifiedDiff(diff);

  assert.equal(files[0].status, "added");
  assert.equal(files[0].oldPath, null);
  assert.equal(files[0].newPath, "test/a.test.js");
});
