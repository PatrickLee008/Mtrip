# 13 - 商家端 merchant-web 落地

> 参考 admin-web 从零搭建平行的 merchant-web(Vue3+Vite+TS+antdv),为商户账号(`merchant_admin`,account_type 1集团/2商户/3门店)落地一套完整仿 admin 的动态 RBAC:独立四表菜单/角色,登录按 `account_type` 下发菜单树+权限集,接口权限继续由 `#[Permission]` 注解按 `perm_key` 联动(与前端 `v-perm` 同一把钥匙)。
> 承接 12-商家账号体系.md 的二期清单。

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

## 未尽事项(后续批次)
- 供应商端(supplier-web / supplier_admin)仍为占位,未在本轮。
- 商品新增表单为最小可用集(类型/名称/分类/供应商/封面/简介),SKU/退改规则等富字段沿用平台侧或后续补齐。
- 精细报表/导出、工作台真实统计接入留后续批次。
