/* ============================================================
   AI4S-Benchmark · Contributors & credit
   ============================================================ */

import { getContributors, getSite, ROOT } from "../data.js";
import { esc, emptyState, chip } from "../components.js";

/* ---- Directory ---- */
async function renderDirectory() {
  const contributors = await getContributors();
  const el = document.getElementById("contributor-directory");

  if (contributors.length === 0) {
    el.innerHTML = emptyState({
      title: "The directory opens with the first accepted contributions",
      text: "Contributors are listed here — with their tasks, reviews, roles and point totals — as soon as the first formal contributions are accepted. Yours could be the first.",
      actionsHTML: `<span style="display:inline-flex; gap:0.75rem; flex-wrap:wrap; justify-content:center;">
        <a class="btn btn--primary" href="${ROOT}submit/">Submit a Task</a>
        <a class="btn btn--secondary" href="#become-a-reviewer">Become a Reviewer</a>
      </span>`,
    });
    return;
  }

  el.innerHTML = `<div class="contributor-grid">${contributors
    .map(
      (c) => `<article class="card card--interactive" style="display:flex; flex-direction:column; gap: var(--space-3);">
      <div style="display:flex; align-items:center; gap: var(--space-3);">
        ${
          c.avatar
            ? `<img src="${esc(c.avatar)}" alt="" width="44" height="44" style="border-radius:50%;" loading="lazy">`
            : `<span aria-hidden="true" style="width:44px;height:44px;border-radius:50%;background:var(--selected-bg);display:inline-flex;align-items:center;justify-content:center;font-weight:700;color:var(--electric-blue);">${esc((c.name ?? "?").slice(0, 1))}</span>`
        }
        <div>
          <p style="margin:0;font-weight:700;color:var(--navy);">${esc(c.name)}</p>
          ${c.institution ? `<p style="margin:0;font-size:var(--text-xs);color:var(--ink-muted);">${esc(c.institution)}</p>` : ""}
        </div>
      </div>
      ${c.role ? `<span class="badge badge--candidate">${esc(c.role)}</span>` : ""}
      ${(c.areas ?? []).length ? `<div style="display:flex;flex-wrap:wrap;gap:0.35rem;">${c.areas.map((a) => chip(a)).join("")}</div>` : ""}
      <dl class="def-grid" style="grid-template-columns:repeat(2,1fr); border-top:1px solid var(--border-faint); padding-top:var(--space-3); margin-top:auto;">
        <div><dt>Points</dt><dd class="mono">${esc(c.points ?? "—")}</dd></div>
        <div><dt>Tasks</dt><dd class="mono">${esc(c.tasks_authored?.length ?? 0)}</dd></div>
        <div><dt>Reviews</dt><dd class="mono">${esc(c.tasks_reviewed?.length ?? 0)}</dd></div>
        <div><dt>GitHub</dt><dd>${c.github ? `<a href="https://github.com/${esc(c.github)}" target="_blank" rel="noopener">@${esc(c.github)}</a>` : "—"}</dd></div>
      </dl>
    </article>`
    )
    .join("")}</div>`;
}

/* ---- Points table + roles from site config ---- */
async function renderCredit() {
  const site = await getSite();
  const credit = site.credit;

  document.getElementById("points-table").innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th scope="col">Contribution</th><th scope="col">Category</th><th scope="col" class="num">Points</th></tr></thead>
    <tbody>${credit.points
      .map(
        (p) => `<tr><td>${esc(p.contribution)}</td><td>${chip(p.category)}</td><td class="num"><strong>${esc(p.points)}</strong></td></tr>`
      )
      .join("")}</tbody>
  </table></div>`;

  document.getElementById("roles-grid").innerHTML = credit.roles
    .map(
      (r) => `<div class="role-card">
      <h3>${esc(r.name)}</h3>
      <span class="threshold">${esc(r.threshold)}</span>
      <p>${esc(r.description)}</p>
    </div>`
    )
    .join("");

  document.getElementById("committees-note").textContent = credit.committees_note;
  document.getElementById("authorship-note").textContent = credit.authorship_note;
}

Promise.all([renderDirectory(), renderCredit()]).catch((err) =>
  console.error("Contributors page failed:", err)
);
