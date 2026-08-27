# M12 商户管理：阶段 0 技术设计

> 版本：S0-1，2026-08-27。状态：技术核验完成，设计待用户确认；业务代码未开始。
> 核验基线：dev / 0d4a942b9827bbc30366da09f6fb5b2023af6a65。
> 本文是设计，不是已实现声明。下列新增文件、字段、接口均为拟实施内容。
> 仓库：D:/软件项目/Mtrip海外旅游平台/源码/Mtrip。

## 当前执行决策（2026-08-27，覆盖下文S0历史建议）

- 用户已批准技术设计及G2/G3/G4。G2：2FA重置仅授权超级管理员；G3：暂停/拉黑后禁止原待支付订单首次付款，已确认订单不受影响，不改变超时取消/释放策略；G4：模块11受控一次性交付例外保留，普通详情的持续访问码回显在账号安全/档案批次整改。
- D3/G1以最新要求为准：本轮只实施酒店业务，餐厅仅保留既有类型/未来扩展边界，不开发餐厅页面、展示、排名或交易。第7节的餐厅方案及额外工期属于延期备选，不是本轮任务。
- 用户最新要求：助手不执行Git暂存、提交或推送；只维护变更/测试文档，版本操作由用户负责。S0历史提交保留，不回退或改写。
- S1/S2执行边界：现有订单/商品尚未建立门店归属链路。S2仅补齐注册业务→物业显式映射，不因此开放门店级商品、订单或收益数据；后续对应经营链路接入后再授权。历史订单继续由商户级账号履约，不猜测关联。
- S2实际实现：国家两位字母大写、城市空白规范化/小写，由操作者明确确认，不自动地名翻译合并；电话完整号码HMAC精确检索。开发库未自动创建物业映射。报告见[03-s2-delivery.md](./03-s2-delivery.md)。
- S1实际交付与测试限制见[02-s1-delivery.md](./02-s1-delivery.md)。

## 1. 需求基线与确认边界

需求来源：设计文档/mTrip_Super_Admin_Portal_PRD_Enterprise_v1.0_中文版.md，第 267～477 行的模块 12；结合本任务八项明确决策。PRD 文件当前未跟踪，本阶段不擅自纳入用户文件；核验时 SHA-256 为 346AA9B3B48ACCAC6314349C9175ACB2F160E77B7DACD0A6C14F07CA55E988D9。下表是本轮的可追溯确认摘要。

| 决策 | 已确认规则 |
|---|---|
| D1 停用 | 可登录处理历史订单及售后；禁止新订单；已确认订单不受影响；临时停用到期自动恢复，期间拉黑则不能自动恢复。 |
| D2 解除黑名单 | 解除后进入已停用，不直接恢复交易；按 D5 由超级管理员单独激活。 |
| D3 业务类型 | 酒店优先；餐厅实现延期，仅预留类型边界；已有门票业务保留，不改旧枚举。 |
| D4 排名 | 酒店实体、餐厅门店；站点＋城市＋类型隔离；审核通过且可展示、所属商户未停用/拉黑；置顶＞精选＞普通，组内拖拽；双标记归置顶、不重复；无固定数量上限；发布后生效。 |
| D5 权限 | 普通停用/恢复由运营主管执行；拉黑、解除及解除后的激活仅超级管理员；2FA 重置限专门安全权限管理员；人工高风险动作原因必填、二次确认、审计；单人执行，无双人审批。 |
| D6 认证 | 保留用户名/访问码等现有登录方式；后台只展示访问码状态；所有商户登录账号独立强制 Google Authenticator；重置仅使目标账号旧绑定及会话失效，下次登录重绑。 |
| D7 通知 | 站内信本轮实现；邮件、短信、Push 仅预留接口，服务商确定后接入；未配置不可发送、不伪报成功。 |
| D8 证件 | 单独授予替换和审核权限；上传替换原因必填，新版本待审核；保留要求重新提交动作；旧文件、旧审核结果和历史不可覆盖或删除；无双人审批。 |

原型沿用六个入口：全部商户、商户证件、已停用、黑名单、商户活动、市场排名。阶段 0 不重新改动或访问设计文件；页面实现阶段以已给定在线原型核对交互。PRD 和上述决策优先于原型演示数据。

## 2. 当前核验结果

### 2.1 代码证据

下列路径相对于仓库根目录，行号为本次核验基线，后续改动后可能变化。

| 编号 | 证据位置 | 结论及影响 |
|---|---|---|
| E01 | backend/services/merchant-service/app/Controller/MerchantController.php:28、109、132、148 | 目录搜索较少；停用/恢复直接改状态；恢复缺原因；2FA 重置仍作用于 merchant_info。 |
| E02 | backend/services/merchant-service/app/Service/MerchantService.php:91 | 旧 toggle 另走一套逻辑，停用会批量下架商品；必须收口，不能保留能绕过新规则的旧入口。 |
| E03 | backend/services/merchant-service/app/Controller/VerifyController.php:741、768 | 拉黑另存 merchant_blacklist；解除当前直接设 status=3，违反 D2。 |
| E04 | backend/services/order-service/app/Controller/OrderController.php:56、105 | 单笔订单在事务外读商品，事务内锁库存；没有商户状态守卫。 |
| E05 | backend/services/order-service/app/Controller/TripController.php:48、65、273 | 多酒店 Trip 是独立下单入口，同样没有商户状态守卫；只修单笔订单不足。 |
| E06 | backend/services/merchant-service/app/Service/Merchant/MerchantAuthService.php | 访问码是主账号登录别名，不是替代密码；别名查询仅 status=3，主体校验仅接受 1/3，停用无法登录。 |
| E07 | backend/shared/src/Middleware/MerchantAuthMiddleware.php；Context/MerchantContext.php | 仅验证 JWT，未逐次校验账号/主体当前状态；集团账号存在跨商户数据范围，不能只检查 token 中 merchant_id。 |
| E08 | database/merchant/15-merchant-verify-rework.sql:37 | access_status 实际是“0待设置2FA、1已设置”，不是独立停用开关。不能把它直接用于第一批登录禁用判断。 |
| E09 | database/merchant/01-merchant.sql；09-merchant-application.sql；03-group-store.sql | merchant_type=1酒店、2景区、3综合；注册业务有 hotel/restaurant 字符串；门店没有正式业态/城市/注册业务关联。不能把旧值2改成餐厅。 |
| E10 | OnboardingController.php:38、465；MerchantService.php:19 | 餐厅入驻/KYC 已支持；餐厅映射为综合；批准通常只生成一个默认主门店，不是逐个注册经营实体的可靠映射。 |
| E11 | database/goods/01-goods.sql；client-app/src/screens/mypick/myPickSections.ts:5、68 | goods_type 只有酒店/门票；餐厅卡片来自常量；尚无真实餐厅展示、详情或交易链路。 |
| E12 | RankingController.php:24、53、108；database/merchant/14-merchant-ranking.sql | 排名使用独立快照行，置顶/精选共用字段；发布只递增版本，草稿不能隔离；缺真实消费者端读取。 |
| E13 | admin-web/src/views/merchant/ranking/index.vue:134 | 目的地拖拽先重写 rank 再比较，导致保存分支不会触发。 |
| E14 | NotificationController.php:31；PlatformRuleController.php | 外部通知未真实投递；合规操作缺完整通知/状态/活动闭环，部分按 ID 写操作缺站点校验。 |
| E15 | admin-web/src/views/merchant/list/index.vue:66、108、559 | 列表未解构/绑定服务端 pagination；访问码明文展示和复制需整改。 |
| E16 | backend/shared/src/Middleware/OperationLogMiddleware.php | 操作日志写入另一数据库且失败被忽略，不能把它当作业务状态事务内的强审计保证。 |
| E17 | docs/plans/HANDOFF.md 的模块11记录；VerifyController.php:315、496 | 既有模块11批准和访问码重发流程会展示凭证，与 D6 的“后台只展示状态”边界需要在设计确认时明确。 |
| E18 | backend/services/merchant-service/app/Controller/VerifyController.php:531 | 入驻审核和商户证件共用审核接口；D8 必须区分已批准商户替换与入驻草稿，不能破坏模块11提交核验边界。 |

### 2.2 运行环境与本地数据

只读核验，不创建账号、不调用登录/订单写接口、不执行迁移、不启停服务。

- 11 个 Docker 容器运行中，MySQL/Redis 为 healthy；服务实际 PHP 8.1.27。
- 本机质量脚本使用 PHP 8.5.9；该语法基线不能替代后续 Docker PHP 8.1 的运行兼容性测试。
- 本地有效商户 10 条：待审核 2、已拒绝 1、已启用 7；当前没有停用样本。
- 商户登录账号 8 条，均为 account_type=2；集团/门店账号需后续测试夹具覆盖。
- 注册业务中已有 3 条已验证餐厅记录，但不能据此认定存在 3 家正式可展示餐厅门店。
- goods_info 与 order_main 当前有效记录均为 0。
- 排名 6 条，均为酒店演示行，business_id=0、site_id=0。
- merchant_admin 尚无账号级 2FA/version 字段；商户级 two_fa_status/access_status 当前均为 0。
- 未发现餐厅专用数据表/服务路由；merchant_store 与注册业务、商品尚无明确外键关联。

测试环境必须另建可清理的专用夹具。不得把演示排名转换为真实商户，不得按名称猜测经营实体关联。

### 2.3 工作区保护

开始时已有以下非本阶段修改，全部保留且不提交：

- backend/services/goods-service/app/Controller/Merchant/ReviewController.php（1 行增加/1 行删除）；
- start.bat、stop.bat；
- 两份未跟踪中文 PRD。

阶段 0 只提交本文、任务/用例、阶段日志及进度索引。基于当前 dev 分支，不切换、重置或强推其他分支。

## 3. 领域边界与技术组织

### 3.1 分离三类状态

| 状态 | 事实来源 | 不允许混用 |
|---|---|---|
| 商户经营状态 | merchant_info.status＋有效 merchant_blacklist | 不等于 KYC 状态，不等于商品上架，不等于2FA绑定状态 |
| 经营实体展示资格 | 正式门店/酒店映射、注册业务 KYC、展示开关及商户经营状态 | 排名不能改变资格或批准商户 |
| 登录账号安全状态 | merchant_admin账号状态、账号级2FA及认证版本 | 不等同整个商户停用，不得影响其他账号 |

- 商户主体：merchant_info.id；保留既有merchant_type数值，不能把2景区改成餐厅。
- 登录账号：merchant_admin.id；与 merchant_info.id 明确区分。
- 经营实体：拟复用 merchant_store.id 作为酒店物业/餐厅门店的统一运营身份；具体方案见第7节，需设计确认。
- 入驻业务：merchant_application_business.id 是 KYC 来源，不能直接当作商品或交易门店ID。

### 3.2 拟新增/调整的职责

| 位置 | 职责 |
|---|---|
| merchant-service / Service/MerchantStatusService.php | 唯一的商户经营状态变更入口、权限/版本校验、事务、历史、活动、站内通知 |
| shared / Merchant/MerchantAccessPolicy.php | 不依赖数据库的状态判断规则，便于单元测试 |
| shared / Merchant/MerchantAccessGuard.php | 当前主体/资源所属商户的站点、黑名单、状态校验；供登录、中间件、下单复用 |
| merchant-service / Command/ExpireMerchantSuspensionsCommand.php＋后台周期执行入口 | 到期扫描和幂等恢复；不暴露公共HTTP自动恢复接口 |
| merchant-service / Service/MerchantAccountSecurityService.php | 账号级2FA注册、验证和管理员重置 |
| merchant-service / Service/MerchantImpersonationService.php | 短时会话、一次性交换、身份归因、撤销和限制 |
| merchant-service / Service/MarketplaceService.php | 正式实体资格、草稿/发布及消费者端/预览共用查询 |
| merchant-service / Service/MerchantDocumentService.php | 已批准商户证件替换、版本审核和不可变事件 |
| merchant-service / Service/MerchantNotificationService.php | 站内投递；外部渠道仅契约、配置状态和明确拒绝 |

名称为拟定，不为单次操作创建额外通用框架。遵循现有 Db::table、统一 Result 和 Permission 约定；不新建微服务。

## 4. 第一批：统一状态机与访问限制

### 4.1 存储兼容和状态转换

保留现有数值：0待审核、1历史审核通过、2拒绝、3已启用、4已停用、5注销、6重新提交。模块12人工经营动作仅处理3/4；有效黑名单优先显示为 blacklisted。0/1/2/5/6 不得通过 activate 绕过模块11审核。

| 输入状态 | 动作 | 结果 | 权限与约束 |
|---|---|---|---|
| active(3) | suspend | suspended(4) | 普通停用权限；note必填；可选未来截止时间 |
| 普通 suspended(4) | activate | active(3) | 普通恢复权限；note必填；无有效黑名单 |
| active/普通 suspended | blacklist | status=4＋有效黑名单 | 超级管理员；原因/备注；取消当前自动恢复 |
| blacklisted | unblacklist | suspended(4)＋需超管激活标记 | 超级管理员；note必填；不设置自动恢复时间 |
| 解除黑名单后的 suspended | activate | active(3) | 超级管理员单独执行；清除标记 |
| 有效且到期的普通临时停用 | expire | active(3) | 系统任务；只匹配原停用实例/版本，无黑名单和超管激活标记 |

现有 suspend、activate、toggle-status、blacklist、unblacklist 全部改为包装调用同一服务；旧入口也执行权限和备注校验。客户端缺少备注不能自动填“管理员操作”。

### 4.2 并发与审计

1. 校验目标商户站点和管理员权限。
2. 在 mtrip_business 同一事务内锁定 merchant_info 当前行。
3. 校验 expectedVersion、当前有效黑名单和转换规则。
4. 更新状态、版本、截止时间；追加状态历史、商户活动及站内通知。
5. 提交事务后返回最新状态与版本；任何关键历史/站内记录写入失败整体回滚。
6. sys_operation_log 继续作为补充日志，不声称跨数据库原子提交；状态历史是强审计事实源。
7. requestId 用于幂等；同一次请求重试返回原结果，同ID不同payload拒绝。

状态历史中的 site_id 必须来自目标商户，而不是超管的0。人工动作需备注；系统到期恢复使用明确系统身份和来源历史ID，不冒充管理员。

### 4.3 订单入口与锁顺序

- 同时覆盖 /app/order/create 和 /app/order/trip/create；双路由前缀注册同一处理器的入口同步覆盖。
- 事务内先按 merchant_id 升序锁定所有相关商户，再校验状态/黑名单/站点，随后按稳定顺序锁商品、SKU和库存，最后落单。
- 商品信息在事务外的预读仅用于参数准备，事务内必须复核归属和可售状态，避免状态检查与写入间的竞态。
- Trip 任一酒店被停用/拉黑时整笔失败，不能保留部分Trip、子单、库存或券占用。
- 并发停用与下单以商户行锁建立确定顺序：停用先提交则拒绝新单；订单先提交则不追溯取消。
- 已确认订单的查询、履约、核销和售后不能因为状态改为4被统一拒绝。
- G3已确认：暂停/拉黑后禁止原待支付订单首次付款，单笔与Trip都校验；不改变超时取消和库存释放策略。
- 对 merchant_id=0 的历史供应商商品不得假定为可交易酒店；先核实归属。门票不重分类、不改价格/库存算法，相关共用代码必须做回归。

### 4.4 登录和存量会话

- 用户名和访问码登录统一解析到真实账号，再校验账号状态；访问码仍需密码，不能当作独立认证令牌。
- 商户/门店账号所属商户为3或4且不在黑名单时可登录；门店停业规则仍保留。
- 黑名单校验必须作用于已有JWT的后续请求，不能只在新登录检查。
- 集团账号本身不因一家商户拉黑而整体失效，但涉及该商户的资源访问和汇总必须被过滤/拒绝；不能因token内merchant_id=0而绕过。
- 停用是经营限制，不等同账号禁用；不把全部角色切成不可登录。
- access_status=0当前表示未设置2FA。第一批不能把该值直接用于禁用商户；第4批按账号级安全状态处理。

## 5. 数据库设计与迁移

本阶段不执行SQL。各增量脚本以数据库目录当时最新序号分配（本次最高为26），包含 SET NAMES、USE、幂等守卫，并登记 compose initdb；存量库单独增量执行，禁止 down -v。

| 表/范围 | 拟增加的核心字段/约束 | 阶段 |
|---|---|---|
| merchant_info | status_version、suspended_until(UTC)、active_suspension_id、reactivation_requires_super | 1 |
| merchant_status_history 新表 | site_id、merchant_id、from_state、to_state、action、reason_code、note、deadline、actor_type/id/name、request_id、source_history_id、created_at；商户时间索引；幂等键唯一 | 1 |
| merchant_blacklist | removed_note、关联状态历史；有效记录唯一约束需先检测重复，不能擅自删除旧记录 | 1 |
| merchant_notify | 关联状态事件的去重键；复用现有站内消息结构 | 1/3 |
| merchant_admin | two_fa_status、method、secret_enc、enrolled_at、last_reset_at、auth_version、last_accepted_totp_step | 4 |
| merchant_verify_document_revision | doc_id/version唯一、文件摘要、来源、上传人、旧审核快照；历史不覆盖 | 3 |
| merchant_document_event 新表 | doc_id、version、action、审核结果、reason、actor、created_at；append-only | 3 |
| merchant_activity_log | actor_type、target_account_id、entity_type/id、request_id、impersonation_session_id、脱敏metadata | 1/3/4 |
| merchant_store | 业务类型、来源注册业务ID、标准城市/国家、消费者展示状态；保留既有营业状态 | 2/5 |
| goods_info | 明确关联酒店实体的store_id；不修改goods_type=1/2含义 | 5 |
| ranking_listing / destination | 草稿/发布各自rank、pinned、featured；真实实体绑定；范围版本；发布历史 | 5 |
| merchant_impersonation_session | token_hash、target_admin_id、expires_at、revoked_at、ended_reason、source_ip；不保存明文令牌 | 4 |
| 通知delivery结构 | channel、状态、错误、回执、次数、计划/实际时间；外部渠道当前未配置 | 3 |
| platform_rule 等 | 生效时间、版本、类别、例外范围、追加式执行事件；不新增双人审批系统 | 6 |

迁移要求：

- 迁移前导出结构并评估备份；本阶段未执行备份或数据修改。
- 对存量商户只建立“迁移时状态快照”，不伪造历史管理员或过去的停用原因。
- 旧商户级2FA密钥不得复制给多个账号。账号级绑定从未注册/需重绑开始；旧字段先保留兼容读，安全切换后再安排清理。
- 无法唯一关联的酒店/餐厅业务进入待映射清单，不按名称、顺序或商户类型推断。
- 回退优先回退应用版本、保留新增历史表；已产生状态/安全历史时不得自动DROP或回退到绕过安全规则的旧逻辑。

## 6. 接口与权限设计

保留现有 /api/v1/admin/merchant 前缀及query/body ID风格，避免为了REST风格大改路由。响应沿用 {code,message,data}，分页沿用 {list,total,page,pageSize}，最大200。

### 6.1 第一批接口

| 接口 | 主要契约 |
|---|---|
| POST /api/v1/admin/merchant/status/change | merchantId、action、reasonCode、note、可选suspendedUntil、expectedVersion、requestId；返回当前状态/version/historyId |
| GET /api/v1/admin/merchant/status/history | merchantId、page、pageSize；站点隔离，按发生时间/ID倒序 |
| GET /api/v1/admin/merchant/detail | 增加lifecycle状态、有效黑名单、截止时间、version、需超管激活标记；安全字段白名单 |
| 旧 suspend/activate/toggle-status/blacklist/unblacklist | 兼容入口，仅做代理；新增备注/版本要求与前端同步，不能保留旁路 |
| 商户 auth/login、auth/me | 区分账号禁用/商户停用/黑名单；返回明确经营限制摘要，不暴露凭证 |
| 单笔订单和Trip创建 | 无需前端传商户状态；后端从真实商品归属强校验 |

建议错误：缺参数40001；跨站40302；无权限40301；状态/版本冲突40901；令牌失效40101。优先使用现有错误码，不擅自复用其他含义的码。suspendedUntil必须带时区且为未来时间，统一转换UTC；前端按站点时区显示，不另设未经确认的固定最大期限。

### 6.2 后续接口

- 目录：keyword/category/country/city/registeredFrom/registeredTo/sortField/sortOrder；手机号加密存储，不能直接对密文LIKE。优先设计规范化精确号码查询索引；如果必须支持号码片段检索，需要单独评估隐私和索引方案，不先全库解密扫描。
- 证件：document/replace、document/history、受控download；替换请求必须指定当前版本，审核旧版本应409拒绝。
- 活动：现有activities分页；导出按筛选条件分块/异步处理，不受单页200上限限制。
- 账号安全：merchantId＋accountId定位；登录返回challenge而不是提前签发普通业务JWT；setup-info/confirm/verify为受限认证路由。
- 模拟登录：start/end/session；单次短时交换令牌，不在URL查询参数、日志或持久化存储中泄露。
- 排名：保留list/save-order/pin/publish等入口语义；增加草稿版本校验和preview；publish必须明确site/type/city，不能默认发布全站。
- 消费者端：拟新增 /api/v1/app/marketplace/listings、listing、destinations；同步网关map及移动端双前缀/签名约定。
- 通知：send返回各渠道真实状态；未配置渠道的明确请求应拒绝，不能静默改为其他渠道发送。

### 6.3 权限映射

| 动作 | 拟权限键 | 额外约束 |
|---|---|---|
| 普通停用 | merchant:status:suspend | 运营主管授权 |
| 普通恢复 | merchant:status:activate | 无有效黑名单、非解除后待激活 |
| 拉黑 | merchant:status:blacklist | 后端显式校验isSuper |
| 解除黑名单 | merchant:status:unblacklist | 后端显式校验isSuper |
| 解除后激活 | merchant:status:reactivate | 后端显式校验isSuper |
| 2FA查看/重置 | merchant:security:view / reset2fa | 重置角色边界见G2，不能仅按站点0推断超级管理员 |
| 模拟登录 | merchant:impersonation:start / end | PRD要求授权超级管理员；退出只结束指定会话 |
| 证件替换/审核/下载 | merchant:document:replace / verify / download | 独立授权，无双人审批 |
| 排名保存/发布 | merchant:ranking:save / publish | 明确范围，PRD授权超级管理员约束 |
| 合规执行 | 沿用platform现有前缀补齐动作键 | 状态动作再次经过统一状态服务 |

Permission注解、菜单种子和v-perm同键。已有merchant:list:status不自动赋予非超管拉黑权限；角色授权迁移必须列明diff。isSuper在当前系统会绕过普通Permission检查，涉及“特定超管也必须有专门授权”的需求不能靠注解假装实现，需G2确认后设计。

## 7. 酒店/餐厅最小真实链路（重点设计确认）

建议复用现有merchant_store，而非再创建一套平行商户/门店主数据：

1. 商户仍是签约主体，注册业务仍是KYC来源；正式门店记录承载一处酒店物业或餐厅门店。
2. 给门店增加business_type和来源业务关系；酒店商品明确绑定门店。同一实体只出现一次，酒店的房型不单独排名。
3. 新批准/已有业务通过显式映射建立正式门店；已有“按商户生成默认主门店”不可直接冒充多个注册物业。
4. 门店展示状态独立维护；审核状态读取真实KYC来源；城市使用统一规范值。未映射或缺必要资料的实体不能发布排名。
5. 餐厅本轮补齐经营资料、门店展示、详情及市场排名读取，不自动增加点餐、外卖、餐桌库存、餐厅支付或结算系统。
6. 消费者端提供真实市场列表及餐厅基础详情入口；不把“收藏餐厅”静态区直接改成推荐列表，因为收藏与排名含义不同。
7. 酒店市场推荐与现有明确价格/评分排序区分；人工排名作为市场推荐优先级，不能无提示覆盖用户选择的价格排序。

该方案补齐D3/D4必要数据链路，但涉及比原先“接已有餐厅API”更多工作；需用户确认G1后排期。

## 8. 排名发布一致性

- ranking_listing仅保存真实实体ID和排序配置；名称、KYC、展示状态等从真实实体读取，不允许演示快照成为事实源。
- site＋businessType＋city确定一个范围；保存/发布必须完整校验所有行属于该范围、无重复ID、资格正确。
- 分组优先级：pinned=1优先，其次featured=1，其余普通；组内按rank，再按ID稳定排序。
- 保存草稿不改变消费者端。发布在单事务内更新该范围全部published字段和版本，历史保存操作人、时间、变更范围。
- 同一范围并发编辑使用expectedVersion；不允许后保存覆盖前保存却不提示。
- 预览与消费者端共用查询和资格判断，仅数据视图分别为draft/published。
- 已发布实体后来被停用、拉黑或撤销展示资格时，读取时立即过滤；不需等待再次发布，也不自动修改人工排序。
- 热门目的地复用草稿/发布和审计语义；目的地不是商户，不套用商户KYC；范围键采用站点＋区域。

## 9. 2FA、模拟登录和证件安全

### 9.1 账号级2FA

- merchant_admin.id是密钥和auth_version归属，覆盖本商户/门店登录账号；集团账号作为同一merchant-web认证体系也不能成为绕过入口。
- 注册challenge与普通JWT不同audience，短时有效、一次性、绑定账号和认证版本；普通业务接口不接受challenge。
- 注册确认成功才签发业务JWT；TOTP验证包含限流、失败锁定/冷却、同一时间步重放防护。
- 管理员重置清除旧密钥并递增该账号auth_version；新密钥由商户受限注册流程生成，不在后台生成后交付。
- 中间件每次请求校验账号版本和当前有效状态；数据库校验失败时不能放行。
- 日志脱敏增加otp、twoFaCode、challengeToken、accessCode、oneTimePassword等变体；管理员API白名单不得返回secret_enc。
- 停用商户仍须通过2FA才能处理历史订单，不能以停用为理由跳过认证。

### 9.2 真实模拟登录

- 仅授权超级管理员，原因必填；选择明确目标账号和商户，不能产生集团级无限数据范围。
- 建议30分钟有效期作为技术初始值，配置/验收时明确；管理端创建一次性交换凭证，商户端换取受限会话。
- JWT包含actorAdminId、targetAccountId、merchantId、sessionId、exp；后端检查会话未撤销，并实时复核操作者授权。
- 敏感操作以服务端路由/能力白名单为准；密码、2FA、访问码、角色、银行和结算操作禁止。
- 每个请求同时保留实际管理员和目标账号；页面横幅、退出和超时提示不取代后端鉴权。
- 管理员退出只能结束指定会话；当前“结束该商户所有会话”逻辑必须修正。

### 9.3 证件生命周期

- 当前文件是指向最新版本的引用，旧文件及旧审核快照不可改写。
- 替换：检查权限、站点、merchantId、docId和version；写新版本status=2；记录原因和上传人；不能自动审核通过。
- 审核：仅审核指定当前版本；并发替换后旧审核请求返回409。
- 模块11入驻上传仍按原先“草稿→提交核验”规则；模块12已批准商户替换按D8直接进入待审核，二者不可混成同一个无条件更新。
- 到期由扫描任务追加到期事件；KYC资格变化必须由明确规则计算，不把证件替换自动当成商户停用。
- 下载必须授权；现有公开/uploads路径不能直接满足敏感文件保护，需存储迁移或受控访问方案，不只隐藏前端链接。

## 10. 通知、合规与前端

- 第一批状态变化即写可被现有商户通知中心读取的站内消息；第三批完善定时、投递状态、未读、模板和接口契约。
- 外部渠道只预留适配接口，不接服务商、不调用mock并标为成功。
- 合规警告和违规事件append-only，撤销追加事件；规则版本/生效/例外与商户状态分开。
- 平台规则可以全局，但非超管不得读写其他站点记录；状态动作一律回到统一服务。
- 六个管理页面保留路由与菜单component；仅在第一批补原因、截止时间、状态提示和历史入口，不先大规模重做视觉。
- 新增文案按en-US/zh-CN维护；数字状态与可见业务文案集中映射。
- 商户详情只展示安全状态；D6对模块11凭证交付的影响见G4，不能静默破坏已批准的入驻交付流程。

## 11. 实施及验证安排

| 阶段 | 交付重点 | 估算说明 |
|---|---|---|
| 0 | 本设计、任务/用例、阶段日志、需求追溯、基线检查 | 本次完成设计交付，不包含编码 |
| 1 | 状态服务、双下单入口、登录/存量会话、定时恢复、最小站内通知 | 原估算6～8人日；需G3确认支付边界 |
| 2 | 目录、档案、酒店/餐厅经营实体关联 | 5～7人日，实体映射缺口另计 |
| 3 | 证件、活动、站内通知、外部接口预留 | 6～8人日 |
| 4 | 账号级2FA与真实模拟登录 | 8～12人日；G2/G4确认后细化 |
| 5 | 真实排名、消费者展示、目的地 | 原7～10人日，餐厅展示最小链路需补充评估 |
| 6 | 规则和合规联动，无双人审批 | 5～7人日 |
| 7 | 回归、迁移、权限、安全、全链路验收 | 5～7人日 |

此前44～62人日依赖“餐厅已有基础能力”假设，该假设本次未成立。餐厅映射、展示/详情与集成测试建议暂留额外6～10人日工程缓冲，扣除与阶段2/5重叠后重新排期；这不是已批准的追加预算，也不能直接将两者相加作为承诺。第一批可独立推进，但必须先获得本阶段设计确认。

基线：scripts/check.ps1四步全部通过（277个PHP、47测试/723断言、admin-web build、client-app typecheck）。merchant-web单独执行类型检查与Vite构建通过；统一npm入口复核结果见阶段日志。构建体积警告保留，不在阶段0顺带优化。

## 12. 设计确认时需要明确的新发现

这不是重新讨论已确认八项，而是核验后发现的具体边界；本阶段不据此实施代码。

| 编号 | 问题 | 建议设计／影响 |
|---|---|---|
| G1 餐厅补齐范围 | 已有餐厅KYC，但无正式展示链路，原“复用现成API”假设不成立 | 采用第7节最小真实门店＋展示/详情＋排名，不扩展餐饮交易系统；确认后复核阶段2/5工期。 |
| G2 2FA授权口径 | PRD第400行附近明确“仅授权超级管理员”，D5写“专门安全权限管理员”，是否允许非超管不明确 | 为严格PRD，建议限定超级管理员执行重置，安全权限作为能力标识；若要委派普通管理员，必须明确记录为PRD授权范围变更。模拟登录仍仅超管。 |
| G3 待支付订单 | 现有单笔/Trip在创建时未支付，PRD只明确已确认订单不受影响 | 建议停用/拉黑后禁止未支付订单首次确认付款，已确认订单照常履约；不自动取消、不擅改超时释放流程。需确认后才能调整pay入口。 |
| G4 访问码展示边界 | D6要求后台只显示状态，但已实现模块11有一次性批准凭证和重发/重新生成界面 | 建议模块12及通用日志只显示状态；模块11首次交付保留专门受控入口，取消其普通详情中的持续明文回显。是否保留该一次性交付例外需确认。 |

执行状态：技术设计已获确认，按本文顶部最新决策实施S1；餐厅方案延期，Git由用户操作。
