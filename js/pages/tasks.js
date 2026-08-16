/* ============================================================
   AI4S-Benchmark · Task explorer
   Client-side search, filtering and sorting over data/tasks.json.
   Filters render only when the data actually contains values.
   ============================================================ */

import { getTasks, ROOT } from "../data.js";
import { taskCard, emptyState, esc } from "../components.js";

const state = {
  query: "",
  filters: {}, // key -> selected value
  interdisciplinaryOnly: false,
  sort: "updated",
};

let allTasks = [];

const els = {
  stats: document.getElementById("task-stats"),
  search: document.getElementById("task-search"),
  filters: document.getElementById("task-filters"),
  sort: document.getElementById("task-sort"),
  interToggle: document.getElementById("filter-interdisciplinary"),
  clear: document.getElementById("filter-clear"),
  count: document.getElementById("task-count"),
  list: document.getElementById("task-list"),
};

const STATUS_LABELS = {
  proposed: "Proposed",
  under_review: "Under Review",
  agent_testing: "Agent Testing",
  verified: "Verified",
  released: "Released",
};

/* ---- Summary stats ---- */
function renderStats() {
  const domains = new Set(allTasks.map((t) => t.domain));
  const released = allTasks.filter((t) => t.status === "released").length;
  const underReview = allTasks.filter((t) => t.status === "under_review").length;

  const stats = [
    { value: allTasks.length, label: allTasks.length === 1 ? "Task" : "Tasks" },
    { value: domains.size, label: domains.size === 1 ? "Domain" : "Domains" },
    { value: released, label: "Released" },
    { value: underReview, label: "Under review" },
  ];
  els.stats.innerHTML = stats
    .map(
      (s) => `<div class="stat"><span class="stat__value">${esc(s.value)}</span><span class="stat__label">${esc(s.label)}</span></div>`
    )
    .join("");
}

/* ---- Data-driven filter selects ---- */
function buildFilters() {
  const defs = [
    { key: "status", label: "Status", values: uniq(allTasks.map((t) => t.status)), display: (v) => STATUS_LABELS[v] ?? v },
    { key: "domain", label: "Domain", values: uniq(allTasks.map((t) => t.domain)) },
    { key: "discipline", label: "Discipline", values: uniq(allTasks.flatMap((t) => t.disciplines ?? [])) },
    { key: "difficulty", label: "Difficulty", values: uniq(allTasks.map((t) => t.difficulty)) },
    { key: "release", label: "Release", values: uniq(allTasks.map((t) => t.release)) },
  ];

  els.filters.innerHTML = defs
    .filter((d) => d.values.length > 0)
    .map(
      (d) => `<div class="select-control">
        <label for="filter-${d.key}">${esc(d.label)}</label>
        <select id="filter-${d.key}" data-filter="${d.key}">
          <option value="">All</option>
          ${d.values.map((v) => `<option value="${esc(v)}">${esc(d.display ? d.display(v) : v)}</option>`).join("")}
        </select>
      </div>`
    )
    .join("");

  els.filters.querySelectorAll("select").forEach((sel) => {
    sel.addEventListener("change", () => {
      state.filters[sel.dataset.filter] = sel.value;
      render();
    });
  });
}

function uniq(arr) {
  return [...new Set(arr.filter((v) => v != null && v !== ""))].sort();
}

/* ---- Filtering pipeline ---- */
function matches(task) {
  const q = state.query.trim().toLowerCase();
  if (q) {
    const haystack = [
      task.title,
      task.id,
      task.short_description,
      task.domain,
      ...(task.disciplines ?? []),
      ...(task.tags ?? []),
      ...(task.task_author ?? []).map((p) => p.name),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (state.filters.status && task.status !== state.filters.status) return false;
  if (state.filters.domain && task.domain !== state.filters.domain) return false;
  if (state.filters.discipline && !(task.disciplines ?? []).includes(state.filters.discipline)) return false;
  if (state.filters.difficulty && task.difficulty !== state.filters.difficulty) return false;
  if (state.filters.release && task.release !== state.filters.release) return false;
  if (state.interdisciplinaryOnly && !task.interdisciplinary) return false;
  return true;
}

function sortTasks(tasks) {
  const sorted = [...tasks];
  if (state.sort === "updated") sorted.sort((a, b) => (b.date_updated ?? "").localeCompare(a.date_updated ?? ""));
  if (state.sort === "added") sorted.sort((a, b) => (b.date_created ?? "").localeCompare(a.date_created ?? ""));
  if (state.sort === "alpha") sorted.sort((a, b) => a.title.localeCompare(b.title));
  return sorted;
}

function anyFilterActive() {
  return (
    state.query.trim() !== "" ||
    state.interdisciplinaryOnly ||
    Object.values(state.filters).some((v) => v)
  );
}

function render() {
  const visible = sortTasks(allTasks.filter(matches));
  els.count.textContent = `${visible.length} of ${allTasks.length} tasks`;
  els.clear.hidden = !anyFilterActive();

  if (visible.length === 0) {
    els.list.innerHTML = `<div style="grid-column: 1 / -1;">${emptyState({
      title: allTasks.length === 0 ? "No tasks yet" : "No tasks match these filters",
      text:
        allTasks.length === 0
          ? "The first candidate tasks are being prepared. Propose one to help define the benchmark."
          : "Try broadening your search or clearing a filter.",
      actionsHTML:
        allTasks.length === 0
          ? `<a class="btn btn--primary" href="${ROOT}submit/">Submit a Task</a>`
          : `<button type="button" class="btn btn--secondary" id="empty-clear">Clear all filters</button>`,
    })}</div>`;
    document.getElementById("empty-clear")?.addEventListener("click", clearFilters);
    return;
  }
  els.list.innerHTML = visible.map(taskCard).join("");
}

function clearFilters() {
  state.query = "";
  state.filters = {};
  state.interdisciplinaryOnly = false;
  els.search.value = "";
  els.filters.querySelectorAll("select").forEach((s) => (s.value = ""));
  els.interToggle.setAttribute("aria-pressed", "false");
  render();
}

/* ---- Events ---- */
els.search.addEventListener("input", () => {
  state.query = els.search.value;
  render();
});
els.sort.addEventListener("change", () => {
  state.sort = els.sort.value;
  render();
});
els.interToggle.addEventListener("click", () => {
  state.interdisciplinaryOnly = !state.interdisciplinaryOnly;
  els.interToggle.setAttribute("aria-pressed", String(state.interdisciplinaryOnly));
  render();
});
els.clear.addEventListener("click", clearFilters);

/* ---- Init ---- */
getTasks()
  .then((tasks) => {
    allTasks = tasks;
    renderStats();
    buildFilters();
    render();
  })
  .catch((err) => {
    console.error("Task explorer failed to load:", err);
    els.list.innerHTML = `<div style="grid-column: 1 / -1;">${emptyState({
      title: "Tasks could not be loaded",
      text: "The task data file could not be fetched. If you are running locally, serve the site over HTTP (see README).",
    })}</div>`;
  });
