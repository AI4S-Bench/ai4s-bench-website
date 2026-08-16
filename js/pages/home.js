/* ============================================================
   AI4S-Benchmark · Homepage
   ============================================================ */

import { getSite, getTasks, getResults, getReleases, getNews, ROOT } from "../data.js";
import { taskCard, emptyState, esc, ICONS, statusBadge } from "../components.js";

/* ---- Hero panel: live benchmark state ---- */
async function renderHero() {
  const [tasks, releases, results] = await Promise.all([getTasks(), getReleases(), getResults()]);

  const releaseEl = document.getElementById("hero-release");
  const current = releases.find((r) => r.status === "current");
  const preparing = releases.find((r) => r.status === "preparing");
  if (current) {
    releaseEl.textContent = `${current.version} · current`;
  } else if (preparing) {
    releaseEl.textContent = `${preparing.version} · preparing`;
  } else {
    releaseEl.textContent = "pre-release";
  }

  const disciplines = new Set(tasks.flatMap((t) => t.disciplines ?? []));
  const released = tasks.filter((t) => t.status === "released").length;
  const underReview = tasks.filter((t) => t.status === "under_review").length;
  const agents = new Set((results.leaderboard ?? []).map((r) => r.agent)).size;

  const stats = [
    { value: tasks.length, label: released > 0 ? "Public tasks" : "Candidate tasks" },
    { value: disciplines.size, label: "Disciplines" },
    { value: underReview, label: "Under review" },
    { value: agents, label: "Agents evaluated" },
  ];

  document.getElementById("hero-stats").innerHTML = stats
    .map(
      (s) => `<div class="stat">
        <span class="stat__value">${esc(s.value)}</span>
        <span class="stat__label">${esc(s.label)}</span>
      </div>`
    )
    .join("");

  const note = document.getElementById("hero-note");
  if ((results.leaderboard ?? []).length === 0) {
    note.textContent = "First benchmark evaluations are being prepared.";
  } else {
    note.textContent = "Continuously evaluated on released tasks.";
  }
}

/* ---- Credibility strip ---- */
function renderCredStrip() {
  const items = ["Open Source", "Verifiable", "Versioned", "Research-Grade", "Community-Built"];
  document.getElementById("cred-strip").innerHTML = items
    .map((t) => `<span class="cred-strip__item">${ICONS.check}${esc(t)}</span>`)
    .join("");
}

/* ---- Featured tasks ---- */
async function renderFeatured() {
  const tasks = await getTasks();
  const el = document.getElementById("featured-tasks");
  if (tasks.length === 0) {
    el.innerHTML = emptyState({
      title: "Tasks are on the way",
      text: "The first candidate tasks are being prepared. Propose one to help define the benchmark.",
      actionsHTML: `<a class="btn btn--primary" href="${ROOT}submit/">Submit a Task</a>`,
    });
    return;
  }
  el.innerHTML = tasks.slice(0, 6).map(taskCard).join("");
}

/* ---- Frontier preview ---- */
async function renderFrontier() {
  const results = await getResults();
  const el = document.getElementById("frontier-preview");
  const rows = results.leaderboard ?? [];

  if (rows.length === 0) {
    el.innerHTML = emptyState({
      title: "First benchmark evaluations are being prepared.",
      text: "Leaderboard entries appear here once official evaluations run on a released task set — with score, cost and verification status for every entry.",
      actionsHTML: `<span style="display:inline-flex; gap:0.75rem; flex-wrap:wrap; justify-content:center;">
        <a class="btn btn--secondary" href="${ROOT}about/#evaluation">Evaluation methodology</a>
        <a class="btn btn--ghost" data-gh="bench_repo" href="#" target="_blank" rel="noopener">Follow on GitHub ↗</a>
      </span>`,
    });
    // data-gh links added after app.js ran — wire this one directly.
    const site = await getSite();
    el.querySelectorAll("[data-gh]").forEach((a) => (a.href = site.github.bench_repo));
    return;
  }

  const top = [...rows].sort((a, b) => b.score - a.score).slice(0, 5);
  el.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th scope="col">Rank</th><th scope="col">Agent</th><th scope="col">Model</th>
      <th scope="col" class="num">Score</th><th scope="col" class="num">Cost</th><th scope="col">Verified</th>
    </tr></thead>
    <tbody>${top
      .map(
        (r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><strong>${esc(r.agent)}</strong></td>
        <td class="mono">${esc(r.model)}</td>
        <td class="num">${esc(r.score)}</td>
        <td class="num">${r.cost != null ? "$" + esc(r.cost) : "—"}</td>
        <td>${r.verified ? statusBadge("verified") : "—"}</td>
      </tr>`
      )
      .join("")}</tbody>
  </table></div>`;
}

/* ---- Roadmap ---- */
async function renderRoadmap() {
  const site = await getSite();
  document.getElementById("roadmap").innerHTML = site.roadmap
    .map(
      (phase, i) => `<div class="roadmap__phase${phase.current ? " roadmap__phase--current" : ""}">
        <span class="roadmap__num">Phase 0${i + 1}</span>
        <h3>${esc(phase.title)} ${phase.current ? '<span class="roadmap__badge">Current phase</span>' : ""}</h3>
        <p>${esc(phase.summary)}</p>
        ${i < site.roadmap.length - 1 ? `<span class="roadmap__arrow" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 8h11M9.5 4l4 4-4 4"/></svg></span>` : ""}
      </div>`
    )
    .join("");
}

/* ---- News ---- */
async function renderNews() {
  const news = await getNews();
  const el = document.getElementById("news-list");
  if (news.length === 0) {
    el.closest("section").hidden = true;
    return;
  }
  el.innerHTML = news
    .slice(0, 4)
    .map(
      (n) => `<li>
        <time datetime="${esc(n.date)}">${esc(n.date)}</time>
        <div>
          <h3>${n.link ? `<a href="${ROOT}${esc(n.link)}" style="color:var(--navy);">${esc(n.title)}</a>` : esc(n.title)}</h3>
          <p>${esc(n.text)}</p>
        </div>
      </li>`
    )
    .join("");
}

Promise.all([renderHero(), renderFeatured(), renderFrontier(), renderRoadmap(), renderNews()]).catch((err) =>
  console.error("Homepage render failed:", err)
);
renderCredStrip();
