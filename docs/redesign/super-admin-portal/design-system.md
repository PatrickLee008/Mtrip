# Super Admin Portal 设计规范(Design System)

> 来源:`UI设计/Super Admin Portal`(React19 + Vite + Tailwind v4 + lucide-react 的 Figma 原型)。本文件提取**视觉令牌 + 布局 + 组件形态**,用于把 `admin-web`(Vue3 + **Ant Design Vue 4.x**)升级到新视觉;实现仍沿用现有列表页封装 / 弹窗表单 / 动态路由 / RBAC / i18n 体系。
>
> ⚠️ 更正:admin-web 实际 UI 库是 **Ant Design Vue**(`ant-design-vue`,组件前缀 `a-*`,主题经 `ConfigProvider` + `src/config/theme.ts`),**不是 Element Plus**。本仓库已有设计令牌层 `src/styles/index.less` 的 `--mtrip-*`,Phase 0 已扩展出 `--sap-*` 令牌。

## 技术栈差异(设计稿 → admin-web)

| 维度 | 设计稿(React 原型) | admin-web(落地实现) |
|---|---|---|
| 框架 | React 19 + Tailwind v4 | Vue 3 + Ant Design Vue 4.x |
| 路由 | 无路由库,`App.tsx` 用 `activePage` state 切换页面 | vue-router + 菜单驱动动态路由(`router/dynamic.ts`) |
| 图标 | lucide-react | `@ant-design/icons-vue` / 现有图标 |
| 数据 | 纯前端 mock(`src/data/platformData.ts`) | 真实微服务接口(网关 8081) |
| 图表 | 手写 SVG(sparkline / 折线 / 环形) | ECharts 或沿用轻量 SVG |
| 多语言 | 仅英文 + MMK 硬编码 | 中英双语 + 站点级货币(见"国际化") |

结论:**不迁移 React 代码**,只把设计令牌、信息架构、组件规范映射进 admin-web(Ant Design Vue)。

## 设计令牌(Design Tokens)

来源 `src/index.css @theme`。落地方式(Phase 0 已实施):在 `admin-web/src/styles/index.less` 的 `:root` 扩展 `--sap-*` 令牌,并在 `src/config/theme.ts` 的 `baseToken` 覆盖 Ant Design Vue 主题(`colorPrimary` 等)。

| Token | 值 | 用途 |
|---|---|---|
| `--color-navy` | `#0A1628` | 侧边栏导航底色 |
| `--color-navy-light` | `#112240` | 导航次级底 |
| `--color-navy-hover` | `#1A3352` | 导航 hover |
| `--color-brand` | `#1664FF` | 主色 / 主按钮 / 选中态 |
| `--color-brand-dark` | `#0E4FCC` | 主色按下态 |
| `--color-brand-light` | `#E6EFFE` | 主色浅底(选中背景) |
| `--color-surface` | `#F0F2F6` | 页面背景 |
| `--color-card` | `#FFFFFF` | 卡片 / 表格底 |
| `--color-border` | `#E3E8F0` | 描边 / 分隔线 |
| `--color-text` | `#1A2332` | 正文 |
| `--color-muted` | `#667085` | 次要文字 |
| `--color-success` / `-bg` | `#027A48` / `#ECFDF3` | 成功徽标(绿) |
| `--color-warning` / `-bg` | `#B54708` / `#FFFAEB` | 警告徽标(橙) |
| `--color-danger` / `-bg` | `#C01048` / `#FFF1F3` | 危险徽标(红) |
| `--color-info` / `-bg` | `#026AA2` / `#F0F9FF` | 信息徽标(蓝) |
| `--font-sans` | Inter | 正文字体 |
| `--font-mono` | JetBrains Mono | 数字 / ID / 金额 / 日期等宽 |

补充惯例:圆角 4–6px;侧栏宽 228px;顶栏高 56px;滚动条 5px 细窄(`#CBD5E1`);徽标数字用等宽字体、圆角胶囊。

## 布局结构

```
┌─ ImpersonationBanner(可选:商户代入横幅)────────────────┐
├─ Sidebar 228px 深色 ─┬─ Header 56px ───────────────────┤
│  logo + Super Admin  │  面包屑/标题 + 通知 + 语言 + 头像  │
│  环境徽标(Prod v4.2) ├──────────────────────────────────┤
│  三级导航             │  main 滚动区(各模块页面)          │
│  底部用户条 + Logout  │                                   │
└──────────────────────┴──────────────────────────────────┘
```

**三级导航**:Group(一级,深色高亮) > SubGroup(二级,如 Business Operations 下 Hotel/Restaurant Operations,可折叠、可加锁"Coming soon"占位) > Child(三级页面链接,选中左边框 2px 品牌色)。菜单项右侧 **badge 数字** = 待办量(验证 7、退款 5、库存告警 4、达人申请 3 等),颜色按紧急度(橙/红/紫/青)。EndUser 组特殊:含"Customer 360°"上下文区,选中某用户后其详情页组才可用(未选中置灰)。

映射到 admin-web:现有菜单是两级(目录>页面)。新设计有三级(个别组带 SubGroup)。落地时:一级/二级沿用 `sys_menu`;SubGroup 可用 `parent_id` 再加一层目录,或前端按分组标签渲染。badge 数字需后端提供待办计数接口。

## 通用组件规范 → Ant Design Vue 映射

| 设计稿组件 | 形态要点 | admin-web 落地(Ant Design Vue) |
|---|---|---|
| **StatCard(KPI 卡)** | 图标(带底色块)+ 大号等宽数值 + label + 环比徽标(TrendingUp/Down + %)+ 右上 sparkline(80×32 SVG)+ footer 说明 | 已新增 `components/StatCard.vue`(Phase 0) |
| **StatusBadge(状态徽标)** | 四类色:success 绿 / warning 橙 / danger 红 / info 蓝(带浅底);枚举文案下划线转连字符 | 复用现有 `components/StatusTag.vue`(`a-tag`,已支持 success/warning/error/processing/cyan/orange/purple/default);按模块补 `map` 枚举 |
| **DataTable(数据表)** | 表头 + 行 hover 变色 + 行内图标操作 + More 下拉菜单;等宽字体渲染 ID/金额/日期 | `a-table` + 现有列表页封装 |
| **FilterBar(筛选栏)** | 关键词搜索 + 若干下拉(状态枚举)+ 右侧结果计数 `{n} results` | `a-form` inline + `a-input`/`a-select` |
| **Pagination** | 每页 10;`Showing a–b of n` + 页码 | `a-table` 内置 pagination |
| **Tabs** | 子页切换(同一页面多 tab 复用数据源) | `a-tabs` 或菜单子项 |
| **Dialog** | variant:confirm/success/warning/danger;标题 + 文案 + 确认按钮(loading 态) | `Modal.confirm` / `a-modal` |
| **Drawer** | 右侧抽屉 560–600px;详情字段 2 列网格 + 时间线 + 底部操作 | `a-drawer` + `a-descriptions` + `a-timeline` |
| **Toast** | 4 类型 info/success/warning/error,右下角堆叠自动消失 | `message` / `notification` |
| **NotificationDrawer** | 通知抽屉:分类 + 未读计数 + 每条 severity 图标 + CTA | 新增组件 + 通知中心接口 |
| **Timeline(审计时间线)** | 图标节点(专属配色)+ 标题 + 备注 + 时间 + 操作者 chip;异常事件红色告警 | 新增组件(接后端审计日志) |
| **EmptyState** | 图标 + 文案 + 可选 CTA | 现有空状态 |
| **图表** | Spark(迷你走势)/ MiniChart(面积折线)/ DonutChart(环形进度),均手写 SVG | ECharts 或复刻 SVG |

## 交互模式

- **Impersonation(商户代入)**:超管可"以商户身份"进入,顶部常驻黄色横幅 + 退出按钮。→ 后端需支持代入令牌/审计。
- **Customer 360**:选中用户后侧栏出现其上下文卡,详情页组解锁,跨 tab 共享该用户。
- **通知抽屉 + Toast**:写操作后 Toast 反馈;通知中心承载待办/告警(需未读计数、跳转目标)。
- **badge 待办量**:导航实时反映各队列积压,需后端计数接口。

## 国际化与货币

- 保持中英双语,走 `admin-web/src/locales` + 菜单 `i18n_key`(目录/页面必填,按钮不占词条)。
- 货币**不写死**:做站点级配置(`sys_site_config` 或全局参数),前端按站点货币格式化;设计稿的 MMK / 英文作为目标站点默认样式。金额后端一律最小货币单位存储。

## 备注

- 设计稿多处 KPI 与派生字段为前端硬编码或按索引轮询(如验证队列 reviewer、退款 priority/method、对账 3%/1% 偏差、"Today's Bookings"142),**不可照抄假数据**,需后端提供真实聚合口径。
- 所有图表只需后端返回时间序列数值,渲染在前端。
- 通知中心 / 待办 badge / Impersonation / 审计时间线 是设计稿隐含的四项平台级能力,需要专门的后端支撑。
