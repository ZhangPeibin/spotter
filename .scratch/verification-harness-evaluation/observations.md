# Verification Harness Evaluation Observations

Status: candidate observations only

Recorded: 2026-09-03

These observations came from a read-only review of `dex-app-core` and
`tensormatch_app`. They are not active Hook or Skill rules while the 20-session
evaluation is pending.

## Observed Facts

- Verification evidence falls into three different classes: current behavioral
  evidence, immutable historical artifacts, and authorized external/device
  evidence. They do not prove the same claim.
- Most `dex-app-core/test/evidence` tests validate committed JSON shape or a
  recorded `PASS`; many do not execute Core behavior or prove that artifact
  source hashes match the current commit.
- The Core release-evidence workflow has the stronger model: bind results and
  artifacts to an exact clean commit, verify hashes, and create the bundle
  outside the source tree.
- The App external-evidence record correctly treats `blocked` as a terminal
  result when authorization, physical-device coverage, or build identity is
  missing. Deterministic tests must not upgrade that result to `passed`.
- App harness checks based on test names, labels, constants, or source-text
  snippets prove implementation shape, not the named runtime behavior.
- The App currently consumes Core through a sibling path dependency, while its
  clean-runner workflow does not fetch that sibling. Cross-repository tests need
  one explicit, reproducible Core identity.
- App golden baselines are useful visual contracts. Generated files under
  `test/failures` are transient diagnostics, not durable evidence.
- Repository-required full suites are appropriate at CI, release, and final
  handoff boundaries. Repeating them during iteration without a relevant state
  change adds no evidence.

## Candidate Rules

1. Name the evidence class before selecting a check: behavioral, artifact
   integrity, or external observation.
2. Count historical artifacts as current evidence only when their source,
   dependency, configuration, and environment bindings match the current run.
3. Never treat a self-reported `PASS`, expected exit code, test name, or source
   snippet as proof of behavior.
4. Preserve `blocked`, `unknown`, and `not run` as honest terminal reports; do
   not manufacture a passing fixture to replace missing external evidence.
5. For cross-repository verification, record and reproduce the exact dependency
   revision used by both local checks and CI.
6. Keep approved golden baselines; ignore generated failure diffs unless they
   are intentionally attached to a specific review.
7. Run focused behavioral evidence while editing, then run the repository's
   required full gate once after the last relevant mutation. Reuse that result
   while commit, dependencies, configuration, and environment remain unchanged.

## Reading-Derived Candidates

Sources reviewed:

- [Using LLMs to enhance our testing practices](https://news.ycombinator.com/item?id=41936855)
- [How I write code using Cursor](https://news.ycombinator.com/item?id=41979203),
  especially the [verification objection](https://news.ycombinator.com/item?id=41980089)
- [When AI writes the software, who verifies it?](https://news.ycombinator.com/item?id=47234917)

The shared lesson is that faster generation does not create a trustworthy
oracle. Tests, reviews, and proofs are useful only when their expected behavior
comes from a source independent of the implementation and its generator.

1. Ground evidence in an independent oracle: a requirement, public contract,
   existing consumer, reference implementation, or explicit invariant. Do not
   derive expected results from the implementation under test.
2. When a test is generated alongside its implementation, demonstrate that it
   is sensitive to the target regression with a reproducible pre-fix failure or
   the smallest safe deliberate perturbation.
3. If the expected behavior cannot be explained or the relevant domain is not
   understood, preserve `unknown` or `blocked` instead of generating a passing
   test and treating it as evidence.
4. Match assurance to risk. Prefer enforceable types, schemas, contracts,
   constraints, property tests, fuzzing, model checking, or formal proof when
   they directly express a critical invariant; do not impose them by default.

Do not turn these observations into coverage targets, mandatory mutation or
fuzz testing, blanket formal verification, second-model review presented as
independent evidence, or broader test runs justified only by generated code
volume. Keep the SessionStart hook as a skill loader rather than duplicating
these rules inline.

## Admission Gate

Do not add these candidates to `spotter-base`, `verification-flutter`, or
the SessionStart hook before the post-intervention sample reaches 20 qualifying
development sessions. Admit rules only if the existing evaluation returns
`continue`; if it returns `stop`, retain this document as analysis and stop
expanding the Harness.

## Comments

- 2026-09-03: Initial observations recorded. Evaluation progress was `0/20`.
- 2026-09-04: Added one visible verification-decision receipt after each user
  message. The evaluation was still `0/20`, so the intervention clock can move
  to this version without discarding a post-intervention sample.
- 2026-09-04: Reviewed the three external discussions above at `4/20` sessions.
  Recorded their lessons as inactive candidates; the admission gate remains in
  force.
- 2026-09-07: User authorized remediation after a four-day session review.
  Corrected evaluator session ownership, inherited-history boundaries, terminal
  poll correlation, scoped commands/redirections, and repeated token telemetry.
  Retired the hardcoded baseline: both cohorts must use the corrected algorithm.
  Counts remain heuristics, not proof of hook causality or billing savings.
  Authorized one narrow skill correction before the sample gate: preserve a
  reproduced harness blocker until a relevant change or explicit retry, and
  leave required final gates blocked. Other candidate rules remain inactive.
- 2026-09-07: User authorized a workflow revision after reviewing
  `donvito/codex-astra-luna-orchestrator` at
  `f1de1b8729c8ccfb7978321b4764c58bd34c8493`. Adapted bounded verification
  decisions, final-owner evidence acceptance, and explicit failure paths;
  did not adopt model routing or mandatory delegation. Clarified that explicit
  architecture/schema/API contracts can use structural evidence. The workflow
  needs no per-turn receipt. Treat this policy revision as a separate exposure
  when evaluating behavior; historical metrics cannot validate it.

## Remaining Evaluation Work

On 2026-09-07 the user also requested stronger language and incorrect-behavior
examples. The loader and base skill now use explicit MUST/MUST NOT constraints
and paired prohibited/required examples for the existing rules. This remains
prompt guidance, not command interception; evaluate the new wording separately
from earlier versions.

- Separate actual hook versions/exposure and comparable task sizes before
  attributing improvements to the current skill. A chronological cohort alone
  does not isolate the intervention, and this correction changes the policy.
- Missing, truncated, dynamically generated, or asynchronously forwarded tool
  results remain unresolved. Use structured execution telemetry if exact process
  counts become necessary; do not grow shell/JavaScript regexes into a parser.
- Verify the blocker rule in a fresh development session. Structural skill
  validation cannot prove the agent will avoid repeated blocked full gates.
