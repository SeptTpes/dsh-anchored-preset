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

## 验证数据（诚实声明：2026-09-03 A/B repeats 3 实测，效率主张未获支持）

**A/B 正式实验（36 run，2026-09-02/03，command-code/deepseek-v4-flash，协议预注册判定）：**

- **H1（生成型 token 效率）不成立**：token 中位降幅 -10.5%（< 15% 阈值），方向混合（3 省 3 不省），无稳定效率优势。
- **H2（理解型不劣）不成立**：008b token 恶化超上限（-25.6%）。
- **通过率全绿**：两臂全部任务验收通过（100%），anchored 不劣于 code-cache。
- **指纹分化真实但与结果无关**：36/36 run 中 anchored 首轮均为 we need 式、code-cache 均为叙事式——风格签名真实存在（预设机制生效），但不转化为 token 收益。

早期 v0.1 观察（2026-09-01，docs/AB-RESULT.md，每格单 run）曾提示生成型 anchored 更省，
但 n=1 样本不足以支持该结论（protocol 预注册时已注明）；36 run 正式数据未复现。
预设保留为个人偏好项（启动风格选择），不宣称效率优势。完整实验报告见
[dsh-anchored-ab-kit](https://github.com/SeptTpes/dsh-anchored-ab-kit) 的 results/。

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
