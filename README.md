# AI4S-Benchmark — Website

The public frontend for **AI4S-Benchmark**, an open, independent, community-built benchmark
for evaluating AI agents on difficult, research-grade scientific tasks.

> **Define what AI solves next in science.**
> Research-grade tasks. Verifiable outcomes. Open infrastructure.

This is a fully static site — semantic HTML, modern CSS, vanilla JavaScript (ES modules),
and local JSON data. No framework, no build step, no backend. GitHub is the operational
backend: proposals, review, task PRs and releases all live in the canonical benchmark
repository, and this site presents them.

---

## Local development

The site uses `fetch()` to load `/data/*.json`, so it must be served over HTTP —
**opening `index.html` directly from the filesystem will not work.**

Any static server does the job:

```bash
# Python
python -m http.server 8000

# Node
npx serve .

# Or any equivalent static server
```

Then open <http://localhost:8000>.

There is no build step. Edit HTML/CSS/JS/JSON and refresh.

Unit tests for the DOM-free modules (lifecycle, proposal checklist, pre-flight rules) use
Node's built-in runner, with nothing to install:

```bash
node --test tests/*.test.mjs
```

Module and stylesheet URLs carry one shared `?v=YYYYMMDD` cache-busting suffix (currently
`?v=20260921`) in every HTML tag and every `import`. Bump them all together: two
different suffixes on one module would load it twice.

> The proposal form, GitHub sign-in, and task board talk to the control plane at
> `https://dashboard.ai4sbench.org`. Its CORS allow-list must include your local
> origin (e.g. `http://localhost:8000`) for those features to work locally; otherwise
> the form shows its "service unreachable" state and everything else works normally.

## Project structure

```text
/
├── index.html              Homepage
├── tasks/
│   ├── index.html          Task explorer (search / filter / sort)
│   └── task.html           Task detail (renders ?id=<id> from the public proposal API; Markdown + KaTeX)
├── submit/index.html       Submission criteria + task proposal form (→ control plane)
├── guide/
│   ├── index.html          Contributor guide: lifecycle, review criteria, Harbor task layout, acceptance checklist
│   └── check.html          Task PR pre-flight check (local folder or public GitHub PR/folder; nothing uploaded)
├── contributors/index.html Contributor directory, points, roles, governance
├── releases/index.html     Versioned releases
├── about/index.html        About & methodology
├── 404.html                Not-found page
├── assets/branding/        Orbit mark, horizontal logo, favicon (all SVG)
├── css/
│   ├── tokens.css          Design tokens (brand palette, type, spacing)
│   ├── base.css            Reset, typography, layout primitives
│   ├── components.css      Header, buttons, badges, cards, tables, forms…
│   ├── pages.css           Page-specific layouts
│   ├── home.css            Front page only: opening, statement, pinned process stage, finale
│   └── workflow.css        Lifecycle timeline, stage meter, proposal checklist, guide and pre-flight pages
├── js/
│   ├── data.js             Static JSON plus public proposal API loading and caching
│   ├── components.js       Shared renderers (task cards, badges, empty states)
│   ├── proposal.js         Proposal form → ProposalSubmission payload / Markdown (DOM-free, testable)
│   ├── richtext.js         Discussion-style text → safe HTML (paragraphs, lists, links, Markdown) + lazy KaTeX; one-line excerpts
│   ├── lifecycle.js        Five-stage lifecycle + display status from proposal, review and revision (DOM-free, tested)
│   ├── timeline.js         Lifecycle timeline on task pages
│   ├── proposal-check.js   Advisory proposal checklist: sources, pass criteria, compute limit, math, duplicates (DOM-free, tested)
│   ├── proposal-advice.js  Shows checklist findings under fields and as a list (submit form, editor, author aside)
│   ├── task-check.js       Task PR pre-flight rules (mirrors scripts/validate_task.py) + small TOML reader (DOM-free, tested)
│   ├── app.js              App shell: nav, GitHub sign-in, GitHub link wiring, footer
│   └── pages/              One module per page
├── data/
│   ├── site.json           Site config: GitHub URLs, taxonomy, credit policy
│   ├── tasks.json          Legacy fixture; the task board does not read this file
│   ├── results.json        Leaderboard entries
│   ├── contributors.json   Contributor directory
│   ├── releases.json       Release history
│   └── news.json           Homepage updates
├── CNAME                   Custom domain for GitHub Pages (ai4sbench.org)
├── sitemap.xml · robots.txt · site.webmanifest
└── README.md
```

---

## Updating content

Editorial content comes from `/data/*.json`. The task board and proposal detail page
read `GET /api/v1/public/proposals` from the configured control plane. Missing review
and revision fields render as explicit pending states.

### Add a task-board proposal

Submit a proposal through `/submit/`. The backend stores the canonical proposal,
synchronizes a structured reviewer reply from its GitHub Discussion, and optionally
joins the latest linked task revision. Do not edit `data/tasks.json`; it is no longer
a production data source. The detail page uses the unique proposal identifier in
`tasks/task.html?id=<proposal_id>`.

Public proposal statuses are `pending`, `approved`, `changes_requested`, and
`rejected`. Review fields use the `review_` prefix and revision fields use the
`revision_` prefix.

On a task detail page, a signed-in administrator or GitHub login configured in
`TBCP_REVIEWER_GITHUB_LOGINS` sees the structured Review workbench. It preloads
the latest review, exposes every Review schema field, can preview the canonical
Discussion reply, and publishes a new reply that replaces the current review
shown by the task board.

The `/reviewers/` application form posts `tb-reviewer-application/v1` to
`POST /api/v1/reviewers`. Administrators inspect and decide those applications
in the Dashboard. Approval grants reviewer access when the application has a
GitHub username; the environment-based reviewer allowlist remains available.

### Add a result

> **Note:** the leaderboard page is intentionally hidden until the first official
> evaluations exist. The data schema below is still the contract; to restore the
> UI, recover `leaderboard/index.html` and `js/pages/leaderboard.js` from git
> history (they were removed in the "Hide leaderboard" commit), re-add the nav
> and footer links, the homepage "Current frontier" section, and the sitemap entry.

Append to `results.leaderboard` in `data/results.json`:

```json
{
  "agent": "Scaffold name",
  "model": "model-id",
  "organization": "Org",
  "score": 0.42,
  "tasks": 12,
  "cost": 184,
  "runtime": "6.2 h",
  "runs": 3,
  "verified": true,
  "date": "2026-09-01",
  "release": "v0.1",
  "domains": ["Chemistry"],
  "task_results": [{ "task_id": "AI4S-CHEM-001", "result": "pass", "score": 0.61 }],
  "config": "harness v0.1.0, temperature 0, 3 runs averaged",
  "report": "https://…"
}
```

Set `results.active_release` to the release version being displayed. Only set
`verified: true` for results reproduced or validated under the benchmark's
evaluation procedure. Per-task results also go into the task's own
`agent_results` array in `tasks.json`.

### Add a contributor

The contributors page ends with a leaderboard rendered from `data/contributors.json`.
Append one object per person:

```json
{
  "name": "Ada Researcher",
  "institution": "University of Somewhere",
  "github": "ada",
  "avatar": null,
  "role": "Active Contributor",
  "areas": ["Materials Science"],
  "points": 14,
  "breakdown": { "task": 5, "review": 8, "maintain": 0, "community": 1 },
  "tasks_authored": ["AI4S-MAT-001"],
  "tasks_reviewed": ["AI4S-CHE-002", "AI4S-PHY-003"],
  "since": "2026-08",
  "releases": ["v0.1"]
}
```

- `breakdown` holds **points per category** (not counts) and drives the
  "contribution mix" bar and the "Rank by" filters. `community` collects the
  organize, referral and sponsorship lines of the points table. If `points` is
  omitted it is the sum of the breakdown.
- `role` is one of `Contributor`, `Active Contributor`, `Core Contributor`,
  `Maintainer` (badge styling keys off these names).
- `avatar` may be a URL; when it is `null` and `github` is set the GitHub avatar
  is used, falling back to initials if it cannot load.
- `since` (`YYYY-MM`) feeds the "Newest" sort.

The board shows an empty state until the file has entries. To review the design
before then, open `contributors/?demo=1` — it loads `data/contributors.sample.json`
(fictional entries, flagged on the page) instead of the live file.

The point values and role thresholds themselves are configured in
`data/site.json` under `credit` — edit them there, not in page code.

### Add a release

Append to `data/releases.json`. Use `status: "preparing"` before a release ships,
`"current"` for the active release, `"archived"` for older ones. Fill `tasks`,
`domains`, `agents_evaluated`, `contributors`, `release_notes`, `report` and
`github_tag` only when they are real.

### Add news

Append to `data/news.json` (`date`, `title`, `text`, optional site-relative `link`).
The homepage shows the first four entries in array order.

---

## GitHub configuration

All GitHub destinations live in **one place**: `data/site.json → github`:

```json
{
  "org_url": "…",
  "bench_repo": "…",           // canonical benchmark repo (ai4s-bench)
  "web_repo": "…",             // this site (ai4s-bench-web)
  "task_proposal_form": "…",   // Task Proposal issue form
  "reviewer_form": "…",        // Reviewer application form
  "discussions": "…",
  "contributing": "…",
  "methodology_docs": "…"
}
```

Every GitHub link on the site carries a `data-gh="<key>"` attribute and is wired at
runtime by `js/app.js`, so changing a URL here updates the whole site.
(`task_proposal_form` and `reviewer_form` are kept for future issue templates; the
proposal form itself submits to the control plane, see below.)

## Control-plane proposal intake

The `/submit/` wizard sends its current form fields directly to the control plane and
creates a GitHub Discussion after GitHub OAuth. The configured control-plane URL is
`https://dashboard.ai4sbench.org`.

On the control-plane deployment, allow the website origin and include the control-plane
host in the host allow-list:

```env
TBCP_ALLOWED_HOSTS=dashboard.ai4sbench.org
TBCP_CORS_ORIGINS=https://ai4s-bench.github.io
```

The GitHub OAuth App callback URL must be
`https://dashboard.ai4sbench.org/auth/github/callback`.

## Task proposal form (website side)

`/submit/` is a four-section form — **Scientific problem · Environment · Evaluation ·
Contributor** — followed by a review step. Submitting requires GitHub sign-in and
sends the exact current Website form payload to the control plane,
which opens a **GitHub Discussion** for scientific review and tracks its status.

- Control plane base URL: `data/site.json → control_plane_url`
  (currently `https://dashboard.ai4sbench.org`). Leave it empty to disable sign-in
  and the form's submit button (the Markdown copy fallback still works).
- Endpoints used: `GET /api/v1/public/proposals` (no login),
  `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, `GET /auth/github/start`
  (popup), `POST /api/v1/proposals`, `POST /api/v1/proposals/reviews/preview`,
  `POST /api/v1/proposals/{proposal_id}/reviews`, and
  `PUT /api/v1/proposals/{proposal_id}` (author-only update, see below).
- The payload mapping, validation limits and Markdown fallback live in
  `js/proposal.js` (pure functions, no DOM). The server derives internal slugs from
  display values; callers do not submit a second canonical schema.
- Drafts are kept in `localStorage` in the visitor's browser until submitted.

Since the move to the custom domain, the control plane's CORS allow-list needs
`https://ai4sbench.org` (and `https://www.ai4sbench.org`, plus `http://localhost:8000`
for local development) in addition to what the section above lists. Because the site and the control plane share the `ai4sbench.org` registrable domain,
the control plane's `SameSite=Lax` session cookie is sent with the site's
`credentials: "include"` requests — keep them on the same domain.

The canonical public URL (used in `sitemap.xml`, `robots.txt`, `data/site.json` and
the HTML `<head>`s) is `https://ai4sbench.org` — search-replace it across those
files if the site ever moves again.

## Deployment (GitHub Pages)

The site is plain static files with **relative paths throughout**, so it works both at
a domain root and under a project path (`https://org.github.io/repo/`).

1. Push this repository to GitHub.
2. Repository **Settings → Pages → Source**: deploy from branch `main`, folder `/ (root)`.
3. **Custom domain** `ai4sbench.org` is set in Pages settings and pinned by the `CNAME`
   file in this repo (keep that file). DNS lives in Cloudflare (proxied), so TLS is
   terminated by Cloudflare rather than GitHub; `www.ai4sbench.org` and the old
   `ai4s-bench.github.io/ai4s-bench-website` address redirect to the apex domain.
4. Done. No build workflow is required.

If you later prefer a Pages workflow, a one-step `actions/upload-pages-artifact` +
`actions/deploy-pages` job is sufficient — there is nothing to compile.

## Future CI integration

The data files are deliberately shaped so a CI workflow in the canonical `ai4s-bench`
repository can regenerate them from benchmark metadata:

1. Canonical task metadata (YAML/JSON per task, review records, release manifests)
   lives in `ai4s-bench`.
2. On release (or on merge to main), a workflow validates the metadata against the
   task schema, then renders `tasks.json`, `results.json`, `contributors.json`,
   `releases.json` and `news.json`.
3. The workflow opens a PR against this repository (or pushes to a `data/` branch)
   replacing the JSON files — nothing else needs to change, because no benchmark
   content is embedded in HTML or JS.
4. GitHub Pages redeploys automatically on merge.

Until that pipeline exists, the JSON files are edited by hand using the recipes above.
Proposals themselves already flow through the control plane (see the form section),
so the natural next step is for the control plane to export `tasks.json`,
`contributors.json` and `results.json` into this repository.

## Content integrity rules

- Never fabricate benchmark scores, task statuses, partners, institutions,
  releases, or contributors.
- `verified: true` is a claim about the evaluation procedure — only set it when true.
- Missing data is rendered as a designed empty state; leave fields `null` or absent
  rather than inventing values.

## Contributors, rich text and on-site editing

- **Several contributors per task.** The control plane stores one `name` and one `affiliation`
  string. The form joins people with `; ` (`js/people.js → joinContributors`), and every reader
  splits them back (`splitContributors`), also recognising older free-form lists such as
  `A & B` or `A and B`. One shared affiliation is stored once; differing affiliations stay
  index-aligned with `—` for empty slots. The signed-in GitHub account is always the contact.
- **Markdown + LaTeX.** `js/richtext.js` renders proposal text (paragraphs, label lines,
  `#` headings, lists, links, bold, code, fences) and lazy-loads KaTeX for `$…$`, `$$…$$`,
  `\(…\)`, `\[…\]` and AMS environments. When a text clearly contains TeX commands but its
  `\[ \]` / `\( \)` backslashes were lost in transit, the renderer rebuilds those delimiters.
- **On-site editing** (`js/pages/task-edit.js`) is the supported way for an author to revise a
  proposal. The task page offers "Edit proposal" as the primary action when the signed-in login
  equals the proposal's `github`. The editor mirrors the submission form with a live rendered
  preview and sends a `ProposalSubmission` body to `/api/v1/proposals/{proposal_id}`.

  The **verb is discovered, not assumed**: `editMethod()` reads the control plane's `openapi.json`
  at load time and uses whichever of `put` / `patch` that document advertises (preferring `put`,
  the shipped contract — a full replacement, which is exactly what the editor submits). Sending a
  verb the server does not implement answers `405`, which an author experiences as a Save button
  that never works; discovering it means a control-plane change needs no site deploy. If neither
  verb is published the editor is not offered at all and authors keep an "Edit on GitHub" link,
  so a non-functional Save button is never shown.

  **The control plane enforces ownership server-side** — the frontend `canEdit()` check is a UI
  affordance, never the security boundary. The published contract updates the GitHub Discussion
  with the author's own OAuth token *first* and commits local fields only once GitHub accepts, so
  the task page and the Discussion cannot drift apart. Status handling lives in
  `saveErrorMessage()`: `401` expired GitHub authorization, `403` not the author, `404` missing or
  withdrawn, `409` no linked Discussion, `422` per-field validation (already unpacked by
  `describeError()` in `js/app.js`), `502` GitHub refused — and only `405`/`501` fall back to
  editing on GitHub, because only those mean the route is genuinely absent.

  Because the route is a **full replacement**, the editor guards against lost updates: before
  saving it re-reads the proposal and refuses to overwrite a version that changed while the editor
  was open (a sync run, or the author in a second tab). Unsaved work is protected by a
  `beforeunload` prompt and a two-click Cancel.
