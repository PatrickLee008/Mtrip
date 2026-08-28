# M12 S7：本地回归、安全修复与验收记录

日期：2026-08-28。基线：`a79d2b52140a8a046fe02cc33566a30ed0ee9dc9`（S6）。

状态：本地自动化、安全修复及主要跨端链路已完成；完整页面操作与在线原型对照尚未全部收口，S7保留进行中，不标记为完整PRD验收通过。开发交付时未暂存、提交或推送，没有生产部署。

本次Git授权（2026-08-28）：用户要求将本报告清单的19个S7文件与原ReviewController.php改动联合本地提交，共20文件，不推送；启动/停止脚本与两份未跟踪PRD仍排除。ReviewController仅将jsonDecode可见性改为与父类一致的protected，语法检查通过。本次沿用并复核已有回归成功日志，不重跑全套测试；提交记录见CHANGELOG，实际哈希见Git日志及回执。后续提交仍需单独授权。

## 1. 本轮确认的范围

- 沿用模块12 PRD、D1—D8及G2/G3/G4；仅酒店业务，餐厅和外部短信/邮件/Push服务商继续延期。
- 按用户最新确认：不要求真实手机扫码；以软件2FA绑定、登录、重放拒绝、重置及账号隔离验证为本轮证据，真机由用户后续自行测试。
- 不要求Figma源文件；使用用户提供的在线原型 `https://stir-long-36886628.figma.site/`。本轮读取该页面多次超时，未获得可核对的页面内容，不能认定视觉一致。
- 当前没有生产服务器，生产验收从本轮范围移除，不作为本地工作的阻塞条件。
- 不做无关业务重构，不修改真实账号的2FA、真实商户状态或开发库数据。

## 2. 本次修复

### S7-B01：商户服务的权限注解未真正执行（已修复并回归）

复现：低权限合成账号没有 `merchant:verify:approve`，却能调用 `/api/v1/admin/merchant/verify/approval-credentials`，返回 `code=0` 而不是 `40301`。

原因及修复：

1. 商户服务缺少权限切面注册。按照system-service工程范本新增 `config/autoload/aspects.php`，注册已有 `Mtrip\Shared\Aspect\PermissionAspect`，不改变权限键或角色政策。
2. 仅注册配置并重启，旧镜像中已有的控制器代理没有重建，复测仍失败。S7商户容器增加独立临时runtime挂载，从当前源码/配置生成代理后，HTTP拒绝用例通过。
3. 旧S6测试把“没有列表权限”与“有权限但跨站”混在一起。新增3项缺权限拒绝检查；站点隔离用例明确授予对应读取权限后继续验证返回空数据，未移除原断言、未放宽应用鉴权。

修复证据：低权限生成批准凭证返回40301，超管生成/批准正常；完整网关160项、集成473项通过。失败日志为 `s7-permission-before-fix.log`。

部署注意：这不是只改配置后盲目重启即可生效的修复。其他环境应用时必须重新构建/生成商户服务代理，并用低权限HTTP用例复核；本轮没有重建或重启原开发商户服务。不要通过撤销权限配置来回退安全修复。

范围提醒：静态检索发现其他业务服务也缺少同名切面配置，可能存在同类风险；未对其他模块逐接口确认，也未擅自统一修改共享配置。应另做跨服务权限专项，不能据此报告整个平台安全验收完成。

### S7-B02：证件操作按钮误用状态文案（已修复并页面复核）

待核验文件的驳回按钮显示“已驳回”，易误解为文件已经被驳回。仅将操作按钮切换到已有“驳回文件 / Reject Document”词条，保留实际状态文案。浏览器复核待核验行显示“驳回文件”；管理端构建通过。

### 验收环境自身问题（已处理）

- 独立内部网络不直接提供主机入口：仅网关增加主机侧网络并绑定 `127.0.0.1:8181`；数据库和Redis不发布端口，业务服务仍处于内部网络。
- 首次启动时三个服务曾退出，恢复后健康检查通过；没有足够证据认定退出根因。启动脚本现在检查八服务健康，失败即停止，不把容器创建等同于可用。
- 容器恢复后网关曾缓存旧上游地址导致502：所有服务健康后重载S7网关。
- 迁移脚本的Docker标签模板在Windows PowerShell中存在引号兼容问题，改为解析 `docker inspect` JSON；实际复跑环境为PowerShell 7.6.4。

## 3. 隔离与数据保护

独立Compose项目 `mtrip-s7`，显式组合base配置与S7配置，不加载开发override或开发 `.env`。

| 资源 | 本轮处理 |
|---|---|
| 数据库/Redis | 独立容器及项目卷，不复制开发数据；SQL初始化使用真实Compose顺序 |
| 上传 | 独立 `mtrip-s7_s7-uploads` 卷，业务服务写入、网关只读 |
| 后端代码 | 当前源码/config/shared只读挂载；商户runtime为临时文件系统 |
| 外部服务 | 业务服务仅加入内部网络，未连接真实支付/消息服务商 |
| 前端 | 管理端3517、商户端3518、消费者Web3519；仅本机监听 |
| 原开发环境 | 8081/5173/5174配置不变；Vite默认代理仍是8081 |
| 凭证 | `deploy/s7.env.example` 为公开合成测试值，仅限本地S7，严禁生产复用 |

HTTP脚本每次生成新 `s7-*` 合成数据，并输出不含密码/密钥/令牌的FIXTURE和HANDOFF标识；数据保留在S7，失败的中间夹具也不进行宽泛删除。规模测试在独立集成库事务内生成1,000商户/5,000历史，结束后回滚。已有集成脚本仍仅清理其捕获的夹具ID。

停止脚本只停止S7容器并保留卷；本轮未执行 `down -v`、删除已有数据库、修改主机时间或发送外部消息。需要彻底清理时，先核对Compose项目标签和具体卷名，再单独确认。

## 4. 实际验证结果

| 检查 | 结果与证据 |
|---|---|
| 空库初始化 | 独立空卷使用实际Compose完整初始化成功；32号迁移位于08-compliance之后 |
| 历史升级 | 排除27—32构造合成旧结构，依次补迁移并重复第二轮；旧状态/证件/通知/警告/违规/历史/角色授权保留 |
| 备份恢复 | 隔离副本124张表的EXTENDED校验值一致，拒绝空/NULL校验结果 |
| S1—S6集成 | 473项通过：原470项＋3项列表注解权限拒绝检查；含并发、故障回滚、订单/付款/看板/集团门店边界 |
| 实际网关 | 160项通过：真实加密登录、客户端签名、跨站/无权限、2FA、支持登录、证件、通知、发布、合规和模块11交付 |
| 共享测试 | 58用例、858断言通过 |
| PHP语法 | 316个文件无错误；后续S6夹具权限补充亦单独语法检查通过 |
| 管理端 | 类型检查及Vite构建通过 |
| 商户端 | 类型检查及Vite构建通过 |
| 消费者端 | 类型检查通过，Expo Web有数据页面已验证；不等同于iOS/Android真机 |

双前端已有大chunk警告仍存在，不属于本轮新错误，也没有为消除警告做无关拆包。

### 网关用例的重要覆盖

- 两个独立账号分别绑定TOTP；密码不能直接换取业务JWT；challenge不能访问业务接口；已用验证码不能重放。
- 仅超管定向重置；旧JWT失效、其他账号不受影响；新绑定使用新密钥；管理员列表不返回秘密。
- 一次性支持兑换、重复兑换拒绝、看板可读、安全/财务/写接口拒绝、结束后JWT失效。
- PDF multipart经网关上传；下载字节与SHA-256一致；公开KYC路径被拒绝；权限/跨站拒绝；替换后旧审核版本冲突、旧文件仍可下载。
- 站内通知幂等、不同账号独立已读、受控深链；未配置外部渠道明确拒绝；实际等待调度投递且仅一次。
- 酒店排名草稿不影响消费者；置顶发布后消费者默认顺序一致，显式价格排序有效；目的地发布后进入首页。
- 规则发布、违规、警告、暂停、复核恢复、撤销及解决；暂停后消费者不可见，解除黑名单不直接恢复；未来规则按真实时钟生效。
- 255条活动导出跨200条分页边界完整且无重复，跨站及无导出权限拒绝。
- 模块11酒店真实KYC模板的5项材料门禁；未核验不能批准，逐份审核后受控交付；普通详情不重复暴露凭证；访问码首次登录进入2FA，完成后看板正常。未声称外部凭证消息已经真实投递，也未覆盖整个模块11注册流程。

### 页面证据（真实登录，不注入浏览器认证状态）

- 超管酒店目录及档案：企业/KYC/酒店物业关联/佣金/安全账号状态；没有伪造空银行或联系人数据。
- 低权限 `*-reader` 真实登录后，目录仅保留“详情”，无编辑/暂停/黑名单/支持登录等写操作按钮；接口层另有越权拒绝检查，不把按钮隐藏当唯一防护。
- 证件列表、v0/v1/v2历史及审核/替换事件可查看；驳回按钮文案修复已复核。
- 商户首次绑定页可呈现二维码和手动密钥；由软件产生验证码完成绑定，进入经营看板，无 `/merchant/stats/dashboard` 500。
- 商户通知中心展示11条真实合成消息，与账号独立未读状态一致。
- 超管选择目标账号及技术支持原因，实际弹出商户窗口，显示管理员和目标账号、只读提示及受限菜单；管理端结束会话后，窗口刷新显示“会话已结束或不可用”。
- 消费者Web首页目的地、指定城市3家酒店顺序及酒店详情/房型可查看。
- 合规列表显示真实已解决状态、版本和历史入口；重新打开弹窗空备注被“必填”阻止。完整六条链路的每一个页面动作尚未全部执行，接口通过不替代这些UI记录。

### 性能基线（非生产SLO）

实际controller/SQL，单worker、单次执行环境，无负载并发模型：

| 数据与操作 | 本轮结果 |
|---|---|
| 1,000商户，关键词筛选，第25页，每页20，10次 | 中位1.33ms，最大9.12ms |
| 5,000历史，第100页，每页20，10次 | 中位2.31ms，最大7.20ms |
| 5,000历史完整游标导出 | 47.17ms，未漏项/重复 |
| 实际网关目录，11商户，10次 | 中位1.33ms，最大2.27ms |

执行计划已记录在 `s7-scale.log`。当前同站点小规模样本的计数查询可能全表扫描，包含通配关键词和相关子查询；不能外推为多站点大数据性能。未新增猜测性索引。大市场排名负载、长时间运行及真实数据分布仍未测。

## 5. PRD追溯与剩余验收

| 追溯ID | 已有证据 | 仍需补充 |
|---|---|---|
| R12-DIR / PROFILE | S2回归、规模分页、真实目录/档案 | 全部筛选组合的UI操作抽查 |
| R12-STATUS | S1/订单回归＋网关暂停/黑名单/恢复 | 全套状态弹窗、期限及已确认订单UI |
| R12-DOC | S3回归、网关字节/摘要/版本/越权、历史页面 | 实际PDF页内容的浏览器渲染、页面上传/下载完整操作；网关最大文件边界（现10MB为集成测试） |
| R12-ACTIVITY / NOTIFY | 真实投递、实际调度、255/5000导出、收件箱 | 页面模板发送/深链/导出逐项操作 |
| R12-2FA | 软件绑定/登录/重置/隔离/重放、二维码显示 | 真机扫码按用户安排自行测试，不阻塞本轮 |
| R12-IMPERSONATE | 真实弹出窗口/只读提示/撤销、HTTP安全拒绝 | 浏览器自然30分钟到期不另等待；到期已有隔离测试 |
| R12-RANK / DEST | 发布/草稿隔离、消费者Web首页/列表/详情 | 有数据拖拽、预览及发布完整UI、大市场负载 |
| R12-COMPLIANCE | S6回归、网关处置全链路、列表及必填 | 每个规则/处置弹窗的完整页面提交与中英视觉 |
| R12-SECURITY | 真实角色/站点HTTP、修复权限切面、凭证审计检查 | 其他微服务同类风险单独核查，不纳入已通过声明 |

在线原型读取超时，视觉对照未通过；无需再次提供Figma源文件，后续可重试原型或使用用户确认截图。真实消费者设备未测；餐厅和外部通知延期。生产验收不属于本轮范围。这些限制不能被“构建通过”或“接口返回成功”覆盖。

## 6. 重复执行入口（PowerShell 7，仓库根目录）

前提：已有本地Docker镜像和依赖。本轮使用已有镜像，不自动下载或重建镜像。

```powershell
./scripts/s7-environment.ps1 -Action Init
./scripts/s7-environment.ps1 -Action Start
./scripts/s7-environment.ps1 -Action Status
./scripts/test-m12.ps1 -ProjectName mtrip-s7
./scripts/test-m12-s7-migrations.ps1
docker cp backend/services/merchant-service/test/m12-s7-http.php mtrip-s7-merchant-service-1:/tmp/m12-s7-http.php
docker exec mtrip-s7-merchant-service-1 php /tmp/m12-s7-http.php
docker cp backend/services/merchant-service/test/m12-s7-scale.php mtrip-s7-merchant-service-1:/tmp/m12-s7-scale.php
docker exec -e DB_BUSINESS_DATABASE=mtrip_m12_s1_test -e DB_SYSTEM_DATABASE=mtrip_m12_s1_test mtrip-s7-merchant-service-1 php /tmp/m12-s7-scale.php
```

规模脚本依赖前面集成入口复制的 `/tmp/M12Bootstrap.php`。脚本不应并行运行在同一个集成库。HTTP测试含实际调度等待，最多80秒，不修改主机时间。每次HTTP运行新增一批合成夹具，不是无数据副作用的健康检查。

前端分别在独立终端启动；只设置该终端的环境变量，不写开发 `.env`：

```powershell
$env:MTRIP_DEV_GATEWAY='http://127.0.0.1:8181'
$env:VITE_LOGIN_AES_KEY='0123456789abcdef0123456789abcdef'
$env:VITE_MERCHANT_PORTAL_URL='http://127.0.0.1:3518'
# admin-web目录
npm run dev -- --host 127.0.0.1 --port 3517 --strictPort
# 另一终端的merchant-web目录，设置相同网关和AES变量
npm run dev -- --host 127.0.0.1 --port 3518 --strictPort
```

消费者Web使用 `EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8181`、`EXPO_PUBLIC_DEFAULT_SITE_ID=991`、HTTP输出的 `client`、公开测试secret `s7-client-only-not-production`，在client-app运行 `npx --no-install expo start --web --port 3519`。环境变量名为 `EXPO_PUBLIC_CLIENT_ID` / `EXPO_PUBLIC_CLIENT_SECRET`。不要把这些测试变量带入正式构建。

合成账号用户名见FIXTURE输出，统一测试密码 `S7-only-test123!`；`*-browser` 留给手工绑定，`*-one/two`由测试绑定。不在文档保存其TOTP密钥或业务令牌。

停止：前端终端Ctrl+C；执行 `./scripts/s7-environment.ps1 -Action Stop` 仅停止S7并保留数据。本轮未停止原开发服务。

## 7. 证据位置与交接

本机任务目录：`C:/Users/Administrator/Documents/Codex/2026-08-27/d-mtrip-mtrip-x20/work/`。

- `s7-integration-final.log`：473项。
- `s7-http-final.log`：160项；最后成功FIXTURE为 `s7-c0d20e7637`，商户11；模块11交付商户12、申请12、业务30。
- `s7-permission-before-fix.log`：批准凭证越权失败证据。
- `s7-quality-final.log` / `s7-merchant-build.log`：语法/单测/构建。
- `s7-migrations.log`：两轮迁移及124表恢复。
- `s7-scale.log`：实际SQL执行计划/规模数据/耗时/回滚。
- `s7-environment.log`：隔离服务启动/健康复核；最终权限代理还经后续HTTP结果验证。

恢复演练库保留在S7 MySQL：`mtrip_s7_upgrade_20260828164119`、`mtrip_s7_restore_20260828164119`；备份位于该容器 `/tmp/mtrip_s7_upgrade_20260828164119.sql`，容器重建可能移除临时备份，数据库卷仍保留。它是合成演练，不是开发库备份。

开发交付时，原有ReviewController、start.bat、stop.bat及两份未跟踪PRD的SHA-256与本阶段初始记录一致，均未纳入S7清单。本次依用户明确要求额外纳入ReviewController已有改动，其余四文件仍排除。下一步为剩余页面/原型验收与用户确认，不自动进行后续Git提交或生产发布。

## 8. S7文件清单

- `backend/services/merchant-service/config/autoload/aspects.php`：权限配置。
- `backend/services/merchant-service/test/m12-s6.php`：权限/隔离用例区分。
- `backend/services/merchant-service/test/m12-s7-http.php`：真实网关合成夹具与验收。
- `backend/services/merchant-service/test/m12-s7-scale.php`：规模/执行计划/回滚。
- `admin-web/src/views/merchant/documents/index.vue`：驳回操作文案。
- `admin-web/vite.config.ts`、`merchant-web/vite.config.ts`：可选S7开发代理，默认不变。
- `deploy/docker-compose.s7.yml`、`deploy/s7.env.example`：独立环境。
- `scripts/s7-environment.ps1`、`scripts/test-m12-s7-migrations.ps1`、`scripts/test-m12.ps1`：启动/迁移/回归入口。
- 本报告及README、HANDOFF、模块计划、阶段日志/矩阵索引更新。
- 本次联合提交额外纳入 `backend/services/goods-service/app/Controller/Merchant/ReviewController.php`：用户原有jsonDecode可见性修复。

阶段日志由助手维护；本次Git操作依据用户对S7与ReviewController的单次联合提交授权，不推送，后续提交仍由用户决定。
