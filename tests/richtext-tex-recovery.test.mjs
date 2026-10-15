// Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRich } from "../js/richtext.js";

const json = '[\n  {"id": "mp-149", "band_gap": 1.12}\n]';
const shown = json.replaceAll('"', "&quot;");

test("brackets inside a code fence stay brackets", () => {
  assert.equal(renderRich("```json\n" + json + "\n```"), `<pre><code>${shown}</code></pre>`);
  assert.equal(renderRich("Energies in \\mathrm{eV}:\n\n```json\n" + json + "\n```"), `<p>Energies in \\mathrm{eV}:</p>\n<pre><code>${shown}</code></pre>`);
});

test("parentheses in code are not turned into inline math", () => {
  assert.equal(renderRich("Uses \\sigma:\n\n```\nz = (x_1)\n```"), "<p>Uses \\sigma:</p>\n<pre><code>z = (x_1)</code></pre>");
  assert.equal(renderRich("Set `(x_1)` with \\alpha."), "<p>Set <code>(x_1)</code> with \\alpha.</p>");
});

test("stripped delimiters outside code are still rebuilt", () => {
  assert.equal(renderRich("with \\alpha and\n[\nE = \\hbar\\omega\n]"), "<p>with \\alpha and<br>$$E = \\hbar\\omega$$</p>");
  assert.equal(renderRich("the (\\omega)-limit"), "<p>the \\(\\omega\\)-limit</p>");
});
