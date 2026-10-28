# 预订列表 500 与遗漏支付迁移修复

日期：2026-10-28。依据：用户反馈预订管理服务器内部异常，并授权按排查原因修复。本次为既有功能的本机运行修复，不变更预订规则、编号、支付开关或前端布局。

## 原因

正常请求 `GET /api/v1/merchant/order/list` 在退款动作判断中进入 `BookingRefundService::quote()`，查询 `order_refund.late_pay` 时抛出 SQLSTATE 42S22 / 1054。退款表缺少 `pay_no`、`late_pay`、`channel_submit_status`、`channel_queued_at`，同时 `kbz-refund-batch` 持续报缺少 `pay_no`。

KBZPay 代码已运行，原迁移 `V20261027100000__add-kbz-mmqr-payment.sql` 未应用：正常库没有三张支付新表和渠道新增列；最高已应用版本为 `20261027160000`，标准迁移器正确拒绝倒序补执行。原迁移与 HEAD 一致，SHA-256 为 `a45f71f1b8aed907ea95103c868159072bfe3db74674134fb0c127f50d92715c`。

## 修复与数据保护

沿用已有 Support 遗漏迁移的受控恢复方式，不修改历史 SQL、顺序检查或原有账本。恢复材料在 Git 忽略目录 `deploy/backups/booking-schema-repair-20261028/`，包含 `before.sql.gz`、原 49 条完整账本、原订单/退款/支付渠道逐行哈希、一次性恢复脚本与执行日志。备份通过 gzip 与 dump 完成标记检查。

1. 使用两套专用空结构克隆库，将原 SQL 中数据库名完整映射到隔离库，连续执行两次；四列、三个退款索引和三张新表验证通过。两套克隆库随后删除。
2. 正常库持有 `GET_LOCK('mtrip_schema_migrations',10)`，校验原账本数量/最高版本、无 running/failed、目标版本尚未登记；先写真实 running 尝试，再执行完整原迁移，校验结构后标记 applied。执行者为 `local-booking-schema-out-of-order-repair`。
3. 执行后原 49 条账本及原订单、退款、支付渠道所有旧字段的逐行哈希不变。仅新增既定结构、配置和菜单种子，未开通任何渠道、录入凭据或触发三方请求。
4. 标准 `bash scripts/db-migrate.sh` 随后真实执行唯一剩余的 `V20261028090000__browser-session-policy.sql`；最终 51 已执行、0 待执行，完整 checksum/路径/状态复核通过。该会话配置迁移保留自定义取值，完成此前待登记的既定变更。

未修改应用运行逻辑或重启业务服务；数据库结构立即对两个订单池生效。没有发布 Web 产物、远端部署、提交或推送。

## 验证与阶段 Review

- **修复前复现**：`bash scripts/test-booking-remediation.sh` 在隔离结构克隆中复现相同 `late_pay` 不存在异常。
- **迁移演练 Review**：原文件哈希一致；两次演练通过；实际恢复在锁内执行并真实记录，原账本与业务行比对通过。标准迁移器最终复核 51/51。
- **正常库只读验证**：在订单主服务和 APP 池分别开启业务库、系统库 READ ONLY 事务，调用实际 `BookingController`。报错物业 15 的列表/统计均 `code=0`，1 条现有预订的详情/时间线/退款试算通过，All Properties 入口通过；空退款队列处理通过。只输出状态和数量，事务均回滚。此证据为真实 Controller/数据库验证，不等同于登录态浏览器或 HTTP 验收。
- **退款回归**：在现有隔离预订用例增加迟到退款夹具：正常已退 300、迟到退款 400、政策可退 500，断言正常已退仍为 300、剩余可退仍为 200；新断言通过。列表/详情、多选筛选、到店付收款/退房、取消/退款、旧核销和物业越权断言均通过。
- **运行健康**：8 主服务、6 APP 服务、网关及聊天鉴权探针全通过；MySQL 从 unhealthy 恢复 healthy。退款任务在 UTC 07:52、07:53、07:54 连续执行成功，修复后未再出现缺字段异常。
- **质量基线**：486 个 PHP 文件语法检查、shared 202 用例/1605 断言、admin-web 类型检查/构建、client-app 类型检查及差异空白检查通过。构建保留既有 bundle 体积提示。

## 独立测试失败与未验范围

本次不能将整个 `test-booking-remediation.sh` 记为通过：其既有聊天相关部分有两处失败，未修改应用权限或聊天行为来绕过检查。

- `closed guest conversation rejects messages`：旧测试将普通住客会话置 status=1 后要求拒绝发送；当前共享 `ChatService` 仅对 type=2 的终态会话拒绝，普通会话发送会重开。需按当前聊天基线单独校准该断言。
- `booking-notification-scope.php`：旧夹具仅注入 admin_id=991001 的上下文，没有创建对应 `merchant_admin`；当前通知查询会调用 `ChatAccess::employee()` 实时校验员工，返回 403。修复前后均存在此失败，需单独补齐真实员工夹具。

上述失败与数据库缺字段分别记录，未宣称整套专项全绿。浏览器自动化工具当前不可用，登录态页面目视刷新未执行；KBZ UAT 出码、真实支付/退款及 mTLS 仍待独立验收，不因本次结构修复标为完成。
