# 实现方案 — Merchant M2/M3 客房管理与房量价格

> 需求基准:`设计文档/mTrip_Merchant App PRD_v1.0.md`；视觉基准:`UI设计/Hotel Merchant Dashboard` 的 `RoomsScreen` / `AvailabilityScreen`。  
> 更新时间:2026-08-23

## 1. 差距分析

| 模块 | 原型/PRD 要求 | 改造前 | 本轮落地 |
|---|---|---|---|
| M2 客房/房型 | 酒店选择、房型表格、房型新建/编辑全页表单、设施/媒体/价格/库存/政策、发布审核提示 | 只有 `/goods` 通用商品页,`/rooms` 为 WIP | 新增 `/rooms` 页面与 goods-service `/merchant/rooms/*`,复用 antd + 公共 CSS 贴近原型结构 |
| M3 房量价格 | 酒店/房型/日期筛选、PMS/CM 同步状态、图例、房量价格日历、单日抽屉、批量更新、定价规则/告警面板 | `/availability` 为 WIP;仅 admin 有库存接口 | 新增 `/availability` 页面与 goods-service `/merchant/availability/*`,复用 `goods_daily_stock` 并补 CTA/CTD/min/max stay 字段 |
| 数据模型 | 房型详情字段、首发库存、周末价、视频、日历限制项 | `hotel_room_type`/`goods_daily_stock` 字段不足 | `01-goods.sql` 覆盖新增字段,并补存量幂等迁移 `06-merchant-room-availability-fields.sql` |
| 权限/网关 | 写接口按钮权限、merchant 二级模块网关映射 | 只有 M2/M3 页面级权限 | 新增 `mch:rooms:*`、`mch:availability:*`;网关登记 `rooms/availability -> goods_service` |

## 2. 后端接口契约

### M2 `/api/v1/merchant/rooms/*`

- `GET /hotel-options`:当前商户范围内酒店商品下拉。
- `GET /list`:分页房型列表,筛选 `goodsId/keyword/status`,返回今日可售房量冗余字段。
- `GET /detail?id=`:房型详情,JSON 列解码为数组。
- `POST /save`:新增/编辑房型;`id` 为空走 `mch:rooms:add`,有 `id` 走 `mch:rooms:edit`。
- `POST /toggle-status`:在售/停售,权限 `mch:rooms:status`。
- `POST /delete`:软删房型,存在进行中订单禁止删除,权限 `mch:rooms:delete`。

### M3 `/api/v1/merchant/availability/*`

- `GET /options`:酒店/房型树。
- `GET /calendar`:返回酒店 → 房型 → 日期单元格,无 `goods_daily_stock` 记录时回落房型基础价/基础库存。
- `POST /save-day`:单日保存价格、可售房量、关房、CTA/CTD、min/max stay,权限 `mch:availability:edit`。
- `POST /batch-set`:按日期范围和多房型批量更新,权限 `mch:availability:bulk-update`。
- `GET /logs`:单日库存变更记录。
- `POST /sync-now`:PMS/CM 真实集成前的同步占位,权限 `mch:availability:sync`。

## 3. 数据库与隔离

- 房型继续挂 `goods_info(goods_type=1)` 下,用 `goods_info.merchant_id IN MerchantContext::scopeMerchantIds()` 强制裁剪数据范围。
- 门店账号暂不能按门店过滤,原因是 `goods_info` 无 `store_id`;本轮保持与既有商户商品管理一致,在文档中保留为后续数据模型补强项。
- `goods_daily_stock` 仍是 SKU 日期唯一键,新增限制字段不影响 C 端现有下单扣减逻辑。

## 4. 前端实现

- `merchant-web/src/views/rooms/index.vue`:对齐原型 `Room Types` 列表与 `Create Room Type` 全页表单;使用白卡、12px 圆角、紧凑表头、设施胶囊、媒体占位格、固定底部动作条。
- `merchant-web/src/views/availability/index.vue`:对齐原型日历布局;包含工具栏、同步状态、图例、可横向滚动日历、右侧单日抽屉、底部 Pricing Rules/Active Alerts、Bulk Update 弹窗。
- 文案新增 `rooms.*` 与 `availability.*` 中英文词条;按钮使用 `v-perm` 对齐新增权限键。

## 5. 验证

- `D:\BtSoft\php\81\php.exe -l backend\services\goods-service\app\Controller\Merchant\RoomController.php`
- `D:\BtSoft\php\81\php.exe -l backend\services\goods-service\app\Controller\Merchant\AvailabilityController.php`
- `D:\BtSoft\php\81\php.exe -l backend\services\goods-service\config\routes.php`
- `cd merchant-web; npm run build`

## 6. 后续遗留

- 平台审核流尚未消费 `hotel_room_type.publish_status`;当前只完成商家端提交状态记录。
- PMS/Channel Manager 同步为占位返回,后续需接第三方连接配置与异步任务。
- Pricing Rules 仍为前端展示面板,若要真实动态定价需新增规则表与计算服务。
- 若商品/房型要严格落到门店,需在 `goods_info` 或关系表补 `store_id` 后再把门店账号范围收窄到 `MerchantContext::scopeStoreId()`。
