<div align="center">
  <img src="./docs/assets/arkflow.png" height="100" alt="ArkFlow" />

  <h1>ArkFlow</h1>
  <p>ArkTS / HarmonyOS AI 辅助开发技能套件，适配 Cursor 和 Claude Code。</p>

  中文 | [English](./README_EN.md)
</div>

ArkFlow 由 **货拉拉** 出品，是一套专为 HarmonyOS/ArkTS 工程设计的 AI Agent Skill 集合，遵循 [Agent Skills 开放标准](https://agentskills.io/)，通过 `npx skills add` 一键安装。三个 Skill 构成 **规范（Plan）→ 生码（Do）→ 门禁（Check）** 的 PDC 闭环：少写不能编译的 ArkTS，提交前用 CodeLinter 和构建拦住问题。

```mermaid
flowchart LR
  U["用户需求"] --> S["arkts-style-core<br/>规范"]
  S --> C["arkts-code-gen<br/>对标仓库生码"]
  C --> Q["arkts-quality-gate<br/>CodeLinter + 构建"]
  Q --> P["可提交"]
```

---

## 快速安装

```bash
# 安装全部三个 Skill（Cursor + Claude Code 同时支持）
npx skills add HuolalaTech/arkflow -a cursor -a claude-code

# 仅安装到 Cursor
npx skills add HuolalaTech/arkflow -a cursor

# 仅安装某一个 Skill
npx skills add HuolalaTech/arkflow --skill arkts-quality-gate -a cursor
```

安装后 Cursor 路径：`.cursor/skills/<skill-name>/`  
安装后 Claude Code 路径：`.claude/skills/<skill-name>/`

### 定制团队约定（首次安装后）

```bash
# 编辑团队扩展约定文件（首次安装时由安装器从模板生成）
$EDITOR .cursor/skills/arkts-style-core/references/extra-arkts-conventions.md

# 在 §8 团队追加区 添加项目特有的命名规则、目录约定、状态管理规范等
```

### 升级（不覆盖团队约定）

```bash
npx skills add HuolalaTech/arkflow -a cursor --upgrade
# extra-arkts-conventions.md 不会被覆盖
```

---

## 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| DevEco Studio | 5.x+ | 含 hvigor 构建工具 |
| Node.js | ≥ 16 | 运行配置合并脚本 |
| Cursor / Claude Code | 最新版 | 二选一 |

**macOS 环境变量（DevEco Studio 标准路径）**：

```bash
export JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"
export DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk"
export OHOS_BASE_SDK_HOME="${DEVECO_SDK_HOME}/default/openharmony"
```

Windows / Linux 没有上述默认路径：内置 CodeLinter / hvigorw 探测会失败，门禁再询问 `command-line-tools` 路径（或跳过）。先装好 SDK 与命令行工具再跑 `arkts-quality-gate`。

---

## Skill 说明

### arkts-style-core（规范层）

**触发**：用户询问 ArkTS/ArkUI 写法、编译约束、审阅代码规范时。

提供：
- `arkts-basic-rules.md`：官方 TypeScript → ArkTS 适配规则 **索引**（打开官方文档核对编译硬约束，仓库不内嵌条文）
- `arkts-basic-guide.md`：官方 ArkTS/ArkUI 指南 **索引**（按需打开链接）
- `extra-arkts-conventions.md`：团队定制约定（命名、状态管理、路由、列表规范）

输出结构化交接字段（`must_rules`/`should_rules`/`anti_patterns`/`snippets`）供 `arkts-code-gen` 消费。

---

### arkts-code-gen（生码层）

**触发**：用户要求生成/补全/实现 `.ets` 页面、组件、状态模块时。

- 对标仓库现有代码模式，而非通用模板
- 显式类型标注；按官方适配规则生码，不使用 `any` / `unknown`
- 输出「计划变更」表 + 完整代码 + 门禁交接字段
- 不内置门禁命令；最终验证交给 `arkts-quality-gate`

---

### arkts-quality-gate（门禁层）

**触发**：代码生成后提交前验证、批量改动体检、CI/CD 集成。

三种模式：

| 模式 | 行为 |
|------|------|
| `full`（默认） | phase-a CodeLinter → fixLoop(lsp) 逐条修复 → phase-b assembleApp → fixLoop(build) 逐条修复 |
| `lsp-only` | 仅 phase-a CodeLinter + fixLoop(lsp) |
| `build-only` | 仅 phase-b assembleApp + fixLoop(build) |

**fixLoop 机制**：phase-a / phase-b 发现错误后逐条交互修复——高信心问题由 AI 直接修改并复检，低信心问题仅呈现人工选项。每条 issue 最多 `max_rounds_per_issue=2` 轮，超限或遇高风险立即中止（`decision=need_manual`）。输出 `pre_fix` / `post_fix` 快照及 `fix.report` 供追溯。

**平台适配**：
- **Cursor**：使用 `AskQuestion` 工具弹出结构化选项（路径 / 跳过）
- **Claude Code**：输出格式化文本问询，阻塞等待用户回复

**注意**：`full`/`lsp-only` 模式启动时，优先探测内置 CodeLinter runner（`/Applications/DevEco-Studio.app/Contents/plugins/codelinter/run/index.js`）；命中则直接运行，**无需问询路径**。仅当内置路径不可用时，才触发 fallback 交互询问 `command-line-tools` 路径（或选择跳过），获得明确答复前不执行任何检查。

---

## 文件结构

```
skills/
├── arkts-style-core/
│   ├── SKILL.md
│   └── references/
│       ├── arkts-basic-rules.md                 # 官方编译约束索引
│       ├── arkts-basic-guide.md                 # 官方开发指南索引
│       └── extra-arkts-conventions.template.md  # 团队约定模板（安装时复制）
├── arkts-code-gen/
│   └── SKILL.md
└── arkts-quality-gate/
    ├── SKILL.md
    ├── references/
    │   ├── lsp-phase-a.md                  # phase-a 前置问询、双实现、产物迁移、stdout 协议
    │   ├── build-phase-b.md                # phase-b 构建工具优先级、环境要求、可追溯字段
    │   └── fix-loop.md                     # fixLoop 调度、Issue 归一化、决策路径、终止判定
    ├── scripts/
    │   ├── phase-a-orchestrator.js         # phase-a 唯一编排入口（in-process 复用合并/汇总函数）
    │   ├── codelinter-merge-config-cli.js  # baseline + 项目 code-linter.json5 合并（CLI / runMerge()）
    │   ├── summarize-codelinter-report.js  # 报告汇总（summarizeReportFile / formatSummaryStdout）
    │   └── phase-a-relocate-artifacts.sh   # fallback 分支产物迁移（cp -a → rm -rf result）
    └── src/
        └── baseline-code-linter.json5      # CodeLinter baseline 配置，参与项目 code-linter.json5 合并
```

---

## 典型工作流

```
用户："帮我生成订单列表页，支持下拉刷新和分页加载"
  │
  ▼
arkts-style-core（规范层）
  ├─ 按 arkts-basic-rules 索引打开官方适配规则（类型 / LazyForEach 等）
  ├─ 读取 extra-arkts-conventions → 列表命名与状态规范
  └─ 输出 must_rules 交接字段
  │
  ▼
arkts-code-gen（生码层）
  ├─ 对标仓库现有列表页结构
  ├─ 生成 OrderListPage.ets + 状态模型
  └─ 输出「计划变更」+ 门禁交接字段
  │
  ▼
arkts-quality-gate（门禁层）
  ├─ 探测内置 runner；未命中时 fallback 问询 command-line-tools 路径
  ├─ phase-a：CodeLinter 扫描（合并基线 + 项目规则），输出 pre_fix 快照
  ├─ fixLoop(lsp)：逐条交互修复 LSP 错误（每条最多 2 轮），输出 post_fix 快照
  ├─ phase-b：assembleApp 构建验证
  └─ fixLoop(build)（如有错误）：逐条交互修复构建失败
  │
  ▼
Gate Summary: decision=pass ✓
```

---

## CodeLinter 规则定制

ArkFlow 内置基线规则（`baseline-code-linter.json5`）包含：
- `@performance/recommended`：性能最佳实践
- `@security/*`：安全规则（默认 error 级别）
- `@correctness/*`：正确性检查

在项目根目录的 `code-linter.json5` 中可覆盖：

```json5
{
  // 降级某条安全规则
  "rules": {
    "@security/no-unsafe-mac": "warn",
    "@security/no-unsafe-3des": "off"
  }
}
```

`ruleSet` 字段取并集，`rules` 字段项目配置优先。

---

## 版本

| 版本 | 状态 | 说明 |
|------|------|------|
| v1.0.0 | 当前 | 三层 Skill（style-core / code-gen / quality-gate）；官方文档索引；内置 runner 探测；fixLoop 逐条交互修复；pre_fix/post_fix 快照；`npx skills add` 一键安装 |

---

## 贡献

欢迎通过 Issue 与 Pull Request 参与。详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

安全问题请参阅 [SECURITY.md](./SECURITY.md)；使用支持见 [SUPPORT.md](./SUPPORT.md)。

---

## 开源许可

本项目由 **货拉拉** 出品，采用 [Apache License 2.0](./LICENSE) 开源。

Copyright © 2026 深圳依时货拉拉科技有限公司

第三方文档来源与「本仓库不内嵌官方手册正文」的说明见 [NOTICE](./NOTICE)。

## 作者 / 归属

- 出品方：货拉拉（[HuolalaTech/arkflow](https://github.com/HuolalaTech/arkflow)）
- 行为准则：[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
