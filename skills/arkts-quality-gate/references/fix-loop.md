# fixLoop：公共修复闭环

> 本文档由 [`SKILL.md`](../SKILL.md) §3、§4 引用，定义统一的「逐条交互式修复闭环」。phase-a 细则见 [`lsp-phase-a.md`](./lsp-phase-a.md)；phase-b 细则见 [`build-phase-b.md`](./build-phase-b.md)。
>
> **核心思想**：fixLoop 是一个**算法**，不是一个独立阶段。同一份算法在 `lsp-only` / `build-only` / `full` 三种模式下被调度到不同位置，对错误来源（lint / build）保持无感。

## 1. 调度策略（按 `quality_mode`）

| mode | 流水线 |
|------|--------|
| `lsp-only` | phase-a → `fixLoop(source=lsp)`（仅当 `summary_errors > 0` 或 `summary_has_structured_error=true`） |
| `build-only` | phase-b → `fixLoop(source=build)`（仅当构建失败；默认自动触发，除非用户显式要求仅校验不修复或 `interaction_mode='manual-only'`） |
| `full`（默认，**就近修复**） | phase-a → `fixLoop(source=lsp)` → phase-b → `fixLoop(source=build)` |

> **就近修复**的优势：lint 与 build 错误强重叠时（ArkTS/HarmonyOS 常见情况），先在 phase-a 修干净 → phase-b 直接通过，省去一次 `assembleApp`（约 60s 起）。

## 2. 输入与输出（概念上的函数签名）

```
fixLoop({
  source,                 # 'lsp' | 'build'
  errors,                 # 已归一化的 Issue[]
  verifier,               # 复检函数：重跑 phase-a / phase-b（或两者）取最新 errors
  interaction_mode,       # 'interactive' | 'auto' | 'manual-only'
  interaction_scope,      # 'errors-only' | 'errors+warnings' | 'all'
  max_rounds_per_issue,   # 单条 issue 最多 fix-verify 轮数
  stop_on_high_risk,      # 高风险条目是否中止整个闭环
})
```

**返回**：

```
{
  decision: 'pass' | 'fail' | 'need_manual',
  resolved: Issue[],                # 已消化的 issue（由本闭环修复）
  unresolved: Issue[],              # 残余 issue（用户跳过 / 中止 / 超过轮次）
  new_issues_introduced: Issue[],   # 修复过程中新引入的 issue（任意 severity）
  rounds: FixRound[],               # 每条 issue 的交互记录，写入输出模板
}
```

> **实现位置**：当前版本由 **agent 在 SKILL.md 行为层驱动**——agent 读取 phase-a/b 的 `summary_*` / 构建错误，按本文档语义循环 `AskQuestion → 改码 → 重跑编排器`。脚本侧不需要新增 `fix-loop-driver.js`。后续若要把闭环算法写成模块（生成器/状态机），可在 `scripts/fix-loop-driver.js` 暴露 `runFixLoop()` API；本节签名即为该模块的预留契约。

## 3. 错误归一化（Issue 结构）

任何来源进入 fixLoop 前都必须归一化为：

```ts
type Issue = {
  source: 'lsp' | 'build';
  file: string;       // 项目根相对路径（POSIX 分隔符）
  line: number;
  column?: number;
  severity: 'error' | 'warn' | 'suggestion';
  rule: string;       // 规则名 / 错误码；无规则时填 '(no-rule)'
  message: string;
  fingerprint: string;// 用于跨轮去重：`${source}:${file}:${line}:${rule}`
};
```

- **lsp 来源**：`summarize-codelinter-report.js` 的 `summary_stats_json.topIssues` / `byRule` 已是该结构（`source` 由 fixLoop 注入）。
- **build 来源**：解析 hvigor stdout 与 build 报告（后续可由 `scripts/parse-build-errors.js` 实现）。

## 4. pre/post 双快照与全量统计保留（**强制约束**）

无论 fixLoop 是否触发，最终 Gate Summary **必须**保留三档（error / warn / suggestion）的全量统计：

| 字段 | 含义 |
|------|------|
| `checks.lsp.pre_fix.{errors,warnings,suggestions,top_rules,top_issues}` | phase-a **第一次**跑完的快照（修复前） |
| `checks.lsp.post_fix.{errors,warnings,suggestions,top_rules,top_issues}` | fixLoop 收敛后**最后一次**复检的快照；未触发 fixLoop 时与 `pre_fix` 一致 |
| `checks.build.pre_fix` / `checks.build.post_fix` | 与 lsp 对称（仅当 phase-b 启用时存在） |

**硬性约束**（写入 [`SKILL.md`](../SKILL.md) §9 风险控制）：

1. fixLoop 默认 `interaction_scope=errors-only`，**只有 error 进入修复队列**；warning / suggestion **不参与修复**，但**必须在 post_fix 中以全量计数与排序后的 top_issues 形式呈现**。
2. 任何实现禁止从最终输出中省略 warnings / suggestions 计数及 top_issues。即便它们未进入 fixLoop 队列，仍须以 `post_fix` 快照形式呈现。
3. 当 fixLoop 引入新的 warning / suggestion（如修复后样式倒退），必须在 `fix.report.new_issues_introduced` 列明，并按各自 severity 计入 `post_fix` 总数。

## 5. 决策路径（逐条 issue）

按 `summary_stats_json.topIssues` 的稳定顺序（severity 优先 error，再按 file/line）一条一条解决；任一条未决前**禁止**处理下一条、**禁止**进入下一阶段、**禁止**输出 `decision=pass`。

| AI 自评信心 | `AskQuestion` 选项集合 | 选「接受」后动作 |
|-------------|-----------------------|-----------------|
| **高**：规则有明确替代写法、影响面 ≤ 单文件 ≤ 5 行 | 1) 接受建议改动；2) 我自己改 / 已修复，请复检；3) 跳过本条（记入 `unresolved`）；4) 中止门禁 | AI 应用补丁 → `verifier()` 重跑 → 验证该条消失 |
| **低**：涉及业务语义、跨文件、需新增依赖/权限、规则不明 | 1) 我已人工修复，请复检；2) 跳过本条（记入 `unresolved`）；3) 中止门禁（**禁止 AI 自动改动**） | 等待用户回复后再 `verifier()`；AI 不下笔 |

「信心」判定参照 §6「可修复范围清单」。超出允许范围一律落入「低信心」分支。

### 5.1 平台差异

- **Cursor**：使用 `AskQuestion` 工具，每条 issue 一个问卷；不要把多条 issue 拼到一个问卷里。
- **Claude Code / 其他平台**：输出与 §1.2 同款的 `━━━` 阻塞文本块，回复后再继续；收到回复前**不得**修改源码或重跑门禁。

## 6. 可修复范围清单（决定信心高低）

**允许自动修复（高信心）**：

- ArkTS 语法违规（官方 TypeScript → ArkTS 适配规则中有明确替代写法；经 `arkts-basic-rules.md` 索引打开，不以仓库内嵌条文为准）
- CodeLinter 报告的格式/命名类 warning（如未用 import 删除、命名规范、对象属性换行）
- 单行类型标注缺失（补显式类型即可，不影响业务逻辑）

**不允许自动修复（低信心，须人工介入）**：

- 涉及业务逻辑变更或接口重构
- 需补充 `module.json5` 权限声明或 API Level 约束的改动
- 构建 fail 原因为环境问题（SDK 缺失、`JAVA_HOME` 无效等）——此类判定为环境阻断，不做代码盲修
- 需修改 `oh-package.json5` 引入新依赖的改动
- 涉及 `LazyForEach.cachedCount` 等性能参数选型（业务规模相关）
- 超过 `max_rounds_per_issue` 仍有残余错误

## 7. 复检与收敛

- 用户选「接受」/「我自己改」后，**必须**：
  - 重跑 `verifier()`（lsp source → `node phase-a-orchestrator.js …`；build source → `hvigorw assembleApp`），取最新 errors；
  - 验证目标 issue（按 `fingerprint`）已消失；
  - 同时记录是否引入新 issue（若引入，新 issue 排到当前队列尾部继续处理）。
- 用户选「跳过」：将该条以原始 `file:line:rule|message` 写入 `unresolved`，继续下一条；最终若仍有跳过项 → `decision=need_manual`。
- 用户选「中止」：立即结束，`decision=need_manual`，剩余未处理条目原样写入 `unresolved`。

### 7.1 终止与判定

| 终止条件 | 判定 |
|---------|------|
| 队列处理完且 `summary_errors=0`（lsp）/ `build success`（build） | `decision=pass` |
| 队列处理完仍有未决 error（仅可能因「跳过 / 中止」） | `decision=need_manual` |
| 单条 issue 连续 `max_rounds_per_issue` 轮（默认 2）未消除 | 自动判为「低信心」并强制人工介入，写入 `unresolved` |
| `interaction_mode='manual-only'` | 不进入 §5 交互；直接 `decision=fail`，把全部 errors 写入 `unresolved` |
| `stop_on_high_risk=true` 且遇到首个低信心 issue | 立即中止整个闭环，`decision=need_manual` |
| `stop_on_high_risk=false` 且遇到低信心 issue | 跳过该条（记入 `unresolved`），继续处理后续条目 |

## 8. 字段映射（输入契约 → fixLoop 参数）

| 参数 | 默认值 | 备注 |
|------|--------|------|
| `interaction_mode` | interactive | `interactive` / `auto` / `manual-only` |
| `max_rounds_per_issue` | 2 | 单条 issue 修复-复检轮次上限 |
| `interaction_scope` | errors-only | 决定哪些 severity 进入队列；与全量统计无关 |
| `stop_on_high_risk` | true | 高风险条目中止策略 |

## 9. 输出片段（写入 `SKILL.md §7 输出模板`）

fixLoop 至少触发一次时，必须输出 `## fix.report` 段：

```markdown
## fix.report                         # 仅 fixLoop 至少触发一次时存在
- source: lsp | build
- targeted: errors-only | errors+warnings | all
- interaction_mode: interactive | auto | manual-only
- max_rounds_per_issue:
- interactions:
    - issue_1: file:line:rule -> action: accepted_ai|user_fixed|skipped|aborted -> rounds: n -> result: resolved|residual
    - issue_2: ...
- residual_errors:                    # 未消化的 error
- new_issues_introduced:              # 修复过程中新引入的 issue（任意 severity）
```

`checks.lsp.pre_fix` / `checks.lsp.post_fix` 与 `checks.build.pre_fix` / `checks.build.post_fix` 由 [`SKILL.md` §7 输出模板](../SKILL.md) 总模板提供位置。

## 10. 风险控制（追加项）

以下条款写入 [`SKILL.md`](../SKILL.md) §9：

- `lsp-only` / `full` 模式下检测到 `summary_errors > 0` 或 `summary_has_structured_error=true` 却跳过 fixLoop 直接输出 `decision=fail/pass` → 流程违规；除 `interaction_mode=manual-only` 外，**必须**走交互闭环。
- `build-only` / `full` 模式下构建失败却未进入 fixLoop(build)（仅返回失败日志即结束）→ 流程违规；除用户显式要求仅校验不修复或 `interaction_mode='manual-only'` 外，**必须**走交互闭环。
- §5 决策路径中未经 `AskQuestion` 直接修改源码（即便是「明显的小修复」）→ 流程违规，须撤回改动并补问询。
- 多条 issue 并行处理或乱序处理（违反 §5 串行约束）→ 流程违规。
- 任何实现禁止从最终输出中省略 `warnings` / `suggestions` 计数及 top_issues；即便它们未进入 fixLoop 队列，仍须以 `post_fix` 快照形式呈现。
- 当 fixLoop 引入新的 warning / suggestion 时，必须在 `fix.report.new_issues_introduced` 列明，并按各自 severity 计入 `post_fix` 总数。

## 11. 示例

### 11.1 lsp-only 交互式修复（高信心）

```
phase-a 报 summary_errors=2:
  issue_1 @typescript-eslint/unbound-method   (高信心)
  issue_2 @hw-stylistic/object-property-newline (高信心)

→ AskQuestion(issue_1)              → 用户选 1) 接受
  → AI 改为箭头函数
  → 重跑 phase-a → issue_1 消失

→ AskQuestion(issue_2)              → 用户选 1) 接受
  → AI 调整对象属性换行
  → 重跑 phase-a → issue_2 消失

→ summary_errors=0 → decision=pass
→ fix.report.interactions: 两条 accepted_ai → resolved
→ checks.lsp.pre_fix.errors=2  / post_fix.errors=0
→ checks.lsp.pre_fix.warnings=0 / post_fix.warnings=0  (全量保留)
```

### 11.2 lsp-only 低信心（强制人工）

```
phase-a 报 summary_errors=1:
  issue_1 @performance/hp-arkui-set-cache-count-for-lazyforeach-grid (低信心：业务参数选型)

→ AskQuestion(issue_1)（无「接受 AI 改动」选项）
  → 用户选 1) 我已人工修复，请复检
  → 重跑 phase-a → issue_1 消失

→ summary_errors=0 → decision=pass
→ fix.report.interactions: 一条 user_fixed → resolved
```

### 11.3 full 模式就近修复

```
phase-a → summary_errors=2 → fixLoop(source=lsp) 修复 → summary_errors=0
phase-b → assembleApp success → 不进入 fixLoop(source=build)
→ decision=pass
```

### 11.4 单条超过 max_rounds_per_issue

```
phase-a → summary_errors=1 → fixLoop(source=lsp)
  Round 1: 用户选「接受」→ AI 改 → 复检：原 issue 消失但触发新规则
  Round 2: 用户选「接受」→ AI 再改 → 复检：又触发别的规则
  → 自动判低信心 → AskQuestion(原 issue)（仅人工选项）
  → 用户选 3) 中止 → decision=need_manual
  → fix.report.interactions: rounds=2, result=residual
  → unresolved_issues 列明原 issue 与两次新引入 issue
```
