# 13 - 商家端 merchant-web 落地

> 参考 admin-web 从零搭建平行的 merchant-web(Vue3+Vite+TS+antdv),为商户账号(`merchant_admin`,account_type 1集团/2商户/3门店)落地一套完整仿 admin 的动态 RBAC:独立四表菜单/角色,登录按 `account_type` 下发菜单树+权限集,接口权限继续由 `#[Permission]` 注解按 `perm_key` 联动(与前端 `v-perm` 同一把钥匙)。
> 承接 12-商家账号体系.md 的二期清单。

## 2026-09-01 注册业务切换与菜单上下文整改

- [x] 移除 `BasicLayout.vue` 中照搬原型的 3 家酒店、2 家餐厅假数据及无真实动作的“添加物业”入口。
- [x] `/api/v1/merchant/auth/menus` 在原有 `menus/perms` 基础上返回当前账号数据范围内、已关联正式商户且业务 KYC 已通过的 `businesses`；集团账号按集团可见商户汇总，门店账号只返回当前门店绑定业务。
- [x] 默认进入商户端时保持“全部业务”全局上下文，只展示 `merchant_menu.module_key=''` 的公共菜单；选择具体业务后追加展示与其 `business_type` 同名模块菜单。酒店现有专属菜单为客房管理、房量与价格；餐饮暂无专属页面，不伪造入口。
- [x] 切换业务后如果当前路由不再可见，自动回到 `/dashboard`；动态路由和后端权限仍使用完整授权菜单，不用前端选择替代后端鉴权。
- [x] PHP 语法检查、merchant-web `vue-tsc --noEmit` 与 Vite production build 通过；Docker Desktop Engine 返回 500，真实接口与登录后浏览器联调待 Docker 恢复后补验。

## 2026-08-28 商户工作台服务器内部错误修复

- 现象：GET `/api/v1/merchant/stats/dashboard`服务器内部错误。日志先报`Unknown column merchant_id`；本地开发库及隔离库缺marketing/07迁移。
- 数据修复：执行已有`database/marketing/07-merchant-promotion-owner.sql`，补两个归属字段及索引，重复执行通过。compose本已有初始化挂载；存量数据库不会靠重启MySQL重新执行初始化脚本，需要显式执行增量迁移。未删除数据，未把历史平台券猜测分配给商户。
- 继续执行真实查询还发现趋势使用已安装Hyperf不支持的`groupByRaw`。仅修改StatsController两处为`groupBy(Db::raw('DATE(pay_time)'))`，SQL按日分组口径保持不变。
- 新增`order-service/test/m12-dashboard.php`实际查询回归；scripts/test-m12.ps1显式升级测试库优惠券结构并加入看板测试。14项覆盖空数据、完整响应、7日趋势、非零金额与取消/其他商户排除、促销固定/相对有效期、草稿/暂停/结束/删除/未来/过期排除、集团站点与黑名单过滤、门店/空授权不越权。
- 结果：14项看板＋300项既有集成＝314项通过；58单测/858断言、两个变更PHP语法通过；订单服务重启后healthz正常。测试订单及优惠券夹具已清理。
- 复测入口：`scripts/test-m12.ps1`。原始失败及回归日志在本任务work/dashboard-before.log、work/dashboard-regression.log；本次仅保存表结构快照，不是业务数据备份。
- 不涉及前端改动；未进行浏览器登录态端到端验收。平台AdminStatsController存在同类方法调用，另行记录未改，不声称已修复平台统计。Git未暂存、未提交、未推送。

## 架构结论
- 三前端三账号体系独立:admin-web(`sys_admin`) / merchant-web(`merchant_admin`×3类型) / supplier-web(未来)。merchant-web 是"一个前端三种视图",按 `account_type` 裁剪菜单与数据范围。
- 菜单/权限完全 DB 驱动(不复用平台 `sys_menu`),弃用 `merchant_admin.role_perms` JSON 隐式方案,改用四表 RBAC;`role_perms` 列保留不再写入。
- 鉴权复刻 admin 链路,JWT 复用全平台 `MTRIP_JWT_SECRET`,claims 增加 `aud='merchant'`、`account_type`、`group_id`、`merchant_id`、`store_id`、`is_owner`。
- 权限透明复用:`MerchantAuthMiddleware` 同时写 `MerchantContext` 与 `AdminContext`(`is_super=false`,`permissions`=JWT 权限集),现有 `#[Permission]`/`PermissionAspect` 无需改动即对商户端生效。
- 数据范围:集团=本集团全部绑定商户及其门店/订单/商品;商户=本商户;门店=本门店。由 `MerchantContext::scopeMerchantIds()` 统一提供。

## 任务清单(本轮实施)

### 数据库(database/)
- [x] `merchant/05-merchant-rbac.sql`:四表 `merchant_menu`/`merchant_role`/`merchant_role_menu`/`merchant_admin_role`(`CREATE TABLE IF NOT EXISTS` 幂等)
- [x] `seed/04-merchant-menu.sql`:商家域菜单树 + 按钮 `perm_key` + `account_scope`;预设三条内置角色(集团/商户/门店管理员,`merchant_id=0,is_builtin=1`)及其菜单授权(`INSERT IGNORE` 幂等)

### 后端-shared(backend/shared/src/)
- [x] `Context/MerchantContext.php`:协程级主体上下文 + `scopeMerchantIds()` / `hasAnyPermission()`
- [x] `Middleware/MerchantAuthMiddleware.php`:校验 `aud==='merchant'`,写 MerchantContext + AdminContext 以复用 `#[Permission]`

### 后端-merchant-service
- [x] `Controller/Merchant/AuthController.php` + `Service/Merchant/MerchantAuthService.php`:`login/logout/me/menus/updatePassword`,按 account_type 过滤菜单树 + 权限集
- [x] `Controller/Merchant/AccountController.php`:子账号 列表/新增/改/启停/重置密码(限本主体)
- [x] `Controller/Merchant/RoleController.php`:角色 CRUD + 分配菜单 + 给子账号赋角色(只授本 account_type 可见菜单)
- [x] `Controller/Merchant/StoreController.php`:门店 列表/详情/新增/改/设主/启停(数据范围裁剪)
- [x] `Support/MenuTreeHelper.php`:菜单树构建
- [x] `config/routes.php`:`/api/v1/merchant/*` 路由组(挂 MerchantAuthMiddleware + OperationLogMiddleware),组外 `POST /api/v1/merchant/auth/login`

### 后端-跨服务商户口径接口
- [x] order-service `Controller/Merchant/OrderController.php`:订单 列表/详情/核销(强制主体范围)
- [x] goods-service `Controller/Merchant/GoodsController.php`:商品 列表/详情/新增/改/提交审核/上下架(强制主体范围)

### 网关(deploy/openresty/conf.d/mtrip.conf)
- [x] `map $merchant_module $merchant_upstream`:auth/account/role/store→merchant_service、order→order_service、goods→goods_service
- [x] `location ~ ^/api/v1/merchant/(?<merchant_module>[a-z-]+)(/|$)`:CORS/限流/`proxy_pass http://$merchant_upstream`

### 前端-merchant-web 骨架
- [x] 工程配置:`package.json`(mtrip-merchant-web)、`vite.config.ts`(port 5174)、`tsconfig*.json`、`index.html`、`.env.*`(`VITE_APP_TITLE=商家中心`)
- [x] 入口/路由/store/utils:`main.ts`、`App.vue`、`router/{index,guard,dynamic}.ts`、`stores/{index,user,app,tabs}.ts`、`utils/{http,auth,crypto,format}.ts`、`directives/perm.ts`
- [x] i18n/组件/布局:`locales/{index,zh-CN,en-US,menuI18n}.ts`、`components/{PageContainer,StatusTag,AmountText}.vue`、`composables/useTable.ts`、`layouts/{BasicLayout,AppHeader,SideMenu,TabsView}.vue`
- [x] 基础页:`views/{login,error/403,error/404,wip,dashboard}`
- [x] 改造点:localStorage 键 `mtrip_merchant_*`;api 前缀 `/merchant/*`;去平台站点树切换器改展示当前主体;`stores/user` 的 isSuper 语义换为 isOwner

### 前端-merchant-web 首批业务页(views/)
- [x] `account/index.vue`:子账号 列表/增改/启停/重置密码 + 赋角色(`mch:account:*`、`mch:role:grant`)
- [x] `role/index.vue`:角色 CRUD + 菜单授权树(`mch:role:add/edit/delete/assign`)
- [x] `store/index.vue`:门店 列表/详情/编辑/设主/启停(`mch:store:*`)
- [x] `order/index.vue`:订单 列表/详情/核销(`mch:order:verify`)
- [x] `goods/index.vue`:商品 列表/增改/提交审核/上下架(`mch:goods:*`)
- [x] `api/{account,role,store,order,goods}.ts`:对接各服务 `/merchant/*` 端点

## 验证
- [x] 后端 `php -l` 全量语法检查(PowerShell `ForEach-Object`):新增/改动文件 0 报错
- [x] 前端 `vue-tsc --noEmit` 类型检查:通过(EXIT=0)

## 2026-08-14 布局原型化改造(侧边栏 + 顶部菜单)

> 按 Figma 原型(big-plank-58319748.figma.site,Hotel Merchant Dashboard)重构主界面框架,与 admin-web 的 redesign 方向对齐;内容区业务页未动。

### 关键决策
- 移除多页签 TabsView(含 keep-alive),直接渲染当前路由;`stores/tabs.ts`、`layouts/components/TabsView.vue` 已删除,`router/guard.ts` 页签逻辑同步移除(与 admin-web 已撤页签的状态一致)
- 移除暗色模式与语言切换 UI(stores/app.ts 仅留 locale 持久化);App.vue 固定 defaultAlgorithm
- 侧边栏物业切换器(Property Switcher)照搬原型假数据:All Properties(Portfolio view)+ HOTELS 分组(The Horizon Resort/Blue Lagoon Boutique/Cityview Business Hotel)+ RESTAURANTS 分组(The Terrace Kitchen/Horizon Rooftop Dining)+ 底部 Add New Property;选中项浅蓝底+蓝色细边框高亮,选中后切换器显示对应物业;不接真实数据。菜单内容仍由后端动态菜单树驱动

### 落地文件
- `layouts/BasicLayout.vue`:flex 全高布局;228px 白底侧边栏(Logo mTrip/Merchant → 主体切换器 → 可滚动菜单 → 底部 Logout),右侧 56px Header + router-view
- `layouts/components/SideMenu.vue`:浅色分组菜单(大写分组标题 11px/600;菜单项 13px/500 圆角 8px;选中态 #EFF6FF+#2563EB;hover #F1F5F9;子项圆点指示器)
- `layouts/components/AppHeader.vue`:面包屑(mTrip › 当前页,resolveMenuTitle 解析)+ 176px 搜索框(视觉占位)+ 通知铃铛(红点占位)+ 蓝底圆头像用户下拉(保留改密/登出)
- 全局配色/字体对齐原型:主色 #2563EB、页面背景 #F4F6FB、边框 #E2E8F0、slate 文字层级;字体 Plus Jakarta Sans(index.html Google Fonts + theme.ts fontFamily);antd token borderRadius 8
- i18n:新增 header.searchPlaceholder/notifications;清理 tabs.*、app.language/darkTheme/lightTheme
- `components/PageContainer.vue` min-height 重算(去 tabs 40px,header 48→56)

### 验证
- [x] `vue-tsc --noEmit` 通过(EXIT=0)
- [x] dev server 启动正常(端口 5176);界面效果由用户自行验收
- 测试账号:m000001 密码已重置为 `Mtrip@2026`(原随机密码无人持有,直接 UPDATE bcrypt 落库)

## 升级说明
- 存量库依次执行 `database/merchant/05-merchant-rbac.sql` 与 `database/seed/04-merchant-menu.sql`(均幂等)。
- 后端 shared/merchant-service/order-service/goods-service 改动需重建对应 service 容器生效;网关改 `mtrip.conf` 后 reload OpenResty。
- merchant-web 首次运行需 `npm install`,开发端口 5174,经同一网关新增 `/api/v1/merchant` 前缀访问;生产二级域名/路径由运维决定,本轮只保证网关路由可达。

## 2026-08-23 全模块样式同步与入口补齐

> 用户明确:后续不只做 M5,需对 M2/M3/M5/M6/M8/M9/M10 一并检查;第一步先同步样式,优先 CSS 覆盖复用原有组件,缺失组件再实现。

### 落地文件
- `merchant-web/src/main.ts`:调整样式加载顺序,让项目覆盖层在 antd reset 后生效。
- `merchant-web/src/styles/index.less`:新增全局 antd 覆盖层,统一卡片/表单/按钮/表格/分页/Tag/Modal/Drawer 到 Hotel Merchant Dashboard 原型口径(白卡片、12px 圆角、`#E2E8F0` 边框、`#F8FAFC` 表头/筛选底、`#2563EB` 主按钮)。
- `merchant-web/src/components/PageContainer.vue`:页面留白调整为 `24px 28px`,背景保留 `#F4F6FB` 并加轻微蓝色氛围层。
- `database/seed/04-merchant-menu.sql`:补齐 PRD 待办模块入口:M2 客房管理、M3 房量与价格、M5 收益结算、M6 通知中心/设置、M8 营销活动、M9 评价管理、M10 帮助中心。组件尚未实现时按 `router/dynamic.ts` 回退 `views/wip/index.vue`。
- `merchant-web/src/locales/{zh-CN,en-US}.ts` 与 `menuI18n.ts`:补齐新增菜单词条与 WIP 提示。
- 新增专项文档:`docs/plans/实现方案-Merchant-全模块差距与样式同步.md`。

### 验证
- [x] `cd merchant-web && npm run build` 通过(EXIT=0;仅保留原 Vite chunk 体积警告)。

## 未尽事项(后续批次)
- 供应商端(supplier-web / supplier_admin)仍为占位,未在本轮。
- 商品新增表单为最小可用集(类型/名称/分类/供应商/封面/简介),SKU/退改规则等富字段沿用平台侧或后续补齐。
- 精细报表/导出、工作台真实统计接入留后续批次。

## 2026-08-23 M5/M6/M9/M10 首轮补齐

> 在全局样式同步后继续按用户要求推进"不只 M5"的增量:优先复用既有 antd/公共 CSS,缺失能力再补轻量组件与后端接口。

### 后端与数据库
- order-service 新增 `App\Controller\Merchant\StatsController`,路由 `/api/v1/merchant/stats/dashboard`,返回经营看板 KPI、趋势、物业表现、今日运营;商户范围统一用 `MerchantContext::scopeMerchantIds()`。
- finance-service 新增 `App\Controller\Merchant\EarningsController`,路由 `/api/v1/merchant/earnings/*`,支持收益总览、结算单列表/详情、商户申诉(`mch:earnings:dispute`)。
- merchant-service 新增 `App\Controller\Merchant\NotificationController`,路由 `/api/v1/merchant/notifications/*`,支持通知列表/统计/标记已读(`mch:notifications:read`)。
- goods-service 新增 `App\Controller\Merchant\ReviewController`,路由 `/api/v1/merchant/reviews/*`,支持评价列表/统计/回复(`mch:reviews:reply`)/标记平台复核(`mch:reviews:flag`),通过 `goods_info.merchant_id` 裁剪范围。
- 数据库补 `merchant_notify.read_at/read_by` 与 `goods_review.merchant_flag_*` 字段;新增 `database/merchant/22-merchant-web-notify-read.sql`、`database/goods/05-merchant-review-flag.sql` 并登记 `deploy/docker-compose.yml` initdb。

### 网关与前端
- `deploy/openresty/conf.d/mtrip.conf` 已在 `map $merchant_module` 登记 `stats`、`earnings`、`notifications`、`reviews` 上游。
- 前端新增 `api/{stats,earnings,notifications,reviews}.ts` 与 `views/{earnings,notifications,reviews,settings,support}/index.vue`;Header 铃铛接通知未读数并跳转 `/notifications`。
- M5 dashboard/earnings、M6 notifications/settings、M9 reviews、M10 support 文案均接入 `vue-i18n`;按钮权限与 `04-merchant-menu.sql` 对齐。

### 验证
- [x] `D:\BtSoft\php\81\php.exe -l` 检查新增/修改后端控制器与路由通过。
- [x] `cd merchant-web; npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告)。

## 2026-08-23 M8 营销活动首轮补齐

> 继 M5/M6/M9/M10 后,继续按“前后端一起开发、SQL 差异补脚本、公共 CSS 覆盖优先”的策略补齐 Merchant App PRD Module 8。

### 后端与数据库
- marketing-service 新增 `App\Controller\Merchant\PromotionController`,路由 `/api/v1/merchant/promotions/*`,支持 `summary/list/detail/add/update/publish/toggle-status/delete`。
- 写接口权限键为 `mch:promotions:add`、`mch:promotions:edit`、`mch:promotions:status`、`mch:promotions:delete`,已同步 `database/seed/04-merchant-menu.sql` 按钮种子。
- 商家活动复用 `marketing_coupon`,新增 `merchant_id` 与 `created_by_merchant_admin`;全新库已改 `database/marketing/01-marketing.sql`,存量库新增幂等迁移 `database/marketing/07-merchant-promotion-owner.sql`,并登记 `deploy/docker-compose.yml` initdb。
- 首轮强制 `goods_scope=3` 并校验所有 `goodsIds` 属于当前 `MerchantContext::scopeMerchantIds()` 范围,避免商家出资优惠影响其他商家。
- `deploy/openresty/conf.d/mtrip.conf` 已登记 `promotions -> marketing_service`;dashboard 的 `activePromotionCount` 已由占位改为读取当前有效商家活动。

### 前端
- 新增 `merchant-web/src/api/promotions.ts` 与 `merchant-web/src/views/promotions/index.vue`。
- 页面复用 antd + 公共 CSS 覆盖层,按 Hotel Merchant Dashboard PromotionsScreen 口径实现深蓝焦点卡、统计卡、筛选、表格、新建/编辑弹窗、发布/停发/删除操作。
- 适用商品复用既有 `apiGoodsList`,集团账号前端限制一个活动只选择同一商家的商品;按钮均使用 `v-perm` 对齐权限键。
- `merchant-web/src/locales/{zh-CN,en-US}.ts` 已补齐 M8 页面文案,无硬编码业务文案。

### 验证
- [x] `D:\BtSoft\php\81\php.exe -l` 检查 marketing-service 新控制器/路由与 order-service StatsController 通过。
- [x] `cd merchant-web; npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告)。

## 2026-08-23 M2/M3 客房与房量价格首轮补齐

> 按用户要求继续推进非 M5 模块,并强调“界面一定要跟原型一样”:本轮优先复用 antd + 公共 CSS 覆盖,只在页面级补缺失结构。

### 设计差距与方案
- 新增专项文档 `docs/plans/实现方案-Merchant-M2M3-客房与房量价格.md`,记录 RoomsScreen / AvailabilityScreen 与现有 merchant-web 的差距、接口契约、字段补齐、权限位、网关和 initdb 清单。
- M2 复用 `hotel_room_type` 作为房型子实体,补足房型编码、描述、成人/儿童容量、床数量、楼层、景观、吸烟、餐食/取消政策、周末价、加床价、首发库存、视频、发布流程状态等字段。
- M3 复用 `goods_daily_stock` 作为房量价格日历,补足最少/最多入住、CTA/CTD、库存来源、备注字段。

### 后端、数据库与网关
- goods-service 新增 `App\Controller\Merchant\RoomController`,路由 `/api/v1/merchant/rooms/*`,支持酒店选项、房型列表/详情、保存、上下架、删除;写接口权限 `mch:rooms:add/edit/status/delete` 已对齐菜单种子。
- goods-service 新增 `App\Controller\Merchant\AvailabilityController`,路由 `/api/v1/merchant/availability/*`,支持房型树、日历查询、单日保存、批量更新、变更日志、同步占位;写接口权限 `mch:availability:edit/bulk-update/sync` 已对齐菜单种子。
- `deploy/openresty/conf.d/mtrip.conf` 已登记 `rooms -> goods_service`、`availability -> goods_service`。
- `database/goods/01-goods.sql` 已覆盖新增字段;存量库幂等迁移 `database/goods/06-merchant-room-availability-fields.sql` 已新增并登记 `deploy/docker-compose.yml` initdb。

### 前端
- 新增 `merchant-web/src/api/rooms.ts`、`merchant-web/src/views/rooms/index.vue`:按原型实现酒店筛选、页面标题、搜索/状态筛选、房型表格、设施胶囊、封面占位、全页 Create/Edit Room Type 表单、媒体占位格、发布流程提示、固定底部动作条。
- 新增 `merchant-web/src/api/availability.ts`、`merchant-web/src/views/availability/index.vue`:按原型实现工具栏、PMS/CM 同步状态、图例、可横向滚动日历网格、单日编辑抽屉、Pricing Rules / Active Alerts 面板、Bulk Update 弹窗。
- `merchant-web/src/locales/{zh-CN,en-US}.ts` 补齐 `rooms.*` 与 `availability.*` 文案;新增按钮均使用 `v-perm`。

### 验证
- [x] `D:\BtSoft\php\81\php.exe -l` 检查新增 RoomController / AvailabilityController / routes.php 通过。
- [x] `cd merchant-web; npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告)。
