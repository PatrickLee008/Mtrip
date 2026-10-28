# 2026-10-28 双后台登录会话优化交付

## 范围与参数

依据本次用户确认的优化方案实施：超级管理后台与商户 Web 后台访问令牌默认 30 分钟，浏览器登录会话绝对上限 7 天，正常使用期间提前约 5 分钟静默续期。续期不延长最初登录的 7 天上限。参数沿用现有全局配置 `jwt_expire_minutes`、`jwt_refresh_days`，校验范围分别为整数 5–120 分钟、1–30 天。

原生商户 App 保留既有凭据契约；平台代为登录保留 30 分钟限制，不建立可续期会话，也不覆盖普通商户登录 Cookie。“记住我”继续只记用户名。

## 根因与修复

原先两端仅签发固定 7200 秒 JWT，没有刷新凭据或刷新接口，操作不会延长登录。HTTP 拦截器收到认证过期便清登录态并整页跳转；路由恢复用户和菜单时，网络、限流、服务错误也会触发退出。原全局 JWT 时效配置没有参与浏览器会话签发。

- 后端新增分 realm 的浏览器会话与公开 POST `/api/v1/{admin|merchant}/auth/refresh`，Redis 保存可撤销会话及刷新凭据哈希；刷新 Cookie 采用 HttpOnly、SameSite=Strict、认证路径限制，HTTPS 加 Secure。刷新要求自定义请求头，并校验来源主机及 Fetch Metadata。
- 刷新凭据以随机会话 ID、代次及 HMAC 构成，Lua 原子轮换；前一个凭据有 15 秒并发/丢响应重试窗口，窗口外旧凭据重放撤销会话。每次签发都受原始绝对到期时间限制。
- 带 SID 的后台 JWT 在共享鉴权中间件校验会话。平台账号密码、状态、站点范围和授权变化撤销旧会话；商户沿用 `auth_version`，补齐角色启停、权限和账号角色变更撤销。刷新复用领域签发器，重新读取当前资料和权限，不允许旧会话借刷新升级身份或认证版本。
- 两端 Axios 增加同页单次刷新、跨标签 Web Locks、到期请求仅重试一次；HTTP/LAN 无 Web Locks 时由后端并发宽限处理。下载/导出复用同一拦截链。网络、429、500、普通无权限错误保留登录态；路由恢复失败允许原地重试。
- 真正失效时使用同源登录 iframe 在原页面重新认证；商户继续完成原有 2FA。成功后保留页面内存与未提交表单；账号变化则重新加载，防止混用上个账号数据。页面刷新/关闭后的草稿持久化不在本次范围。
- Vite API 代理保留浏览器 Host，使开发环境来源校验与刷新 Cookie 正常工作。

旧无 SID 令牌继续原有短期生命周期，不会自动转成新会话。用户刷新页面并重新登录一次后启用新策略。

## 验证

| 检查 | 结果与边界 |
| --- | --- |
| `python3 test/browser-session/integration.py` | 57 项通过：真实 HTTP 登录/商户 TOTP、Cookie 安全与隔离、到期访问令牌、6 并发刷新、宽限与重放撤销、退出、绝对到期、平台/商户改密与禁用及授权撤销、代为登录、App 契约、配置校验及迁移幂等。仅复制表结构的空测试库、独立 Redis 与临时服务；测试资源退出时清理。 |
| `node test/browser-session/frontend.mjs` | 29 项通过：真实 TS/Axios 链路的刷新并发、写入单次执行、Blob、网络/限流/服务/权限异常、路由恢复、跨账号和退出竞态、跨标签锁、内嵌登录、代为登录边界。 |
| PHP lint / shared 单测 | 486 个 PHP 文件通过；202 个用例、1605 次断言全部通过。 |
| Web 与 App 质量检查 | admin-web、merchant-web `npm run build`（含 vue-tsc）通过；client-app `npm run typecheck` 通过。构建保留既有大 chunk 提示。 |
| 迁移命名 / diff | `bash scripts/db-migrate.sh --validate` 51 个版本命名通过；`git diff --check` 通过。 |
| 浏览器真实组件合成验收 | 平台编辑草稿后模拟恢复故障并重试、重新账号密码登录；商户编辑草稿后完成访问码及 TOTP 重新登录。两端均保留原页面内容。接口为隔离合成响应，未操作真实业务账号。 |

浏览器截图临时保存在 `/private/tmp/mtrip-admin-session-draft-preserved.png` 与 `/private/tmp/mtrip-merchant-session-draft-preserved.png`；验收用 Vite 服务、fixture 脚本和浏览器标签均已关闭/移除。7 天绝对到期通过缩短会话和模拟过期验证，未进行真实账号连续 7 天观察。

## 本机应用与迁移边界

标准迁移状态检查发现既有阻塞：待执行 `20261027100000` 低于已上线最高版本 `20261027160000`，禁止倒序补迁移。该 KBZPay 支付迁移与本次登录优化无关，未执行、未修订或伪造迁移账本。MySQL 容器原有 unhealthy 状态仍存在，业务连接与本次配置读写正常；本次服务健康检查不等同于迁移健康。

本次不新增表结构。已备份两项现有 `sys_config`（仅这两行），应用新 SQL 中的配置更新语句，分钟从原始 120/默认 120 调整到 30/默认 30，天数维持 7/默认 7。新增迁移 `V20261028090000__browser-session-policy.sql` 保留在代码中，在标准迁移阻塞解决后仍须由迁移工具登记执行；该迁移重复运行已验证幂等，显式自定义分钟值保留。

配置与旧静态页面备份：`/private/tmp/mtrip-browser-session-backup-20261028-100832/`（目录权限 0700，`session-config.sql` 权限 0600；目录另含 admin、merchant 旧页面）。该路径属于本机临时目录，不是长期备份介质。

两端构建已发布至 `deploy/web/admin`、`deploy/web/merchant`，保留旧 assets，最后原子替换 index。使用 `bash deploy/mtrip.sh restart` 明确更新 8 个业务主服务及 6 个 APP 双池，由脚本刷新网关；未重启 MySQL、Redis。

发布后验证：

- `bash deploy/mtrip.sh health` 通过：8 个主服务、6 个 APP 实例和网关 HTTP 200，商户聊天 summary/ticket/preferences 无凭据均预期 401。
- 8090/8091 实际返回的 index 与本次 dist 字节一致；两端无凭据 POST refresh 均返回预期 `40101`，证明新路由已加载。
- 只读复核当前配置 `jwt_expire_minutes=30/default=30`、`jwt_refresh_days=7/default=7`。

此次仅应用本机环境，未发布远端、未提交或推送。真实账号重新登录后的长期使用仍需正常业务观察。
