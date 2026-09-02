/**
 * code-cache-anchored bootstrap gate.
 *
 * The round-1 ↔ promoted state machine for the anchored preset.
 *
 * Round 1 (gate closed) replicates the `minimal` preset's model surface:
 *   - the system prompt shows ONLY the minimal persona sentence
 *     (complete-prompt semantics, achieved in system-prompt/assemble)
 *   - no dynamic runtime-context snapshots (assembly.contexts emptied)
 *   - the tool catalog is restricted to `bash` + `str_replace_editor`
 *     (registry-level tools.restrict on the agent scope, so the `skill`
 *     tool is invisible and the skill-catalog auto-injection self-suppresses)
 *   - `agent-instructions` and `skill-catalog`/skill-invocation messages
 *     injected by host listeners are stripped at agent/pre-step
 *
 * Promotion (gate open) happens after the first `tool/call` OR the first
 * tool-less `assistant/message` of the session. A round-1 response that
 * CARRIES tool calls does NOT promote before those calls execute: they were
 * emitted under the round-1 catalog and must run there (a code-mode collapse
 * would deny them as UNKNOWN_TOOL). Transitions are therefore applied only at
 * safe points — step/end (the step's tool calls have all executed) and
 * compaction/end:
 *   - the restriction is lifted: the full host catalog is inherited (bash,
 *     fs, fs-search, jobs, skill, goal, plan, subagents, workflows, ralph,
 *     ask-user, todo, web, ...)
 *   - the agent presents its tools in Code Mode (presentAs('code')), the
 *     same run_code + generated-SDK surface the code-cache preset uses
 *   - the cache-aware compaction engine mounted in this composition from the
 *     start (code-cache verbatim) keeps hot-replay / cold-transcribe
 *
 * Compaction fallback (gate closed again): after `compaction/end` the
 * presentation and restriction return to the round-1 posture, so the first
 * post-compaction request re-enters the minimal surface ("we need" posture)
 * and re-promotes after its next tool call or assistant message.
 *
 * State is a PURE FUNCTION of the session event log (last promotion-event seq
 * vs last compaction/end seq), so it is replay-safe: a resumed or forked
 * session reconstructs exactly the catalog each request ran under, satisfying
 * the model-visible ⟺ logged rule.
 *
 * The plugin is mounted in the preset's standing composition, so its
 * listeners are scope-gated to the preset's agents (verified empirically
 * against the running dsh): preset-scope listeners receive every descendant
 * agent's `session/event`, `agent/pre-step`, `agent/session-start`, and
 * `system-prompt/assemble` dispatches.
 * @module code-cache-anchored/bootstrap-gate
 */

const MINIMAL_PERSONA = 'You are a helpful software engineer assistant.'
const PERSONA_SECTION = 'deployment:persona'
/** The only tools the model sees while the gate is closed. */
const ROUND1_TOOLS = new Set(['bash', 'str_replace_editor'])

/**
 * The gate state for one agent, as a pure function of its session log:
 * closed until a promotion event (tool/call, or an assistant/message that
 * carries no tool-call block) appears after the latest compaction/end.
 * @param {{ session: { events: readonly { type: string; seq: number; data?: any }[] } }} agent
 * @returns {'closed' | 'open'}
 */
export function gateState(agent) {
  let promoteSeq = 0
  let compactSeq = 0
  for (const event of agent.session.events) {
    if (event.type === 'tool/call') {
      // A tool call proves the (round-1) catalog was used; promote after it
      // executes. The call itself must still run under the round-1 surface.
      promoteSeq = event.seq
    } else if (event.type === 'assistant/message') {
      // promoteOn 'either': a first response WITHOUT tool calls promotes
      // after the message. A response that CARRIES tool calls must NOT
      // promote before those calls execute (they were emitted under the
      // round-1 catalog), so it counts only when it has no tool-call block.
      const blocks = event.data?.message?.content ?? []
      const carriesToolCalls = blocks.some((block) => block.type === 'tool-call')
      if (!carriesToolCalls) promoteSeq = event.seq
    } else if (event.type === 'compaction/end') {
      compactSeq = event.seq
    }
  }
  return promoteSeq > compactSeq ? 'open' : 'closed'
}

/** Per-agent live machinery (restriction + presentation disposers). */
const states = new WeakMap()

function stateOf(agent) {
  let record = states.get(agent)
  if (record === undefined) {
    record = { restriction: undefined, presentation: undefined }
    states.set(agent, record)
  }
  return record
}

/** Enter round-1 posture: restrict to the minimal pair, no Code Mode. */
function enterClosed(agent) {
  const record = stateOf(agent)
  if (record.presentation !== undefined) {
    record.presentation()
    record.presentation = undefined
  }
  if (record.restriction === undefined) {
    // Registers into the AGENT's own scope layer, so the restriction is
    // per-session even though the composition is shared.
    try {
      record.restriction = agent.ctx.tools.restrict({ allow: [...ROUND1_TOOLS] })
    } catch (error) {
      console.error('[bootstrap-gate] restrict failed for', agent.id, String(error))
    }
  }
}

/** Enter promoted posture: lift the restriction, declare Code Mode. */
function enterOpen(agent) {
  const record = stateOf(agent)
  if (record.restriction !== undefined) {
    record.restriction()
    record.restriction = undefined
  }
  if (record.presentation === undefined) {
    try {
      record.presentation = agent.ctx.tools.presentAs('code')
    } catch (error) {
      console.error('[bootstrap-gate] presentAs failed for', agent.id, String(error))
    }
  }
}

/**
 * Reconcile the agent's gate posture against its session log. SYNCHRONOUS:
 * restrict()/presentAs() are synchronous registrations, and the next
 * request's wireSchemas runs immediately after the triggering event (step/end
 * or compaction/end), so deferring to a microtask would race the very next
 * assembly. Idempotent per agent: each transition is guarded by the record
 * cells, so repeated calls are cheap and a burst of events settles on the
 * log-derived posture.
 */
function reconcile(agent) {
  const mode = gateState(agent)
  if (mode === 'closed') enterClosed(agent)
  else enterOpen(agent)
}

/**
 * A cordis plugin (function shape). Runs inside the preset's standing
 * composition; plain JavaScript, no imports beyond the module system.
 */
export default function apply(ctx) {
  /** Resolve the live agent for a session through the host registry. */
  const agentFor = (session) => {
    const agents = ctx.get('agents')
    return agents?.get(session.id)
  }

  // Agent birth: establish the initial posture BEFORE the first request.
  // publish() emits agent/session-start after both registries announced and
  // before the loop starts, so the restriction is installed before the first
  // system-prompt assembly. A fresh session starts closed (empty log); a
  // resumed/forked session reconciles straight from its log (may already be
  // open).
  ctx.on('agent/session-start', ({ agent }) => {
    reconcile(agent)
  })

  // Session events drive transitions, applied ONLY at safe points:
  //   - step/end: the step's tool calls (if any) have all EXECUTED, so the
  //     catalog that emitted them is no longer in flight; flipping the
  //     presentation now cannot deny a round-1 call that was already
  //     dispatched. A pure-text step ends after its assistant/message, so the
  //     first-response promotion lands here too.
  //   - compaction/end: the session finished compacting; the next turn's
  //     assembly should re-enter the round-1 surface.
  // gateState() itself reads the durable log, so reconcile at any of these
  // points lands the same posture a replay would reconstruct.
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'step/end' && event.type !== 'compaction/end') return
    const agent = agentFor(session)
    if (agent === undefined) return
    reconcile(agent)
  })

  // Pre-step: while closed, strip host-injected context messages (workspace
  // agent-instructions, skill catalog/invocations). Registered from the
  // standing composition, which runs AFTER the host's global listeners, so
  // this frame sees the decision their frames produced and can remove the
  // messages before the loop commits them.
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    if (decision.kind !== 'enter' || gateState(agent) !== 'closed') return decision
    const messages = decision.messages.filter((message) => {
      const kind = message.source?.kind
      return kind !== 'agent-instructions' && kind !== 'skill-catalog' && kind !== 'skill-invocation'
    })
    return messages.length === decision.messages.length ? decision : { ...decision, messages }
  })

  // Prompt assembly: while closed, stamp the minimal surface onto the
  // assembly. The waterfall runs next() first (other listeners keep their
  // say), then the resulting assembly is shaped for round-1 semantics. No
  // complete section is registered, so nothing is restored over this.
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const agent = context.scope
    // context.scope is the agent (assembleContextFor sets { agent, scope: agent }).
    // Reconcile defensively here too: every assembly path is covered even if
    // an event was missed (e.g. a resume that never emitted session/event).
    if (agent !== undefined) reconcile(agent)

    const result = await next()
    if (agent === undefined || gateState(agent) !== 'closed') return result

    // Complete-prompt semantics: the persona sentence is the whole system
    // prompt, shadowing the harness identity opener and every tool-guidance
    // section exactly like minimal's complete: true persona would.
    result.sections = [{ name: PERSONA_SECTION, text: MINIMAL_PERSONA }]
    // minimal's includeRuntimeContext: false — no dynamic runtime context.
    result.contexts = []
    // Belt-and-braces over tools.restrict: never let a schema through that
    // the round-1 posture does not promise.
    result.tools = result.tools.filter((tool) => ROUND1_TOOLS.has(tool.name))
    return result
  })
}
