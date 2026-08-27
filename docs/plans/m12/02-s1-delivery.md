# M12 阶段1开发与测试交付

日期：2026-08-27
项目：D:\软件项目\Mtrip海外旅游平台\源码\Mtrip
状态：阶段1代码及核心自动化验证完成；完整浏览器写入回归等未测项列于第4节。不是整个模块12的最终验收。

## 1. 本轮结论

- 酒店优先。餐厅只保留既有类型及未来扩展边界，不新增餐厅页面、展示、排名或交易。
- 已实现暂停/普通恢复、超管拉黑/解除/独立重新激活，以及状态历史、备注、临时期限、自动到期恢复。
- 单笔与Trip下单、付款均检查商户经营状态。暂停前未支付的订单也不得首次付款；已确认订单可继续由有权限的商户账号履约，不自动取消订单，不批量改商品上架状态。
- 暂停商户可以通过用户名或访问码登录；黑名单、已禁用或已删除账号在后续JWT请求中被实时拦截。集团过滤黑名单商户。
- 状态、历史、活动与站内通知在同一业务库事务内提交；失败整体回滚。系统库操作日志是补充记录，失败会告警，不声称跨库原子性。
- 没有执行Git暂存、提交、推送或历史改写。Git由用户自行操作。

## 2. 实现与接口

### 状态规则

| 当前状态 | 操作 | 结果 |
|---|---|---|
| 正常 | 暂停 | 已暂停；可选截止时间 |
| 普通暂停 | 恢复或当前暂停实例到期 | 正常 |
| 正常/暂停 | 超管拉黑 | 已暂停＋有效黑名单；清除到期实例 |
| 黑名单 | 超管解除 | 仍暂停；须超管另行激活 |
| 解除黑名单后的暂停 | 超管重新激活 | 正常 |
| 待审、历史状态1、拒绝、注销、待重交 | 经营激活 | 拒绝，不绕过模块11 |

状态历史从本次功能启用后开始追加，不补造此前操作。数据库沿用原有数值状态，黑名单仍是独立叠加状态。

### 请求契约

现有接口统一接入状态服务：

- POST /api/v1/admin/merchant/suspend
- POST /api/v1/admin/merchant/activate
- POST /api/v1/admin/merchant/blacklist
- POST /api/v1/admin/merchant/unblacklist
- POST /api/v1/admin/merchant/toggle-status（兼容路由，不兼容缺少审计参数的旧请求）

新增接口：

- POST /api/v1/admin/merchant/reactivate
- GET /api/v1/admin/merchant/status-history?id=商户ID&page=1&pageSize=20

写请求需要id、note（1～500字）、expectedVersion、requestId（8～80位字母/数字/下划线/连字符）；暂停可附suspendedUntil，使用带时区ISO8601，例如2030-01-01T18:00:00+08:00。支持可选evidence。旧reason字段可作为note的兼容输入，但不自动填造备注。

相同requestId、相同内容返回原结果；不同内容冲突。过期状态版本返回40901。截止时间统一存UTC，界面按浏览器时区展示。定时任务每分钟扫描，恢复必须匹配当前暂停实例和版本。

### 权限

merchant:status:suspend / activate / blacklist / unblacklist / reactivate / history分别与后端、菜单和界面对应。黑名单操作及解除后重新激活同时要求isSuper；site_id=0不单独作为超管证据。

旧状态权限的角色只继承普通暂停、恢复和历史查看，不自动获得黑名单特权。普通管理员需要重新登录刷新JWT中的权限集合。

### 门店边界

现有订单和商品没有可验证的门店归属字段。本轮不猜测酒店物业与门店关联，也不将同商户的其他物业数据授权给门店账号。

门店账号可继续使用明确按自身store_id隔离的资源；商户级商品、订单、收益等集合暂不开放给门店账号。历史订单由商户级账号继续处理。S2应优先补齐酒店物业映射，再单独开放门店级经营数据。

## 3. 实际通过的测试

| 检查 | 实际结果 |
|---|---|
| 全量PHP语法 | 286个文件，0错误 |
| shared单元测试 | 52个测试、801次断言，全部通过；新增5个M12测试 |
| 状态集成脚本 | 51条PASS检查 |
| 订单集成脚本 | 25条PASS检查 |
| admin-web类型检查＋生产构建 | 通过 |
| merchant-web类型检查＋生产构建 | 通过 |
| client-app类型检查 | 通过 |
| compose配置校验、git diff --check | 通过 |
| 本地8个应用服务healthz | 均为ok |
| 27号迁移连续执行两次 | 成功，无重复结构或权限 |
| 定时调度 | 实际运行日志显示每分钟成功执行merchant-suspension-expiry |

76条集成检查不等于76个独立业务用例，也不等于原矩阵36项全部端到端验收。测试调用真实控制器/服务及真实MySQL，订单算法、库存和事务未用Mock替代。

重点已验证：

- 缺备注、越权、跨站、版本冲突、幂等重试和不同内容重用requestId。
- 黑名单解除仍暂停；普通activate及旧toggle不能绕过超管重新激活。
- 两个独立PHP进程同时到期恢复，仅产生一条状态变化。
- 状态历史或站内通知写入故障时事务回滚；跨系统库日志故障保留强审计并告警。
- 暂停商户两种登录入口可用；access_status=0不被误判账号禁用；黑名单旧JWT校验拒绝；账号禁用/删除拒绝。
- 集团过滤黑名单；空范围不回退到merchant_id=0；门店不继承商户级全集。
- 正常酒店单笔与Trip创建、金额及支付确认；暂停/黑名单下创建和首次付款被拒绝，未留下部分订单/库存流水。
- 反向商户顺序的两个Trip进程完成；暂停先获得商户行锁时并发下单被拒绝。
- 暂停后已确认订单详情及核销正常；商户门票、独立供应商门票价格、类型2及付款回归通过。
- 新旧状态控制器统一委托服务，历史查询跨站拒绝。

浏览器已完成中文页面冒烟：商户列表入口、暂停弹窗、空备注拦截、填写备注后的二次确认、取消操作、状态历史抽屉及空历史说明；未见浏览器控制台错误。没有在现有商户上确认写入操作。

## 4. 尚未验收及后续范围

- 未执行浏览器最终提交状态变更的完整端到端回归；没有用修改现有商户来替代隔离测试。
- 英文视觉、不同普通管理员浏览器会话、长列表历史分页及窄屏布局未完整浏览器验收。中英词条和类型构建已通过。
- 网关到客户端的完整签名/JWT HTTP链路未覆盖全部场景；本轮主要为真实控制器/服务＋数据库集成测试。
- 全新空卷完整初始化、已有重复黑名单数据的迁移失败分支未实际执行；迁移已包含冲突查询及唯一索引，不会自动删改冲突数据。
- 目前的并发验证是有限场景双进程检查，不等于生产压测。
- 目录/档案深度整改、酒店物业实体映射、证件版本、账号级强制2FA、真实模拟登录、排名和合规仍在S2～S6；既有未完成的访问码展示/安全功能不因本次状态整改而被宣称已完成。
- 邮件、短信、Push没有服务商，本轮只实际写入站内通知，不报告外部投递成功。
- 既有前端大chunk构建警告保留，未顺带重构。

## 5. 本地环境与复测

已应用database/merchant/27-merchant-status.sql，并登记compose初始化顺序39i。追加字段/表/权限，不改变现有商户经营状态。已有数据卷需要显式执行增量，不要使用docker down -v。

共享鉴权代码已通过重启8个本地应用服务加载；MySQL和Redis未重建。

隔离库mtrip_m12_s1_test只复制表结构，不复制真实数据。测试夹具按本轮ID清理；早期测试失败留下的ID8～13及关联测试数据也已清理，剩余测试商户数为0。测试库结构保留用于复跑，夹具可重建。

开发库复核：有效商户仍为10个（状态0=2、2=1、3=7），本轮状态历史新增数为0，即未对现有商户执行状态写入。

复测入口（在项目根目录、Docker运行且27号迁移已应用时）：

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-m12.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check.ps1
    cd merchant-web
    npm run build

集成测试前先重启商户和订单服务以刷新Hyperf扫描缓存；并发测试只读缓存，避免多个测试进程同时重建代理文件。隔离测试脚本会核验两个数据库连接均指向专用测试库。

不要直接删除新增历史表来回退；旧代码含黑名单恢复等不符合新规则的行为，回退前须评估安全边界和兼容性。

## 6. 变更清单与Git交接

本轮新增：

- admin-web/src/components/merchant/MerchantStatusActions.vue
- backend/services/merchant-service/app/Service/MerchantStatusService.php
- backend/services/merchant-service/config/autoload/crontab.php
- backend/services/merchant-service/config/autoload/processes.php
- backend/services/merchant-service/test/m12-status.php
- backend/services/order-service/test/m12-orders.php
- backend/shared/src/Merchant/MerchantAccessPolicy.php
- backend/shared/src/Merchant/MerchantAccessGuard.php
- backend/shared/tests/cases/MerchantAccessPolicyTest.php
- backend/shared/tests/integration/M12Bootstrap.php
- database/merchant/27-merchant-status.sql
- scripts/test-m12.ps1
- docs/plans/m12/02-s1-delivery.md

本轮修改：

- admin-web/src/api/merchant.ts、locales/en-US.ts、locales/zh-CN.ts
- admin-web/src/views/merchant/list/index.vue、suspended/index.vue、blacklisted/index.vue
- backend/services/merchant-service/app/Controller/MerchantController.php、VerifyController.php
- backend/services/merchant-service/app/Service/MerchantService.php、Merchant/MerchantAuthService.php
- backend/services/merchant-service/config/routes.php
- backend/services/order-service/app/Controller/OrderController.php、TripController.php、Merchant/OrderController.php
- backend/shared/src/Context/MerchantContext.php
- backend/shared/src/Middleware/MerchantAuthMiddleware.php、OperationLogMiddleware.php
- database/merchant/01-merchant.sql、database/seed/02-menu.sql、deploy/docker-compose.yml
- merchant-web/src/api/types.ts、layouts/BasicLayout.vue、locales/en-US.ts、locales/zh-CN.ts
- README.md、docs/plans/README.md、docs/plans/HANDOFF.md
- docs/plans/15-M12-merchant-management.md、m12/00-design.md、m12/01-tasks-and-tests.md、m12/CHANGELOG.md

原有文件未动，哈希复核一致，不应混入本阶段变更：

- backend/services/goods-service/app/Controller/Merchant/ReviewController.php
- start.bat、stop.bat
- 设计文档/mTrip_Merchant App PRD_v1.0_中文版.md
- 设计文档/mTrip_Super_Admin_Portal_PRD_Enterprise_v1.0_中文版.md

Git暂存区为空；HEAD仍为4637803ffaf71533acd6e942f3668fd5bdf77058。无S1提交哈希，因为按用户要求没有提交。

下一阶段建议：先核对本轮未验收项，再进入酒店商户目录、档案和物业映射（S2）。餐厅继续延期。
