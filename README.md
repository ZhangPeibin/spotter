# Spotter

Spotter is a lightweight toolkit for AI-assisted development. `spotter-simplify` supplies simple coding rules and sufficient verification; `spotter-orchestrator` coordinates tasks and agents.

Spotter Simplify’s verification scope is duplicate tests, unnecessary fakes, fixtures, helpers and evidence files, and redundant verification runs. Spotter also injects full-mode coding rules to keep implementation complexity low.

## Spotter Orchestrator

This marketplace also contains the independent `spotter-orchestrator` plugin. Its `SessionStart` hook asks the main agent to load the compact [$orchestrate index](plugins/spotter-orchestrator/skills/orchestrate/SKILL.md), then only the role needed for the current task. The eight definitions are `product.agent.md`, `planning.agent.md`, `design.agent.md`, `code.agent.md`, `test.agent.md`, `review.agent.md`, `release.agent.md`, and `observe.agent.md` under that Skill's `roles/` directory. They are supporting instructions, not eight automatically loaded Skills. Each has a JSON `tasks` block with explicit `executor` and `model` fields plus task-specific instructions.

完整的中文安装、配置与使用说明见 [Orchestrator 使用手册](docs/orchestrator.md)。

Main-session models, including project overrides, are recommendations because the hook cannot switch or verify the current model. Defaults are defined per task, not per whole role. Small localized work stays in the main agent unless delegation is requested. Each implementation ticket gets a fresh execution agent with `fork_turns: "none"`, responsible for that ticket's implementation, ordinary tests, and acceptance corrections. Never reuse it for a later ticket. `code.implement` defaults to Sol. Standalone or explicitly separated testing still uses [test.agent.md](plugins/spotter-orchestrator/skills/orchestrate/roles/test.agent.md): Astra for `write`, Sol for `run`. Explicit user model choices and required independent checks take precedence; workers do not recursively delegate.

Projects can override those defaults in `.codex/orchestrator.json`. Only configured entries are needed:

```json
{
  "models": {
    "main": "gpt-6-astra",
    "subagent": "gpt-5.6-sol"
  },
  "roles": {
    "planning": { "model": "gpt-6-astra" },
    "code": { "model": "gpt-5.6-sol" },
    "test": {
      "model": "gpt-5.6-sol",
      "tasks": {
        "write": { "model": "gpt-6-astra" }
      }
    },
    "review": { "model": "gpt-6-astra" }
  }
}
```

Before dispatch, the coordinator invokes the absolute resolver in the hook's `ORCHESTRATOR_PATHS` record: `node "<resolver>" <role> <task> "<repository-root>"`. Precedence is the current user's explicit choice, task override, role override, `models.main` or `models.subagent` according to the task executor, then the built-in task model. Configuration changes models only; the role still determines the executor. The resolver returns `modelPolicy: required` for every subagent route and `preferred` for every main-session route, including project overrides. Explicit user model choices remain required. A preferred main model guides session selection but does not block work when the host cannot switch or verify its model. Invalid role/task names block dispatch instead of silently falling back. Editing the project file affects the next dispatch and does not require rebuilding the plugin.

The hook supplies absolute `pluginRoot`, `resolver`, and `skillFile` paths. The resolver also returns absolute `pluginRoot` and `roleFile` paths, which the coordinator includes with the assignment's absolute worktree path. Workers open the role directly instead of searching the target repository or loading the whole index. Paths are derived from the installed files and remain valid when the cache version or installation location changes.

Agent communication targets 500 Unicode characters per complete message body, including paths, spaces, punctuation, and newlines. Above 800, the sender must reconsider and rewrite before sending; indispensable constraints/evidence may exceed that threshold with a brief concrete reason. References replace copied background, not missing requirements. Follow-ups carry only changes, worker reports stay concise, and neither split messages nor compression agents bypass the budget. These are instruction-level checks, not a tool interceptor or enforced runtime limit.

The concurrency ceiling is three active subagents per root session, excluding the coordinator and including implementation, tests, and review. Running tasks, unfinished owned processes, and workers awaiting acceptance reserve slots. There is no plugin lifetime creation cap; each new ticket gets a different agent. Dependencies and one-writer-per-worktree rules still apply, so three is not a target to fill. Only the same unfinished ticket or bounded review/test assignment may use a follow-up on its existing agent.

After acceptance, preserve the ticket checkpoint and evidence. A terminal worker with no owned process is `ended`; invoke native close/release when available and record `released` only after host confirmation. Missing release support remains explicit but does not block the next dispatch. Do not revive accepted-ticket agents for later tickets or delete their worktrees as part of agent cleanup. Stricter host limits still apply. A capacity rejection is authoritative and stops retries until a real lifecycle change; if the host still cannot admit another fresh agent, preserve the pending ticket for a new root session rather than reusing old context or letting the coordinator take over. This plugin cannot add a missing release API or alter host slot accounting.

The coordinator defines non-goals and acceptance before dispatch, avoids routine progress chasers, and checks concise results with the necessary original evidence. Unchanged valid evidence is reused. Agreed acceptance ends the agent's task; optional improvements are recorded separately. Each accepted ticket leaves a concise checkpoint for the next fresh worker, including decisions, worktree, evidence, and release status. Later review defects get fresh bounded correction assignments rather than reviving accepted-ticket conversations.

Acceptance feedback is classified before a follow-up. A defect against recorded acceptance remains on the ticket; a new screen, workflow, shared-component migration, refresh policy, data source, platform behavior, or other material capability becomes a new ticket with a fresh agent. This keeps manual review from silently turning one ticket into a long-lived feature session.

One feature owns one branch/worktree shared by its tickets. The coordinator reuses its recorded workspace, schedules tickets by dependencies, and allows one writer at a time. A new feature uses the configured base or the coordinator's committed `HEAD`; uncommitted prerequisites and local path dependencies must be resolved explicitly. Changing agent or model does not create another worktree. Results are accepted against the integrated state before feature cleanup. This remains an instruction-based workflow, not a worktree manager or enforced scheduler.

Workspace precedence is the current user's choice, an existing agreed feature workspace, repository defaults, then plugin defaults. A preference for isolation is honored when feasible; dirty task files are related prerequisites to preserve, not an automatic reason to remain on main. Resolve concrete obstacles before dependent writes instead of silently changing that choice. Record the actual checkout, branch, base, prerequisite checkpoint, and integration target before dispatch; delivery distinguishes implementation, commit, local integration, and push status.

Waiting prefers host completion notifications and the longest interruptible wait allowed by the host and higher-priority instructions. An unchanged timeout does not justify polling the roster, chasing progress, or restarting work. Required user updates use the known state. These rules reduce avoidable polling; the plugin cannot suppress a host model invocation after timeout or guarantee token savings.

Orchestrator uses available specialist skills, including Spotter, without bundling or installing them. It remains an instruction-based coordinator: it neither intercepts tools nor guarantees compliance, grants release permission, or injects a separate subagent hook. Spotter's verification behavior remains independent.

Review `plugins/spotter-orchestrator/hooks/hooks.json`, `plugins/spotter-orchestrator/hooks/inject.js`, and its Skill before installation. Register this repository's marketplace using the procedure below, then install `spotter-orchestrator@personal` with `codex plugin add spotter-orchestrator@personal`. Use the existing update/uninstall procedure with `spotter-orchestrator` in place of `spotter-simplify`. Start a new session to pick up the hook.

Check the package from the repository root:

```sh
node --test plugins/spotter-orchestrator/test/*.test.js
uv run --with PyYAML python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/spotter-orchestrator
uv run --with PyYAML python ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py plugins/spotter-orchestrator/skills/orchestrate
```

The hook test executes the registered command in an isolated directory and checks its JSON output, bundled skill reference, lifecycle registration, and marketplace path. The role contract test checks index links, JSON task definitions, and standalone planning, implementation, and test routing. These checks do not prove live dispatch or savings. For runtime acceptance, compare the same bounded task at the same code baseline with and without orchestration: record per-model input/cache/output, requests, agent messages, elapsed time, and acceptance results. Check distinct fresh agents for successive tickets, same-ticket repairs before acceptance, the three-active ceiling, and confirmed close/release where supported. Verify unavailable/failed release and host capacity rejection without cross-ticket reuse. Preserve explicit Astra-write/Sol-run overrides, in-flight handles, and valid evidence. A discussion-only request must remain discussion-only. Keep installation separate from live behavior validation.

## Spotter Simplify Layout

Names describe the action or lifecycle event; Flutter extends the common verification skill.

| Path under `plugins/spotter-simplify/` | Purpose |
| --- | --- |
| `skills/verify/` | Select, run, reuse, and report verification evidence. |
| `skills/verify-flutter/` | Apply Flutter-specific evidence choices after `verify`. |
| `scripts/evaluate.js` | Evaluate verification overhead from local session records (`npm run evaluate`). |
| `hooks/session-start.js` | Emit the SessionStart hook response. |
| `hooks/session-context.js` | Compose coding rules and verification skill guidance. |
| `hooks/compile-tool-output.js` | Compile eligible verbose tool output. |
| `rules/full.md` | Full-mode coding rules. |
| `test/` | Existing tests named after the corresponding entrypoint. |

## Spotter Rules

Spotter's existing `SessionStart` hook directly injects [Spotter full rules](plugins/spotter-simplify/rules/full.md) alongside its verification guidance. No separate plugin or Skill is needed for these rules, and no review, audit, debt, gain, help, or mode-tracking command is registered.

The coding rules are adapted from Dietrich Gebert's MIT-licensed work; the [original copyright and license](plugins/spotter-simplify/rules/UPSTREAM-LICENSE) are retained. The bundled rules are self-contained. Explicit user instructions override these defaults; there is no persistent lite/full/ultra switch.

Source reading follows concrete questions and actual dependencies, with bounded tool output and reuse of unchanged source already in context. Truncated results require focused retrieval of the missing evidence. Large cached input totals alone do not justify restarting sessions or discarding needed context.

Spotter's `PostToolUse` hook conservatively compiles only recognized test, build, and static-analysis command responses larger than 16,000 serialized characters before they enter later model context. It stores the exact model-facing `tool_response` in an owner-only JSON artifact under `~/.codex/.tmp/spotter-tool-output/<session-id>/`, then substitutes a bounded selection containing status metadata, diagnostic lines, head/tail context, a SHA-256 digest, and a retrieval path. Source reads, searches, diffs, configuration/specification reads, database/HTTP/MCP results, runtime diagnostics, mixed inspection commands, unknown tools, and small results always pass through unchanged. Results that look like secret material and compiler failures also fail open without creating another copy. Artifacts are opportunistically cleaned after 24 hours; this is not an exact deletion guarantee.

The compiler cannot recover bytes already truncated by the source tool. Such artifacts are marked incomplete. It also cannot intercept hosted tools that bypass Codex's local tool-hook path, remove existing conversation history, prevent a waiting model from waking, or establish semantic correctness from selected lines. This conservative default intentionally gives up savings whenever command classification is uncertain. Override thresholds with `SPOTTER_TOOL_OUTPUT_MIN_CHARS`, `SPOTTER_TOOL_OUTPUT_MAX_FEEDBACK_CHARS`, and `SPOTTER_TOOL_OUTPUT_RETENTION_HOURS`; `SPOTTER_TOOL_OUTPUT_DIR` is intended for isolated tests or an explicitly chosen private location.

## Spotter Behavior and boundaries

The `SessionStart` hook injects Spotter full rules and asks the agent to load `$verify` for every repository. It detects Flutter repositories from `pubspec.yaml` and also asks it to load `$verify-flutter` for Dart unit, widget, integration, golden, and device evidence.

It is zero-configuration and enforces no commands: its prompt uses explicit MUST/MUST NOT constraints and paired wrong/correct examples in `verify`. It does not inspect Git history, run or rewrite commands, block tests, control CI, or inject guidance into subagents. Compliance still depends on the agent following the supplied instructions.

## Verification Rules

The Harness has two jobs:

- Reduce low-value test cases. A test must cover a user-visible risk that is
  not already covered at a better layer. The agent should reuse or extend the
  closest useful test, merge tests that prove the same behavior, and remove
  tests that only duplicate coverage or assert incidental implementation.
- Reduce unnecessary test execution. The agent should select the smallest
  relevant evidence set, avoid a test already running elsewhere, and avoid
  full-suite runs or repeated polling that add no evidence.

The agent records why it kept, merged, or removed tests; this is not a manual approval queue. A real-device check remains useful for platform integrations, gestures, performance, and hardware behavior, but it does not replace repeatable tests for deterministic product behavior.

Before verification, the agent identifies the claim, its contract, the smallest evidence, and why another run is needed. It chooses to run, reuse, wait, or preserve a blocker. After verification, it checks the original result and its applicability before reporting success, including results supplied by existing subagents. Explicit architecture and API contracts may use structural checks; those checks do not prove runtime behavior. This workflow requires neither a fixed receipt on every turn nor additional agents.

`$verify` owns evidence identity, process lifecycle, reuse, and reporting. `$verify-flutter` adds only the Flutter test-layer and resource-isolation decisions.

For test processes, `$verify` keeps the original tool handle, uses the longest permitted interruptible wait, and avoids status-only polling or duplicate log tails. Verbose output stays in an appropriate original result file when permitted; terminal exits and failure diagnostics remain available without rerunning unchanged tests just to reproduce a transcript. Orchestrator separately owns waiting for delegated agents. These are instruction-level controls, not a guarantee of host scheduling behavior or token savings.

## Evaluation

Success means removing redundant verification while preserving coverage of independent risks. Fewer lines or tests alone do not demonstrate improvement. The evaluator below measures execution proxies; it does not establish whether a reduction in test code preserves the required evidence.

Run `npm run evaluate --prefix plugins/spotter-simplify` to compare the 20 `dex-app-core` development session families before the intervention with the first 20 after it. Both groups are recalculated from local Codex JSONL with the same algorithm; the former hardcoded baseline is invalid. A family is eligible only after its root and observed child turns finish. Inherited child context is excluded using its history boundary and owning session metadata.

The output contains heuristics, not a causal measurement of the hook:

- Duplicate starts are same-command candidates between detected mutations, not proof of wasted work.
- `noTerminalTestRuns` means terminal evidence could not be associated. It includes missing or truncated output, not just running processes. A recorded nonzero exit closes the process but does not prove a passing test.
- Full-suite counts recognize common literal commands and redirections. Dynamic JavaScript, shell wrappers, and project-specific runners can be missed. Batched results must be printed in call order and in full to be associated.
- `verificationTokens` is a proxy for tokens after a detected test until the next mutation or turn boundary. It uses cumulative-counter deltas, includes unrelated reasoning and cached input, and is not a billing or savings figure.

The verdict is `continue` only when at least three measurable metrics fall by 20% and none rises by 20%; otherwise it is `stop`. It remains `pending` until both groups have 20 families and at least three metrics have nonzero baselines. Session sizes and hook versions differ, so inspect representative sessions before acting on a verdict. The evaluator never blocks a session or writes prompts, output, paths, or session IDs into the repository.

Known harness blockers should be reproduced once at the smallest boundary. Retry after a relevant change or explicit request; continue unaffected checks and keep a required final gate `blocked`. Do not restart the same blocked full suite after every unrelated edit.

## Install and trust

From this repository root, review the executable hook before trusting it:

```sh
sed -n '1,240p' plugins/spotter-simplify/hooks/hooks.json
sed -n '1,240p' plugins/spotter-simplify/hooks/session-start.js
sed -n '1,240p' plugins/spotter-simplify/rules/full.md
sed -n '1,240p' plugins/spotter-simplify/skills/verify/SKILL.md
sed -n '1,240p' plugins/spotter-simplify/skills/verify-flutter/SKILL.md
```

Then register this repository's marketplace and install the plugin:

```sh
codex plugin marketplace add "$(pwd)"
codex plugin add spotter-simplify@personal
codex plugin list
```

If Codex presents a hook trust prompt, approve it only after that review. Start a new Codex session in a target repository after installation. For a small isolated change, verify that Codex inspects the repository and selects a focused test before considering broader validation. For a cross-module change, verify that it selects evidence for the affected boundaries. A repository-required final gate, release, or explicit full-suite request can require broader checks; a known blocker remains reported until its prerequisites change or a retry is requested.

## Verify

Run the automated checks from the repository root:

```sh
node --test plugins/spotter-simplify/test/*.test.js
uv run --with PyYAML python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/spotter-simplify
```

The first command checks the hook output and registration. The second is the official plugin validator; replace its absolute path if Codex is installed elsewhere.

Manual verification is the fresh-session procedure in the previous section. It is deliberately interactive because only a new Codex session can demonstrate that the trusted lifecycle hook supplies its context.

## Update and uninstall

After changing the plugin, give the existing manifest a new local cachebuster and reinstall it:

```sh
python3 ~/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py plugins/spotter-simplify
codex plugin add spotter-simplify@personal
```

Start a new session to use the update. To remove it:

```sh
codex plugin remove spotter-simplify@personal
codex plugin marketplace remove personal
```

Remove the marketplace only when no other plugin uses it.
