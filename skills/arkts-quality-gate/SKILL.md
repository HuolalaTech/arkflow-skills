---
name: arkts-quality-gate
description: >-
  ArkTS quality gate: phase-a (CodeLinter), phase-b (assembleApp), and a unified
  interactive fixLoop scheduled per quality_mode. Use after codegen, before commit,
  or for bounded ArkTS validation/repair.
---

# ArkTS 统一质量门禁（arkts-quality-gate）

> 本入口仅承载**总览、契约与跨阶段规则**。各阶段细则与公共 fixLoop 拆分到 `references/`：
>
> - phase-a（CodeLinter / LSP）→ [`references/lsp-phase-a.md`](./references/lsp-phase-a.md)
> - phase-b（构建 / assembleApp）→ [`references/build-phase-b.md`](./references/build-phase-b.md)
> - 公共修复闭环（逐条交互）→ [`references/fix-loop.md`](./references/fix-loop.md)

## Instructions

### 0. 环境前置（首次使用检查清单）

| 工具 | 默认路径 / 验证方式 | 缺失时 |
|------|-------------------|--------|
| DevEco Studio | `/Applications/DevEco-Studio.app` | 安装后重试；不可用则所有阶段均 `need_manual` |
| hvigorw（内置，优先） | `/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw` | 回退到 command-line-tools 的 hvigorw |
| CodeLinter Runner（内置，优先） | `/Applications/DevEco-Studio.app/Contents/plugins/codelinter/run/index.js` | 命中即直接执行 phase-a；未命中再走 [`lsp-phase-a.md` §1 前置问询](./references/lsp-phase-a.md) fallback 交互 |
| Node.js（编排器/合并/汇总脚本） | `node --version`，要求 ≥ 16 | 安装 Node.js 后重试 phase-a |
| json5 模块 | DevEco SDK 内置；合并脚本自检并报错 | 按脚本错误提示设置 `OHOS_BASE_SDK_HOME` 或 `JSON5_MODULE_PATH` |

**macOS 常用环境变量（DevEco Studio 标准安装）**：

```bash
export JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"
export DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk"
export OHOS_BASE_SDK_HOME="${DEVECO_SDK_HOME}/default/openharmony"
```

若 DevEco Studio 不在默认路径，需在执行前手动覆盖上述变量。环境变量缺失导致的失败判定为**环境阻断**，不做代码盲修（见 [`fix-loop.md` §6 可修复范围](./references/fix-loop.md)）。

### 1. 何时应用本技能

- 「ArkTS 质量校验 / 门禁 / 复检 / 自动修复闭环」「提交前验证」「批量改动体检」「生成后收敛」。
- 输出：**phase-a（CodeLinter）+ phase-b（构建）+ fixLoop（逐条交互修复）** 的结构化结果。

**非本技能**：仅规范解读 → `arkts-style-core`；仅生码 → `arkts-code-gen`。

### 2. 定位与边界

- **定位**：单入口编排 phase-a / phase-b / 公共 fixLoop。
- **做**：检查、聚合错误、有限轮次逐条交互修复、`pass`/`fail`/`need_manual`。
- **不做**：替代需求澄清或大重构；修复限于可证实、可回归范围。

### 2.1 交接与澄清

- 交接字段（`scope`、`quality_mode`、`upstream_context`）用于 **skill 间传递**，非用户必填表单；可由上游填入或本技能归纳。
- 关键歧义（范围、模式、修复边界）→ 按「内置 runner 探测 → 必要时 fallback 问询（[`lsp-phase-a.md` §1 前置问询](./references/lsp-phase-a.md)）」补齐，补齐前不调 hvigor/CodeLinter。
- **`full`/`lsp-only` 的 phase-a 路径决策**：先探测内置 runner；未命中时再按 [`lsp-phase-a.md` §1 前置问询](./references/lsp-phase-a.md) 获取 `command-line-tools` 路径或跳过。
- 非阻断信息不全 → 可在输出 `unresolved_issues`/`next_actions` 标记后继续。

### 3. 门禁模式

| mode | 行为 |
|------|------|
| `lsp-only` | 以 phase-a 为主；先尝试内置 `run/index.js`，仅在内置 runner 不可用时进入 fallback 交互；当 `summary_errors > 0` 或 `summary_has_structured_error=true` 时进入 fixLoop（source=lsp）逐条处理；**仅当用户显式选择跳过** 才可 `checks.lsp.skipped=true` |
| `build-only` | 仅 phase-b；构建失败时进入 fixLoop（source=build）；**不**做 phase-a 前置问询。**默认自动闭环**：当用户只说「build-only / 仅运行 build 模式」时，除非显式声明「仅校验不修复」或 `interaction_mode=manual-only`，否则必须继续执行 fixLoop(build) |
| `full`（默认，**就近修复**） | phase-a → fixLoop(lsp) → phase-b → fixLoop(build) |

> 各模式下 fixLoop 的调度顺序、决策树、平台差异、pre/post 双快照见 [`fix-loop.md`](./references/fix-loop.md)。

### 4. 阶段编排（一句话纲要）

| 阶段 | 何时跑 | 细则 |
|------|--------|------|
| phase-a | `quality_mode ∈ {full, lsp-only}` 且未跳过 | [`lsp-phase-a.md`](./references/lsp-phase-a.md) |
| phase-b | `quality_mode ∈ {full, build-only}` 或 fixLoop(lsp) 之后 | [`build-phase-b.md`](./references/build-phase-b.md) |
| fixLoop | 任一阶段返回 `errors > 0` / 构建失败 | [`fix-loop.md`](./references/fix-loop.md) |

### 5. 与上游技能衔接

`arkts-style-core` → `arkts-code-gen` → 本技能。交接：`Must/Should`、变更清单、`scope`、待确认项 → `checks.*`/`fix.report`/`decision`。与 [extra-arkts-conventions](../arkts-style-core/references/extra-arkts-conventions.template.md) 冲突时以**工程与构建结果**为准并标注。

### 6. 输入契约

- `scope`、`quality_mode`、`upstream_context`（可选）。
- `command_line_tools_home`：仅在 phase-a 走 fallback（`runner_source=command-line-tools`）时必填；优先分支命中内置 runner 时可为空。

#### 6.1 字段行为定义

| 字段 | 默认值 | 行为 |
|------|--------|------|
| `quality_mode` | `full` | 取值 `full` / `lsp-only` / `build-only`，决定 fixLoop 调度顺序（见 §3） |
| `interaction_mode` | `interactive` | 取值 `interactive` / `auto` / `manual-only`；`manual-only`：不修，直接 `decision=fail` 并把全部 errors 写入 `unresolved_issues` |
| `interaction_scope` | `errors-only` | fixLoop 队列只取 `severity=error`；`errors+warnings` / `all` 扩展队列范围。**不影响最终全量统计**（warning / suggestion 始终在 `post_fix` 中按全量呈现） |
| `max_rounds_per_issue` | `2` | 单条 issue 允许的「修复-复检」最大轮次；超出强制人工介入 |
| `stop_on_high_risk` | `true` | `true`：fixLoop 中遇到首个低信心 issue 立即中止整个闭环 → `decision=need_manual`；`false`：跳过该条记入 `unresolved_issues`，继续后续条目 |

> 完整决策表与 fixLoop 行为见 [`fix-loop.md`](./references/fix-loop.md)。

### 7. 输出模板（必须结构化）

```markdown
## Gate Summary
- mode:
- phase_a_preflight_askquestion_done: true | false（仅 fallback 分支需 true；命中内置 runner 时可 false；build-only 可 n/a）
- decision: pass | fail | need_manual
- rounds_used:                       # = sum(fix.report.interactions[].rounds)，未触发 fixLoop 时填 0

## checks.lsp
- skipped:
- runner_source: deveco-runjs | command-line-tools
- runner_path:
- artifacts_policy: none | relocate_and_cleanup
- artifacts_relocated_to:            # `command-line-tools` 分支可选；本轮 `build/codelinter-linter-result/archive-<TS>`，TS 由 `date +%Y%m%d-%H%M%S` 生成
- report_json: build/codelinter-report.json（固定名）
- report_json_archived:              # `command-line-tools` 分支必填
- merged_config_path: build/codelinter-merged-config.json
- pre_fix:                           # phase-a 第一次跑完的快照
    errors:
    warnings:
    suggestions:
    top_rules: [rule:count, …]
    top_issues: [file:line:rule|severity|message, …]
- post_fix:                          # fixLoop 收敛后最后一次复检；未触发 fixLoop 时与 pre_fix 一致；warnings/suggestions 字段必填且为全量
    errors:
    warnings:
    suggestions:
    top_rules:
    top_issues:

## checks.build
- success:
- build_tool_source: deveco | command-line-tools
- build_tool_path:
- pre_fix:
    failures: [file:line|message, …]
- post_fix:
    failures:                        # 收敛后残余的构建失败；success=true 时为空

## fix.report                        # 仅 fixLoop 至少触发一次时存在
- source: lsp | build
- targeted: errors-only | errors+warnings | all
- interaction_mode: interactive | auto | manual-only
- max_rounds_per_issue:
- interactions:
    - issue_1: file:line:rule -> action: accepted_ai|user_fixed|skipped|aborted -> rounds: n -> result: resolved|residual
    - issue_2: ...
- residual_errors:                   # 未消化的 error
- new_issues_introduced:             # 修复过程中新引入的 issue（任意 severity，按各自 severity 计入 post_fix）

## unresolved_issues
## next_actions
```

### 8. 执行顺序与环境

**顺序（单次门禁主线）**

1. 读取 `quality_mode`、`interaction_mode`、`interaction_scope`。若 `quality_mode ∈ {full, lsp-only}`：先探测内置 runner（`run/index.js`）；命中则直接进入 phase-a，未命中才进入 [`lsp-phase-a.md` §1 前置问询](./references/lsp-phase-a.md)。`build-only` → 跳过 phase-a 前置问询。
2. 上游 `upstream_context`（**不可替代**前置问询）。
3. **环境**（构建前）：优先固定路径（macOS+DevEco）

   ```text
   JAVA_HOME=/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home
   DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk
   OHOS_BASE_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony
   ```

   校验：`$JAVA_HOME/bin/java`、`$OHOS_BASE_SDK_HOME/toolchains/oh-uni-package.json`。失效时再探测并记录命中路径。
4. phase-a（未跳过）：按 [`lsp-phase-a.md`](./references/lsp-phase-a.md) 生成合并配置 → 运行 CodeLinter → 记录 `pre_fix` 快照。若 `runner_source=command-line-tools`，执行产物迁移与报告归档。
5. fixLoop(lsp)：若 phase-a 报 `summary_errors > 0` **或** `summary_has_structured_error=true` 且 `interaction_mode != manual-only`，按 [`fix-loop.md`](./references/fix-loop.md) 进入逐条交互；收敛后复跑 phase-a，写入 `post_fix` 快照。
6. phase-b（若 `quality_mode ∈ {full, build-only}`）：按 [`build-phase-b.md`](./references/build-phase-b.md) 解析 `hvigorw` 后执行 `assembleApp`，写入 `build_tool_source`/`build_tool_path` 与 `pre_fix.failures`。
7. fixLoop(build)：构建失败 → 进入 fixLoop（source=build）→ 收敛后复跑 `assembleApp`，写入 `post_fix.failures`。`build-only` 下该步骤为默认必走（除非用户显式声明仅校验不修复，或 `interaction_mode=manual-only`）。
8. 输出结构化报告（[`§7`](#7-输出模板必须结构化)）。

环境阻断（缺 Java/SDK）→ 判环境问题，勿当代码盲修。

### 9. 风险控制

**phase-a / fallback 路径**

- 违反 [`lsp-phase-a.md` §1 前置问询](./references/lsp-phase-a.md)（在 fallback 分支未问询、无路径却扫盘、未执行却跑 phase-a）→ 流程违规，须补问询或中止。
- 路径校验失败却未二次交互确认、或未获用户显式同意就标记 `checks.lsp.skipped=true` → 流程违规，须回退到前置问询重走。
- phase-a 未先生成合并配置、或 CodeLinter 未使用 `-c build/codelinter-merged-config.json` → 流程违规，须重跑 phase-a。
- `command-line-tools` 分支未将 `build/codelinter-report.json` 归档到本轮 `archive-${TS}/codelinter-report.json`、或遗漏 `report_json_archived` → 流程违规，须补迁移与补报告。
- fallback 分支中，**`rm -rf` 仅限** `${command_line_tools_home}/codelinter/linter/result`，禁止扩大到整个 `command-line-tools`。

**fixLoop / 全量统计**

- `lsp-only` / `full` 模式下检测到 `summary_errors > 0` 或 `summary_has_structured_error=true` 却跳过 fixLoop 直接输出 `decision=fail/pass` → 流程违规；除 `interaction_mode=manual-only` 外，**必须**走交互闭环。
- `build-only` / `full` 模式下 `assembleApp` 构建失败却未触发 fixLoop(build)（仅返回失败日志即结束）→ 流程违规；除用户显式声明「仅校验不修复」或 `interaction_mode=manual-only` 外，**必须**进入闭环。
- fixLoop 中未经 `AskQuestion` 直接修改源码（即便是「明显的小修复」）→ 流程违规，须撤回改动并补问询。
- 多条 issue 并行处理或乱序处理（违反 [`fix-loop.md` §5 决策路径](./references/fix-loop.md) 串行约束）→ 流程违规。
- 任何实现禁止从最终输出中省略 `warnings` / `suggestions` 计数及 `top_issues`；即便它们未进入 fixLoop 队列，仍须以 `post_fix` 快照形式呈现。
- 当 fixLoop 引入新的 warning / suggestion 时，必须在 `fix.report.new_issues_introduced` 列明，并按各自 severity 计入 `post_fix` 总数。

**修复边界**

- `max_rounds_per_issue` 上限；勿无证据猜 API/权限；单条修复最小化。
- 涉及业务参数选型（如 `LazyForEach.cachedCount`）一律低信心，禁止自动改动；见 [`fix-loop.md` §6 可修复范围](./references/fix-loop.md)。

---

## Examples

1. **full 闭环（命中内置 runner，就近修复）**：探测命中 `run/index.js` → 环境就绪 → 生成 `build/codelinter-merged-config.json` → phase-a（`pre_fix.errors=2`）→ fixLoop(lsp) 逐条交互修复（高信心 → AI 改 + 复检）→ `post_fix.errors=0` → `assembleApp` 一次通过 → `decision=pass`；`phase_a_preflight_askquestion_done=false`；`fix.report.source=lsp`。
2. **full 闭环（fallback）**：内置 runner 不可用 → fallback 问询并取得有效路径 → phase-a（报告 `build/codelinter-report.json`）+ 迁移至 `archive-${TS}/`（`TS="$(date +%Y%m%d-%H%M%S)"`）并复制 `codelinter-report.json` 到该目录 → fixLoop(lsp) 收敛 → `assembleApp` → `decision=pass`；`phase_a_preflight_askquestion_done=true`。
3. **lsp-only 交互式修复**：先探测内置 runner；命中则直接 CodeLinter；`pre_fix.errors=2` → fixLoop(lsp) 逐条 `AskQuestion`（高信心 → 接受 AI 改 + 复检；低信心 → 用户人工修复后回 `请复检`）→ `post_fix.errors=0` → `decision=pass`；`checks.lsp.post_fix.warnings/suggestions` 仍为全量。
4. **build-only**：跳过 phase-a 前置问询；环境就绪 → `assembleApp` 失败 → fixLoop(build) 逐条交互 → 收敛 → 复跑 `assembleApp`。
5. **fallback 路径两次无效后跳过**：fallback 问询（候选路径）→ 用户粘贴路径 → 校验失败（目录不存在）→ 再次问询 → 用户选「跳过 phase-a」→ `checks.lsp.skipped=true` → 继续 phase-b；`phase_a_preflight_askquestion_done=true`。
6. **fixLoop 单条超限**：phase-a 报 `summary_errors=1` → fixLoop(lsp) 第 1 轮接受 AI 改动 → 复检触发新规则；第 2 轮再改仍触发别的规则 → 自动判低信心 → 仅人工选项 → 用户中止 → `decision=need_manual`；`fix.report.interactions: rounds=2, result=residual`；`unresolved_issues` 列原 issue 与两次新引入 issue。
7. **环境阻断**：`JAVA_HOME` 下 `java` 不可执行 → 判定环境问题；`decision=need_manual`；`next_actions` 提示修复环境变量，**不做任何代码修改**。
8. **`interaction_mode=manual-only`**：phase-a 报 `summary_errors=3` → 不进入 fixLoop → `decision=fail`；全部 errors 写入 `unresolved_issues`；`checks.lsp.post_fix` 与 `pre_fix` 一致（含全量 warning/suggestion）。
