# 14 - 供应商端 supplier-web 落地

> 参考 merchant-web 平行落地供应商自助端 supplier-web(Vue3+Vite+TS+antdv),为供应商账号(`supplier_admin`,单层 `supplier_id` 范围)落地一套完整的动态 RBAC:独立四表菜单/角色,登录下发菜单树+权限集,接口权限继续由 `#[Permission]` 注解按 `perm_key`(前缀 `sup:`)联动(与前端 `v-perm` 同一把钥匙)。
> 承接用户诉求:"落地供应商的管理前后端,供应商菜单也走 RBAC"。

## 架构结论
- 三前端三账号体系独立:admin-web(`sys_admin`) / merchant-web(`merchant_admin`×3类型) / supplier-web(`supplier_admin` 单层)。供应商无集团/门店/`account_type`,数据范围恒为 `supplier_id`,RBAC 比 merchant 显著简化(菜单无 `account_scope`)。
- 后端复用 merchant-service:新增 `Controller/Supplier/*` + `/api/v1/supplier/*` 路由组,不新建服务。
- 菜单/权限完全 DB 驱动,四表 RBAC:`supplier_menu`/`supplier_role`/`supplier_role_menu`/`supplier_admin_role`。
- 鉴权复刻 merchant 链路,JWT 复用全平台 `MTRIP_JWT_SECRET`,claims:`aud='supplier'` + `admin_id`/`admin_name`/`site_id`/`supplier_id`/`is_owner`/`permissions`。
- 主/子账号:主账号 `is_owner=1` 全权(前端 `isOwner` 短路放行所有 `v-perm`),子账号走角色授权。
- settle 只读:账单由平台生成/审核/回款,供应商端仅 `list/detail`;供应商无 store/order 功能(相关页与 api 已删除)。

## 任务清单(本轮实施)

### 数据库(database/)
- [x] `merchant/02-supplier.sql`:`supplier_info`/`supplier_goods`/`supplier_settle`(供货商品 + 结算账单)
- [x] `merchant/06-supplier-rbac.sql`:`supplier_admin` + 四表 `supplier_menu`/`supplier_role`/`supplier_role_menu`/`supplier_admin_role`(`CREATE TABLE IF NOT EXISTS` 幂等)
- [x] `seed/05-supplier-menu.sql`:供应商域菜单树 + 按钮 `perm_key`(`sup:*`);预设内置角色(`supplier_id=0,is_builtin=1`)及菜单授权(`INSERT IGNORE` 幂等);component 路径:`dashboard/index`、`account/index`、`role/index`、`goods/index`、`settle/index`

### 后端-shared(backend/shared/src/)
- [x] `Context/SupplierContext.php`:协程级供应商上下文 + `supplierId()` / `hasAnyPermission()`
- [x] `Middleware/SupplierAuthMiddleware.php`:校验 `aud==='supplier'`,写 SupplierContext + AdminContext 以复用 `#[Permission]`

### 后端-merchant-service(app/)
- [x] `Controller/Supplier/AuthController.php` + `Service/Supplier/SupplierAuthService.php`:`login/logout/me/menus/updatePassword`,下发菜单树 + 权限集
- [x] `Controller/Supplier/AccountController.php`:子账号 列表/新增/改/启停/重置密码(限本供应商)
- [x] `Controller/Supplier/RoleController.php`:角色 CRUD + 分配菜单 + 给子账号赋角色
- [x] `Controller/Supplier/GoodsController.php`:供货商品 列表/详情/新增/改/停供恢复/删除
- [x] `Controller/Supplier/SettleController.php`:对账结算 列表/详情(只读)
- [x] `config/routes.php`:`/api/v1/supplier/*` 路由组(挂 SupplierAuthMiddleware + OperationLogMiddleware),组外 `POST /api/v1/supplier/auth/login`

### 网关(deploy/openresty/conf.d/mtrip.conf)
- [x] `map $supplier_module $supplier_upstream`:auth/account/role/goods/settle→merchant_service
- [x] `location ~ ^/api/v1/supplier/(?<supplier_module>[a-z-]+)(/|$)`:CORS/限流/`proxy_pass http://$supplier_upstream`

### 前端-supplier-web 骨架(克隆自 merchant-web)
- [x] 工程配置:`package.json`(mtrip-supplier-web)、`vite.config.ts`(port 5175)、`index.html`、`.env.*`(`VITE_APP_TITLE=供应商中心`)
- [x] 存储键改造:`utils/auth.ts` TOKEN_KEY、`stores/{app,tabs}.ts`、`locales/index.ts` 全部 `mtrip_merchant_*`→`mtrip_supplier_*`;`login` REMEMBER_KEY 同步
- [x] i18n:`locales/{zh-CN,en-US}.ts` 全量重写(去 accountType/store/order/goods,增 supply/settle,menu 改 dashboard/org/account/role/supply/settle,header 增 ownerTag/subTag);`menuI18n.ts` 映射改供货商品/对账结算
- [x] 布局:`BasicLayout.vue`/`AppHeader.vue` 身份标签从三类型简化为主账号/子账号;`SideMenu.vue`/`TabsView.vue` 通用无需改
- [x] stores/user.ts:`SupplierProfile`,getter `isOwner`/`supplierId`,`hasPerm=isOwner||perms.includes`

### 前端-supplier-web 业务页(views/ + api/)
- [x] `account/index.vue` + `api/account.ts`:子账号 列表/增改/启停/重置密码 + 赋角色(`sup:account:*`、`sup:role:grant`)
- [x] `role/index.vue` + `api/role.ts`:角色 CRUD + 菜单授权树(`sup:role:add/edit/delete/assign`)
- [x] `goods/index.vue` + `api/goods.ts`:供货商品自助维护 供货底价/建议零售价/库存同步/停供恢复/删除(`sup:goods:*`)
- [x] `settle/index.vue` + `api/settle.ts`:对账结算 只读列表 + 详情抽屉(账期/订单数/分成/应结,状态 待审/已审/已回款/已驳回)
- [x] `dashboard/index.vue`:供应商 KPI(供货商品/供货中/已停供/待对账结算)
- [x] 删除供应商无关页与 api:`views/{store,order}`、`api/{store,order}`

## 验证
- [x] 后端 `php -l` 语法检查:Controller/Supplier/*(5)+ Service/Supplier/SupplierAuthService + shared SupplierContext/SupplierAuthMiddleware,共 8 文件 0 报错
- [x] 前端 `vue-tsc --noEmit` 类型检查:通过(EXIT=0);修复 `BasicLayout.vue` 遗留 `accountType` 引用

## 升级说明
- 存量库依次执行 `database/merchant/02-supplier.sql`、`database/merchant/06-supplier-rbac.sql`、`database/seed/05-supplier-menu.sql`(均幂等)。
- 后端 shared/merchant-service 改动需重建 merchant-service 容器生效;网关改 `mtrip.conf` 后 reload OpenResty。
- 前端 supplier-web 部署端口 5175;本地类型检查通过 junction 复用 merchant-web 的 `node_modules`,独立部署时需自行 `npm install`。
