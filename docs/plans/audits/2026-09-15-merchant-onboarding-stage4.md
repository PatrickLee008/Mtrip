# 商户入驻审批整改阶段 4 执行报告

日期：2026-09-15  
范围：最终批准、正式实体创建、待激活主账号、访问码和凭证投递；本阶段未修改 `merchant-app/**`、`client-app/**`。

## 交付结果

- 最终批准复用阶段 3 的服务端门禁，并在单一数据库事务中锁定申请、全部首批业务和 KYC 文档；随后创建一个正式商户、一个待激活主账号和全部首批物业。事务中任一步失败都会整体回滚。
- 每条 `merchant_application_business` 只生成一条 `merchant_store`，并通过唯一的 `source_business_id` 保留申请期业务到正式物业的一对一来源映射；KYC 文档、修订、事件和时间线同步绑定正式商户与对应物业。
- 主账号保留注册时已验证的加密手机号、加密邮箱及其检索哈希。正式商户状态为已批准但未激活，主账号状态为禁用/待激活，阶段 5 完成 OTP 激活前不能登录。
- 酒店访问码为 `H` 加 5 位大写安全字符，租车访问码为 `C` 加 5 位大写安全字符；数据库按规范化值保证大小写不敏感唯一，生成前通过商户编号序列行锁串行化碰撞检查。
- 新增加密凭证 outbox，逐渠道保存 `pending/processing/delivered/failed`、尝试次数、下次尝试时间、供应商回执和错误。相同最终批准 `requestId` 返回同一批正式实体，不重复创建账号、物业或 outbox。
- email 使用现有 SMTP 渠道真实发送；当前 SMSPoh 能力只支持 OTP，普通凭证短信会准确记为 `failed/sms_provider_supports_otp_only`，保留后续渠道接入与重试入口。inapp 只保存访问码和激活提示，不保存临时密码。
- 管理端详情展示访问码、待激活状态和各渠道投递结果；基础注册批准、KYC 审核、最终批准、凭证重试分别使用独立权限。最终批准和凭证重试同时限制为超级管理员操作。

## 接口与权限

- `POST /api/v1/admin/merchant/onboarding/final-approve`：请求包含申请 ID、8 至 80 位 `requestId` 和投递渠道；必须包含申请已验证的注册渠道，可额外选择 inapp。
- `POST /api/v1/admin/merchant/onboarding/credential-retry`：只重试指定 outbox 记录，不重复创建任何正式实体。
- 权限键已分别固定为 `merchant:onboarding:registration-approve`、`merchant:onboarding:final-approve` 和 `merchant:onboarding:credential-retry`，后端 `#[Permission]`、`database/seed/02-menu.sql` 与前端 `v-perm` 一致。
- 申请详情继续返回 `finalApproval`；批准前是阶段 3 门禁结果，批准后返回正式商户、账号、全部物业、访问码、账号状态和脱敏投递回执。响应不包含临时密码或加密载荷。

## 验证证据

- `bash scripts/test-merchant-onboarding-final-approval.sh`：专属隔离库重复执行阶段 4 迁移，19 项断言全部通过；测试库自动清理。
- 覆盖酒店访问码大小写碰撞、租车前缀、两家首批物业完整转换、来源一对一映射、手机号/邮箱解密一致、KYC 实体绑定、email 失败/inapp 成功状态、inapp 无临时密码、相同请求幂等、不同请求冲突、失败投递重试、手工重试遵守活跃投递锁、事务回滚、跨站重试拒绝、非超级管理员拒绝，以及两个真实 PHP 进程并发批准只生成一套实体。
- `bash scripts/test-merchant-onboarding-registration.sh`：阶段 2 的 20 项注册与基础审批回归全部通过。
- `bash scripts/test-merchant-onboarding-kyc.sh`：阶段 3 的 29 项 KYC、签署、驳回重交和最终门禁回归全部通过。
- 两个服务池的 PHP 8.1 语法检查、admin-web TypeScript 检查和生产构建、迁移命名校验、Shell 语法、阶段 4 文件差异检查均通过。
- `V20260915210000__add-onboarding-final-approval.sql` 已应用；开发库迁移账本 14/14、待执行 0。`merchant_admin` 的 3 个联系方式字段、`merchant_credential_delivery` 表和 3 个独立菜单权限均已核对生效。
- `mtrip-merchant-service-1` 与 `mtrip-merchant-service-app-1` 已重启，两个 `/healthz` 均正常。最终批准路由的无登录冒烟返回统一 `40101`，证明新路由已加载并受鉴权中间件保护；当前没有可复用管理端登录态，因此未宣称完成真实登录态 UI/API 冒烟。

## 已知边界

- 阶段 5 尚未执行。当前主账号故意保持待激活，商户不能使用新账号进入工作台；激活 OTP、多方式登录和恢复流程仍按阶段 5 实施。
- 当前 SMSPoh 仅支持 OTP，不支持发送普通凭证正文；SMS outbox 会真实记录失败并可重试，不能视为短信已送达。
- 当前只定义酒店 `H` 和租车 `C` 访问码前缀；餐厅、航空、景区的前缀未获业务确认，最终批准会失败关闭。
- 入驻申请模型尚无独立法律代表字段，正式商户的 `legal_person` 暂为空字符串以满足现有非空约束；后续如 PRD 要求采集，需先扩充注册契约和表单，不能从公司或联系人字段推断。
- 阶段 1 标记的 12 条存量双口径文档仍需按人工清单处理，不会自动猜测商户或物业归属。
