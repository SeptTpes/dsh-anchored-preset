# dsh-anchored-preset

[English](README_EN.md) | 中文

**minimal 的启动轨迹 + code 的完成能力** —— 一个移植自社区 dsh-anchored-standard 机制的 dsh（DeepSeek Harness）agent 预设（code-cache-anchored，v2）：首轮 minimal 起手锚定轨迹，第一次工具调用后晋升 code-cache 全套，compaction 后回落。

## 定位一句话

- **启动轨迹**：首轮完全复刻 minimal（persona 一句 + bash/str_replace_editor 两件套 + 无注入），锚定「we need」式轨迹——社区实验表明 DeepSeek V4 系列在该条件下分数更高（dsh-anchored-standard 在 Project2 上 Minimal 99/96 vs Standard 91/92）。
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

## 验证数据（诚实声明）

**本预设的机制与验证边界如下，与社区原项目同款现状：**

- **轨迹锚定：复现 ✓**。36/36 run（2026-09-02/03 A/B repeats 3，command-code/deepseek-v4-flash）中 anchored 首轮均为 we need 式、code-cache 均为叙事式——锚定机制真实生效（社区 9/9 同款）。
- **能力增强：未验证（社区同款开放问题）**。本实验任务集（可达标编码任务）两臂通过率均 100%，设计上测不出能力上限差异；社区 dsh-anchored-standard 的独立复现亦未解决——anchored−standard 能力差 +3.3，95% CI [−2.6, +9.3]（含 0），multi-env 复现 98/99 未重现。原作者 2026-08 已因 API 涨价停止开发。**不宣称能力增强，亦不否定。**
- **token 效率：与 code-cache 无差**。H1/H2 未达预注册阈值（token 中位降幅 -10.5% < 15%）——但省钱是缓存压缩引擎（code-cache）的职责，不是本预设的设计目标；两臂同一引擎，本实验的 token 结论不构成对本预设的否定。

完整实验记录见 [dsh-anchored-ab-kit](https://github.com/SeptTpes/dsh-anchored-ab-kit) 的 results/。

## 血缘与致谢

- **引擎（缓存压缩）**：来自用户自己的 code-cache 项目 [SeptTpes/dsh-cache-aware-compaction](https://github.com/SeptTpes/dsh-cache-aware-compaction)（M3 验证：冷缓存省 62% 压缩调用输入）。
- **首轮锚定机制**：移植自 [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)（社区项目，非官方）——其机制发现：DeepSeek V4 系列对 API 可见工具目录强条件化，Minimal 首轮轨迹分数更高，故首轮锚定 Minimal、随后晋升全工具。本预设按其 tool-bootstrap 设计实现（promoteOn: either / 首轮抑制注入 / compaction 回落）。实现差异：晋升目标为 code-cache 预设（而非原项目的 Standard 目录）。

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
