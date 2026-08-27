# M12 S4 账号级 2FA 与真实模拟登录交付

日期：2026-08-28。开发基线：dev / 232fd3e635e220e360b0d0595da49aae920e7aa1（S3本地提交）。
Git补充（2026-08-28）：用户随后授权S4本地提交，不推送；本报告58文件加看板修复新增3文件，共61文件。看板14项与既有300项累计314项集成通过。标题及授权范围见CHANGELOG.md，哈希以Git日志为准；下文未提交、300项和58文件为原交付快照，不改变未验事项。
状态：S4核心编码、安全加固、隔离集成回归完成；完整浏览器操作及真实手机扫码尚待验收。未执行Git暂存、提交或推送。
范围：PRD模块12账户安全与代为登录，遵循D6、G2/G4；酒店优先，未开发餐厅经营功能。S5排名、S6合规和外部通知服务商对接不在本阶段。

## 1. 需求对应与实现

| 需求 | 本阶段实现 | 验证入口 |
|---|---|---|
| 账号独立强制Google Authenticator | 集团、商户、门店的每个merchant_admin独立绑定；密码正确只发5分钟受限challenge，OTP通过后才发业务JWT | m12-s4.php：独立密钥、分离audience、集团/门店、密码不能直接登录 |
| 注册二维码与手动密钥 | 商户端本地生成二维码，只有密码验证后的未绑定账号可读取；不调用第三方二维码服务；绑定成功后不再回显 | setup/verify服务与控制器、防缓存测试；真实扫码待验 |
| 2FA状态、方式、日期 | 商户档案按账号显示未注册/活跃/需要重置、Google Authenticator、注册及上次重置日期 | 账号元信息白名单测试；后台完整视觉待验 |
| 仅超管重置目标账号 | 专门权限入口＋当前数据库超管有效性＋站点/商户归属＋账号版本；原因与二次确认；同事务记录审计 | 普通角色、伪旧超管声明、跨站/跨商户、旧版本、审计故障回滚 |
| 旧绑定与会话失效 | 重置清除旧/待绑定密钥并递增auth_version；旧challenge、业务JWT、模拟登录均失效；其他账号不受影响 | 重置、旧JWT、其他账号、重新生成密钥 |
| 真正代为访问商户端 | 超管选择商户/门店账号和原因，60秒一次性兑换，30分钟会话；进入真实商户端，不再仅显示管理端提示条 | 单次与并发兑换、真实上下文、过期、退出 |
| 提示、限制与审计 | 商户端持续显示真实管理员与目标账号；只读支持模式，后端明确路由白名单；每次请求记录actor/target/session | 请求/拒绝/响应审计，敏感安全、财务及经营写接口拒绝 |
| 访问码状态与凭证不泄露 | 普通档案/核验详情仅状态；旧时间线访问码在详情及导出读取时脱敏；模块11专门一次性交付例外保留 | 当前/历史访问码脱敏，递归日志脱敏，接口no-store |

TOTP采用SHA-1、6位、30秒，允许相邻一个时间步并拒绝已接受时间步；算法通过RFC测试向量校验。协议依据：[RFC 6238](https://www.rfc-editor.org/info/rfc6238/) 与 [Google Key URI Format](https://github.com/google/google-authenticator/wiki/Key-Uri-Format)。密钥使用现有AES-GCM能力加密落库；不增加第三方运行依赖。

## 2. 关键行为与边界

### 登录与恢复

- 保留用户名/商户访问码＋密码入口。暂停商户仍可按S1规则登录处理历史业务，但必须完成2FA；拉黑商户不允许登录或被代为登录。
- 首次登录/重置后：输入密码→商户自己扫描二维码或录入手动密钥→输入当前验证码→取得业务会话。后台管理员不能取得绑定二维码或手动密钥。
- 5次密码/验证码失败触发该账号15分钟冷却；失败次数写入不随异常回滚，重新提交正确密码不能清掉OTP失败次数。其他账号不受影响。
- challenge只保存摘要，重新发起密码登录使旧challenge失效；绑定/验证在行锁事务中消费，并发只允许一次成功。刚使用过的同一个时间步不能用于再次登录，需等待身份验证器下一组验证码。
- 本人改密、既有集团/门店密码重置、子账号改密/停启及普通登出同步处理账号会话版本，不因新增2FA留下旧业务token。
- 不提供关闭2FA、绕过验证码或管理员代填密钥。身份验证器遗失时，由授权超管按原因和确认流程重置选定账号。
- 集团账号本身独立绑定，商户档案会明确标注关联集团账号；重置仅改变所选账号，不批量改变集团下其他账号。集团账号不允许代为登录，以免获得集团级支持范围。

### 模拟登录

- 本阶段采用保守的只读支持模式：允许既有仪表盘、订单、房型、房态、促销、评价、通知等白名单读取；安全、账号/角色、财务结算以及经营写请求一律拒绝。仅允许结束本次会话/登出这两类写动作。
- 权限仍受目标账号本身限制；每次请求检查真实管理员当前是否仍为启用且未锁定的超管，并重取目标现有角色权限，与签发时权限取交集，不因角色变化自动扩权。
- S2门店数据范围限制继续生效：没有可靠门店归属的经营数据不因模拟登录而开放。
- 一次性交换值通过新窗口URL fragment传递，进入商户页立即移除，随后POST兑换；数据库仅保存摘要，兑换后清空。不把长期JWT放入URL。
- 模拟登录token仅保存在当前标签页sessionStorage，不覆盖普通商户localStorage会话。退出后保留空的标签页标识，防止意外回落到另一普通账号；重新普通登录后才清掉该标识。
- 管理端/商户端都可结束对应sessionId；不能按merchantId结束别的管理员会话。后端每请求检查过期，不依赖定时器；每分钟任务追加过期审计并关闭到期会话。
- 起始/兑换/结束审计与会话变更同库事务。请求审计写入失败时不放行请求。保留真实actor、target_account_id、impersonation_session_id，不把操作误记成商户本人。
- 当前管理端提示条仍沿用内存状态，刷新管理端后提示条会消失；已打开商户支持页仍有退出入口，30分钟到期也由后端强制执行。未提供跨设备会话管理中心。

### 凭证与历史记录

- 账号安全列表只返回显式元信息，不返回密码摘要、加密密钥、challenge摘要或兑换摘要。
- 请求日志对认证/兑换路径屏蔽请求和响应，对其他JSON递归脱敏；不记录未经解析的原始body。当前日志保护不等于清理旧日志文件。
- 旧访问码时间线不改写、不删除；仅在展示与导出时隐藏值，新生成/重生成事件也不再把访问码写进note。模块11专门批准/重新生成的受控交付仍保留，不表示邮件/短信已实际对接。

## 3. 迁移与运行影响

新增：`database/merchant/30-merchant-account-security.sql`，compose初始化序列39l；增加账号安全字段、临时会话字段、兑换唯一索引/到期索引及活动session字段，不新增普通角色授权。

本地已重复执行通过，并重启八个业务服务使共享鉴权和扫描代理生效。没有重置真实密码、绑定真实账号或测试代入真实商户。开发库核对：9个账号，已绑定0、待重置0、活动challenge0；新式支持会话0。隔离测试账号、管理员、角色、菜单夹具均清理。

重要影响：历史商户JWT没有auth_version，更新后将被拒绝；9个现有账号下次登录需要自行注册Google Authenticator。这是强制账号级2FA的切换效果，不是账号被停用。现有merchant_info级别的2FA字段保留为历史数据，不复制为多个账号共享密钥。

部署顺序：

1. 按部署制度备份相关表结构与数据。本次仅保存了结构快照，未做业务数据备份，不能据此声明可全量恢复。
2. 存量环境依次具备27/28/29迁移后执行30；不能只更新前端。
3. 确认JWT/AES配置非空、各服务一致，生产密钥按密钥管理制度保护；服务器与手机时间同步。此阶段没有轮换现有部署密钥。
4. 同步部署后端、管理端和商户端；重启所有使用共享鉴权的服务，避免新旧认证逻辑混用。
5. 生产管理端构建配置 `VITE_MERCHANT_PORTAL_URL=https://实际商户域名`，限定HTTPS；未配置时拒绝开启模拟登录。开发模式才回退当前主机5174端口。
6. 生产HTTPS、前端history路由回退、弹窗策略及跨域/CSP需在目标环境验收；本地未模拟生产域名配置。

迁移只增加字段/索引；不要通过删除安全字段或恢复免2FA旧鉴权回退。若需回退应用，先确定维护窗口及兼容的安全版本，保留新绑定和审计数据，不能把结构快照当成数据恢复方案。

## 4. 最终实测结果

| 验证 | 结果 |
|---|---|
| 全量PHP语法 | 305文件，0错误 |
| shared纯逻辑单元测试 | 58用例，858断言，全部通过 |
| S1状态 | 51项通过 |
| S1订单/Trip/门票 | 25项通过 |
| S2目录/物业 | 62项通过 |
| S3证件/活动/通知 | 70项通过 |
| S4认证/模拟登录 | 92项通过；含并发、故障注入、控制器与中间件测试 |
| 集成检查总计 | 300项通过，仅使用mtrip_m12_s1_test |
| admin-web / merchant-web生产构建 | 均通过（vue-tsc＋Vite） |
| client-app类型检查 | 通过 |
| 八服务healthz | 9501—9508全部ok |
| 本地浏览器冒烟 | 商户登录页中文布局正常；无凭证support-session显示已结束/不可用；检查时无控制台error/warn |
| 原有文件与Git | 5个保护文件SHA-256不变；HEAD仍为232fd3e；暂存区为空 |

复测：`scripts/check.ps1`、`scripts/test-m12.ps1`，以及merchant-web目录内`npm run build`。
本次原始日志位于任务工作目录work/s4-quality.log、work/s4-integration.log、work/s4-merchant-build.log；只记录测试结果，不包含真实凭证。

测试过程曾发现并修正：S3新增绑定审计后旧测试数量统计过宽；S4集团夹具缺必填字段；新增禁用账号用例的错误码预期与实际认证失效码不一致。上述问题均复验通过，没有跳过失败用例。

## 5. 未验事项与下一步

- 本地浏览器后续恢复，可检查匿名页面；Figma在线原型仍超时。按设计到代码工作流复用现有Vue/Ant Design页面和原型对应结构，没有编造Figma节点上下文或宣称像素级一致。
- 真实手机Google Authenticator扫码/手动录入、管理端账号安全表格及二次确认、中英文完整视觉、跨窗口登录/刷新/退出全过程，尚未完成浏览器端到端验收。服务层/控制器集成通过不能替代这些验收。
- 没有读取真实登录凭证或给真实账号代绑2FA；后续应使用专用验收账号，由账号持有人完成扫码，并验证目标账号重置不影响另一账号。
- 生产域名、HTTPS、浏览器隐私/弹窗策略、多设备会话、压力和长时间调度、全新空卷初始化尚未测试；保留既有Vite大chunk警告。
- S3完整上传和模块11整流程的历史未验项仍保留；S5/S6/S7及外部服务商对接没有因此标记完成。
- 下一开发阶段为S5酒店真实排名、消费者端展示和热门目的地；继续酒店优先、餐厅延期，需按用户安排推进。

## 6. Git与文件保护

本阶段只维护代码、迁移、测试和开发记录；未add、未commit、未push。S3提交授权不延续到S4。
保留未纳入本阶段的原ReviewController修改、start.bat、stop.bat及两份中文PRD，五者内容哈希与开工基线相同。
下列清单为S4待审阅范围，不是暂存或已提交声明。

本阶段共58个文件：

```text
admin-web/src/api/merchant.ts
admin-web/src/components/merchant/AccountSecurityPanel.vue
admin-web/src/components/merchant/ImpersonateModal.vue
admin-web/src/layouts/BasicLayout.vue
admin-web/src/locales/en-US.ts
admin-web/src/locales/zh-CN.ts
admin-web/src/views/merchant/list/index.vue
admin-web/src/views/merchant/verify/index.vue
backend/services/merchant-service/app/Controller/Merchant/AccountController.php
backend/services/merchant-service/app/Controller/Merchant/AuthController.php
backend/services/merchant-service/app/Controller/MerchantActivityController.php
backend/services/merchant-service/app/Controller/MerchantController.php
backend/services/merchant-service/app/Controller/MerchantSecurityController.php
backend/services/merchant-service/app/Controller/VerifyController.php
backend/services/merchant-service/app/Service/GroupService.php
backend/services/merchant-service/app/Service/Merchant/MerchantAuthService.php
backend/services/merchant-service/app/Service/MerchantAccountSecurityService.php
backend/services/merchant-service/app/Service/MerchantImpersonationService.php
backend/services/merchant-service/app/Service/StoreService.php
backend/services/merchant-service/config/autoload/crontab.php
backend/services/merchant-service/config/routes.php
backend/services/merchant-service/test/m12-s3.php
backend/services/merchant-service/test/m12-s4.php
backend/services/merchant-service/test/m12-status.php
backend/shared/src/Merchant/MerchantAccessGuard.php
backend/shared/src/Merchant/MerchantImpersonationGuard.php
backend/shared/src/Merchant/Totp.php
backend/shared/src/Middleware/AdminAuthMiddleware.php
backend/shared/src/Middleware/MerchantAuthMiddleware.php
backend/shared/src/Middleware/RequestLogMiddleware.php
backend/shared/src/Support/MaskHelper.php
backend/shared/tests/cases/TotpTest.php
backend/shared/tests/integration/M12Bootstrap.php
database/merchant/30-merchant-account-security.sql
deploy/docker-compose.yml
docs/plans/15-M12-merchant-management.md
docs/plans/HANDOFF.md
docs/plans/m12/01-tasks-and-tests.md
docs/plans/m12/05-s4-delivery.md
docs/plans/m12/CHANGELOG.md
docs/plans/README.md
merchant-web/src/api/auth.ts
merchant-web/src/api/types.ts
merchant-web/src/components/SupportBanner.vue
merchant-web/src/layouts/BasicLayout.vue
merchant-web/src/layouts/components/AppHeader.vue
merchant-web/src/locales/en-US.ts
merchant-web/src/locales/zh-CN.ts
merchant-web/src/router/guard.ts
merchant-web/src/router/index.ts
merchant-web/src/stores/user.ts
merchant-web/src/utils/auth.ts
merchant-web/src/utils/http.ts
merchant-web/src/views/login/index.vue
merchant-web/src/views/notifications/index.vue
merchant-web/src/views/support-session/index.vue
README.md
scripts/test-m12.ps1
```
