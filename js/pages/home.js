/* ============================================================
   AI4S-Benchmark · Homepage
   ============================================================ */

import { getTasks, getReleases, getNews, ROOT } from "../data.js";
import { taskCard, emptyState, esc, ICONS } from "../components.js";

/* ---- Hero panel: live benchmark state ---- */
async function renderHero() {
  const [tasks, releases] = await Promise.all([getTasks(), getReleases()]);

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
  const interdisciplinary = tasks.filter((t) => t.interdisciplinary).length;

  const stats = [
    { value: tasks.length, label: released > 0 ? "Public tasks" : "Candidate tasks" },
    { value: disciplines.size, label: "Disciplines" },
    { value: underReview, label: "Under review" },
    { value: interdisciplinary, label: "Interdisciplinary" },
  ];

  document.getElementById("hero-stats").innerHTML = stats
    .map(
      (s) => `<div class="stat">
        <span class="stat__value">${esc(s.value)}</span>
        <span class="stat__label">${esc(s.label)}</span>
      </div>`
    )
    .join("");

  document.getElementById("hero-note").textContent =
    "First benchmark evaluations are being prepared.";
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

Promise.all([renderHero(), renderFeatured(), renderRoadmap(), renderNews()]).catch((err) =>
  console.error("Homepage render failed:", err)
);
renderCredStrip();
