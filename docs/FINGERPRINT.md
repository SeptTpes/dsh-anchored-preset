# FINGERPRINT.md · 指纹统计（we need 规律：任务重量驱动）

> 采集法：每次 code-cache-anchored 会话创建后，解压 session.jsonl.zstd，取首个 reasoning-chunks 块文本。
> 判定标准：以「We need / We will」开头的复数直接行动式 = we need 式；其余 = 叙事式。
> 说明：本文档与 dshana-rework/impl-presets 的 FINGERPRINT-LOG.md 同源；此处收录 A/B 四任务的 8 例对照样本。

## 1. A/B 四任务指纹对照（8 例）

| 会话 | 任务 | 预设 | 首块原文开头 | 风格 |
|---|---|---|---|---|
| 0aaa362c | TASK-006 会话分析 CLI | code-cache | The user wants me to read a task file at ... | 叙事式 |
| a7961af1 | TASK-006 | anchored | We need respond in Chinese likely. Need read file. ... | we need 式 |
| 5ba54636 | TASK-007 md2csv | code-cache | The user wants me to read a task file ... | 叙事式 |
| ee586660 | TASK-007 | anchored | We need respond in Chinese likely. Need read file. User... | we need 式 |
| 1db78c55 | TASK-008 重构 | code-cache | Let me start by reading the task file ... | 叙事式 |
| bb309308 | TASK-008 | anchored | We need respond. Need read file | we need 式 |
| 9cd38e93 | TASK-009 批量分析 | code-cache | The user wants me to read a task file ... | 叙事式 |
| 22fd46f4 | TASK-009 | anchored | We need respond in Chinese likely. Need read file. The user says... | we need 式 |

## 2. 统计

- 样本：8 例（4 任务 × 2 预设，全部中文指令、英文思考）
- anchored：we need 式 **4/4**；code-cache：we need 式 **0/4**
- 合计：we need 4/8 ≈ 50%

## 3. 规律观察（任务重量驱动）

- **任务重量与指纹**：A/B 四任务均为同重量级工程任务（读任务书 → 写代码 → 落盘），anchored 首轮一律 we need 式果断起手；对照组 code-cache 首轮恒为「explore/read first」探索式（工具面全，无 minimal 面）。
- **轻任务例外**：FINGERPRINT-LOG 的 6 例中，轻任务（200 字概述）多为叙事式，中任务多为 we need 式——初步观察：任务越重，we need 式越可能；样本不足，待扩充。
- **非确定性**：we need 不是 anchored 的必然指纹（FINGERPRINT-LOG #1/#2/#4 叙事式），但同任务同重量下 anchored 的 we need 比例显著高于 code-cache。

## 4. 口径与局限

- 判定只取首个 reasoning-chunks 块文本开头；不同模型/中继路由（deepseek-v4-flash @ opencode-go vs deepseek-official）指纹分布可能有差异，本表不跨模型对照。
- 数据诚实：8 例为真实运行样本，不是全面超越的证明；we need 规律为「任务重量驱动」的初步观察，待扩样。
