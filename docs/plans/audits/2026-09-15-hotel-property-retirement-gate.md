# 酒店商品→物业映射审计报告

> 生成时间：2026-09-14 17:02:52 UTC  
> 数据库：`mtrip_business`  
> 映射来源：`ranking_listing(property_id, goods_id)` 与 `merchant_store_goods(store_id, goods_id)`  
> 原则：仅认可显式 ID 关系，不使用名称、地址、主门店标记或创建顺序推断。

## 全局摘要

| 指标 | 数量 | 退役门禁 |
|---|---:|---|
| `cross_merchant_pairs` | 0 | 通过 |
| `cross_site_pairs` | 0 | 通过 |
| `duplicate_goods_mappings` | 0 | 通过 |
| `duplicate_property_mappings` | 0 | 通过 |
| `hotel_goods` | 0 | 信息 |
| `hotel_goods_only` | 0 | 通过 |
| `hotel_properties` | 0 | 信息 |
| `invalid_explicit_pairs` | 0 | 通过 |
| `missing_entity_pairs` | 0 | 通过 |
| `property_only` | 0 | 信息 |
| `property_type_mismatches` | 0 | 信息 |
| `unclassified_stores` | 1 | 信息 |
| `unmapped_hotel_orders` | 0 | 通过 |
| `unmapped_room_types` | 0 | 通过 |
| `valid_explicit_mappings` | 0 | 信息 |

## 分站点摘要

| 站点 ID | 酒店物业 | 旧酒店商品 | 有效映射 | 仅物业 | 仅商品 | 未映射房型 | 未映射酒店订单 | 未分类门店 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

## 有效显式一对一映射

无有效显式映射。

## 仅物业

无已标注为酒店但没有旧商品映射的物业。

## 仅旧酒店商品

无未映射的旧酒店商品。

## 冲突或无效显式关系

无重复、跨站点、跨商户、缺失实体或非酒店关系。

## 未映射的房型

无未能解析到唯一物业的房型。

## 未映射的酒店订单

无未能解析到唯一物业的酒店订单。

## 未分类门店（不自动当作酒店）

| 门店 ID | 站点 ID | 商户 ID | 占位 | 占位 | 占位 |
|---|---|---|---|---|---|
| 1 | 7 | 1 | - | - | - |

## 退役门禁

**PASS**：旧酒店商品未映射、映射冲突、未映射房型和未映射酒店订单均为 0。

`property_type_mismatches` 可依已确定的酒店映射回填为 `hotel`；`unclassified_stores` 没有明确酒店证据，本报告不自动将其认定为酒店物业。
