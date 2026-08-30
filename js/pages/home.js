/* ============================================================
   AI4S-Benchmark · Homepage
   ============================================================ */

import { getSite, getTasks, getReleases, getNews, ROOT } from "../data.js";
import { taskCard, emptyState, esc } from "../components.js";

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

/* ---- Affiliation band ----
   The markup holds one group of institution marks. Clone it until the track is
   wide enough that the loop never exposes a gap, then hand the copy count and a
   constant-speed duration to the CSS animation. Without JS the group simply
   sits centred and still. */
async function renderLogoBand() {
  const track = document.getElementById("logo-band-track");
  const group = track?.firstElementChild;
  if (!group) return;

  // Widths depend on the loaded images, so measure only once they have settled
  await Promise.all(
    [...group.querySelectorAll("img")].map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((done) => {
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          })
    )
  );

  const groupWidth = group.getBoundingClientRect().width;
  if (!groupWidth) return;

  const copies = Math.max(2, Math.ceil((window.innerWidth * 2) / groupWidth));
  for (let i = 1; i < copies; i++) {
    const clone = group.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    track.appendChild(clone);
  }

  track.style.setProperty("--band-copies", copies);
  track.style.setProperty("--band-duration", `${Math.round(groupWidth / 26)}s`);
  track.classList.add("is-rolling");
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

/* ---- Roadmap ----
   One row of stops: the three phases, with the two publication milestones
   sitting between Bench and Dataset. Milestones are marked differently so they
   read as submissions along the way, not as phases of their own. */
function planStep({ kicker, title, text, modifier }) {
  return `<li class="plan__step${modifier}">
    <span class="plan__kicker">${esc(kicker)}</span>
    <h3>${esc(title)}</h3>
    <p>${esc(text)}</p>
  </li>`;
}

async function renderRoadmap() {
  const site = await getSite();

  const phases = site.roadmap.map((phase, i) =>
    planStep({
      kicker: phase.current ? `Phase 0${i + 1} · now` : `Phase 0${i + 1}`,
      title: phase.title,
      text: phase.short ?? phase.summary,
      modifier: phase.current ? " plan__step--current" : "",
    })
  );

  const milestones = (site.submissions ?? []).map((s) =>
    planStep({
      kicker: "Submission",
      title: s.venue,
      text: s.short ?? s.when,
      modifier: " plan__step--submission",
    })
  );

  // Bench → submissions → Dataset → Challenge
  document.getElementById("roadmap").innerHTML = [phases[0], ...milestones, ...phases.slice(1)].join("");
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

Promise.all([renderHero(), renderLogoBand(), renderFeatured(), renderRoadmap(), renderNews()]).catch((err) =>
  console.error("Homepage render failed:", err)
);
