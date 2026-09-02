# dsh-anchored-preset

[English](README_EN.md) | 中文

**code 模式的完成力 + minimal 模式的启动姿态** —— 一个「首轮 minimal 起手、第一次工具调用后晋升 code-cache 全套、compaction 后回落」的 dsh（DeepSeek Harness）agent 预设（code-cache-anchored，v2）。

## 定位一句话

- **启动姿态**：首轮完全复刻 minimal（persona 一句 + bash/str_replace_editor 两件套 + 无注入），以「we need」式果断起手。
- **完成能力**：第一次 tool/call 或（无工具块的）assistant/message 后晋升 code-cache 全套（run_code Code Mode + 缓存感知压缩引擎），长任务不因工具面受限。

## 工作原理（三阶段 + gate 纯函数状态机）

首轮 minimal（gate closed）→ persona 一句 + 两件套 + 无注入；第一次 tool/call 或 assistant/message（无 tool-call 块）后晋升 code-cache 全套（gate open）；compaction/end 后回落小工具集（gate closed）→ 下一次工具调用再晋升。

- **gate 状态 = 会话事件日志的纯函数**：gateState(agent) 输入事件数组 → 输出 closed/open（最后晋升事件 seq vs 最后 compaction/end seq），因此 resume/fork 重放可重建完全相同的工具面（model-visible ⟺ logged）。
- **安全点过渡**：晋升只在 step/end 与 compaction/end 应用——首轮发出的 tool/call 一定在首轮目录下执行完，不会因提前晋升被 UNKNOWN_TOOL 拒绝。
- 引擎说明：缓存感知压缩引擎（热缓存前缀重放 / 冷缓存转录式压缩，实测冷时省约 62% 压缩调用输入成本）来自用户自己的 code-cache 项目，挂载方式见下方安装。

## 安装

依赖前置：**@septtpes/dsh-compaction-cache-aware（未发布 npm，需先本地安装 code-cache 引擎）**。

```bash
# 0. 前置：把缓存感知压缩引擎装进 dsh（本地路径；npm 发布前这是唯一路径）
dsh plugin --profile web add file:/path/to/dsh-cache-aware-compaction/dsh-compaction-cache-aware

# 1. 复制 preset 三件套到 dsh 的 agent-presets 目录
cp -r preset/ ~/.dsh/.agent-presets/code-cache-anchored/

# 2. settings.yaml 选择该预设
# agent-presets:
#   default: code-cache-anchored
```

- 三件套（preset/preset.yml + preset/agent.cordis.yml + preset/bootstrap-gate.js）与运行版逐字节一致（本仓库复制时 diff 实证）。
- 引擎安装路径说明：code-cache 引擎仓库 SeptTpes/dsh-cache-aware-compaction 的 dsh-compaction-cache-aware 包未发布 npm，先本地 dsh plugin add；引擎挂载在 preset 的 compaction 组（coldMode: transcribe，与 code-cache 原版逐行一致）。

## 验证数据（诚实声明：不是全面超越）

A/B 四任务 × 2 预设（2026-09-01 实测，见 docs/AB-RESULT.md）：

| 任务 | 类型 | code-cache | anchored | 结论 |
|---|---|---|---|---|
| TASK-006 会话分析 CLI | 生成型 | 3159 事件 / 77 工具调用 | 1775 事件 / 28 工具调用 | 产出相当，anchored 更果断 |
| TASK-007 md2csv | 生成型 | 12 用例全绿 | 13 用例全绿 | 同规格全绿 |
| TASK-008 重构（理解型） | 理解型 | 15 用例 diff 全过 | 15 用例 diff 全过 | code-cache 更稳 |
| TASK-009 批量分析 | 生成型 | 251 行 | 258 行 | 生成型 anchored 完成度足 |

- **结论：生成型任务 anchored 优，理解型任务 code-cache 优——不是全面超越**。
- 指纹：anchored 首轮 4/4 we need 式 vs code-cache 0/4（同任务同重量，样本 8）；we need 规律受任务重量驱动（轻任务多为叙事式），详见 docs/FINGERPRINT.md。

## 血缘与致谢

- **引擎（缓存压缩）**：来自用户自己的 code-cache 项目 [SeptTpes/dsh-cache-aware-compaction](https://github.com/SeptTpes/dsh-cache-aware-compaction)（M3 验证：冷缓存省 62% 压缩调用输入）。
- **首轮锚定思路**：受 dsh-anchored-standard 的 tool-bootstrap 设计启发（promoteOn: either / suppressedContextSources / compactionTools 回落小集）。

## 已知边界

- **审批通道依赖 tool-bash 组合**：round-1 bash 是普通 tool-bash（非 minimal 的持久 shell）——审批升级通道（approval/asked）挂在 tool-bash 的沙箱执行器上；round-1 bash 不跨调用持久。
- **首轮 bash 非持久**：命令状态不跨调用（首轮通常仅 1-2 次调用，影响可忽略；minimal 语义核心保留）。
- **dsh 版本线 0.1.1-rc.2**：本 preset 验证于该版本线；版本差异适配需单独处理。

## 版本声明

- dsh：**0.1.1-rc.2**（不主动升级 0.1.2-alpha 线）。
- 引擎：@septtpes/dsh-compaction-cache-aware peerDependencies 对应 ^0.1.1-rc.2。

## 测试

```bash
node --test test/gate-state.test.mjs   # gateState 纯函数 9 用例（零依赖）
```

## 许可证

MIT © 2026 SeptTpes
