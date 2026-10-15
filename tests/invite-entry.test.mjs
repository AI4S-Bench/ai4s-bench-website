import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../auth/invite/index.html", import.meta.url), "utf8");
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("main-site invitation clears the fragment and forwards it to the control plane", async () => {
  assert.ok(script);
  const visited = [];
  const location = {
    hash: "#tbinvite_abc-123",
    pathname: "/auth/invite/",
    replace: (url) => visited.push(url),
  };
  const history = { replaceState: (_state, _title, path) => visited.push(path) };
  const state = { textContent: "" };
  runInNewContext(script, {
    location,
    history,
    document: { getElementById: () => state },
    fetch: async (path) => {
      assert.equal(path, "../../data/site.json");
      return { ok: true, json: async () => ({ control_plane_url: "https://dashboard.ai4sbench.org" }) };
    },
    URL,
  });
  await new Promise(setImmediate);
  assert.deepEqual(visited, ["/auth/invite/", "https://dashboard.ai4sbench.org/auth/invite#tbinvite_abc-123"]);
  assert.equal(state.textContent, "");
});

test("main-site invitation rejects missing tokens", () => {
  assert.ok(script);
  const state = { textContent: "" };
  runInNewContext(script, {
    location: { hash: "", pathname: "/auth/invite/" },
    history: { replaceState: () => {} },
    document: { getElementById: () => state },
  });
  assert.match(state.textContent, /missing or invalid/);
});
