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

## Project structure

```text
/
├── index.html              Homepage
├── tasks/
│   ├── index.html          Task explorer (search / filter / sort)
│   └── task.html           Task detail (renders ?id=<slug> from tasks.json)
├── submit/index.html       Submission criteria + client-side proposal wizard
├── contributors/index.html Contributor directory, points, roles, governance
├── releases/index.html     Versioned releases
├── about/index.html        About & methodology
├── 404.html                Not-found page
├── assets/branding/        Orbit mark, horizontal logo, favicon (all SVG)
├── css/
│   ├── tokens.css          Design tokens (brand palette, type, spacing)
│   ├── base.css            Reset, typography, layout primitives
│   ├── components.css      Header, buttons, badges, cards, tables, forms…
│   └── pages.css           Page-specific layouts
├── js/
│   ├── data.js             JSON loading + caching (single data entry point)
│   ├── components.js       Shared renderers (task cards, badges, empty states)
│   ├── app.js              App shell: nav, GitHub link wiring, footer
│   └── pages/              One module per page
├── data/
│   ├── site.json           Site config: GitHub URLs, taxonomy, credit policy
│   ├── tasks.json          All benchmark tasks
│   ├── results.json        Leaderboard entries
│   ├── contributors.json   Contributor directory
│   ├── releases.json       Release history
│   └── news.json           Homepage updates
├── sitemap.xml · robots.txt · site.webmanifest
└── README.md
```

---

## Updating content

Everything visitors see comes from `/data/*.json`. The site renders missing fields
gracefully, so partial records are fine — **never invent scores, statuses, partners,
releases or contributors**; empty states are part of the design.

### Add a task

Append an object to `data/tasks.json`. Minimum useful fields:

```json
{
  "id": "AI4S-BIO-001",
  "slug": "my-task-slug",
  "title": "Task title",
  "short_description": "One- or two-sentence summary.",
  "domain": "Biology",
  "disciplines": ["Biology", "AI / ML"],
  "interdisciplinary": true,
  "status": "proposed",
  "candidate": true,
  "date_created": "2026-08-16",
  "date_updated": "2026-08-16"
}
```

Public statuses: `proposed` · `under_review` · `agent_testing` · `verified` · `released`.
Optional fields (see existing entries for the full schema): `primary_metric_short`
(compact metric label shown on cards), `scientific_value`,
`scientific_context`, `task_description`, `environment`, `required_tools`,
`input_artifacts`, `expected_output`, `evaluation_method`, `primary_metric`,
`secondary_metrics`, `verification_method`, `anti_cheating_notes`, budgets,
`task_author` / `reviewers` (`{ "name", "affiliation" }`), `agent_results`,
`failure_modes`, `github_issue`, `github_pr`, `task_repository_path`, `release`,
`difficulty`. The detail page lives at `tasks/task.html?id=<slug>`.

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

Append to `data/contributors.json`:

```json
{
  "name": "Ada Researcher",
  "institution": "University of Somewhere",
  "github": "ada",
  "avatar": null,
  "role": "Active Contributor",
  "areas": ["Materials Science"],
  "points": 10,
  "tasks_authored": ["AI4S-MAT-001"],
  "tasks_reviewed": [],
  "releases": ["v0.1"]
}
```

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
runtime by `js/app.js`, so changing a URL here updates the whole site. When the real
issue forms exist, point `task_proposal_form` at
`…/issues/new?template=task-proposal.yml` and the submission wizard's
"Continue on GitHub" button will use it automatically.

## Control-plane proposal intake

The lower **Draft your proposal** form on `/submit/` sends the canonical
`ProposalDocument` to the control plane and creates a GitHub Discussion after GitHub
OAuth. The configured control-plane URL is `https://dashboard.ai4sbench.org`.

On the control-plane deployment, allow the website origin and include the control-plane
host in the host allow-list:

```env
TBCP_ALLOWED_HOSTS=dashboard.ai4sbench.org
TBCP_CORS_ORIGINS=https://ai4s-bench.github.io
```

The GitHub OAuth App callback URL must be
`https://dashboard.ai4sbench.org/auth/github/callback`.

The canonical public URL (used in `sitemap.xml`, `robots.txt` and meta tags) is
currently `https://ai4s-bench.github.io/ai4s-bench-website` — search-replace it
across those files plus the HTML `<head>`s if the site moves (e.g. to a custom
domain or an org root site).

## Deployment (GitHub Pages)

The site is plain static files with **relative paths throughout**, so it works both at
a domain root and under a project path (`https://org.github.io/repo/`).

1. Push this repository to GitHub.
2. Repository **Settings → Pages → Source**: deploy from branch `main`, folder `/ (root)`.
3. Done. No build workflow is required.

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

## Content integrity rules

- Never fabricate benchmark scores, task statuses, partners, institutions,
  releases, or contributors.
- `verified: true` is a claim about the evaluation procedure — only set it when true.
- Missing data is rendered as a designed empty state; leave fields `null` or absent
  rather than inventing values.
