// Run with: node --test tests/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProposal, summarize, titleSimilarity, similarProposals } from "../js/proposal-check.js";

const good = {
  title: "Exact ground-state energy of the 1D Hubbard chain",
  field_name: "Quantum many-body theory",
  problem:
    "The Hubbard model describes the competition between hopping and on-site repulsion. ".repeat(6) +
    "The agent must compute $E_0/N$ for given $U/t$ and filling.",
  solvability: "Lieb and Wu published the exact Bethe-ansatz solution, so a reference value exists.",
  references: "Lieb & Wu, Phys. Rev. Lett. 20, 1445 (1968). https://doi.org/10.1103/PhysRevLett.20.1445",
  software: "Python 3.12 with NumPy and SciPy.",
  dataset: "No external data; parameters are generated for the task and released under CC-BY.",
  compute: "About 2 hours on 8 CPU cores, no GPU.",
  workflow: "The agent receives U/t and filling and returns E0/N as JSON.",
  evaluation: "Relative error below 1e-6 against the Bethe-ansatz reference counts as a pass.",
  leakage: "The exact value is tabulated nowhere for these parameters; the verifier recomputes it from the integral equations.",
};

const ids = (answers, opts) => checkProposal(answers, opts).map((f) => f.id);

test("a strong proposal has no findings", () => {
  assert.deepEqual(checkProposal(good), []);
  assert.equal(summarize([]), "No issues found");
});

test("references: no source is only a suggestion; journal citations earn a lighter tip", () => {
  const none = checkProposal({ ...good, references: "It is a real problem in quantum transport research." });
  assert.equal(none.find((f) => f.id === "references-source").level, "tip");
  const cited = ids({ ...good, references: "Piaggi, Valsson, Parrinello, Phys. Rev. Lett. 119, 015701 (2017)." });
  assert.ok(cited.includes("references-links"));
  assert.ok(!cited.includes("references-source"));
  assert.ok(!ids({ ...good, references: "See arXiv:2301.01234 for details." }).includes("references-links"));
});

test("evaluation: no measure is a warning, a measure without a threshold a tip", () => {
  assert.ok(ids({ ...good, evaluation: "We look at how the agent does overall." }).includes("evaluation-measure"));
  const t = ids({ ...good, evaluation: "Agreement of the bands with the reference plane-wave bands." });
  assert.ok(t.includes("evaluation-threshold"));
  assert.ok(!t.includes("evaluation-measure"));
});

test("compute: flags over-limit GPUs and cores, but not GPU-hours", () => {
  assert.ok(ids({ ...good, compute: "8GPU with 2 hours should be sufficient." }).includes("compute-limit"));
  assert.ok(ids({ ...good, compute: "4 x A100 for a day" }).includes("compute-limit"));
  assert.ok(ids({ ...good, compute: "64 CPU cores" }).includes("compute-limit"));
  assert.ok(!ids({ ...good, compute: "1 GPU; agent exploration budget 48 GPU·h" }).includes("compute-limit"));
  assert.ok(!ids({ ...good, compute: "1 GPU, 16 cores, 10 GPU hours total" }).includes("compute-limit"));
  assert.ok(ids({ ...good, compute: "A modest workstation" }).includes("compute-estimate"));
});

test("math: unpaired delimiters and unmatched $ are warnings", () => {
  assert.ok(ids({ ...good, problem: good.problem + " where \\(x > 0." }).includes("math-delimiters-problem"));
  assert.ok(ids({ ...good, problem: good.problem + " and $x^2 + 1 = 0." }).includes("math-dollar-problem"));
  assert.ok(!ids({ ...good, problem: good.problem + " $$\\int_0^1 f$$ and $a$." }).some((i) => i.startsWith("math-")));
});

test("math: a lost backslash is a warning next to real TeX, a tip in plain text", () => {
  const mixed = checkProposal({ ...good, problem: good.problem + " with \\alpha and frac{1}{2}." });
  assert.equal(mixed.find((f) => f.id === "math-backslash-problem").level, "warn");
  const plain = checkProposal({ ...good, problem: good.problem + " H = -t sum_<i,j> c_i c_j" });
  assert.equal(plain.find((f) => f.id === "math-backslash-problem").level, "tip");
  // Words that merely look like commands in prose are fine.
  assert.ok(!ids({ ...good, problem: good.problem + " The sum of the parts and the text itself." }).includes("math-backslash-problem"));
});

test("duplicates: near-identical titles are found, the proposal itself is excluded", () => {
  const board = [
    { id: "a", discussion_number: 6, title: "Sparse Orthogonal Hamiltonians for Large-Scale Electronic Structure", github: "QG-phy" },
    { id: "b", discussion_number: 9, title: "Something entirely different about proteins" },
  ];
  assert.ok(titleSimilarity(board[0].title, "Sparse orthogonal Hamiltonians for large-scale electronic structure") === 1);
  const found = checkProposal({ ...good, title: "Sparse Orthogonal Hamiltonians for Large-Scale Electronic Structure" }, { existing: board });
  assert.equal(found.filter((f) => f.id.startsWith("duplicate-")).length, 1);
  assert.match(found[0].message, /#6/);
  assert.equal(similarProposals(board[0].title, board, "a").length, 0);
  // Different wording of the same subject is not flagged.
  assert.equal(similarProposals("Analytic Ground-State Energy of the 2D Hubbard Model", [{ id: "c", title: "Exact Ground-State Solution of the Two-Dimensional Repulsive Hubbard Model" }]).length, 0);
});

test("solvability: a circular claim earns a tip, a cited reference does not", () => {
  assert.ok(ids({ ...good, solvability: "It is solvable because it is solvable." }).includes("solvability-evidence"));
  assert.ok(!ids({ ...good, solvability: "A published reference value exists (Lieb & Wu 1968)." }).includes("solvability-evidence"));
});

test("findings are sorted warnings first and summarised", () => {
  const f = checkProposal({ ...good, workflow: "", evaluation: "We look at how the agent does overall." });
  assert.equal(f[0].level, "warn");
  assert.equal(summarize(f), "1 to fix · 1 suggestion");
});
