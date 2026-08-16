/* ============================================================
   AI4S-Benchmark · Leaderboard
   Agent/scaffold and underlying model are separate entities.
   Rows expand to task-level breakdowns. Empty states are honest.
   ============================================================ */

import { getResults, getReleases, getSite, ROOT } from "../data.js";
import { esc, emptyState, statusBadge } from "../components.js";

const els = {
  stats: document.getElementById("lb-stats"),
  controls: document.getElementById("lb-controls"),
  table: document.getElementById("lb-table"),
};

const state = { release: "", domain: "", agent: "", model: "", verifiedOnly: false };
let rows = [];

function uniq(arr) {
  return [...new Set(arr.filter((v) => v != null && v !== ""))].sort();
}

function renderControls(results, releases) {
  const releaseOptions = releases.filter((r) => r.status !== "preparing").map((r) => r.version);
  const activeRelease = results.active_release;
  const controls = [];

  controls.push(`<div class="select-control">
    <label for="lb-release">Release</label>
    <select id="lb-release" data-key="release" ${releaseOptions.length === 0 ? "disabled" : ""}>
      ${
        releaseOptions.length === 0
          ? `<option>v0.1 · in preparation</option>`
          : releaseOptions.map((v) => `<option value="${esc(v)}" ${v === activeRelease ? "selected" : ""}>${esc(v)}</option>`).join("")
      }
    </select>
  </div>`);

  const defs = [
    ["domain", "Domain", uniq(rows.flatMap((r) => r.domains ?? []))],
    ["agent", "Agent", uniq(rows.map((r) => r.agent))],
    ["model", "Model", uniq(rows.map((r) => r.model))],
  ];
  for (const [key, label, values] of defs) {
    if (values.length === 0) continue;
    controls.push(`<div class="select-control">
      <label for="lb-${key}">${label}</label>
      <select id="lb-${key}" data-key="${key}">
        <option value="">All</option>
        ${values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}
      </select>
    </div>`);
  }

  if (rows.length > 0) {
    controls.push(`<button type="button" class="filter-toggle" id="lb-verified" aria-pressed="false">Verified only</button>`);
  }

  els.controls.innerHTML = controls.join("");

  els.controls.querySelectorAll("select[data-key]").forEach((sel) =>
    sel.addEventListener("change", () => {
      state[sel.dataset.key] = sel.value;
      renderTable();
    })
  );
  document.getElementById("lb-verified")?.addEventListener("click", (e) => {
    state.verifiedOnly = !state.verifiedOnly;
    e.currentTarget.setAttribute("aria-pressed", String(state.verifiedOnly));
    renderTable();
  });
}

function renderStats(results) {
  if (rows.length === 0) {
    els.stats.innerHTML = "";
    return;
  }
  const stats = [
    { value: uniq(rows.map((r) => r.agent)).length, label: "Agents" },
    { value: uniq(rows.map((r) => r.model)).length, label: "Models" },
    { value: rows.filter((r) => r.verified).length, label: "Verified results" },
  ];
  els.stats.innerHTML = stats
    .map((s) => `<div class="stat"><span class="stat__value">${esc(s.value)}</span><span class="stat__label">${esc(s.label)}</span></div>`)
    .join("");
}

function visibleRows() {
  return rows
    .filter((r) => !state.domain || (r.domains ?? []).includes(state.domain))
    .filter((r) => !state.agent || r.agent === state.agent)
    .filter((r) => !state.model || r.model === state.model)
    .filter((r) => !state.verifiedOnly || r.verified)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function renderTable() {
  if (rows.length === 0) {
    els.table.innerHTML = emptyState({
      title: "First benchmark evaluations are being prepared.",
      text: "Official leaderboard entries appear once evaluations run on a released task set. Every entry will show the agent/scaffold, its underlying model, score, cost, runtime, run count and verification status.",
      actionsHTML: `<span style="display:inline-flex; gap:0.75rem; flex-wrap:wrap; justify-content:center;">
        <a class="btn btn--secondary" href="${ROOT}about/#evaluation">Evaluation methodology</a>
        <a class="btn btn--ghost" data-gh="bench_repo" href="#" target="_blank" rel="noopener">Follow progress on GitHub ↗</a>
      </span>`,
    });
    getSite().then((site) =>
      els.table.querySelectorAll("[data-gh]").forEach((a) => (a.href = site.github.bench_repo))
    );
    return;
  }

  const list = visibleRows();
  if (list.length === 0) {
    els.table.innerHTML = emptyState({
      title: "No results match these filters",
      text: "Try removing a filter — or switch off “Verified only”.",
    });
    return;
  }

  els.table.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th scope="col"><span class="visually-hidden">Expand</span></th>
      <th scope="col">Rank</th><th scope="col">Agent / Scaffold</th><th scope="col">Primary model</th>
      <th scope="col">Organization</th><th scope="col" class="num">Score</th><th scope="col" class="num">Tasks</th>
      <th scope="col" class="num">Cost</th><th scope="col" class="num">Runtime</th><th scope="col" class="num">Runs</th>
      <th scope="col">Verified</th><th scope="col">Date</th>
    </tr></thead>
    <tbody>
      ${list
        .map(
          (r, i) => `<tr data-row="${i}">
          <td><button class="lb-expand-btn" aria-expanded="false" aria-label="Show details for ${esc(r.agent)}">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5L10.5 8 6 12.5"/></svg>
          </button></td>
          <td class="num">${i + 1}</td>
          <td><strong>${esc(r.agent)}</strong></td>
          <td class="mono">${esc(r.model)}</td>
          <td>${esc(r.organization ?? "—")}</td>
          <td class="num"><strong>${esc(r.score ?? "—")}</strong></td>
          <td class="num">${esc(r.tasks ?? "—")}</td>
          <td class="num">${r.cost != null ? "$" + esc(r.cost) : "—"}</td>
          <td class="num">${esc(r.runtime ?? "—")}</td>
          <td class="num">${esc(r.runs ?? "—")}</td>
          <td>${
            r.verified
              ? `<span class="tooltip-host" tabindex="0">${statusBadge("verified")}<span class="tooltip" role="tooltip">This result was reproduced or validated under the AI4S-Benchmark evaluation procedure.</span></span>`
              : "—"
          }</td>
          <td class="mono">${esc(r.date ?? "—")}</td>
        </tr>
        <tr class="lb-expand-row" data-detail="${i}" hidden><td colspan="12">${detailPanel(r)}</td></tr>`
        )
        .join("")}
    </tbody></table></div>`;

  els.table.querySelectorAll(".lb-expand-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tr = btn.closest("tr");
      const detail = els.table.querySelector(`[data-detail="${tr.dataset.row}"]`);
      const open = detail.hidden;
      detail.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
  });
}

function detailPanel(r) {
  const taskRows = (r.task_results ?? [])
    .map(
      (t) => `<li><span class="mono">${esc(t.task_id)}</span> — ${esc(t.result ?? "")} ${t.score != null ? `<span class="mono">(${esc(t.score)})</span>` : ""}</li>`
    )
    .join("");
  return `
    <div style="display:grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit,minmax(14rem,1fr));">
      <div>
        <p class="mono-label" style="margin-bottom:0.4rem;">Task-level results</p>
        ${taskRows ? `<ul style="margin:0; padding-left:1rem;">${taskRows}</ul>` : `<p class="text-muted" style="margin:0;">Not published for this entry.</p>`}
      </div>
      <div>
        <p class="mono-label" style="margin-bottom:0.4rem;">Run configuration</p>
        <p class="text-secondary" style="margin:0; font-size: var(--text-sm);">${esc(r.config ?? "Not published for this entry.")}</p>
      </div>
      <div>
        <p class="mono-label" style="margin-bottom:0.4rem;">Provenance</p>
        ${r.report ? `<a href="${esc(r.report)}" target="_blank" rel="noopener">Evaluation report ↗</a>` : `<p class="text-muted" style="margin:0;">No public report linked.</p>`}
      </div>
    </div>`;
}

Promise.all([getResults(), getReleases()])
  .then(([results, releases]) => {
    rows = results.leaderboard ?? [];
    renderControls(results, releases);
    renderStats(results);
    renderTable();
  })
  .catch((err) => {
    console.error("Leaderboard failed to load:", err);
    els.table.innerHTML = emptyState({
      title: "Leaderboard could not be loaded",
      text: "The results data file could not be fetched. If you are running locally, serve the site over HTTP (see README).",
    });
  });
