# 被驳回入驻申请重新开启实施计划

> For agentic workers: use superpowers:subagent-driven-development for the approved tasks below. User authorized implementation in this conversation; no additional design approval is needed.

**Goal:** 原注册身份显式重新申请、超管带原因协助重开，保留各轮提交／决定，已拒绝列表恢复删除入口。
**Architecture:** 复用原申请ID和身份排他锁；rejected→resubmit_required(4)→submitted(1)→under_review(2)→approved(3)。只新增审核轮次快照表和超管重开权限，不改既有KYC／最终批准门槛。跨端共享下面接口，按文件范围并行。
**Tech Stack:** Hyperf/MySQL、Vue3/Ant Design、Expo React Native。
**Spec:** 用户在本会话确认“原申请重新开启、按轮次留痕”方案；PRD依据与差异见模块19当日记录。用户指令优先于技能的提交／新工作区建议；保留现有未提交改动，不提交推送、不代操作现有申请。

## 约束与接口

- App POST `/api/v1/app/merchant/application/reopen`：`registrationToken,applicationId`，返回完整 ApplicationDetail；有效原身份OTP会话、同站点同联系方式，只允许未转换的基础注册驳回，显式点击才执行。
- ApplicationStatus增加可选 `canReapply:boolean`。KYC拒绝／正式账号不允许借此重新入驻。
- Admin POST `/api/v1/admin/merchant/onboarding/reopen`：`id,reason,expectedRegistrationStatus,expectedStage`，仅isSuper且`merchant:onboarding:reopen`，原因必填。新权限20510，仅超管初始授权。
- `apiOnboardingDetail` 增加 `registrationHistory`：数组元素 `{id,round_no,registration_status,submitted_at,reviewed_at,reviewer_name,review_reason,snapshot:{application:{company_name,company_group_name,merchant_name,reg_number,country,num_businesses,business_types},businesses:[{business_name,business_type,city,contact_name,contact_phone,contact_email}]}}`；电话号码按原详情权限解密／脱敏。旧记录只能从已有数据留存，不能伪造不存在的历史。
- 每轮提交保留不可变资料快照，后续审核更新该轮决定；重开前确保已有驳回记录入档。旧轮信息不能被下一轮修改覆盖。详情用默认收起的历史卡片查看。
- Reopen只恢复编辑，不等同提交或批准，不创建商户／账号，不释放身份给其他申请；受申请行锁保护，与删除／审核串行化。
- 如历史旧模型(stage6)无完整可恢复注册身份，不自动猜测迁移；超管删除仍可释放测试／无效线索，新模型恢复为4。明确记录限制，不越权转换已生成实体。

## Task 1 后端（独立文件域）
- [x] 在隔离库补充重开、旧身份再验证、快照不覆盖、越权／跨站／正式实体阻断和重复请求回归，先失败再实现。
- [x] 新建审核历史服务与版本迁移；修改App服务／Controller／routes、后台Controller／seed权限；登记提交和审核决定，新增只读历史响应。
- [x] 永久删除纳入新历史表；测试清理入口兼容新表；迁移幂等及普通角色不授权。
- [x] 跑注册／删除／队列和相关KYC／最终批准隔离回归。

## Task 2 超管UI（独立文件域）
- [x] 已拒绝申请行／详情增加仅超管重开、删除入口，复用既有删除双确认；重开必须填写原因。
- [x] 复用Onboarding详情卡片展示审核轮次／历史资料，默认收起；成功后同步拒绝列表、计数并关闭失效详情。
- [x] 新接口／类型／中英词条；真实交互测试先失败后通过，类型及构建验证。

## Task 3 商户App（独立文件域）
- [x] 基础注册驳回页显示“修改资料并重新申请”；有效会话点击reopen，回填返回资料再导航Register；登录／OTP恢复本身不自动重开。
- [x] 过期或缺失会话引导原身份OTP验证；KYC拒绝、正式账号不显示该动作，提交仍复用原审核流程。
- [x] 中英词条及API类型，组件行为回归先失败后通过，类型检查与H5构建。

## Task 4 集成验收与本机更新
- [x] 独立审查权限、数据归属、并发和轮次历史；执行项目质量基线及必要跨端回归。
- [x] 备份本机权限／相关表与8090／8094入口；标准迁移工具限定执行本次版本，保留无关待执行迁移；更新静态资源及双池。
- [x] 浏览器只读及取消流程验证现有记录，实际重开／删除仅隔离数据；更新模块19／17、README及HANDOFF。

## 执行记录

- 2026-11-24：接口及文件域已划分，开始失败回归与实现。业务身份占用规则保留，通过原申请恢复完成闭环；不以删除作为重新申请前置。

- 完成：后端189项、KYC75／最终批准83／认可详情15；后台48及App真实组件、质量基线通过。独立复核四项缺口均修复并先红后绿，最后补新历史表随旧申请迁站点，成功与失败回滚均验。
- 本机090000限定迁移74/74，原8条无关pending未执行；8090／8094已备份更新，原资料dump一致，真实页面只读／取消验证。详见[实施记录](./audits/2026-11-24-onboarding-reapply.md)。
