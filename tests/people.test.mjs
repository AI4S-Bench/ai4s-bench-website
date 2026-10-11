// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNames, splitContributors, joinContributors } from "../js/people.js";

test("a list the form joined with '; ' keeps commas inside names", () => {
  assert.deepEqual(parseNames("Smith, John; Lee, Kim"), ["Smith, John", "Lee, Kim"]);
  assert.deepEqual(parseNames("Martin Luther King, Jr.; Ada Lovelace"), ["Martin Luther King, Jr.", "Ada Lovelace"]);
});

test("rows with commas in names survive a save and reload unchanged", () => {
  const rows = [
    { name: "Smith, John", affiliation: "MIT" },
    { name: "Lee, Kim", affiliation: "Stanford University" },
  ];
  const stored = joinContributors(rows);
  assert.deepEqual(stored, { name: "Smith, John; Lee, Kim", affiliation: "MIT; Stanford University" });
  assert.deepEqual(splitContributors(stored.name, stored.affiliation), rows);
  assert.deepEqual(joinContributors(splitContributors(stored.name, stored.affiliation)), stored);
});

test("older free-form lists still split on '&', 'and' and ','", () => {
  assert.deepEqual(parseNames("Ada Lovelace & Alan Turing"), ["Ada Lovelace", "Alan Turing"]);
  assert.deepEqual(parseNames("Ada Lovelace and Alan Turing"), ["Ada Lovelace", "Alan Turing"]);
  assert.deepEqual(parseNames("Ada Lovelace, Alan Turing, Grace Hopper"), ["Ada Lovelace", "Alan Turing", "Grace Hopper"]);
  assert.deepEqual(parseNames("Ada Lovelace"), ["Ada Lovelace"]);
  assert.deepEqual(parseNames(""), []);
});
