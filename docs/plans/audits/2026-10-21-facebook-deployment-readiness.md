# Facebook 测试域名部署前检查

日期：2026-10-21。范围：只读检查代码、公开站点与本机配置/迁移状态；未部署远端、未修改数据库或 Meta。

## 结论

现有 `https://m.myanmartrip.com/` 可作为首个真实授权联调入口，无需先配置 Mac HTTPS 隧道。核心登录链路已实现，但不能只上传本机 H5 后就认为可测试：需要部署前后端/网关、执行目标库迁移、配置目标环境并完成真实授权验收。

## 当前实测

| 检查 | 结果 | 解释 |
|---|---|---|
| 测试域名首页 | HTTPS 200；入口 `AppEntry-2f0a5a625977b8310e752b72db8db053.js` | 脚本中没有新增 settings 接口、完成页路径或 Facebook 按钮文案键，仍为旧前端 |
| `/auth/facebook/complete` | 200，内容与首页相同；无 Cache-Control/Referrer-Policy | 已有 SPA 回退，但新完成页逻辑和专用响应头尚未在该站验证生效 |
| 无参数 GET `/api/v1/auth/facebook/callback` | 404，`code=40400` | 当前回调链路未就绪；新接口上线后无有效 state 应返回安全的 400，而非 404 |
| 无签名 POST `/api/v1/app/auth/facebook/settings` | 401，`code=40103` | 请求先被客户端鉴权拒绝；不能据此判断该路由或 Facebook 配置是否已部署 |
| `https://www.myanmartrip.com/privacy` | HTTPS 200，标题 Privacy Policy，含可阅读正文 | 已不再缺可访问链接；本检查不评价法律内容完整性 |
| `https://www.myanmartrip.com/terms` | HTTPS 200，标题 Terms and Conditions，含可阅读正文 | 同上 |
| 本机 `deploy/.env` | App Secret 已配置；Facebook 其他显式变量未设置 | 目标服务器环境未读取，不能将本机配置状态当作远端状态 |
| 本机标准迁移 `--status` | 仍拒绝 `20261015090000` 低于已上线最高 `20261015100000` | 本机既有阻塞；目标服务器必须另查实际账本与结构，不能断言相同，也不能绕过保护 |

用户确认 Meta 应用域名、网站/回调及政策 URL 已填写；本轮未重新登录控制台核验其保存状态和测试角色。

## 部署必须完成

1. 备份并检查目标数据库账本/结构，按标准流程执行 `V20261021010000__add-facebook-user-identities.sql`；如目标也有历史倒序问题，先审计修复。迁移新增身份表并允许未绑定手机号使用 NULL 哈希。
2. 在目标服务器配置 `MTRIP_FACEBOOK_ENABLED`、App ID/Secret、Graph 版本、`WEB_ORIGINS=https://m.myanmartrip.com`、两份实际政策 URL 和同意版本。Meta 控制台填写政策不会自动同步到后端。迁移/配置/部署就绪后再启用。
3. 生产 H5 必须使用目标环境有效的站点和客户端签名配置。本机忽略文件 `client-app/.env.production.local` 将客户端 ID/secret 覆盖为空，当前本地 dist 不能直接作为已验证的生产包上传。保留远端鉴权，核对权限模板对 settings/start/exchange 的放行。
4. 部署 user-service 主/APP 双池并重新创建以加载环境变量；生产模式需包含新源码/配置的镜像。使用项目 wrapper。
5. 更新内层网关及实际 HTTPS 入口代理：精确 callback 路由、完成页 SPA 回退及 no-store/no-referrer；外层访问日志同样避免记录 callback 授权 query。宝塔直接提供静态文件时，仓库的 8093 server 块不会自动成为该站点 HTTPS 配置。
6. 使用有权限的 Meta 应用开发/测试账号，验证真实提供方调用、Secure Cookie、首次建号、重复登录账号一致、取消/过期、退出重登及登录态刷新。已有隔离测试替换了 Facebook transport，不等同真实提供方验收。

## 实现边界与后续

代码已包含授权码交换/身份校验、state 与一次性票据、浏览器绑定、事务建号、同身份复用、受限账号拒绝，以及前端同意和完成页。

本期未包含 Android/iOS 原生 Facebook 登录、旧手机号账号绑定/合并、Facebook 撤销授权回调及 Meta 用户数据删除回调。后两者应在面向公众发布前核对 Meta 适用要求并补齐所选择的数据删除处理方式；角色账号测试不等同公开发布验收。缅文新文案仍为英文兜底。

无手机号新账号的订单联系人等业务页面尚未完成真实账号回归；现有订单确认页仍要求联系人电话，这与登录不强制绑定手机号是两项独立规则。

本次未重跑此前 51 项隔离 HTTP 和 shared 147/1132；保留首轮验证记录，新增证据仅为本检查所列的线上 HTTP/公开脚本检查、本机配置检查与迁移状态检查。
