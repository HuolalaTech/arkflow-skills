# HarmonyOS / ArkTS 开发指南（索引）

本文件 **不含** DevEco Studio / 华为开发者文档正文。概念、API、示例以官方文档为准；
只按当前任务打开对应链接，不要假设本文已内嵌手册。

正文版权与许可以官方文档为准，不构成本仓库 Apache-2.0 作品。说明见仓库根目录 [NOTICE](../../../NOTICE)。

与当前工程 `build-profile` / `module.json5` / API Level 冲突时，**以工程为准**。

## 官方指南（按需打开，勿整篇加载）

| 场景 | 官方文档 |
|------|----------|
| ArkTS 语言 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts |
| ArkUI | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkui |
| 状态管理 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management-overview |
| Navigation 路由 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-set-navigation-routing |
| 并发 | https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-concurrency |
| 文档首页 | https://developer.huawei.com/consumer/cn/doc/ |
| 最佳实践 | https://developer.huawei.com/consumer/cn/best-practices |
| 示例 | https://developer.huawei.com/consumer/cn/samples/ |
| OpenHarmony 文档仓 | https://gitee.com/openharmony/docs |

## 按场景检索（官方文档内搜索）

| 场景 | 建议搜索关键词 |
|------|----------------|
| 惰性列表 / 大数据量渲染 | `LazyForEach`、`IDataSource`、`BasicDataSource` |
| Navigation 路由与页面栈 | `Navigation`、`NavPathStack`、`NavDestination`、`routerMap` |
| 过渡动画 / 共享元素 | `animateTo`、`geometryTransition`、`transition`、`renderGroup` |
| 权限申请运行时弹窗 | `requestPermissionsFromUser`、`abilityAccessCtrl` |
| HTTP 网络请求 | `http.createHttp`、`rcp`、`Request` |
| 本地持久化存储 | `preferences`、`relationalStore`、`getUserPreferences` |
| 组件间事件通信 | `EventHub`、`emitter`、`emit`、`on` |
| 自定义弹窗 / 对话框 | `CustomDialog`、`promptAction`、`openCustomDialog` |
| 图片加载与缓存 | `Image`、`ImageSource`、`PixelMap` |
| Worker / TaskPool 多线程 | `worker.ThreadWorker`、`taskpool.Task` |

## Agent 操作约定（本仓库原创）

1. 只打开与当前任务相关的官方章节；对话中摘要 + 链接，勿粘贴整篇官方文档。
2. 控件、API、权限、API Level 以官方文档和当前工程配置为准，不要编造。
3. 命名、状态收束、列表/路由模式等团队约定见 [extra-arkts-conventions.md](extra-arkts-conventions.md)（由模板生成）。
