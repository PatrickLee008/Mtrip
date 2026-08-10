# Super Admin Portal 改造 — 部署/验证交付清单(DEPLOY)

> 本次改造全部为「可检视、低风险」的文件改动,尚未落库/构建验证(改造期间安全分类器不可用,shell/docker/构建被拦)。
> **分类器/shell 恢复后照本清单执行一次**即可完成验证与联调。全程在 win32 / PowerShell,命令分隔符用 `;`(禁用 `&&`)。
>
> 覆盖范围:文档全集 + Phase 0(菜单 IA 重组 + 设计令牌)+ Phase 1(商户验证)+ Phase 2(Affiliate + Referral)+ Phase 3(EndUser 360)+ 库存 04b + 帮助中心 12 + 平台规则 08 + 促销 Voucher/Code/Welcome 05 + Reports 自定义 10 + Platform Config 特性开关 11 + 零头补全。

---

## 0. 前置:确认 shell 已恢复

```powershell
! node -v          # 或 ! git status —— 能正常返回即说明分类器恢复
```

---

## 1. 数据库(二选一)

### 方案 A(推荐 · 开发环境彻底重建,会清数据)
所有新增 SQL 已登记进 `deploy/docker-compose.yml` 的 initdb 挂载(前缀 28 / 99b-99f),全新初始化会自动按序执行,菜单种子 `02-menu.sql` 为「先清后建」也会正确重排。

```powershell
cd deploy; docker compose down -v; docker compose up -d --build
```

### 方案 B(保留数据 · 增量 db-apply)
`scripts/db-apply.ps1` 幂等执行(新表 `CREATE TABLE IF NOT EXISTS`;`02-menu.sql` 自带 `DELETE` 重排;特性开关/菜单为 `INSERT IGNORE`)。**按下列顺序**一次性传入:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/db-apply.ps1 `
  database/merchant/07-verify-workflow.sql `
  database/merchant/08-compliance.sql `
  database/marketing/05-affiliate.sql `
  database/marketing/06-promotion-extras.sql `
  database/user/09-enduser-blacklist.sql `
  database/system/08-helpcenter.sql `
  database/system/09-feature-flag.sql `
  database/seed/02-menu.sql
```

> ⚠️ `02-menu.sql` 会 `DELETE FROM sys_role_menu; DELETE FROM sys_menu;` 后重排并重新授权超管(role 1)。**非超管角色重构后需在后台重新分配权限**;超管在 `hasAnyPermission` 中 bypass,不受影响。

**新增表一览**(8 个迁移文件):
- `merchant_verify_document` / `merchant_verify_timeline` / `merchant_blacklist` / `merchant_activity_log`(07)
- `platform_rule` / `merchant_violation` / `merchant_warning` / `compliance_history`(08 merchant)
- `affiliate_partner` / `affiliate_application` / `affiliate_program` / `affiliate_code` / `affiliate_commission_log` / `affiliate_withdraw` / `affiliate_fraud_flag`(05 marketing)
- `marketing_voucher` / `marketing_promo_code` / `marketing_welcome_reward`(06 marketing)
- `user_blacklist`(09 user;`user_info.status` 扩展 4=拉黑)
- `help_category` / `help_article` / `help_announcement` / `help_search_log`(08 system)
- `sys_feature_flag` + 9 开关种子(09 system)
- `merchant_info.status` 扩展 6=待重新提交(07 中说明,无需改表)

---

## 2. 后端 php -l 语法自检(落库前)

```powershell
php -l backend/services/merchant-service/app/Controller/VerifyController.php
php -l backend/services/merchant-service/app/Controller/PlatformRuleController.php
php -l backend/services/marketing-service/app/Controller/AffiliateController.php
php -l backend/services/marketing-service/app/Controller/PromotionController.php
php -l backend/services/user-service/app/Controller/Admin/AdminReferralController.php
php -l backend/services/user-service/app/Controller/Admin/AdminUserController.php
php -l backend/services/system-service/app/Controller/HelpController.php
php -l backend/services/system-service/app/Controller/FeatureController.php
php -l backend/services/order-service/app/Controller/Admin/AdminStatsController.php
```

---

## 3. 服务重启(网关 map 改动必须重启 gateway)

**网关路由表新增 3 个模块**(`deploy/openresty/conf.d/mtrip.conf`):`affiliate→marketing_service`、`help→system_service`、`compliance→merchant_service`。

方案 A 已 `up -d --build`,只需重启网关刷新 upstream:
```powershell
cd deploy; docker compose restart gateway
```

方案 B(仅改了代码/未重建镜像)—— override 已挂载本地代码,重启对应服务即可(约 2 秒):
```powershell
cd deploy; docker compose restart merchant-service marketing-service user-service system-service order-service gateway
```

> 服务重建过(IP 变)后 **必须重启 gateway**,否则网关缓存旧 IP 报 50200。

**各服务改动一览**:
- merchant-service:`VerifyController`(验证工作流 + 黑名单列表)、`PlatformRuleController`(规则/违规/警告/合规)、`MerchantController::update`(6→0 重提)、routes
- marketing-service:`AffiliateController`(达人 6 模块)、`PromotionController`(券/码/新客)、routes
- user-service:`AdminReferralController`、`AdminUserController`(customer360 + blacklist/unblacklist)、routes
- system-service:`HelpController`、`FeatureController`、routes
- order-service:`AdminStatsController::custom`、routes
- goods-service:**无改动**(库存复用现有 stock 接口)

---

## 4. 前端构建 / 类型检查

```powershell
cd admin-web; npm install; npx vue-tsc --noEmit    # 要求零 TS 报错
```

**前端改动一览**:
- 设计令牌:`config/theme.ts`(品牌 #1664FF + 语义色)、`styles/index.less`(`--sap-*`)、`layouts/BasicLayout.vue` + `layouts/components/SideMenu.vue`(navy 导航)、`components/StatCard.vue`(新)
- 路由:`router/dynamic.ts`(同 path 去重守卫,解决 /dashboard 重复)
- 新增页面(views):merchant/{verify,documents,activities,suspended,blacklisted}、affiliate/{applications,partners,program,wallet,fraud,codes,referral}、user/{profile,suspended,blacklist}、inventory/{overview,alerts,calendar}、helpcenter/{articles,categories,announcements,analytics}、compliance/{rules,violations,warnings,history}、marketing/{vouchers,codes,welcome}、config/features、stats/{custom,business}
- 新增 api:merchant(扩展)、affiliate、enduser、inventory、help、compliance、promotion、feature、reports

---

## 5. 质量基线(交付前必跑)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
# 1) backend 全量 php -l  2) shared 单测  3) admin-web build 零 TS  4) client-app typecheck
```

---

## 6. 起服务可视化冒烟(超管登录 http://localhost:8081 网关 / admin-web dev)

```powershell
cd admin-web; npm run dev     # 经网关 8081
```

逐项核对:
- [ ] 登录后侧栏出现 **18 组导航**(13 新模块 + 5 遗留组),深色 navy + 品牌蓝选中态
- [ ] 每个菜单项均打开可用页面,**无 WIP 占位**(零头已全部重指向/补页)
- [ ] 商户验证:pending → 详情抽屉(文档+时间线)→ Approve(弹出生成账号)/ Reject / Resubmit 闭环
- [ ] Affiliate:申请 Approve 生成达人;Partners 暂停/恢复;Codes 增删改;Program 规则增改;Wallet 提现打款;Fraud 处置;Referral 记录
- [ ] EndUser:Customer 360 输 ID 出头卡+6 Tab;Suspended/Blacklist 列表 + 恢复/移出
- [ ] 库存:Overview 聚合 / Alerts 低量 / Calendar 分日网格
- [ ] 帮助中心:文章/分类/公告 CRUD;搜索分析双榜
- [ ] 平台规则:规则 CRUD+发布 / 违规解决 / 警告签发撤销 / 合规历史
- [ ] 促销:Vouchers / Codes / Welcome CRUD
- [ ] Reports:Custom 构建器出表 + CSV 导出;Business 卡片跳转
- [ ] 平台配置:Feature Toggles 9 开关即改即存
- [ ] 无 vue-router「duplicate route」告警、无 50200

---

## 7. 已知事项 / 后续

- **非超管角色**:菜单重构后 perm_key/ID 变化,需在「用户与角色」重新分配权限(超管不受影响)。
- **RBAC 三处对齐**:新模块写接口的 `#[Permission]` ↔ `02-menu.sql` perm_key ↔ 前端 `v-perm` 已对齐;新增按钮后仍须三处同改。
- **Customer 360 容错**:`customer360` 对 order_main/marketing_coupon_receive/finance_account_entry 用 `safeRows` 容错(列名不符降级为空),联调时若某 Tab 空需核对该表 user 列名。
- **货币**:金额按站点货币配置 + 前端格式化,勿写死 MMK/¥;Feature Toggle `multi_currency` 为总闸。
- **遗留 WIP(改造前即 WIP,非本次范围)**:会员等级 `user/level`、税费 `finance/tax`、核销设备/规则 `verify/device|rule`、供应商报表 `supplier/report`——如需专项补齐另行排期。
- **未拆独立页(已由聚合/复用覆盖)**:内容管理主题编辑器深度版(基础 `cops/theme` 已有)、库存 timeline/detail 独立视图、EndUser bookings/transactions/rewards 独立页(Customer 360 Tab 已含)。

---

## 8. 参考

- 设计规范/功能/数据结构:`docs/redesign/super-admin-portal/`(design-system + data-structures + modules 01-13)
- 差异与计划:`docs/redesign/gap-analysis.md` / `docs/redesign/migration-plan.md`(含逐阶段进度表)
