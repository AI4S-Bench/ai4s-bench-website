// Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRich, excerptHTML } from "../js/richtext.js";

test("asterisks with spaces around them are multiplication, not emphasis", () => {
  const text = "Run on a 64 * 64 * 64 grid with 8 GPUs.";
  assert.equal(renderRich(text), `<p>${text}</p>`);
  assert.equal(excerptHTML(text), text);
});

test("*emphasis* still renders, and the excerpt drops its markers", () => {
  const text = "This is *important* and (*very*) nice.";
  assert.equal(renderRich(text), "<p>This is <em>important</em> and (<em>very</em>) nice.</p>");
  assert.equal(excerptHTML(text), "This is important and (very) nice.");
});
