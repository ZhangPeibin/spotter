---
name: verify
description: Select, run, reuse, and report minimal sufficient verification evidence for code changes, bug fixes, refactors, or test work in any software project.
---

# Spotter Verify

These are requirements, not suggestions. You MUST apply them before adding tests, running verification, or reporting a verified result. Respect explicit user instructions and required repository gates; these rules do not create a new approval requirement or permission for external actions.

Start with three decisions:

1. Identify what this change must prove and where it could fail.
2. Check existing evidence; reuse it when applicable, and add or run only what is missing or invalidated.
3. Report what the actual results establish and what remains unverified.

The sections below govern these decisions; this is not a required report template. Reason in behavioral claims and independent fault boundaries, never file proximity, test count, or line coverage. This skill governs verification, not implementation architecture, agent assignment, or response length.

## Choose Evidence

Before adding a test or starting a verification run, you MUST identify the claim, its source (requirement, public contract, or explicit invariant), the smallest sufficient evidence, and why existing evidence is insufficient. These are task decisions, not a mandatory visible receipt or a new report file.

- You MUST identify the concrete regression a test would catch before adding it. Reuse or extend the closest evidence. You MUST NOT add tests that only duplicate retained evidence or assert incidental implementation details. A structural check is valid for an explicit architecture, schema, or public API contract; it MUST NOT be presented as runtime behavior evidence.
- You MUST keep one primary evidence item per claim and fault boundary. It must directly check the claimed behavior or explicit structural contract and be the cheapest sufficient proof. Automated checks must be deterministic.
- Do not compress authorization, privacy, money, writes, migrations, deletion, recovery, concurrency, compatibility, accessibility, or explicitly required platform contracts.
- For a feature spanning layers, keep one consumer-visible integration test for the complete workflow. Add lower-level tests only for independent failures that workflow cannot observe.
- You MUST NOT run a full suite without an explicit user request, repository-required final gate, release or CI gate, framework or dependency migration, or shared-runtime change. Uncertainty alone is not sufficient: inspect the affected boundaries first. Run a required final gate after the last relevant edit, subject to the known-blocker rule below.

Choose the next action from the evidence state:

| State | Required action |
| --- | --- |
| A relevant run is already in flight in this workspace. | Wait on its original process; retain its identity across recaps. |
| A relevant pass exists and its working-tree content, commit, dependencies, configuration, and environment are unchanged. | Reuse it unless an explicit retry is requested. A status question or recap does not invalidate it. |
| The boundary has a reproduced harness blocker. | Follow the failure handling below; an unrelated edit does not justify a retry. |
| Evidence is missing, invalidated by a relevant change, or explicitly requested again. | Run the selected evidence within the user's instructions. |

You MUST NOT run unrelated evidence merely for reassurance. If the user excludes a check, preserve `not run`; do not invent a substitute pass.

## Execute Evidence

- You MUST keep one execution owner and at most one in-flight run for the same evidence boundary and workspace. When work is already delegated, coordinate who runs that evidence; the parent MUST NOT duplicate a child's run merely to confirm its report. This skill does not require delegation or select models.
- Capture verbose progress from long-running evidence outside the model context when permitted, using the runner's existing result files or an appropriate local log. Preserve the original command's exit status and relevant failure diagnostics; a filtered or piped display must not turn a failed run into a pass. Do not persist secrets or prohibited output. Report terminal status, relevant failures, and the original result location when available.
- For ordinary tests, builds, and static analysis, start `exec_command` with `yield_time_ms: 30000` (or the host's lower limit). If wrapped in `functions.exec`, let the outer call wait at least as long, within host limits. Use shorter waits only for required interaction, a concrete diagnostic need, or a stricter instruction. If still running, wait on the original process handle using completion notifications or the longest permitted interruptible wait. Keep cancellation and required updates responsive; an unchanged timeout does not justify a new run, status-only commands, or rereading the same log tail.
- Inspect new output and the terminal result, then retrieve only the relevant failure sections from the retained evidence. If tool output was truncated, recover the missing diagnostics from the original result before considering another run; do not rerun unchanged tests merely to get a cleaner transcript. If the evidence cannot be recovered, preserve that uncertainty and select only the missing verification.

Handle failure according to what was actually observed:

| Observation | Required action |
| --- | --- |
| The process is quiet but still running. | Wait or inspect that process. Silence alone establishes neither product failure nor a harness blocker. |
| A behavioral assertion fails with usable diagnostics. | Trace the violated contract, fix the responsible defect, and rerun affected evidence. Do not change production behavior merely to satisfy an incorrect test. |
| A timeout, runner crash, or resource collision prevents a result. | Preserve the original outcome; use the smallest deterministic reproduction to distinguish a harness failure from a product failure before changing product code. |
| A harness blocker is reproduced. | Record the affected boundary, cause or observed symptom, and condition for retry in the existing task record or summary. Continue unaffected evidence. Retry only after a change relevant to that blocker or an explicit retry request; a required full gate stays `blocked`. |

## Accept Evidence

Before relying on an executed check, you MUST inspect its referenced output or trace and establish the exact command, workspace and tested content, dependencies/configuration/environment, terminal exit, and the claim it actually proves. For manual/device evidence, establish the observation source, tested build/environment, and expected versus observed behavior; do not invent a process exit. A concise summary may reference the original result; do not copy whole logs into the conversation or rerun valid evidence merely to obtain another copy.

- A subagent's "done," a different model's approval, or a recorded `PASS` is not sufficient evidence by itself. The agent giving the final answer owns checking that the referenced evidence applies to the integrated state.
- You MUST NOT report partial output, timeout, abort, or a still-running process as a pass. A nonzero exit closes a process but does not prove successful verification. Missing outcome or identity stays `unknown`; an unavailable prerequisite stays `blocked`; an unexecuted check stays `not run`.
- You MUST report the affected claims, selected evidence and actual outcomes, and what was intentionally not run. A focused pass does not waive a required full gate. Correct an overstated result explicitly before relying on it again.

## Prohibited Patterns

These examples illustrate the rules; they are not commands to execute or permission to skip required checks.

| Situation | WRONG: prohibited behavior | REQUIRED handling |
| --- | --- | --- |
| `make check` returned a process ID and is quiet. | Start another `make check` to get a result sooner. | Wait on the original process. Silence is neither failure nor permission to duplicate it. |
| A minimal reproduction confirmed native loading hangs; only a UI label changed afterward. | Restart the same blocked full suite because every edit needs a final check. | Keep the native boundary and required full gate `blocked`; run unaffected evidence. Retry only after a relevant change or explicit request. |
| The runner printed `+245`, then was interrupted with exit 130. | Report "all tests passed" or "verification complete." | Report the interruption and incomplete verification. Report any independently completed checks separately. |
| An explicit architecture contract forbids UI imports from the storage package. | Delete the import-boundary check because all structural tests are forbidden. | Retain the check as architecture evidence; do not claim it proves runtime storage behavior. |
| A test finds `validate()` in source text, or reads a committed JSON `PASS`. | Claim runtime validation behavior is verified. | Treat it only as source/artifact evidence. Exercise the actual invalid input to prove runtime rejection. |
| A local SQLite-backed workflow is blocked, but a fake or Docker run passes. | Replace the missing local result with that pass and mark the workflow verified. | Keep the local workflow `blocked`; report the fake or container result only for the separate boundary/environment it proves. |
| A worker says "tests passed" without a command, tested revision/state, or result reference. | Repeat the claim in the final answer or automatically start the same suite again. | Obtain and inspect the original evidence and its bindings. If unavailable, keep the result `unknown` and choose the smallest missing verification. |

## Dart/Flutter App Guardrails

When working in a repository with `pubspec.yaml`, also apply these rules:

- Prefer real pure logic, local in-memory implementations, temporary directories, or temporary databases. Add a fake only for an external, expensive, nondeterministic, unavailable, or explicitly failure-injection boundary.
- Keep fakes narrow, deterministic, explicitly controllable, contract-validating, lifecycle-safe, and free of real network, secrets, production data, and chain writes.
- Keep one primary behavioral evidence item per claim. Ordinary changes do not need independent evidence artifacts; names, source snippets, canned `PASS` files, and unfinished processes are not behavior evidence. Preserve `blocked`, `unknown`, and `not run` honestly.
- Load and validate App environment material at the composition root, then pass it to the Factory once as immutable composition input; do not repeat it through features or business calls.
- Treat native `dlopen` hangs and terminated diagnostic processes as environment or harness failures. Docker is a separate environment and cannot replace Dart or Flutter App evidence.
- After a `Conversation recap`, use durable task records and the working tree as the source of truth; do not duplicate fakes, reports, or historical evidence.
