# 下一步任务提示词:KBZPay MMQR 运行验收 + 遗留修复 + 阶段 7–8

> 复制以下全文作为新会话的第一条消息。

---

继续 KBZPay MMQR 支付接入。阶段 1–6 代码已完成但**全部未在运行环境实跑**,详见方案 `docs/plans/22-KBZPay-MMQR支付接入方案.md` §9.1(阶段状态与遗留 6 项)和 `docs/plans/HANDOFF.md` 2026-10-27 三条 KBZ 记录。

开始前先读:根 `AGENTS.md`、HANDOFF 第 4/5 节、方案修订记录(服务划分:与三方支付的一切对接只在 payment-service,后台管理留在 system-service / order-service)、§4.2、§6、§9.1。**不要回退其他任务的修改。**

## 环境前置(做不到就停下来告诉用户)

- Docker 可用:`cd deploy; ./mtrip.sh start`。
- `nvm use 22`(本机曾被切到 node 12);PHP 用 `D:\BtSoft\php\81`。
- `.env`:`MTRIP_INTERNAL_TOKEN` 由 `mtrip.sh` 自动生成;`PAYMENT_NOTIFY_BASE_URL` 需用户给出对外 https 域名(未定就只能做到"出码 + 主动查单",回调需公网可达)。
- KBZ UAT 凭据由用户在后台「收款账户」录入。

## 任务一:运行验收(按顺序)

1. `scripts/db-apply.ps1 database/migrations/V20261027100000__add-kbz-mmqr-payment.sql` 两次确认幂等。mysql healthcheck 若因既有 `20261015090000` 账本阻塞不过:**禁止伪造账本**,告诉用户。
2. 重启 system-service、payment-service、order-service(及 `*-app` 孪生),看启动日志(DI、crontab、InternalAuthMiddleware 构造)。
3. 后台走查:收款账户增改、脱敏、留空保留、服务商必填、站点隔离、连通性测试(经 payment-service 转调);站点渠道绑定;全局/站点支付窗口。
4. 内部接口:无 token / 错 token 403;网关外访问 `/internal/*` 404。
5. UAT 闭环:App 下单选 MMQR → 出码 → UAT 钱包扫码 → 回调验签落账 → 订单已确认;伪造签名、篡改金额被拒;重复回调幂等;关闭 notify 只靠 `pay-reconcile` 补单。
6. §6.3 三分支:正常确认、超时取消后恢复、恢复失败/用户取消 → 自动退款。

## 任务二:回归 §9.1 遗留修复(2026-10-27 已改代码,未实跑)

1. 迁移 `order_refund` 段在开发库执行两次幂等;旧 `[LATE_PAY:` 行回填正确。
2. **回归钱包退款**(`completeRow` 共用逻辑已调整:累计额判全额、部分退款状态回退、已入住类不回补库存)。
3. KBZ 退款:单预订立即提交;行程退款排队后被 `kbz-refund-batch` 合并;第 4 次起退钱包并发 `refund_completed_wallet_fallback`。
4. 商户侧 KBZ 退款原路退;admin 退款页 KBZ 行按钮与提交状态显示;6 个新通知在 App 三语显示。

## 任务三:阶段 7–8

- 阶段 7 退款 mTLS:UAT 全额、部分、3 次上限、`REFUNDING` 跟进;校准 refund URL 与 `refund_info` 字段名。
- 阶段 8 异常演练:通知丢失、KBZ 超时 / `SYSTEM_ERROR`、服务重启,每笔流水到达终态。
- 联调中拿到 KBZ 官方签名示例 / 错误码表后,补 `KbzPayTest` 官方向量并校准 `isSignError` / `isOrderNotFound`。

## 验证与交付

- `php backend/shared/tests/run.php` 全过;`scripts/check.ps1` 通过(或如实说明既有失败项:client-app 缺 expo 依赖需 `npm install`)。
- `git -c core.whitespace=cr-at-eol diff --check`。
- 同步方案 22 §9.1、`docs/plans/README.md`、根 `README.md`、HANDOFF;未实跑的能力不得写成已完成。
- 不提交、不推送,除非用户明确要求。
