// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { displayStatus, currentStageIndex, isApproved, lifecycle, STAGES } from "../js/lifecycle.js";

const base = {
  status: "pending",
  created_at: "2026-09-11T20:02:56",
  discussion_number: 12,
  discussion_url: "https://github.com/AI4S-Bench/ai4s-benchmark/discussions/12",
  github: "someone",
  review_decision: null,
  revision_id: null,
  revision_pull_request_url: null,
  revision_agent_results: [],
  revision_release: null,
};

test("a fresh proposal is pending, in the review stage", () => {
  assert.equal(displayStatus(base), "pending");
  assert.equal(currentStageIndex(base), 1);
  assert.equal(isApproved(base), false);
  const tl = lifecycle(base);
  assert.equal(tl.length, STAGES.length);
  assert.deepEqual(tl.map((s) => s.state), ["done", "current", "upcoming", "upcoming", "upcoming"]);
  assert.equal(tl[0].link.href, base.discussion_url);
  assert.equal(tl[1].note, "Waiting for a domain reviewer");
});

test("a published review decision wins over a stale 'pending' status", () => {
  const t = { ...base, review_decision: "approved", review_reviewer_login: "rev", review_comment_url: "https://x/c" };
  assert.equal(displayStatus(t), "approved");
  assert.equal(isApproved(t), true);
  const tl = lifecycle(t);
  assert.deepEqual(tl.map((s) => s.state), ["done", "done", "current", "upcoming", "upcoming"]);
  assert.equal(tl[1].by, "rev");
  assert.equal(tl[2].link.href, "guide/");
});

test("changes requested keeps the task in review, flagged for the author", () => {
  const t = { ...base, review_decision: "changes_requested" };
  assert.equal(displayStatus(t), "changes_requested");
  assert.deepEqual(lifecycle(t).map((s) => s.state), ["done", "attention", "upcoming", "upcoming", "upcoming"]);
});

test("rejection stops the lifecycle at review", () => {
  const t = { ...base, review_decision: "rejected" };
  assert.equal(displayStatus(t), "rejected");
  assert.equal(isApproved(t), false);
  assert.deepEqual(lifecycle(t).map((s) => s.state), ["done", "stopped", "upcoming", "upcoming", "upcoming"]);
});

test("a linked PR moves the task to implementation, with a direct PR link", () => {
  const t = { ...base, review_decision: "approved", revision_id: "r1", revision_pull_request_url: "https://github.com/o/r/pull/3" };
  assert.equal(displayStatus(t), "implementation");
  const tl = lifecycle(t);
  assert.deepEqual(tl.map((s) => s.state), ["done", "done", "current", "upcoming", "upcoming"]);
  assert.equal(tl[2].link.href, "https://github.com/o/r/pull/3");
});

test("revision without PR links to the task files at the pinned commit", () => {
  const t = { ...base, revision_id: "r1", revision_repo_url: "https://github.com/o/r", revision_commit_sha: "abc", revision_task_path: "tasks/a/b/c" };
  assert.equal(lifecycle(t)[2].link.href, "https://github.com/o/r/tree/abc/tasks/a/b/c");
  // A revision implies review happened even if no decision was synchronized.
  assert.equal(lifecycle(t)[1].state, "done");
  assert.equal(lifecycle(t)[1].note, "Completed");
});

test("agent results and release are the last two stages", () => {
  const run = { ...base, revision_id: "r1", revision_agent_results: [{ created_at: "2026-10-01" }, { created_at: "2026-10-03" }] };
  assert.equal(displayStatus(run), "agent_testing");
  assert.equal(lifecycle(run)[3].state, "current");
  assert.equal(lifecycle(run)[3].date, "2026-10-03");
  const rel = { ...run, revision_release: "v0.1" };
  assert.equal(displayStatus(rel), "released");
  assert.deepEqual(lifecycle(rel).map((s) => s.state), ["done", "done", "done", "done", "done"]);
});

test("unknown backend statuses fall back to pending; known ones are honoured", () => {
  assert.equal(displayStatus({ ...base, status: "weird" }), "pending");
  assert.equal(displayStatus({ ...base, status: "approved" }), "approved");
  assert.equal(displayStatus({}), "pending");
});
