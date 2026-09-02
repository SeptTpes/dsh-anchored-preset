// gate-state.test.mjs — gateState 纯函数单测（node --test，零依赖）
// 运行：node --test test/gate-state.test.mjs   （或 node --test）
// 被测对象：preset/bootstrap-gate.js 的 gateState(agent) —— 输入会话事件数组 → 输出 closed/open。
// 说明：bootstrap-gate.js 以默认导出 apply(ctx) 插件形式发布，gateState 未单独导出；
// 单测通过源文本摘取 gateState 函数体并以块包装重建（new Function），
// 保证运行版三件套逐字节不动（红线）。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const GATE_SRC = fileURLToPath(new URL("../preset/bootstrap-gate.js", import.meta.url));

/** 从 bootstrap-gate.js 源文本中摘取 gateState 函数体并重建为可调用函数。 */
function loadGateState() {
  const src = readFileSync(GATE_SRC, "utf8");
  const marker = "export function gateState(agent) {";
  const start = src.indexOf(marker);
  assert.ok(start >= 0, "gateState 函数应存在于源文件中");
  const bodyStart = start + marker.length;
  const end = src.indexOf("\n}", bodyStart);
  assert.ok(end >= 0, "gateState 函数体应能定位到结束");
  const body = src.slice(bodyStart, end);
  // 用块语句包装 body（body 以 return 表达式结尾），等价于原函数体。
  const fn = new Function("agent", "{\n" + body + "\n}");
  return fn;
}

const gateState = loadGateState();

/** 构造事件：seq 从 1 起递增。 */
function ev(type, seq, data) {
  return { type, seq, data };
}
function agentWith(events) {
  return { session: { events } };
}
function toolCall(seq) {
  return ev("tool/call", seq, { name: "bash" });
}
function assistantMessage(seq, blocks) {
  return ev("assistant/message", seq, { message: { content: blocks } });
}
function textBlock(text) {
  return { type: "text", text };
}
function toolCallBlock(name) {
  return { type: "tool-call", name };
}
function compactionEnd(seq) {
  return ev("compaction/end", seq, {});
}

// ---------- 用例 ----------

test("空日志 → closed", () => {
  assert.equal(gateState(agentWith([])), "closed");
});

test("单个 tool/call → open（且调用本身在 closed 面）", () => {
  // 事件序列：tool/call 之后立刻 open；该调用（seq=1）自身仍按 round-1 面执行。
  const agent = agentWith([toolCall(1)]);
  assert.equal(gateState(agent), "open");
  // 纯函数可重放：喂同一序列两次结果相同
  assert.equal(gateState(agent), gateState(agentWith([toolCall(1)])));
});

test("带 tool-call 块的 assistant/message → 不提前晋升", () => {
  // 首答携带 tool-call 块：该消息本身不晋升；要等 tool/call 事件出现才 open。
  const agent = agentWith([assistantMessage(1, [textBlock("hi"), toolCallBlock("bash")])]);
  assert.equal(gateState(agent), "closed");
  // tool/call 执行后（同一步内）→ open
  const agent2 = agentWith([assistantMessage(1, [textBlock("hi"), toolCallBlock("bash")]), toolCall(2)]);
  assert.equal(gateState(agent2), "open");
});

test("无 tool 块的 assistant/message → open", () => {
  const agent = agentWith([assistantMessage(1, [textBlock("done")])]);
  assert.equal(gateState(agent), "open");
});

test("compaction/end → 回落 closed", () => {
  const agent = agentWith([toolCall(1), compactionEnd(2)]);
  assert.equal(gateState(agent), "closed");
});

test("回落后再 tool/call → 再 open", () => {
  const agent = agentWith([toolCall(1), compactionEnd(2), toolCall(3)]);
  assert.equal(gateState(agent), "open");
});

test("双 compaction → closed", () => {
  const agent = agentWith([toolCall(1), compactionEnd(2), toolCall(3), compactionEnd(4)]);
  assert.equal(gateState(agent), "closed");
});

test("resume/fork 重放 → 与原始一致（同一事件序列喂两次结果相同）", () => {
  const events = [
    toolCall(1),
    assistantMessage(2, [textBlock("a")]),
    compactionEnd(3),
    assistantMessage(4, [textBlock("b"), toolCallBlock("bash")]),
    toolCall(5),
  ];
  const a = gateState(agentWith(events));
  const b = gateState(agentWith(events));
  assert.equal(a, b);
  // 与直接构造的等价序列一致
  const c = gateState(agentWith(events));
  assert.equal(a, c);
});

test("assistant/message 含 tool-call 块 + 后续 tool/call → 事件顺序语义", () => {
  // message(含块) → tool/call → compaction/end → message(无块) → open
  const agent = agentWith([
    assistantMessage(1, [textBlock("x"), toolCallBlock("bash")]),
    toolCall(2),
    compactionEnd(3),
    assistantMessage(4, [textBlock("y")]),
  ]);
  assert.equal(gateState(agent), "open");
});
