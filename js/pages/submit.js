/* ============================================================
   AI4S-Benchmark · Task proposal form
   Four sections + review. On submit, the proposal is sent to the
   control plane, which opens a GitHub Discussion for review.
   Field → schema mapping lives in ../proposal.js (DOM-free).
   ============================================================ */

import { getSite } from "../data.js";
import { esc } from "../components.js";
import { controlPlaneFetch, currentUser, signInWithGitHub } from "../app.js";
import {
  LIMITS,
  STEP_FIELDS,
  validateAnswers,
  firstInvalidStep,
  buildProposalDocument,
  buildMarkdown,
  slugify,
} from "../proposal.js";

const STEPS = ["Scientific problem", "Environment", "Evaluation", "Contributor", "Review & submit"];
const REVIEW_STEP = STEPS.length - 1;
const DRAFT_KEY = "ai4s-proposal-draft";
const CONTACT = "contact@ai4sbench.org";

const form = document.getElementById("proposal-wizard");
const nav = document.getElementById("wizard-nav");
const steps = [...document.querySelectorAll(".wizard__step")];
const footer = document.getElementById("wizard-footer");
const prevBtn = document.getElementById("wizard-prev");
const nextBtn = document.getElementById("wizard-next");
const reviewList = document.getElementById("review-list");
const authState = document.getElementById("auth-state");
const authAction = document.getElementById("auth-action");
const submitBtn = document.getElementById("wizard-submit");
const submitStatus = document.getElementById("submit-status");
const preview = document.getElementById("proposal-preview");
const success = document.getElementById("submit-success");

let current = 0;
const visited = new Set([0]);
let user = null; // signed-in control-plane user, or null
let serviceState = "checking"; // checking | ready | signed-out | unreachable

/* ---- Answers ---- */
function answers() {
  return Object.fromEntries(new FormData(form).entries());
}

/* ---- Domain options from site config ---- */
getSite()
  .then((site) => {
    document.getElementById("f-domain").insertAdjacentHTML(
      "beforeend",
      site.domains.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("")
    );
    restoreDraft();
  })
  .catch((err) => console.error("Site config failed to load:", err));

/* ---- Draft persistence (this browser only) ---- */
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers()));
  } catch {
    /* storage unavailable — fine */
  }
}
function restoreDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (!draft) return;
    for (const [key, value] of Object.entries(draft)) {
      const el = form.elements[key];
      if (el && !el.value) el.value = value;
    }
    updateSlug();
    updateCounters();
  } catch {
    /* ignore corrupt drafts */
  }
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/* ---- Character counters ---- */
const counters = new Map();
for (const [key, { min }] of Object.entries(LIMITS)) {
  if (min < 10) continue;
  const el = form.elements[key];
  const wrap = el?.closest("[data-field]");
  if (!wrap) continue;
  const c = document.createElement("span");
  c.className = "counter";
  c.setAttribute("aria-hidden", "true");
  wrap.querySelector("label")?.appendChild(c);
  counters.set(key, c);
}
function updateCounters() {
  for (const [key, c] of counters) {
    const len = form.elements[key].value.trim().length;
    const { min } = LIMITS[key];
    c.textContent = len < min ? `${len} / ${min} min` : `${len}`;
    c.classList.toggle("is-met", len >= min);
  }
}

/* ---- Slug preview ---- */
function updateSlug() {
  document.getElementById("slug-preview").textContent = slugify(form.elements.title.value) || "—";
}

/* ---- Validation display ---- */
function fieldWrap(key) {
  return form.querySelector(`[data-field="${key}"]`);
}
function showErrors(errors, keys) {
  for (const key of keys) {
    const wrap = fieldWrap(key);
    if (!wrap) continue;
    let msg = wrap.querySelector(":scope > .field-error");
    if (errors[key]) {
      if (!msg) {
        msg = document.createElement("p");
        msg.className = "field-error";
        msg.setAttribute("role", "alert");
        wrap.appendChild(msg);
      }
      msg.textContent = errors[key];
      wrap.classList.add("is-invalid");
      form.elements[key]?.setAttribute("aria-invalid", "true");
    } else {
      msg?.remove();
      wrap.classList.remove("is-invalid");
      form.elements[key]?.removeAttribute("aria-invalid");
    }
  }
}
function validateStep(i) {
  const keys = STEP_FIELDS[i] ?? [];
  const errors = validateAnswers(answers());
  showErrors(errors, keys);
  const bad = keys.find((k) => errors[k]);
  if (bad) form.elements[bad]?.focus({ preventScroll: false });
  return !bad;
}

/* ---- Live updates ---- */
form.addEventListener("input", (e) => {
  const key = e.target.name;
  if (!key) return;
  if (key === "title") updateSlug();
  updateCounters();
  if (fieldWrap(key)?.classList.contains("is-invalid")) {
    showErrors(validateAnswers(answers()), [key]);
  }
  saveDraft();
});

/* ---- Step navigation ---- */
function renderNav() {
  const errors = validateAnswers(answers());
  nav.innerHTML = STEPS.map((label, i) => {
    const fields = STEP_FIELDS[i] ?? [];
    const complete = i < REVIEW_STEP && visited.has(i) && i !== current && !fields.some((f) => errors[f]);
    return `<button type="button" class="wizard__nav-item${complete ? " is-complete" : ""}"
      data-step="${i}" ${i === current ? 'aria-current="step"' : ""}>
      <span class="wizard__nav-num">${i + 1}</span> ${esc(label)}
    </button>`;
  }).join("");
  nav.querySelectorAll("[data-step]").forEach((btn) =>
    btn.addEventListener("click", () => goTo(Number(btn.dataset.step)))
  );
}

function goTo(i, { scroll = true } = {}) {
  current = Math.max(0, Math.min(STEPS.length - 1, i));
  visited.add(current);
  steps.forEach((s, idx) => (s.hidden = idx !== current));
  prevBtn.disabled = current === 0;
  nextBtn.hidden = current === REVIEW_STEP;
  if (current === REVIEW_STEP) renderReview();
  renderNav();
  if (scroll) {
    document.getElementById("wizard-section").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  steps[current].querySelector("input, select, textarea, button:not([hidden])")?.focus({ preventScroll: true });
}

prevBtn.addEventListener("click", () => goTo(current - 1));
nextBtn.addEventListener("click", () => {
  if (validateStep(current)) goTo(current + 1);
});

/* ---- Review step ---- */
function renderReview() {
  const errors = validateAnswers(answers());
  reviewList.innerHTML = STEPS.slice(0, REVIEW_STEP)
    .map((label, i) => {
      const issues = STEP_FIELDS[i].filter((f) => errors[f]);
      const ok = issues.length === 0;
      return `<div class="review-item${ok ? " is-ok" : " is-missing"}">
        <span class="review-item__status" aria-hidden="true">${ok ? "✓" : issues.length}</span>
        <span class="review-item__label">${esc(label)}</span>
        <span class="review-item__note">${ok ? "Complete" : `${issues.length} ${issues.length === 1 ? "field needs" : "fields need"} attention`}</span>
        <button type="button" class="review-item__edit" data-goto="${i}">Edit</button>
      </div>`;
    })
    .join("");
  reviewList.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => goTo(Number(b.dataset.goto)))
  );
  preview.textContent = buildMarkdown(answers());
  updateSubmitState(Object.keys(errors).length === 0);
}

function updateSubmitState(valid = Object.keys(validateAnswers(answers())).length === 0) {
  submitBtn.disabled = !(valid && serviceState === "ready" && user);
}

/* ---- Sign-in state ---- */
function setService(state, message) {
  serviceState = state;
  authState.textContent = message;
  authState.dataset.state = state;
  authAction.hidden = state !== "signed-out";
  updateSubmitState();
}

function applyUser(next) {
  user = next;
  if (user) {
    const login = user.github_login || user.email || "";
    if (login && !form.elements.github.value) {
      form.elements.github.value = user.github_login || "";
      updateCounters();
    }
    setService("ready", `Signed in as @${login}. Your proposal will open as a GitHub Discussion linked to this account.`);
  } else {
    setService("signed-out", "Sign in with GitHub to submit. Your draft stays in this browser.");
  }
}

function unreachable() {
  setService(
    "unreachable",
    `The proposal service isn't reachable from this page right now. Copy your proposal as Markdown and email it to ${CONTACT}, or try again later.`
  );
}

async function checkUser() {
  try {
    applyUser(await currentUser());
  } catch (error) {
    // Chen's controlPlaneFetch surfaces a 401 as "Unauthorized" (backend detail) or "Request failed (401)".
    if (/unauthori[sz]ed|\(401\)/i.test(error?.message || "")) applyUser(null);
    else unreachable();
  }
}

authAction.addEventListener("click", async () => {
  authAction.disabled = true;
  authState.textContent = "Opening GitHub sign-in…";
  try {
    applyUser(await signInWithGitHub());
  } catch (error) {
    setService("signed-out", error?.message || "GitHub sign-in did not complete.");
  } finally {
    authAction.disabled = false;
  }
});

document.addEventListener("ai4sbench:authchange", (e) => applyUser(e.detail ?? null));
checkUser();

/* ---- Submit ---- */
function setStatus(message, tone = "") {
  submitStatus.textContent = message;
  submitStatus.className = `submit-status${tone ? ` is-${tone}` : ""}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errors = validateAnswers(answers());
  const badStep = firstInvalidStep(errors);
  if (badStep >= 0) {
    showErrors(errors, STEP_FIELDS[badStep]);
    goTo(badStep);
    validateStep(badStep);
    return;
  }
  if (!user) {
    setStatus("Sign in with GitHub first.", "error");
    return;
  }
  submitBtn.disabled = true;
  setStatus("Creating your GitHub Discussion…");
  try {
    const doc = buildProposalDocument(answers());
    const proposal = await controlPlaneFetch("/api/v1/proposals", {
      method: "POST",
      body: JSON.stringify(doc),
    });
    showSuccess(proposal);
  } catch (error) {
    setStatus(error?.message || "The proposal could not be submitted. Please try again.", "error");
    submitBtn.disabled = false;
  }
});

function showSuccess(proposal) {
  clearDraft();
  const link = document.getElementById("success-link");
  const url = proposal?.discussion_url;
  if (url) {
    link.href = url;
    link.hidden = false;
  } else {
    link.hidden = true;
    document.getElementById("success-text").textContent =
      "Your proposal was received. The review Discussion link will appear on GitHub shortly.";
  }
  steps.forEach((s) => (s.hidden = true));
  footer.hidden = true;
  nav.hidden = true;
  form.classList.add("is-submitted");
  success.hidden = false;
  setStatus("");
  success.querySelector("h2").setAttribute("tabindex", "-1");
  success.querySelector("h2").focus({ preventScroll: true });
  document.getElementById("wizard-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("success-another").addEventListener("click", () => {
  form.reset();
  updateSlug();
  updateCounters();
  success.hidden = true;
  footer.hidden = false;
  nav.hidden = false;
  form.classList.remove("is-submitted");
  visited.clear();
  visited.add(0);
  if (user?.github_login) form.elements.github.value = user.github_login;
  goTo(0);
});

/* ---- Copy as Markdown ---- */
document.getElementById("copy-markdown").addEventListener("click", async () => {
  const feedback = document.getElementById("copy-feedback");
  try {
    await navigator.clipboard.writeText(buildMarkdown(answers()));
    feedback.textContent = "Copied ✓";
  } catch {
    feedback.textContent = "Copy failed — open the preview below and select the text.";
  }
  feedback.classList.add("is-visible");
  setTimeout(() => feedback.classList.remove("is-visible"), 2400);
});

/* ---- Init ---- */
steps.forEach((s, i) => (s.hidden = i !== 0));
prevBtn.disabled = true;
updateSlug();
updateCounters();
renderNav();

/* ============================================================
   Below: Chen's control-plane intake (PR #1), unchanged. It only
   activates when the #dashboard-proposal-form markup is present.
   ============================================================ */
/* ---- Control-plane proposal intake -------------------------------------- */
const intakeForm = document.getElementById("dashboard-proposal-form");
const intakeStatus = document.getElementById("proposal-auth-status");
const intakeSubmit = document.getElementById("proposal-submit");
let intakeUser = null;

function setIntakeStatus(message, tone = "") {
  intakeStatus.textContent = message;
  intakeStatus.className = `proposal-intake__status${tone ? ` is-${tone}` : ""}`;
}

function setIntakeUser(user) {
  intakeUser = user;
  if (user) {
    setIntakeStatus(`Signed in as @${user.github_login || user.email}. Your proposal will open as a GitHub Discussion.`);
    intakeSubmit.textContent = "Open Discussion";
  } else {
    setIntakeStatus("Sign in with GitHub to submit a proposal.");
    intakeSubmit.textContent = "Sign in to submit";
  }
}

async function loadIntakeUser() {
  try { setIntakeUser(await currentUser()); }
  catch (error) {
    if (error.message === "Proposal submissions are not configured yet.") {
      setIntakeStatus("Proposal submissions are being configured. Please use the GitHub issue form above for now.", "error");
      intakeSubmit.disabled = true;
      return;
    }
    setIntakeUser(null);
  }
}

if (intakeForm) {
  intakeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!intakeUser) {
      setIntakeStatus("Opening GitHub sign-in…");
      try { setIntakeUser(await signInWithGitHub()); }
      catch (error) { setIntakeStatus(error.message || "GitHub sign-in did not complete.", "error"); }
      return;
    }
    if (!intakeForm.reportValidity()) return;
    const payload = Object.fromEntries(new FormData(intakeForm).entries());
    if (!payload.additional_information.trim()) payload.additional_information = "None provided";
    intakeSubmit.disabled = true;
    setIntakeStatus("Creating your GitHub Discussion…");
    try {
      const proposal = await controlPlaneFetch("/api/v1/proposals", { method: "POST", body: JSON.stringify(payload) });
      setIntakeStatus("Proposal submitted and GitHub Discussion opened.", "success");
      window.open(proposal.discussion_url, "_blank", "noopener");
      intakeForm.reset();
    } catch (error) {
      setIntakeStatus(error.message || "The proposal could not be submitted.", "error");
    } finally { intakeSubmit.disabled = false; }
  });
  document.addEventListener("ai4sbench:authchange", (event) => setIntakeUser(event.detail));
  void loadIntakeUser();
}
