/* ============================================================
   AI4S-Benchmark · Submission wizard
   Purely client-side. Generates a Markdown proposal and hands
   off to the configured GitHub Task Proposal issue form.
   Nothing is stored or transmitted by this site.
   ============================================================ */

import { getSite } from "../data.js";
import { esc } from "../components.js";

const STEPS = [
  "Scientific Problem",
  "Task",
  "Environment",
  "Evaluation",
  "Difficulty",
  "Integrity",
  "Contributor",
  "Preview",
];

let current = 0;
const visited = new Set([0]);

const nav = document.getElementById("wizard-nav");
const steps = [...document.querySelectorAll(".wizard__step")];
const prevBtn = document.getElementById("wizard-prev");
const nextBtn = document.getElementById("wizard-next");

/* ---- Populate domain + discipline options from site config ---- */
getSite().then((site) => {
  const domainSel = document.getElementById("f-domain");
  domainSel.insertAdjacentHTML(
    "beforeend",
    site.domains.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("")
  );
  document.getElementById("f-disciplines").innerHTML = site.domains
    .filter((d) => d !== "Interdisciplinary")
    .map(
      (d) => `<label class="checkbox-chip"><input type="checkbox" name="disciplines" value="${esc(d)}"><span>${esc(d)}</span></label>`
    )
    .join("");
});

/* ---- Step navigation ---- */
function renderNav() {
  nav.innerHTML = STEPS.map(
    (label, i) => `<button type="button" class="wizard__nav-item${visited.has(i) && i !== current ? " is-complete" : ""}"
      data-step="${i}" ${i === current ? 'aria-current="step"' : ""}>
      <span class="wizard__nav-num">${i + 1}</span> ${esc(label)}
    </button>`
  ).join("");
  nav.querySelectorAll("[data-step]").forEach((btn) =>
    btn.addEventListener("click", () => goTo(Number(btn.dataset.step)))
  );
}

function goTo(i) {
  current = Math.max(0, Math.min(STEPS.length - 1, i));
  visited.add(current);
  steps.forEach((s, idx) => (s.hidden = idx !== current));
  prevBtn.disabled = current === 0;
  nextBtn.hidden = current === STEPS.length - 1;
  if (current === STEPS.length - 1) buildPreview();
  renderNav();
  steps[current].querySelector("input, select, textarea, .proposal-preview")?.focus({ preventScroll: true });
  document.getElementById("wizard-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

prevBtn.addEventListener("click", () => goTo(current - 1));
nextBtn.addEventListener("click", () => goTo(current + 1));

/* ---- Markdown generation ---- */
function val(id) {
  return document.getElementById(id)?.value.trim() ?? "";
}
function checkedDisciplines() {
  return [...document.querySelectorAll('input[name="disciplines"]:checked')].map((c) => c.value);
}
function block(heading, text) {
  return text ? `### ${heading}\n\n${text}\n\n` : "";
}

function buildMarkdown() {
  const disciplines = checkedDisciplines();
  const contributor = [val("f-name"), val("f-affiliation"), val("f-github") ? `@${val("f-github")}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    `## Task Proposal: ${val("f-title") || "(untitled)"}\n\n` +
    `**Primary domain:** ${val("f-domain") || "—"}\n` +
    `**Disciplines:** ${disciplines.length ? disciplines.join(", ") : "—"}\n\n` +
    `## 1 · Scientific problem\n\n` +
    block("Summary", val("f-summary")) +
    block("Scientific importance", val("f-importance")) +
    `## 2 · Task\n\n` +
    block("What the agent receives", val("f-inputs")) +
    block("What it must accomplish", val("f-goal")) +
    block("Expected output", val("f-output")) +
    `## 3 · Environment\n\n` +
    block("Software & tools", val("f-software")) +
    block("Datasets & artifacts", val("f-data")) +
    block("Compute requirements", val("f-compute")) +
    `## 4 · Evaluation\n\n` +
    block("Primary metric", val("f-metric")) +
    block("Pass criteria", val("f-pass")) +
    block("Ground truth / reference", val("f-reference")) +
    block("Verification script concept", val("f-verifier")) +
    `## 5 · Difficulty\n\n` +
    block("Why current agents may fail", val("f-whyhard")) +
    block("Known baseline attempts", val("f-baselines")) +
    block("Estimated cost / runtime", val("f-cost")) +
    `## 6 · Integrity\n\n` +
    block("Contamination risk", val("f-contamination")) +
    block("Answer leakage", val("f-leakage")) +
    block("Anti-cheating strategy", val("f-anticheat")) +
    `## 7 · Contributor\n\n` +
    (contributor || "—") +
    `\n\n---\n*Drafted with the AI4S-Benchmark proposal helper.*\n`
  );
}

function buildPreview() {
  document.getElementById("proposal-preview").textContent = buildMarkdown();
}

/* ---- Copy to clipboard ---- */
document.getElementById("copy-markdown").addEventListener("click", async () => {
  const feedback = document.getElementById("copy-feedback");
  try {
    await navigator.clipboard.writeText(buildMarkdown());
    feedback.textContent = "Copied ✓";
  } catch {
    feedback.textContent = "Copy failed — select the preview text manually.";
  }
  feedback.classList.add("is-visible");
  setTimeout(() => feedback.classList.remove("is-visible"), 2400);
});

/* ---- Init ---- */
steps.forEach((s, i) => (s.hidden = i !== 0));
prevBtn.disabled = true;
renderNav();
