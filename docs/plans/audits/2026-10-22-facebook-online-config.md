# Facebook 线上“暂未开放”排查

日期：2026-10-22。范围：公开 HTTP、Chrome 真实入口和当前代码检查；未连接服务器终端、未修改远端配置或数据、未发起 Facebook 授权。

## 已确认原因

Chrome 点击 Facebook 后，请求日志为：

```text
/api/v1/app/auth/facebook/settings 50001 Facebook login is not configured
```

该请求已通过客户端签名鉴权，进入 `FacebookLoginService::assertOrigin()`。此错误只在第一组配置检查失败时抛出：`facebook.enabled` 为假，或 `facebook.app_id` 为空/非数字，或 `facebook.app_secret` 为空。未读取目标容器，尚不能区分具体哪一项不符合要求或是否存在双池配置不一致。

此时尚未检查政策/来源白名单、未连接 Facebook、未访问身份表。不能把当前错误归因于 Meta 回调不匹配或数据库迁移；这些后续步骤也不因此视为已验证。

## 部署证据

- 首页 HTTPS 200；入口 `AppEntry-4ea18fb4717a477affd1cbef74f97980.js` 包含新增 settings 接口与完成页逻辑，表明前端已更新。
- 无参数 callback 返回 HTTP 400 和安全过期提示，已从此前的 404 恢复为新回调行为。
- 无签名 HTTP settings 探针仍返回 40103，这是预期鉴权拒绝；判断本次原因使用的是浏览器实际带签名请求的 50001。
- 多次真实点击均记录相同配置错误；[复现截图](./assets/2026-10-22-facebook/online-not-configured.png)。

## 修复步骤

在服务器实际使用的 `deploy/.env` 中确认启用开关、数字 App ID `2501430997012589`、真实 App Secret，以及来源 `https://m.myanmartrip.com`、实际条款/隐私地址和同意版本。App Secret 在本机或 Meta 存在，不代表已经注入服务器容器。

确认目标库已完成本次迁移后启用。通过项目 wrapper 对 `user-service` 和 `user-service-app` 执行 start/up，使变化的环境配置触发容器重建；仅 restart 不重新注入环境。生产栈示例（从 deploy 目录执行）：

```bash
bash mtrip.sh start user-service user-service-app --prod
```

重新点击后应出现条款/隐私同意弹窗，settings 应返回 code=0。若仍为同一配置错误，应只读检查两个运行容器的实际环境和有效配置；Secret 仅输出是否存在，不输出内容。若变为政策或来源错误，再检查对应环境变量；无需关闭客户端鉴权。

本轮仅记录诊断与步骤，没有实施远端修复或验证真实 Facebook 登录成功。


## 后续：用户全栈 restart 后的服务器只读核验

已通过用户打开并登录的宝塔终端 `/www/wwwroot/Mtrip/deploy` 只读检查，更新前文尚无服务器连接时的结论。未输出实际密钥。

- 服务器 `.env` 的 `MTRIP_DEPLOY_MODE=dev`，运行双池均挂载 app/config 源码；后续应保持现有模式，不直接改用 prod。
- `.env` 仅有 Facebook App Secret，其余 Facebook 显式配置未填写；两个运行用户容器里 Secret 均已存在、App ID 为 `2501430997012589`，但 ENABLED 都是 `false`，来源与政策 URL 都为空。当前确切主因是功能未启用，后续还需补齐来源/政策。
- 目标库迁移 `20261021010000` 已 applied；第三方身份表存在，mobile_hash 为 nullable/default NULL。本次无需执行迁移。
- 线上首页实际带签名请求 `/api/v1/app/site/config` 以 site=1 返回 40401。服务器 sys_site：1 全球、2 欧洲、3 法国、4 巴黎、5 东南亚均 status=2；6 缅甸和7 仰光为 status=1，均未软删。服务器 `client-app/.env.production` 默认站点仍是1，可用站点列表正常显示缅甸/仰光。
- 计划以服务器忽略的 `.env.production.local` 将测试站默认站点覆盖为6，避免改动站点数据或启用已停用站点；需清缓存构建并发布 H5。旧浏览器已持久化的站点1不会被构建默认值覆盖，需要通过“更多→选择站点”选择缅甸。
- 已准备在 deploy/backups 下备份 `.env`、前端本机覆盖文件与当前静态产物，然后补齐已确认的 Facebook 配置、保留现有 Secret/模式、wrapper start 双用户池并重新构建发布 H5。
- 自动审批在执行远端修复前拒绝，理由是当前用户请求明确授权排查，未明确授权线上配置/容器和发布变更；已向用户申请上述具体变更授权。远端未修改；未进入 Facebook 同意或真实授权。
- [服务器只读诊断截图](./assets/2026-10-22-facebook/server-config-sites.png)。

## 最新：用户添加 ENABLED=true 后复验

2026-10-22 通过同一宝塔终端只读复查，用户已执行 wrapper start。服务器 `/www/wwwroot/Mtrip/deploy/.env` 与 `mtrip-user-service-1`、`mtrip-user-service-app-1` 均为 `MTRIP_FACEBOOK_ENABLED=true`；运行 App ID 均为 `2501430997012589`、Secret 均存在。开关已经生效，不再沿用此前 false 的结论。

两个运行容器及服务器配置文件的 `MTRIP_FACEBOOK_TERMS_URL`、`MTRIP_FACEBOOK_PRIVACY_URL`、`MTRIP_FACEBOOK_WEB_ORIGINS` 仍为空。Chrome 新页面点击 Facebook 的真实带签名请求（此次现有选择 site=7）返回：

```text
/api/v1/app/auth/facebook/settings 50001 Facebook login policies are not configured
```

当前先被政策 URL 检查阻断，补政策后空来源白名单也会拒绝。前端将 settings 失败统一显示为“Facebook 登录暂未开放”，因此提示未变不代表开关未加载。Meta 控制台填写政策不会自动写入 Mtrip 后端环境。

在服务器 `deploy/.env` 补齐（保留已存在的真实 Secret 和 true 开关）：

```dotenv
MTRIP_FACEBOOK_WEB_ORIGINS=https://m.myanmartrip.com
MTRIP_FACEBOOK_TERMS_URL=https://www.myanmartrip.com/terms
MTRIP_FACEBOOK_PRIVACY_URL=https://www.myanmartrip.com/privacy
```

随后在服务器 deploy 目录运行 `bash mtrip.sh start user-service user-service-app --dev`，保持已确认的 dev 模式并重新注入环境；仅 restart 不加载新环境。复验标准是 settings code=0 并显示实际政策链接的同意弹窗，之后真实 Meta 授权仍需单独验收。

本轮只读诊断并更新本地文档，未执行远端修改、重启或法律同意操作。[当前双池配置证据（Secret 仅存在性）](./assets/2026-10-22-facebook/server-enabled-policies-missing.png)。
