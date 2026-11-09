# 本仓库扩展约定（Extra ArkTS Conventions）

> 定位：在 [arkts-basic-rules.md](arkts-basic-rules.md)（**官方编译约束索引**）与 [arkts-basic-guide.md](arkts-basic-guide.md)（**官方开发指南索引**）之外，补充 **本团队/本仓库** 的可执行约定。  
> 与工程实现冲突时 **以本仓库 `build-profile` 与已有代码为准**，并回写修正本文。

---

## 1. 页面与组件：文件与符号命名

### 1.1 页面（可路由的整屏）

| 项 | 约定 | 说明 |
|----|------|------|
| 文件名 | `XxxPage.ets` | **以 `Page` 结尾**（PascalCase 主名 + `Page`），与「仅局部复用的组件」区分。 |
| 典型路径 | 随模块，如 `entry/src/main/ets/pages/...` | 以**本仓库**已有 `pages` 布局为准。 |
| 与「组件」区分 | 同目录下若只有 `SomethingPage.ets` 为入口级页面，**不要**用 `Index.ets` 等泛名混指多屏 | 一屏一职责时文件名应可从名字看出**页面**属性。 |

### 1.2 可复用 UI 组件（非整屏入口）

| 项 | 约定 | 说明 |
|----|------|------|
| 文件名 | `XxxView.ets` / `XxxItem.ets` 或项目既有后缀 | **不要**以 `Page` 结尾，避免与路由页混淆。 |
| 与 Page 同文件内 | 若页面内仅 1~2 个子结构，可留在同一 `.ets`；**拆多文件**时按上面后缀区分。 |

**场景 A：新加「关于我们」** → 使用 `AboutPage.ets`（或 `AboutUsPage.ets`），并在路由/ `main_pages` 等处与现网**同一套**注册方式对齐。

**场景 B：订单列表是页面，行是组件** → `OrderListPage.ets` + `OrderItemView.ets`（示例名，以仓库已有命名为准）。

---

## 2. 状态收束：组件内「本地 UI 状态」数量较多时

### 2.1 何时收束

- 同一 `@Component` 中，**用于驱动 UI 的、互相相关的** 状态量（`@State` / `@Link` 等与展示绑定的字段，按「逻辑上可视为一块界面模型」来数）**≥ 5 个**时：  
  **应** 将相关字段**收束**到一个 **`@Observed` 的 class**（及配套用法以**本仓库**已有 `Observed` 模式为准），在组件中通过 **单一引用** 驱动 UI，减少 `@State` 平铺与参数钻透。

### 2.2 什么不收束

- 与当前组件**无强耦合**的只读入参、或**明确**来自父组件的独立 `@Link`，仍按**项目现有**传参方式处理，不强行并表。  
- 若收束后类型难以命名或职责混杂，**优先**拆**子组件** + 子范围状态，再对单组件执行 ≥5 规则（避免巨型上帝类）。
- 对于仅承载字段的数据结构，若**不需要** `@Observed` 驱动 UI 联动，且**没有实例方法**，优先使用 `interface` 声明结构；仅在需要 `@Observed`、构造流程约束、或实例行为方法时再使用 `class`。

### 2.3 典型模式（说明用，以工程代码为准）

```text
@Observed
class XxxPageState {
  // 与当前页强相关的 5+ 个字段放此处；公开字段类型均显式标注
}
@Component
struct XxxPage {
  @State data: XxxPageState = new XxxPageState();
  // build() 中绑定 this.data.xxx
}
```

**场景 C：设置页有开关、地区、多段文案等 6+ 个 @State** → 收束为 `SettingsPageState` 一类 `@Observed` 模型。  
**场景 D：仅 2~3 个 @State** → 维持平铺，**不**为凑规则强行建 class。
**场景 D1：消息 DTO 仅含 id/title/read 字段，无行为** → 用 `interface` 描述；若后续需要 `@Observed` 联动或实例方法，再升级为 `class`。

---

## 3. UI 页面代码层级（默认 MVVM）

- 新建 UI 页面时，若在当前模块未发现已落地的页面架构约定（如 MVVM、MVP 或其它明确分层范式），默认采用 **MVVM** 组织代码。  
- “未发现”判定以模块内可见事实为准：无成体系的 `Presenter` / `Contract` / `ViewModel` 目录与命名约定，且近邻页面未体现可复用的替代分层模式。  
- 采用 MVVM 时，页面文件仍放在 `pages`；与页面协作的分组目录（如 `viewmodels`、`models`、`services`、`repositories`）应与 `pages` **同级**，避免嵌套进单页目录导致跨页复用困难。  
- 视页面复杂度按“最小骨架”落地：若页面相对简单且**无网络请求**，至少保证 `pages + viewmodels` 两层；若存在**网络请求/远端数据交互**，至少保证 `pages + viewmodels + models` 三层。  
- 当已存在同域目录时优先复用，不为单页重复新建平行目录；但不得低于上述分层下限。
- 如后续确认项目已有既定架构（例如部分子域明确使用 MVP），以该子域既有约定为准，不强行回切 MVVM。

### 3.1 目录层级示例（同模块内）

```text
entry/src/main/ets/
  pages/
  viewmodels/
  models/
  services/
```

**场景 E：新增本地静态说明页（无请求）** → 至少落 `pages + viewmodels`，无需为凑层级强行新增 `models`。  
**场景 F：新增消息页且需分页请求** → 至少落 `pages + viewmodels + models`，并保持三类目录与 `pages` 同级。  
**场景 G：发现订单域已稳定使用 MVP** → 订单相关新增页继续沿用 MVP，不与默认 MVVM 混搭。

---

## 4. 路由与导航

- 在实现与审阅时，先识别当前模块采用的是 `router` 还是 `Navigation`，并在**同一功能流**内保持一致；若有迁移计划，须在 PR/文档中显式说明边界。  
- 新增页面时：**路由名 / path** 与 **文件名/类名** 在团队内**可读一致**（例如与 `XxxPage` 对应的注册名有固定规则时跟项目文档）。

### 4.1 使用 `router` 进行页面跳转管理

- 页面级 UI（可独立路由打开的整屏）应使用 `@Entry` + `@Component` 修饰页面根 `struct`。  
- 页面需按模块现有方式注册到 `main_pages`（或同等页面清单），并确保 `module.json5` 的 `pages` 字段正确指向该清单。  
- 页面间跳转、返回与替换统一使用同模块既有 `router` 写法（如 `pushUrl` / `back` / `replaceUrl`），避免在同一流程中混入 `Navigation` 栈 API。

### 4.2 使用 `Navigation` 进行页面跳转管理

- 页面级 UI 需提供独立的 builder（如 `@Builder` 方法/函数）用于 `NavDestination` 渲染入口。  
- 在所属模块的 `module.json5` 中配置 `routerMap`，并建立到对应路由映射文件的引用，确保路由名可解析到目标 builder。  
- 通过 `NavPathStack`（或模块既有等价封装）管理前进/返回，避免与 `router.pushUrl` 混用同一页面栈。

### 4.3 选型与落地约束

- 默认策略：新增页面优先对齐本模块现有主路由方案；无明确迁移任务时，不主动切换路由体系。  
- 如需从 `router` 迁移到 `Navigation`：先补齐 `routerMap` 与 builder，再分阶段迁移入口，避免一次性混改导致回退路径不一致。

### 4.4 最小示例骨架（用于脚手架起步）

`router` 方式（页面级 UI）：

```ts
import { router } from '@kit.ArkUI';

@Entry
@Component
struct SettingsPage {
  build() {
    Column() {
      Text('Settings')
      Button('Back').onClick((): void => {
        router.back();
      })
    }
  }
}
```

`Navigation` 方式（builder + NavPathStack）：

```ts
import { NavPathStack } from '@kit.ArkUI';

@Builder
function SettingsPageBuilder() {
  SettingsPageContent();
}

@Component
struct SettingsPageContent {
  build() {
    Column() {
      Text('Settings')
    }
  }
}

@Component
struct RootWithNavigation {
  private pathStack: NavPathStack = new NavPathStack();

  build() {
    Navigation(this.pathStack) {
      Text('Home')
    }
    // 实际工程中将路由名映射到 SettingsPageBuilder，
    // 并在 module.json5 配置 routerMap 指向对应映射文件。
  }
}
```

**场景 G：从 A 页跳到 B 页** → 复制**同模块内最近一次**成功跳转的写法；仅把 path/参数换成本需求。

---

## 5. 列表与可变性

- 不可变展示列表、惰性列表，优先与官方指南中的 `LazyForEach` / 数据源模式一致（经 [arkts-basic-guide.md](arkts-basic-guide.md) 检索）；**不要**在约束不明时使用会破坏 ArkTS 类型要求的写法（经 [arkts-basic-rules.md](arkts-basic-rules.md) 打开官方适配规则，核对数组/类型相关条目）。  
- 列表的「行组件」**命名**见 §1.2，避免用 `*Page.ets` 作行级组件。
- 若列表存在“加载更多/分页追加”能力，**必须**使用 `LazyForEach` + 数据源（如 `IDataSource` 或项目内等价封装）实现增量渲染；不使用 `ForEach` 直接绑定可持续增长的大列表，避免在翻页场景中全量重建导致的卡顿与内存抖动。  
- 分页触底建议与同模块既有写法保持一致（如 `onReachEnd` 触发下一页请求）；新增数据应通过数据源增量通知（或项目等价机制）驱动 UI 更新，而非每次整表替换。
- 对“原始数据实体**原地修改字段**（如 `item.isRead = true`）”场景，需额外注意 `LazyForEach` 的 key 与刷新联动：若 `generateKey` 长期不变且行内对象非可观察对象，调用 `onDataChange` 可能不触发可见 UI 变化。  
- 推荐优先方案：列表项模型使用 `@Observed class`，行组件使用 `@ObjectLink` 绑定，实现字段级联动刷新；备选方案是让 key 构建包含会影响 UI 的动态字段（如已读态版本戳）以触发重建，但会带来节点重建成本，需评估性能与滚动稳定性。  
- 在生成任何列表组件（尤其 `LazyForEach` + `IDataSource`）时，必须向用户主动反馈该注意事项：当前方案是否依赖原地修改、key 如何构建、采用 `@Observed/@ObjectLink` 还是 key 变更策略，并说明取舍。

**场景 H：先 Mock 后接网** → 在 `*PageState` 或等效模型中预留数据字段，列表数据源类型**显式**，与后续接口模型对齐时减少重构面。
**场景 I：消息已读态点击后原地改 `isRead`，但 `id` 作为固定 key** → 可能出现 `onDataChange` 后 UI 不刷新；优先改为 `@Observed` 列表项 + `@ObjectLink` 行绑定，或在明确接受重建开销时调整 key 策略。

---

## 6. 与三份资料的关系

| 资料 | 作用 |
|------|------|
| [arkts-basic-rules.md](arkts-basic-rules.md) | 官方适配规则 **索引** — 打开后核对能否过编译。优先于本文。 |
| [arkts-basic-guide.md](arkts-basic-guide.md) | 官方指南 **索引** — 平台概念、控件按场景打开链接。 |
| **本文** | 团队可读性、可维护性**约定**；若与官方适配规则或工程冲突，**以工程 / 官方规则修正本文**。 |

---

## 7. 审阅/生码速查

- 新建/改名页面文件 → 是否 `*Page.ets`。  
- 单组件多 `@State`（≥5，且应同属一块 UI 模型）→ 是否已或应 `@Observed` 收束。  
- 列表/路由 → 是否与**同模块**现有模式一致。  
- `LazyForEach` 场景 → 是否已评估“原地修改 + 固定 key”导致不刷新的风险，并向用户明确推荐用法（`@Observed/@ObjectLink` 优先）。

有争议时在 PR/对话中 **引用本文章节号** 并 @ 本仓库**对标文件路径**。

---

## 8. 本文更新流程

| 触发场景 | 操作 |
|---------|------|
| 工程实现与本文约定冲突 | 以工程为准；在 PR/对话中标注冲突章节，确认后同步修正本文 |
| 新增团队约定 | 在对应章节补充「场景 X」示例，注明来源功能模块或 PR |
| 约定废弃 | 用 ~~删除线~~ 标注并注明替代写法，保留一个版本周期后删除 |
| 重大重构或架构调整后 | 全文与 `build-profile`、模块目录结构对照；差异项直接修订或提 issue |

**负责方**：接触受影响代码的开发者（含 AI agent）在同一 PR / 对话轮次内同步更新本文；不得延迟到"以后再补"。
