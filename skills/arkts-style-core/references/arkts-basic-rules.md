# ArkTS 编译约束（索引）

本文件 **不是** ArkTS 语法规范正文，也 **不含** DevEco Studio / CodeGenie 内置规则。

生码、审阅、修改 `.ets` 时：按下方链接打开 **官方适配规则**，只读与当前改动相关的条目。
不要凭 TypeScript 习惯猜测能否通过编译。

规范正文的版权与许可以官方文档为准，不构成本仓库 Apache-2.0 作品。说明见仓库根目录 [NOTICE](../../../NOTICE)。

## 必须打开的官方文档

| 用途 | 文档 | 说明 |
|------|------|------|
| 编译能否通过（硬约束） | [从 TypeScript 到 ArkTS 的适配规则（OpenHarmony）](https://gitee.com/openharmony/docs/blob/master/zh-cn/application-dev/quick-start/typescript-to-arkts-migration-guide.md) | [CC-BY-4.0](https://github.com/openharmony/docs)；优先用这份 |
| 同上（GitHub 镜像） | [typescript-to-arkts-migration-guide.md](https://github.com/openharmony/docs/blob/master/zh-cn/application-dev/quick-start/typescript-to-arkts-migration-guide.md) | 与 Gitee 同源 |
| 同上（HarmonyOS 站点） | [从 TypeScript 到 ArkTS 的适配指导](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/typescript-to-arkts-migration-guide) | **只外链，不摘录正文** |
| 适配案例 | [适配指导案例](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-more-cases) | 按规则英文名（如 `arkts-no-any-unknown`）搜索 |

severity 为 error 的配方：生成代码时必须遵守。  
文档与当前工程 `compatibleSdkVersion` / `build-profile` 冲突时，**以工程为准**。

## 按场景检索官方规则（不要整篇加载）

| 当前在写什么 | 在官方文档中搜索 |
|--------------|------------------|
| 类型 / `any` / `unknown` / 泛型 | `any` `unknown` `arkts-no-any-unknown` |
| 对象字段、解构、展开、`obj["field"]` | `destructuring` `spread` `arkts-no-indexed-access` |
| 类、接口、对象字面量、结构化类型 | `structural typing` `object literal` |
| 函数、`this`、`bind` / `call` / `apply` | `this` `Function.bind` nested function |
| `import` / 模块 / `require` | `import` `export =` `require` `arkts-no-misplaced-imports` |
| 枚举、命名空间 | `enum` `namespace` |
| `var`、`with`、`Symbol` | `arkts-no-var` `with` `arkts-no-symbol` |

## Agent 操作约定（本仓库原创）

这些是 ArkFlow 自己的执行步骤，不是华为或 OpenHarmony 规则摘录：

1. 先对标本仓库已有 `.ets` 和 `module.json5`。
2. 再用上表打开官方适配规则，核对将要写出的语法。
3. 使用显式类型；不要使用 `any` / `unknown`（官方适配规则禁止，须打开上文链接核对替代写法）。
4. 官方 API 以华为 / OpenHarmony 文档为准；不确定就标「待确认」，不要编造 API。
5. 最终能否编译，以 `arkts-quality-gate`（CodeLinter / assembleApp）为准。
