import test from "node:test";
import assert from "node:assert/strict";
import { accountCheckStep } from "../js/account-verification.js";

test("temporary accounts see the GitHub connection step", () => {
  assert.equal(accountCheckStep({ github_linked: false, github_email_review_pending: false }), "github");
});

test("a first GitHub connection moves to email confirmation", () => {
  assert.equal(accountCheckStep({ github_linked: true, github_email_review_pending: true }), "email");
  assert.equal(accountCheckStep({ github_linked: true, github_email_review_pending: false }), null);
  assert.equal(accountCheckStep(null), null);
});
