# 2026-10-16 访客消息迁移修复与本地发布

## 后续修复：停业物业提示无权访问

现场日志显示物业 15 资料、工作台等正常，chat summary/preferences/ticket 连续 403；数据库只读核验该物业属于商户 13、status=2、未删除，主账号 9 已启用。ChatAccess::properties 将 status=1 当成物业授权条件，因而错误排除了仍可管理的停业物业；侧栏自动启动聊天，ticket 失败后不断重试使提示反复出现。

修复移除聊天物业范围中的营业状态条件，保留站点/主体归属/员工物业分配/角色/软删除检查；不修改正常物业或账号数据。消费者新咨询沿用 ChatService::start 原有 status/publish_status/operating_status 检查。商家 store 对 40101/40102/40301/40302 停止重试，捕获偏好初始化拒绝，旧上下文错误不干扰新连接，网络临时失败继续重试。

验证先复现停业物业访问失败与权限错误自动重试，再通过 9 项物业回归和 10 项 store 回归；修复后重跑 17 项基础集成，并通过 21 项双池实时/私有附件回归，共 57 项相关检查。此次未重跑完整旧 74 项集合；独立测试库、容器、文件和凭据均已清理。

Merchant Web build（含 vue-tsc）与容器 PHP lint 通过。旧静态站备份 `deploy/backups/merchant-before-property-chat-fix-20261016-105719.tar.gz` 后发布 8091，保留面板文件及 blank.html；经标准 wrapper 重启 user-service/user-service-app。标准 health 全绿，8091 深链 index/入口 JS 与新产物相同，聊天 summary/商户菜单未登录探针为正常 40101。真实账号浏览器页面仍待刷新复验，未声称已完成用户登录态验收；未提交/推送。

用户要求继续处理迁移阻塞，承接已授权的访客消息实施与本地入口交付。当前本机数据库为 45 条 applied、0 条待执行，无 running/failed；商家 Web 已发布到 `http://localhost:8091/guest-messaging`，消费者 H5 已发布到 `http://localhost:8093/`。未提交或推送。

## 根因与补迁移

- `V20261013100000__add-room-bedroom-count.sql` 来自提交 `e477f69`，在合并 `e4d914e` 时进入本地分支。本机此前已执行联系方式的 `20261013130000`、`20261013130100`、`20261013130200`，因此标准迁移脚本正确阻止倒序执行。
- 现场核验：该版本没有账本行，`hotel_room_type.bedroom_count` 确实缺失；后续三条迁移不操作房型表，不依赖此字段。房型表当时为 0 行。原始 SQL 只新增 `TINYINT UNSIGNED NOT NULL DEFAULT 1` 字段。
- 先通过项目备份脚本备份完整 `mtrip_business`、`mtrip_system`，设置 `RETENTION_DAYS=0` 保留全部旧备份。备份为 `deploy/backups/mtrip-20261016-095954.sql.gz`，压缩校验、目标表和 dump 完成标记均通过。
- 将原始 SQL 与提交 `e477f69` 的字节逐一核对，保留其文件名、内容和 SHA-256。在空结构克隆中执行两次，验证字段类型、非空与默认值；随后删除克隆库。
- 持 `GET_LOCK('mtrip_schema_migrations', 10)`，再次检查原账本数量/最高版本、无失败记录、目标版本与字段缺失，插入本次 running 行后执行真实原始 SQL。字段后置校验通过才将本次 attempt 更新为 applied；执行人标记 `local-out-of-order-repair`，时间为实际补执行时间。
- 原有 40 条账本全部字段在补执行前后逐字一致，房型行数保持 0。没有重写已执行版本、删除账本行、伪造已执行状态，或放宽标准脚本的倒序保护。
- 本机核验文件保存在忽略目录 `deploy/backups/migration-repair-20261016/`：前后账本快照、实际控制 SQL、备份与迁移 SHA-256、检查结果。备份和账本快照不纳入源码提交。

补齐后标准脚本识别 41 条已执行、4 条待执行，随后依次执行：

| 版本 | 内容 |
| --- | --- |
| `20261014100000` | 酒店附加服务 |
| `20261014150000` | App 教程及后台菜单 |
| `20261014160000` | 评价详情字段 |
| `20261015100000` | 访客消息结构、菜单与内置角色授权 |

执行命令为 `bash scripts/db-migrate.sh`，其自动完整复核结果为 45/45、待执行 0。`bedroom_count` 实际类型为 `tinyint unsigned`、不可空、默认 1；菜单 1500 为「访客消息」、`mch:chat:list`、`/guest-messaging`、`guest-messaging/index`。

本次为已核实独立增量的一次人工补执行，不提供通用的倒序开关。其他环境必须重新核对当地结构和账本，不能直接复制本机 applied 记录。

## 本地发布

- 经 `deploy/mtrip.sh start user-service user-service-app` 重建双池，两个容器均挂载同一 `mtrip_chat-private` 到 `/opt/chat-private`；标准 wrapper 自动刷新正常网关。
- 经 `deploy/mtrip.sh restart merchant-service order-service order-service-app` 加载商户通知与旧订单兼容代码。因 wrapper 已知白名单遗漏现有 `merchant-service-app`，核对容器后单独重启 `mtrip-merchant-service-app-1`，未修改部署脚本。
- Merchant Web `npm run build`、消费者 `npm run build:web` 成功。旧静态产物备份至 `deploy/backups/guest-messaging-web-before-20261016.tar.gz`，随后按现有 rsync 发布方式更新 `deploy/web/merchant/`、`deploy/web/client/`，保留 `.user.ini`、`.htaccess` 及已跟踪的 `blank.html`。
- 补齐正常 `8091` 的 `/api/v1/merchant/chat/socket` 和 `8093` 的 `/api/v1/app/chat/socket` 外层精确代理，转发 HTTP/1.1 Upgrade/Connection。此前主网关支持升级，但静态站到主网关这一跳丢失升级头，隔离重现为 404。修复仅涉及这两个聊天端点。

## 验证与限制

- 迁移状态机现有测试通过，命名校验 45 个版本通过。MySQL 从 unhealthy 恢复 healthy；标准 `deploy/mtrip.sh health` 主池 8 项、APP 池 5 项、网关健康与转发探针全通过；另确认商户 APP 孪生已恢复运行。
- 本轮重跑 17 项基础集成 + 扩展后的 7 项真实 OpenResty 网关回归，共 24 项。新增两项分别覆盖商家和消费者静态端口的第二层 WebSocket 代理，先复现失败再验证通过；同时验证跨池事件、20MB PDF 加 multipart 上传及私有下载。
- 2026-10-15 的完整 72 项结果仍保留在[实施报告](2026-10-15-guest-messaging.md)。当前完整测试脚本预期总数为 74，本轮没有声称重跑全部 74 项。
- 正常端口验证：8091/8093 返回的 index 和入口 JS 与磁盘新发布产物 SHA-256 一致；8091 `/guest-messaging` 深链返回 SPA；双方聊天列表到达正确路由并拒绝未登录请求（40101）；双方 socket 均实际完成升级，再以 4003 拒绝无效票据。
- 正常浏览器当前没有有效商户登录态，打开站点进入安全登录页。本轮没有重置账号、绕过二次验证或发送真实访客消息；正常账号登录后的菜单和收发仍待复验。前一轮合成账号浏览器收发与响应式结果不等于本轮正常账号验收。
- 本轮隔离 QA 容器、数据库/DB 用户、合成记录、私有附件及临时凭据已清理。未修改正常业务账号、订单或消息。
- 原生 iOS/Android、真实软键盘/文件选择与缅文母语复核仍待验；商户 App 独立工作台仍为下一阶段。

访问时刷新 `http://localhost:8091/`，登录后从左侧「访客消息 / Guest Messages」进入；可直接访问 `/guest-messaging`。页面菜单授权为 `mch:chat:list`，员工自定义角色仍按既有授权机制配置。

## 同日消费者 H5 登录配置修复

用户反馈 8093 登录 HTTP 401。已比对构建配置、实际发布 JS 和数据库：原包嵌入 `.env.production` 的客户端 ID/secret，而本地 `mtrip_system.sys_client` 为 0 行。用相同签名与 AES 加密协议、空登录参数复现 HTTP 401 / `40103 客户端鉴权失败`。这发生在账号密码校验之前：`PayloadDecryptMiddleware` 对带 `X-Encrypted: 1` 的请求始终解析客户端并解密，强制开关关闭并不跳过已携带密文的请求。

现场确认双 user-service 的 `MTRIP_CLIENT_SIGN=false`、`MTRIP_PAYLOAD_ENCRYPT=false`。新增 Git 忽略的 `client-app/.env.production.local`，仅本机置空 `EXPO_PUBLIC_CLIENT_ID`、`EXPO_PUBLIC_CLIENT_SECRET`，沿用现有前端无客户端密钥时的开发请求路径；未修改后端鉴权代码/开关，也未向空客户端表写入记录。原 `client-app/.env.production`、`client-app/.env`、`deploy/.env` 的 SHA-256 保持不变。

`NODE_ENV=production` 下核验覆盖生效且 API origin 仍为 `/`；执行 `npm run build:web`（含 `--clear`）后，新包不含旧客户端 ID/secret。旧静态站先备份至 `deploy/backups/client-h5-before-auth-fix-20261016.tar.gz`，随后更新 `deploy/web/client/`。正常 8093 的 index 和入口 JS 与新构建产物一致，空参数登录恢复 HTTP 400 / `40001 参数 mobile 不能为空`，证明已越过客户端密钥解析并进入登录控制器校验。没有尝试真实账号密码或发送短信，真实账号成功登录仍待用户重试；不能将此探针称为成功登录验收。

本地覆盖文件不纳入 Git，也不适用于已启用客户端签名/强制加密的其他环境；其他环境应使用与当地客户端记录匹配的配置。
