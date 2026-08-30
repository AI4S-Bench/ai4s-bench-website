/* ============================================================
   AI4S-Benchmark · Task detail page
   Renders one task from data/tasks.json via ?id=<slug|id>.
   Missing fields render gracefully — early proposals are sparse.
   ============================================================ */

import { getTask, getSite, ROOT } from "../data.js";
import { statusBadge, candidateBadge, chip, esc, emptyState, ICONS, formatDate } from "../components.js";

const params = new URLSearchParams(location.search);
const key = params.get("id");

const els = {
  badges: document.getElementById("td-badges"),
  title: document.getElementById("td-title"),
  meta: document.getElementById("td-meta"),
  actions: document.getElementById("td-actions"),
  main: document.getElementById("td-main"),
  aside: document.getElementById("td-aside"),
};

function notFound() {
  document.getElementById("task-detail-root").innerHTML = `
    <div class="container" style="padding-block: var(--space-8);">
      ${emptyState({
        title: "Task not found",
        text: "This task ID does not exist in the current benchmark data. It may have been renamed or not yet published.",
        actionsHTML: `<a class="btn btn--primary" href="${ROOT}tasks/">Browse all tasks</a>`,
      })}
    </div>`;
}

function section(title, bodyHTML, id = "") {
  if (!bodyHTML) return "";
  return `<section${id ? ` id="${id}"` : ""} aria-labelledby="${id || slugify(title)}-h">
    <h2 id="${id || slugify(title)}-h">${esc(title)}</h2>
    ${bodyHTML}
  </section>`;
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function para(text) {
  return text ? `<p class="text-secondary">${esc(text)}</p>` : "";
}

function pendingLine(text) {
  return `<p class="text-muted" style="font-size: var(--text-sm);">${esc(text)}</p>`;
}

function listOrDash(items) {
  if (!items || items.length === 0) return null;
  return `<ul>${items.map((i) => `<li class="text-secondary">${esc(i)}</li>`).join("")}</ul>`;
}

async function render() {
  const task = key ? await getTask(key) : null;
  if (!task) return notFound();
  const site = await getSite();

  document.title = `${task.id} · ${task.title} | AI4S-Benchmark`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", task.short_description);

  /* ---- Hero ---- */
  els.badges.innerHTML = `
    <span class="task-hero__id">${esc(task.id)}</span>
    ${task.candidate ? candidateBadge() : ""}
    ${statusBadge(task.status)}
    ${task.interdisciplinary ? chip("Interdisciplinary", true) : ""}`;
  els.title.textContent = task.title;

  const metaBits = [
    `<span><span class="mono-label">Domain</span> &nbsp;<strong style="color:var(--navy);">${esc(task.domain)}</strong></span>`,
    (task.disciplines ?? []).length
      ? `<span><span class="mono-label">Disciplines</span> &nbsp;${task.disciplines.map((d) => esc(d)).join(" · ")}</span>`
      : "",
    `<span><span class="mono-label">Release</span> &nbsp;<span class="mono">${task.release ? esc(task.release) : "—"}</span></span>`,
    `<span><span class="mono-label">Updated</span> &nbsp;<span class="mono">${esc(formatDate(task.date_updated))}</span></span>`,
  ];
  els.meta.innerHTML = metaBits.filter(Boolean).join("");

  const actions = [];
  if (task.task_repository_path) {
    actions.push(
      `<a class="btn btn--primary" href="${esc(site.github.bench_repo)}/tree/main/${esc(task.task_repository_path)}" target="_blank" rel="noopener">View Task on GitHub <svg class="ext-arrow" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.75 11.25 11.25 4.75M5.9 4.75h5.35v5.35"/></svg></a>`
    );
  } else {
    actions.push(
      `<a class="btn btn--primary" href="${esc(site.github.bench_repo)}" target="_blank" rel="noopener">Benchmark Repository <svg class="ext-arrow" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.75 11.25 11.25 4.75M5.9 4.75h5.35v5.35"/></svg></a>`
    );
  }
  if (task.github_issue) {
    actions.push(
      `<a class="btn btn--secondary" href="${esc(task.github_issue)}" target="_blank" rel="noopener">View Issue / Review <svg class="ext-arrow" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.75 11.25 11.25 4.75M5.9 4.75h5.35v5.35"/></svg></a>`
    );
  }
  els.actions.innerHTML = actions.join("");

  /* ---- Main column ---- */
  const contextHTML =
    para(task.scientific_value ? `Why it matters — ${task.scientific_value}` : null) + para(task.scientific_context);

  const specHTML = task.task_description
    ? para(task.task_description) +
      (task.provenance_note
        ? `<div class="notice" style="margin-top: var(--space-4);">${ICONS.info}<p>${esc(task.provenance_note)}</p></div>`
        : "")
    : pendingLine("Full public task statement will be published with the Task PR.");

  const envRows = [
    task.environment ? `<div><dt>Environment</dt><dd>${esc(task.environment)}</dd></div>` : "",
    task.required_tools?.length
      ? `<div><dt>Required tools</dt><dd>${task.required_tools.map(esc).join(", ")}</dd></div>`
      : "",
    task.input_artifacts?.length
      ? `<div><dt>Input artifacts</dt><dd>${task.input_artifacts.map(esc).join("; ")}</dd></div>`
      : "",
    task.expected_output ? `<div><dt>Expected output</dt><dd>${esc(task.expected_output)}</dd></div>` : "",
    task.compute_budget ? `<div><dt>Compute budget</dt><dd class="mono">${esc(task.compute_budget)}</dd></div>` : "",
    task.estimated_runtime ? `<div><dt>Estimated runtime</dt><dd class="mono">${esc(task.estimated_runtime)}</dd></div>` : "",
  ].filter(Boolean);
  const envHTML = envRows.length
    ? `<dl class="def-grid" style="grid-template-columns: 1fr;">${envRows.join("")}</dl>` +
      (!task.compute_budget && !task.estimated_runtime
        ? pendingLine("Compute and runtime budgets are fixed during agent testing.")
        : "")
    : pendingLine("Environment specification is defined during the Task PR stage.");

  const evalRows = [
    task.primary_metric ? `<div><dt>Primary metric</dt><dd>${esc(task.primary_metric)}</dd></div>` : "",
    task.secondary_metrics?.length
      ? `<div><dt>Secondary metrics</dt><dd>${task.secondary_metrics.map(esc).join(", ")}</dd></div>`
      : "",
    task.evaluation_method ? `<div><dt>Evaluation method</dt><dd>${esc(task.evaluation_method)}</dd></div>` : "",
    task.token_budget ? `<div><dt>Token budget</dt><dd class="mono">${esc(task.token_budget)}</dd></div>` : "",
  ].filter(Boolean);

  const verificationHTML =
    task.verification_method || task.anti_cheating_notes
      ? `<div class="verify-panel" style="margin-top: var(--space-4);">
          <div class="verify-panel__title">${ICONS.shield} Verification</div>
          ${task.verification_method ? `<p style="margin-bottom: var(--space-3); color: var(--ink-secondary);">${esc(task.verification_method)}</p>` : ""}
          ${task.anti_cheating_notes ? `<p style="margin:0; color: var(--ink-secondary);"><strong style="color: var(--navy);">Anti-cheating.</strong> ${esc(task.anti_cheating_notes)}</p>` : ""}
        </div>`
      : "";

  const evalHTML =
    (evalRows.length ? `<dl class="def-grid" style="grid-template-columns: 1fr;">${evalRows.join("")}</dl>` : "") +
    verificationHTML || pendingLine("Evaluation design is finalized during review.");

  const resultsHTML = task.agent_results?.length
    ? `<div class="table-wrap"><table class="data-table">
        <thead><tr><th scope="col">Agent</th><th scope="col">Model</th><th scope="col">Result</th><th scope="col" class="num">Score</th><th scope="col" class="num">Runtime</th><th scope="col" class="num">Cost</th><th scope="col">Date</th><th scope="col">Verified</th></tr></thead>
        <tbody>${task.agent_results
          .map(
            (r) => `<tr>
            <td><strong>${esc(r.agent)}</strong></td><td class="mono">${esc(r.model)}</td>
            <td>${esc(r.result ?? "—")}</td><td class="num">${esc(r.score ?? "—")}</td>
            <td class="num">${esc(r.runtime ?? "—")}</td><td class="num">${r.cost != null ? "$" + esc(r.cost) : "—"}</td>
            <td class="mono">${esc(r.date ?? "—")}</td><td>${r.verified ? statusBadge("verified") : "—"}</td></tr>`
          )
          .join("")}</tbody></table></div>`
    : emptyState({
        title: "No agent evaluations yet",
        text:
          task.status === "under_review" || task.status === "proposed"
            ? "Agent testing begins after this task passes scientific review and its environment is built."
            : "Agent results will appear here once official evaluations run.",
      });

  const failureHTML = task.failure_modes?.length ? listOrDash(task.failure_modes) : null;

  const provenanceItems = [
    ["Original proposal", task.github_issue],
    ["Task PR", task.github_pr],
    ["Repository path", task.task_repository_path ? `${site.github.bench_repo}/tree/main/${task.task_repository_path}` : null],
  ].filter(([, url]) => url);
  const provenanceHTML =
    (provenanceItems.length
      ? `<ul>${provenanceItems
          .map(([label, url]) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} <svg class="ext-arrow" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.75 11.25 11.25 4.75M5.9 4.75h5.35v5.35"/></svg></a></li>`)
          .join("")}</ul>`
      : "") +
    (task.provenance_note
      ? para(task.provenance_note)
      : "") +
    (provenanceItems.length === 0 && !task.provenance_note
      ? pendingLine("Canonical GitHub records are linked as soon as they exist.")
      : "");

  els.main.innerHTML = [
    section("Scientific context", contextHTML || pendingLine("Context is added during review.")),
    section("Task specification", specHTML),
    section("Environment", envHTML),
    section("Evaluation", evalHTML, "evaluation"),
    section("Agent results", resultsHTML, "results"),
    failureHTML ? section("Failure analysis", failureHTML) : "",
    section("Provenance", provenanceHTML, "provenance"),
  ].join("");

  /* ---- Aside ---- */
  const glance = [
    ["Status", statusBadge(task.status)],
    ["Difficulty", task.difficulty ? esc(task.difficulty) : '<span class="text-muted">Pending review</span>'],
    ["Release", `<span class="mono">${task.release ? esc(task.release) : "—"}</span>`],
    ["Created", `<span class="mono">${esc(formatDate(task.date_created))}</span>`],
    ["Updated", `<span class="mono">${esc(formatDate(task.date_updated))}</span>`],
  ];

  const authorsHTML = task.task_author?.length
    ? task.task_author
        .map(
          (p) => `<div class="person"><span class="person__name">${esc(p.name)}</span>${p.affiliation ? `<span class="person__affil">${esc(p.affiliation)}</span>` : ""}</div>`
        )
        .join("")
    : `<p class="text-muted" style="font-size: var(--text-sm); margin:0;">Contributor credit is assigned and permanently displayed at task acceptance.</p>`;

  const reviewersHTML = task.reviewers?.length
    ? task.reviewers
        .map(
          (p) => `<div class="person"><span class="person__name">${esc(p.name)}</span>${p.affiliation ? `<span class="person__affil">${esc(p.affiliation)}</span>` : ""}</div>`
        )
        .join("")
    : `<p class="text-muted" style="font-size: var(--text-sm); margin:0;">Reviewer assignment pending.</p>`;

  els.aside.innerHTML = `
    <div class="aside-card">
      <h3>At a glance</h3>
      <ul>${glance.map(([k, v]) => `<li><span class="mono-label">${esc(k)}</span><span>${v}</span></li>`).join("")}</ul>
    </div>
    <div class="aside-card">
      <h3>Task contributor</h3>
      ${authorsHTML}
    </div>
    <div class="aside-card">
      <h3>Scientific reviewers</h3>
      ${reviewersHTML}
    </div>
    ${
      (task.tags ?? []).length
        ? `<div class="aside-card"><h3>Tags</h3><div style="display:flex;flex-wrap:wrap;gap:0.4rem;">${task.tags.map((t) => chip(t)).join("")}</div></div>`
        : ""
    }`;
}

render().catch((err) => {
  console.error("Task detail failed:", err);
  notFound();
});
