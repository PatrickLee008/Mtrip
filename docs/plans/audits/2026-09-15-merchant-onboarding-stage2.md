# 商户入驻审批整改阶段 2 执行报告

日期：2026-09-15  
范围：注册草稿与基础注册审批；未修改 `merchant-app/**`、`client-app/**`。

## 交付结果

- 注册 OTP 请求同时要求 E.164 手机号和有效邮箱，`otpChannel=email|sms` 只决定投递渠道，验证码固定为 6 位。
- OTP 验证成功后原子创建或恢复申请草稿；Token 绑定站点、申请 ID、手机号 HMAC 和邮箱 HMAC，联系方式使用 AES 加密保存。
- 新增草稿详情、增量保存、步骤和完成度；注册业务使用 `applicationBusinessId/clientRef` 幂等更新并保存真实 `businessType`。
- 基础注册支持提交、补正后重新提交和状态查询；旧 `stage` 只在响应中兼容读取，新注册写入不再更新它。
- 管理端队列和筛选改由 `registration_status` 驱动，新增开始审核、要求补正、批准和驳回动作。
- 基础注册批准只写 `registration_status=approved`、`merchant_kyc_status=draft`，不创建 `merchant_info`、`merchant_admin`、`merchant_store`，也不生成访问码。
- 新增迁移 `V20260915150000__add-registration-draft-identity.sql`，以站点和双联系方式 HMAC 建立有效申请唯一约束。

## 验证

- `scripts/test-merchant-onboarding-registration.sh` 在专属隔离库执行两次迁移和 20 项业务断言，全部通过，测试库由脚本清理。
- PHP 8.1 容器语法检查通过；admin-web TypeScript 检查和生产构建通过；迁移命名校验通过。
- 权限继续复用 `merchant:onboarding:update|approve|reject`，与菜单种子和前端 `v-perm` 一致；跨站审批返回 `40302`。

## 阶段边界

公开 KYC 文件范围、电子签署、KYC 提交和逐范围补正属于阶段 3。本阶段只开放 KYC 状态，不创建 KYC 文档或正式实体。
