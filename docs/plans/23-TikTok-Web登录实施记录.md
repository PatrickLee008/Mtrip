# TikTok Web 登录实施记录

日期：2026-10-30。消费者 `client-app`；本次按用户指定的 [Figma 505:1293](https://www.figma.com/design/k6yJOiDvU0fqkmrHUGBfyT/M-Trip?node-id=505-1293&m=dev) 实现 TikTok 登录，沿用[Facebook 已确认的 Web 首期规则](./21-Facebook-Web登录实施方案.md)。知识库消费者 PRD v1.0.6 未检索到 TikTok 专项条款，本次需求与既有 Facebook 方案为实现依据，不扩大到原生 SDK、旧账号绑定或资产合并。

## 实现范围

- 登录、注册页新增第二行 TikTok 黑色图标按钮，保持原有登录页版式；仅实现指定的 TikTok 能力，不扩展 WeChat。
- 同意弹窗展示条款、隐私、首次创建无手机号/密码账号及旧账号独立提示；记录同意版本和时间。中英文齐全，缅文沿用 Facebook 的英文兜底方式，待母语复核。
- 授权仅申请 `user.info.basic`，使用 TikTok Login Kit Web 授权码流程；Client Secret、Access Token 与 Refresh Token 不下发或持久化到前端。
- 后端交换 token，再读取 user info，校验 `open_id` 一致、权限及有效期。以站点 + `tiktok` + Client Key + `open_id` 查找身份，不按名称或邮箱合并。
- 复用 `user_social_identity` 和 nullable 手机哈希，不新增迁移。账号创建/身份插入/推荐码初始化在同一事务，唯一索引处理并发首次登录；冻结、注销、软删在回调和兑换时检查。
- state 600 秒、ticket 60 秒；独立 `__Host-mtrip_tt` Secure/HttpOnly/SameSite=Lax Cookie，Redis 原子校验/消费，浏览器/站点/来源/Client Key 隔离。
- 完成页启动时清理 fragment；Mtrip JWT 不进入 URL。网关精确回调走用户 APP 池，内外代理日志省略回调 query，完成页 no-store/no-referrer。
- Facebook 账号方法保留原入口，内部共用必要的账号事务/会话逻辑；前端会话接收器命名为 `acceptSocialAuth`。

## 接口

| 接口 | 行为 |
| --- | --- |
| `POST /api/v1/app/auth/tiktok/settings` | 校验启用、凭据、HTTPS 来源白名单及政策配置，返回公开政策和同意版本 |
| `POST /api/v1/app/auth/tiktok/start` | 校验站点与同意版本，创建 state/Cookie，返回授权 URL |
| `GET /api/v1/auth/tiktok/callback` | 外部回调，无需 App 签名头；校验 state/浏览器并验证 TikTok 身份 |
| `POST /api/v1/app/auth/tiktok/exchange` | 消费短票据，返回既有登录结果及 `isNewUser`、`returnTo` |
| `/auth/tiktok/complete` | 完成登录或显示取消、过期、受限、失败提示，支持返回登录 |

## 配置与启用

`deploy/.env.example` 与用户主/APP 双池已增加以下配置，默认关闭：

```dotenv
MTRIP_TIKTOK_ENABLED=false
MTRIP_TIKTOK_CLIENT_KEY=
MTRIP_TIKTOK_CLIENT_SECRET=
MTRIP_TIKTOK_WEB_ORIGINS=
MTRIP_TIKTOK_TERMS_URL=
MTRIP_TIKTOK_PRIVACY_URL=
MTRIP_TIKTOK_CONSENT_VERSION=2026-10-30
```

真实联调步骤：

1. 在 TikTok for Developers 创建/选择应用，添加 Login Kit Web，申请 `user.info.basic`，取得 Client Key/Client Secret；使用应用允许的测试账号或完成所需审核。
2. 登记精确回调 `https://<实际H5域名>/api/v1/auth/tiktok/callback`。H5 与 API 必须在同一 HTTPS origin，使用浏览器信任的证书；来源配置不带路径或尾斜杠，多来源逗号分隔。
3. 在部署环境填写真实凭据、可访问的 HTTPS 条款/隐私 URL、来源和同意版本；检查既有 Facebook 身份表迁移已按标准流程应用。准备完成后再将 ENABLED 设为 true。
4. 用 `bash deploy/mtrip.sh start user-service user-service-app --dev` 重建环境变量；生产部署使用对应环境参数。网关与 H5 通过现有发布流程更新，环境变量变更不能仅用 restart。
5. 检查 settings → 同意 → TikTok 授权 → callback → exchange → 登录状态，覆盖首次/重复/取消/受限账号。确认返回同一账号、资料提示和实际订单联系方式行为。

参考协议入口：[Login Kit Web](https://developers.tiktok.com/doc/login-kit-web)、[用户 token 管理](https://developers.tiktok.com/doc/oauth-user-access-token-management)、[User Info](https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info)。本轮官方文档站连接被远端关闭，未能在线复核页面；适配器按 v2 Web 协议实现，真实应用响应仍需联调验收。

关闭时将 ENABLED 设为 false 并重新注入双池配置，保留已创建账号与身份关联，不回滚手机字段约束。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| `python3 test/tiktok/integration.py` | 54 项通过：真实隔离 HTTP/MySQL/Redis，TikTok transport 替身；含浏览器/来源/站点/Client Key/provider 隔离、并发建号与兑换、失效、取消、账号限制、事务回滚、密码/SMS 兼容及日志脱敏 |
| `python3 test/facebook/integration.py` | 既有 51 项通过，确认共用账号逻辑保持兼容 |
| shared 标准套件 | 221 用例 / 1647 断言通过，新增 TikTok adapter/config 19 用例 |
| 后端语法 | 493 个 PHP 文件，0 错误；只读挂载至无网络 PHP 8.1 临时容器执行 |
| 前端 | client typecheck、H5 export、admin build 通过 |
| 部署静态校验 | Compose config、OpenResty `nginx -t`、`git diff --check` 通过；未 reload/restart 常规服务 |
| 浏览器 | 临时导出 H5：390px 登录页入口/HTTP 提示、320px 注册入口、取消提示/返回登录、刷新完成页过期；fragment 已清理 |

所有测试库、临时用户服务容器及已跟踪 Redis 测试 key 已由 finally 清理。常规数据库、真实用户、部署环境凭据与线上站点未改；无新增依赖，未提交/推送；本轮随后按用户反馈补发本机 8093，尚未启用 TikTok。

尚待真实验证：TikTok 凭据/平台配置、HTTPS Cookie、条款同意后的真实授权/成功态、Android/iOS 原生。接口替身测试不能作为真实第三方登录已完成的依据。

## 本机 8093 补发（2026-10-30）

用户反馈没有访问入口后，已将清缓存构建的消费者 H5 发布到 `deploy/web/client/`，访问 `http://localhost:8093/`。同源 API 配置 `/` 保持；先复制资源、最后原子切换 index，保留旧资源。HTML 与入口 JS 实际 HTTP SHA256 和新构建一致，入口为 `AppEntry-31340f9c6e0fdd198d19a58884db1d31.js`。

旧版备份：`/tmp/mtrip-client-8093-before-tiktok-20261030-095637.tar.gz`。标准 auto-deploy 因 macOS 无 `flock` 实际跳过（其日志误显示已有部署运行）；改用 Python fcntl 获取同一路径排他锁后完成静态发布，未修改部署脚本。后端、网关进程与真实配置未重启或修改；HTTP 访问只能验看入口，真实授权仍需已登记的 HTTPS origin 和 TikTok 凭据。
