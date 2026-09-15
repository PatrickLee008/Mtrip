# 商户入驻审批整改阶段 6 执行报告

日期：2026-09-15  
范围：首批酒店物业与入驻结果衔接、物业资料和房型批准版本门禁、物业发布/下线、用户端普通搜索与排名语义收口。本阶段未修改 `merchant-app/**` 或 `client-app/**`。

## 交付结果

- 最终批准产生的每条 `merchant_application_business` 仍通过 `merchant_store.source_business_id` 与一家首批物业一对一映射。商户激活登录后，首批物业立即进入其授权物业范围和 All Properties，不重复创建。
- 物业资料提交审核时要求有效两位国家代码和城市键，避免资料批准后仍无法进入地区搜索。首次资料批准设置 `content_approved_version` 并打开 `display_enabled`；后续资料待审或驳回不覆盖旧批准投影，也不会重新打开管理员手工关闭的展示开关。
- 发布物业必须已通过物业 KYC、存在物业资料批准版本，并且至少有一个 `status=1,publish_status=2,approved_version>0` 的房型。首次发布同步将物业和经营状态设为可用；下线只关闭发布状态。
- 普通酒店搜索改为从全部合格物业取候选，再叠加已发布排名的默认顺序、置顶和推荐标记。无排名合格酒店可搜索，返回 `ranking_id=0,rank=0`；首页推荐仍只读已发布排名榜单。
- 搜索、详情、日历、评价和收藏资格共用实时发布门禁：商户状态、黑名单、物业状态、KYC、资料批准版本、发布状态、经营状态、展示开关、已批准在售房型缺一不可。详情和日历只读房型批准投影。
- merchant-web 的 All Properties 和物业资料页展示“待 KYC / 待资料审核 / 未发布 / 待平台开放展示 / 已下线 / 用户端可见”的实际状态，并计入已批准在售房型数，不再把单一 `publish_status=1` 解读为已对用户可见。

## 关键语义

```text
全部本站点酒店物业
  -> 实时发布门禁
  -> 普通搜索条件
  -> 叠加已发布排名（可选）
  -> 默认/用户指定排序
  -> 分页
```

`MarketplaceReader::searchable()` 是普通搜索候选集，`MarketplaceReader::published()` 是已发布推荐/排名快照。两者共用同一用户端安全投影和资格校验，但候选集语义不同。

## 验证证据

- `bash scripts/test-merchant-onboarding-publication.sh` 在一次性数据库上通过。阶段 6 主链路 49 项断言覆盖物业资料驳回/重交/批准、旧线上版本保留、首次批准和首次发布状态变化、房型批准版本门禁、无排名搜索、无范围搜索地区字段、排名与推荐分离、全部实时门禁、站点隔离、收藏和门票回归；S5 排名发布、并发和审计回归同时通过。
- 阶段 2–5 回归全部通过：注册草稿/基础审批 20 项、KYC/电子签署 29 项、最终批准 19 项、激活/多方式登录/恢复 24 项，合计 92 项。
- 真实签名网关冒烟验证过统一成功响应、无排名合格酒店返回和门禁失效后详情即时返回 `40401`；临时客户端、商户、物业和房型由 `finally` 清理。
- Docker PHP 8.1 对共享读取器、goods/merchant/user 控制器与服务、本阶段 PHP 测试文件的语法检查全部通过。`merchant-web npm run build`、`bash -n scripts/test-merchant-onboarding-publication.sh` 和 `git diff --check` 通过；前端仅有既有大 chunk 警告。
- `bash scripts/db-migrate.sh --validate` 通过，共 15 个迁移版本；`--status` 显示已执行 15、待执行 0。阶段 6 复用既有表字段、路由和权限键，没有新增数据库迁移或菜单权限。
- goods/merchant/user 主服务池和 App 服务池均已刷新，6 个 `healthz` 均返回 `status=ok`。数据库复核 `stage6-%` 客户端和 `S6-%` 商户均为 0。

## App 对接边界

- Merchant App 后续复用物业 KYC、资料版本、房型版本和发布接口，每个物业写请求显式带 `X-Mtrip-Property-Id`。
- 用户 App 后续保持 `propertyId/roomTypeId`，普通搜索直接使用服务端排序结果，不在客户端按排名配置二次过滤。
- 两个 App 的代码改造、联调数据和请求示例属于阶段 7 交接包，本阶段未启动。

## 已知边界

- 本地运行时同时存在 goods/merchant/user 主服务池和 App 服务池，共享类或控制器更新后需同时刷新相关服务池的 Hyperf 扫描缓存。
- 真实商户登录态下的浏览器端全链路走查、两家首批物业完整业务验收和 App 接入包在阶段 7 执行。
