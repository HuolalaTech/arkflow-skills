---
name: arkts-code-gen
description: >-
  Generates and wires ArkTS/ArkUI implementation (pages, components, state,
  routing, module touches) aligned with the repo and arkts-style-core. Use
  when the user asks to 生成/补全/实现/添加 .ets pages or UI, scaffold
  features, or write HarmonyOS app code, and a concrete file-level deliverable
  is expected. Does not replace LSP or build as the final quality gate.
---

# ArkTS 代码生成（arkts-code-gen）

## Instructions

### 1. 何时应用本技能

- **落地实现**：新建/修改 `.ets`、组件与状态、路由/导航、`module.json5`、资源及同模块合理范围内配置。
- **生成、补全、脚手架、加页面**等可提交工作集。

**非本技能**：仅规范解读不写代码 → [arkts-style-core](../arkts-style-core/SKILL.md)；与 `.ets` 无关任务。

#### 与 `arkts-style-core` 同时命中时的仲裁规则

| 用户意图 | 主导 skill | 说明 |
|---------|-----------|------|
| 只问规范/约束（不要代码） | `arkts-style-core` 独立输出 | 本技能不介入 |
| 要落文件/可提交代码 | **本技能**主导 | 并行读取 style-core 规则作为输入；style-core 不独立输出 |
| 同一对话先问规范再要代码 | **本技能**收束 | style-core 输出作为「生码交接」字段传入，不重复输出规范段 |

### 2. 职责边界

- **做**：基于本仓库模式产出可编辑 ArkTS/ArkUI 代码
与配套改动清单；说明取舍与**待确认**（权限、API Level、设备）。
- **不做**：不贴整本规范；**不宣称**已通过 LSP/编译除非已跑；交付为初稿，**最终门禁**见 [arkts-quality-gate](../arkts-quality-gate/SKILL.md)。

### 2.1 交接与澄清

- 交接字段（`scope`、`upstream_context.must_rules`、`changed_files`、`open_questions`）用于 **`code-gen → quality-gate`**，非用户必填。
- 缺关键信息（模块、入口、路由方式）→ 直接在对话中追问用户。仅影响门禁的信息 → `open_questions` 传递。

### 3. 与 `arkts-style-core`

生码前应已（或并行）按 style-core 收敛 Must/Should；否则仍遵守：

- [arkts-basic-rules.md](../arkts-style-core/references/arkts-basic-rules.md)（官方适配规则 **索引**；按场景打开链接，勿当内嵌条文）
- [arkts-basic-guide.md](../arkts-style-core/references/arkts-basic-guide.md)（官方指南 **索引**；按需打开对应 URL）
- [extra-arkts-conventions.md](../arkts-style-core/references/extra-arkts-conventions.md)

### 4. 与 `arkts-quality-gate`

- 本技能为门禁上游：产出初稿与交接字段；**单入口验证与 phase-a/b/c** 由 [arkts-quality-gate](../arkts-quality-gate/SKILL.md) 执行（可选 CodeLinter、顶层 `assembleApp`、自动修复）；本技能**不内置**门禁命令。
- `full`/`lsp-only` 下门禁会先强制问询（`command-line-tools` 路径或跳过 phase-a）；仅需构建时用 `build-only`（不触发该问询）。

### 5. 知识优先级

1. 本仓库代码与 `build-profile`/模块配置  
2. 官方 TypeScript → ArkTS 适配规则（经 arkts-basic-rules 索引打开）  
3. extra-arkts-conventions（与 1、2 不冲突时）  
4. 官方 ArkTS / ArkUI 指南（经 arkts-basic-guide 索引打开）  
5. 官方文档与 SDK 

### 6. 生码步骤

1. **定范围**：模块、页面、路由、状态；不足 → 追问用户。
2. **对标**：同模块 1～2 个同类文件，对齐结构、装饰器、路由、资源。
3. **落文件**：路径与 Stage 习惯；`*Page.ets`、状态 ≥5 **收束**见 extra-arkts；变更文件一次列清。
4. **写代码**：显式类型；按 arkts-basic-rules 索引核对官方适配规则；不要使用 `any` / `unknown`；不确定 API → 待确认。
5. **输出**：用下方模板；**验证** → 「验证建议」与交接字段指向 **arkts-quality-gate**（勿声称已跑门禁）。

### 7. 输出模板

```markdown
## 需求理解
## 计划变更
| 路径 | 操作 | 说明 |
## 实现说明
## 待确认
## 验证建议
- 转入 `arkts-quality-gate`：默认 `quality_mode=full`；仅需构建用 `build-only`。

## 门禁交接（给 quality-gate）
- scope:
- quality_mode:
- upstream_context:
  - must_rules:
  - changed_files:
  - open_questions:

## 代码

<!-- 代码段格式约定（必须遵守）：
  - 每个文件独立一个代码块，块前用三级标题标注路径：### path/to/XxxPage.ets
  - 路径须与「计划变更」表中的路径完全一致
  - 代码块语言标识符统一用 ets（ArkTS 文件）或对应类型（json5、json 等）
  - 单文件时可省略三级标题，直接一个代码块
  - 文件超长时，非关键样板（如固定 import 列表末尾）可用 // ... 截断并注明省略内容
-->
```

### 8. 体量

单轮优先可审阅完整度；过长则分文件，路径须在「计划变更」列全。

---

## Examples

1. **新页面 + 路由**：对标现网注册方式；输出「计划变更」+ 代码；验证建议指向 quality-gate。
2. **列表 + mock**：按 arkts-basic-rules 索引打开官方适配规则核对类型；状态类型显式；待确认写清后续网络依赖。
3. **与规范冲突**：按官方适配规则改写并一句说明原因（可引用规则英文名）。
