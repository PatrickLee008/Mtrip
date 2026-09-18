# 商户入驻与酒店发布 App 接入包

2026-09-15 后台代办补充：后台已支持新流程商户/首批物业 KYC 代传和统一提交。开发环境超管可记录协议测试确认，协议响应新增 `status=test_confirmed` 和 `satisfied`；App 对测试记录应明确展示为测试确认，不能当作真实商户签名。生产环境不接受测试确认。后台入口、请求字段和权限见[代办说明](../../plans/audits/2026-09-15-admin-assisted-onboarding-kyc.md)，本次未修改 App 代码。

> 版本：v1.0（商户入驻审批整改阶段 7，2026-09-15）  
> 范围：Merchant App 注册/KYC/激活，以及 Merchant App 后续物业经营和用户 App 酒店消费链路的接口交接。阶段 7 未修改 `merchant-app/**` 或 `client-app/**`。

## 1. 当前可接入范围

| 客户端 | 能力 | 当前后端状态 | App 工作状态 |
|---|---|---|---|
| Merchant App | 注册 OTP、草稿、多首批物业、条款签署、KYC、状态查询 | `/api/v1/app/merchant/*` 已实现 | 待 App 接入 |
| Merchant App | 账号激活、邮箱/短信/访问码/Google 登录、恢复 | `/api/v1/app/merchant/*` 已实现；真实 Google、SMTP、SMS 配置待联调 | 待 App 接入 |
| Merchant App | 物业 KYC、资料、房型、房量、发布 | 业务接口已在 `/api/v1/merchant/*` 实现，当前供 merchant-web 使用 | 待后续 App 阶段增加移动端路由适配后接入 |
| 用户 App | 酒店搜索、详情、房型日历、评价、收藏 | `/api/v1/app/*` 已实现 | 待 App 接入/复核 |

移动端不得直接把 `/api/v1/merchant/*` 当成最终 Merchant App 契约。后续 App 阶段应增加薄路由适配，复用现有服务层、商户 JWT、权限键和物业范围门禁，不复制业务逻辑。

## 2. 通用请求约定

所有 `/api/v1/app/*` 请求都必须携带：

| Header | 规则 |
|---|---|
| `X-Site-Id` | 正整数站点 ID；Token 中的站点优先，客户端不能用请求体改站点 |
| `X-Client-Id` | 后台分配且已启用的 App 客户端 ID |
| `X-Timestamp` | Unix 秒时间戳 |
| `X-Nonce` | 每次请求唯一的随机串，重复使用会被拒绝 |
| `X-Sign` | 小写 hex HMAC-SHA256 |
| `X-Client-Type` | `app-ios`、`app-android` 或 `app-h5` |
| `Authorization` | 登录后使用 `Bearer {token}`；公开注册和激活接口不需要 |

签名原文为：

```text
clientId + UPPERCASE(method) + pathWithoutQuery + timestamp + nonce
```

`X-Sign = HMAC-SHA256(ClientSecret, 签名原文)`。签名路径不包含 query string，请求体也不参与当前签名。客户端密钥必须进入 iOS Keychain/Android Keystore 或受保护的运行时配置，不写日志。

统一成功响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

分页响应的 `data` 固定为：

```json
{
  "list": [],
  "total": 0,
  "page": 1,
  "pageSize": 10
}
```

## 3. Merchant App 入驻顺序

### 3.1 OTP 与注册草稿

后台代录为独立入口：`POST /api/v1/admin/merchant/onboarding/add` 要求 `registrationPhone`（E.164）和 `registrationEmail`，默认由管理员确认，保存 `registration_channel=admin` 并审计操作人；凭证投递到该注册邮箱，物业联系人独立保存。此路径无需注册 OTP，但仍要求基础注册/KYC/协议审批与账号激活 OTP。公共 App 注册接口继续只接受 `email/sms`，不得发送 `admin` 或自行设置确认状态。最终批准 readiness 现包含联系方式完整性，缺失原因 `registration_contacts_not_verified`。

| 顺序 | 方法与路径 | 关键请求 | 成功后保存 |
|---|---|---|---|
| 1 | `GET /api/v1/app/merchant/register/config` | 无业务参数 | 可用 OTP 渠道 |
| 2 | `POST /api/v1/app/merchant/register/otp-send` | `phone,email,otpChannel` | 冷却倒计时 |
| 3 | `POST /api/v1/app/merchant/register/otp-verify` | `phone,email,otpChannel,otpCode` | `registrationToken,applicationId` |
| 4 | `POST /api/v1/app/merchant/application/save` | `registrationToken` 与 `application` 对象 | 每条业务的 `applicationBusinessId` |
| 5 | `GET /api/v1/app/merchant/application/detail` | `registrationToken,applicationId` | 草稿和完成度 |
| 6 | `POST /api/v1/app/merchant/application/submit` | `registrationToken,applicationId` | `registrationStatus=submitted` |
| 7 | `GET /api/v1/app/merchant/application/status` | `registrationToken,applicationId` | 注册/KYC/账号三个独立状态 |

OTP 请求示例：

```http
POST /api/v1/app/merchant/register/otp-verify
Content-Type: application/json
X-Site-Id: 1
X-Client-Id: merchant-ios
X-Timestamp: 1789459200
X-Nonce: 6f62395172d84d56
X-Sign: {signature}

{
  "phone": "+959123456789",
  "email": "owner@example.com",
  "otpChannel": "email",
  "otpCode": "123456"
}
```

两家首批酒店的草稿保存示例：

```json
{
  "registrationToken": "{registrationToken}",
  "application": {
    "applicationId": 101,
    "merchantName": "Example Travel Group",
    "companyName": "Example Travel Co., Ltd.",
    "regNumber": "COMPANY-2026-001",
    "country": "Myanmar",
    "address": "Yangon",
    "currentStep": 4,
    "businesses": [
      {
        "clientRef": "device-uuid-hotel-1",
        "businessName": "Example Hotel",
        "businessType": "hotel",
        "countryCode": "MM",
        "cityKey": "yangon",
        "city": "Yangon",
        "address": "Property address 1",
        "contactName": "Owner Name",
        "contactPhone": "+959123456789",
        "contactEmail": "owner@example.com"
      },
      {
        "clientRef": "device-uuid-hotel-2",
        "businessName": "Example Hotel",
        "businessType": "hotel",
        "countryCode": "MM",
        "cityKey": "yangon",
        "city": "Yangon",
        "address": "Property address 2",
        "contactName": "Owner Name",
        "contactPhone": "+959123456789",
        "contactEmail": "owner@example.com"
      }
    ]
  }
}
```

首次保存后，用服务端返回的 `applicationBusinessId` 更新对应业务。`clientRef` 只解决首次保存重试，不能替代正式 ID。后台要求补正时，`registrationStatus=resubmit_required`；App 允许继续保存并再次提交，原 `applicationId` 不变。

### 3.2 条款与 KYC

| 顺序 | 方法与路径 | 关键请求 | 说明 |
|---|---|---|---|
| 1 | `GET /application/kyc-requirements` | `registrationToken,applicationId` | 动态读取商户级和每家首批物业要求 |
| 2 | `GET /agreements/current` | 同上 | 读取当前生效条款及摘要 |
| 3 | `POST /agreements/read-confirm` | 加 `agreementId,version,scrollConfirmed=true` | 返回 30 分钟有效 `readReceipt` |
| 4 | `POST /agreements/sign` | 加签署人和 Base64 PNG/JPEG `signature` | 固化条款版本、摘要、IP 和 User-Agent |
| 5 | `POST /kyc/upload` | multipart 文件与范围字段 | 每个范围按模板上传 |
| 6 | `POST /kyc/submit` | `registrationToken,applicationId` | 一次提交当前可编辑且资料齐全的范围 |
| 7 | `GET /application/status` | 同上 | 根据驳回原因替换文件并重交 |

接口表中的短路径均接在 `/api/v1/app/merchant` 后。商户级上传使用 `scopeType=merchant,applicationBusinessId=0`；首批物业上传使用 `scopeType=property` 和服务端返回的 `applicationBusinessId`。此时还没有 `propertyId`。

```http
POST /api/v1/app/merchant/kyc/upload
Content-Type: multipart/form-data

registrationToken={registrationToken}
applicationId=101
scopeType=property
applicationBusinessId=1002
docType=hotel_license
file=@hotel-license.pdf
```

状态查询必须分别处理：

| 字段 | 主要枚举 | App 行为 |
|---|---|---|
| `registrationStatus` | `draft/submitted/under_review/resubmit_required/approved/rejected` | 补正只回注册表单 |
| `merchantKycStatus` | `locked/draft/submitted/under_review/resubmit_required/approved/rejected` | 只重传商户级被退文件 |
| `initialProperties[].kycStatus` | 同 KYC 枚举 | 按 `applicationBusinessId` 重传对应物业文件 |
| `accountStatus` | `not_created/pending_activation/active` | 只有最终批准后进入激活 |
| `finalApproval.ready/reasons` | Boolean + 原因数组 | 仅展示进度，最终批准由管理员执行 |

### 3.3 最终批准与激活

测试选项：部署先设置 `MTRIP_MERCHANT_AUTH_TEST_ALLOWED=true` 并重建服务，再由超级管理员在“系统配置 → 全局参数 → 安全配置”开启 `merchant_auth_test_mode`。仅非 `prod/production` 环境且两道开关同时开启时生效；生产环境始终拒绝。生效后最终批准跳过外部投递，后台通过 `POST /api/v1/admin/merchant/onboarding/test-credentials`（`{id}`，超管＋最终批准权限）查看待激活凭证。普通详情不返回临时密码。认证配置及 OTP challenge 的 `testMode=true` 表示邮箱/短信 OTP 仍须先请求验证上下文，随后使用 `000000`；注册、激活、登录和恢复均支持，关闭任一道开关后既有测试上下文失效。Authenticator/Google 不受此开关替代。App UI 只能根据服务端 `testMode` 展示提示，不能把固定码写成生产逻辑。详见[运行时开关说明](../../plans/audits/2026-09-18-merchant-auth-runtime-toggle.md)。

管理员最终批准后，后端一次创建 `merchant_info`、待激活 owner 账号和全部首批 `merchant_store`，并通过 outbox 投递访问码/用户名/临时密码。邮件或短信失败不会回滚实体；管理员从后台重试失败投递。

激活顺序：

1. `POST /api/v1/app/merchant/activation/start`，提交 `accessCode`，或 `username + temporaryPassword`。
2. `POST /api/v1/app/merchant/activation/otp-send`，提交上一步 `activationToken` 和 `channel=email|sms`。
3. `POST /api/v1/app/merchant/activation/otp-verify`，提交 `challengeToken,otpCode`，保存响应中的新 `activationToken`。
4. 可选调用 `/activation/totp/setup`、`/activation/totp/verify` 关联 Authenticator。
5. 可选调用 `/activation/google-link` 关联 Google。
6. `POST /api/v1/app/merchant/activation/finish`，取得工作台 JWT。

激活完成后，一次性临时密码失效。访问码格式为酒店 `HXXXXX`、租车 `CXXXXX`，输入不区分大小写；访问码不能单独登录，必须再验证 Authenticator。

再次登录使用：

```json
{
  "method": "email",
  "identifier": "owner@example.com"
}
```

发送到 `POST /api/v1/app/merchant/auth/challenge`；再将 `method,challengeToken,otpCode` 发送到 `/auth/challenge/verify`。`method` 可为 `access_code/email/sms/google`，Google 挑战还需 `googleIdToken`。

## 4. Merchant App 物业经营适配

以下服务能力已实现，但移动 App 路由适配尚未实施：

| 能力 | 当前 Web 路径 | 后续 App 建议路径 | 关键范围 |
|---|---|---|---|
| 物业列表/状态 | `GET /api/v1/merchant/properties/list` | `GET /api/v1/app/merchant/properties/list` | owner 可看全部授权物业 |
| 新增物业草稿 | `POST /api/v1/merchant/properties/save` | `POST /api/v1/app/merchant/properties/save` | 返回正式 `propertyId` |
| 物业 KYC | `/properties/kyc*` | 同结构加 App 前缀 | 写请求带物业头 |
| 物业资料 | `/properties/profile*` | 同结构加 App 前缀 | 草稿/待审不覆盖批准版本 |
| 房型 | `/api/v1/merchant/rooms/*` | `/api/v1/app/merchant/rooms/*` | `propertyId/roomTypeId` |
| 房量 | `/api/v1/merchant/availability/*` | `/api/v1/app/merchant/availability/*` | 只允许已授权房型 |
| 发布/下线 | `POST /api/v1/merchant/properties/publish` | `POST /api/v1/app/merchant/properties/publish` | `propertyId,enabled=1|0` |

所有单物业写请求必须同时满足：

```text
Authorization: Bearer {merchantJwt}
X-Mtrip-Property-Id: {propertyId}
```

请求体中的 `propertyId` 只标识业务对象，不能代替 `X-Mtrip-Property-Id` 的单物业授权上下文。后续适配控制器应直接复用 `PropertyKycService`、`PropertyProfileService`、`RoomReviewService` 和现有 Permission 键。

房型提交示例中的 `publishStatus=1` 表示提交审核：

```json
{
  "propertyId": 501,
  "roomName": "Deluxe King",
  "roomCode": "DLX-KING",
  "bedType": "King",
  "area": "36",
  "basePrice": 120,
  "baseStock": 6,
  "launchStock": 4,
  "images": ["/uploads/rooms/202609/example.jpg"],
  "status": 1,
  "publishStatus": 1
}
```

物业发布前必须满足物业 KYC 已批准、物业资料有批准版本、至少一个在售房型有批准版本。首次发布会打开物业和经营状态；下线只改变发布状态。管理员暂停商户、物业停业、平台关闭展示或最后一个房型停售时，用户端会实时不可见。

## 5. 用户 App 酒店接口

| 方法与路径 | 入参 | 返回重点 |
|---|---|---|
| `GET /api/v1/app/hotels/list` | `countryCode,cityKey,keyword,page,pageSize` 及筛选排序字段 | 酒店物业分页 |
| `GET /api/v1/app/hotels/detail` | `propertyId` | 批准物业资料、`roomTypes`、退款规则、评价摘要 |
| `GET /api/v1/app/hotels/calendar` | `propertyId,roomTypeId,startDate,days` | 每日价格、库存、关闭状态 |
| `GET /api/v1/app/hotels/reviews` | `propertyId,page,pageSize` | 物业评价分页 |
| `POST /api/v1/app/hotels/review/add` | 登录态；`orderId,rating,content,images` | 评价提交结果 |
| `GET /api/v1/app/user/favorite/list` | 登录态；分页 | 收藏物业分页 |
| `POST /api/v1/app/user/favorite/add` | 登录态；`propertyId` | 幂等收藏 |
| `POST /api/v1/app/user/favorite/remove` | 登录态；`propertyId` | 幂等取消 |

搜索示例：

```http
GET /api/v1/app/hotels/list?countryCode=MM&cityKey=yangon&page=1&pageSize=10&sortBy=price_asc
X-Site-Id: 1
X-Client-Id: consumer-ios
X-Timestamp: 1789459200
X-Nonce: ed93ac7c73ce47d0
X-Sign: {signature}
```

无排名但满足发布门禁的酒店仍在普通搜索中，固定返回：

```json
{
  "property_id": 501,
  "ranking_id": 0,
  "rank": 0,
  "pinned": 0,
  "featured": 0
}
```

App 必须使用服务端列表顺序，不能用是否存在 `ranking_id` 二次过滤。首页推荐仍读取独立的已发布排名榜单。

### 5.1 标识字段表

| 场景 | 请求字段 | 响应兼容字段 | 禁止建立的新依赖 |
|---|---|---|---|
| 酒店物业 | `propertyId` | `property_id`、详情 `id` | 酒店 `goodsId/goods_id` |
| 酒店房型 | `roomTypeId` | `room_type_id`、房型 `id` | 酒店 `skuId/sku_id` |
| 门票商品 | `goodsId` | `goods_id/id` | 不适用物业 ID |
| 门票票种 | `skuId` | `sku_id/id` | 不适用房型 ID |

同名酒店、同名房型只能按 ID 区分。收藏、评价、订单和酒店营销范围继续传 `propertyId/roomTypeId`。

## 6. 错误码与客户端动作

| code | HTTP | 含义 | 客户端动作 |
|---|---:|---|---|
| `40001` | 400 | 参数错误 | 留在当前页并展示服务端 message |
| `40021` | 400 | OTP 不正确 | 保留 challenge，允许剩余次数内重填 |
| `40022` | 400 | OTP 不存在、过期或已使用 | 返回发码步骤 |
| `40101` | 401 | Token/激活凭证无效 | 清理对应 Token，重新认证 |
| `40103` | 401 | App 客户端签名失败 | 检查时钟、nonce、路径和客户端配置 |
| `40301` | 403 | 缺少操作权限 | 隐藏/禁用动作并刷新权限 |
| `40302` | 403 | 跨站、跨商户或跨物业 | 刷新物业范围，禁止自动改 ID 重试 |
| `40401` | 404 | 资源不存在或酒店已不可见 | 酒店页显示下线状态并返回列表 |
| `40901` | 409 | 状态冲突、门禁未满足或版本冲突 | 刷新最新状态后由用户决定是否重试 |
| `42911` | 429 | OTP 冷却或日限额 | 使用返回/配置的冷却时间倒计时 |

## 7. 联调数据构造

1. 后台配置站点、Merchant App/用户 App 客户端及邮件或短信 OTP 渠道。
2. Merchant App 用唯一手机号和邮箱完成 OTP，保存两家同名酒店，记录两个不同 `applicationBusinessId`。
3. 管理员要求一次注册补正；App 修改后用原申请重交；管理员批准基础注册。
4. App 签署当前条款，分别上传商户级和两家首批物业 KYC；管理员驳回其中一个文件后重交并全部批准。
5. 超管用稳定 `requestId` 最终批准；确认重复请求只创建一个商户、一个 owner 账号和两家物业；模拟一个投递通道失败并从后台重试。
6. 商户用收到的凭证完成 OTP 激活，登录后确认两家物业均存在且 `propertyId` 不同。
7. 第一家物业提交资料和房型；分别执行一次驳回重交并批准，再提交新待审版本，确认用户端仍读取旧批准版本。
8. 发布第一家物业；不要创建排名；用户 App 验证搜索、详情、日历、评价和收藏。第二家同名物业不能混入结果。
9. 商户下线第一家物业，验证搜索移除、详情 `40401`、不能新增收藏；重新发布后恢复。

本仓库可用 `bash scripts/test-merchant-onboarding-e2e.sh` 在一次性数据库中自动构造并验证上述主链路。脚本只生成测试凭证，不能把测试访问码、OTP 或临时密码用于共享环境账号。

## 8. 后续 App 待办

Merchant App：

- 接入注册 Token 的安全存储、草稿恢复、多 `applicationBusinessId` 映射和分范围补正。
- 实现动态 KYC 模板、文件替换、条款完整滚动、签名画布及签署摘要确认。
- 接入激活、多方式登录、OTP 冷却/重放错误和账号恢复；补真实 Google、SMTP、SMS 测试。
- 增加 `/api/v1/app/merchant/properties|rooms|availability` 薄路由后，再实现物业/房型/发布页面；每个写请求发送 `X-Mtrip-Property-Id`。

用户 App：

- 酒店搜索、详情、日历、评价、收藏和预订统一使用 `propertyId/roomTypeId`，门票继续使用 `goodsId/skuId`。
- 接受无排名酒店，不在本地用排名配置裁剪普通搜索结果。
- 对酒店 `40401` 和状态 `40901` 做刷新/下线提示，不使用缓存绕过实时门禁。
- 用两家同名物业、待审新版本、下线恢复和最后一个房型停售场景完成真机联调。

## 9. 联调验收边界

- 阶段 7 已验证服务层、控制器、数据库事务、站点/物业范围、真实签名网关和两套 Web 构建。
- 尚未执行 Merchant App 与用户 App 真机 UI、真实 Google、真实 SMTP/SMS、推送通知和商店包验收。
- Merchant App 的物业经营移动端路由适配尚未实现；实现时不得绕过现有服务层、Permission 键或 `X-Mtrip-Property-Id` 门禁。
