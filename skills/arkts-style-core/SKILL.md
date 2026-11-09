---
name: arkts-style-core
description: >-
  Supplies ArkTS/OpenHarmony style rules and points to in-repo indexes of
  official compiler constraints and development guides. Use when generating,
  reviewing, or refactoring ArkTS/ArkUI/.ets code, when the user asks for
  规范/约束/ArkTS 写法, or before new pages, components, state, or
  navigation so output follows the language subset, official ArkTS rules,
  official guides, and project patterns.
---

# ArkTS 规范与参考核心（arkts-style-core）

## Instructions

### 1. 何时应用本技能

- 编写或审阅 **ArkTS / ArkUI / `.ets`** 的规范层面：页面、组件、状态、路由、模块配置。
- 用户要求 **鸿蒙/ArkTS 写法、编译约束、对齐项目**。

**非本技能**：纯 C/C++、与 `.ets` 无关仅改资源等。

### 2. 职责边界

- **做**：整理 Must/Should/Must not、Snippets；指明打开哪份 reference，并按索引打开 **官方文档相关章节**。
- **不做**：不写长业务实现；**不跑** LSP/构建；大块落文件交给 `arkts-code-gen` 或用户指定；**不**把官方手册正文粘进仓库或对话。

### 2.1 交接与澄清

- 交接字段（`must_rules`、`should_rules`、`anti_patterns`、`snippets`）用于 **`style-core → code-gen`**。
- **非**用户一次性表单；自然语言需求由本技能结构化。
- 关键信息不足 → 直接在对话中追问用户；回填交接字段再输出下游。

### 3. 库内参考（单跳）

| 文件 | 用途 |
|------|------|
| [references/arkts-basic-rules.md](references/arkts-basic-rules.md) | **必须**；编译硬约束的 **官方文档索引**（打开适配规则，勿当内嵌条文） |
| [references/arkts-basic-guide.md](references/arkts-basic-guide.md) | 按需；ArkTS/ArkUI 官方指南 **索引**，按场景打开链接 |
| [references/extra-arkts-conventions.md](references/extra-arkts-conventions.md) | 仓库扩展：`*Page.ets`、状态 ≥5 `@Observed`、路由/列表等 |

> **说明**：`extra-arkts-conventions.md` 由安装脚本从 `extra-arkts-conventions.template.md` 生成，供各团队定制。

场景检索词已写在两份索引里。需要概念/示例时打开索引中的官方 URL，按关键词搜索，**勿**整篇加载官方手册。

### 4. 知识优先级（冲突从高到低）

1. **本仓库**代码、`build-profile`/模块配置、API Level（指南与工程不一致 → **以工程为准**）。
2. 官方 TypeScript → ArkTS 适配规则（经 [arkts-basic-rules.md](references/arkts-basic-rules.md) 打开）。
3. 官方 ArkTS / ArkUI 指南（经 [arkts-basic-guide.md](references/arkts-basic-guide.md) 打开）。
4. [OpenHarmony 文档](https://gitee.com/openharmony/docs) / SDK。
5. 通用 TS 习惯；与 2～4 冲突 → **以 ArkTS/工程为准**。

**extra-arkts-conventions**：在 1、2 满足前提下补充命名与场景约定；与现网矛盾 → **以 1 为准**，并考虑更新该文档。

### 5. 工作步骤

1. 目标模块找对标页面/组件/路由。
2. 打开 arkts-basic-rules 索引 → 按场景检索 **官方适配规则**。
3. 需要概念/示例时再打开 arkts-basic-guide 索引中的官方链接。
4. 涉及命名、多状态、列表/路由模式 → extra-arkts **对应节**。
5. 用下方报告模板输出。Must 条目应能追溯到官方文档标题或规则名（如 `arkts-no-any-unknown`），不要伪造仓库内嵌条文编号。

### 6. 报告模板

```markdown
## 上下文
## Must — 官方适配规则（经 arkts-basic-rules 索引）
## Should — 官方指南 / extra / 本仓库
## Must not / Anti-patterns
## Snippets
## 待确认
## 下一步
- 实现：`arkts-code-gen` / 门禁：`arkts-quality-gate`（细则见该 skill）/ 其他待查事项

## 生码交接（给 arkts-code-gen）
- must_rules / should_rules / anti_patterns / snippets
```

---

## Examples

1. **列表页规范**：对标现网 → 官方适配规则核对类型与解构 → 官方指南按需搜 `LazyForEach` → 下一步：code-gen；落地后 **quality-gate**。
2. **「会编译不过吗」**：按 arkts-basic-rules 索引打开官方适配规则；不确定 → 待确认。
3. **指南版本与工程不一致**：以 `build-profile`、`module.json5` 为准。

## 体量提示

官方指南很长：对话中**摘要 + 链接**，勿全文回显。仓库内的 rules/guide 只是索引。
