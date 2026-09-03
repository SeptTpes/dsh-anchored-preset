# dsh-anchored-preset

[中文 README](README.md) | English

**Minimal launch trajectory + code completion power** — a dsh (DeepSeek Harness) agent preset (`code-cache-anchored`, v2) ported from the community dsh-anchored-standard mechanism: round 1 starts as minimal to anchor the trajectory, promotes to the full code-cache tool surface after the first tool call, and falls back to the small tool set after compaction.

## One-line positioning

- **Launch trajectory**: round 1 fully replicates `minimal` — the persona sentence only, the two tools (`bash` + `str_replace_editor`), no injection — anchoring the "we need" trajectory. Community experiments suggest DeepSeek V4 scores higher under that condition (dsh-anchored-standard: Minimal 99/96 vs Standard 91/92 on Project2).
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

## Verification data (honest)

**This preset's mechanism and validation boundaries — the same open state as the community original:**

- **Trajectory anchoring: reproduced ✓.** In all 36 runs (2026-09-02/03 A/B repeats 3, command-code/deepseek-v4-flash) anchored always started with "we need" style, code-cache always narrative — the anchoring mechanism works (community: 9/9).
- **Ability enhancement: unverified (same open question as the community).** This experiment's task set (reachable coding tasks) had 100% pass rates on both arms — by design it cannot measure an ability ceiling difference; the community original's independent replications did not resolve it either — anchored−standard ability +3.3, 95% CI [−2.6, +9.3] (contains 0), multi-env 98/99 not reproduced; the original author stopped development in 2026-08 after API price increases. **No ability claim is made, and none is denied.**
- **Token efficiency: no difference vs code-cache.** H1/H2 did not reach the pre-registered thresholds (median token drop -10.5% < 15%) — but cost-saving is the cache-aware engine's job (code-cache), not this preset's design goal; both arms ran the same engine, so the token result does not constitute a rejection of this preset.

Full experiment records live in [dsh-anchored-ab-kit](https://github.com/SeptTpes/dsh-anchored-ab-kit) results/.

## Lineage and acknowledgments

- **Engine (cache-aware compaction)**: from the author's own code-cache project [SeptTpes/dsh-cache-aware-compaction](https://github.com/SeptTpes/dsh-cache-aware-compaction) (M3-verified: 62% cheaper compaction-call input on a truly cold cache).
- **Round-1 anchoring mechanism**: ported from [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) (community project, not official) — its finding: DeepSeek V4 conditions strongly on the API-visible tool catalog and scores higher under the Minimal first-round trajectory, so it anchors round 1 on Minimal then promotes to the full tool set. Implemented per its tool-bootstrap design (promoteOn: either / suppressed first-round injection / compaction fallback). Difference: this preset promotes to the code-cache surface rather than the original's Standard catalog.

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
