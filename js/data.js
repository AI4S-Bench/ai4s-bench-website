/* ============================================================
   AI4S-Benchmark · Data access layer
   All site content lives in /data/*.json. The eventual CI
   pipeline regenerates those files from canonical benchmark
   metadata in the ai4s-bench repository — nothing here should
   hard-code benchmark content.
   ============================================================ */

/** Root prefix ("" at site root, "../" inside a section folder). */
export const ROOT = document.body.dataset.root ?? "";

const cache = new Map();

async function loadJSON(name) {
  if (cache.has(name)) return cache.get(name);
  const promise = fetch(`${ROOT}data/${name}.json`).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${name}.json (${res.status})`);
    return res.json();
  });
  cache.set(name, promise);
  return promise;
}

export const getSite = () => loadJSON("site");
export const getTasks = () => loadJSON("tasks");
export const getResults = () => loadJSON("results");
export const getContributors = () => loadJSON("contributors");
export const getReleases = () => loadJSON("releases");
export const getNews = () => loadJSON("news");

/** Resolve a task by slug or id. */
export async function getTask(key) {
  const tasks = await getTasks();
  return tasks.find((t) => t.slug === key || t.id === key) ?? null;
}
