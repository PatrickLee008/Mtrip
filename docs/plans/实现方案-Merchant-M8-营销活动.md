# 实现方案 — Merchant M8 营销活动

> 需求基准:`设计文档/mTrip_Merchant App PRD_v1.0.md` Module 8 Promotion & Campaign Management。
> 更新时间:2026-08-23

## 1. 差距分析

- **前端现状**:已有 `/promotions` 菜单入口,此前回退 WIP;Hotel Merchant Dashboard 原型提供 PromotionsScreen 的卡片+列表+新建活动口径。
- **后端现状**:marketing-service 已有平台端优惠券/活动/促销码能力,但缺 `/api/v1/merchant/promotions/*` 商家视角接口。
- **数据差距**:`marketing_coupon` 只有 `site_id`,无法区分平台券与商家自建券;商家自建券若直接使用 `goods_scope=0` 会影响全站商品。
- **隔离要求**:M8 必须使用 `MerchantContext::scopeMerchantIds()` 裁剪;首轮强制绑定 `goods_ids`,并校验所有商品属于同一商家,避免商家出资优惠外溢。
- **工程登记**:新增 merchant 二级模块 `promotions` 必须登记 `mtrip.conf`;新增 SQL 必须登记 initdb。

## 2. 实现方案

- **数据库**:
  - `database/marketing/01-marketing.sql` 为全新库补 `marketing_coupon.merchant_id` 与 `created_by_merchant_admin`。
  - 新增 `database/marketing/07-merchant-promotion-owner.sql` 为存量库幂等补列与 `idx_merchant_id`。
  - `deploy/docker-compose.yml` 登记为 `99e1-merchant-promotion-owner.sql`。
- **后端 API**:
  - 新增 `backend/services/marketing-service/app/Controller/Merchant/PromotionController.php`。
  - 路由前缀 `/api/v1/merchant/promotions`: `summary/list/detail/add/update/publish/toggle-status/delete`。
  - 写接口权限: `mch:promotions:add/edit/status/delete`,与 `database/seed/04-merchant-menu.sql` 按钮种子一致。
  - 新建/编辑统一设置 `funding_source=2`、`funding_rules={"merchant":100}`、`goods_scope=3`,并校验 `goodsIds` 全在当前 merchant 范围。
- **网关**:
  - `deploy/openresty/conf.d/mtrip.conf` 的 `map $merchant_module` 新增 `promotions marketing_service`。
- **前端**:
  - 新增 `merchant-web/src/api/promotions.ts`。
  - 新增 `merchant-web/src/views/promotions/index.vue`,复用 antd + 全局 CSS 覆盖层,实现统计卡、筛选、列表、新建/编辑弹窗、发布/停发/删除。
  - 适用商品复用 `apiGoodsList`,集团账号下前端限制单个活动只能选择同一商家的商品。
  - 文案补齐 `merchant-web/src/locales/{zh-CN,en-US}.ts`,按钮使用 `v-perm`。
- **联动**:
  - `order-service` 商户工作台 `activePromotionCount` 改为读取 `marketing_coupon` 当前有效的商家活动。

## 3. 验收

- `D:\BtSoft\php\81\php.exe -l backend/services/marketing-service/app/Controller/Merchant/PromotionController.php`
- `D:\BtSoft\php\81\php.exe -l backend/services/marketing-service/config/routes.php`
- `D:\BtSoft\php\81\php.exe -l backend/services/order-service/app/Controller/Merchant/StatsController.php`
- `cd merchant-web; npm run build`

以上均已通过;前端构建仅保留 Vite chunk 体积警告。

## 4. 后续

- 平台端可增加“商家标记/创建活动审核队列”,用于把商家发布从立即生效改为平台审核。
- C 端优惠券展示后续可显式展示商家名与适用物业,当前已通过 `goods_scope=3` 保证适用范围。
- M2/M3 完成后,可把促销活动按房型/日期库存做更细颗粒度限制。
