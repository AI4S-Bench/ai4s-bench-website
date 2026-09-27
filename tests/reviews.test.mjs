// Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  toV1Payload,
  parseReviewComment,
  normalizeReview,
  validateReview,
  latestPerReviewer,
  aggregate,
  emptyReview,
  qualityScore,
} from "../js/reviews.js";

/* Port of ProposalReview.render_comment() in the control plane
   (backend/control_panel/schemas.py) — the exact reply GitHub stores. */
function renderComment(p) {
  const section = (t, v) => [`### ${t}`, "", v || "", ""];
  const list = (t, vs) => [`### ${t}`, "", ...vs.map((v) => `- ${v}`), ""];
  const lines = [
    "<!-- ai4sbench-proposal-review:v1 -->", "", "## AI4S-Bench Proposal Review", "", `Decision: ${p.review_decision}`, "",
    ...section("Short Description", p.review_short_description),
    ...list("Tags", p.review_tags),
    ...section("Difficulty", p.review_difficulty),
    ...section("Scientific Value", p.review_scientific_value),
    ...section("Primary Metric", p.review_primary_metric),
    ...section("Primary Metric Short", p.review_primary_metric_short),
    ...list("Secondary Metrics", p.review_secondary_metrics),
    ...section("Verification Method", p.review_verification_method),
    ...section("Estimated Runtime", p.review_estimated_runtime),
    ...section("Compute Budget", p.review_compute_budget),
    ...section("Token Budget", p.review_token_budget),
    ...list("Baseline Results", p.review_baseline_results),
    ...list("Failure Modes", p.review_failure_modes),
    ...section("Review Notes", p.review_notes),
  ];
  return lines.join("\n").trimEnd() + "\n";
}

const task = { domain: "Physical Sciences", field_name: "Quantum Chemistry" };

const full = {
  decision: "changes_requested",
  scores: { value: 4, clarity: 2, verifiability: 3, feasibility: 4, leakage: 2, difficulty: 3 },
  confidence: 4,
  runtime: "too_long",
  expertTime: "1to3d",
  general: "Strong idea.\n\n### Not a heading\nDecision: approved (this is text)\n- a bullet\n\nUses $E = mc^2$ -- with dashes.",
  environment: "PySCF is fine; the 48 h estimate is too long.",
  evaluation: "The tolerance should be 1 mHa.\n\n- check the basis set",
};

test("a v2 review survives the v1 transport and the rendered reply", () => {
  const payload = toV1Payload(full, task);
  const parsed = parseReviewComment(renderComment(payload));
  assert.equal(parsed.format, "v2");
  const { format, ...rest } = parsed;
  assert.deepEqual(rest, normalizeReview(full));
});

test("the v1 payload satisfies the control plane's required fields", () => {
  for (const review of [full, { ...emptyReview(), decision: "approved", general: "Looks good to me." }]) {
    const p = toV1Payload(review, task);
    assert.ok(p.review_short_description.length >= 20 && p.review_short_description.length <= 2000);
    assert.ok(p.review_tags.length >= 1);
    assert.ok(p.review_difficulty.length >= 2 && p.review_difficulty.length <= 80);
    assert.ok(p.review_scientific_value.length >= 20);
    assert.ok(p.review_primary_metric.length >= 2);
    assert.ok(p.review_verification_method.length >= 20);
    assert.ok(p.review_notes.length <= 8000);
    assert.equal(p.review_decision, review.decision);
    assert.equal(p.review_tags.join("|"), "Physical Sciences|Quantum Chemistry");
  }
});

test("free text cannot inject a heading or a decision line into the reply", () => {
  const body = renderComment(toV1Payload(full, task));
  assert.equal((body.match(/^### Not a heading/m) || []).length, 0);
  assert.equal(body.match(/^Decision\s*:\s*(\S+)/m)[1], "changes_requested");
});

test("maximum-length text still fits the v1 limits", () => {
  const long = { ...full, general: "x".repeat(5000), environment: "y".repeat(2000), evaluation: "z".repeat(4000) };
  const p = toV1Payload(long, task);
  assert.ok(p.review_notes.length <= 8000, `notes ${p.review_notes.length}`);
  assert.ok(p.review_verification_method.length <= 8000);
  assert.ok(p.review_difficulty.length <= 80, p.review_difficulty);
});

test("a legacy v1 reply is read without inventing scores", () => {
  const body = readFileSync(new URL("./fixtures/review-v1-discussion-13.md", import.meta.url), "utf8");
  const r = parseReviewComment(body);
  assert.equal(r.format, "v1");
  assert.equal(r.decision, "changes_requested");
  assert.deepEqual(r.scores, {});
  assert.equal(r.legacyDifficulty, "moderate");
  assert.match(r.general, /^\*\*Summary\.\*\* The problem ask the agent/);
  assert.match(r.general, /\*\*Notes\.\*\* The main problem might be/);
  assert.doesNotMatch(r.general, /Token Budget/);
});

test("non-review replies are ignored", () => {
  assert.equal(parseReviewComment("Thanks, I will revise the proposal."), null);
});

test("validation needs only a recommendation and general comments", () => {
  assert.deepEqual(Object.keys(validateReview(emptyReview())).sort(), ["decision", "general"]);
  assert.deepEqual(validateReview({ ...emptyReview(), decision: "rejected", general: "Out of scope here." }), {});
});

test("each reviewer's newest review counts; older ones become history", () => {
  const mk = (login, created_at, decision, scores = {}) => ({ login, created_at, url: `${login}-${created_at}`, review: { ...emptyReview(), decision, scores } });
  const items = [
    mk("alice", "2026-09-20T10:00:00Z", "changes_requested", { value: 2 }),
    mk("bob", "2026-09-21T10:00:00Z", "approved", { value: 5, clarity: 4 }),
    mk("Alice", "2026-09-25T10:00:00Z", "approved", { value: 4 }),
  ];
  const current = latestPerReviewer(items);
  assert.equal(current.length, 2);
  assert.equal(current[0].login, "Alice");
  assert.equal(current[0].history.length, 1);
  const agg = aggregate(current);
  assert.equal(agg.tally.approved, 2);
  assert.equal(agg.tally.changes_requested, 0);
  const value = agg.criteria.find((c) => c.key === "value");
  assert.equal(value.mean, 4.5);
  assert.equal(value.min, 4);
  assert.equal(value.n, 2);
});

test("difficulty is not part of the quality score", () => {
  assert.equal(qualityScore({ value: 4, difficulty: 1 }), 4);
  assert.equal(qualityScore({ difficulty: 5 }), null);
});
