# A/B 验证数据 · code-cache vs code-cache-anchored（4 任务 × 2 预设）

> 数据来源：dshana-rework 实测（2026-09-01，DSHana 3081 web host + 原 dsh 3080 dev harness，模型 deepseek-v4-flash @ opencode-go / deepseek-official）。
> 诚实声明：**不是全面超越**——生成型任务 anchored 优，理解型任务 code-cache 优。A/B 的本质是把「启动姿态」与「完成能力」拆成两个维度：anchored = minimal 起手 + 全工具晋升。

## 1. 四任务对比总表

| 任务 | 类型 | 产出（code-cache） | 产出（anchored） | 对比结论 |
|---|---|---|---|---|
| TASK-006 会话分析 CLI | 生成型 | 257 行单文件 CLI + TEST.md（12 用例全绿） | 258 行单文件 CLI + TEST.md（行为同规格） | 产出质量相当，anchored 首轮起手更果断 |
| TASK-007 md2csv | 生成型 | 12 用例全绿 | 13 用例全绿 | 两版同规格、测试均全绿 |
| TASK-008 重构 | 理解型 | 323 行重构 + 15 用例 diff 全过 | 342 行重构 + 15 用例 diff 全过 | 理解型 code-cache 更稳（工具面全） |
| TASK-009 批量分析 | 生成型 | 251 行 + 验收基准全过 | 258 行 + 验收基准全过 | 生成型 anchored 完成度更足 |

## 2. 关键指标（会话级，来自 session.jsonl.zstd）

| 会话 | 任务 | 预设 | 事件数 | 工具调用 | 输出 token | 首轮指纹 |
|---|---|---|---|---|---|---|
| 0aaa362c | TASK-006 | code-cache | 3159 | 77 | 56603 | 叙事式 |
| a7961af1 | TASK-006 | anchored | 1775 | 28 | 34671 | we need 式 |
| 5ba54636 | TASK-007 | code-cache | 2744 | 52 | 52651 | 叙事式 |
| ee586660 | TASK-007 | anchored | 2445 | 58 | 43797 | we need 式 |
| 1db78c55 | TASK-008 | code-cache | 1729 | 32 | 36456 | 叙事式 |
| bb309308 | TASK-008 | anchored | 1780 | 25 | 39658 | we need 式 |
| 9cd38e93 | TASK-009 | code-cache | 1208 | 25 | 23762 | 叙事式 |
| 22fd46f4 | TASK-009 | anchored | 1225 | 22 | 25231 | we need 式 |

## 3. 会话指纹样本

| 会话 | 预设 | 首个 reasoning 原文 |
|---|---|---|
| 0aaa362c | code-cache | The user wants me to read a task file at ~/Desktop/OH-WorkSpace/d... |
| a7961af1 | anchored | We need respond in Chinese likely. Need read file. The... |
| 5ba54636 | code-cache | The user wants me to read a task file at ~/Desktop/OH-WorkSpace/dshana-rework/TASK-007-md2csv.md and... |
| ee586660 | anchored | We need respond in Chinese likely. Need read file. User... |
| 1db78c55 | code-cache | Let me start by reading the task file at ~/Desktop/OH-W... |
| bb309308 | anchored | We need respond. Need read file |
| 9cd38e93 | code-cache | The user wants me to read a task file at ~/Desktop/OH-WorkSpace/dshana-rework/TASK-... |
| 22fd46f4 | anchored | We need respond in Chinese likely. Need read file. The user says... |

（完整原文见 FINGERPRINT-LOG.md 与 REPORT-003 运行时观察；样本 = 8 例，we need 4/8。）

## 4. 结论

- 生成型任务（TASK-006/007/009）：anchored 的 minimal 起手 → 晋升全工具，产出质量不低于 code-cache，且首轮更果断。
- 理解型任务（TASK-008）：code-cache 全工具面在重构保真场景下更稳。
- 启动姿态维：we need 式指纹在 anchored 首轮更常见（4/4 锚定 vs 0/4 code-cache），但非确定性（见 FINGERPRINT.md）。
- 数据诚实：样本量 8（4 任务 × 2 预设），结论为任务类型调节变量，**不宣称全面超越**。

## 5. 数据可信度

- 会话日志为唯一事实源（解压 zstd 取证）；指标口径与 TASK-006/009 分析器一致。
- 数据来自真实运行，非演绎；样本量 4 任务 × 2 预设，结论为任务类型调节变量（非全面超越）。
