# M12 阶段 S6：规则与合规联动交付

日期：2026-08-28。基线：S5 本地提交 `da15250`。本阶段未暂存、未提交、未推送。

## 1. 完成范围

- 平台规则：正文、预定义分类、严重程度、站点范围、显式商户例外；草稿编辑、即时/未来发布、下线和归档均留存版本。只有超管可维护/发布；站点管理员只能读取本站点适用的已生效政策，不能读取全局草稿或例外名单。
- 商户违规：登记时必须选择适用的已生效规则并锁定修订 ID、分类、原始事实；签发警告、暂停、复核恢复、解决、重开均需要备注。原始违规不被后续处置覆盖。
- 警告：签发和撤销均追加事件；原始原因、级别、期限不改写。撤销/到期状态由读取时计算。旧警告也可以追加撤销记录，不伪造过去的操作历史。
- 状态联动：暂停/恢复调用 S1 统一状态服务；版本冲突、重复请求和并发均受控。合规恢复仅恢复本违规关联的当前暂停，不能绕过黑名单、解除后的超管重新激活或其他暂停实例。
- 通知和审计：每次处置真实站内投递；状态操作复用已有通知，不重复发送。业务记录、状态历史、站内通知和合规事件同库事务；任一关键写入失败整体回滚。规则变更独立留存不可覆盖的版本审计。
- 管理页面：保留四条既有路由，新增规则版本查看、分类/商户/状态筛选、必填备注和状态二次确认。商户档案提供合规入口；活动审计新增警告签发/撤销来源，并保留原始警告来源和导出权限。
- 酒店优先；没有新增餐厅交易实现。Email/SMS/Push 仍未接服务商，不报告外部发送成功。

## 2. 规则与历史的边界

1. 草稿不改变当前政策；未来发布到时由查询实时生效，不依赖额外定时任务。后来的即时下线/归档覆盖更早的预约发布，避免旧预约重新上线。
2. 默认站点 0 为全平台政策；指定站点的政策仅作用于该站点。两者均由超管维护，例外商户需属于政策范围。不会自动暂停商户或自动生成违规。
3. 违规保存当时规则快照引用。新警告/暂停会重新校验当前政策是否有效、适用及是否存在例外；解决、撤销和恢复不因政策下线而阻断。
4. 警告到期日按 UTC 日末计算。暂停/发布时间接收含时区的 ISO8601，存储 UTC。
5. 自动到期恢复继续由 S1 状态任务处理，记录在商户状态历史，不伪造人工合规处置；不能因此自动把违规标记为已解决。
6. 旧规则缺正文/分类时必须先完善后发布。旧违规缺规则修订/分类时保留原记录，可解决/重开，但须登记完整新违规后才可新签发警告或暂停。
7. 原型中的删除警告、修改既有警告与 PRD 不可改写要求冲突，按 PRD 保留历史。升级可追加新的更高级别警告，不自动执行未确认的处罚阈值、双人审批、SLA 或合规评分。

## 3. 接口与权限

既有前缀：`/api/v1/admin/compliance`，网关映射不变。

| 接口 | 变化 |
|---|---|
| GET /rule/list | 草稿/生效版本隔离；带 merchantId 时仅返回当前适用政策；支持分页、分类、关键词和范围 |
| GET /rule/history | 新增超管规则修订历史，分页且保留正文、例外、原因、操作人 |
| POST /rule/save | 保存草稿；title/body/category/severity/expectedVersion/note；新建可选 siteId、exceptionMerchantIds |
| POST /rule/publish | publish/unpublish/archive；id/expectedVersion/note，publish 可带 effectiveAt |
| POST /rule/delete | 兼容旧路由但仅归档，要求发布权限；不删除规则和版本 |
| POST /violation/record | 新增登记；merchantId/ruleId/ruleRevisionId/details/note/expectedVersion=0/requestId |
| POST /violation/handle | resolve/reopen/suspend/restore；id/expectedVersion/requestId/note；状态动作额外 expectedMerchantVersion、confirmed=true |
| POST /warning/issue | id 为违规 ID；版本、请求号、备注、reason、level，expiresAt 可选 |
| POST /warning/revoke | id 为警告 ID；版本、请求号、撤销备注；追加事件 |
| GET /violation/list、/warning/list、/history/list | 真实当前投影、站点隔离、筛选及历史原文 |

新权限 `platform:violation:record`（菜单 70202）只写入权限目录，不自动分配给旧角色。普通处置按现有权限执行；暂停/恢复还分别要求 `merchant:status:suspend/activate`。不增加双人审批。

旧客户端写请求须按以上字段升级；缺少版本或原因会明确拒绝，不再静默补默认值。发生 409 应刷新并重新核对；网络结果不明时保持同一 requestId 和同一内容重试。

## 4. 迁移与运行

- 增量：`database/merchant/32-merchant-compliance.sql`。
- 新增 `platform_rule_revision`，为四张原表追加所需字段/索引；不清空、不回填虚构历史、不改真实商户状态。
- Compose 挂载为 `99d1-merchant-compliance.sql`，紧随原 `99d-compliance.sql`。不能提前放在原合规表创建之前。
- 已在本地开发库执行两次成功；专用测试库由 `scripts/test-m12.ps1` 升级，测试不复制真实数据。
- 本地 merchant-service 已重启并通过 healthz。其他环境上线须先备份、执行迁移，再重启服务；生产发布未执行。
- 数据回退应保留版本/历史表，不直接删除新列；旧写接口会覆盖历史，不建议直接回滚至旧控制器。

## 5. 验证结果与未验项

- S1—S6 隔离集成：**470 项通过**（既有 395 + S6 新增 75）。
- S6 完整套件连续重复 **5 轮，共 375 次检查通过**，含真实数据库并发、事务回滚和旧预约失效验证。
- S6 覆盖规则分类/正文/备注、版本冲突、草稿隔离、即时和未来生效、取消旧预约、跨站/全局草稿保护、商户例外、不可改写原始记录、真实投递、并发仅一方成功、幂等及内容冲突、状态复核恢复、黑名单绕过拒绝。
- 故障注入：合规审计、规则审计、通知失败均验证回滚；控制器请求转发及旧删除入口仅归档亦有检查。
- 质量基线：313 个 PHP 文件语法通过；58 个共享用例/858 断言通过；admin-web 构建及 client-app 类型检查通过。保留既有前端大包警告。
- 浏览器：本地规则、违规、警告、合规历史空数据页面；规则新建/违规登记弹窗；中英切换已核验。没有在真实商户签发警告、暂停或恢复。
- 最终只读核对：开发库规则/违规/警告/合规历史仍各 0 条；S6 测试规则、事件及故障约束残留均为 0。活动审计来源跳转和中文恢复已核验。
- **未验**：有数据的完整浏览器处置链、规则未来生效的真实等待端到端、真实第三方渠道、生产部署、原型像素级一致性。已有 S1—S5 完整 UI、扫码和移动端未验项仍保留到 S7，不据此宣称整个 M12 已验收。

## 6. 改动与追溯

- 后端：PlatformRuleService、MerchantComplianceService、PlatformRuleController、MerchantActivityController、merchant-service 路由。
- 数据库/测试：32 迁移、权限种子、Compose、m12-s6.php、test-m12.ps1。
- 前端：compliance API、四个合规页面、备注确认/筛选/关联导航组件、状态映射、中英词条、商户档案和活动审计入口。
- 文档：本报告、M12 阶段日志、验收矩阵、模块计划、项目 README、计划总览、HANDOFF。
- 原有 ReviewController、start.bat、stop.bat、两份未跟踪 PRD 的 SHA-256 均与开始时一致。
- 本次未执行 git add/commit/push；Git 提交需另行授权。下一阶段为 S7 回归、安全与范围验收。

## 7. S6 文件清单（32 个，不含原有无关改动）

```text
README.md
admin-web/src/api/compliance.ts
admin-web/src/components/merchant/ComplianceActionModal.vue
admin-web/src/components/merchant/ComplianceFilters.vue
admin-web/src/components/merchant/ComplianceLinks.vue
admin-web/src/composables/useCompliancePresentation.ts
admin-web/src/locales/compliance/en-US.ts
admin-web/src/locales/compliance/zh-CN.ts
admin-web/src/locales/en-US.ts
admin-web/src/locales/zh-CN.ts
admin-web/src/views/compliance/history/index.vue
admin-web/src/views/compliance/rules/index.vue
admin-web/src/views/compliance/violations/index.vue
admin-web/src/views/compliance/warnings/index.vue
admin-web/src/views/merchant/activities/index.vue
admin-web/src/views/merchant/list/index.vue
backend/services/merchant-service/app/Controller/MerchantActivityController.php
backend/services/merchant-service/app/Controller/PlatformRuleController.php
backend/services/merchant-service/app/Service/MerchantComplianceService.php
backend/services/merchant-service/app/Service/PlatformRuleService.php
backend/services/merchant-service/config/routes.php
backend/services/merchant-service/test/m12-s6.php
database/merchant/32-merchant-compliance.sql
database/seed/02-menu.sql
deploy/docker-compose.yml
docs/plans/15-M12-merchant-management.md
docs/plans/HANDOFF.md
docs/plans/README.md
docs/plans/m12/01-tasks-and-tests.md
docs/plans/m12/07-s6-delivery.md
docs/plans/m12/CHANGELOG.md
scripts/test-m12.ps1
```
