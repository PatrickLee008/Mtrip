# 商户入驻审批整改阶段 7 执行报告

日期：2026-09-15  
范围：在不修改 `merchant-app/**` 和 `client-app/**` 的前提下，完成注册、审批、激活、酒店物业发布到用户端消费接口的同库验收，并交付两个 App 的对接说明。

## 交付结果

- 新增 `scripts/test-merchant-onboarding-e2e.sh`，创建一次性数据库并将同一申请实体依次交给 merchant、goods、user 服务验证；脚本退出时删除整库，避免逐表清理遗漏。
- 注册链路覆盖邮箱 OTP、草稿、两家同名首批酒店、后台要求补正、原申请重交和基础批准。正式物业只通过 `source_business_id` 与各自 `applicationBusinessId` 一对一转换，同名不参与身份判断。
- KYC 链路覆盖当前条款阅读确认、电子签署、商户级文件、两家首批物业文件及全部范围批准；基础批准前不创建正式商户，全部范围和签署通过后才开放最终批准。
- 两个独立 PHP 进程使用同一 `requestId` 并发执行最终批准，只产生一个商户、一个 owner 账号和两家物业。真实默认邮件投递失败保留正式实体及加密 outbox，测试投递器重试后成功。
- 账号通过访问码、邮箱 OTP 和 Authenticator 完成激活，商户、owner 账号和申请账号状态在同一链路转为可用；登录后的 All Properties 返回两家首批物业。
- 第一家物业资料和房型分别形成批准版本与新待审版本，用户端始终读取批准投影。房型首次提交先驳回，再以新版本重交批准；第二家同名物业没有房型且不会误入结果。
- 第一家物业发布后，无排名也能进入普通搜索并返回 `ranking_id=0,rank=0`；详情、房型日历、评价和收藏均使用 `propertyId/roomTypeId`。首页推荐保持为空，证明排名榜单与普通搜索分离。
- 管理员暂停商户后酒店实时不可见，恢复后重新可见；商户下线物业后搜索移除、详情和新收藏返回 `40401`，重新发布后恢复。
- 新增 `docs/guides/api/商户入驻与酒店发布App接入包.md`，包含请求签名、接口顺序、请求示例、状态与字段表、错误码、联调数据构造和两个 App 的待办清单。
- 修正 `docs/guides/api/移动端接口规范.md` 中 `X-Timestamp` 的旧描述，使其与当前签名中间件实际使用的 Unix 秒时间戳一致。

## 同库主链路

```text
OTP 验证
  -> 注册草稿（两家首批物业）
  -> 注册补正与重交
  -> 基础注册批准
  -> 条款阅读与签署
  -> 商户 + 两家物业 KYC
  -> 并发最终批准
  -> 凭证失败与重试
  -> 账号激活
  -> All Properties
  -> 物业资料批准 + 待审新版本
  -> 房型驳回重交批准 + 待审新版本
  -> 发布
  -> 搜索 / 详情 / 日历 / 评价 / 收藏
  -> 商户暂停恢复
  -> 物业下线恢复
```

## 验证证据

- `bash scripts/test-merchant-onboarding-e2e.sh` 通过 56 项运行断言，包含三个服务内四个 PHP 文件的容器语法检查；一次性库退出后不存在。
- 阶段 2 注册 20 项、阶段 3 KYC 29 项、阶段 4 最终批准 19 项、阶段 5 认证 24 项，共 92 项专项断言全部通过。
- `bash scripts/test-merchant-onboarding-publication.sh` 通过阶段 6 的物业资料、排名、用户端、收藏和门票回归；阶段 6 主链路为 49 项，S5 排名发布、并发和站点隔离套件同时通过。
- Docker PHP 8.1.27 对 `backend` 下 381 个 PHP 文件执行 `php -l`，零语法错误。shared 纯逻辑测试 95 个用例、957 次断言全部通过。
- `merchant-web npm run build` 和 `admin-web npm run build` 通过，仅有既有大 chunk 警告。`client-app npm run typecheck` 通过；阶段 7 未编辑 App 文件。
- 当前 macOS 没有 `pwsh` 或 `powershell`，无法直接启动 `scripts/check.ps1`；已按脚本内容逐项完成 PHP lint、shared tests、admin-web build 和 client-app typecheck，四项均通过，并额外完成 merchant-web build。
- `bash scripts/db-migrate.sh --validate` 通过，共 15 个版本；`--status` 显示已执行 15、待执行 0。本阶段没有新增迁移或权限键。
- 真实签名网关冒烟通过统一成功响应、无排名酒店搜索及门禁失效后详情 `40401`。goods/merchant/user 主池和 App 池六个实例的 `healthz` 均返回 `status=ok`。
- 清理复核结果：`mtrip_onboarding_e2e_test` 数据库为 0，`stage6-%` 临时客户端为 0，`S6-%` 临时商户为 0。
- `bash -n scripts/test-merchant-onboarding-e2e.sh` 和 `git diff --check` 通过。

## App 接入边界

- Merchant App 注册、KYC、签署、状态查询、激活和登录后端接口已经可接；物业 KYC、资料、房型、房量和发布目前是 `/api/v1/merchant/*` Web 路由，后续移动端阶段应增加薄控制器/路由并复用现有服务和权限，不复制状态机。
- 用户 App 酒店接口已支持 `propertyId/roomTypeId`、无排名普通搜索、批准版本读取和实时上下线门禁；后续只做 App 代码接入与真机验收。
- `/api/v1/app/*` 保持 App 客户端签名和 `X-Site-Id`。所有登录后的单物业写请求继续要求 `X-Mtrip-Property-Id`，请求体中的 `propertyId` 不能代替该授权上下文。

## 未执行项

- 未执行 Merchant App 和用户 App 真机 UI 及商店包验收，因为本阶段明确不修改两个 App。
- 未执行真实 Google、SMTP、SMS 和推送提供商联调；当前环境没有相应生产级配置。失败 outbox、OTP 状态机和测试投递器路径已经验证。
- 未使用真实商户登录会话做浏览器端全链路视觉走查；服务、控制器和两套 Web 构建已验证，真实 UI 会话应与后续 App/端到端联调一起执行。

## 结论

整改计划阶段 0–7 的后端、管理端和 merchant-web 范围已完成。商户从申请到酒店对用户端可见的关键状态、实体映射、审批门禁、幂等和上下线行为已经形成可重复验收链路；剩余工作是两个 App 的代码接入、移动端物业经营路由适配及真实外部服务联调。
