# 库存与可用量（Inventory & Availability）

## 概述

平台超管对全平台**酒店房型库存**的监控:总览、可用量、房型库存明细、库存时间线、可用量日历、库存告警、库存报表。库存来源含商户后台/PMS/渠道管理器(三种同步源)。位于左侧导航 **Business Operations > Hotel Operations** 组(与 Bookings 同组)。

来源文件:`UI设计/Super Admin Portal/src/pages/InventoryPage.tsx`(~95KB,页面本地 mock)。

PageId 列表:
- `inventory` — Inventory Overview(总览)
- `inventory-availability` — Room Availability(房型可用量)
- `inventory-detail` — Room Inventory Detail(库存明细)
- `inventory-timeline` — Inventory Timeline(变更时间线)
- `inventory-calendar` — Availability Calendar(可用量日历)
- `inventory-alerts` — Inventory Alerts(告警)· badge 4
- `inventory-reports` — Inventory Reports(报表)

## 子页面 / Tabs

7 个子页面共享 `roomInventory`/`timelineEvents`/`inventoryAlerts` 三份 mock。

## 功能清单

### Inventory Overview（总览）
- KPI 9:Total Merchants / Total Hotels / Total Rooms / Available Rooms / Occupied Rooms / Occupancy Rate(%)/ Sold Out Room Types / Low Inventory Hotels(<10%)/ Inventory Updates(今日变更数)。
- 可用率热力(按酒店:≥90% 红 / 75–90% 橙 / <75% 蓝)。

### Room Availability / Room Inventory Detail
- 状态统计:Available / Low Inventory / Sold Out / Maintenance。
- 表格列:房型(id/merchant/hotel/city/roomType)、Total、Available、Occupied、Reserved、Blocked、Maintenance、Status(AvailBadge)、Sync Source(merchant_portal/pms/channel_manager)、Sync Status(synced/pending/failed)、Last Sync、Actions(View Details / View Timeline / Sync History)。
- 明细抽屉:库存分解(available/occupied/reserved/blocked/maintenance)+ 今日 check-in/check-out/remaining + 同步信息(Last Sync/Source/Status/Result)。

### Inventory Timeline（变更时间线）
- 事件流:time/date、merchant/hotel/roomType、eventType(inventory_increase/decrease/booking/checkout/sync/block/unblock/maintenance)、description、quantityChange(±N 或 null)、source(Merchant Portal/Customer Booking/PMS/Channel Manager)、updatedBy。

### Availability Calendar（可用量日历）
- 日历网格:每格显示某房型某日可用量,配色 available/low_inventory/sold_out/blocked。

### Inventory Alerts（告警）
- KPI:Open Alerts / High Priority / Acknowledged / Resolved Today。
- 表格列:priority(high/medium/low)、merchant/hotel/roomType、alertType(sold_out/low_inventory/sync_failed/maintenance/restored)、description、createdAt、status(open/acknowledged/resolved)、Actions(Acknowledge / Mark Resolved / View Timeline)。

### Inventory Reports
- 库存/入住率/同步状态/告警历史报表 + 导出。

## 数据结构

```typescript
interface RoomInventory {
  id; merchantId; merchantName; hotelId; hotelName; city; roomType
  totalRooms; available; occupied; reserved; blocked; maintenance
  status: 'available'|'low_inventory'|'sold_out'|'maintenance'
  lastSync; syncSource: 'merchant_portal'|'pms'|'channel_manager'
  syncStatus: 'synced'|'pending'|'failed'
}

interface TimelineEvent {
  id; time; date; merchantName; hotelName; roomType
  eventType: 'inventory_increase'|'inventory_decrease'|'booking'|'checkout'|'sync'|'block'|'unblock'|'maintenance'
  description; quantityChange: number|null; source; updatedBy
}

interface InventoryAlert {
  id; priority: 'high'|'medium'|'low'; merchantName; hotelName; roomType
  alertType: 'sold_out'|'low_inventory'|'sync_failed'|'maintenance'|'restored'
  description; createdAt; status: 'open'|'acknowledged'|'resolved'
}
```

### 实体 → 现有映射
RoomInventory→`goods_daily_stock`(按日期×房型可用量)+`hotel_room_type`;库存分解(occupied/reserved/blocked/maintenance)需扩展 `goods_daily_stock` 或新库存状态表;TimelineEvent→`goods_stock_log`(已有,扩展 eventType/source);InventoryAlert→新 `inventory_alert`。

## 状态机 / 流转

- 房型:`available → low_inventory → sold_out`;`→ maintenance ⇄ available`(block/unblock)。
- 同步:`synced / pending / failed`(失败重试)。
- 告警:`open → acknowledged → resolved`。

## 备注（后端缺口）

1. 库存明细(available/occupied/reserved/blocked/maintenance 五态)比现有 `goods_daily_stock`(单一 stock)更细,需扩展库存分解模型。
2. **三种同步源**(merchant_portal/pms/channel_manager)是关键:需 PMS/渠道管理器对接 + 同步状态/结果/重试(对应 Platform Config 的 PMS Integration / Channel Manager 卡)。
3. **库存告警**(sold_out/low_inventory/sync_failed 等)需新 `inventory_alert` 表 + 阈值配置(如 <10% low)+ 告警工作流(ack/resolve)。
4. 可用量日历/时间线需按日期×房型的时间序列数据 + 变更事件流(复用 `goods_stock_log`)。
5. 日期/城市为 mock(样例用缅甸城市),真实按商户酒店数据。
