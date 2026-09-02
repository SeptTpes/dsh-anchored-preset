# dsh-anchored-preset

[中文 README](README.md) | English

**Completion power of code mode + the launch posture of minimal mode** — a dsh (DeepSeek Harness) agent preset (`code-cache-anchored`, v2) that starts round 1 as a minimal preset, promotes to the full code-cache tool surface after the first tool call, and falls back to the small tool set after compaction.

## One-line positioning

- **Launch posture**: round 1 fully replicates `minimal` — the persona sentence only, the two tools (`bash` + `str_replace_editor`), no injection — for a decisive "we need" start.
- **Completion power**: after the first `tool/call` (or an `assistant/message` without a tool-call block) the session promotes to the full code-cache surface — `run_code` Code Mode plus the cache-aware compaction engine — so long tasks are not limited by the tool surface.

## How it works (three phases + a pure-function gate)

Round 1 minimal (gate closed) → persona sentence + two tools + no injection; promote to the full code-cache surface (gate open) after the first `tool/call` or a tool-less `assistant/message`; fall back (gate closed) after `compaction/end`, then promote again on the next tool call.

- **Gate state is a pure function of the session event log**: `gateState(agent)` maps the event array to `closed` / `open` (last promotion-event seq vs last `compaction/end` seq), so a resumed or forked session reconstructs exactly the same tool surface (model-visible ⟺ logged).
- **Safe-point transitions**: promotion is applied only at `step/end` and `compaction/end` — a round-1 tool call always executes under the round-1 catalog and is never rejected with UNKNOWN_TOOL by an early promotion.
- The cache-aware compaction engine (hot-cache prefix replay / cold-cache transcript summarization, ~62% cheaper compaction-call input when the cache is truly cold) comes from the author's own code-cache project; mounting is covered under Install.

## Install

Prerequisite: **@septtpes/dsh-compaction-cache-aware is not published to npm — install the code-cache engine locally first**.

```bash
# 0. Prerequisite: install the cache-aware compaction engine into dsh (local path; the only path until it is published)
dsh plugin --profile web add file:/path/to/dsh-cache-aware-compaction/dsh-compaction-cache-aware

# 1. Copy the preset trio into dsh's agent-presets directory
cp -r preset/ ~/.dsh/.agent-presets/code-cache-anchored/

# 2. Select the preset in settings.yaml
# agent-presets:
#   default: code-cache-anchored
```

- The preset trio (`preset/preset.yml` + `preset/agent.cordis.yml` + `preset/bootstrap-gate.js`) is byte-identical to the running version (diff-verified when this repository was created).
- Engine install path: the `dsh-compaction-cache-aware` package in `SeptTpes/dsh-cache-aware-compaction` is not on npm yet; install it with a local `dsh plugin add` first. The engine is mounted in the preset's compaction group (`coldMode: transcribe`, line-identical to the code-cache original).

## Verification data (honest: not an overall win)

A/B comparison, 4 tasks × 2 presets (measured 2026-09-01, see `docs/AB-RESULT.md`):

| Task | Type | code-cache | anchored | Verdict |
|---|---|---|---|---|
| TASK-006 session analyzer CLI | generative | 3159 events / 77 tool calls | 1775 events / 28 tool calls | comparable output; anchored starts more decisively |
| TASK-007 md2csv | generative | 12 tests green | 13 tests green | same spec, all green |
| TASK-008 refactor (understanding) | understanding | 15-case diff all passed | 15-case diff all passed | code-cache steadier |
| TASK-009 batch analyzer | generative | 251 lines | 258 lines | anchored completes generative tasks well |

- **Verdict: anchored wins on generative tasks, code-cache wins on understanding tasks — this is not an overall win**.
- Fingerprints: anchored round 1 showed "we need" style 4/4 vs code-cache 0/4 (same task weight, n=8); the "we need" pattern is driven by task weight (light tasks are usually narrative), see `docs/FINGERPRINT.md`.

## Lineage and acknowledgments

- **Engine (cache-aware compaction)**: from the author's own code-cache project [SeptTpes/dsh-cache-aware-compaction](https://github.com/SeptTpes/dsh-cache-aware-compaction) (M3-verified: 62% cheaper compaction-call input on a truly cold cache).
- **Round-1 anchoring idea**: inspired by dsh-anchored-standard's tool-bootstrap design (promoteOn: either / suppressedContextSources / compactionTools small-set fallback).

## Known boundaries

- **Approval channel depends on the tool-bash composition**: round-1 bash is the ordinary tool-bash (not minimal's persistent shell) — the escalation channel (`approval/asked`) hangs on tool-bash's sandbox executor; round-1 bash is not persistent across calls.
- **Round-1 bash is non-persistent**: command state does not carry across calls (round 1 normally performs 1–2 calls, so the impact is negligible; the minimal core is preserved).
- **dsh version line 0.1.1-rc.2**: this preset is verified on that line; version drift needs separate adaptation.

## Version statement

- dsh: **0.1.1-rc.2** (no active upgrade to the 0.1.2-alpha line).
- Engine: `@septtpes/dsh-compaction-cache-aware` peerDependencies target ^0.1.1-rc.2.

## Tests

```bash
node --test test/gate-state.test.mjs   # gateState pure function, 9 cases (zero dependencies)
```

## License

MIT © 2026 SeptTpes
