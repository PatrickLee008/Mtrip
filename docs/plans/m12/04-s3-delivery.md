# M12 S3 证件、活动与站内通知交付

日期：2026-08-27。基线：dev / 87cfb66（S1＋S2联合提交）。
状态：S3核心编码和隔离集成测试完成；交付时未暂存、未提交、未推送。
Git补充（2026-08-27）：用户随后明确授权本次S3本地提交，不推送；提交范围为第6节46个文件，标题为“feat(merchant): 完成 M12 S3 证件管理、活动审计与站内通知”。哈希以Git日志及提交回执为准；第5节Git状态保留为原交付快照，不代表本次授权后的状态。未验事项及后续阶段单独授权约定不变。
业务边界：酒店优先；不新增餐厅业务、2FA、模拟登录、排名或S6合规执行功能。

## 1. 本阶段实现

### 证件（R12-DOC / D8）

- 独立替换、审核、下载权限；旧审核入口对已批准商户同样执行新权限，不能借模块11绕过。
- 替换原因必填，当前版本校验、行锁、PDF/JPEG/PNG/WebP实际MIME检查、10MB上限。新版本待审，绝不自动通过或暂停商户。
- 复用旧revision表，新增可空lifecycle_version及唯一键，保留原有旧版本；首次操作时为当前旧文件保存明确的历史快照，不伪造上传人或过去事件。
- 新版本文件随机命名、SHA-256摘要、版本事件追加保存。重复/并发审核不能覆盖既有结果；审核前检查文件存在与摘要；旧版本可授权下载。
- 审核/拒绝/替换/要求重交/到期及下载均有事件；关键状态与活动同库事务。要求重交会实际写入站内信。
- 每分钟扫描已通过但已过期证件，追加一次到期事件；KYC按既有模板所需文件计算，不改商户经营状态。
- 模块11代传保留草稿→提交核验规则，代传前保存旧文件快照。其预览入口也改用受控下载，不重做入驻业务。
- 网关拒绝公开 `/uploads/kyc/`，已有本地KYC文件也不能匿名直读；后台鉴权读取，响应no-store/private，日志不记录文件正文。管理页支持PDF/图片预览与下载。

### 活动（R12-ACTIVITY）

- 登录、本人密码变更及子账号创建/资料/停启/密码重置记录真实账号身份；不记录密码、token或原始请求正文。
- 经营写操作增加脱敏请求级活动；集团账号标明集团对象，不冒充某个下属商户的操作。
- 页面可切换活动、状态、核验、警告、合规的原始记录，按各来源权限及站点限制；未产生的历史不补造。
- 导出有独立权限，按固定最大ID及向前游标分批读取；超过200条不截断，导出文本防CSV公式注入。
- 经营请求级活动为补充审计：业务已提交后记录失败会明确告警，不返回误导性的业务失败；不能宣称其与跨服务业务原子提交。证件、通知、状态及本阶段账号变更的强审计另在业务事务中。

### 通知（R12-NOTIFY / D7）

- 仅站内信真实投递；email/sms/push配置状态预留，界面禁选，服务端明确拒绝混合请求，不静默降级或伪报成功。
- 模板限定目标商户所属站点＋平台通用；保存发送时的标题/正文及模板ID，后续改模板不回写既有消息。
- 立即/未来排期、UTC存储、明确时区输入、请求幂等、逐渠道状态/次数/回执；定时任务行锁保证多worker不会重复投递。
- 商户收件箱只展示到期且已投递的站内消息，已读归属登录账号。历史read_by存在时仅迁移该真实阅读者，不批量伪造已读。
- 深链只允许受控应用内页面或本商户预订/促销；发送时和跳转时均校验归属，目标详情接口继续独立鉴权。
- S1状态通知同步补齐真实站内投递回执。旧通知没有服务商回执时明确标为历史记录，不编造外部发送成功。

## 2. 数据库与上线顺序

新增 `database/merchant/29-merchant-documents-notifications.sql`，登记compose初始化序列39k。

1. 先备份涉及表结构及按部署制度备份数据；本次本地保存了结构快照，没有执行业务数据导出。
2. 存量库按27→28→29执行；29仅新增列/表/索引及4个菜单权限，不自动给普通角色扩权，不删除旧数据。
3. 部署后端及前端，重启商户服务以及使用共享商户鉴权的服务，刷新Hyperf代理缓存。
4. 检查并重载网关：KYC静态公开路径必须拒绝访问。不能只部署页面而保留公开下载路径。
5. 上传10MB，JSON文件响应约13.4MB；商户服务请求/输出缓冲设16MB，现网关20MB上传上限保留。

本地29已重复执行通过。首次遇到旧库缺少read_by，已改为字段存在才迁移已读；不依赖旧库必须曾执行22迁移。
新权限：merchant:document:replace、merchant:document:verify、merchant:document:download、merchant:activity:export。
回退保留新历史表，不删除文件；不得通过恢复公开KYC路径或旧无版本审核来回退。

## 3. 实测结果

| 验证 | 结果 |
|---|---|
| 全量PHP语法 | 298文件，0错误 |
| shared纯逻辑单测 | 54用例，815断言，全部通过 |
| S1状态集成 | 51项通过 |
| S1订单/Trip/门票回归 | 25项通过 |
| S2目录/物业集成 | 62项通过 |
| S3证件/活动/通知集成 | 70项通过；含多进程并发与故障注入 |
| admin-web生产构建 | 通过（vue-tsc＋Vite） |
| merchant-web生产构建 | 通过（vue-tsc＋Vite） |
| client-app类型检查 | 通过 |
| 网关匿名KYC路径 / 未登录下载接口 | HTTP 404 / 401 |
| 服务healthz | 八个服务均ok |

复测入口：`scripts/check.ps1`、`scripts/test-m12.ps1`、merchant-web内`npm run build`。
全部208项集成检查只使用mtrip_m12_s1_test；最终商户、证件事件、通知投递及已读夹具均清理。
关键S3场景：跨站/旧入口越权拒绝、旧版本审核409、并发审核单一胜出、旧文件仍可读、审核审计故障回滚、真实重交通知、到期事件去重、混合外部渠道拒绝、幂等发送、非法时间/外链拒绝、定时消息提前不可见、并发投递一次、账号独立已读、425条导出无漏项/重复、当前文件摘要篡改拒绝、10MB往返及超限拒绝、防缓存响应。

开发库只核查元信息：77条证件中35条为本地KYC引用，其余未上传，无其他外部文件引用；本阶段没有在真实商户执行替换/审核/发送测试。新增证件事件、受管版本和投递记录仍为0。

## 4. 未验与保留边界

- Chrome和应用内浏览器均在打开页面时超时；本轮没有完成在线原型、PDF嵌入预览、中英文视觉及浏览器端完整上传/审核/通知操作验收。页面复用现有Vue/Ant Design组件与原型说明，不把构建结果当作视觉验收。
- 10MB往返在服务集成层通过；完整网关multipart上传及大文件浏览器预览尚未实测。
- 模块11整条入驻提交/重交流程未重新端到端验收；更改仅限历史保留、审核版本校验和受控文件入口。
- 生产规模导出、压力/长期调度、全新空卷初始化未测；保留既有Vite大chunk警告。
- 普通管理员需显式授予独立证件/导出权限；没有擅自修改现有角色授权。
- S4的2FA/模拟登录事件、S6的合规追加式执行/警告通知仍待相应阶段；本阶段提供现有记录只读入口，不宣称完整模块12已完成。
- 外部服务商实际发送、回执、重试仍按用户决定延期；无法映射到受控本地路径的历史文件会拒绝下载并要求人工迁移，不自动抓取外部URL。
- 文件落盘不属于MySQL事务；替换失败只清理本次新文件。模块11原有跨库sys_file写入仍不具备跨库原子性，不在S3宣称已解决。

## 5. Git与接续

- HEAD保持87cfb66；本阶段不执行add/commit/push。
- 原ReviewController修改、start/stop脚本和两份未跟踪PRD均保留，内容哈希核对未变。
- 下一阶段S4：账号级Google Authenticator 2FA及真实模拟登录；继续酒店优先，Git由用户操作。
- 交付前建议补做第4节UI与模块11验收后，再由用户决定提交和后续上线安排。

## 6. S3文件清单

以下46个文件为本阶段范围，供用户审阅与自行提交；不包含上述5个原有文件。此清单不是已暂存清单。

```text
README.md
admin-web/src/api/merchant.ts
admin-web/src/components/merchant/DocumentReplaceModal.vue
admin-web/src/components/merchant/NotifyDrawer.vue
admin-web/src/locales/en-US.ts
admin-web/src/locales/zh-CN.ts
admin-web/src/utils/merchantDocument.ts
admin-web/src/views/merchant/activities/index.vue
admin-web/src/views/merchant/documents/index.vue
admin-web/src/views/merchant/onboarding/index.vue
admin-web/src/views/merchant/verify/index.vue
backend/services/merchant-service/app/Controller/Merchant/AccountController.php
backend/services/merchant-service/app/Controller/Merchant/NotificationController.php
backend/services/merchant-service/app/Controller/MerchantActivityController.php
backend/services/merchant-service/app/Controller/MerchantDocumentController.php
backend/services/merchant-service/app/Controller/NotificationController.php
backend/services/merchant-service/app/Controller/OnboardingController.php
backend/services/merchant-service/app/Controller/VerifyController.php
backend/services/merchant-service/app/Service/Merchant/MerchantAuthService.php
backend/services/merchant-service/app/Service/MerchantActivityService.php
backend/services/merchant-service/app/Service/MerchantDocumentService.php
backend/services/merchant-service/app/Service/MerchantNotificationService.php
backend/services/merchant-service/app/Service/MerchantStatusService.php
backend/services/merchant-service/config/autoload/crontab.php
backend/services/merchant-service/config/autoload/server.php
backend/services/merchant-service/config/routes.php
backend/services/merchant-service/test/m12-s3.php
backend/services/merchant-service/test/m12-status.php
backend/shared/src/Middleware/MerchantAuthMiddleware.php
backend/shared/src/Middleware/RequestLogMiddleware.php
database/merchant/29-merchant-documents-notifications.sql
database/seed/02-menu.sql
deploy/docker-compose.yml
deploy/openresty/conf.d/mtrip.conf
docs/plans/15-M12-merchant-management.md
docs/plans/HANDOFF.md
docs/plans/README.md
docs/plans/m12/01-tasks-and-tests.md
docs/plans/m12/04-s3-delivery.md
docs/plans/m12/CHANGELOG.md
merchant-web/src/locales/en-US.ts
merchant-web/src/locales/zh-CN.ts
merchant-web/src/views/notifications/index.vue
merchant-web/src/views/order/index.vue
merchant-web/src/views/promotions/index.vue
scripts/test-m12.ps1
```
