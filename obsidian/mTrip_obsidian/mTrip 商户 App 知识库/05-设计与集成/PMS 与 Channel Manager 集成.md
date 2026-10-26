---
type: "prd-extract"
product: "mTrip Merchant App"
prd_version: "1.0.12"
imported_on: "2026-10-25"
source: "[[mTrip 商户 App 知识库/08-原始资料/mTrip_Merchant App PRD_v1.0.12_中文版|完整 PRD 原文]]"
tags: ["mtrip/merchant-app", "prd/v1-0-12"]
source_lines: "1457-1518"
source_sha256: "5b816f1446549282d133b214fd1e4807dc0dca261d876c21c631e0c13197ab18"
---

# PMS 与 Channel Manager 集成

> [!info] 原文摘录
> 来源：[[mTrip 商户 App 知识库/08-原始资料/mTrip_Merchant App PRD_v1.0.12_中文版|mTrip_Merchant App PRD_v1.0.12_中文版]]，第 1457–1518 行（按导入快照计）。
> 摘录保留原文措辞、表格和需求状态；仅调整图片相对路径。原文中的冲突请结合[[mTrip 商户 App 知识库/06-规划与治理/待澄清事项|待澄清事项]]阅读。

<!-- PRD_SOURCE_START:1457-1518 -->
### PMS 与 Channel Manager 集成

#### 场景 1 – PMS 直连集成

已拥有物业管理系统（PMS）和 Channel Manager 的酒店应能够通过受支持的 API 与 mTrip 商户平台集成。

集成应同步以下内容：

#### PMS 集成

- 酒店信息
- 房型
- 客房库存
- 预订状态
- 住客入住/退房状态（如受支持）

#### Channel Manager 集成

- 客房供应
- 价格与房价计划
- 房量配额分配
- OTA 库存同步
- 跨已连接在线旅行社（OTA）的预订同步

同步应根据受支持的集成能力自动进行，确保酒店数据在商户门户、PMS、Channel Manager 和已连接的 OTA 平台之间保持一致。

**场景 2 – 以 mTrip 商户平台作为 PMS**

没有现成物业管理系统（PMS）的酒店可以将 mTrip 商户平台作为其主要酒店管理系统。

商户应能够管理：

- 酒店信息
- 房型
- 客房库存
- 供应
- 价格
- 预订

当 Channel Manager 集成可用时，mTrip 商户平台可以与受支持的在线旅行社（OTA）同步库存、供应、价格和预订状态。

**场景 3 – 人工操作**

没有受支持 PMS 集成或 Channel Manager 集成的酒店应能够通过 mTrip 商户平台人工管理酒店运营。

商户应能够手动更新：

- 酒店信息
- 客房库存
- 供应
- 价格
- 预订状态

直至受支持的集成可用为止。

#### 业务规则

- 一家酒店同一时间只能使用一个库存来源，以防止库存冲突和超售。
- 启用 PMS 集成时，PMS 应作为库存和预订状态的主要事实来源。
- PMS 集成不可用时，mTrip 商户平台应成为主要事实来源。
- Channel Manager 同步仅对受支持的服务商和集成配置可用。

<!-- PRD_SOURCE_END -->

---

返回：[[mTrip 商户 App 知识库/00-知识库首页|00-知识库首页]] · [[mTrip 商户 App 知识库/09-导入记录/原文章节映射|原文章节映射]]

## 关联阅读

- [[mTrip 商户 App 知识库/03-功能模块/M02-酒店与客房管理|M02-酒店与客房管理]]
- [[mTrip 商户 App 知识库/03-功能模块/M03-供应、库存与定价|M03-供应、库存与定价]]
- [[mTrip 商户 App 知识库/03-功能模块/M04-预订管理|M04-预订管理]]
- [[mTrip 商户 App 知识库/05-设计与集成/技术考量与同步原则|技术考量与同步原则]]
