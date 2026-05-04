import assert from "node:assert/strict";
import test from "node:test";
import { meetsSeverityThreshold } from "../src/severity.js";

test("none threshold never matches", () => {
  assert.equal(meetsSeverityThreshold("high", "none"), false);
  assert.equal(meetsSeverityThreshold("medium", "none"), false);
});
