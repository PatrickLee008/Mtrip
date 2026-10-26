# Facebook Web 登录实施方案

2026-10-22 最新服务器只读实证：用户新增开关后双池 true、App ID/Secret 已加载；浏览器 settings 变为政策配置错误，条款/隐私 URL 和来源白名单仍空。目标 Facebook 迁移已完成；本轮未改远端，真实授权待验。此前远端修复被自动审批要求明确授权，尚未由代理执行。[排查记录](./audits/2026-10-22-facebook-online-config.md)。

2026-10-22 线上更新：用户部署后新前端和 callback 已生效；真实 Chrome settings 返回 50001 `Facebook login is not configured`，定位在后端启用/App ID/Secret 配置检查。服务器有效环境尚待核对修复，真实授权未执行。见[排查记录](./audits/2026-10-22-facebook-online-config.md)。

日期：2026-10-21。用户已授权按分阶段方案开发。2026-10-22 按用户要求纳入本地提交；未推送或部署远端。

## 已确认规则

- 消费者 client-app Web 优先；后续联调采用已有 `https://m.myanmartrip.com/`，Mac HTTPS 不作为该测试域名验收前置条件。
- 首次授权直接创建 Mtrip 账号，无需手机号、密码；再次使用同一身份返回原账号。
- 身份按站点、provider、Meta App ID、provider user ID 唯一；不按姓名或邮箱合并。
- 旧手机号账号绑定、资产迁移、Android/iOS 原生登录不在首期。
- 邮箱可缺失；Facebook 名称仅作初始昵称；后续不覆盖用户编辑资料。
- 冻结、注销和软删除账号不可重新建号绕过；不虚构手机号或密码。

## 实施与验收

| 阶段 | 工作 | 状态 / 验收 |
|---|---|---|
| 1 | 规则、接口及错误约定 | 已确定，见本文 |
| 2 | HTTPS / Meta 配置 | 已有测试域名；用户确认 Meta 已配置，实际条款/隐私 HTTPS 200；目标后端环境待配置核验 |
| 3 | nullable 手机哈希、第三方身份表、原子建号 | 已实现，克隆库迁移与并发验证通过；常规库未迁移 |
| 4 | start / callback / exchange，浏览器绑定及一次性凭据 | 已实现，隔离 HTTP/Redis 验证通过 |
| 5 | Web 入口、完成页、同意提示、登录态及账号展示 | 已实现，typecheck/H5 构建通过；取消/刷新/返回登录/HTTP 入口提示已浏览器验证 |
| 6 | 隔离 HTTP / 数据库 / Web 测试、质量基线、真实 Facebook | 自动化通过；真实 Facebook 和 HTTPS Cookie 待验，不视为本地真实授权完成 |
| 7 | 测试域名部署、代理及真实浏览器验收 | 待验；不能由本地测试替代 |

## 协议

- `POST /api/v1/app/auth/facebook/settings`：返回公开政策链接和同意版本；未启用或缺少必需配置即拒绝。
- `POST /api/v1/app/auth/facebook/start`：同意后创建 600 秒授权会话，返回 `authorizationUrl`。
- `GET /api/v1/auth/facebook/callback`：独立精确路由，不要求 App 签名头；用服务端配置的 HTTPS 来源拼固定回调，验证 Facebook 身份。
- `POST /api/v1/app/auth/facebook/exchange`：浏览器、站点、来源匹配后原子消费 60 秒票据，返回既有 `token/expiresIn/user` 与 `isNewUser`。
- state 与票据用 Redis 跨实例共享、原子消费；随机 Cookie 为 Secure/HttpOnly/SameSite=Lax。
- 完成页 `/auth/facebook/complete` 通过 fragment 收到短票据，启动时立即清理 URL；JWT 和 Facebook token 不进入 URL。
- 只允许配置中的 HTTPS origin；首期返回目标限定首页或“我的”，不接受任意外链。
- App Secret 仅在后端；不记录授权码、Access Token、票据。新建账号不保存 Facebook 邮箱，避免混作已验证联系方式。
- 授权入口统一展示条款、隐私及旧账号独立提示；同意版本及时间随身份关联留存。

## 环境、上线与回退

部署前复查已确认实际政策页面可用；用户确认已在 Meta 配置域名、网站及回调。远端仍旧前端、callback 404，目标库与后端环境尚待检查。本机 H5 使用空签名覆盖配置，需按服务器有效配置重建。详见[2026-10-21 检查记录](./audits/2026-10-21-facebook-deployment-readiness.md)，该记录更新下方首轮开发时的条件状态。

已知 Meta 应用：M Trip / `2501430997012589`。先前读取时未发布，redirect URI 为空。真实测试需有效角色、App Secret、Meta 接受的 HTTPS 入口与精确 redirect URI。

配置必须显式启用；未配置完整时拒绝授权，不伪装登录成功。开发 HTTPS 同源转发前端和 API；不修改现有测试域名 DNS。公开发布另需补齐隐私、数据删除及 Meta 控制台适用要求；联系方式验证与 PRD 上线要求另作衔接。

迁移须先审计空手机号/哈希是否一致，再允许 mobile_hash=NULL；保持真实手机号唯一。旧目录 SQL 仅为空库快照，本次只追加版本迁移。发布先迁移，再更新用户双池/网关和 H5。

回退先关闭 Facebook 功能和入口，可恢复旧前端；保留账号及第三方身份。已有无手机号账号后，不直接恢复 NOT NULL 索引模型。

## 验证记录

### 8093 本地前端补发（2026-10-21）

用户反馈 Facebook 仍显示“该业务暂未开放”，定位为 `deploy/web/client/` 保留旧构建。已将 `client-app/dist/` 的 81 个文件发布至该目录，先资源后 index，保留旧资源以兼容已打开页面。旧包备份：`/var/folders/yc/xvk2pb891fn2ck9d6sdkdz9r0000gp/T/mtrip-client-8093-before-facebook-pzuppsf3/client`。

8093 实访 HTML SHA256 为 `9cc11d6a9daf2ba2d5ef4c1b3e6b702b88701368db3506c7d291d88e1fb3b7cc`，入口 `AppEntry-d3d6838aed13c42453071b3451a559cb.js` 与 dist 一致；Chrome 实测登录页点击 Facebook 显示“请从已配置的 HTTPS 网站使用 Facebook 登录。”，[截图](./audits/assets/2026-10-21-facebook/8093-https-required.png)。未改常规服务、数据库或 Meta；本次前端补发不代表真实授权已通过。

### 首轮开发与隔离验证

- 隔离 HTTP/MySQL/Redis 51 项通过：迁移拒绝歧义数据/幂等、来源/站点/浏览器绑定、Cookie 属性、state/ticket 时限及重放、并发兑换/建号、无手机号、多身份、冻结/注销/软删除、事务回滚和原密码/SMS 票据登录与重置。
- shared 147 用例/1132 断言通过，含 19 项新增 Facebook adapter/config 用例；436 个 PHP 文件语法、admin-web 构建、client-app 类型检查/H5 导出、OpenResty `-t`、Compose config、迁移命名与 diff 检查通过。
- Chrome 390×844：取消页显示正确，URL fragment 已清理，返回登录正常，HTTP 入口阻止 Facebook 登录，刷新完成页显示过期。未模拟接受真实法律条款、未执行真实 Facebook 授权。
- 浏览器截图：[登录入口](./audits/assets/2026-10-21-facebook/login-mobile.png)、[取消授权](./audits/assets/2026-10-21-facebook/cancelled-mobile.png)。
- 常规库只读审计：空 mobile_hash 0 条，真实手机号缺少 hash 0 条。本轮未修改常规数据库、用户、Meta 配置、远端站点或常规服务；仅构建产物与临时预览，未发布 8093。
- 既有阻塞：标准 `scripts/db-migrate.sh --status` 拒绝待执行 `20261015090000` 低于最高 `20261015100000`；实际 `notify_record.params` 也缺失。未伪造账本或绕过倒序保护。本次迁移已在隔离库验证，但常规库执行需先审计处理历史迁移。
- 用户确认目前没有政策链接和固定 HTTPS 入口；不生成未经确认的法律文本、不使用占位政策启用真实注册。功能默认关闭；App Secret 仅配置到两个用户服务池。
- 复现与真实联调步骤见 [test/facebook/README.md](../../test/facebook/README.md)。

首期实现选择：仅请求 `public_profile`，不申请或保存 email；成功回首页，预留白名单 `more`，不恢复任意外部 URL。旧手机号账号不自动绑定，独立账号提示在同意前展示。缅文新文案暂用英文兜底，需母语复核。真实登录后的订单/预订联系信息、同意弹窗及成功态浏览器验收仍待有效 HTTPS/政策条件。
