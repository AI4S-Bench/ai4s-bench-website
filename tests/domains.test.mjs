import test from "node:test";
import assert from "node:assert/strict";
import { primaryFirst } from "../js/domains.js";

test("primary selection overrides checkbox layout and preserves secondary order", () => {
  assert.deepEqual(primaryFirst(["Physics", "Biology", "AI / ML", "Physics"], "Biology"),
    ["Biology", "Physics", "AI / ML"]);
});
test("an unavailable primary retains the existing domain order", () => {
  assert.deepEqual(primaryFirst(["Biology", "Physics"], "Chemistry"), ["Biology", "Physics"]);
});
