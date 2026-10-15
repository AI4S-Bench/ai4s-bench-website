// Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderRich } from "../js/richtext.js";

/* The URL a browser opens: each href attribute after entity decoding. */
const hrefs = (html) =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) =>
    m[1].replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&")
  );

test("an apostrophe in a link target reaches the href unchanged", () => {
  const url = "https://en.wikipedia.org/wiki/Fermi's_golden_rule";
  assert.deepEqual(hrefs(renderRich(`See ${url} and [Fermi's rule](${url}).`)), [url, url]);
});

test("ampersands in a query string still reach the href unchanged", () => {
  assert.deepEqual(hrefs(renderRich("Data: https://a.com/get?id=1&format=csv")), ["https://a.com/get?id=1&format=csv"]);
});
