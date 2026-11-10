# Apple Web 登录实施记录

日期：2026-11-10。用户明确授权实现消费者 Web/H5 Apple 登录；沿用 Facebook/TikTok 已确认的独立账号规则。需求依据为本次用户确认及 Consumer PRD v1.0.6 §19.2 的无联系方式账号规则，不扩展为原生登录或旧账号绑定。

## 范围与协议

- 登录与注册页已有 Apple 位置接入独立同意弹窗，展示条款、隐私和账号独立提示；完成页有取消、失败、限制、过期和返回登录处理。非 HTTPS/非同源 API 显式提示。
- `POST /api/v1/app/auth/apple/settings`、`start`、`exchange` 使用现有客户端签名和统一响应；外部 `POST /api/v1/auth/apple/callback` 接收 Apple `form_post`，不要求 App 签名。
- start 保存 600 秒 state、nonce、浏览器摘要、站点、白名单 HTTPS origin、Services ID 和同意版本/时间；Cookie 为 `__Host-mtrip_apple`、Secure/HttpOnly/Path=/、SameSite=None，以支持跨站 POST。
- 服务端用 .p8 签发有效期 300 秒的 ES256 client_secret，向固定 Apple token 端点交换 code；RS256 验签仅使用固定 Apple JWKS，校验 alg/kid/iss/aud/exp/iat/sub/nonce。每次读取当前 JWKS，暂不引入跨 worker 缓存。
- Apple 账号按站点/provider/Services ID/sub 唯一，首次创建无手机号/密码账号；相同邮箱不自动合并。回调 name 只作初始昵称，非实名证明；邮箱仅采信签名令牌中 email_verified=true 的有效邮箱，支持 private relay，后续资料缺失不清空用户资料。
- 经验证的邮箱与 provider refresh token 使用既有 AES-GCM 加密存储；刷新令牌不下发客户端。新增迁移 `V20261110090000__add-apple-refresh-token.sql` 增加可空令牌列，并将加密邮箱列扩到至少 512 字符，避免有效长邮箱的密文截断。旧 SQL 快照未修改。
- 回调原子消费浏览器绑定的 state 后，303 跳回固定 `/auth/apple/complete#ticket=...`；60 秒单次票据同时绑定浏览器、来源与站点。应用启动先清 fragment，再兑换现有 Mtrip JWT，凭证不持久化或写日志。
- 双层 OpenResty 精确代理 callback、SPA 完成页、no-store/no-referrer 及回调日志脱敏已加入；回调请求体限制 32KB。

## 部署配置

前次 Apple Developer 配置记录：Team ID `64VH8HZJ2Q`、Services ID `com.mtrip.clientapp.web`、Key ID `87P2XFHN9U`、域名 `m.myanmartrip.com`、Return URL `https://m.myanmartrip.com/api/v1/auth/apple/callback`。本次未重新修改或核验门户配置。

1. 按标准迁移流程执行既有第三方身份表迁移及本次版本迁移。迁移具备幂等性；不要跳过既有迁移账本闸门或直接修改正式库。
2. 在目标服务器放置 `deploy/secrets/apple/AuthKey.p8`（目录 0700、文件 0600，且须确保容器运行用户可读）。本地下载来源为 `/Users/Admin/Downloads/AuthKey_87P2XFHN9U.p8`；不要输出私钥内容。两个用户服务均只读挂载专用目录到 `/run/secrets/apple`。Git 已忽略 secrets 目录及 .p8。
3. 参照 `deploy/.env.example` 配置 `MTRIP_APPLE_*`，来源必须是精确 HTTPS origin，不含尾斜杠；填写实际可用的条款/隐私 URL 和同意版本后再启用。签名密钥、MTRIP_AES_KEY 和 JWT 配置须有效并妥善备份，两个服务池保持一致。
4. 更新用户服务镜像/双池、网关和 H5。环境变化使用标准 `bash deploy/mtrip.sh start ...` 重新创建对应服务，单纯 restart 不会读取新环境。H5 以同源 API 和环境有效客户端配置构建。
5. 从登记域名执行真实 Apple 授权，验证浏览器跨站 POST Cookie、首次姓名/邮箱/隐藏邮箱、再次登录、取消和刷新过期，再核对 JWT 用户与站点。

默认关闭。关闭开关可停止新授权，保留已创建账号和身份；不回滚 nullable 手机哈希，也不删除令牌或缩窄邮箱列。

## 验证与边界

- 单元测试使用临时生成的 RSA/EC 密钥，验证真实 RS256/ES256 签名、错误签名/kid/算法/issuer/audience/nonce/时效及未验证邮箱丢弃；不读取真实 .p8，不请求 Apple。
- 隔离 HTTP/MySQL/Redis 测试使用测试专用 provider adapter，覆盖表迁移幂等、长邮箱、加密存储、无联系方式账号、重复及并发登录、同邮箱不合并、账号限制、事务回滚、站点/来源/浏览器绑定、票据失效与日志脱敏，并回归短信/密码登录。临时数据库和容器在 finally 清理。
- 验证命令与后续真实授权清单见 [test/apple/README.md](../../test/apple/README.md)。最终 Apple 62 项、Facebook 51 项、TikTok 54 项隔离 HTTP 通过；shared 249 用例/1721 断言，509 个 PHP 文件语法、admin-web build、client-app typecheck/H5 export、Compose config、OpenResty `-t`、diff 检查通过。长邮箱用例已先复现密文超长失败，再由迁移扩容后通过。独立代码审查未发现实质问题。
- Chrome 390×844 验证登录/注册 Apple 入口、HTTP 入口提示、取消授权返回登录、启动清理 fragment，以及刷新完成页的过期提示；临时 18093 预览已停止，浏览器尺寸已还原，未补发本机 8093。浏览器首访临时预览时 API 未代理曾返回 HTML，补齐本机网关代理后恢复；未修改业务代码来绕过 API。
- 未执行真实 Apple 授权、未部署远端、未修改常规数据库或复制真实私钥。Apple 授权撤销与完整账号注销流程、开发者团队转移迁移、原生 iOS/Android 登录另行实施；仅保留可用于后续撤销的加密 refresh token，不将现有账号状态标记当成完整注销流程。
- 缅文新增文案沿用现有英文兜底，需母语复核。
