# KBZPay MMQR 支付接入方案

2026-10-28 本机结构状态更新：为修复预订列表因 `order_refund.late_pay` 缺失而 500，已备份、两次隔离演练并持锁真实补执行原 `V20261027100000`；随后标准迁移完成 51/51，MySQL healthy。预订读取/退款额度与空退款队列运行验证通过，未启用渠道、录入凭据或发出三方请求。下方“全部未在运行环境验证”仅保留为历史进度；KBZ UAT、出码/回调/真实退款、阶段 7–8 仍待验。详见[修复记录](./audits/2026-10-28-booking-schema-repair.md)。

日期:2026-10-23 初稿;2026-10-26 按评审意见修订(v2)。状态:**阶段 1–6 代码已完成(2026-10-27),全部未在运行环境验证(本机无 Docker、无 UAT 凭据)**;阶段 7–8 未开始,遗留见 §9.1。下一步提示词:[next-task.md](./next-task.md)。

**修订记录**

- **v1 → v2(2026-10-26 用户评审)**
  - 代码落点从 order-service 改为 **payment-service 统一支付中心**,业务服务通过内部接口调用(§4)。
  - 超时后到账的处理改为"能恢复就入账,恢复不了自动退款"(§6)。
  - 收款账户拆为"账户 + 站点绑定"两层,同时支持直连和服务商两种模式,站点可共用账户(§5)。
  - 支付窗口改为可配置(§6.1);KBZ 凭据和证书都在后台维护(§7)。
- **v2 服务划分确认(2026-10-27 用户)**
  - **与三方支付的一切对接集中在 payment-service,不分散到各业务模块**:主动调用(下单、查单、退款、对账、连通性测试)与被动接收(三方回调)都在这里。payment-service 可以对外提供接口(三方回调;以后的收银台 / App 查支付状态)。
  - **后台管理留在管理端服务**:收款账户、站点渠道等配置的增删改查在 system-service;payment-service 不提供 admin 路由,网关 admin map 不加 `payment`。需要触达三方的后台操作(连通性测试、查单同步、重推业务通知、退款)由 system-service / order-service 校验权限与站点后,转调 payment-service 内部接口(§4.2);流水与异常单列表由 system-service 只读查 `pay_transaction`。
  - 因此阶段 3 中 system-service 直接调 KBZ 的「连通性测试」为过渡实现,阶段 4 改为 system-service 转调 payment-service 内部接口,system-service 不再引用 `KbzPayClient`。
- **v2 补充(2026-10-27)**
  - 核对仓库现有客户端写法:不引入 Guzzle,沿用 shared 中 curl + 协程 hook 的模式(§2)。
  - 新增下一步提示词。

## 0. 对接资料

| 资料 | 获取位置 | 说明 |
|---|---|---|
| 接口文档(MMQR 场景) | `https://wap.kbzpay.com/pgw/uat/api/#/en/docs/MMQR%20Payment/scenes-MMQR-payment-en` | 同站点左侧菜单另有 precreate / queryOrder / refund / notify(MMQR 版)、Signature、Error Code 页 |
| 后端 PHP SDK | 文档站左侧「SDK & DEMO → Backend SDK」(`php_sdk_1.0.0.zip`)<br>**精确下载链接待补** | 仅作协议参考,不引入工程(原因见 §2) |
| 在线签名校验工具 | 文档站「Online Sign Tool」 | 联调时比对签名 |
| UAT 账号 / AppKey / 退款证书 | 向 KBZ 商务申请(用户负责) | 拿到后在管理后台录入(§7),不进代码与 git |

开发机上临时存放的 `vender/` 目录不入库,也不被工程代码引用。

## 1. 渠道要点(从文档提炼)

| 项 | 内容 |
|---|---|
| 场景 | 商户后端下单 → KBZ 返回 MMQR 串 → 商户渲染成二维码 → 用户用 **KBZPay 或任意缅甸银行 App** 扫码付款(MMQR 互通,含 off-us) → KBZ 异步通知 |
| 下单 | `kbz.payment.precreate`,version `1.0`,`trade_type=PAY_BY_QRCODE`,无需证书<br>UAT:`http://api-uat.kbzpay.com/payment/gateway/uat/precreate`<br>Prod:`https://api.kbzpay.com/payment/gateway/precreate` |
| 下单字段 | `merch_order_id`(仅字母数字下划线,≤40)<br>`total_amount`(MMK,≤2 位小数,字符串)<br>`trans_currency=MMK`<br>`timeout_express`(**1m–120m**,缺省 120m)<br>`callback_info`(≤512,URL 编码,原样回传)<br>`notify_url`(公网可达,不带 query)<br>服务商模式另需 **`sub_merch_code` + `sub_appid`** |
| 下单返回 | `Response.{result,code,msg,nonce_str,sign,sign_type,prepay_id,merch_order_id,qrCode}` |
| 查单 | `kbz.payment.queryorder`,**version `3.0`**<br>`trade_status` ∈ `PAY_SUCCESS / PAY_FAILED / WAIT_PAY / PAYING / ORDER_EXPIRED / ORDER_CLOSED`<br>`refund_info` 是 JSONArray,不参与签名 |
| 退款 | `kbz.payment.refund`,**需双向证书**<br>UAT `:18008`,Prod `:8008`<br>`refund_request_no` 由商户生成且唯一(≤32)<br>支持 `refund_amount` 部分退,`is_last_refund=Y` 退剩余部分<br>**每单最多 3 次**<br>状态:`REFUND_SUCCESS / REFUNDING / REFUND_FAILED` |
| 通知 | POST JSON:`{"Request":{appid,notify_time,merch_code,merch_order_id,mm_order_id,total_amount,trans_currency,trade_status,trans_end_time,callback_info,nonce_str,sign,sign_type}}`<br>回包为纯文本 `success`<br>重推 2 次(60s、600s),可能重复<br>**必须验签,并校验金额** |
| 关单 | MMQR **无关单接口**,只能依靠 `timeout_express` 让 KBZ 侧自动过期 |
| 签名 | 外层公共参数与 `biz_content` 平铺合并<br>剔除 `sign`、`sign_type`、空值和 JSONArray<br>按 key 的 ASCII 升序拼成 `k=v&...&key={AppKey}`<br>SHA256 后转大写 |

## 2. SDK 评估:作为协议参考,按本仓库规范重写

SDK 不直接引入,原因:

- 全局命名空间、使用 `require_once`,没有 PSR-4。
- 阻塞 curl,且没设超时,在 Swoole 下有卡死风险。
- 不验证响应签名,也不验证异步通知。
- 退款缺少 `refund_amount` 和 `is_last_refund` 字段。
- 用 `empty()` 判断空值,字段值为 `"0"` 时会被误剔出签名。

新实现放在 `backend/shared/src/Pay/KbzPay/`:

- `KbzSigner`:签名与验签。
- `KbzPayClient`:precreate / queryOrder / refund。沿用 `Support/SmsPohClient.php` 的写法:
  - 报文构造和响应解析写成可单测的静态方法,`httpPost` 写成 protected,测试时可以替换;
  - 用 curl 并设置连接超时 3s、总超时 5s,依靠各服务 `bin/hyperf.php` 的 `SWOOLE_HOOK_FLAGS` 走协程,**不新增 composer 依赖**;
  - 退款走 mTLS:PEM 由调用方解密后写成 0600 临时文件,用完删除。

用文档里的签名示例作为固定向量,写进 `backend/shared/tests/run.php`。

## 3. 现状核实

**部署:payment-service 已存在。**

- `deploy/docker-compose.yml:326` 端口 9508,`docker-compose.override.yml:67` 挂载本地代码,`docker-compose.s7.yml:90`。
- `mtrip.sh` 的 start、restart、health 都已包含它。
- 网关:`upstream payment_service`(`mtrip.conf:20`),`location /api/v1/payment/`(`:347`,不校验 App 签名,可直接作为回调入口)。

缺的只有两样:App 端孪生实例 `payment-service-app`(`docker-compose.app-pool.yml` 只有其余 6 个服务),以及网关 `/api/v1/app/{module}` 映射中的 `payment` 一项。按 §4.1 的设计,首期**不需要**补这两项。

**代码:payment-service 只有骨架。**

- 有 `PayChannelInterface` 和 Stripe/PayPal 的空实现;回调只写日志;没有流水表。
- 真实扣款只有钱包。订单状态机、`PaymentResultHandler::markPaid`、库存扣减、`finance_flow` 都在 order-service。
- 服务间目前**没有 RPC**,只共享数据库。
- 支付窗口写死为 `BookingConst::PAYMENT_WINDOW_MINUTES = 10`。超时任务 `BookingExpiryService` 会取消订单、释放库存、关闭同行程的其他预订,并通知商户和用户。

## 4. 架构:payment-service 作为统一支付中心

### 4.1 职责划分

```
client-app ──签名请求──> order-service(业务入口:校验订单、锁券、算金额)
                              │  内部 HTTP(/internal/v1/*,X-Internal-Token)
                              ▼
                        payment-service(统一支付中心)
                         ├─ 渠道适配:KbzMmqrChannel(后续 Stripe/PayPal/WavePay 同接口)
                         ├─ 收款账户与站点路由(§5)
                         ├─ pay_transaction / pay_refund 流水
                         ├─ 渠道回调 /api/v1/payment/callback/kbz-mmqr(验签、对金额)
                         ├─ 主动查单与对账 crontab
                         └─ 业务通知 outbox ──内部 HTTP──> 业务方 notify(order-service 落账)
admin(order-service 退款)──内部 HTTP──> payment-service /internal/v1/refund/*
```

- **业务方只调 payment-service 的内部接口,不直接接触渠道。** 退款、对账、以后的充值等,任何服务都能复用。
- 订单入账留在 order-service:它掌握行锁、库存和优惠券。payment-service 不跨库改订单。
- **内部接口约定**:
  - 路径前缀 `/internal/v1/`。网关没有对应 location,外网访问会 404。
  - 请求头 `X-Internal-Token`,值来自 env `MTRIP_INTERNAL_TOKEN`,经 compose 注入各服务。
  - 由 shared 提供中间件 `InternalAuthMiddleware`,只放行 docker 内网来源加正确 token。
- **调用方 SDK**:`backend/shared/src/Payment/PaymentCenterClient.php`,封装 create / query / refund / refundQuery,所有服务共用。
- 前端轮询走 order-service(`/api/v1/app/order/pay/status`),再由它转调 payment-service。首期因此不需要 `payment-service-app` 和网关映射。以后要做独立收银台,再补这两项。

### 4.2 内部接口

| 接口 | 入参 | 出参 |
|---|---|---|
| `POST /internal/v1/payment/create` | `siteId, bizType(order\|trip), bizNo, userId, amount, currency, channel(kbz_mmqr), subject, expireAt, notifyUrl(业务方)` | `payNo, qrCode, expireAt, status`<br>同一 `bizNo` 下有未过期的流水时直接返回它(幂等) |
| `POST /internal/v1/payment/query` | `payNo` 或 `bizType + bizNo`;`refresh` | `status, channelTradeNo, paidAt`<br>`refresh=1` 且本地状态仍为 pending 时,实时查 KBZ |
| `POST /internal/v1/refund/create` | `payNo, refundNo, amount, reason, notifyUrl` | `status(processing\|succeeded\|failed), channelRefundNo` |
| `POST /internal/v1/refund/query` | `refundNo` | 同上 |
| `POST /internal/v1/channel/test` | `accountId` | `ok, kind, code, message`(判定规则同阶段 3 `PayAccountService::test`)|
| `POST /internal/v1/payment/renotify` | `payNo` 或 `refundNo` | 重置 outbox 为待通知并立即推送一次,返回推送结果 |

后台「查单同步」复用 `payment/query` 的 `refresh=1`。上述后台操作均由管理端服务(system-service / order-service)完成权限与站点校验后调用,payment-service 只校验内部 token。

业务方的回调接口是 order-service `POST /internal/v1/order/payment-notify`,事件分 `paid`、`refunded`、`refund_failed`。要求幂等处理,返回 `code=0` 视为确认。

### 4.3 数据表(新增 migration)

**`mtrip_business.pay_transaction`**

| 列 | 说明 |
|---|---|
| `pay_no` | 唯一,发给 KBZ 的 `merch_order_id`,格式 `P{yyMMddHHmmss}{6位}` |
| `site_id, user_id, biz_type, biz_no` | |
| `channel_code, account_id, binding_id` | 下单时快照,回调和退款都按快照取账户 |
| `amount, currency` | 回调时用于比对金额 |
| `prepay_id, qr_code, expire_at` | |
| `channel_trade_no` | `mm_order_id` |
| `status` | 0 待付;1 成功;2 失败;3 过期/关闭;**5 迟到支付待处理**(§6) |
| `paid_at, notify_raw, biz_notify_url, biz_notify_status, biz_notify_tries, biz_notify_next_at` | 后几列构成业务通知 outbox |

索引:UNIQUE(`pay_no`);(`biz_type`, `biz_no`);(`status`, `expire_at`);(`biz_notify_status`, `biz_notify_next_at`)。

**`mtrip_business.pay_refund`**

- 列:`refund_no`(即 `refund_request_no`,唯一)、`pay_no`、`amount`、`reason`、`channel_refund_no`、`status`、`biz_notify_*`。
- 发起前**校验成功退款次数小于 3**,超出直接拒绝。

`pay_method = 5`(KBZPay MMQR)和 `finance_flow.pay_channel = 5` 同步写进 `BookingConst`、SQL 注释、client 的 `PAY_METHOD` 和 admin 字典。

## 5. 收款账户:直连与服务商两种模式并存,站点可共用

### 5.1 模型

收款主体与站点开通拆成两层:

**`mtrip_system.sys_pay_account`(收款账户,新增表)**

- `channel_code`(`kbz_mmqr`)、`account_name`。
- `mode`:1 = 直连单商户;2 = 服务商。服务商模式下,本行保存服务商自身的凭据。
- `env`:`uat` 或 `prod`。
- `app_id`、`merch_code`。
- `app_key`(AES 加密)。
- `cert_pem`、`key_pem`(AES 加密)、`key_pwd`(AES 加密)、`ca_pem`:退款用的双向证书,在后台录入。
- `notify_base_url`(https)、`status`、`remark`。

**`mtrip_system.sys_pay_channel`(站点开通,沿用现有表,迁移新增列)**

- 新增 `account_id`。
- 新增 `sub_merch_code`、`sub_app_id`:服务商模式必填,直连模式留空。
- 新增 `sort`。
- 原有的 `fee_rate / min_amount / max_amount / currencies / status / site_id` 继续使用。
- 现有 Stripe/PayPal 的行保持不动(仍用 `api_key`,`account_id` 为空),配置页按 `channel_code` 分开处理。

### 5.2 路由规则

1. 下单时按 `site_id + channel_code` 取启用中的绑定。本站点没有时,沿站点树(城市 → 国家 → 全球)向上找;都没有就提示该渠道不可用。
2. 同一个 `account` 可以被多个站点绑定,满足"不同站点用同一收款服务商"。不同国家各自绑定各自的账户和渠道。
3. 服务商模式下,下单时附带 `sub_merch_code / sub_appid`;签名始终用服务商的 AppKey。
4. 回调先按 `merch_order_id`(即 `pay_no`)找到流水,再按快照的 `account_id` 取 AppKey 验签,不依赖回调里的字段去选账户。
5. 金额校验:按绑定的 `min/max_amount` 和 `currencies` 拦截。MMQR 只接受 MMK。

> 首期绑定粒度到站点,平台统一收款,之后由现有 SettlementService 与酒店结算。如果以后要让酒店作为 KBZ 子商户直接收款,只需把绑定扩展到 `merchant_id` 维度,账户层不用改。

## 6. 支付窗口与"超时后入账"

### 6.1 支付窗口可配置

- 配置项 `payment_window_minutes`:先读站点配置 `sys_site_config`,没有时读全局 `sys_config`,都没有用默认值 30。
- 新增 `order_payment_window_minutes` 作为渠道级覆盖,放在绑定表或站点配置里,用于给扫码支付单独放宽。
- 创建订单时(`BookingLifecycleService:56`)按上述配置计算 `payment_expires_at`,替换写死的 10 分钟。

KBZ 侧 `timeout_express` 取 `min(订单剩余分钟数 - 1, 120)`,最少 1 分钟,保证 **KBZ 的码先于本地订单过期**。窗口超过 120 分钟时,码过期但订单仍在窗口内,用户再次进入支付页会自动生成新码(新的 `pay_no`)。旧码已在 KBZ 侧过期,无法再付款。

### 6.2 超时后入账会有什么影响

"超时"指订单支付窗口已过、被系统自动取消之后,才收到 KBZ 支付成功。按 6.1 的对齐方式,KBZ 那边的码已先过期,用户扫不了,这种情况**只会出现在边界上**:用户在最后几秒付款、通知延迟、或我们服务短暂宕机。

如果直接把这笔订单改回已支付,会碰到这些问题:

| 影响 | 说明 |
|---|---|
| 库存 | 取消时已释放库存,房量可能已被别人订走,强行确认会**超订** |
| 已发的通知 | 商户和用户都已收到"支付超时已取消",恢复后需要再发"已恢复",否则双方信息对不上 |
| 行程连带 | 行程支付会把同行程的其他预订一起关闭,必须整单一起恢复,不能只恢复一部分 |
| 优惠券 | 取消时可能已经退回,并被用在了别的订单上 |
| 价格与结算 | 按支付时的金额快照入账;结算以 `pay_time` 归期,不受影响 |
| 用户主动取消 | 订单是用户自己取消的,但 KBZ 码仍有效,用户又付了款:**不能恢复**,只能退款 |

### 6.3 处理策略:能恢复就入账,恢复不了自动退款

收到支付成功时,order-service 的落账服务 `PaymentSettleService::onPaid` 按订单状态处理:

1. **待支付**:正常执行 `markPaid`,然后扣库存、写 `finance_flow`。
2. **已因超时取消**(`cancel_reason` 来源为系统超时,且不是用户或商户取消):尝试恢复。同一事务内:
   - 锁行程,检查同行程所有被连带关闭的预订;
   - 逐个重新锁库存,复核优惠券;
   - 全部成功后,把状态改回已确认,记事件 `payment_late_recovered`,并给商户和用户补发"订单已恢复"。
   - `PaymentResultHandler` 新增 `markPaidAfterExpiry`,只允许从"超时取消"这一种状态进入。
3. **恢复失败**(无库存或券已被使用)、**用户主动取消**、**其他终态**:流水标为 5,调 payment-service **自动原路全额退款**,通知用户。管理后台的"异常支付"列表可以看到这些单,并支持人工处理。
4. 不论哪种情况,都给 KBZ 回 `success`,不让它继续重推。

另外,超时任务在取消带 MMQR 流水的订单前,先查一次 KBZ。结果是 `PAY_SUCCESS` 或 `PAYING` 的,本轮不取消,交给落账流程或下一轮处理,尽量不进入第 2 条的恢复路径。

## 7. 管理后台(用户自行维护配置)

- **收款账户管理**(新页面,如 `views/config/pay-account/index.vue`)
  - 可增删改查、启停。
  - 选模式(直连/服务商)和环境(UAT/Prod)。
  - 录入 AppId、MerchCode、AppKey,上传退款证书(cert/key/ca PEM 和私钥密码)。
  - 敏感字段只写不读:列表脱敏,编辑留空表示不修改(沿用 `SecretField::keep`)。
  - 提供"连通性测试"按钮:用一笔 queryorder 查一个不存在的单号,能返回 `QUERYORDER_FAIL` 即说明签名和网络都通。
- **站点支付渠道**(现有 `views/config/pay/index.vue` 改造)
  - 选渠道 `kbz_mmqr` 后改为选择收款账户。服务商模式下必须填 `sub_merch_code / sub_appid`。
  - 可配费率、限额、币种、排序。
- **支付窗口**:站点配置里新增 `payment_window_minutes`,以及按渠道的覆盖值。
- **支付流水 / 退款流水 / 异常支付**列表:放在支付管理菜单下,支持查看与人工"查单同步"和"重推业务通知"。
- **权限键三处同步**:`02-menu.sql` 的 `perm_key`、后端 `#[Permission]`、前端 `v-perm`。新增 `config:payAccount:*`、`payment:transaction:*` 两组。
- 管理端接口都放在 system-service(2026-10-27 用户确认,见修订记录):配置增删改查直接读写配置表;流水 / 退款 / 异常支付列表只读查 `mtrip_business.pay_*`;连通性测试、查单同步、重推通知转调 payment-service 内部接口(§4.2)。payment-service 不提供 admin 路由,网关 admin map **不加** `payment`。

## 8. 移动端(client-app)

1. `src/api/pay.ts` 新增:
   - `PAY_METHOD.MMQR = 5`;
   - `payOrder` 的返回结构 `{payNo, qrCode, amount, currency, expireAt}`;
   - `getPayStatus(payNo)`。
   - 新增 `getPayMethods()`:后端按站点绑定返回可用渠道,前端不再写死。
2. 订房流程 `useBookingWizard` 和 `LiteStepPay`:`mmqr` 映射到 5,并按 `getPayMethods` 决定是否灰显。
3. 新增页面 `screens/pay/MmqrPayScreen.tsx`:
   - 显示二维码(用已安装的 `react-native-qrcode-svg`)、金额和倒计时。
   - 提示可以用 KBZPay 或任意 MMQR 银行 App 扫码。
   - 支持保存二维码:原生端新增依赖 `expo-media-library`,Web 端下载 PNG。
   - 每 3 秒轮询一次;切到后台暂停,回到前台立即查一次;"我已付款"按钮会触发服务端实时查 KBZ。
   - 支付成功跳成功页;码过期且订单仍在窗口内时,可"刷新二维码";订单过期则回到订单详情。
4. 重新支付和订单详情页的"去支付":复用未过期的码。
5. 三语 i18n(en-US / zh-CN / my-MM)同步补齐。

首期不做:唤起 KBZPay App 直付(需要 APPH5 等其他 trade_type)、WavePay、商户端收款码。

## 9. 分阶段与验收

| 阶段 | 工作 | 验收 |
|---|---|---|
| 1 | shared:`KbzSigner`、`KbzPayClient`、`PaymentCenterClient`、`InternalAuthMiddleware`、单测 | `run.php` 跑通签名固定向量;`check.ps1` 通过 |
| 2 | migration:`sys_pay_account`、`sys_pay_channel` 新增列、`pay_transaction`、`pay_refund`、支付窗口配置项;`pay_method = 5` 字典 | 脚本幂等,`db-apply.ps1` 增量执行通过 |
| 3 | 管理后台:收款账户、站点渠道改造、支付窗口、连通性测试;菜单与权限 | 能录入 UAT 账号;连通性测试返回预期错误码 |
| 4 | payment-service:内部接口、KBZ 渠道、回调、查单与对账 crontab、业务通知 outbox | 用 UAT 下单拿到码;伪造签名或篡改金额的回调被拒;重复回调幂等;业务通知失败后能重试 |
| 5 | order-service:pay 接入 MMQR、status 接口、`PaymentSettleService`(正常 / 迟到恢复 / 自动退)、超时任务前置查单、可配窗口;退款改为调用支付中心 | 用 UAT 钱包扫码后订单变为已支付;§6.3 三种分支都能复现并得到预期结果 |
| 6 | client-app:`MmqrPayScreen`、轮询、渠道开关、i18n | typecheck 通过;H5 与真机都能走通"扫码 → 成功"的闭环 |
| 7 | 退款(mTLS):全额、部分、3 次上限、`REFUNDING` 状态跟进 | UAT 退款成功,对账能把状态收敛到终态 |
| 8 | 异常演练:通知丢失(只靠查单补单)、KBZ 超时或 `SYSTEM_ERROR`、服务重启 | 每笔流水都能到达终态,没有"钱到了、订单却没人处理"的情况 |

### 9.1 阶段状态(2026-10-27)

| 阶段 | 状态 | 已验证 | 未验证 / 遗留 |
|---|---|---|---|
| 1 | 代码完成 | `run.php` 162 用例全过(PHP 8.1/8.4);`KbzSigner` / `KbzAccountConfig` / `KbzPayClient` / `KbzPayException` 在 `backend/shared/src/Pay/KbzPay/` | 签名固定向量为按 SDK 算法**自构造**,非 KBZ 官方示例(文档站无法抓取),拿到 Online Sign Tool 后补官方向量;queryOrder / refund URL 路径按 precreate 规律推断;签名类、订单不存在类错误码为关键词启发式;服务商模式下 query/refund 是否需带子商户字段待联调确认。`PaymentCenterClient`、`InternalAuthMiddleware` 移到阶段 4 |
| 2 | 代码完成 | 迁移 `V20261027100000__add-kbz-mmqr-payment.sql`:`db-migrate.sh --validate` 通过;临时 MySQL 8.0.29 实例连续执行两次,7 张表结构与数据快照一致 | **未应用到开发库**(本机无 Docker);既有倒序迁移 `20261015090000` 阻塞账本,新增迁移后 mysql healthcheck(账本数 = 文件数)可能不过 |
| 3 | 代码完成 | system-service 全部 `php -l` 通过;admin-web `npm run build` 零报错 | system-service 未重启、未做 HTTP / 浏览器走查;未用真实 UAT 凭据跑连通性测试 |
| 4 | 代码完成 | shared `InternalAuthMiddleware`、`PaymentCenterClient`、`PaymentRules`;payment-service 内部接口 7 个、KBZ 回调、3 个 crontab(`pay-reconcile` / `pay-biz-notify` / `refund-sync`);compose 注入 `MTRIP_INTERNAL_TOKEN`(`mtrip.sh` 自动生成)/ `PAYMENT_CENTER_URL` / `PAYMENT_NOTIFY_BASE_URL`;连通性测试改为 system-service 转调;单测通过 | 未跑任何 HTTP / DB / crontab;退款查询走 queryorder v3 + `refund_request_no`,`refund_info` 字段名为推断;payment-service 移除了 `SubmitLockMiddleware`(按 IP+UA 会误拦 KBZ 并发通知) |
| 5 | 代码完成 | order-service:`pay` / `trip/pay` 支持 payMethod=5、`pay/status`、`pay/methods`;`/internal/v1/order/payment-notify`;`PaymentSettleService::onPaid` 三分支(确认 / 超时取消后恢复 / 自动全额退款,用户 2026-10-27 确认);支付窗口可配(站点 → 全局 → 30);超时任务对 MMQR 单前置查单(超窗 30 分钟兜底取消);admin 退款对 KBZ 单走支付中心;`SettleRules` 单测 | 三分支均未实跑;见下方遗留 |
| 6 | 代码完成 | client-app `MmqrPayScreen`(二维码、倒计时、3 秒轮询、AppState 暂停、"我已付款"实时查、刷新码)、`getPayMethods` 渠道开关、订房向导(Lite / 完整)与订单详情入口、三语 i18n;typecheck 除既有 5 条缺依赖外零新增 | 无真机 / H5 联调;原生端无 `expo-media-library`,不提供保存二维码(提示截图),Web 下载 PNG;my-MM 11 条英文兜底、14 条机翻待母语复核 |
| 7–8 | 未开始 | | |

**阶段 5/6 遗留 —— 2026-10-27 已全部修复(代码层,未实跑),原清单保留备查:**

- 1 → shared `UserNotify::EVENTS` 新增 `payment_late_recovered / payment_late_refunded / payment_late_refund_failed / refund_requested_original / refund_completed_original / refund_completed_wallet_fallback`,App 三语(my-MM 暂英文,与该节现状一致);order-service 全部改用事件,删除直写 `notify_record` 旁路。
- 2 → 商户退款 `BookingRefundService::applyOriginal`:KBZ 单原路退;`late_pay=1` 行不阻塞商户退款。
- 3 → admin-web 退款页:KBZ 行"提交原路退款 / 重试",不要求第三方流水号,显示支付中心退款号与渠道提交状态;列表 / 详情后端已带 `pay_method`。
- 4 → 迁移给 `order_refund` 加 `pay_no / late_pay / channel_submit_status / channel_queued_at` 及索引,回填旧前缀行;前缀 + LIKE 已删除。
- 5 → 用户确认「合并提交 + 超限退钱包」:单预订支付立即提交;行程支付排队,crontab `kbz-refund-batch` 按 `pay_no` 合并(窗口默认 300 秒,env `KBZ_REFUND_MERGE_SECONDS`);已用(成功+处理中)≥ 3 次则整批退钱包并发 `refund_completed_wallet_fallback`;迟到退款立即提交、计入配额。`payment/query` 出参新增 `refundCount / refundedAmount / maxRefundTimes`。
- 6 → 核实:订单无币种列;酒店单取房型币种(须与站点币种一致,否则拒绝出码),其余取站点币种;仓库内读取 `sys_site_config` 均为精确站点匹配、无站点树继承约定,支付窗口保持「本站点 → 全局 → 30」。

**修复带来的行为变化(需联调重点验证):** `RefundSettleService::completeRow` 被所有退款路径共用,本轮调整为 ① 按累计已退金额判定全额;② 部分退款仅当订单处于"退款中"才回到"已支付";③ 已入住 / 已退房 / No-show 全额退款不回补库存。KBZ 商户退款在到账前即取消预订,库存在到账时回补;退款长期失败需后台「确认到账」重试。迁移新增的 `order_refund` 段未在任何 MySQL 上执行过。

原遗留清单:

1. 用户通知:`UserNotify::EVENTS` 未加 `payment_late_recovered / payment_late_refunded / payment_late_refund_failed`,迟到退款通知目前直写 `notify_record` 英文文案;`refund_completed` 模板写"退回 mTrip 钱包",对 KBZ 原路退款不准确。需改 shared 事件表 + App i18n。
2. 商户侧退款 `BookingRefundService::apply` 对 KBZ 支付的订单仍退到钱包,应改走支付中心原路退;迟到退款行处于处理中时会阻塞该单的商户退款。
3. admin-web 退款页对 `refund_channel=2` 可能仍要求填第三方流水号才能"确认到账"(后端对 KBZ 已忽略),需前端适配。
4. 迟到退款标记暂用 `order_refund.reason` 前缀 `[LATE_PAY:payNo]` + LIKE 查询,建议迁移加列。
5. 行程逐笔退款可能触及 KBZ 每单最多 3 次退款上限,需合并退款策略。
6. 订单币种规则(房型币种 → 站点币种)为推断;支付窗口只读订单所属站点覆盖,不沿站点树继承。

阶段 3 落点:收款账户 `/api/v1/admin/sys/pay-account/{list,options,add,update,delete,toggle-status,test}`(`PayAccountService`);菜单 1313 `config/pay-account/index`,按钮 131301–131305 `config:payAccount:{add,edit,status,delete,test}`;`PayChannelController` 支持 `kbz_mmqr`(必选账户、服务商模式子商户必填、币种固定 MMK、`sort`);`payment_window_minutes` 全局在 `sys_config`(group `base`)、站点在 `sys_site_config`(站点管理「差异化配置」抽屉)。顺带修复:`MaskHelper::maskParams` 默认脱敏键补 `apiKey/appKey/certPem/keyPem/keyPwd/caPem`,此前操作日志会明文记录支付密钥(Stripe `apiKey` 亦受影响)。

## 10. 已确认 / 待确认

已确认(2026-10-26):

- 支付能力统一放在 payment-service。
- 超时后到账的钱应尽量入账,支付窗口可配置。
- 站点可以共用同一个收款账户,也可以各用各的;直连和服务商两种模式都要支持。
- UAT 账号由用户申请,在后台维护。
- `vender/` 不入库。

已确认(2026-10-27):§6.3 恢复失败 / 用户主动取消 → 自动原路全额退款(退款提交失败转人工);默认支付窗口 30 分钟。

待确认:

1. KBZ 最终开通的是直连还是服务商模式。两种都会实现,这一项只影响后台录入方式。
2. ~~§6.3 处理策略~~(已确认)。
3. 扫码支付是否需要渠道级窗口覆盖 `order_payment_window_minutes`(本轮未实现)。
4. 对外 notify 地址用哪个 https 域名(例如 `https://m.myanmartrip.com/api/v1/payment/callback/kbz-mmqr`)。
5. SDK 精确下载链接,补到 §0。
