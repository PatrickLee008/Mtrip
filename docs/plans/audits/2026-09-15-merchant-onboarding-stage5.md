# 商户入驻审批整改阶段 5 执行报告

日期：2026-09-15  
范围：最终批准后的首次激活、多方式登录、账号恢复、商户 Web 接入及 Merchant App 接口预留；本阶段未修改 `merchant-app/**`、`client-app/**`。

## 交付结果

- 新增统一认证挑战服务和 `merchant_auth_challenge`，覆盖激活身份、激活 OTP、登录 OTP、恢复 OTP 的过期、冷却、尝试次数、单次消费和审计。挑战 Token、OTP、Google ID Token、临时密码和 Authenticator 密钥均不以明文写入日志。
- 首次激活可用 `HXXXXX/CXXXXX` 访问码，或管理员分配的用户名加一次性初始密码建立 15 分钟激活上下文；随后展示脱敏注册邮箱和手机号，并通过其中一个渠道完成 6 位 OTP。
- 激活完成在单一事务内执行 `merchant_admin.status:2→1`、`merchant_info.status:1→3`、`merchant_application.account_status:1→2`，轮换账号认证版本和初始密码，并签发带实际认证方式 `amr` 的工作台 JWT。
- 再次登录支持访问码 + Authenticator、注册邮箱 + 邮件 OTP、注册手机号 + SMS OTP、已关联 Google + 独立 mTrip OTP。未知联系方式返回同结构伪 challenge，避免账号枚举；访问码自身不能签发会话。
- 账号恢复只接受激活时已验证的注册邮箱或手机号。联系方式 OTP 成功后生成新的 Authenticator 密钥；新 TOTP 验证成功会递增 `auth_version`，立即撤销旧 JWT、旧 Authenticator 和其他未完成 challenge。
- `merchant-web` 新增 `/activate` 和 `/recover` 公共路由，登录页接入四种新方式并保留低优先级旧用户名/密码 + Authenticator 入口。Google Client ID 未配置时按钮禁用；Web 明确不提供生物识别。
- App 端使用同一套后端接口，但身份解析要求 `X-Site-Id`；可信设备与生物识别继续只冻结契约，不新增路由，不接收或保存人脸/指纹数据。
- 回归时发现阶段 4 的生成列 `access_code_normalized` 会从后台验证详情泄露完整访问码，现已与 `access_code` 一并从响应移除；旧 S4 脱敏回归恢复通过。

## 接口与配置

- Web 和 App 均新增 `GET /auth/config`、激活 8 个接口、登录 challenge 2 个接口、恢复 4 个接口；成功响应保持 `{code,message,data}`，涉及密钥或 Token 的响应均设置 `Cache-Control: no-store`。
- Web 在配置传输加密密钥时对认证 POST 使用既有 `X-Encrypted: 1` 载荷；公开路由不依赖工作台 JWT。Web 不带站点头时，邮箱、手机号或 Google 身份必须全平台唯一匹配。
- App 的激活开始、登录 challenge 和恢复 challenge 使用请求头 `X-Site-Id` 作为站点边界。App 网关仍执行既有客户端鉴权，不因本阶段新增公开业务路由而放宽。
- 后端 Google 允许列表来自 `MTRIP_GOOGLE_CLIENT_IDS`，Merchant Web 按钮使用 `VITE_GOOGLE_CLIENT_ID`。两者当前均为空，因此运行态 `googleAvailable=false`。
- OTP 固定 5 分钟有效、60 秒重发冷却、最多 5 次错误；激活身份上下文有效 15 分钟。

## 验证证据

- `bash scripts/test-merchant-onboarding-authentication.sh`：24 项阶段 5 隔离断言通过，覆盖待激活门禁、两种激活凭证、OTP 冷却/失败持久化、邮箱与短信激活、Google/Authenticator 关联、三表原子状态切换、Token 单次使用、初始密码失效、四种登录、伪 challenge、防重放、恢复轮换与审计脱敏。
- `bash scripts/test-merchant-onboarding-final-approval.sh`：阶段 4 的 19 项回归通过。
- `bash scripts/test-merchant-onboarding-kyc.sh`：阶段 3 的 29 项回归通过；测试夹具同步使用阶段 4 拆分后的 `merchant:onboarding:registration-approve` 权限。
- `bash scripts/test-merchant-onboarding-registration.sh`：阶段 2 的 20 项回归通过；测试夹具同步使用基础注册批准权限。
- 旧 `m12-s4.php` 账号安全与模拟登录完整套件通过，确认用户名/密码 + Authenticator、账号级密钥、锁定、重置、会话撤销、模拟登录和访问码脱敏未退化。
- Docker PHP 8.1 对阶段 5 服务、两个认证控制器、路由、认证中间件、访问守卫、账号安全服务和脱敏修复执行语法检查，全部通过。
- `merchant-web npm run build` 通过；登录、激活和恢复页在桌面视口与 `390×844` 移动视口完成真实渲染检查。
- `bash scripts/db-migrate.sh --validate` 通过，迁移目录共 15 个版本；`V20260916000000__add-merchant-activation-login.sql` 已应用，开发库账本 15/15、待执行 0。
- 两个商户服务池已重启。`http://127.0.0.1:9505/healthz` 返回正常；网关 Web `GET /api/v1/merchant/auth/config` 返回 `code=0` 和 `googleAvailable=false`。App 网关未带有效客户端签名时返回统一 `40103`，证明既有客户端鉴权保持生效。

## 已知边界与权衡

- 当前没有真实 Google Client ID，Google 的标准 `tokeninfo` 校验、subject 唯一关联和双 OTP 流程仅完成代码与模拟服务级验证，未完成真实 Google 提供商联调。
- 当前开发环境未确认可用 SMTP/SMS 凭证。测试通过可控 provider 替身验证邮件和 SMS 两条流程；未宣称真实邮件或短信已送达。
- 为保证同账号的 OTP 冷却和 challenge 顺序一致，当前在账号行锁事务中调用 SMTP/SMS 外部服务。这样避免并发重复发码，但慢供应商会延长该账号行锁时间；若生产监控显示明显等待，再单独设计可恢复的投递 outbox，不能在本阶段扩展。
- 初始注册只验证一个联系方式。阶段 5 只把本次激活 OTP 的渠道标记为已验证，另一渠道不会自动获得登录和恢复资格。
- 旧账号没有可证明的历史邮箱/手机号验证时间，不做推断迁移；继续使用旧用户名/密码 + Authenticator 兼容入口。
- App 生物识别仍是后续独立阶段：服务端只应保存设备公钥与签名凭据，不接收生物特征；本阶段未修改 Merchant App。
- 阶段 6 的物业资料、房型审核、发布门禁和用户端搜索未实施。
