# phase-b（构建 / assembleApp）

> 本文档由 [`SKILL.md`](../SKILL.md) §3、§4 引用，描述 phase-b 的运行链路、构建工具选择与可追溯字段。修复闭环不在本文档定义，参见 [`fix-loop.md`](./fix-loop.md)。

## 1. 命令

- **顶层任务**：`assembleApp`（或约定等价如 `assembleHap`）。
- **禁止**单独 CLI 执行 `:entry:default@CompileArkTS`；多数环境 `hvigor tasks` 不可单独调用 → task not found。
- 通过：`build success`。

## 2. 构建工具选择（强制）

优先使用 **DevEco Studio 内置 hvigorw**；仅在不可用时回退到 `command-line-tools` 的 `hvigorw`。

| 优先级 | 候选路径 |
|--------|---------|
| 1（优先） | `/Applications/DevEco-Studio.app/Contents/tools/hvigor/bin/hvigorw` |
| 2（回退） | `${command_line_tools_home}/bin/hvigorw`（或 PATH 中等价 `hvigorw`） |

- `build-only` 模式下，若用户未提供 `command_line_tools_home`，**不得**为满足 phase-b 去追问该路径；仅按 DevEco 内置链路执行。
- 若两者都不可用，判定为环境阻断并中止，`decision=need_manual`。

## 3. 环境要求

phase-b 启动前必须满足（参见 [`SKILL.md`](../SKILL.md) §0「环境前置」）：

```bash
JAVA_HOME=/Applications/DevEco-Studio.app/Contents/jbr/Contents/Home
DEVECO_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk
OHOS_BASE_SDK_HOME=/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony
```

校验：`$JAVA_HOME/bin/java`、`$OHOS_BASE_SDK_HOME/toolchains/oh-uni-package.json`。失效时再探测并记录命中路径。

**环境阻断**（缺 Java/SDK）→ 判环境问题，**勿当代码盲修**；`decision=need_manual`，`next_actions` 提示修复环境变量。

## 4. 可追溯字段

每次 phase-b 必须记录：

- `build_tool_source: deveco | command-line-tools`
- `build_tool_path:<实际命中路径>`

## 5. 与 fixLoop 的衔接

phase-b 完成后，由编排器（agent 端）按 `quality_mode` 与 [`fix-loop.md`](./fix-loop.md) 的调度策略决定是否进入 fixLoop：

- `build-only`：phase-b 报构建失败 → 进入 fixLoop（source=build）。当用户只给出「仅运行 build 模式」时，默认按此路径自动继续；仅在用户显式声明「仅校验不修复」或 `interaction_mode='manual-only'` 时可不进入闭环。
- `full`：phase-b 失败 → 进入 fixLoop（source=build，**就近修复**），收敛后再次 `assembleApp` 复检。

不论是否进入 fixLoop，phase-b 第一次跑出的失败列表须作为 `checks.build` 的初始快照保留；最终 `checks.build.success` 由 fixLoop 收敛后的最后一次 `assembleApp` 复检产出。
