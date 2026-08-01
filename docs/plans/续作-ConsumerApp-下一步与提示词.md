# Consumer App PRD v1.0 续作:下一步与新会话提示词

> 用途:下次开新会话时,先读本文件即可接着干。权威细节见 [实现方案-ConsumerApp-PRDv1.0.md](./实现方案-ConsumerApp-PRDv1.0.md)(文末有「PRD 覆盖矩阵 + 遗留清单」)与 [HANDOFF.md](./HANDOFF.md) 顶部「★ 需求基准变更」。
> 更新时间:2026-08-02

## 一句话现状

需求基准 = `设计文档/mTrip_ Consumer App PRD_v1.0.md`(缅甸 C 端酒店预订超级 App)。在 **dev 分支**已实现:M0 地基 → M1 核心预订闭环 → M2 促销与用户资产 → M3 运营与风控 → M4 Trip 多酒店 → admin 管理端(移动运营菜单 + cops/* 10 页)→ Module 3 可配置筛选 → 促销中心活动 → 打磨(住客 PII 加密 / Trip 推荐返利)。**每增量本地 `scripts/check.ps1` 四步全绿**。三项架构级 A1 退款钱包化 / A2 Trip / A3 出资分账全部落地。**PRD 首发范围 + 自包含打磨项已全部完成。**

## 开工先做两件事

1. **看提交状态**:`git -C D:\GIT\jiaxu\MTrip status --short`、`git log --oneline -15`。本轮约定「逐增量本地验收后由用户在 dev 统一提交」;若有未提交改动,先按增量粒度 commit(信息参考 README 变更记录 2026-08-02 那几条)。
2. **跑一次基线**:`powershell -ExecutionPolicy Bypass -File scripts/check.ps1`,确认四步 ExitCode 全 0 再动手。
   > 注意:上轮会话里 AI 侧命令执行常被安全分类器临时限流(报 "temporarily unavailable"),届时由**用户在终端手动跑 check.ps1 并回贴结果**即可继续。

## 剩余待办(按可独立推进程度)

### A. 需第三方选型/授权(AI 无法独立完成,须你先决策)
- **通知多渠道分发**:Push(FCM/APNs)/SMS/Email + 模板本地化。现状:站内信(notify_record)已通、事件触发已埋(order pay/applyRefund)。要做:接第三方 + `notify_template` 模板表 + 渲染 + admin 模板管理。**需先定推送/短信/邮件服务商与密钥。**
- **正式支付收单**:Stripe/PayPal 替换当前 mock。现状:payment-service 为渠道抽象 + 回调落日志。要做:正式验签/收单、支付成功回调驱动 order/Trip 确认。**需支付账号与密钥授权。**
  - 关联:**Trip 预订失败补偿**(某子单确认失败仅退该单)——依赖正式支付回调才能真实触发,现为结构化占位。

### B. 可独立做的打磨(低优先)
- **cops/* 10 页 i18n 词条**:现中文直出;若要英文/缅语,补 `admin-web/src/locales/{en-US,zh-CN}.ts` 词条 + 页面改 `t()`。菜单标题已走种子中/英文名,无需改。
- 其余零散见实现方案「遗留清单」。

### C. Phase2(PRD 明示不在首发)
- AI 助手、旅行保险。需产品排期。

## 关键工程约定(勿违反)

- Windows + PowerShell:命令用 `;` 分隔,禁 `&&`。
- 交付前跑 `scripts/check.ps1`(backend php -l / shared 单测 / admin-web vue-tsc build / client-app typecheck),四步全绿才提交。
- 后端约定见 HANDOFF 第4节;C 端 `/api/v1/app/*` + `UserAuthMiddleware`,管理端 `/api/v1/admin/*` + `AdminAuthMiddleware`;写接口 `#[Permission('键')]` 且键与 `database/seed/02-menu.sql` 的 perm_key 对齐。
- 新增 admin 页面 component 无 Vue 文件时自动回退 `views/wip/index.vue`;i18n_key 留空则回退中/英文名。
- 数据迁移放 `database/<域>/`,在 `deploy/docker-compose.yml` 按编号挂载(已用到 97/98;下一个从 99 起);既有库 ADD COLUMN 非幂等,需手动执行。
- 三条硬约定(统一响应 `{code,message,data}` / Permission 键对齐菜单种子 / 站点隔离)见根 AGENTS.md。

## 复制粘贴给新会话的提示词

```
本项目需求基准已切换为 Consumer App PRD v1.0(缅甸 C 端酒店预订超级 App)。
请先读 docs/plans/续作-ConsumerApp-下一步与提示词.md、docs/plans/HANDOFF.md 顶部「★ 需求基准变更」、
docs/plans/实现方案-ConsumerApp-PRDv1.0.md 文末「PRD 覆盖矩阵 + 遗留清单」,了解已完成范围与工程约定。

现状:dev 分支已完成 PRD 首发全部范围 + 自包含打磨项,每增量 scripts/check.ps1 四步全绿。
第一步:先 git status 看有无未提交改动,有则按增量粒度在 dev 提交;再跑一次 scripts/check.ps1 确认全绿。

然后按我指定的方向继续(二选一或我另行指定):
  (1) 打磨:给 cops/* 10 个 admin 页补 i18n 词条;
  (2) 接第三方(我会提供选型/密钥):通知多渠道分发 或 正式 Stripe/PayPal 收单。

工作方式不变:改动后本地跑 scripts/check.ps1 四步全绿再提交;
若你(AI)侧命令执行被安全分类器限流,告诉我,我在终端手动跑 check.ps1 回贴结果。
每完成一项同步更新 docs/plans/ 实现方案、README 进度表、HANDOFF。
```
