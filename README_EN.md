<div align="center">
  <img src="./docs/assets/arkflow.png" height="100" alt="ArkFlow" />

  <h1>ArkFlow</h1>
  <p>Agent skills for ArkTS / HarmonyOS app development, for Cursor and Claude Code.</p>

  [中文](./README.md) | English
</div>

ArkFlow is an open-source project from **Huolala**. It is an [Agent Skills](https://agentskills.io/) suite for HarmonyOS/ArkTS projects, installed with `npx skills add`. Three skills form a **Plan → Do → Check** loop: generate code that matches the repo, then catch ArkTS and build issues before you commit.

```mermaid
flowchart LR
  U["User request"] --> S["arkts-style-core<br/>conventions"]
  S --> C["arkts-code-gen<br/>repo-aligned codegen"]
  C --> Q["arkts-quality-gate<br/>CodeLinter + build"]
  Q --> P["Ready to commit"]
```

---

## Install

```bash
# All three skills (Cursor + Claude Code)
npx skills add HuolalaTech/arkflow -a cursor -a claude-code

# Cursor only
npx skills add HuolalaTech/arkflow -a cursor

# One skill
npx skills add HuolalaTech/arkflow --skill arkts-quality-gate -a cursor
```

Cursor install path: `.cursor/skills/<skill-name>/`  
Claude Code install path: `.claude/skills/<skill-name>/`

### Team conventions (after first install)

```bash
$EDITOR .cursor/skills/arkts-style-core/references/extra-arkts-conventions.md
```

Add project-specific naming, directory, and state rules in the team appendix (§8).

### Upgrade (does not overwrite team conventions)

```bash
npx skills add HuolalaTech/arkflow -a cursor --upgrade
# extra-arkts-conventions.md is kept
```

---

## Requirements

| Tool | Version | Notes |
|------|---------|--------|
| DevEco Studio | 5.x+ | Includes hvigor |
| Node.js | ≥ 16 | Config merge scripts |
| Cursor / Claude Code | Latest | Either one |

**macOS environment variables (default DevEco Studio paths)**:

```bash
export JAVA_HOME="/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home"
export DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk"
export OHOS_BASE_SDK_HOME="${DEVECO_SDK_HOME}/default/openharmony"
```

Windows / Linux have no bundled default paths. The built-in CodeLinter / hvigorw probe will miss, then the gate asks for `command-line-tools` (or skip). Install the SDK and command-line tools before running `arkts-quality-gate`.

---

## Skills

### arkts-style-core (Plan)

**When**: questions about ArkTS/ArkUI style, compiler constraints, or reviewing conventions.

Provides:
- `arkts-basic-rules.md`: **index** of the official TypeScript-to-ArkTS cookbook (open the official docs; this repo does not embed the rule text)
- `arkts-basic-guide.md`: **index** of official ArkTS/ArkUI guides (open links as needed)
- `extra-arkts-conventions.md`: team conventions (naming, state, routing, lists)

Emits structured handoff fields (`must_rules` / `should_rules` / `anti_patterns` / `snippets`) for `arkts-code-gen`.

---

### arkts-code-gen (Do)

**When**: generate, complete, or implement `.ets` pages, components, or state modules.

- Matches existing repo patterns instead of generic templates
- Explicit types; follow official ArkTS constraints; do not use `any` / `unknown`
- Outputs a change table, full code, and quality-gate handoff
- Does not run the gate; verification is `arkts-quality-gate`

---

### arkts-quality-gate (Check)

**When**: validate before commit, batch health-check, or CI/CD.

| Mode | Behavior |
|------|----------|
| `full` (default) | phase-a CodeLinter → fixLoop(lsp) → phase-b assembleApp → fixLoop(build) |
| `lsp-only` | phase-a CodeLinter + fixLoop(lsp) |
| `build-only` | phase-b assembleApp + fixLoop(build) |

**fixLoop**: after phase-a / phase-b, repair issues one by one. High-confidence items are edited and rechecked; low-confidence items are presented for a human choice. At most `max_rounds_per_issue=2` per issue; stop on limit or high risk (`decision=need_manual`). Emits `pre_fix` / `post_fix` snapshots and `fix.report`.

**Platforms**:
- **Cursor**: `AskQuestion` for structured choices (path / skip)
- **Claude Code**: formatted blocking prompt; wait for a reply

On `full` / `lsp-only`, the skill first probes the bundled CodeLinter runner (`/Applications/DevEco-Studio.app/Contents/plugins/codelinter/run/index.js`). If found, it runs with **no path prompt**. Only if that path is missing does it ask for `command-line-tools` (or skip). No checks run until that is answered.

---

## Layout

```
skills/
├── arkts-style-core/
│   ├── SKILL.md
│   └── references/
│       ├── arkts-basic-rules.md                 # official compiler-constraint index
│       ├── arkts-basic-guide.md                 # official development-guide index
│       └── extra-arkts-conventions.template.md  # team conventions template
├── arkts-code-gen/
│   └── SKILL.md
└── arkts-quality-gate/
    ├── SKILL.md
    ├── references/
    ├── scripts/
    └── src/
        └── baseline-code-linter.json5
```

---

## Typical flow

```
User: "Generate an order list page with pull-to-refresh and paging"
  │
  ▼
arkts-style-core
  ├─ Open official ArkTS cookbook via arkts-basic-rules (types / LazyForEach)
  ├─ Read extra-arkts-conventions for list naming and state
  └─ Emit must_rules
  │
  ▼
arkts-code-gen
  ├─ Match an existing list page in the repo
  ├─ Generate OrderListPage.ets + state model
  └─ Emit change table + gate handoff
  │
  ▼
arkts-quality-gate
  ├─ Probe bundled runner; otherwise ask for command-line-tools
  ├─ phase-a CodeLinter, pre_fix snapshot
  ├─ fixLoop(lsp), post_fix snapshot
  ├─ phase-b assembleApp
  └─ fixLoop(build) if needed
  │
  ▼
Gate Summary: decision=pass
```

---

## Custom CodeLinter rules

Bundled baseline (`baseline-code-linter.json5`) includes `@performance/recommended`, `@security/*` (error by default), and `@correctness/*`.

Override in the app repo `code-linter.json5`:

```json5
{
  "rules": {
    "@security/no-unsafe-mac": "warn",
    "@security/no-unsafe-3des": "off"
  }
}
```

`ruleSet` is a union; `rules` in the project file win.

---

## Version

| Version | Status | Notes |
|---------|--------|--------|
| v1.0.0 | Current | Three skills; official-doc indexes; bundled runner probe; per-issue fixLoop; pre_fix/post_fix; `npx skills add` |

---

## Contributing

Issues and Pull Requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Security reports: [SECURITY.md](./SECURITY.md). Usage help: [SUPPORT.md](./SUPPORT.md).

---

## License

ArkFlow is an open-source project from **Huolala** and is released under the [Apache License 2.0](./LICENSE).

Copyright © 2026 深圳依时货拉拉科技有限公司

See [NOTICE](./NOTICE) for third-party documentation sources and the statement that this repo does not embed official handbook body text.

## Author / Attribution

- Publisher: 货拉拉 ([HuolalaTech/arkflow](https://github.com/HuolalaTech/arkflow))
- Code of conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
