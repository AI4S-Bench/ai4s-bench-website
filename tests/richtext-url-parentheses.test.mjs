// Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRich, excerptHTML } from "../js/richtext.js";

const hrefs = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const url = "https://en.wikipedia.org/wiki/Hamiltonian_(quantum_mechanics)";

test("balanced parentheses stay inside a bare URL", () => {
  assert.deepEqual(hrefs(renderRich(`See ${url} here.`)), [url]);
  assert.deepEqual(hrefs(renderRich(`(${url}).`)), [url]);
});

test("balanced parentheses stay inside a [label](url) target", () => {
  const text = `[Hamiltonian](${url}) here.`;
  assert.equal(renderRich(text), `<p><a href="${url}" target="_blank" rel="noopener">Hamiltonian</a> here.</p>`);
  assert.equal(excerptHTML(text), "Hamiltonian here.");
});

test("a closing parenthesis and period after a URL are prose", () => {
  assert.equal(renderRich("(see https://a.com/x)."), '<p>(see <a href="https://a.com/x" target="_blank" rel="noopener">https://a.com/x</a>).</p>');
});
