# 后台协助入驻 KYC 与测试协议确认

后续状态：用户已完成 ID 2 申请最终批准，账号待激活；由于没有邮件渠道，随后授权开启凭证弹窗与固定 OTP 测试模式。当前操作以[测试模式说明](./2026-09-15-merchant-auth-test-mode.md)为准，以下为 KYC 和联系方式整改记录。

## 使用入口

后台「商户管理 → 商户入驻」(`/merchant/onboarding`) 打开已通过基础注册的申请详情，在 KYC 区域操作：

1. 在「商户主体 KYC」和每家「首批物业 KYC」的文件行点击上传，选择真实 PDF/JPEG/PNG/WebP 文件（单文件最多 10MB）。上传仅保存文档，不能直接获得审核通过状态。
2. Merchant App 暂未提供签署 UI 时，开发环境超级管理员点击「协议一键确认（仅测试）」，填写原因并确认。列表显示「测试已确认（非商户签署）」。
3. 点击「提交核验」。必须满足当前协议和全部待提交范围的必需文件要求；缺失文件会返回明确错误，整次提交回滚。
4. 进入「商户管理 → 商户文档」(`/merchant/documents`)，分别审核商户和每家首批物业文档。被退回的文件在原申请详情上传替换并重新提交，已批准范围保持有效。
5. 全部 KYC 审核通过后回到申请详情，由超级管理员执行「最终批准」，继续账号激活、物业资料/房型审核及发布流程。

2026-09-15 后续修复：后台新增线索现要求独立填写账号注册手机号（含国际区号）和邮箱，默认由管理员确认，无需注册 OTP。`registration_channel=admin` 区分管理员确认和 OTP；凭证默认发送注册邮箱。资料审核及账号激活仍按原流程执行。详情中的最终批准按钮对符合账号状态的超级管理员保持可见，未满足条件时禁用并显示具体原因。

存量申请不会在读取详情时被隐式修改。本次检查发现 `APP-20260001`（ID 2）确为后台代录、商户 KYC 已通过且只有一家首批物业，但联系人手机号缺少国际区号；邮箱格式有效。用户随后确认区号 `+86`，已与现有中国手机号组合校验，并补齐申请级加密联系方式及管理员确认来源；邮箱沿用唯一物业的有效联系人邮箱。回读 `readiness={ready:true,reasons:[]}`，KYC 保留，未执行最终批准。补齐时间线记录用户授权、区号及原录入来源，操作者标记为系统维护，不冒充管理员在线操作。

## 接口与审计

- 复用 `POST /api/v1/admin/merchant/onboarding/kyc-upload`：新流程 multipart 参数为 `id/file/docType/scopeType/applicationBusinessId`；商户范围 `scopeType=merchant,applicationBusinessId=0`，首批物业范围为 `property` 加申请业务 ID。
- 复用 `POST /api/v1/admin/merchant/onboarding/submit-verification`：新流程仅需 `id`，原子提交所有可提交范围；旧流程 `businessId` 参数和逻辑继续兼容。
- 新增 `POST /api/v1/admin/merchant/onboarding/test-confirm-agreement`：`id/agreementId/version/reason`，复用 `merchant:onboarding:kyc` 权限并额外检查超级管理员和 `APP_ENV`。
- 详情 `kyc.testAgreementAvailable` 表示当前管理员是否可使用测试入口；协议新增 `status=test_confirmed` 和 `satisfied`。客户端不能将测试状态展示成商户已签名。
- 后台新增线索 `POST /api/v1/admin/merchant/onboarding/add` 新增必填 `registrationPhone/registrationEmail`；此二者用于主账号及凭证投递，不能自动取第一家物业联系人。服务端规范化、加密保存，身份哈希与 OTP 相同，同站点重复身份拒绝；忽略客户端伪造的验证来源/状态，写入 `registration_contacts_admin_confirmed` 时间线及实际管理员。
- 最终批准就绪检查统一纳入注册联系方式完整性和 `email/sms/admin` 来源，未满足时返回 `registration_contacts_not_verified`。管理员确认来源默认使用 `email` 和 `inapp` 投递，仍要求包含注册邮箱渠道；公共 OTP 接口不接受 `admin` 渠道。
- 上传审计事件的 actor 为实际管理员；文档版本 `source=admin_assisted` 并记录上传人；提交时间线和首批物业 `kyc_submitted_by` 同步记录管理员。

## 测试确认边界

仅 `APP_ENV=dev/local/test` 开放；其他值（包括 `prod/production`）均拒绝测试确认，并且提交和最终批准不接受数据库中已存在的测试确认。

测试确认复用协议记录表保存当前协议 ID、版本、摘要和操作人，`signer_role=admin_test_confirmation`、`signature_file_url=test-only:admin-confirmation`。不生成签名图片，不设置商户真实 `confirmation_status`；时间线 `agreement_test_confirmed` 明确标记异常/测试原因。测试记录中的时间、摘要是测试操作证据，不代表真实签名证据。

重复确认有效版本幂等返回，不覆盖真实签署；协议版本更新后必须重新确认，旧页面发来的版本被拒绝；最终批准后禁止新测试确认。KYC、联系方式验证、账号激活和酒店发布门禁均保留。

没有数据库迁移或新权限键。两个 App 均未改动。

## 验证

- admin-web 类型检查和生产构建通过；PHP 语法检查通过。
- 独立测试容器 `mtrip-kyc-assist-validation` 内：`test-merchant-onboarding-kyc.sh` 50 项通过，包括代传/提交操作者、跨站、缺文件、非超管拒绝、生产拒绝测试记录、重复确认幂等、协议换版和最终批准后拒绝；`test-merchant-onboarding-final-approval.sh` 19 项通过，覆盖真实签署最终批准、实体创建、投递和并发幂等。
- 两个商户服务已重启并通过 `/healthz`。初次重启因自动审批器容量不足未执行，先用独立容器完成验证后已成功加载；无待审批阻断。
- 本次未执行真实登录态浏览器上传和人工签署操作；上述验证是控制器/服务隔离集成测试与前端类型/构建检查。
- 两个一次性测试数据库及临时容器均已清理，手动测试库无本次 KYC 申请夹具，迁移账本仍为 15 条已执行。

后续联系方式修复验证：30 项注册、50 项 KYC、27 项最终批准集成断言通过，覆盖后台创建、必填/格式、站点隔离、独立主账号联系方式、加密/哈希、重复身份、真实操作人、公共接口不能冒充管理员确认、最终批准前置原因、待激活账号与邮箱投递。admin-web 类型检查/构建和四个修改后端文件 PHP 语法通过。服务双池已重启且 healthz 正常，三个一次性测试库均已清理；无新增迁移，不修改两个 App。浏览器工具因当前鉴权方式不受支持未能读取标签页，未宣称真实登录态按钮点击验证。
