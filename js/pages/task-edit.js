/* ============================================================
   AI4S-Benchmark · On-site proposal editor
   Lets the author of a proposal revise it on the task page with
   a live rendered preview (Markdown + LaTeX), the way a GitHub
   Discussion can be edited.

   Permissions: the editor is offered only when the signed-in
   GitHub login matches the proposal's `github` field, and the
   control plane must enforce the same rule server-side — the
   frontend check is a convenience, never the security boundary.

   Backend contract (see README → "On-site editing"):
     PATCH /api/v1/proposals/{proposal_id}   body: ProposalSubmission
     → 200 ProposalPublishedResponse (Discussion updated + re-synced)
     → 403 when the session user is not the author
   Until that endpoint exists the control plane answers 404/405/501
   and the editor falls back to "edit the Discussion on GitHub".
   ============================================================ */

import { controlPlaneFetch } from "../app.js?v=20260913-3";
import { esc } from "../components.js?v=20260913-3";
import {
  LIMITS,
  FIELD_LABELS,
  DOMAIN_SEPARATOR,
  validateAnswers,
  buildProposalSubmission,
  buildMarkdown,
} from "../proposal.js?v=20260913-3";
import { renderRich, mountMath } from "../richtext.js?v=20260913-3";
import { mountContributorRows } from "../contributor-fields.js?v=20260913-3";
import { splitContributors } from "../people.js?v=20260913-3";
import { getSite } from "../data.js?v=20260913-3";

/* ---- Feature detection --------------------------------------
   The control plane publishes its OpenAPI document. The on-site
   editor is offered only when that document lists the PATCH
   route; until then the author gets "Edit on GitHub" instead, so
   the site never shows a Save button that cannot succeed. */
const EDIT_ROUTE = "/api/v1/proposals/{proposal_id}";
let availability = null;

export function editingAvailable() {
  if (availability) return availability;
  availability = (async () => {
    try {
      const site = await getSite();
      const baseUrl = String(site.control_plane_url ?? "").replace(/\/$/, "");
      if (!baseUrl) return false;
      const response = await fetch(`${baseUrl}/openapi.json`, { credentials: "omit" });
      if (!response.ok) return false;
      const spec = await response.json();
      const route = spec?.paths?.[EDIT_ROUTE];
      return Boolean(route && (route.patch || route.put));
    } catch {
      return false;
    }
  })();
  return availability;
}

/** True when the signed-in user is the proposal's author. */
export function canEdit(task, user) {
  const login = String(user?.github_login ?? "").trim().toLowerCase();
  const owner = String(task?.github ?? "").trim().toLowerCase();
  return Boolean(login && owner && login === owner);
}

const TEXT_FIELDS = [
  ["problem", 8, "What scientific problem does this task address? Why is it important?"],
  ["solvability", 4, "Is this problem solvable in principle? Does its difficulty come from the science itself?"],
  ["references", 4, "Papers, datasets, code or protocols this task builds on."],
  ["software", 3, "The tools, software and dependencies this task requires."],
  ["dataset", 4, "What data is provided, its provenance and license, and what must stay hidden from the agent."],
  ["compute", 2, "Limit for now: one GPU and 16 CPU cores per task."],
  ["workflow", 4, "Leave empty for open questions where no workflow can be prescribed."],
  ["evaluation", 5, "What is the metric, and how is it used to validate the agent's output?"],
  ["leakage", 3, "Could an agent find the answer in public resources? Is the evaluation repeatable?"],
];

function field(key, label, control, hint = "") {
  return `<div class="form-field" data-field="${key}">
    <label for="edit-${key}">${esc(label)}${LIMITS[key]?.min === 0 ? ' <span class="optional">(optional)</span>' : ""}</label>
    ${control}
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ""}
  </div>`;
}

function textarea(key, rows, value, placeholder) {
  return `<textarea id="edit-${key}" name="${key}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
}

function editorHTML(task) {
  return `<section class="proposal-editor proposal-editor--wide" id="proposal-editor" aria-labelledby="proposal-editor-h">
    <div class="proposal-editor__head">
      <div>
        <span class="eyebrow">Author workspace</span>
        <h2 id="proposal-editor-h">Edit proposal</h2>
        <p>You are signed in as the author of this proposal. Saving updates the task page and the GitHub Discussion. Markdown and LaTeX render in the preview exactly as they will on the page.</p>
      </div>
      <button type="button" class="btn btn--secondary" data-edit-cancel>Back to the proposal</button>
    </div>
    <form class="proposal-editor__grid" id="proposal-edit-form" novalidate>
      <div class="proposal-editor__form">
        ${field("title", FIELD_LABELS.title, `<input type="text" id="edit-title" name="title" maxlength="160" value="${esc(task.title)}">`)}
        <div class="form-field" data-field="domain">
          <label id="edit-domain-label">Domains involved</label>
          <div class="choice-grid" id="edit-domain" role="group" aria-labelledby="edit-domain-label"></div>
        </div>
        ${field("field_name", FIELD_LABELS.field_name, `<input type="text" id="edit-field_name" name="field_name" maxlength="160" value="${esc(task.field_name)}">`)}
        ${TEXT_FIELDS.map(([key, rows, ph]) => field(key, FIELD_LABELS[key], textarea(key, rows, task[key] ?? "", ph))).join("")}
        <div class="form-field" data-field="name" id="edit-contributors"></div>
        <div class="form-field" data-field="affiliation" hidden></div>
        <div class="form-field" data-field="github">
          <label for="edit-github">GitHub username</label>
          <input type="text" id="edit-github" name="github" value="${esc(task.github)}" readonly>
          <p class="hint">The contact account cannot be changed here.</p>
        </div>
      </div>
      <aside class="proposal-editor__preview" aria-label="Live preview">
        <div class="proposal-editor__preview-head">
          <span class="mono-label">Live preview</span>
          <div class="preview-toggle" role="group" aria-label="Preview format">
            <button type="button" class="preview-toggle__btn is-active" data-view="rendered" aria-pressed="true">Rendered</button>
            <button type="button" class="preview-toggle__btn" data-view="markdown" aria-pressed="false">Markdown</button>
          </div>
        </div>
        <div class="proposal-rendered rich" id="edit-rendered"></div>
        <div class="proposal-preview" id="edit-markdown" tabindex="0" hidden></div>
      </aside>
      <div class="proposal-editor__actions" style="grid-column: 1 / -1;">
        <p class="submit-status" id="edit-status" role="status" aria-live="polite"></p>
        <button type="button" class="btn btn--ghost" data-edit-cancel>Cancel</button>
        <button type="submit" class="btn btn--primary" id="edit-save">Save changes</button>
      </div>
    </form>
  </section>`;
}

/**
 * Mount the editor into `root`. Calls onSaved(result) after a successful
 * save and onCancel() when the author leaves without saving.
 */
export function mountEditor({ task, user, root, onSaved, onCancel }) {
  if (!canEdit(task, user)) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = editorHTML(task);
  const form = root.querySelector("#proposal-edit-form");
  const status = root.querySelector("#edit-status");
  const saveBtn = root.querySelector("#edit-save");
  const rendered = root.querySelector("#edit-rendered");
  const markdown = root.querySelector("#edit-markdown");

  const contributors = mountContributorRows(
    root.querySelector("#edit-contributors"),
    splitContributors(task.name, task.affiliation),
    { onChange: () => schedulePreview() }
  );

  /* ---- Domains: shared list from the control plane, current ones checked ---- */
  const current = new Set(String(task.domain ?? "").split(DOMAIN_SEPARATOR).map((d) => d.trim()).filter(Boolean));
  const domainBox = root.querySelector("#edit-domain");
  const renderDomains = (items) => {
    const all = [...new Set([...items, ...current])];
    domainBox.innerHTML = all
      .map((d, i) => `<label class="choice"><input type="checkbox" name="domain" value="${esc(d)}" id="edit-domain-${i}" ${current.has(d) ? "checked" : ""}> ${esc(d)}</label>`)
      .join("");
  };
  renderDomains([]);
  controlPlaneFetch("/api/v1/proposal-domains")
    .then(({ items }) => renderDomains(items))
    .catch(() => {});

  function answers() {
    const data = new FormData(form);
    const out = Object.fromEntries(data.entries());
    out.domain = data.getAll("domain");
    const people = contributors.value();
    out.name = people.name;
    out.affiliation = people.affiliation;
    out.github = task.github;
    return out;
  }

  /* ---- Validation display ---- */
  function showErrors(errors) {
    form.querySelectorAll("[data-field]").forEach((wrap) => {
      const key = wrap.dataset.field;
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
      } else {
        msg?.remove();
        wrap.classList.remove("is-invalid");
      }
    });
    const first = Object.keys(errors)[0];
    if (first) form.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---- Preview ---- */
  let timer = null;
  function renderPreview() {
    const md = buildMarkdown(answers());
    markdown.textContent = md;
    rendered.innerHTML = renderRich(md);
    void mountMath(rendered);
  }
  function schedulePreview() {
    clearTimeout(timer);
    timer = setTimeout(renderPreview, 250);
  }
  form.addEventListener("input", (e) => {
    const key = e.target?.name;
    const wrap = key && form.querySelector(`[data-field="${key}"]`);
    if (wrap?.classList.contains("is-invalid")) {
      const errors = validateAnswers(answers());
      wrap.querySelector(":scope > .field-error")?.remove();
      wrap.classList.toggle("is-invalid", Boolean(errors[key]));
    }
    schedulePreview();
  });
  root.querySelectorAll(".preview-toggle__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".preview-toggle__btn").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      rendered.hidden = btn.dataset.view !== "rendered";
      markdown.hidden = btn.dataset.view !== "markdown";
    });
  });
  renderPreview();

  /* ---- Cancel ---- */
  root.querySelectorAll("[data-edit-cancel]").forEach((b) => b.addEventListener("click", () => onCancel?.()));

  /* ---- Save ---- */
  const setStatus = (message, tone = "") => {
    status.textContent = message;
    status.className = `submit-status${tone ? ` is-${tone}` : ""}`;
  };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errors = validateAnswers(answers());
    showErrors(errors);
    if (Object.keys(errors).length) {
      setStatus("Some fields need attention before saving.", "error");
      return;
    }
    saveBtn.disabled = true;
    setStatus("Saving your changes…");
    try {
      const result = await controlPlaneFetch(`/api/v1/proposals/${encodeURIComponent(task.id)}`, {
        method: "PATCH",
        body: JSON.stringify(buildProposalSubmission(answers())),
      });
      setStatus("Saved. The task page and the Discussion now show your changes.", "success");
      onSaved?.(result);
    } catch (error) {
      saveBtn.disabled = false;
      if ([404, 405, 501].includes(error?.status)) {
        setStatus("Editing on the site is not enabled on the control plane yet.", "error");
        showFallback();
      } else if (error?.status === 403) {
        setStatus("Only the author of this proposal can edit it.", "error");
      } else {
        setStatus(error?.message || "The changes could not be saved. Please try again.", "error");
      }
    }
  });

  function showFallback() {
    if (root.querySelector(".proposal-editor__fallback")) return;
    const box = document.createElement("div");
    box.className = "notice proposal-editor__fallback";
    box.innerHTML = `<div>
      <p><strong>Until then, edit the proposal Discussion on GitHub.</strong> Changes made there appear on this page after the next sync. Use "Markdown" above to copy your revised text.</p>
      ${task.discussion_url ? `<p style="margin-top:0.6rem;"><a class="btn btn--secondary" href="${esc(task.discussion_url)}" target="_blank" rel="noopener">Open the Discussion on GitHub</a></p>` : ""}
    </div>`;
    root.querySelector(".proposal-editor__actions").after(box);
  }
}
