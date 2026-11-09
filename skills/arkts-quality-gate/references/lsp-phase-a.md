# phase-a（CodeLinter / LSP）

> 本文档由 [`SKILL.md`](../SKILL.md) §3、§4 引用，描述 phase-a 的前置问询、运行链路、产物迁移与 stdout 协议。修复闭环不在本文档定义，参见 [`fix-loop.md`](./fix-loop.md)。

## 1. 前置问询（**强制执行**）

**触发**：`quality_mode` ∈ {`full`,`lsp-only`} 且 **DevEco/EcoDev 内置 runner 不可用**。
**豁免**：`build-only`，或已命中内置 runner。

**目的**：在内置 runner 缺失时，禁止静默跳过、禁止无路径臆测；禁止「只答使用 CodeLinter」后以扫盘代替第二次路径交互。

### 1.1 Cursor 用户（推荐）

使用 `AskQuestion` 工具，**单次选项即终态**——含「跳过 phase-a」「CodeLinter + 下条消息粘贴绝对路径」「CodeLinter + 候选路径（1～3 个选项）」。选「粘贴路径」则**下一用户消息必须为路径**，其间**禁止**扫盘。

若只能二选一「是否用 CodeLinter」：选「用」后须**立刻**第二次 `AskQuestion`（候选路径 +「其他：下条消息粘贴」）或阻塞提示：下条消息只回复路径；**收到路径前**不跑 CodeLinter/hvigor。

### 1.2 Claude Code / 其他平台

输出以下格式文本后**停止，等待用户回复**，收到回复前禁止执行任何 phase：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ArkFlow 门禁] 请选择 CodeLinter 方式（回复序号或绝对路径）：

  1. 跳过 phase-a，直接执行构建
  2. 使用 CodeLinter — 请在下一条消息中粘贴 command-line-tools 的绝对路径
  3. 使用 CodeLinter — 候选路径（如适用）：
     a) /Applications/command-line-tools
     b) ~/Library/command-line-tools
     （回复 3a / 3b，或直接粘贴你的绝对路径）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1.3 路径校验

- **硬性禁止**：在 fallback 分支中，未取得用户给出的 **`command-line-tools` 根目录绝对路径**（选项或正文）前，禁止 `find`/`mdfind`/大范围递归搜索、禁止拼默认路径。**例外**：用户明确要求「帮我探测」时，可有限只读探测并在报告中声明。
- **路径就绪（fallback 分支）**：校验目录存在且 `${command_line_tools_home}/codelinter/bin/codelinter` 可执行。
- **内置 runner 就绪（优先分支）**：固定校验 `/Applications/DevEco-Studio.app/Contents/plugins/codelinter/run/index.js`；该 runner 为 JS 入口文件，必须使用 `node /Applications/.../run/index.js` 调用；路径可用即进入 phase-a，且不触发 fallback 问询。

### 1.4 决策速查表

| 场景 | 操作 |
|------|------|
| 命中内置 runner（`run/index.js`） | 直接进入 phase-a，`checks.lsp.runner_source=deveco-runjs` |
| 用户提供了有效绝对路径 | 校验通过 → 直接进入 phase-a |
| 用户选择候选路径（1～3 个） | 校验 → 有效则进 phase-a，无效则**再次问询** |
| 用户选择「下一条消息粘贴路径」 | 阻塞；收到路径后校验；校验前**不得**执行任何 phase |
| 用户显式选择跳过 phase-a | `checks.lsp.skipped=true` → 继续 phase-b |
| 路径校验失败（目录不存在/codelinter 不可执行） | **必须再次问询**；不得自动降级或继续 |
| `build-only` 模式 | 跳过本节全部流程，直接进入 phase-b |

### 1.5 路径无效处理（强制）

- 若目录不存在、`codelinter/bin/codelinter` 缺失/不可执行、或路径格式不合法：必须**立即再次问询**要求用户重新确认路径。
- 在用户给出新路径并通过校验前：fallback 分支下**不得**执行 phase-a、**不得**自动降级为 `skipped`、**不得**继续 phase-b（`build-only` 模式除外）。
- 仅当用户在交互中**显式选择**「跳过 phase-a / 改为 build-only」时，才允许设置 `checks.lsp.skipped=true`。

## 2. 运行链路

- 跳过则 `checks.lsp.skipped=true`，构建仍可报 ArkTS 错误。
- **启用（双实现）**：
  - **优先分支（deveco-runjs）**：命中内置 `run/index.js` 后直接执行。
  - **fallback 分支（command-line-tools）**：仅在内置 runner 不可用时，按 §1 取得有效 `command_line_tools_home` 后执行。
- 两分支都必须先执行 **CodeLinter 配置合并**（§3），并保证输出报告为固定路径 `build/codelinter-report.json`。
- **勿用** hvigor 内部任务名作 phase-a CLI（如 `:entry:default@PreviewArkTS`/`:entry:default@CompileArkTS`）；多数环境 `hvigor tasks` 不可单独调用 → task not found。
- 输出：`checks.lsp.*`；记录 `runner_source` 与 `runner_path`；error/warning/suggestion **三档计数全量保留**（见 §6）。

## 3. CodeLinter 配置合并（强制）

由 `scripts/phase-a-orchestrator.js` 内部完成：

- **内置基线配置**：`${SKILL_DIR}/src/baseline-code-linter.json5`
- **项目配置（可选）**：`${PROJECT_ROOT}/code-linter.json5`（存在则参与合并，不存在则仅使用基线）
- **合并产物（固定路径）**：`${PROJECT_ROOT}/build/codelinter-merged-config.json`
- **合并算法**：`${SKILL_DIR}/scripts/codelinter-merge-config-cli.js` 的 `runMerge()`，由编排器 in-process 调用
- **执行要求**：CodeLinter runner 必须使用 `-c ${PROJECT_ROOT}/build/codelinter-merged-config.json`；禁止直接把 `-c` 指向基线或项目原文件。

**合并优先级（baseline ← project）**

- `files` / `ignore` / `ruleSet`：并集去重（保序，先 baseline 后 project）
- `rules`：对象合并，冲突键以 project 覆盖 baseline
- 其它顶层键：project 覆盖 baseline

## 4. 推荐入口

```bash
node "${SKILL_DIR}/scripts/phase-a-orchestrator.js" \
  --project-root "${PROJECT_ROOT}" \
  --scan-path "${PROJECT_ROOT}/entry/src/main/ets" \
  [--command-line-tools-home "${command_line_tools_home}"]
```

- **前置条件**：运行环境可执行 `node`；若缺少 Node.js 或 `json5` 依赖，合并步骤会主动报错并退出，按错误提示修复后重试。

## 5. 脚本职责分层

- `scripts/phase-a-orchestrator.js`：phase-a 唯一编排入口（解析参数 → 合并配置 → 运行 CodeLinter → 汇总报告 → 按需迁移产物 → 输出统一 `key=value` 协议）。
  - 内部 in-process 复用 `codelinter-merge-config-cli.js` 与 `summarize-codelinter-report.js` 的导出函数，避免「子脚本 stdout → key=value 解析」的字符串往返。
  - 通过 `bash` 调用 `phase-a-relocate-artifacts.sh`（fallback 分支文件搬运/清理仍由 shell 负责，跨平台时再做替换）。
  - 错误以 `class PhaseAError { code }` 结构化抛出，`process.exit(code)` 使用本节定义的退出码段位。
- `scripts/codelinter-merge-config-cli.js`：CodeLinter 配置合并；既可作为 CLI（`node codelinter-merge-config-cli.js …`），也通过 `runMerge()` 被编排器 in-process 调用。
- `scripts/summarize-codelinter-report.js`：读取 `build/codelinter-report.json`，导出 `summarizeReportFile()` 与 `formatSummaryStdout()`；CLI 与编排器共用同一份算法，输出 `summary_*` 键值与 `summary_stats_json`。**统计始终包含 error / warning / suggestion 三档全量**，fixLoop 是否触发不影响该模块输出。
- `scripts/phase-a-relocate-artifacts.sh`：仅处理 fallback 分支的产物迁移与清理（`cp -a` / `rm -rf`），保持 shell 实现。

## 6. `phase-a-orchestrator.js` 输出字段（stdout key=value）

- `runner_source=deveco-runjs | command-line-tools`
- `runner_path=<实际命中路径>`
- `merged_config_path=build/codelinter-merged-config.json`
- `report_json=build/codelinter-report.json`
- **汇总（由 `summarize-codelinter-report.js` 产出，紧邻上述字段之后输出）**
  - `summary_errors=` / `summary_warnings=` / `summary_suggestions=`：按 `severity` 聚合（`warn`/`warning` 计入 warnings，`suggestion`/`info` 计入 suggestions）
  - `summary_issues_total=`：消息条数总和；`summary_files_with_issues=`：至少含一条消息的文件数
  - `summary_has_structured_error=true|false`：双保险布尔值（`summary_errors>0` 或 `summary_stats_json.topIssues` 中存在 `severity=error`）
  - `summary_top_rule_1=` … `summary_top_rule_5=`（按需）：`<rule>:<count>`，按出现次数降序，最多 5 条；**不区分严重级别**
  - `summary_top_issue_1=` … `summary_top_issue_5=`（按需）：`<rel-path>:<line>:<col>|<severity>|<rule>|<message>`（消息内 `|` 已转义为 `\|`，`\` 为 `\\`）；按 `error → warn → suggestion` 排序，**三档均参与**
  - `summary_stats_json=<单行 JSON>`：完整结构化快照（含 `byRule`、`topRules`、`topIssues`）；解析时请仅在首个 `=` 处切分键值，避免 JSON 内 `=` 干扰简易分割器
- `fixloop_trigger_reason=structured_error|none`：触发原因枚举，便于日志与调试
- `artifacts_policy=none | relocate_and_cleanup`
- `artifacts_relocated_to=build/codelinter-linter-result/archive-<TS>`（仅 fallback 分支）
- `report_json_archived=build/codelinter-linter-result/archive-<TS>/codelinter-report.json`（仅 fallback 分支）

## 7. 退出码

- `41`：参数或前置文件校验失败
- `42`：合并配置失败
- `43`：runner 执行失败
- `44`：产物迁移/清理失败
- `45`：报告汇总失败（报告缺失、非 JSON、根类型非数组等）

## 8. 产物迁移（仅 fallback 分支必做）

- **适用范围**：`checks.lsp.runner_source=command-line-tools`
- **源**：`${command_line_tools_home}/codelinter/linter/result`
- **目标目录形态（相对项目根）**：`build/codelinter-linter-result/archive-<时间串>/`，其中 `<时间串>` **必须**按下方 **format** 由**当前执行迁移步骤时**的本机本地时间生成；每轮门禁生成新的 `archive-*`，保留历史。
- **format（固定）**：`yyyyMMdd-HHmmss`
  - **语义**：4 位年 + 2 位月 + 2 位日，`-`，2 位时（24 小时）+ 2 位分 + 2 位秒。
  - **Shell 生成（macOS / Linux，迁移前当场执行，禁止猜写）**：
    `TS="$(date +%Y%m%d-%H%M%S)"`
    展开示例：`20260428-133824`（仅说明格式；**目录名必须用本轮命令实际输出**）。
  - **禁止**：把仅为格式说明的文字当作目录名字面量；禁止套用文档或对话中的示例时间串；禁止用上一轮门禁的旧 `TS` 代替本次迁移执行时刻新生成的值。
- **落地结构**：将源目录复制为 `build/codelinter-linter-result/archive-${TS}`（`${TS}` 为上述 `date` 展开值）。
- **报告归档（强制）**：将 `build/codelinter-report.json` 额外复制到 `build/codelinter-linter-result/archive-${TS}/codelinter-report.json`。
- **推荐脚本**：由 `scripts/phase-a-relocate-artifacts.sh` 统一执行，避免手工复制命令导致误删风险。

- **顺序**：若未用上一段脚本，仍需遵循：**先** `cp -a` 到目标 **`archive-${TS}`** → **仅** `rm -rf` 源 `result`；勿删 `codelinter` 其余路径。
- **结构化报告**：`artifacts_relocated_to` 填**本轮实际目录**的相对路径，例如 `build/codelinter-linter-result/archive-20260428-133824`（其中的时间串须与当次 `TS` 一致）。
- **结构化报告**：`report_json_archived` 填 archive 内副本相对路径，例如 `build/codelinter-linter-result/archive-20260428-133824/codelinter-report.json`。
- **优先分支（deveco-runjs）**：中间产物无需额外迁移或清理；`artifacts_relocated_to` / `report_json_archived` 可置空，或将 `artifacts_policy` 标记为 `none`。

## 9. 与 fixLoop 的衔接

phase-a 完成后，由编排器（agent 端）按 `quality_mode` 与 [`fix-loop.md`](./fix-loop.md) 的调度策略决定是否进入 fixLoop：

- `lsp-only`：phase-a 报 `summary_errors > 0` **或** `summary_has_structured_error=true` → 进入 fixLoop（source=lsp）。
- `full`：phase-a 报 `summary_errors > 0` **或** `summary_has_structured_error=true` → 进入 fixLoop（source=lsp，**就近修复**）→ 再 phase-b。
- 不论是否进入 fixLoop，phase-a 第一次跑完的 `summary_*` 须作为 `pre_fix` 快照保留，最终 Gate Summary 的 `post_fix` 由 fixLoop 收敛后的最后一次 phase-a 复检产出（见 [`fix-loop.md` §4 pre/post 双快照](./fix-loop.md)）。
