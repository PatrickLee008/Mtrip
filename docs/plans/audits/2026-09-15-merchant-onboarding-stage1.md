# 商户入驻审批阶段 1 执行报告

> 执行日期：2026-09-15（Asia/Shanghai）
> 范围：数据模型、生产迁移、迁移专项测试和计划文档。
> 迁移：`V20260915120000__add-onboarding-contract-model.sql`

## 1. 阶段边界

- 本阶段没有修改注册、基础审批、KYC、最终批准、激活或登录的运行时业务逻辑。
- 本阶段没有修改 `merchant-app/**` 或 `client-app/**`；`client-app/**` 原有未提交修改保持原状。
- 没有新增管理端页面、菜单、路由或权限。
- 本地开发库只执行版本迁移及确定性回填；隔离测试数据均位于两个固定测试库并已自动清理。

## 2. 已落地数据模型

### 2.1 申请状态与注册资料

`merchant_application` 新增 23 个字段：

- 双联系方式密文和检索哈希：`registration_phone`、`registration_phone_index`、`registration_email`、`registration_email_index`。
- 存量联系方式处理标记：`contact_data_status`。现有申请不从业务联系人字段猜测注册手机号或邮箱，统一标记为待补全。
- 三层状态：`registration_status`、`merchant_kyc_status`、`account_status`。
- 迁移保护：`state_model_version`。首次回填后为 1，迁移二次执行不会覆盖后续业务状态。
- 草稿进度：`current_step`、`completion_percent`、`last_activity_at`。
- 主业务类型：`primary_business_type`。只有申请内存在唯一明确业务类型时才自动回填。
- 注册和商户 KYC 审核信息、当前签署记录、最终批准幂等请求和批准时间。

### 2.2 注册业务与首批物业

`merchant_application_business` 新增 `client_ref`、国家/城市标识、地址、首批物业 KYC 版本、批准时间和补正/驳回原因。

本阶段复用既有 `merchant_store.uk_source_business(source_business_id)` 唯一索引，保证同一注册业务最多转换为一家正式物业。阶段 1 不创建物业，也不改变已有物业状态。

### 2.3 文档范围

`merchant_verify_document` 新增：

- `application_business_id`：入驻期首批物业的明确归属键。
- `scope_resolution_status`、`scope_resolution_note`：记录确定性映射或人工处理原因。
- `scope_model_version`：保证范围回填只初始化一次。

回填只接受以下明确关系：

1. 数字 `biz_unit` 必须精确匹配同站点、同申请的 `merchant_application_business.id`。
2. 运行期物业文档必须通过同站点、同商户的 `merchant_store.source_business_id` 回填。
3. 同一站点、申请和文档类型同时存在申请级与旧业务级记录时，两侧均标记人工处理，不合并、不删除、不覆盖文件。
4. 数字旧业务 ID 无法在同站点、同申请匹配，或范围键互相冲突时，标记人工处理。

### 2.4 条款、签署与访问码

- 新增 `merchant_onboarding_agreement`，保存站点、条款版本、正文摘要、发布状态和生效时间。
- 新增 `merchant_application_signature`，保存申请、条款版本及摘要、签署人、角色、签名文件及摘要、阅读/签署时间、IP 和 User-Agent。
- `merchant_info.access_code_normalized` 以大写生成访问码唯一键；空访问码生成 `NULL`，非空访问码在全部历史记录中永久不可复用。
- 迁移先检查大小写不敏感重复访问码；发现冲突时在任何业务表结构 DDL 前失败。

## 3. 开发库迁移结果

| 验收项 | 结果 |
|---|---|
| 迁移账本 | 已执行 11，待执行 0 |
| 申请/注册业务/文档记录数 | 1 / 1 / 15，与阶段 0 基线一致 |
| 存量申请状态 | `stage=5` 回填为注册通过、商户 KYC 通过、账号已激活 |
| 主业务类型 | 唯一酒店业务回填为 `hotel` |
| 双联系方式 | 未猜测恢复，`contact_data_status=1` 等待后续补录 |
| 重复范围 | 6 个文档类型、12 条记录标记待人工处理 |
| 物业文档 | 3 条均通过 `source_business_id=1` 精确关联 `application_business_id=1` |
| 新字段 | 35/35 存在 |
| 新索引及既有来源约束 | 8 个阶段 1 索引及 `uk_source_business` 均存在 |
| 条款/签署表 | 两表存在，当前均为 0 行 |
| 访问码 | 现有 `MTRP-*` 保持不变，同时生成对应大写唯一键 |

需要人工处理的 12 条记录是现有 6 份申请级待审文档和 6 份旧业务级已通过文档。阶段 1 保留两侧原状态、文件地址和版本信息，由阶段 3 按业务规则确认最终有效范围。

## 4. 验证

- `bash scripts/test-merchant-onboarding-contract-migration.sh` 通过：覆盖有数据升级、空表升级、迁移二次执行、三层状态、唯一主业务类型、同一申请两家首批物业、文档冲突、跨站拒绝关联、孤儿旧 ID、文档数量/文件版本保持、重复来源映射拒绝，以及有效/软删除记录大小写访问码冲突在业务表结构 DDL 前阻断。
- `bash scripts/db-migrate.sh --validate` 通过，共 11 个合法版本。
- `bash scripts/db-migrate.sh` 成功应用唯一待执行版本，并完成 11/11 完整账本复核。
- 开发库逐项只读 SQL 验收通过，隔离测试库已清理。
- `bash deploy/mtrip.sh health` 通过：8 个主池服务、5 个 App 孪生池服务及网关健康检查均正常，网关转发返回预期的签名校验 401。
- `bash -n scripts/test-merchant-onboarding-contract-migration.sh` 与 `git diff --check` 通过。

## 5. 未在本阶段处理

- 现有接口仍读取和写入旧 `stage`；三层状态尚未驱动业务行为。
- 公开 KYC 提交控制器缺失、商户级/首批物业文档新写入、电子签署和审核闭环留到阶段 2、3。
- `HXXXXX/CXXXXX` 的生成、最终批准事务、账号分配和凭证投递留到阶段 4。
- 最终批准失败时的全事务回滚属于阶段 4 的运行时验收；阶段 1 已验证迁移前置冲突会在任何业务表结构 DDL 前终止。

阶段 1 已达到停止门槛。进入阶段 2 前需单独授权。
