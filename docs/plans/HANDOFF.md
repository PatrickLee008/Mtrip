# 会话交接文档(HANDOFF)

## ★ 2026-09-01：房型上传图片 403 修复

房型图片无法显示的根因是 goods-service 的 `UploadedFile::moveTo()` 将上传文件保存为 `600`，共享卷和 URL 均正确，但 OpenResty 工作进程无读取权限，因此网关及 merchant-web `/uploads/rooms/*` 都返回 403。`RoomController::uploadMedia()` 已在移动成功后设置文件为 `0644`，部署卷内三张存量房型图片已同步修复；当前三张图片经网关和 merchant-web 代理均返回 `200 image/png`。HTTP 回归新增“上传图片可通过网关公开读取”断言，真实新上传与完整房型审核链路通过，临时回归文件已清理。goods-service 已重启，PHP 语法通过。本次用户已授权随 M2 房型交付本地提交，不推送；实际哈希见 Git 日志。

## ★ 2026-09-01：merchant-web IPv4 空白页修复

merchant-web Vite 默认只监听 `[::1]:5174`，浏览器通过 `127.0.0.1:5174` 访问时前端模块无法加载，页面 DOM 为空。`merchant-web/vite.config.ts` 已增加 `server.host='0.0.0.0'` 并仅重启 5174 开发进程；当前 `127.0.0.1:5174/rooms`、`localhost:5174/rooms` 与 IPv4 `/src/main.ts` 均返回 200，监听地址为 `0.0.0.0:5174`。由于浏览器将 localhost 与 127.0.0.1 视为不同 Origin，前者无法读取后者的登录 Token；`merchant-web/src/main.ts` 已在开发环境将 localhost 规范化到 127.0.0.1，完整保留路径、查询参数和 Hash，生产环境不变。merchant-web 构建通过。本次用户已授权随 M2 房型交付本地提交，不推送；实际哈希见 Git 日志。

## ★ 2026-09-01：M2 房型管理与版本审核流程

merchant-web 房型管理已按 PRD 与在线原型补齐，新增房型采用用户最终确认的独立页面 `/rooms/create`，并增加编辑和详情独立路由。表单覆盖房型资料、入住容量、设施、图片/视频上传、价格、库存与专项政策；列表和详情可跟踪草稿、待审、通过、驳回、撤回及下架申请。goods-service 新增 `hotel_room_type_revision` 版本审核，管理员在商品审核页查看当前生效/本次提交差异后通过或驳回；待审或驳回期间不覆盖当前已批准版本，消费者读取只暴露 `publish_status=2` 房型。幂等迁移已执行，真实网关 multipart 上传→提交→通过→更新→驳回→详情核对通过，临时夹具已清理；325 PHP、shared 58用例/858断言、admin/merchant build 和 client typecheck 均通过，仅保留既有 Vite 大 chunk 提示。本次用户已授权本地提交，不推送；实际哈希见 Git 日志。

## ★ 2026-09-01：merchant-web 注册业务切换与菜单上下文整改

商户端左上角已从原型假数据改为 `/merchant/auth/menus` 返回的真实注册业务：仅取当前账号数据范围内、已关联正式商户且业务 KYC 通过的 `merchant_application_business`，集团按可见商户汇总，门店收窄到 `merchant_store.source_business_id`。默认“全部业务”只展示 `merchant_menu.module_key=''` 的全局菜单；选择具体酒店/餐厅等业务后追加同 `business_type` 的业务专属菜单，当前路由被隐藏时回 `/dashboard`。既有后端模块授权与 JWT 权限不放宽；当前只有客房、房量价格标为酒店专属，餐饮暂无专属页面，不伪造。PHP 语法、merchant-web 类型检查与 Vite build 通过；Docker Desktop Engine `_ping` 返回 500，真实接口和登录后 UI 联调仍待 Docker 恢复。

## ★ 2026-09-01：测试入驻申请商户编号与审批关联修复

`test/gen_testdata.py` 已修复入驻申请 `merchant_code` 固定为空以及阶段 5 使用循环总下标访问 `enabled` 导致 `merchant_id` 永远为 0 的问题。尚未转正式商户的测试申请使用独立 `MCH-5xxx` 编号段，避免与已有 `merchant_info` 的 `MCH-1001～MCH-1024` 冲突；阶段 5 的申请关联同 ID 正式商户并同步 `merchant_code/site_id`，时间线同步正式商户主键。`test/sql/02-商户域.sql` 已兼容当前生成文件并重新执行 `test/apply.sh`。验收：18 条申请缺失编号 0、编号唯一 18、异常编号碰撞 0、阶段 5 未关联 0、待审批注册号冲突 0；生成器 `py_compile` 与 `git diff --check` 通过。未执行 Git 暂存、提交或推送。

## ★ 2026-08-31：admin-web 全局 Tag 原型配色

`admin-web/src/styles/index.less` 已全局覆盖 Ant Design Vue Tag 的四组状态配色，并同时覆盖语义色及对应常用预设色：success/green 为 `#027A48/#ECFDF3/#6EE7B7`，warning/orange/gold 为 `#B45308/#FFFBEB/#FCD34D`，error/red 为 `#C01048/#FFF1F3/#FDA4AF`，processing/blue/geekblue 为 `#1D4ED8/#EFF6FF/#93C5FD`（文字/背景/加深边框）；内容字体统一为 11px/400，边框明确为 `1px solid`。“所有商户”表格已移除遗留的 Tag `border:none`，默认 Tag 恢复灰白底和灰色边框；商户验证四队列已将自绘 `verify-badge` 替换为共用 `StatusTag`，与入驻申请、所有商户统一组件和字体风格。保留默认圆角、尺寸、间距及 borderless 行为。`vue-tsc --noEmit` 与 Vite production build 通过（4195 modules），仅有既有大 chunk 警告；未执行 Git 暂存、提交或推送。

## ★ 2026-08-31：商户文档列表与详情抽屉原型样式对齐

`admin-web/merchant/documents` 已按用户提供的两张原型截图调整呈现层：列表页重做页头、五张图标统计卡、组合搜索筛选栏、文档/核验人单元格、状态与分页视觉；详情抽屉重做双行标题、双 Tab、状态提示、文件预览卡、元信息表与整宽下载入口。原审核、驳回、替换、要求重交、历史、预览、下载及权限键均保留，未改后端和数据库；接口无城市字段，页面继续只展示真实商户名称与内部 ID。中英文新增筛选、结果数、分页和 PDF 文案。`admin-web npm run build`（vue-tsc + Vite）通过，仅有既有大 chunk 警告；本地站点可启动，但浏览器停在登录门禁，未擅自使用账号做登录后视觉验收。未执行 Git 暂存、提交或推送。

## ★ 2026-08-30：admin-web 主题资源可视化编辑 + 公共资源库

`cops/theme` 主题编辑弹窗由原始 JSON 文本框改为控件化资源编辑：常用资源支持启动页图、Logo、首页头图 URL 输入及导航强调色、主品牌色、页面背景色取色；未知 assets 键保留为扩展资源键值行，保存时仍按原接口提交 `assets` 对象。弹窗已放大至 1180px，主题资源区桌面端一行三列展示，列表新增资源数量与颜色标签；缩略图字段保留手输 URL，并接入公共资源库选择/上传图片。

文件存储补充：system-service 新增 `config/autoload/storage.php`，`sys_storage` 支持 `aliyun` 驱动及 `endpoint` 字段，存储配置页新增阿里云 OSS 选项；公共文件接口补 `/admin/sys/file/tree|upload|dir/save|dir/delete`，`list` 支持目录过滤、多文件类型过滤并返回上传人，`delete` 对 local 共享卷和 aliyun OSS 同步删除实际资源；上传支持图片、文档、视频、音频，local 写 `/opt/www/uploads`，aliyun 走 OSS REST PUT。新增 `sys_file_dir` 支持空目录维护；新增 `FileResourceManager` 公共组件（左侧目录树、右侧文件列表、根/子目录维护、上传/查看/单选/多选/删除）和 `FileResourcePicker` 弹窗组件，选择器可限制不限/仅图片/仅视频/图片+视频等类型，`cops/theme` 缩略图使用单选图片模式。`deploy/docker-compose*.yml` 已给 system-service 挂载 uploads，并登记 `database/system/10-storage-aliyun-resource.sql`；补齐存储按钮权限种子。验证：改动 PHP 文件 `php -l` 通过，`cd admin-web && npm run build` 通过，`docker compose -f deploy/docker-compose.yml config` 通过，本地 MySQL 迁移和 system-service 重建已执行；仅保留既有大 chunk 警告。未执行 Git 暂存/提交/推送。

## ★ 2026-08-29：餐厅资料展示（最新进度，未提交）

用户要求已有餐厅业务数据不再隐藏。商户详情取消酒店过滤、增加业务类型列，展示所有注册业务资料和KYC；餐厅无物业关联时显示“不适用”，不开放酒店专用关联动作。后端、数据库结构、餐厅商品/订单/排名运营均未改。admin构建及Browser酒店/餐厅同表、餐厅无关联按钮、酒店关联弹窗验证通过；隔离S7临时餐厅31已精确清理，未动真实商户，未重跑全量后端回归。详情见[m12/09-all-merchants-ui.md](./m12/09-all-merchants-ui.md)追加整改。本轮无Git写操作，旧授权不延续。

## ★ 2026-08-29：所有商户整改本地提交（最新Git安排）

用户单次授权本轮整改18文件本地提交，不推送；标题“feat(merchant): 整改所有商户页面并完善佣金计划与状态展示”。提交前复核既有499项回归及质量检查成功日志，本次未重跑全套测试。范围及验证见[m12/CHANGELOG.md](./m12/CHANGELOG.md)，哈希见Git日志及回执。启动脚本、两份PRD不纳入；ReviewController无新改动。下方未提交为开发交付快照，后续提交仍需单独授权，原有未验边界不变。

## ★ 2026-08-29：所有商户页面整改（最新进度）

见[m12/09-all-merchants-ui.md](./m12/09-all-merchants-ui.md)。基线e285a9d，本次未暂存/提交/推送。菜单、验证页同款标题与搜索栏、四张账户卡、八列表格和四操作图标已调整；其余动作迁入详情且保留权限。业务类型来自入驻申请及业务单元，可多项；餐厅仅目录展示/筛选，不实现运营。33迁移新增可空commission_plan（vip/premium/standard），未配置不推断；本地开发库与S7均已应用。验证与账户状态分开展示，最后登录改取同站点账号真实最近登录，详情编辑保留原备注。499项隔离回归、317 PHP/58共享用例858断言/admin构建/client类型检查通过；中英文、筛选与四入口已浏览器验证，未实际发送通知/暂停商户/发起会话。两个商户服务已加载并健康，S7启动扫描曾255退出，恢复后最终测试通过，具体缓存备份及运行边界见报告。前述S7完整原型验收待收口状态不变，旧Git授权不延续。

## ★ 2026-08-28：S7与ReviewController联合提交（最新Git安排）

用户单次授权19个S7文件与原goods-service ReviewController.php改动联合本地提交，共20文件，不推送。ReviewController仅将jsonDecode由private改为与父类一致的protected，本次语法检查通过；既有473集成、160网关和质量检查成功日志已复核，未重跑全套回归。排除start.bat、stop.bat及两份未跟踪PRD。标题、范围和验证见[m12/CHANGELOG.md](./m12/CHANGELOG.md)，实际哈希查询Git日志及回执。下方无Git操作、原5文件排除属于交付时快照；本授权不延续至后续提交。S7完整页面/原型待验收的状态不变，无生产操作。

## ★ 2026-08-28：S7本地回归与权限修复（最新进度）

见[m12/08-s7-delivery.md](./m12/08-s7-delivery.md)。基线a79d2b5，无Git写操作。用户已明确真实手机扫码由其后测、不提供Figma源文件（使用在线原型）、无生产环境验收；酒店优先及外部渠道延期不变。独立mtrip-s7容器/卷/缓存/上传/调度，网关8181，三端3517/3518/3519；未写开发库或操作真实账号。空库初始化、两轮27—32历史升级、124表备份恢复、473集成（原470＋3权限断言）、160真实网关检查、316 PHP/58单测858断言及双端构建/client类型通过。规模1000商户/5000历史分页导出通过，事务回滚。

关键缺陷：merchant-service未注册PermissionAspect，低权限可生成模块11批准凭证。新增merchant-service/config/autoload/aspects.php；仅重启旧代理仍不生效，S7商户runtime使用tmpfs重新生成代理后HTTP返回40301。其他环境必须重建代理并复核低权限HTTP，原开发商户服务未重启。S6跨站夹具补显式读权限并新增缺权限拒绝断言，不放宽应用权限；证件驳回按钮改用“驳回文件”。静态发现其他业务服务可能有同类切面缺项，尚未越界修改，应另做跨服务专项。

真实2FA绑定/登录、受控入驻交付、文档字节摘要、定时通知、发布到消费者、合规状态链路及跨窗口只读支持/撤销已有证据。在线原型读取超时；全部页面动作、真实PDF页预览、拖拽发布和大市场负载未全部验收，S7仍进行中。下一步按报告第5节补剩余页面/原型证据，不把接口通过当完整UI通过。原5个无关文件哈希保持，S6提交授权不延续。

## ★ 2026-08-28：S6本地提交授权（最新Git安排）

用户明确授权S6交付清单32文件本地提交，不推送；标题“feat(merchant): 完成 M12 S6 规则版本与商户合规联动”。排除原ReviewController、start/stop及两份未跟踪PRD，哈希不变。本次仅补充提交追溯，不改实现；沿用并核对470项集成、S6五轮375次检查及构建日志。完整有数据UI和生产等未验边界不变，下一阶段S7。实际哈希见Git日志及回执；授权不延续至后续阶段，下方“未提交”和HEAD=da15250为开发交付快照。

## ★ 2026-08-28：S6规则与合规核心交付（最新进度）

S6已实现并通过核心验证，见[m12/07-s6-delivery.md](./m12/07-s6-delivery.md)。规则独立版本快照、即时/未来生效、下线归档和显式例外；仅超管发布，站点只读适用政策。原始违规/警告不改写，处置及撤销追加compliance_history；暂停/复核恢复走S1状态服务、额外状态权限和明确确认，不能绕过黑名单或恢复其他暂停。站内通知/状态/审计同库事务；外部渠道仍延期。四页面、商户档案入口、警告事件活动来源及导出已接通。32迁移须在08-compliance之后（compose99d1），本地已执行两次成功、商户服务已重启；新权限platform:violation:record未自动授予角色。S1—S6累计470项（S6新增75）、313 PHP、58单测858断言/admin构建/client类型检查通过。空页面、弹窗、中英切换已核验，有数据完整UI、生产及此前扫码/移动端未验项留S7。当前HEAD=da15250，S5已提交，本次S6未暂存/提交/推送；原5个无关文件SHA-256不变。后续先审阅交付报告，再按用户安排进入S7，不自动提交或推送。

> 用途:当 AI 会话上下文超限需要新开会话时,新会话**第一步读取本文件**即可接手全部工作。
> 维护约定:每完成一个模块或阶段性节点,同步更新本文件的「当前进度」与「下一步」两节。

## ★ 2026-08-28：S5本地提交授权（最新Git安排）

用户明确授权本次S5交付清单29文件本地提交，不推送；标题为“feat(merchant): 完成 M12 S5 酒店市场排名与目的地发布”。排除原ReviewController、start/stop和两份未跟踪PRD；本次仅维护提交记录并核对范围，不修改实现。已完成的395项集成、5轮S5重复检查和构建结果沿用，完整有数据UI、移动端、原型像素验收限制保留。实际哈希由Git日志和提交回执记录；本次授权不延续至S6。下方“未提交”和HEAD=b924cb6均为历史交付快照。

## ★ 2026-08-28：S5核心开发交付（提交前快照）

最新进度覆盖：S5酒店真实排名、目的地及消费者读取核心开发完成，见[m12/06-s5-delivery.md](./m12/06-s5-delivery.md)。排名/目的地按明确市场version串行更新、独立published_json快照和事务内历史，31迁移（compose39m）已本地重复执行，旧演示行market_id=NULL不读取；商户/商品服务已重启。物业资格是实时门禁，排名/目的地设置须发布。测试395项通过（S5新增81项），重复5轮商户S5共300次检查通过，310 PHP/58用例858断言/admin构建/client类型通过。修复实际消费者列表缺失floatInput及重复市场插入的锁升级死锁。后台空市场/预览验证通过；缺真实商品和设计节点，完整有数据UI、移动端和像素级原型验收未通过。业务库0商品/17物业/6旧排名/0新市场；隔离夹具已清理。HEAD=b924cb6，S5未暂存/提交/推送，5个原有无关文件哈希不变。下一开发阶段S6，S7整体回归及此前未验项保留。

## ★ 2026-08-28：S4本地提交授权

用户明确授权本次S4本地代码提交，不推送。范围为S4交付58文件及看板修复新增3文件，共61个文件；原ReviewController、start/stop及两份PRD排除且哈希未变。标题为“feat(merchant): 完成 M12 S4 账号安全与模拟登录并修复商户看板”，实际哈希查询Git日志及提交回执。下文“未提交”和HEAD=232fd3e均为历史交付快照；本次授权不延续至S5。当时验证为314项集成、58单测/858断言及双端构建通过；扫码、完整UI等未验边界不变。

## ★ 2026-08-28：商户工作台内部错误修复

- 用户反馈`/merchant/stats/dashboard`内部错误。实际路由为`/api/v1/merchant/stats/dashboard`，由order-service处理。
- 先复现`marketing_coupon.merchant_id`不存在；补执行已有`database/marketing/07-merchant-promotion-owner.sql`两次通过。补齐merchant_id、created_by_merchant_admin及idx_merchant_id，历史券默认平台归属0，不猜测商户关联。
- 继续执行真实controller后复现`Query\Builder::groupByRaw()`不存在；只改商户StatsController两处为`groupBy(Db::raw('DATE(pay_time)'))`，未修改统计规则、登录或权限。
- 新增`backend/services/order-service/test/m12-dashboard.php`，实际执行整个看板SQL，14项含非零订单金额/日期聚合、促销状态、跨商户/站点、集团/黑名单/门店隔离。test-m12.ps1补测试库迁移及该测试入口，累计314项通过；58单测/858断言通过，变更PHP语法通过。
- order-service已重启且healthz正常；测试订单/券夹具为0；未使用真实凭证测试或重置真实账号，未做浏览器登录态端到端验证。未执行Git暂存/提交/推送，原S4待提交修改保留。
- 另在平台AdminStatsController发现同类groupByRaw调用，属于另一接口，尚未修改/验收；本次仅处理用户指定商户看板。

## ★ 2026-08-28：M12 S4账号级2FA与真实模拟登录

- 核心开发完成，交付：[m12/05-s4-delivery.md](./m12/05-s4-delivery.md)。密码只发受限challenge，独立TOTP绑定后才发业务JWT；超管按账号/原因/版本重置，旧密钥和会话失效。
- 真实代入商户/门店账号：60秒一次性兑换、30分钟只读支持、每请求实时权限/状态校验、actor/target/session审计；不允许集团代入或安全/财务/经营写动作。
- 30迁移已本地重复执行；八服务已重启且healthz全部ok。9个真实账号未绑定/重置，测试只在隔离库；旧商户JWT失效，真实账号下次需自行扫码绑定。
- S4 92项，连同S1/S2/S3累计300项集成检查；305 PHP文件、58用例/858断言、双端构建和client类型检查通过。本地登录及无凭证支持页浏览器冒烟通过，在线原型超时；真实扫码及完整管理端/跨窗口UI仍待验。
- HEAD=232fd3e635e220e360b0d0595da49aae920e7aa1（S3）；本阶段未暂存/提交/推送。5个原有文件哈希不变。
- 后续先验收报告未验项；下一开发阶段S5酒店排名，S6合规另行推进。餐厅和外部服务商继续延期，不混报完整M12完成。

## ★ 2026-08-27：S3本地提交授权（历史Git安排）

用户明确授权本次S3本地代码提交，不推送；仅提交04-s3-delivery.md中的46个文件，不包含原ReviewController、start/stop及两份PRD。标题为“feat(merchant): 完成 M12 S3 证件管理、活动审计与站内通知”，哈希查询Git日志。以下S3交付时的“未提交”和HEAD=87cfb66为历史快照；本次授权不延伸至S4及后续阶段，UI等未验边界不变。

## ★ 2026-08-27：M12 S3证件、活动与站内通知（阶段交付记录）

- S3核心编码及隔离集成验证完成；交付：[m12/04-s3-delivery.md](./m12/04-s3-delivery.md)。酒店优先，餐厅与外部通知服务商对接延期。
- 证件替换待审、版本行锁与历史、摘要/类型/大小校验、独立审核下载权限和受控预览下载；网关拒绝公开KYC路径，模块11入口同步防绕过。
- 活动真实账号身份、原始历史按来源鉴权、快照游标完整导出；站内通知真实回执、模板隔离、UTC排期/幂等、每账号已读和受控深链。
- 本地已应用29迁移且重复通过；服务及网关已重载，八服务healthz正常。4个新权限不自动扩权；真实商户未做替换/审核/发送测试，新增证件事件/受管版本/投递仍为0。
- 298 PHP文件、54用例/815断言、S1状态51/订单25、S2目录62、S3集成70（共208项）均通过；admin/merchant构建及client类型检查通过。匿名KYC404，未登录下载401。
- 浏览器连接超时：本轮在线原型、视觉、完整网关上传及模块11整流程未验；生产规模/长期调度/空卷初始化未测，不能当作已验收上线。
- HEAD=87cfb66（S1＋S2联合提交）；S3不暂存/提交/推送，原ReviewController、start/stop及两份PRD哈希不变。
- 下一步：先审阅报告并补未验项；后续S4账号级2FA/真实模拟登录，S5酒店排名，S6合规；不混报完整M12完成。

## ★ 2026-08-27：S1＋S2联合提交授权（历史单次授权）

用户本次明确授权助手创建S1＋S2本地联合提交，不推送；仅包含阶段交付清单，排除原ReviewController、启动脚本及PRD。本次授权不自动延伸至后续阶段。提交标题为“feat(merchant): 完成 M12 S1-S2 状态闭环与酒店档案管理”，实际哈希查询Git日志。下方及两份交付报告中的HEAD/未提交状态为阶段交付时的历史快照，不代表联合提交后的状态。

## ★ 2026-08-27：M12 S2酒店目录/档案/物业关联（阶段交付记录）

- 用户授权继续S2；酒店优先，餐厅延期；助手不执行Git暂存/提交/推送。
- 目录关键词/完整电话HMAC/状态/酒店类别/物业位置/注册日期/稳定分页排序完成；普通目录与档案访问码改为状态，不回显凭证。
- 档案聚合企业/KYC/集团/银行/账号/物业；显式关联已验证酒店业务，支持未绑定门店或新建物业，权限merchant:property:bind。变更有版本、唯一约束、行锁、事务审计及历史对照。
- 28迁移已应用本地且重复通过；历史号码回填12条、2条无效保留待核实。开发库物业映射/历史仍为0，未猜测或改动真实归属。
- 位置键只做显式国家代码/城市文本规范化，不自动翻译合并。商品/订单门店归属链路尚未接入，继续S1隔离，不因关联物业扩大授权。
- 292 PHP文件、54单测/815断言、S1状态51/订单25、S2集成62项全部通过；前端构建通过；八服务healthz正常。完整UI写入、英文视觉、生产数据量与空卷初始化仍未验。
- 交付：[m12/03-s2-delivery.md](./m12/03-s2-delivery.md)。下一批S3证件/活动/通知；2FA/真实模拟登录S4，排名S5。
- HEAD仍为4637803，S1和S2为累积未提交改动；原ReviewController、启动脚本及PRD哈希保持不变。

## ★ 2026-08-27：M12 S1状态闭环（历史）

- 用户确认设计及G2/G3/G4；酒店优先，餐厅仅预留类型扩展，餐厅页面/展示/排名/交易均延期。
- 已实施状态服务/历史表/版本和请求幂等、普通暂停恢复、超管拉黑解除与独立重新激活；临时暂停每分钟扫描到期恢复。状态历史、活动和站内通知同事务，不批量下架商品。
- 单笔和Trip创建及付款均先锁定商户再执行库存/订单；暂停前未付订单也不得首次付款，已确认订单继续履约。
- 商户用户名/访问码均允许暂停主体登录；JWT请求实时校验账号和主体，黑名单拒绝；集团过滤黑名单，门店不继承无门店归属的商户级数据。
- 本地已应用27-merchant-status.sql（重复执行通过）；隔离库mtrip_m12_s1_test仅复制结构和测试夹具，无真实数据复制。复测入口scripts/test-m12.ps1；需先重启服务刷新Hyperf扫描缓存。
- 交付、实际测试和未测项：[m12/02-s1-delivery.md](./m12/02-s1-delivery.md)。S2及之后未开始，不宣称完整M12 PRD已完成。
- 最新Git指令覆盖下面S0历史记录：助手不执行暂存/提交/推送，由用户自行操作；HEAD仍为4637803，原ReviewController、启动脚本和PRD文件保持不动。

## ★ 2026-08-27：PRD模块12商户管理阶段0设计交付（历史记录）

- 本任务需求基线为中文Super Admin Portal PRD模块12＋用户D1～D8决策，不套用下文历史Consumer阶段的完成度判断。
- 入口：[15-M12-merchant-management.md](./15-M12-merchant-management.md)；技术设计：[m12/00-design.md](./m12/00-design.md)；第一批任务/用例：[m12/01-tasks-and-tests.md](./m12/01-tasks-and-tests.md)；日志：[m12/CHANGELOG.md](./m12/CHANGELOG.md)。
- 阶段0只完成代码/数据库只读核验和设计文档，未执行业务编码、迁移或服务重启；需要用户确认技术设计后才开始阶段1。
- 关键发现：餐厅已有入驻KYC但缺正式展示链路；单笔订单和Trip都需商户状态守卫；现有2FA归属商户主体而非登录账号；access_status实际表示2FA设置状态。
- 验证：check.ps1四步通过（277 PHP文件、47测试/723断言、admin-web build、client-app typecheck）；merchant-web类型检查及构建复核通过，保留已有大chunk警告。
- 用户已授权本模块由助手维护每阶段本地Git提交/日志，不自动push；本任务以此替代下文历史“用户统一commit”约定，不改其他任务流程。
- 原有ReviewController.php修改、start/stop脚本及两份未跟踪中文PRD保留且不提交。

> 最后更新:2026-08-23(merchant-web M2/M3 客房与房量价格首轮补齐,见下方「★ merchant-web 进展」)

## ★ merchant-web 进展(2026-08-23)

- 用户明确后续范围:**不只做 M5**,需同步检查 M2/M3/M5/M6/M8/M9/M10;第一步先做样式同步,采用公共 CSS 覆盖复用现有 antd/公共组件,实在没有的组件再实现。
- 已落地样式底座:`merchant-web/src/main.ts` 调整 reset/覆盖层加载顺序;`merchant-web/src/styles/index.less` 统一卡片、筛选表单、按钮、表格、分页、Tag、Modal/Drawer 为 Hotel Merchant Dashboard 原型口径;`PageContainer` 同步 `24px 28px` 留白和浅蓝背景氛围。
- 已补模块入口:`database/seed/04-merchant-menu.sql` 新增 M2 客房管理、M3 房量与价格、M5 收益结算、M6 通知中心/设置、M8 营销活动、M9 评价管理、M10 帮助中心;未实现组件继续由 `router/dynamic.ts` 回退 `views/wip/index.vue`。
- i18n 与文档:`merchant-web/src/locales/{zh-CN,en-US}.ts`、`menuI18n.ts` 补齐新增菜单/WIP 文案;新增 `docs/plans/实现方案-Merchant-全模块差距与样式同步.md`;`docs/plans/13-商家端merchant-web落地.md` 与 `docs/plans/README.md` 已同步。
- 样式阶段验证:`cd merchant-web && npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告);随后已继续进入 M5/M6/M9/M10 首轮接口与页面实现。
- M5/M6/M9/M10 首轮继续推进:dashboard 接真实 `merchant/stats/dashboard`,新增收益结算页;新增通知中心/设置页、评价管理页、帮助中心轻量页;Header 通知铃铛接未读数。
- 后端新增 merchant 视角接口:order-service `Merchant/StatsController`,finance-service `Merchant/EarningsController`,merchant-service `Merchant/NotificationController`,goods-service `Merchant/ReviewController`;网关已登记 `stats`/`earnings`/`notifications`/`reviews`;新增 SQL `22-merchant-web-notify-read.sql` 与 `05-merchant-review-flag.sql` 已登记 initdb。
- M8 营销活动首轮已补齐:marketing-service 新增 `Merchant/PromotionController`,路由 `/api/v1/merchant/promotions/*`,支持统计/列表/详情/新建/编辑/发布/停发/删除;商家活动复用 `marketing_coupon`,新增 `merchant_id` 与 `created_by_merchant_admin` 字段(全新 DDL + 幂等迁移 `database/marketing/07-merchant-promotion-owner.sql`,已登记 initdb);网关登记 `promotions→marketing_service`;前端新增 `api/promotions.ts` 与 `views/promotions/index.vue`,文案全走 i18n,按钮权限 `mch:promotions:add/edit/status/delete` 已对齐菜单种子。
- M2/M3 客房与房量价格首轮已补齐:goods-service 新增 `Merchant/RoomController` 与 `Merchant/AvailabilityController`,路由 `/api/v1/merchant/rooms/*`、`/api/v1/merchant/availability/*`;房型详情字段与房量价格限制字段已补入 `database/goods/01-goods.sql`,存量幂等迁移 `database/goods/06-merchant-room-availability-fields.sql` 已登记 initdb;网关登记 `rooms/availability→goods_service`;前端新增 `api/rooms.ts`、`api/availability.ts`、`views/rooms/index.vue`、`views/availability/index.vue`,按 Hotel Merchant Dashboard 的 RoomsScreen/AvailabilityScreen 复刻列表、全页表单、日历网格、单日抽屉与批量更新;按钮权限 `mch:rooms:*`、`mch:availability:*` 已对齐菜单种子。
- M5 dashboard 的 `activePromotionCount` 已从占位改为读取当前有效 M8 商家活动;入住率/ADR 仍待 M2/M3 房型与房量价格域完成后回填。
- 最新验证:`D:\BtSoft\php\81\php.exe -l` 检查新增/修改 PHP 控制器和路由通过;`cd merchant-web; npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告)。服务启停/网关重启仍由用户控制。
> 最后更新:2026-08-26(商户验证页搜索栏与表格风格统一)

## ★ 2026-08-26(商户验证页搜索栏与表格风格统一)

- 验证四队列页(待核实/重新提交/得到正式认可的/已拒绝)搜索栏由旧的 `a-card` + `a-form inline` 改为与入职页一致的 `SearchFilterBar` 组件(关键词输入 + 业态下拉 + 国家下拉 + 右侧结果数摘要),筛选变化自动触发搜索。
- 表格移除 `a-card` 包裹,直接渲染(全局 `.ant-table-wrapper` 样式已提供边框与圆角),分页栏新增 `verify-pagination` 类,样式与入职页 `ob-pagination` 完全一致(灰底 #FAFBFC + 顶边线 + 28×28 按钮 + 激活态 #1664FF)。
- 新增 `merchant.verifyPage.paginationInfo/filterCategory/allCategories/keywordPlaceholder` 词条;移除旧的 `keywordLabel/keywordPlaceholder`(与 `onboardingPage` 重复)。
- 验证:admin-web vue-tsc 通过;本地 5173 逐页实测搜索栏/表格/分页栏样式全部对齐入职页,无控制台报错。

> 最后更新:2026-08-25(商户验证页面标题原型对齐)

## ★ 2026-08-25(商户验证页面标题原型对齐)

- 按线上原型(https://stir-long-36886628.figma.site/) Browser 实测,统一商户验证下五个页面(入职/待核实/重新提交/得到正式认可的/已拒绝)页头标题区为三段式:eyebrow 11px/500/#94A3B8/字距 0.05em/大写 → 4px → 主标题 18px/700/#1A2332/行高 27px → 2px → 副标题 13px/400/#94A3B8/行高 19.5px。
- 验证四队列页(`merchant/verify/index.vue`)原用内联样式且行高继承浏览器默认 1.15,导致行距与原型不符;改为 `verify-eyebrow / verify-page-title / verify-subtitle` 类并显式声明行高与 margin(4px/2px),移除 `margin-top: revert` 写法。
- 页头主标题词条改为与原型一致:新增 `merchant.verifyPage.titlePending/titleApproved/titleRejected/titleResubmission`(英文:Pending Verification / Approved Applications / Rejected Applications / Resubmitted Applications),不再复用导航卡片共用的 `queue*` 词条;入职页中文标题改为“入职”、副标题改为“商户运营部门正在接收新的潜在客户。”。
- 验证:admin-web vue-tsc 通过;本地 5173 逐页 getComputedStyle 实测五页标题区样式与文案全部对齐原型,无控制台报错。

> 最后更新:2026-08-25(验证队列线索编号统一)

## ★ 2026-08-25(验证队列线索编号统一)

- 待核实、重新提交、得到正式认可和已拒绝四个队列共用的验证列表接口批量补充 `application_no`，取正式商户关联的最新有效入驻申请编号。
- 四个队列表格及 CSV 导出的线索 ID 统一显示 `APP-XXXX`，不再把 `merchant_info.id` 渲染为 `#XX`；关键词搜索同步支持申请编号和商户业务编号。
- 验证：PHP 语法、admin-web 类型检查与生产构建通过，merchant-service healthz=200；当前待核实/已拒绝记录全部关联真实 APP 编号，得到正式认可中两条未经过入驻流程的历史测试商户显示 `-`，不伪造申请编号。

## ★ 2026-08-25(商户业务编号 MCH-XXXX)

- 入驻线索创建后在同一事务内按申请自增主键生成唯一 `merchant_code`，格式为 `MCH-` + 至少四位序号；编号在申请、待核实、重新提交、批准和拒绝阶段保持不变。
- `merchant_application.merchant_id` 继续作为批准后关联 `merchant_info.id` 的内部数字外键；`merchant_info.access_code` 继续作为最终批准后生成的门户登录别名，三者不混用。
- 新增幂等迁移 `26-merchant-code.sql`，回填存量申请并同步已关联正式商户，两个业务表分别建立唯一索引；compose initdb 登记为 `39h`。
- 入驻与验证详情“商户 ID”改为展示 `merchant_code`，入驻批准响应和提示同步返回该业务编号。
- 验证：本地库 11 条申请全部回填且 11 个编号互不重复，已关联正式商户编号不一致数为 0；迁移重复执行成功，PHP 语法、admin-web 类型检查与生产构建通过，merchant-service 重启后 healthz=200。

## ★ 2026-08-25(入驻线索术语与列表调整)

- “录入入驻线索”弹窗统一改为“商户入驻线索”；表单术语调整为商户名称、业务类型、业务数量、注册业务和业务名称。
- 入驻申请表格列统一为商户名称、业务名称、提交日期；业务名称由接口聚合同一线索下全部注册业务并以逗号分隔，提交日期格式化为 `YYYY-MM-DD`。
- 商户名称下方副标题固定展示录入线索时填写的注册国家/地区，不再被公司城市或首个业务城市覆盖。
- 列表操作列仅保留详情图标；批准、拒绝、提醒等流程操作继续保留在详情抽屉中。

## ★ 2026-08-25(公司注册号唯一性校验)

- 创建入驻线索时，非空公司注册号按全平台有效线索校验重复；已有同号记录返回 `DATA_CONFLICT` 及“该公司注册号已存在”。空注册号允许多个线索使用，软删除线索不占用注册号。
- 新增 `25-merchant-application-reg-number-unique.sql`：使用 `active_reg_number` 生成列（有效且非空才取注册号）和唯一索引，避免并发创建绕过应用层校验；已挂载 compose 的 `39g` 初始化序列并应用至本地 MySQL。
- 修复创建线索 500：事务闭包遗漏捕获 `$regNumber`，使写入值变为 `null` 并触发 `reg_number` 非空约束；现已将该变量加入闭包捕获列表。

## ★ 2026-08-25(录入入驻线索字段收敛)

- “录入入驻线索”公司信息仅保留公司名称、公司/集团名称、公司注册号、注册国家/地区、企业类型和企业数量；移除公司层的商家名称、城市和注册地址。
- 注册商家区默认展示一条记录，录入商家名称、类型、城市、业务联系人、手机号码和电子邮箱；保存时前后端均要求至少存在一家注册商家。
- 后端不再要求前端传入独立商家名称，兼容旧请求的同时以公司名称作为线索 `merchant_name` 回退值，保证既有数据结构与列表展示不受影响。

## ★ 2026-08-25(重新提交详情拒绝申请闭环,PRD 模块 11)

- 修复验证页拒绝原因下拉：Ant Design Vue options 由错误的 `{ code, label }` 改为 `{ value, label }`，9 项预置原因均可正确选中并提交；弹窗标题、原因标签和确认按钮统一为“拒绝申请/拒绝原因”。
- 拒绝成功后关闭弹窗与详情抽屉，自动跳转 `/merchant-verify/rejected`；验证状态卡按 activeTab 重新挂载并立即刷新计数，不再等待 60 秒轮询。
- 后端继续以 `merchant_info.status=2` 作为已拒绝队列唯一口径，并将对应 `merchant_application_business.kyc_status` 同步为 4；已拒绝详情中的注册商家展示“已驳回”，同时保留拒绝原因码、补充说明、受影响文件快照、时间线和活动记录。
- 验证：admin-web vue-tsc 与生产构建、VerifyController PHP 语法检查通过，merchant-service 重启且 healthz 正常；本地浏览器确认 9 项拒绝原因可选择，未执行最终拒绝提交，未改变现有商户状态。

## ★ 2026-08-25(重新提交详情底部按钮标准尺寸)

- 重新提交详情三个按钮保留琥珀浅底、玫红浅底和蓝色实底配色及 Sync / CloseCircle / CheckCircle 图标，但移除固定宽高、字号、内边距和圆角覆盖，恢复 Ant Design Vue 默认按钮规格。
- 按钮组使用默认 8px 间距；样式仍仅作用于重新提交详情，待核实详情现有操作栏不受影响。
- 验证：admin-web vue-tsc 与生产构建通过；本地浏览器实测按钮为默认 32px 高、14px 字号、4px 圆角和 `4px 15px` 内边距。

## ★ 2026-08-25(重新提交详情操作栏与通知闭环,PRD 模块 11)

- “重新提交”队列的商户验证详情抽屉由 1060px 收窄为 760px，与待核实详情保持一致；全局 Drawer footer 继续绝对定位于底部，内容独立滚动。
- 重新提交详情底部统一为“请求重新提交 / 拒绝申请 / 批准商户”三个操作：请求操作复用必填补正说明与发送通知弹窗，拒绝操作复用预置理由下拉和可选补充说明，批准操作复用待核实页的访问码、一次性初始密码与凭证交付流程及全部文件批准门禁。
- `VerifyController::resubmit` 允许状态 0（待核实）和 6（待重新提交）重复发送补正通知；再次通知保持状态 6、刷新审核时间、更新待重交文件并追加时间线与活动记录。
- 验证：admin-web vue-tsc 与生产构建、backend 270 文件 PHP lint、shared 47 用例/723 断言全部通过；merchant-service 已重启且 healthz 正常。本地浏览器实测抽屉宽度 760px、footer 为 absolute/bottom 0、三个按钮、两类通知/拒绝弹窗和批准门禁正确；未执行真实通知、拒绝或批准提交。

## ★ 2026-08-24(批准商户凭证弹窗与访问权限,PRD 模块 11)

- 待核实详情底部“通过商户”统一改为“批准商户”；批准前按原型展示访问码、仅此一次可见的初始密码、邮件/短信/应用内交付渠道和商户通知预览，必需 KYC 文件未全部批准时不允许打开批准弹窗。
- 语义统一：`merchant_admin` 仍是账号实体，`merchant_info.access_code` 是商户主账号的登录别名；商户认证兼容“原用户名或访问码 + 初始密码”，不再把访问码误当成另一条账号记录。
- 新增 `approval-credentials` 预生成接口；最终批准校验访问码、12 位大小写字母数字初始密码及至少一个交付渠道，创建主账号后明文密码仅在本次弹窗可见。
- 批准写入“商户已批准 / 访问码已生成 / 登录凭证已发送”时间线；详情返回 `access_grant`，已批准侧边栏底部展示访问码、复制/重新生成和生成日期、生成者、发送状态、渠道。
- 验证：admin-web 与 merchant-web vue-tsc + production build、相关 PHP 语法检查通过；本地浏览器完成弹窗、批准门禁和已批准访问权限区块视觉冒烟。未执行真实批准提交，未改动现有商户状态。

## ★ 2026-08-24(重新提交详情侧边栏原型实现,PRD 模块 11)

- “重新提交”队列详情改为 1060px 专用抽屉布局：顶部展示重新提交请求、请求人、日期、进度与原因，随后展示公司信息和可切换的注册商家表格。
- 需要重新提交的文件按原型改为左右对照卡片：左侧展示被拒绝的原稿、上传日期、拒绝理由和审核人；右侧展示商户新稿与待审核操作，尚未提交时显示等待回复占位状态。
- 商家切换会按 `biz_unit` 切换对应文件卡；新稿沿用已有文档版本 `revisions`，提供查看、批准、拒绝操作；未收到真实新稿前底部“确认重新提交”保持禁用。
- `VerifyController::detail` 补齐申请编号、提交日期和注册国家/地区，供详情抽屉直接展示，不改变现有数据库结构和状态机。
- 验证：backend 270 文件 PHP lint、shared 47 用例/723 断言、admin-web vue-tsc 与生产构建、client-app typecheck 全部通过；本地浏览器使用实际重新提交数据完成视觉冒烟。

## ★ 2026-08-24(KYC 正式提交边界整改,PRD 模块 11)

- KYC 上传明确为草稿动作：上传或替换文件不再触发“待核验”，已提交后资料发生变化会退回`0待办中`并清除业务单元提交记录。
- 新增业务单元级 `POST /merchant/onboarding/submit-verification`：按当前商家模板校验全部必需文件，成功后写`2待核验`、`kyc_submitted_at/by`并将申请阶段仅向前推进到 4；多商家分别提交。
- `approve` 增加门禁：所有注册商家均有明确提交记录后才能转 Pending Verification，并统一进入`3审核中`；文档审核仅允许在待核实阶段执行，全部必需文件批准后进入`1已验证`。
- 原 `confirm` 保留为独立的“商户确认信息与授权”语义，不再承担提交核验或阶段流转；前端底部“提交核验”改调新接口并携带当前 businessId。
- 数据库新增并挂载 `24-merchant-kyc-submit-boundary.sql`（compose 39f）；旧逻辑中仅因上传得到的状态 2 保守退回状态 0，迁移已应用到本地 MySQL。
- 验证：必需文件不齐提交返回 40901；完整资料提交后申请阶段=4、业务状态=2且提交时间/提交人落库；入驻通过门禁返回 40901；冒烟数据已恢复。backend 270 文件 lint、shared 47 用例/723 断言、admin-web build、client-app typecheck、merchant-service healthz 全部通过。

## ★ 2026-08-24(KYC 全流程状态机整改,PRD 模块 11)

- 状态机统一为 `0待办中 → 2待核验 → 3审核中 → 1已验证`（4 保留已驳回）：新建注册商家写 0；显式提交核验写 2；入驻通过转 Pending Verification 时写 3；全部必需文件批准后写 1。
- `OnboardingController::sendKyc` 的文档占位行改按 `application_id + biz_unit` 隔离，解决多商家申请只为第一个商家生成模板文件的问题；发送请求和上传接口均支持单商家自动归属、多商家必须明确业务单元并校验归属。
- `VerifyController::detail` 与新增 `syncBusinessKycStatus` 按模板必需 doc_type 和已批准文件实时/持久化状态；单文件批准或驳回后同步徽标，最终商户批准时全量落 1。
- 最终批准门禁从“所有文档记录 status=1”改为“每个注册商家的全部强制文件已批准”，可选文件不再错误阻塞；非入驻商户保留旧门禁兼容。
- 前端两页 KYC 徽标补 `待办中`，中文终态统一为`已验证`；验证文件表不再把空 file_url 占位行误判为已上传。
- 数据库：`09-merchant-application.sql` 默认值改 0；新增并挂载 `23-merchant-kyc-status-flow.sql`（compose 39e），已应用到本地 MySQL，字段默认值=0，存量状态已校正。
- 门禁：统一 `scripts/check.ps1` 四步全绿（backend 270 文件 PHP lint、shared 47 用例/723 断言、admin-web build、client-app typecheck）；最终 PHP lint、compose config、diff check 通过；merchant-service 已重启且 `/healthz` 返回 ok。

## ★ 2026-08-24(商户验证详情：注册商家展开与 KYC 审批进度)

- 注册商家标题左侧新增 `MenuOutlined`，表格增加右侧展开箭头；点击行同时切换当前商家文件列表并按手风琴展开业务类型、联系人、城市、电话、邮箱，样式复用入驻申请详情。
- `VerifyController::detail` 的业务单元 KYC 状态改为按必需文件批准数量推导：0 份批准=`待办中`、部分批准=`审核中`、全部必需文件批准=`已核验`；不再以是否上传或是否驳回直接决定业务单元状态。
- 单文件审核刷新详情时同步更新 `businesses`，KYC 状态徽标无需关闭抽屉即可变化。
- 门禁：VerifyController PHP 语法检查与 `admin-web npm run build` 通过。

## ★ 2026-08-24(待核实详情：上传日期与操作按钮对齐)

- 文件表上传时间统一通过 `formatUploadDate` 输出 `YYYY-MM-DD`，不再显示时分秒。
- 操作按钮改为 inline-flex 垂直居中，并对 Ant Design 图标容器同步居中，修复预览按钮文字偏上的显示问题。
- 门禁：`admin-web npm run build` 通过。

## ★ 2026-08-24(待核实详情：文件表单页无横向滚动)

- 待核实详情的文件表移除 `scroll.x`，启用 fixed table layout；四列压缩为 Document 250 / Status 125 / Uploaded 105 / Actions 220，适配 760px 抽屉。
- 三个操作按钮保持原型配色，字号缩至 11px、高度 26px、内边距 6px、间距 4px，确保不换行且不出现横向滚动条。
- 门禁：`admin-web npm run build` 通过。

## ★ 2026-08-24(待核实详情：文件表原型对齐与 KYC 状态修复)

- 文件表移除“待上传文件 / 上传文件名”列，恢复原型四列 `Document / Status / Uploaded / Actions`；文件图标并入 Document 单元格，预览/批准/驳回改为蓝 `#EFF6FF`、绿 `#ECFDF3`、红 `#FFF1F3` 的描边按钮并带对应图标。
- 根因：`OnboardingController::approve` 在商户进入 Pending Verification 时把所有业务单元写成 `kyc_status=1`（已核验）。修复为初始“核验中”(3)，同时 `VerifyController::detail` 按该业务单元实际上传、驳回与必需文件审核结果动态推导 Pending / Under Review / Verified / Rejected，覆盖历史错误状态。
- 门禁：两个 PHP 控制器语法检查与 `admin-web npm run build` 通过。

## ★ 2026-08-24(待核实详情：按商家类型展示应交文件)

- `VerifyController::detail` 为每个注册商家附带 `kyc_template_docs`：优先使用业务单元绑定模板，未绑定时按业态取首个启用模板。
- verify 详情抽屉的已提交文件表改为“模板应交清单 + 同商家 `biz_unit` 上传记录”合并视图：文件图标、待上传文件、上传文件名、状态、上传时间、预览/批准/驳回按钮；未上传资料仍显示，相关操作禁用。
- 最终核实决定改按当前所选商家的 `已审核数 / 必需模板文件总数` 计算；可选文件仍展示但不阻塞最终决定，状态文案对齐为“已审核 / 等待审核”。
- 门禁：`php -l backend/services/merchant-service/app/Controller/VerifyController.php` 与 `admin-web npm run build` 通过。

## ★ 2026-08-24(待核实详情抽屉按原型对齐,admin-web)

- `merchant/verify/index.vue` 的详情抽屉按 Pending Verification 原型重排：标题/副标题、Verification Admin Review Mode、公司信息 2+3 列、注册商家表格、KYC Submission Details、提交文件表、最终核实决定与活动时间线。
- 点击注册商家行仅切换选中态，并按该行 `biz_unit` 立即筛选对应上传文件；不再展开额外业务详情。
- 复用 verify/detail 已返回的 `kyc_submission`，补齐前端接口类型及中英文文案；最终操作移入 `#footer`，由全局抽屉样式固定在底部。
- 门禁：`npm run build` 通过（仅保留现有大包体积提示）。

## ★ 2026-08-21(核验详情抽屉:注册商家表格展开详情 + 文件表格 + 最终核实决定)

- verify 详情抽屉在已有「注册商家表格 + 按商家过滤上传文件」基础上增强:
- **商家表格行点击展开详情**(同入驻申请手风琴 rb-expand):点击行即选中商家(过滤文档)+ 展开业务详情(业态/联系人/城市/电话/邮箱,co-grid 2col)。
- **文件表格参考原型 Submitted Documents**:列改 Document(name+type)/ Status / Uploaded(uploaded_at)/ Actions(View 预览 file_url + Approve 核验通过绿 + Reject 驳回红 彩色小按钮)。
- **文件表格下方「最终核实决定」卡**:前有 Verification Admin Review Mode 提示条(浅蓝底标题+说明);卡内副标题按已审核数动态(全通过/有驳回/未审完`已审核 {n}/{total} 份文件 — 请先在做出最终决定前审核所有文件`)+ 动作条(通过/驳回/要求重交/确认重交)。
- script 加 `reviewedCount`/`finalDecisionSubtitle`(按 verifyDocs 已审 status 1/3 计数);i18n 补 colDocUploaded/docActionView/finalDecision*/reviewMode*(中英)。
- 门禁:vue-tsc + build 零报错。

## ★ 2026-08-21(核验详情抽屉:注册商家表格 + 按商家显示上传文件,admin-web)

- verify 详情抽屉按原型新增**注册商家表格**(§3)并把上传文件(§4)与所选商家联动:
- 后端 verify/detail 已返回 `businesses`(merchant_application_business)与 documents(含 `biz_unit`),`apiVerifyDetail` TS 类型补 `businesses`。
- 前端:verify 页新增 `businesses`/`verifyBizId`/`verifyCurrentBiz`/`verifyDocs`(按 `biz_unit === verifyBizId` 过滤)与 `selectVerifyBiz`;`openDetail` 默认选中第一个商家;表格 rb 风格(表头 #/商家名称/业态/城市/KYC状态 + 行点击高亮 is-open,kubernetes 样式同 onboarding),documents 表 `data-source` 改用 `verifyDocs`,文档标题附当前商家名;无商家显示空态。
- 常量复用:从 onboarding 复制 `BUSINESS_TYPES`/`BIZ_TYPE_EMOJI`/`bizTypeText`/`RB_KYC_BADGE`。
- i18n 补 verifyPage `colBizName`/`noRegisteredBusiness`(中英)。
- 门禁:vue-tsc + build 零报错;detail 冒烟确认 businesses(id16/17)与 documents biz_unit(16/17/'')齐全,按商家过滤可用。

## ★ 2026-08-21(待核实页按原型 Pending Verification 整改,admin-web)

- 当前 `merchant/verify/index.vue`(4 队列:待核实/已通过/已驳回/重交)按原型 Pending Verification 页面整改,数据仍用现有 verify 接口(merchant_info 维度,与 onboarding 独立)。
- **列表页**:页头(小标题 Merchant Verification + 大标题/副标题 + Export 导出);搜索栏改为关键词 + 国家下拉 + 右侧 `{total} results`;表格改原型 8 列 —— Lead ID(#id 等宽蓝)/ Merchant Name(名+城市副行)/ Business Name(short_name truncate)/ Reg. Number(credit_code 前12位)/ Submitted(等宽)/ **Verification Status**(原型徽章配色:Pending 黄 #B54708/#FFFBEB、Approved 绿 #027A48/#ECFDF3、Rejected 红 #C01048/#FFF1F3、Resubmission 蓝 #1D4ED8/#EFF6FF、Suspended/Closed 灰)/ Assigned Ops(audit_by,未指派置灰)/ Actions(**图标按钮** eye查看/check通过/close驳回/sync重交)。
- **详情抽屉**:改原型工作台 —— §1 状态卡(商户名 + Verification Status 徽章 + 4格 Lead ID/类型/提交/审核时间)、§2 注册信息(co-section-heading 大写标题 + 2列 descriptions)、§3 已提交文件、§4 活动时间线(复用原型 `.onb-tl` 左侧竖线+圆点白光环+monospace日期+来源标签+action+by,异常标红)、底部动作条右对齐。
- i18n 补 `colBusiness/colRegNumber/colVerifStatus/colAssignedOps/colCountry/resultCount/exportCsv/unassigned/pageKicker/*Subtitle/registrationInfo`(中英)。
- 门禁:vue-tsc + build 零报错。

## ★ 2026-08-21(修复:协助 KYC 上传文件重开不显示 / 文件预览 404)

- **上传后重开抽屉看不到文件**:根因是上传成功只改 `assistUploads`,未同步 `documents.value`,重开 `openAssistKyc` 从 `documents.value` 初始化时拿不到新文件。修复:上传成功后按 `doc_type + biz_unit` 在 `documents.value` 覆盖/新增记录。
- **上传文件无法预览**(图片/PDF):根因是上传文件 URL 是网关相对路径 `/uploads/...`,admin-web dev server(5173)下相对 href/新窗口打开走 5173 → 404。修复:`admin-web/vite.config.ts` server.proxy 新增 `/uploads` → `http://127.0.0.1:8081`(与 `/api` 同 target),生产同源天然可用。
- 门禁:vue-tsc + build 零报错;dev 起服实测 `/uploads` 代理返回 200(图片可访问),不存在文件 404。

## ★ 2026-08-21(协助商户 KYC 关联所选注册商户,按业务单元隔离)

- onboarding 详情抽屉「协助商户完成 KYC」由"全局模板"整改为**关联当前选中的注册商户**:
- 后端 `OnboardingController::kycUpload` 新增 `bizUnit`(业务单元 id)可选参数:非空时校验其属于该申请(`merchant_application_business`),资质文档按 `application_id + biz_unit + doc_type` 定位占位行,未命中则新建并落 `biz_unit`;同 docType 不同商家互不覆盖。
- 前端:`openAssistKyc` 记录所选商家 `assistBiz.value = currentBiz`;`assistKycDocs` 改按该商家的 `kyc_template_id` 对应模板生成文件清单(否则回退依赖签名);`assistUploads` 初始化只归位当前 `biz_unit` 下已上传文档;`uploadAssistDoc` 携带 `bizUnit=selectedBiz.id`;抽屉副标题/业务名称输入框改用 `assistBiz`。
- `api/merchant.ts` `apiOnboardingKycUpload` 加可选 `bizUnit`(FormData)。
- 门禁:php -l 全量 + shared 47 用例 + admin-web build 零报错;接口冒烟(同 docType 上传 biz16/biz17 各自新建独立文档行,biz_unit=16/17;非法 bizUnit 40001 拒绝)通过,测试数据已清理。

## ★ 2026-08-21(内部备注 → 内部笔记对齐原型,admin-web)

- onboarding 详情抽屉 §7「内部备注」改「内部笔记」:标题复用 `co-section-heading` 结构(灰色 `co-heading-icon` + 大写标题 + 右侧延伸线),加 `EditOutlined` 小图标。
- 历史列表按原型 `ci` 组件样式:卡片 `bg:#FFFBEB border:1px solid #FDE68A r8 pad10/12`,头部头像圆(20r #D97706 白字**操作人首字母大写**)+ `by`(11/600 #92400E)+ `date`(10 monospace #94A3B8),正文 12px #78350F lh1.6。
- **输入组件由单行 `a-input-group` 改为多行 `a-textarea`**(rows 3,圆角6、边框 #E3E8F0、padding 8/10、resize vertical),placeholder 对齐原型「对商户运营与超管可见的内部笔记…」,「添加笔记」按钮右对齐。
- i18n:zh `internalNotes/noNotes/notePlaceholder/addNote` 改「内部笔记/暂无笔记/…/添加笔记」,en placeholder 改完整文案。
- 门禁:vue-tsc + build 零报错。

## ★ 2026-08-21(入驻申请详情活动时间线按原型精确对齐,admin-web)

- 按 Figma Make 原型(stir-long-36886628.figma.site)实际抓取 `Merchant Verification & Onboarding` 详情抽屉 **Activity Timeline** 渲染源码(`si` 组件:容器 borderLeft 2px #E3E8F0 + paddingLeft 20;每条 = 绝对定位彩色圆点 width/height 10 `border:2px solid #fff` + `boxShadow:0 0 0 2px dot` 白描边外光环;首行 `monospace` 10px #94A3B8 日期(`YYYY-MM-DD`) + type 标签 `fontSize 10/600` `padding:0 5px` `background:${dot}15`(8%透明底) `borderRadius:3`;次行 action `12/500/#1A2332`;末行 `by xxx` `11/#64748B`)。
- type 映射(`oi`):`system`→color/dot `#94A3B8`/`#E3E8F0`、`admin`→`#1664FF`/`#1664FF`、`merchant`→`#059669`/`#059669`;前端 `tlSource()` 按 `actor_type`(1 system/2 admin/3 merchant) 返回 `{label,color,dot}`。
- **彻底移除 Ant Design `a-timeline`**,改自定义 div 复刻原型;不再显示 action 内部英文键(kyc_confirmed/assist_kyc_upload 等),操作描述取 `note || action`,异常事件标红;新增 `tlDate()` 取 `created_at` 日期 `YYYY-MM-DD`。
- 样式 `.onb-tl` 系在 onboarding/index.vue `<style>` 末尾。
- 门禁:vue-tsc + build 零报错;detail 接口 data 含 actor_type/note/operator_name/created_at 已实测确认。

## ★ 2026-08-21(协助商户完成 KYC:文件上传 + 提交核验确认,admin-web)

- **需求**:「协助商户完成 KYC」抽屉(admin-web onboarding 页)`assist-kyc-drawer`)接入真实文件上传;点击「提交核验」弹出确认框(文案:此KYC信息由商家代为录入。提交后,必须由授权的验证管理员或超级管理员独立审核相关文件。),确认后调 `confirm` 接口。
- **后端**:`OnboardingController::kycUpload`(`POST /admin/merchant/onboarding/kyc-upload`,Perm `merchant:onboarding:kyc`):校验扩展名(PDF/图片)+10MB → 本地共享盘落盘 `uploads/kyc/{appId}/{Ym}/{唯一}.{ext}` → `chmod 664`(否则网关 nginx 读不到返回 403)→ 写 system 库 `sys_file`(biz_type=merchant_kyc)→ 更新/新建 `merchant_verify_document`(file_url/file_size/name/status=2)→ 写时间线 `assist_kyc_upload`。配置 `config/autoload/storage.php`(upload_root=/opt/www/uploads,url_prefix=/uploads)。
- **共享存储**:`deploy/uploads/` 目录,merchant-service 挂 `/opt/www/uploads`(写)、gateway 挂 `/usr/local/openresty/nginx/static/uploads`(只读);**新增 volumes 后必须 `docker compose up -d` 重建,** `restart` 不会应用 compose 变更。
- **网关** `mtrip.conf` 新增 `location /uploads/`(alias 静态服务 + CORS + try_files)。
- **前端**:`api/merchant.ts` 加 `apiOnboardingKycUpload`(FormData),`utils/http.ts` 的 `post` 支持 `FormData`;抽屉内「选择文件」按钮(隐藏原生 file input)真实上传,上传中转圈、成功后展示文件名+预览+删除、标题 `assistUploadedCount` 计数联动;「提交核验」走 `Modal.confirm`(指定文案)→ 确认调 `apiOnboardingConfirm` 并刷新。i18n 补 `assistSubmitConfirmTitle/Text/Success`、`assistUploadSuccess/Removed`。
- **门禁**:php -l 全量通过、shared 47 用例通过、admin-web build 零 TS 报错;端到端冒烟(上传=200 返回 /uploads URL、网关静态访问 200、documents+sys_file 落库、confirm→confirmation_status=1)通过,测试数据已还原。

## ★ 前端 redesign 进展(2026-08-20,client-app)

- **移动端主色统一为 `#4169ED`**(Figma `M-Trip` 设计稿),底部 Tab 改为 Home / My Pick / Promotions / More 四项 + 自绘 SVG 图标(`navigation/index.tsx`、`components/common/TabBarIcon.tsx`)。
- **首页按 Figma `M-Trip / Home`(node `81:2464`)重做**:14 个区块拆为 `src/components/home/*`(SearchSection / QuickActionGrid / PromoCard / MemberCard / DestinationCard / SpecialDealBanner / StayCard / DiningCard / RouteCard / ExperienceCard / AssistanceGrid / MagazineCard 等),设计令牌集中在 `config/theme.ts`(新增 Figma 色板与 `radius.card/btn/tile`)与新增的 `config/typography.ts`(Outfit/Inter 字号预设)。
- 数据分工:「热门目的地」取 `fetchHome().hot`、「酒店特惠」取 `fetchHome().recommend`,其余 11 个区块用 `screens/home/homeSections.ts` 的静态常量(文案走 i18n `home.*`,后端接口就绪后逐块替换)。接口失败只让这两块降级为空,静态区块照常渲染。
- 字体依赖:`@expo-google-fonts/outfit` + `@expo-google-fonts/inter` + `expo-font`,在 `App.tsx` 用 `useFonts` 与 `bootstrapStores` 一起 gate。
- 素材:快捷入口 4 个 PNG + 顶部栏 mTrip 字标 `logo.png` 用 `scripts/figma-home-icons.py` 从 Figma 导出(需环境变量 `FIGMA_TOKEN`,须在仓库根目录跑);大图无本地素材,统一走接口 `cover_image` 或 `components/home/CoverImage.tsx` 的主色渐变占位。
- **快捷入口只有一行 4 项(Hotels / Food / Cars / Package)**:设计稿里第二行 `Section - Quick Action Dashboard`(`81:2781`)与第一行 Bus 所在 `Container`(`81:2486`)都带 `visible:false`,是隐藏稿。行宽 370、gap 16、每项 80.5x80.5 圆角 24 的**图片填充**方块(4x80.5+3x16=370 正好铺满),导出的 PNG 本身就是蓝色圆角图标,**不能再垫白色底板**(之前垫了白底 56x56 导致图标带白边)。`homeSections.ts` 只保留单个 `QUICK_ACTIONS`。
- **促销大卡按设计稿 `Section - Upcoming Trip Card`(node 81:2516)重做**(`components/home/PromoCard.tsx`):370x180 r32 `#0036AD`、pad 24、内容左对齐竖排 gap 8 并垂直居中;右上角 148x117、透明度 20% 的床形矢量水印(path 取自设计稿 `fillGeometry`,`react-native-svg` 绘制,被卡片圆角裁掉)。徽章 r9999 `#1F4ED3` + Inter 700/10 大写字距 0.5 `#C8D1FF`;`Hotels` Outfit 600/16;`20% Off` Inter 600/24 且容器透明度 0.9;按钮白底 r12 pad 24/8 + Inter 400/16 `#0036AD`。
- **顶部栏按设计稿 `Header - TopAppBar`(node `81:2733`)重做**(`components/home/HomeHeader.tsx`):高 47、左右 pad 16;左侧 mTrip 字标为**位图**(设计稿里同名文本节点 `visible=false`,只能走 `assets/images/logo.png`),右侧为积分胶囊(62x32 r8 主色 10%,含 `fluent:diamond-12-filled` + 积分数)+ 36x36 圆形消息按钮(`fluent:alert-16-filled`)。这两枚图标的 path 已按设计稿 `fillGeometry` 精确对齐(`HomeIcon.tsx` 支持每图标独立 viewBox,用负 minX/minY 抵消子节点偏移)。
- **站点切换已从首页移到「更多」页**:设计稿顶部栏没有 Select Site,`components/business/SiteSwitchEntry.tsx` 已删除,入口改为 `screens/user/MineScreen.tsx` 里 `entryCard` 的一行(否则 `SiteSelect` 路由无处可达)。
- 字体补充:顶部栏积分是 Inter **Medium Italic** 16,但 `@expo-google-fonts/inter` 不含斜体字重,退化为 `Inter_500Medium` + `fontStyle:'italic'`(web 合成斜体,原生为正体)。
- 设计稿离线快照放在 `.figma-cache/`(已加入 `.gitignore`)。
- **位图素材已全部落盘**(2026-08-20 确认):`client-app/assets/images/logo.png` + `home/` 下 9 个 PNG。`scripts/figma-home-icons.py` 只在需要**新增**设计稿里没导过的 node 时才跑(token 从仓库根 `.env.local` 自动读取,须在仓库根目录执行)。
- **门禁待补跑**:`cd client-app; npm run typecheck`(本次会话命令行被限流,始终没能执行)。`scripts/check.ps1` 因本机 `php` 不在 PATH 第 1 步即中断,与本改动无关。
- 已知取舍:`components/home/HomeIcon.tsx` 里 `bell` / `diamond` 已按设计稿 `fillGeometry` 对齐,其余 6 枚(search/heart/location/gift/alert/chat/document)仍是同体系标准 24 网格图标顶替;要完全对齐只需改该文件 `ICONS` 表里的 `d` / `viewBox`,组件接口不变。

### ★ 2026-08-21(client-app「我的精选」按 Figma `My Pick` node `289:1112` 重做)

- `screens/mypick/MyPickScreen.tsx` 由占位空页改为完整页面:顶部栏(复用 `HomeHeader`)→ 三分类页签 → 预订卡列表 → 入住反馈卡 → 收藏酒店(横滑)→ 收藏餐厅(横滑)→ 新用户促销卡(复用 `PromoCard`)。`navigation/index.tsx` 的 `MyPickTab` 改 `headerShown: false`(页面自带设计稿顶部栏)。
- 新增组件 `components/mypick/`:`PickTabs`(370x52 r32 三等分页签)、`BookingCard`(封面 + 状态胶囊 + 房型 + 日期/人数两栏 + 主按钮/地图按钮)、`FeedbackCard`、`SavedRestaurantCard`(322 宽,图上胶囊组 + 距离/时长/配送费)。
- 数据分工同 HomeScreen:预订列表取 `/order/list`(前端按 `myPickSections.ts` 的 `TAB_STATUS` 把 upcoming/completed/cancelled 映射到订单状态集合,因后端 `status` 只收单值),收藏酒店取新接的 `/user/favorite/list`;**未登录时用设计稿示例卡兜底,已登录且为空时走空态文案**。收藏餐厅后端无对应品类(`GOODS_TYPE` 只有 1 酒店 / 2 门票),走 `myPickSections.ts` 静态常量。
- 新增 `api/user.ts` 的 `fetchFavoriteList/addFavorite/removeFavorite` 与 `types/models.ts` 的 `FavoriteItem`。**收藏接口 join 商品直出,不含起价**,故 `StayCard` 改为 `minPrice > 0` 才渲染价格行。
- 复用改造:`SectionHeader` 新增可选 `seeAllLabel`(设计稿「Save Restaurants」右侧是 View all);`theme.ts` 新增 `colors.textSoft`(设计稿 `--text-2` = `rgba(25,26,37,0.5)`)与 `colors.statusPaid`(`#10B981`)。
- **未完成项**:`HomeIcon.tsx` 新增的 7 枚图标(check/calendar/travelers/map/star/heartFilled/motorcycle)本次会话因命令行与网络工具全程被限流,**没能取到设计稿 SVG,仍是同体系 24 网格顶替**,文件内已留 TODO 与对应 node id;`cd client-app; npm run typecheck` 同样未能执行,需下次会话补跑。(其中 calendar/travelers 已于酒店页对齐、star 已于本条下方的筛选面板对齐,TODO 只剩 check/map/heartFilled/motorcycle)

### ★ 2026-08-21(client-app 酒店筛选面板,Figma `Filter overlay` node `408:1824`)

- 酒店页顶部栏的筛选按钮由 `comingSoon` 改为拉起 `components/hotel/HotelFilterSheet.tsx`:RN 自带 `Modal`(`animationType="none"`)+ `Animated` 做**从底部升起**的浮层(升起 260ms `Easing.out(cubic)` / 落下 200ms,背板 40% 黑同步淡入;关闭动画放完才卸载,故组件内自持一份挂载态)。面板上圆角 32、`maxHeight` 取窗口高 86%,**吸顶头(X / Filter By / Reset)+ 可滚动主体 + 吸底 CTA** 三段式,吸底条按 `useSafeAreaInsets().bottom` 加安全区。
- 主体四区:Recent Filters / Budget(计价口径下拉 → 直方图+双滑块 → 最低最高输入框)/ Popular Filters(10 项,其一是 4 颗星无文字)/ Property Types(4 项 + Show more)。
- **`components/hotel/PriceRangeSlider.tsx`**:未引入 `@react-native-community/slider` 与 gesture-handler,双滑块用 RN 自带 `PanResponder` 自绘(手势回调内一律读 ref,避免闭包拿到过期 props)。设计稿 21 根柱子的**高度**是静态曲线(后端无价格分布接口),但**染色实时算**——按柱心是否落在两滑块中心之间取 `--text` / `--text-2`,拖动观感与设计稿一致。
- **与后端的关系**:`/api/v1/app/goods/list` 只有 goodsType/categoryId/keyword,**没有价格区间与设施筛选参数,所以选择结果只留在 `HotelsScreen` 的状态里,不进请求**;各行右侧计数(600+/1200+…)与 CTA 总数(6300+)是设计稿静态值。计价口径下拉与 Show more 设计稿没有第二组选项,走 `onComingSoon`。价格域取 0~1,000,000 步进 10,000(设计稿只给了 10,000 / 500,000 两个示例值)。
- 设计稿文案笔误已修正:`Show Resluts` → Show Results、`2bedrooms` → 2 bedrooms;新增 i18n `hotels.filter.*`(中英各 25 键,插值用 `{{total}}` 而非 i18next 保留字 `count`)。
- `HomeIcon.tsx` 新增 `close`(408:1971)/ `caretLeft`(fluent:ios-arrow-24-filled,用时外层转 -90° 当下拉箭头),并用 `fluent:star-12-filled` 的 path **顶替原 24 网格 star 草图**(SavedRestaurantCard 同步受益);`theme.ts` 新增 `colors.star = #FFC100`。
- 门禁:`cd client-app; npm run typecheck` 已跑通零报错。

### ★ 2026-08-24(client-app 日期选择器,Figma `Choose Date` node `695:1428`)

- 酒店页搜索卡的入住/离店两格由 `comingSoon` 改为拉起 `components/hotel/DatePickerSheet.tsx`:RN 自带 `Modal`(`animationType="none"`)+ `Animated` 做**居中卡片**浮层(淡入 + 上移 24px,220ms/180ms;关闭动画放完才卸载,同筛选面板自持挂载态)。**设计稿背后的大图保持原亮度、没有遮罩**,故背板只留一层透明的点击关闭区。
- 卡片自上而下:标题 → 入住/离店两张 `#EFF4FF` 卡(中间悬一枚 `--tab` 底的箭头徽章,设计稿是 arrow-left 旋转 180°)→ 总晚数条 → 月份切换 → 七列日历 → 节假日说明 → 弹性日期档(Exact Dates / ±1 / ±2 / ±3 / ±7)→ Confirm。
- **七列等宽用像素值算,不用百分比**:RN 的 `flexWrap + gap` 不像 CSS grid 那样自动扣列间距,百分比宽会因 6 道 8px 间距挤到第二行;列宽由窗口宽减去卡片外边距/描边/内边距/间距后除 7 并向下取整(常量 `CARD_MARGIN/CARD_PADDING/CARD_BORDER/GRID_GAP` 是单一出处,改内边距时一起改)。
- 交互:先点入住再点离店,点到入住日或更早则重新起头;今天之前的日期沿用设计稿 9~11 号那一档的置灰样式并禁点,月份不能翻到当月之前;只选了入住日时 Confirm 置灰。星期表头与月份标题走 `toLocaleDateString`(`weekday:'narrow'` / `month:'long'`)跟随语言。
- 与设计稿的取舍:设计稿的日历是「Mini Calendar Mockup」(只画了 9 号往后四周),这里按真实月份铺满整月;首尾格下方 4px 白点(`696:1643`)落在白色卡片上不可见,未实现;节假日后端无接口,组件内 `HOLIDAYS` 静态表按 MM-DD 命中(设计稿的 Oct 19 National Day);设计稿 `±3Day/±7Day` 少了复数,统一按「1 天 / 多天」两个文案键。
- **与后端的关系**:`/api/v1/app/goods/list` 没有日期参数,选中的区间只回填到 `HotelsScreen` 的搜索卡,不进 Search 请求。
- `HomeIcon.tsx` 新增 `caretLeftSlim`(695:1428 的 Frame 337,导出 SVG 的 path,viewBox 收到字形包围盒 `4 0 7 12`;朝右那枚是它旋转 180°);分隔线取导出资产 Line 11 的实际描边 `#555555` @10%。新增 i18n `hotels.datePicker.*` 中英各 7 键。
- 门禁:`cd client-app; npm run typecheck` 零报错;`scripts/check.ps1` 因本机 `php` 不在 PATH 第 1 步即中断(与本改动无关)。

### ★ 2026-08-24(client-app 酒店搜索结果页,Figma `Long Stay Search Results` node `1695:6325`)

- 新增 `screens/hotel/HotelResultsScreen.tsx`(路由 `HotelResults`,`headerShown:false`,页面自带悬浮顶部栏),酒店页 Search 由跳通用 `GoodsList` 改跳这里并带上关键词/日期/公民身份;`GoodsList` 仍留给门票等其它品类。
- 页面结构:顶部大图(与搜索卡重叠 148,同酒店页)→ 搜索卡(回显并可改条件,点 Search 才生效)→ 筛选 chips(横滑,即时生效)→ 结果头(总数 / 含税说明 / View map)→ 卡片列表(FlatList 自持分页:下拉刷新 + 触底加载,空/错/加载态复用 `StateViews`)。
- **chips 与排序都落到真实查询参数**,不是纯前端状态:Rating 4+ → `reviewScore=4`、Free Cancellation → `freeCancel=1`、Breakfast → `breakfast=1`、Free Wifi → `amenities=Wifi`、Sort by → `sortBy` 白名单(`GoodsController::applySort`;面板实际给出的六项见下条)。`api/goods.ts` 的 `GoodsListParams` 已按后端 `applyFilters/applySort` 补齐,并导出 `GoodsSortBy`。
- 新增 `components/hotel/HotelResultCard.tsx`:封面 176 高,上下各压一条主色渐变条(`react-native-svg` 画,项目未引 expo-linear-gradient),左上星级(`star_level` 颗)、右上收藏心、左下评分行、右下评价档徽章;正文为名称/地址/价格与徽章。徽章按 `is_recommend → PREFERRED`、`is_hot → HIGH DEMAND` 映射。
- **数据缺口(设计稿有、接口没有)**:①「Rating: 9.3 (1,230 Review)」与 EXCELLENT 徽章 —— `/app/goods/list` 不下发评分(只有详情的 `reviewSummary`),`GoodsItem.rating/reviewCount` 已留可选字段,拿不到时整行不渲染;要点亮只需在 `GoodsController::list` 的 `rowWithPrice` 里补一份与 `applySort` 同款的 `AVG(rating)/COUNT(*)` 子查询。②设计稿的促销小行(SUMMER PROMO / 5% off for 7Nights / Long Stay Not Supported)无对应字段,改用**公民价**表达:勾选 Myanmar Citizen 且 `minPriceCitizen` 更低时划掉原价并显示省了百分之几(`GoodsItem` 补 `minPriceCitizen` 可选字段,后端 `rowWithPrice` 本来就下发)。③BEST SELLER 徽章无对应字段,未实现。
- **演示数据(2026-08-24 追加)**:接口没连通或没返回结果时,列表回落到 `screens/hotel/demoResults.ts` —— **直接照搬设计稿那四张卡的原始数值与文案**(评分 9.3/7.8/4.3/4.3 与评价数、MMK 195,000/175,000/195,000/155,000、EXCELLENT、SUMMER PROMO、5% off for 7Nights、Long Stay Not Supported、PREFERRED/HIGH DEMAND/BEST SELLER),结果头总数同步显示演示条数,下方给一条可点重试的提示条(请求失败时把错误原因一并带出,不让演示数据盖掉故障)。演示卡 id 取负数(同 `myPickSections.ts` 的约定):点卡片不跳详情、点心只切本地状态;chips / 排序 / 关键词在演示态下由 `queryDemoResults` 在前端本地生效。封面复用 My Pick 的两张设计稿临时图,另两张走 `CoverImage` 的渐变占位(设计稿那两张图没导出)。**注意设计稿评分是 10 分制、后端是 5 分制**,演示数据按设计稿原样展示,接真实数据后自然变成 5 分制。
- 为承载上述设计稿元素,`HotelResultCard` 增开三个可选属性 `ratingTier / promo / badge`(不传就按 `rating`≥4.5 → EXCELLENT、`is_recommend/is_hot` → 徽章、公民价 → 促销小行 自行推导),`theme.ts` 新增 `colors.orange = #F59E0B`(设计稿 `--orange`)。
- 收藏心接的是真接口:登录后进页拉一次 `/user/favorite/list` 建集合,点击先改本地再发 `addFavorite/removeFavorite`,失败回滚;未登录点击跳 `Login`。
- 新增 `components/hotel/SortSheet.tsx`,按 Figma `Sort by` node `901:1673` 落地:**锚定在「Sort by」chip 下方 8px 弹出的卡片**(白底 / 1px `--divider` 描边 / 圆角 32 / padding 25 / 行距 20,行 = 20px 勾选框 + Inter 500/14 `--text-2`),背板是透明点击关闭区(设计稿无遮罩)。位置由 `measureInWindow` 量 chip 得到,取不到锚点时退到屏幕上方居中。六项即设计稿:mTrip Recommended / Lowest Price / Highest Price / Nearest Distance / Star Rating (High to low) / Top Guest Ratings → `default / price_asc / price_desc / distance / star / rating`。**Nearest Distance 走 `comingSoon` 不改排序**——后端 `distance` 要带 lat/lng,client-app 未接定位,没坐标时后端会静默回退成综合排序。选中态图标用主色(设计稿两态同为 `--text-2`,只靠内芯区分、辨识度太弱),文字色沿用设计稿。顶部栏筛选按钮复用 `HotelFilterSheet`;View map 与入住人选择仍走 `comingSoon`。
- 图标取舍:设计稿的 `fluent:arrow-sort-down-lines-16-filled`(Sort by)与 15px 地图图标暂用项目图标表里同体系的 `filter` / `map` 字形(`map` 本来就在 `HomeIcon.tsx` 的 TODO 顶替名单里),两处代码内已注明。
- 新增 i18n `hotels.results.*` 中英各 22 键(评价数插值用 `{{reviews}}`、避开 i18next 保留字 `count`)。门禁:`cd client-app; npm run typecheck` 零报错;`scripts/check.ps1` 因本机 `php` 不在 PATH 第 1 步即中断(与本改动无关)。

### ★ 2026-08-25(client-app 酒店详情 Overview,Figma `Hotel Details Overview` node `94:438`)

- 新增 `screens/hotel/HotelDetailScreen.tsx`(路由 `HotelDetail`,`headerShown:false`,页面自带悬浮顶部栏)。**当前是静态页**:所有数值与文案来自设计稿(`screens/hotel/detailDemo.ts` + i18n `hotels.detail.*`),**尚未接 `/goods/detail`**;路由参数 `{ id?: number }` 预留给接接口那一步,现在不传。搜索结果页的演示卡由 `comingSoon` 改为跳这里(演示卡 id 为负、没有真实商品)。
- 页面结构(自上而下):状态栏黑条(设计稿 `760:10037`,不随内容滚动)→ 图库 402x300 + 悬浮顶部栏(返回/提醒/分享,渐变自上而下主色 50%→透明,同搜索结果页)→ Main(px16 / 区块间距 24):标题卡 `703:3010` → 二级导航 `222:1216`(**吸顶**)→ 三宫格 `222:1421` → Hotel Location `361:1427` → Highlight `1671:2058` → Why Guests Choose `94:528` 三条 → 设施标签 `222:1355` 两行两列;固定底部价格栏 `222:2514` + 客服悬浮球 `1671:2310`。
- **吸顶用 `ScrollView` 的 `stickyHeaderIndices`**,所以二级导航必须是 ScrollView 的直接子节点 —— 设计稿 Main 的 24 间距改由各块自己的 `paddingTop` 承担,导航块另给页面底色(否则滚动时内容会从透明处透出来)。
- 新增 `components/hotel/HotelGallery.tsx`:整屏宽 `pagingEnabled` 横滑 + 底部渐变(`react-native-svg` 画,自下而上黑 60%→50% 处透明)+ 左下圆点条 / 右下张数胶囊。**设计稿计数写的是 `2/12`,但只导出了 3 张图**,页面按实际张数算,不硬写 12。设计稿的 `backdrop-blur` RN 无原生等价,只保留半透明底色(同搜索结果页顶部栏的处理)。
- 新增 `components/hotel/HotelDetailTabs.tsx`(泛型页签,横滑,选中项主色文字 + 2px 主色下划线)。**只有 Overview 有内容**,点其余五个页签走 `comingSoon`;See Map / 提醒 / 分享 / 客服 / Choose my room 同样走 `comingSoon`。
- **图标全部换成设计稿导出的 SVG path**(不再手抄):`HomeIcon.tsx` 新增 12 枚 —— `imageCopy / like / bed / food / share / chatFilled / bellOutline / locationOutline` 与四枚设施标签 `familyFriendly / breakfast / airportShuttle / pool`;并把 TODO 名单里的 **`map` 从 24 网格顶替替换为真字形 `fluent:map-16-filled`**(搜索结果页「View map」与 My Pick 预订卡跟着一起变准)。设计稿 40px 的 map/bed 与 20px 是同字形放大,复用同一条 path。`star / arrowLeft` 字形与设计稿一致,直接复用。
- **`HomeIcon` 新增 `width` / `height` 两个可选属性**(缺省仍取 `size`):四枚设施标签字形不是正方形(15.375x15 / 11.25x15 / 16.5x10.5 / 15x13.5),只传 `size` 会把它们拉成正方。
- 图库素材导出到 `assets/images/temp/hotel/`(3 张 512x512 PNG,已按 magic bytes 复核格式),引用走 `assets/tempImages.ts` 的 `TEMP_HOTEL_GALLERY`,登记在 `assets/images/temp/README.md`。
- 文案取舍:设计稿标题 `Highlight for your tirp` 是拼写笔误,词条按正确英文写作 `Highlights for your trip`(同筛选面板 Show Resluts 的处理);酒店名/地址复用搜索结果演示卡的 `hotels.results.demo.heritageBagan.*`(设计稿就是同一家酒店)。
- 新增 i18n `hotels.detail.*` 中英各 26 键。门禁:`cd client-app; npm run typecheck` 零报错;`scripts/check.ps1` 因本机 `php` 不在 PATH 第 1 步即中断(与本改动无关,本次未改任何 PHP)。

### ★ 2026-08-25(client-app 酒店详情其余五个页签,Figma `Hotel Details` node `759:9776`)

- 设计稿这个 section 下是**六张独立的稿**,共用同一套壳(图库 / 顶部栏 / 标题卡 / 二级导航 / 底部价格栏),只有 Main 里的内容列不同。落地成**一个页面 + 六个页签内容组件**,`HotelDetailScreen` 只留壳与 `renderTab()` 分发:
  Overview `94:438` → `HotelOverviewTab`(本次从页面里拆出来,内容未动)/ Rooms `222:1428` → `HotelRoomsTab` + `HotelRoomCard` /
  Amenities `222:2539` → `HotelAmenitiesTab` / **Nearby Attraction** `222:2758`(设计稿名 Hotel Details Location)→ `HotelNearbyTab` /
  Reviews `222:2978` → `HotelReviewsTab` / Policies `222:3189` → `HotelPoliciesTab`。二级导航的 `comingSoon` 拦截去掉,六个页签都能切。
- 六张稿反复用同一套卡壳(`--tab` 底 / 1px `--secondary` 描边 / 圆角 32 / padding 24 / Effect/DS 投影)与两三种标题字号,收敛到 `components/hotel/detailShared.ts`(`panel` / `panelPlain` / `sectionTitle` / `panelTitle` / `panelTitleDark` / `body` + `DETAIL_DIVIDER`),五个页签不再各抄一遍。
- **底部价格栏在 Rooms 页签隐藏** —— 设计稿 `222:2529` 是 `hidden` 的(每张房型卡自带 Select 按钮);页面的滚动底部留白与客服悬浮球位置都跟着这个开关走。客服悬浮球设计稿只画在 Overview / Rooms 两张稿上,但它是全局入口,六个页签都保留(唯一一处刻意偏离设计稿,代码内已注明)。
- 各页签落地要点:
  - **Rooms**:三张房型卡(封面 192 高,上压主色渐变条 = Bestseller 胶囊 + 收藏心,下压圆点条 + 右侧 360°/全景/张数三枚胶囊;正文为标题+余量胶囊 / 三格参数 / 上下夹分隔线的设施小格 / 价格 + Select)。设计稿页头有个 `Unit Sq Ft ⇄` 切换,但两种单位之间**没有换算依据**(设计稿自己 Standard/Deluxe 写 sq Ft、Family 写 sqm,数值也对不上),故单位按每张卡的原值展示、切换按钮走 comingSoon。360°/全景两枚按钮对应设计稿的 VR View / 3d View 二级页,未实现故走 comingSoon;设计稿只有前两张卡带这两枚,第三张只有张数胶囊,按 `DETAIL_ROOMS[].viewer` 区分。
  - **房型卡正文透底修正(2026-08-25 追加)**:正文那段原先不带底色、靠卡片那层的 `--tab` 透出来,封面图又是 `absoluteFill` 摆在只有定高、没有 `overflow:hidden` 的容器里 —— 一旦有东西漏出封面那 192,底部的划线价 /「/ night」这类浅色字就直接压在图上看不清。改成:封面容器加 `overflow:'hidden'` 且图片走正常流(`width/height:'100%'`,不再 `absoluteFill`),正文自带不透明 `colors.surface` 底色。顺带修掉渐变 id 的碰撞 —— 原先拿房型名派生 id(`name.replace(/\W/g,'')`),**中文名全是 `\W`、过滤后是空串,同屏三张卡撞成同一个 id**,改成由页签传 `gradientKey={room.key}`(稳定且是 ASCII)。
  - **房型卡样式二次校准(2026-08-25 追加)**,四处照导出资产改正:①收藏心两态设计稿都是**白色**(fluent:heart-12-filled / -regular),原先误用了 `colors.hot` 红;②参数行与设施行的**图标是实色 `#191A25`**(比同排 `--text-2` 文字深一档),原先跟文字同色;③设施行上下两条线取 Line 3 的实际描边 **`#D9E1FB`(= `--secondary`)**,不是通用的 `rgba(196,197,215,0.3)` 浅灰;④设施小格图标尺寸不统一(wifi 那枚 16、其余 20),改为随 `ROOM_FACILITY_ICONS` 的 `size` 走,不再在组件里按图标名硬判断。
  - **Amenities**:三张卡 —— 分组设施清单(ESSENTIALS / RECREATION / DINING 各 3 条)、`Stay Longer, Save More` 折扣阶梯(7/14/30/90 晚 → 5/10/25/40%,非当前档设计稿是 50% 透明度)、`Long Stay Benefits` 8 条(设计稿有三条用粗体,按原样保留)。前两块的标题复用了已有的 `hotels.stayLonger` / `hotels.nights`。
  - **Nearby**:标题行 + Get Directions、地图、交通耗时卡两条、景点横滑卡三张。**地图在设计稿里就是一张去饱和的静态截图**,项目未接地图 SDK,这里同样用静态图,点击走 comingSoon。
  - **Reviews**:总分 8.8(Inter 700/60)+ EXCELLENT 胶囊 + 评价数、Read All Reviews 描边按钮、四条维度进度条、AI Summary 两张引述卡(主色 10% / `--tertiary` #EC1317 10% 底)。**注意设计稿两套评分口径并存**:总分是 10 分制(8.8),维度分是 5 分制(4.9/4.8/4.6/4.7),进度按 5 分制折算 —— 按设计稿原样展示,接真实数据时要先统一口径。引文设计稿是 Inter Italic,`@expo-google-fonts/inter` 无斜体字重,同顶部栏积分那处的处理(`fontStyle: 'italic'`)。
  - **Policies**:页头大图 + 预订政策(取消 / 预付 / Taxes & Fees 提示块)+ 入住/退房两张纯白卡(时间 Inter 700/48,入住卡下方带分隔线与必备证件)+ 加床政策三行(免费绿胶囊 / 价格)+ 宠物政策 + 住店规则三张小卡。设计稿加床价写的是「Ks 35,000」,与底栏的「MMK」不是同一种写法,页面统一走 `formatMoney` + 站点币种,不硬写。
- **图标又全部换成设计稿导出的 SVG path**:`HomeIcon.tsx` 新增 33 枚(swapUnit / view360 / panorama / guests / bedSize / roomArea / locationRegular / parking / swimmingPool / arrowUpRight / airplane / temple / aiSparkle / thumbUp / thumbDown / wifiFilled / airConditioning / housekeeping / outdoorPool / spa / gym / restaurant / bar / coffee / bookingPolicy / checkInArrow / checkOutArrow / children / paw / propertyRules / noSmoking / quietHours / poolHours),并把 TODO 名单里剩下的 **check / heart / heartFilled 三枚 24 网格顶替换成真字形**(fluent:checkmark-12-filled / heart-12-regular / heart-12-filled)——**TODO 现在只剩 `motorcycle` 一枚**。设计稿 40px 与 20px 的 map/bed/food 是同字形放大,复用同一条 path,不重复入表。
- **设计稿的一处字形错配照原样保留**:房型卡设施小格第一格文案是「High Speed Wifi」,但设计稿给它配的节点是 `fluent:location-16-regular`(定位针)。按「图标一律用导出资产、不自己改画」的规矩原样用,图标名取 `locationRegular` 并在 `HomeIcon.tsx` 与 `detailDemo.ts` 都注明了,将来设计稿改了直接换 `ROOM_FACILITY_ICONS.wifi` 即可。
- 素材落到 `assets/images/temp/hotel/`:3 张房型封面 + 地图 + 政策页头(512×512 PNG)+ 3 张景点缩略图(**实为 JPEG,已按 magic bytes 复核并存成 `.jpg`**,128×128 对应 64pt 展示框),引用统一走 `assets/tempImages.ts` 的 `TEMP_ROOM_COVERS` / `TEMP_NEARBY_MAP` / `TEMP_ATTRACTION_COVERS` / `TEMP_POLICIES_HEADER`,并登记进 `assets/images/temp/README.md`。
- 演示数据全部进 `screens/hotel/detailDemo.ts`(房型 / 设施分组 / 长住阶梯与权益 / 交通与景点 / 评分维度 / 入退房 / 加床 / 住店规则),接 `/goods/detail` 时逐项替换即可,页签组件不动。
- 新增 i18n `hotels.detail.{rooms,amenityGroups,amenityList,longStay,nearby,reviews,policies}` 中英各约 100 键;同时把上一条里 `stats.starValue` 的插值键从 `{{count}}` 改成 `{{stars}}` —— **`count` 是 i18next 保留字会触发复数查找**,本仓库既有约定就是避开它(见搜索结果页的 `{{reviews}}` / 筛选面板的 `{{total}}`),新增词条一律遵守。
- 设计稿里另有几张**二级页**不属于页签,本次未实现:Rooms Details `281:1041`、Reviews Page `1133:2998`、Map Location `864:1775`、Property Preview `412:2023`、VR View `445:1555`、3d View `446:2011`。
- 门禁:`cd client-app; npm run typecheck` 零报错;`npx expo export -p web` 打包通过、11 张临时素材全部进包(验证产物已删)。`scripts/check.ps1` 因本机 `php` 不在 PATH 第 1 步即中断(与本改动无关,本次未改任何 PHP)。

### ★ 2026-08-31(client-app 注册页,Figma `Signup` node `505:1498`)

- 设计稿的 Signup 与 Login `505:1293` 是同一套壳(主色底 + 插画铺底 + 顶部栏 + logo/标语 + 白色表单卡 + 分隔线 + 三方登录),因此 `RegisterScreen.tsx` 直接沿用登录页的实测取值(插画 w150.41%/h46.55%/left-18.49%/top16.66%、Main pt68 pb20 px16、卡片 `--tab` 圆角 32 padding 24 gap 8、输入框 `#EFF4FF` 高 52 圆角 12 gap 16、CTA py16、三方按钮高 48 px31 描边 `--secondary`),不再重推一遍。
- 字段按设计稿改为四栏:手机号(+95 区号 + 竖线)、**邮箱**、密码、确认密码(后两栏各自带眼睛切换),下面是「I agree to the Terms & Conditions and Privacy Policy」勾选行(Inter Medium 12/17.5,正文 `#575E72`、链接 `#204DDA`)。**删掉了原注册页的昵称栏** —— 设计稿没有,且后端 `nickname` 为空时会落成「User+手机号后四位」。
- **GDPR 授权由隐式改显式**:原来「注册即视为同意」,现在必须勾选条款才能提交,勾选后成功注册再写 `setGdprConsent(true)`;原页尾那段 `user.gdprTip` 随之删掉(登录页仍保留)。
- 两处刻意偏离设计稿,代码内已注明:①设计稿 CTA 文案写的是「Login」(注册页上显然是笔误),这里用 `user.register`「Sign up」;②右上角链接用 `user.loginTitle`「Sign In」,与登录页右上角「Sign Up」对称。分隔线文案照设计稿仍是「OR LOGIN WITH」(复用既有 `user.orLoginWith`)。
- **邮箱栏后端接不上**:`user_info.email` 列在,但 user-service `AuthController::register` 只读 mobile/password/nickname/referralCode。故按「选填 + 填了才校验格式」处理,值照常经 `apiRegister({..., email})` 上送(后端忽略未知入参),`api/user.ts` 与页面注释都标了这件事 —— 后端补一行 `strInput('email')` 即可落库,前端不用再动。`userStore.register` 的第三参由 `nickname?: string` 改为 `{ nickname?, email? }`。
- 未实现的能力一律走 `home.comingSoon`:区号选择(固定 +95)、三方登录、Terms & Conditions / Privacy Policy 详情页。
- 图标只缺一枚:`HomeIcon` 新增 `mail`(fluent:mail-20-filled,viewBox `0 0 20 20`,path 取自设计稿导出的 SVG,未手抄);phone / lock / eyeOff / checkbox / checkboxIndeterminate / arrowLeft / chevronDown 与三方品牌标(`SocialIcon`)、插画/logo PNG 全部复用登录页既有资产,**没有新增图片素材**。
- `navigation/index.tsx` 给 `Register` 补 `headerShown: false`(与 Login 一致),否则设计稿自带的顶部栏会和 Stack 头叠两层。
- 新增 i18n `user.{emailPlaceholder,confirmPasswordPlaceholder,agreePrefix,terms,agreeAnd,privacyPolicy,invalidEmail,passwordMismatch,agreeRequired}` 中英各 9 键。
- 门禁:`cd client-app; npm run typecheck` 零报错(仅改 client-app,未动任何 PHP)。

### ★ 2026-08-31(client-app 开屏与首次语言选择,Figma `Splash` node `452:2190` / `2163:8057`)

- 设计稿这个 section 下是**两张同底稿**:`452:2190` 纯开屏(主色底 + 居中 logo + 底部两条波浪),`2163:8057` 在同一张底上加了标语与语言选择卡。落地成**一个 `screens/splash/SplashScreen.tsx` + 一个 `picker` 开关**,不做成两个页面/两条路由 —— 它在导航之前,由 `App.tsx` 直接渲染。
- `App.tsx` 改成三段状态机 `boot → language → app`,取代原来的 `LoadingView`:
  `boot` 期间跑 `bootstrapStores()`,并保证开屏**最少停留 `MIN_SPLASH_MS = 1200ms`**(引导比这快时补 sleep,避免 logo 一闪而过);字体没加载完也停在 `boot`(纯开屏没有文字,可以先出图)。
  语言已存 → 直接 `app`;没存过 → `language`。`StatusBar` 在非 app 阶段切 `light`(开屏是深底)。
- **语言优先级改为「用户手选 > 系统语言 > en-US」**。首次进入不静默套用系统语言,而是把系统语言作为**默认选中项**弹卡,按 Continue 才 `setLang` 落本地。`commonStore` 为此新增 `langChosen`(hydrate 时本地有值 / setLang 后置 true),这是「是否首次」的唯一判据 —— 不能用 `lang` 判,它有默认值 `'en-US'` 恒为真。
- 系统语言探测走**新装的 `expo-localization`**(`npx expo install`,SDK 51 → 15.0.3,已自动登记 config plugin),封装在 `utils/locale.ts`:按 `getLocales()` 的偏好顺序,先整标签精确匹配再按 ISO 639-1 语言码映射(en→en-US、my→my-MM、zh→zh-CN,简繁不分),整段 try/catch,取不到一律回落 `FALLBACK_LANG = 'en-US'`(原生模块在未重建的 dev client 里可能不可用)。
- **新增缅甸语 `assets/i18n/my-MM.json`,382 键与 en-US 逐键对齐(脚本比对 missing/extra 均为空)。⚠ 译文是机器生成的,上线前必须找母语者复核**;静态文案里的数字统一用阿拉伯数字(与插值进来的运行时数据保持一致,不混缅数字)。`SUPPORTED_LANGS` 扩为 `['en-US','my-MM','zh-CN']`(顺序 = 设计稿三行顺序),`i18n/index.ts` 注册第三份资源,`MineScreen` 的 `LANG_LABELS` 补 `မြန်မာ`。
- 顺带修了一处**拼接句在缅甸语里语序不成立**的问题:注册页的「I agree to the *Terms* and *Privacy Policy*」是四段拼接,缅甸语的「同意」必须落句尾,故新增 `user.agreeSuffix`(中英为空串,缅文为「 ကို သဘောတူပါသည်」),`RegisterScreen` 末尾多渲染一段。
- 另修 `SiteSelectScreen`:切站点原先无条件用站点默认语言覆盖当前语言,与「手选优先」的约定冲突(以前不明显,现在语言是用户开屏时明确选的)。改为**只在 `!langChosen` 时**才联动。
- **设计稿的国旗与文案对错了位**(第一行「Choose English」配的是缅甸国旗、第二行缅甸文配的是英美国旗),这里按语言正确配对(English→英美、မြန်မာ→缅甸、中文→中国),行序仍按设计稿。三面旗是设计稿导出的 PNG,落在 `assets/images/splash/flag-{en,my,zh}.png`;**logo 直接复用登录页的 `login/logo-badge.png`** —— 开屏 logo 框虽是 286×211,但内部图片的裁切比例(180.6% / 245.45% / -40.3% / -72.73%)与登录页 100×74 那枚完全一致,是同一张资产的不同尺寸。
- 波浪两条是 SVG,path 内联进 `SplashWaves`(白色 `fillOpacity 0.1`)。设计稿画布宽 402,组件按 `屏宽/402` 等比放大定位;第二条设计稿写的是 `rotate180 + scaleY(-1)`,净效果等于 `scaleX(-1)`,RN 里直接写后者。
- 语言行的文案**不走 i18n**(选语言时用户还没定语言,三行必须永远同时可读),用设计稿原文硬编码;标题与 Continue 则用 `t(key, { lng: selected })` 跟着当前选中项**预览**,点哪个语言就先看到哪个语言,但不改全局语言。
- 勾选框颜色照导出资产取:选中 `#4169ED`,未选 `#191A25`(注意与登录页「记住我」的未选态 `--secondary` 不同,这张稿就是深色)。
- `app.json` 的原生 `splash.backgroundColor` 由 `#1668dc` 改成主色 `#4169ED`,免得原生开屏与 JS 开屏之间闪一下色差。
- 门禁:`cd client-app; npm run typecheck` 零报错;`npx expo export -p web` 打包通过,三面国旗均进包(验证产物 dist 已删)。未动任何 PHP。

### ★ 2026-08-31(client-app 优惠中心,Figma `Promotion` node `1633:3300`)

- 设计稿这个 section 下有五张稿:`1325:2123` 优惠活动(3151 高的长页)、`1429:2110` 我的优惠券、`1625:2009` 券详情、`1626:3207` 使用说明弹层、`1627:3239` 领券成功弹层。落成 **「一个壳 + 两个页签内容组件 + 一个通用弹层」+ 独立的券详情页**:`PromotionsScreen`(顶部栏 + `PromoTabs` + 分发)/ `PromotionsTab` / `CouponsTab` / `PromoDialog`,券详情走新路由 `CouponDetail`。原 `PromotionsScreen` 是 `EmptyView` 占位,整页替换。
- **优惠券卡收敛成一个 `components/promotion/CouponCard.tsx`** —— 设计稿三段列表共 9 张卡加上「我的优惠券」里那张,全是同一张卡换数据:左侧 100 宽主色块(品类图标 + 大写文案,右边 1px 白色虚线)、右侧三行(券码 / 标题+副标题 / 有效期+按钮)、卡上下各嵌一枚 31 的圆形缺口。缺口在设计稿里是 `Ellipse 24`(纯色圆,填 `#EBF0FF` = 页面底色),代码里用 `View` + `borderRadius` 画并靠卡的 `overflow:'hidden'` 裁成半圆,**没有导出成资产**。卡按设计稿给了 `minHeight: 128`,内容比这矮时左色块靠它撑住等高。
- 角标三种配色照设计稿分开:新用户 → 主色、新用户专享/热门 → `--tertiary` `#EC1317`(= `colors.hot`)、限量 → `--orange`。按钮三态:Claim(主色白字)/ Use Now(同)/ Expired(无底色、`--text-2`、禁点)。
- 几张内容卡(活动概览 / 关于本活动 / 条款与条件 / 促销码 / 券详情)是同一套壳(`--tab` 底 + 1px `--secondary` + 圆角 32 + DS_AG 投影),连同两种标题、圆点列表、主色 CTA 一起收敛到 `components/promotion/promoShared.ts`,五处不再各抄一遍 —— 与酒店详情的 `detailShared.ts` 同一做法。
- **静态页**:后端没有活动/优惠券接口(marketing-service 与 payment-service 都没有对应路由),内容全部来自 `screens/promotions/promoSections.ts`(三段券 + 已领券 + 券详情 + 条款键序),文案进 i18n(`promotions.*` 中英缅各 78 键,三份仍逐键对齐、共 455 键)。交互:**「领取」按设计稿弹一次成功提示**,「立即使用」/ 促销码 Add / 券详情的 Use Coupon Now 一律 `comingSoon`;「Book Hotels Now」跳已有的 `Hotels` 路由;「Get More Coupons」切回优惠活动页签。
- 券详情的复制券码是真能用的:为此装了 **`expo-clipboard`**(`npx expo install`,SDK 51 → 7.0.x)。这是本次唯一新增依赖;不装的话这枚按钮只能退化成 comingSoon,与它旁边就是券码的场景不相称。
- 图标新增 8 枚进 `HomeIcon`(`calendar2` / `building` / `ticketDiagonal` / `ticketDiagonal20` / `clock` / `carProfile` / `checkmarkCircle` / `copy`),path 全部取自设计稿导出的 SVG。**`ticketDiagonal`(16 的字形)与 `ticketDiagonal20` 比例不同,不能互相顶替**,故分两枚入表;品类 Food 复用了已有的 `food`(同一 fluent:food-16-filled 字形的放大版),不重复入表。`copy` 是非正方(14.167×16.667),用 `width/height` 传。
- 素材只多了一张:活动横幅底图 `assets/images/temp/promotion/campaign-banner.jpg`(**Figma 返回的实为 JPEG,已按 magic bytes 复核改扩展名**,512×279 → 展示框 370×274),引用走 `assets/tempImages.ts` 的 `TEMP_CAMPAIGN_BANNER`,并登记进 `assets/images/temp/README.md`。横幅的图片裁切按设计稿折算成百分比(`137.4% × 129.9%`,偏移 `-18.7% / -26.8%`),这样任意屏宽下裁切一致。
- 两处补设计稿没画的东西,代码内已注明:①两张弹层稿是独立画板、**没画遮罩**,这里补了一层黑 25%(弹层浮在长列表上没遮罩分不清层级,取值与 App 其它半透明层一致);②横幅品类胶囊与设计稿一样要 6px 背景模糊,RN 无原生 `backdrop-blur`(未引入 expo-blur),只保留底色 —— 与登录页返回按钮同一处理。
- 导航:`PromotionsTab` 补 `headerShown: false`(页面自带「Promotion Center」顶部栏),新增 `CouponDetail` 路由同样关掉 Stack 头。
- 设计稿里另有几处**隐藏图层**未实现,属设计稿自身的备选:Tab Navigation 的第三个页签、Section - Filter Chips、券详情页的 Verification Status 浮条。
- 门禁:`cd client-app; npm run typecheck` 零报错;`npx expo export -p web` 打包通过、横幅图进包(验证产物 dist 已删)。未动任何 PHP。

### ★ 2026-08-31(client-app「更多」及其子页,Figma section `More` `1695:5951`)

- 用户给的链接是页面根 `0:1`(整张 Mobile 画布),不是具体屏。先用 `get_metadata` 列出页面下的 16 个 section,定位到 **`1695:5951` "More"**,其下 12 张稿 = 主页 + 7 个子页 + 4 个状态/变体。下次遇到只给 `0:1` 的链接可以照这个路子找。
- **主页 `1690:4642`**:`MineScreen` 整页替换(原来是一张自制设置页)。结构:mTrip 字标顶部栏 → 资料卡(头像 + 姓名/邮箱 + 编辑钮 + 会员胶囊行)→ 渐变钱包卡(余额 + Top Up)→ 菜单卡一(Account / Referral / Accessibility Mode 开关)→ 菜单卡二(Guide / About / Terms / FAQ / Rate this app)→ 版本号。
- **设计稿没有、但项目已有的功能没有丢**:多站点切换、多语言、GDPR 授权状态、订单入口这四项在设计稿里不存在,统一收进「更多」页**新增的第三张卡**(样式与前两张一致),下面跟一枚描边的退出按钮。语言行点开一个 `LanguageDialog`(复用开屏语言选择页的选项行样式),不再是原来那排小按钮。**这是本次唯一一处主动加内容的地方**,代码与文档都注明了。
- 8 个子页全部落地(`screens/more/*`,均新增 Stack 路由、`headerShown: false`):
  - **Account `1797:3913`** —— Personal Info / Account Security / Payment 三张分组卡。
  - **Travelers `1797:4324`** —— 「Select Guest (n/3)」选择卡,行内含编辑与勾选。
  - **EditEmail `1797:4630`** —— 注意这张稿的**图层名仍叫 Traveler,内容却是换绑邮箱**(复制页面时没改名),按内容命名为 EditEmail。
  - **Refer & Earn `1687:4120`** / **Referral Status `1690:5296`** / **How Referral Work `1690:5735`** —— 统计卡抽成 `ReferralStatsCard` 两页共用;明细卡的五格进度(邀请→注册→下单→入住→奖励)按 `doneUntil` 决定打勾 / info / 空心圆。
  - **Guides `2206:7544` + `2206:7891`** —— 两张稿是同一页的 Tutorials / Guides 两个页签,合成一页。
  - **LegalTerms `1697:7249`** —— 五节条款,第 3 节挂退款时间表(主色 10% 底)。
- **静态页边界**:后端只有资料(`/app/user/me`)与余额;钱包/充值、推荐码与推荐统计、教程内容、条款正文、性别/常住城市/换绑/常用旅客/银行卡/支付 PIN **都没有接口**。这些值取 `screens/more/moreDemo.ts` 的设计稿数据,动作一律 comingSoon;只有推荐码/链接的复制是真的(走已装的 `expo-clipboard`)。**注意 user-service 里其实有 referral 的写入侧**(注册时 `setupReferral` 生成本人推荐码、绑定推荐人),缺的只是查询侧的 App 接口 —— 补上 `/app/user/referral` 一类的读接口就能把这三页接活。
- 图标新增 21 枚进 `HomeIcon`(info / person / personSmall / personEdit / medalStar / wallet / wallet20 / plus / chevronRight / people / peopleAdd / accessibility / questionCircle / bookInfo / bookQuestion / shieldTask / shieldKeyhole / renameA / personQuestion / viewDesktopMobile / play),path 全部取自导出的 SVG。**几组同名不同字形的都分开入表**:`chevronRight`(7.4×12)与已有的 `chevronDown`(12×7.4)不是同一字形、不能靠旋转顶替;`wallet`(15.833×15)与 `wallet20`(20)、`person`(44)与 `personSmall`(16)同理。可复用的没有重复入表:Rate this app 用已有的 `star`、City Of Residence 用已有的 `map`、Traveler 的关闭叉与筛选面板的 `close` 是同一条 path。
- 素材只多了一张教程视频封面(`assets/images/temp/more/guide-thumbnail.jpg`,512×279 JPEG)。**Refer & Earn 的头图与优惠页活动横幅是同一张图(md5 一致),不重复入包**,`TEMP_REFERRAL_BANNER` 直接指向 `TEMP_CAMPAIGN_BANNER`。顺带记一条坑:该节点用 `get_design_context` 拿到的导出件是 709 字节的**空白 PNG**,真图要用 `download_assets` 取 `rawImages` —— 已写进 `assets/images/temp/README.md`。
- 三处刻意偏离,代码内已注明:①教程卡标题设计稿用 Plus Jakarta Sans,App 只装了 Outfit / Inter,用 Outfit 600 顶替,不为一处标题再引一套字体;②条款页尾部有一枚**未具名的 CTA**(`1697:7517/7520`,文案没标),含义不明,未实现 —— 这是只读的法律文本页,顶部返回即可;③版本号设计稿写死「Version 2.4.1 (Build 892)」,这里改成读 `config/global.ts` 的 `APP_VERSION`(= 1.0.0),不带 build 号(项目没有构建号)。
- 新增 i18n `more.*` 中英缅各 128 键,三份仍逐键对齐(共 583 键)。`utils/format.ts` 加了 `formatAmount`(只要数字、不带币种符号)—— 钱包卡与推荐统计卡把币种与数字分开排版,`formatMoney` 给不了。
- 门禁:`cd client-app; npm run typecheck` 零报错;`npx expo export -p web` 打包通过、教程封面进包(dist 已删)。未动任何 PHP。

### ★ 2026-08-31(client-app 通知页,Figma section `1770:3863`)

- 这个 section(设计稿里没具名,叫 "Section 9")下是**两张 Notification 稿**:`1685:3607` System 与 `1685:3881` Booking,只有列表内容不同,故落成一页 + 分段页签 `screens/notification/NotificationScreen.tsx`,路由 `Notifications`。顶部栏与「更多」子页同款,直接复用 `MorePageLayout`。
- 通知卡沿用全站同一套卡壳,只有三处自己的取值:标题 Inter 600/16(系统与「Booking confirmed」走主色,**「Booking Cancelled」走 `--tertiary` `#EC1317`**),正文用的是 **Outfit 600/16**(不是正文常用的 Inter,设计稿如此),未读点是 10 的主色圆压在卡右上(设计稿 `left340/top23`,换算成 padding 内的右上角)。未读点用 `View` + `borderRadius` 画 —— 导出件就是一个纯色 `circle`,没必要当资产。
- **顺手做了一次收敛**:这已经是同一枚 `Tab Navigation` 第四次出现(优惠中心 `1390:2921` / 推荐明细 `1690:5543` / 教程与指南 `2206:7881` / 通知 `1685:3610`,四处取值完全一致),抽成 `components/common/SegmentedTabs.tsx`;`PromoTabs` 改为薄封装,教程页与推荐明细页删掉各自的行内副本。样式值原样搬迁,视觉无变化。
- **静态页**:App 侧没有消息接口(只有 merchant-service 有商户通知路由,user / order 服务都没有),四条通知取 `screens/notification/notificationDemo.ts`;点卡片只做**本页面内**的已读态,不发请求。接口就绪后把 `NOTIFICATIONS` 换成列表返回值即可,组件不动。
- 首页与「我的精选」顶部栏的铃铛原先是 `comingSoon`,现在改跳通知页(未登录仍先跳登录)。
- 新增 i18n `notifications.*` 中英缅各 12 键,三份仍逐键对齐(共 595 键)。
- 门禁:`cd client-app; npm run typecheck` 零报错;`npx expo export -p web` 打包通过(dist 已删)。无新增素材与依赖,未动任何 PHP。

> 最后更新:2026-08-16(商户验证模块原型对齐整改 + 中英文国际化补齐,见下方「★ 商户验证原型对齐整改」)
>
> ⚠ 2026-08-20:此前基于 Figma 原型(stir-long v4.2.1)的商户管理整改已判定不符合正式 PRD(《mTrip_Super_Admin_Portal_PRD_Enterprise_v1.0_中文版.md》/《mTrip_Merchant App PRD_v1.0_中文版.md》),相关需求文档与整改清单已删除;商户验证与审批将按新 PRD 重新整改,方案见 docs/redesign/商户验证与审批整改方案.md。
>
> ★ 2026-08-20(最新原型 localhost:8443 v4.2.1):Merchant Verification 子菜单收敛为 4 项(Pending Review/Approved/Rejected/Resubmission),Onboarding 不再作为独立子菜单——已从 database/seed/02-menu.sql 删除 205 及其按钮 20501-20506 并 db-apply 落库,admin-web 验证页队列卡同步改 4 张并移除 onboarding 跳转;页面/接口/权限注解保留待重构。四个验证页共用「Merchant Verification & Onboarding」表格(行状态=入驻生命周期,含 Under Review/Waiting for Documents),下一步按附录「商户验证菜单调整」继续重构页面。
>
> ★ 2026-08-20(线索并入待审核):按用户要求,onboarding 业务移入「待审核」——菜单 201 component 改指 merchant/onboarding/index(/merchant-verify/pending 直接渲染原入驻页,可新增线索+看线索列表),页面级 perm_key 改 merchant:onboarding:list,原 20501-20506 按钮权限以 20111-20116 挂回 201(RBAC 三处对齐);202/203/204 仍用 merchant/verify/index。onboarding 页标题语义改「待审核/Pending Review」。详见整改方案附录。
>
> ★ 2026-08-20(四队列线索视图,按原型):用户确认「按原型做」后,201-204 四页统一为线索视角(component 全指 merchant/onboarding/index,路由末段决定队列 pending/approved/rejected/resubmission);新增 merchant_application.resubmit_required_at(16-merchant-onboarding-queues.sql,initdb 37-*)+ OnboardingController queue 过滤/queues 统计/resubmit-mark|clear(重交标记闭环,sendKyc/approve/reject 自动清除);前端四统计卡+业态/国家/关键词筛选+状态列(重交→Waiting for Documents)+抽屉要求重交/取消按钮,录入线索仅待审核页;接口冒烟通过+check.ps1 四步全绿。verify/index.vue 已不挂路由,保留作 merchant_info 验证工作台备用。
>
> ★ 2026-08-20(徽标+代码清理):侧边栏徽标接真实计数(SideMenu.vue 调 /merchant/onboarding/queues,仅待审核/重新提交两项显示,60s 自动刷新,计数 0 隐藏)。清理:删除 views/merchant/verify/index.vue 及 api/merchant.ts 中仅其使用的 apiVerify*(保留 apiVerifyDocReview 供商户文档页),verifyPage 词条修剪为在用 10 键;后端 VerifyController 接口与菜单 20101-20106 权限位保留(接口契约锚点)。数据库无冗余删除项。
>
> ★ 2026-08-20(阶段机 4→6 节点):按最新原型,入驻阶段改为 6 节点(新线索→已联系→已发送 KYC 信息→等待文件→审核中→得到正式认可)。stage 重映射:旧 4(Under Review)→5、5(Approved)→6(Officially Approved)、6(Rejected)→7,新增 17-merchant-onboarding-stages.sql(initdb 38-*)迁移;OnboardingController 队列口径 pending=1-5未重交/approved=6/rejected=7/resubmission=1-5已重交,updateStage 1-5,approve→6,reject→7,confirm→4(等待文件);StageSteps 6 节点+STAGE_MAP 七状态;冒烟通过+check.ps1 全绿。
>
> ★ 2026-08-20(抽屉二次校准):抓原型抽屉实测——阶段调整下拉为全量 7 项(选中 6/7 走通过/驳回弹窗);删除「要求重交/取消重交要求」按钮(原型无此按钮)及 resubmit-mark|clear 接口/前端 API/词条;Resubmission 队列口径改为 stage=4(等待文件),pending=stage 1,2,3,5;应用级 resubmit_required_at 列废弃(16 号改为不建列+新增 18 号清理脚本 initdb 39-*,存量迁移后删列);stage 6 英文节点=Approved。电脑重启后 11 容器恢复、DB 迁移/代码改动无损,冒烟+check.ps1 全绿。
>
> ★ 2026-08-20(操作列图标化):按原型 Actions 列实测,待审核/重新提交行操作改为 4 个 28×28 图标按钮(eye 查看 / check-circle 通过 / close-circle 驳回 / sync 发送提醒),已通过/已驳回仅 eye 查看;onboarding/index.vue 新增 rowRemind 行内提醒,操作列宽度 230→150;check.ps1 全绿。
>
> ★ 2026-08-20(线索档案字段):按最新原型,待审核表格 Merchant Name(商家名称)与 Business Name(公司名称)分列;新增 merchant_application.merchant_name/city/address(19-merchant-onboarding-profile.sql,initdb 39a-*);录入线索弹窗拆「商家名称*」「公司名称*」并增城市/注册地址;详情注册信息改原型 8 项(公司/联系人/手机/邮箱/地址/城市/国家/注册号);后端 create 写入新字段、index 关键词搜索加 merchant_name;冒烟+check.ps1 全绿。
>
> ★ 2026-08-20(详情 KYC 区块):按原型整改注册企业下区块——验证范围/企业类型/验证模板/所需文件文案对齐,所需文件加「模板名+份数」,提交文件表改 Document/Status(⚠ Awaiting review)/Uploaded/Actions(View/Approve/Reject);VerifyController::docReview 支持入驻阶段文档(merchant_id=0,时间线挂 application_id),documentDetail 同步;冒烟(verify→1/reject→3/时间线2条)+check.ps1 全绿。
>
> ★ 2026-08-20(详情 KYC 样式对齐):抓原型 computed style 逐项实现——验证范围改按钮组(12/600 #1664FF/#EEF4FF)、企业类型改胶囊行(11px 圆角20)、验证模板下拉 37.5 高、提交文件表头 10/700 #64748B(!important 覆盖 antd cssinjs)、View/Approve/Reject 彩色小徽章按钮、Send KYC/底部动作条/Add Note 对齐原型色值;playwright 数值化验证全部一致;check.ps1 全绿。
>
> ★ 2026-08-20(原型地址纠正+菜单恢复):客户确认最新原型为 https://stir-long-36886628.figma.site/(localhost:8443 整改作废)。实测 stir-long 侧边栏 Merchant Verification = Onboarding→Pending Verification→Resubmission→Approved→Rejected。恢复:02-menu.sql 5 菜单(205 Onboarding sort1 + 201 待验证/204 重交/202 通过/203 驳回 sort2-5,201-204 用 merchant/verify/index)+按钮 20501-20506/20101-20106;verify/index.vue 从 git HEAD 恢复(基础版)并适配 reject 为 reasonCode 1-9 下拉;api/merchant.ts 恢复 apiVerifyList/Detail/Approve/Reject(ReasonCode)/Resubmit;onboarding/index.vue 改回独立页(全量线索+阶段筛选+录入线索常显,移除队列逻辑);i18n 标题回入驻语义。DB 核对+前端实测+接口冒烟(reject reasonCode 命中 rejected)+check.ps1 全绿。
>
> ★ 2026-08-20(菜单更名+五状态卡片导航):菜单中文更名——201 待核实/Pending Verification、202 得到正式认可/Approved、203 已拒绝/Rejected(英文保持原型);新增共享组件 components/MerchantVerifyNav.vue(原型卡片样式:标签11px/500、数字26px/700主题色、32×3进度条、激活浅底+主题描边,计数 verify/queues,60s刷新),Onboarding 页与验证四状态页顶部接入,verify 页移除原 a-tabs;修复状态页白屏= vite dev 旧模块缓存(重启 vite --force);前端实测新菜单名+卡片导航+跳转正常,check.ps1 全绿。
>
> ★ 2026-08-21(入驻阶段回归四节点):阶段机改回 1 新线索/2 已联系/3 KYC访问权限已授予/4 KYC进行中/5 得到正式认可/6 已拒绝(21-merchant-onboarding-stages-v2.sql,initdb 39c-*,stage 5→4、6→5、7→6);StageSteps 四节点;「调整」下拉六项(选中 5/6 走通过/驳回弹窗),样式对齐原型(灰底 #F1F5F9/边框 #CBD5E1/圆角6/高24/11px 600);后端 updateStage 1-4、approve→5、reject→6、队列口径同步;冒烟+前端实测+check.ps1 全绿。
>
> ★ 2026-08-21(状态卡阶段配色+拒绝提示):详情状态卡顶部栏底色随阶段变化(1 灰 #F1F5F9/2 青 #ECFEFF/3 紫 #F5F3FF/4 琥珀 #FFFBEB/5 绿 #ECFDF3/6 红 #FFF1F3,同色系下边框,前三项用户指定其余按原型色板);stage=6 时隐藏步骤条改显红色提示框「申请已拒绝——入驻流程已结束」;前端实测六条线索全部符合,check.ps1 全绿。
>
> ★ 2026-08-21(详情区块调整):§2 注册信息改回公司信息 7 项(公司/集团名称、注册号、注册国家/地区、提交时间、企业数量、企业类型、商户 ID);§3 注册企业恢复手风琴表格(点击行展开业务提交详情:业态/联系人/城市/手机/邮箱,补齐 bizSubmittedDetails 等词条);§4 运营评估对齐原型 Operations Assessment——业务类别(多选)/操作员类型/企业数量/预计发布日期/内部备注,saveAssessment 传 businessTypes/numBusinesses;前端实测+check.ps1 全绿。
>
> ★ 2026-08-21(审批流程梳理+重交闭环):按 PRD 模块 11 五队列梳理完整流程——入驻中(线索4阶段)→入驻通过(onboarding approve)创建 merchant_info status=0 进入待核实 → 文档逐份核验(门禁)→ 需更正时 verify/resubmit 转重新提交(status=6,文档置需重交)→ 新增 verify/resubmit-received(确认商户重交:文档加 revision 回待审、status 6→0 回待核实)→ 全文档核验后 verify/approve 生成访问码(status=3)/或 reject(status=2)。前端重新提交页加 Resubmitted/Confirm Resubmission 按钮;完整流程冒烟全通+check.ps1 全绿。待核实列表空=无 status=0 商户(经入驻通过产生)。
>
> ★ 2026-08-21(入驻申请页数据范围):onboarding 页默认 queue=pending(后端 stage 1-4),仅展示入驻中线索(新线索/已联系/KYC访问权限已授予/KYC进行中),终态(得到正式认可/已拒绝)不再出现;实测仅进行中线索+check.ps1 全绿。
>
> ★ 2026-08-21(KYC 区块重构):删除详情抽屉「KYC 管理」栏与「KYC 文档」栏;企业类型/验证模板/所需文件联动移入注册企业表格展开区(行图标改圆形 emoji,复用 selectBiz/loadTemplates/pickTemplate);新增 KYC Submission Method 区块(Merchant Self-Service/Assist Merchant with KYC radio + Assist 按钮调 sendKyc);清理旧 KYC 样式约 330 行与废弃 script;实测无 KYC 管理/文档栏、展开区联动正常+check.ps1 全绿。
>
> ★ 2026-08-21(KYC 设置与访问布局修正):用户澄清后按 stir-long 原型重建——KYC 设置与访问为运营评估下方独立区块(当前选中企业卡片 → 验证范围按钮组 → 企业类型多标签 → 验证模板下拉 → 所需文件 → 预览要求/编辑模板/发送KYC请求按钮 → KYC 提交方法卡片[Merchant Self-Service/Assist Merchant with KYC]),随注册企业表格选中企业联动默认第一项;注册企业表格展开区移除 KYC 联动(恢复仅业务提交详情);从备份恢复 KYC 样式约 330 行+预览弹窗+setScope/previewOpen;实测布局齐全+check.ps1 全绿。
>
> ★ 2026-08-21(验证模板编辑):实现编辑模板——后端 OnboardingController::kycTemplateUpdate(权限 merchant:onboarding:kyc,POST /merchant/onboarding/kyc-template-update,名称/业态/docs JSON 数组校验);前端编辑模板弹窗(名称/业态/文档动态行[名称/类型/必填+删除]/添加文档),保存后刷新模板;清理 editTemplateTodo 占位词条;冒烟误写模板已用 22-kyc-template-restore.sql 恢复(幂等,未登记 initdb);接口+前端实测+check.ps1 全绿。
> ★ 2026-08-20(KYC Management 卡片切换):按原型将 KYC 配置下沉到业务单元级——新增 `database/merchant/20-merchant-business-kyc.sql`(merchant_application_business 加 kyc_scope/kyc_template_id,存量按业态回填首个启用模板,compose initdb 39b-*,已 db-apply);OnboardingController create 写入默认 scope=1、sendKyc 新增可选 businessId 同步业务单元 scope/模板(申请级字段兼容保留);前端详情抽屉 KYC 区新增 Registered Businesses 卡片列表(原型实测样式:左 3px 高亮边、选中 #EEF4FF+#1664FF、emoji 图标 30x30、名称 12/600、副行 10px #94A3B8、KYC 徽章复用 rb-badge),点击卡片切换 Verification Scope/业态胶囊高亮/模板下拉/所需文件(模板缺省取该业态首模板),scope/模板修改写回选中业务单元、发送 KYC 时随 businessId 落库;业态胶囊改只读联动;底部改原型三按钮(Preview Requirements 弹窗预览所需文件/Edit Template 提示规划中/Send KYC Request 加 SendOutlined),移除提交方式 radio(后端 submissionMethod 兼容保留,默认 1);KYC 标题行补盾牌图标(13px #94A3B8);新词条 previewRequirements/editTemplate/editTemplateTodo/registeredAt。冒烟(detail 返回业务级字段/sendKyc businessId 写入并回滚)+check.ps1 四步全绿。
>
> ★ 2026-08-20(抽屉清理冗余+控件校准):应用户反馈删除 §3 注册企业表格(与 KYC 区 Registered Businesses 卡片列表功能重复)及连带代码(openBizId/toggleBiz/手风琴展开/rb-table-card~rb-expand 样式/5 个仅该表格用词条/MenuOutlined+DownOutlined 引用),rb-badge 保留供 KYC 卡片徽章复用;KYC 区三控件按原型实测值校准:验证范围改一体式分段控件(外层边框包裹+内部分隔线+flex:1)、企业类型胶囊未选中文字改 #1A2332、验证模板下拉字重 400。vue-tsc 零报错+check.ps1 四步全绿。
>
> ★ 2026-08-20(KYC 布局单列+所需文件卡片):用户反馈三字段误排一行、所需文件未对齐——Browser 代理重测原型确认:字段每行一个纵向堆叠(间距 12px/控件 100% 宽/label 11px/600/0.55px 大写/Template label mb 4px),所需文件为灰底卡片(1px #E3E8F0+8px 圆角+#F8FAFC,标题行 #F1F5F9 底 8px 12px 含模板名与「N documents」,条目 8px 12px+绿勾 13px #059669+分隔线 #F1F5F9,原型无 Optional 标注);.kyc-grid 三列 grid 改 block 单列,所需文件与预览弹窗改 kyc-doc-card 卡片式,移除 ifApplicable 词条,胶囊未选中文字按实测改回 #64748B,模板下拉 padding 8px 32px 8px 10px。原型截图存 docs/kyc-management-section.png。vue-tsc+check.ps1 全绿。
>

> ★ 2026-08-22(待核实页国际化补齐):修复 `merchant/verify/index.vue`(待核实/重新提交/已通过/已拒绝四状态共用)中英文切换失效——根因是页面绝大多数文案硬编码英文,仅 common.* 少数走 t()。本轮将 `locales/en-US.ts`/`zh-CN.ts` 的 `merchant.verifyPage` 由 6 键扩至约 80 键(表格列/状态/类型/按钮/抽屉描述/文档表/时间线/底部动作/四类弹窗/提示语),zh-CN 全部中文;`STATUS_MAP`/`DOC_STATUS`/`TYPE_TEXT`/`REJECT_REASONS`(r1-9)改 `computed`+`t()` 随 locale 响应式刷新,columns/docColumns 及模板各处硬编码文案全部接入 t()。`vue-tsc --noEmit` 零报错 + `npm run build` 通过(仅原 chunk 体积警告,与本次无关)。

## ★ 商户验证原型对齐整改(2026-08-16)

对照 Figma 原型 stir-long v4.2.1(Merchant Verification)补齐 5 项差距,范围仅商户验证模块:

- **KYC 提交方式样式(2026-08-21)**:依据 PRD 模块 11 的“商户自助提交 / 协助商户完成 KYC”两种路径，已按 Figma 原型侧边栏实测改为双端布局：卡片 12px×14px 内边距、8px 圆角；左侧为 10px 大写灰色标题与 20px 高蓝色方式标签，右侧为 36px 高琥珀色描边协助入口。两个入口仍更新同一 `submissionMethod` 值，不改变既有 RBAC 与提交流程。
- **协助商户 KYC 侧边栏(2026-08-21)**: 点击“协助商户完成 KYC 流程”后，新增嵌套右侧抽屉，按 Figma 原型实现标题身份区、协助录入提示、企业信息表单、证件上传卡片、商户确认待办卡与固定操作栏。商户确认卡含待办状态、运营不可代确认提示和“发送确认请求”入口。当前仅提供视觉与布局，保存、文件选择、确认请求和提交验证尚未接入后端流程。
- **商户验证菜单微标口径修正(2026-08-21)**: SideMenu 微标统一改读 `VerifyController::queues`：入驻申请=进行中的 `merchant_application.stage 1-4`，待核实/重新提交=`merchant_info.status 0/6`，不再将不同流程的统计混用。父级“商户验证”微标为这三项待办之和，60 秒自动刷新保持不变。
- **全局 Drawer Footer 固定(2026-08-21)**: `admin-web/src/styles/index.less` 为 Ant Design Drawer 的 `.ant-drawer-footer` 设为绝对定位（bottom: 0），并让有 footer 的 body 独立滚动、预留 88px 底部空间，所有使用 `#footer` 插槽的底部操作栏不再随内容滚动；body 内的存量按钮不受影响。
- **入驻申请详情操作栏固定(2026-08-21)**: onboarding 详情抽屉原本置于 body 末尾的 `.drawer-footer` 已移入 `#footer` 插槽，保留原有权限控制、阶段判断与按钮行为，现与全局 Drawer footer 规则一致固定于底部。
- **入驻申请公司信息网格(2026-08-21)**: 公司信息前四项保持两列布局，企业数量、企业类型和商户 ID 拆入独立三列网格，确保三项始终同一行展示。

- **Onboarding 入驻流水线**:`database/merchant/09-merchant-application.sql`(merchant_application/business/kyc_template/note/verify_document_revision 5 表 + merchant_info access_code 等 3 列 + doc/timeline application_id,守卫式幂等 ALTER;已登记 compose initdb 29-*);`OnboardingController` 12 接口 `/api/v1/admin/merchant/onboarding/*`(权限键 merchant:onboarding:*);前端 `views/merchant/onboarding/index.vue`(菜单 205,component `merchant/onboarding/index`)。
- **凭证/驳回/重交/门禁**:approve 生成 `MTRP-{HOTEL|ATTRACTION|TRAVEL}-{6位}` access_code + channels(email/sms/inapp)写 timeline credentials_sent;reject 改 reasonCode(1-9 预置枚举)必填;文档重交新增 revision 行(Original vs Resubmitted 对比);存在 status=2 未核验文档时拒绝最终 approve;`regenerateCode` 仅已启用商户可用(权限 merchant:verify:regencode)。
- **验证记录**:db-apply 落库核验(5 表/9 模板/3 新列/菜单种子)、接口全流程冒烟全过(创建→指派→发KYC→转商户→门禁→逐份核验→approve出码→regenerate/reject/resubmit)、`check.ps1` 四步全绿。
- **国际化(2026-08-16 补齐)**:`views/merchant/onboarding/index.vue` 与 `views/merchant/verify/index.vue` 全量接入 vue-i18n;词条在 `locales/en-US.ts` 新增 `merchant.rejectReasons`(两页共用 9 项驳回原因)/`merchant.verifyPage`/`merchant.onboardingPage` 三个命名空间,zh-CN 同步提供全部中文翻译;页面内状态映射表/选项列表均改为 computed 以随语言切换刷新。
- **入驻阶段步骤条(2026-08-16,实测值对齐原型)**:新组件 `components/StageSteps.vue`,按浏览器实测 stir-long 原型精确还原:节点 24×24(激活蓝实心+8px 白芯/已过绿 #059669+白勾/未到 #F1F5F9 底+#CBD5E1 边+6px 灰芯),连接线 flex:1 高 2px #E3E8F0 对齐节点中心(已过段变绿),标签 9px 距节点 4px(激活 700 蓝/未到 500 #94A3B8);stage 5=全部完成,stage 6=全部置灰由 StatusTag 表达终态。onboarding 抽屉 §1 区重构为原型三段式卡片 `.onboarding-stage-card`(1px #E3E8F0 边+10px 圆角:灰底 #F1F5F9 状态行+步骤条区+信息行 4 列 grid,标签 10px/600 大写 #94A3B8,值 12px/600 #1A2332);原型截图留工作区根目录 `onboarding-drawer-top.png` 供对照。
- **公司信息分区样式(2026-08-20,原型实测值照搬)**:onboarding 抽屉 §2 Company Information 重做——标题行(BankOutlined 13px #94A3B8 + 12px/700/字距 0.84px 大写 #64748B + flex-1 尾部 1px #F1F5F9 装饰线) + 灰底卡片网格 `.co-grid-stack`(单元格 #F8FAFC + 1px #F1F5F9 边 + 6px 圆角 + 8px 12px,标签 11px #94A3B8/值 13px/500 #1A2332,行/列间距均 8px),布局 2 列×4 格 + 3 列×3 格 + 3 列×1 格(KYC);字段保留现有 8 项。后按原型类目定稿:注释集团/KYC 范围两项,新增「申请已提交」(app.submitted_at,新词条 labelSubmitted),业务类型按用户要求恢复置于企业数量后,最终 7 项=2 列×4 格(公司名|注册号、国家|提交时间) + 3 列×3 格(企业数|业务类型|商户ID)。随后 §3 注册企业分区标题同原型改造:MenuOutlined + 大写标题带个数 (N) + 尾部装饰线(zh 词条 registeredBusinesses 改「注册企业」)。随后 §3 表格按原型实测自绘重做并支持行展开:grid 六列(24px/1fr/120px/100px/110px/20px)圆角 8px 卡片表,表头 10px/700 大写灰底 #F8FAFC,行白底整行可点、展开态 #F0F9FF + 3px #1664FF 左条 + chevron 翻转,手风琴展开区(灰底,小标题 BUSINESS-SUBMITTED DETAILS + 3 列灰底卡片:业态/联系人/城市/电话/邮箱,复用 .co-cell);KYC 状态改小徽章;新增词条 bizSubmittedDetails/bizDetailBusinessType,移除无用 bizColumns/KYC_STATUS_MAP。注:业务表联系人列(contact_name/contact_phone 加密/contact_email)由 15-merchant-verify-rework.sql 补入;展开区曾误绑 contact_person 致不显示,已改绑 contact_name,detail 接口对 contact_phone 解密后明文返回(应用户要求不脱敏,入驻阶段需完整联系方式跟进;VerifyController 商户侧仍保持脱敏)。§4 运营评估文案与组件调整(应用户要求):操作员类型/预计发布日期(a-input 换 a-date-picker,value-format YYYY-MM-DD)/操作说明,en 同步 Expected Release Date/Operation Instructions。随后 §4 按原型实测重做样式:同 §2 标题行(SafetyCertificateOutlined 图标) + 斜体副标题「由商户运营人员填写」(新词条 opsAssessmentSubtitle) + 两列 grid(gap 10px)灰底控件(#F8FAFC/#E3E8F0/6px 圆角/12px,标签 11px/600 #94A3B8),操作说明三行 textarea 独占整行;原型无 Save 按钮,保留在标题行右侧小幽灵按钮;placeholder 同步原型文案(en: Add Merchant Operations assessment notes here…)。随后四队列统计卡按新原型(localhost:8443)实测重做:grid 四列 gap 12px、白底 1px #E3E8F0、8px 圆角、12px 内边距、无阴影、无 hover 反馈;标签 11px/500 #94A3B8(选中态 600+主题色) + 数字 26px/700 主题色(Pending #D97706/Approved #059669/Rejected #DC2626/Resubmission #2563EB) + 迷你进度条 32x3(轨道 #E3E8F0,填充按计数占比);当前队列卡浅色底(#FFFBEB/#ECFDF3/#FFF1F2/#EFF6FF)+ 0 0 0 1px 同色系描边阴影 + 标签行右侧 6px 主题色圆点;原型卡片不可点击,本应用保留点击切换队列功能(cursor:pointer)。随后搜索栏改用通用组件 SearchFilterBar(v-model 绑 query.keyword,v-model:filter-values 绑 sfbFilters,业态/国家两筛选,结果数摘要接 pagination.total;筛选变化自动触发重查,handleSfbSearch 同步筛选值到 query;移除原 a-form 搜索/重置按钮、SearchOutlined/ReloadOutlined import 与 useTable reset 解构;新词条 onboardingPage.resultCount=个结果/results)。随后顶部标题区与分页栏按新原型(localhost:8443)实测重做:eyebrow 11px/500/字距 0.55px 大写 #94A3B8→4px→主标题 18px/700 #1A2332→2px→描述 13px/400 #94A3B8,标题块与统计卡间距 20px,Export 改 34px 描边按钮(1px #E3E8F0/6px 圆角/13px #475569 + DownloadOutlined);分页栏重挂 a-table(class ob-pagination:灰底 #FAFBFC+上边框 1px #F1F5F9+12px 16px,左文案 12px #94A3B8 zh「第 1 – 6 条,共6条」/en Showing 1–6 of 6,新词条 paginationInfo 命名插值 {from}{to}{total};按钮 28x28 无边框 4px 圆角,当前页 #1664FF 白字 600,禁用 #CBD5E1,移除条数选择器/快速跳转,useTable pagination 页面级包装为 tablePagination)。
- **遗留边界**:merchant-web 商户端 KYC 提交/重交入口后续接;Send KYC/Reminder 仅写审计时间线,真实通知通道后续接;Marketplace Ranking/Impersonation/Notify/2FA/Commission Plan 不在本次范围。
- 详情:`docs/redesign/migration-plan.md` 进度表新增行 + `docs/redesign/gap-analysis.md` Merchant Verification 行已标注闭环。

## ★ 前端 redesign 进展(2026-08-14)

- **merchant-web 布局已按 Figma 原型(big-plank-58319748.figma.site)重构**:228px 白底全高侧边栏(mTrip/Merchant Logo → 主体切换器 → 分组菜单 → 底部 Logout)+ 56px Header(面包屑/搜索框/通知铃铛/用户下拉);多页签与暗色模式已移除;全局主色 #2563EB、背景 #F4F6FB、字体 Plus Jakarta Sans。详情见 [13-商家端merchant-web落地.md](./13-商家端merchant-web落地.md)「2026-08-14 布局原型化改造」章节。注意:`router/guard.ts` 三端同步规范中 merchant-web 已与 admin-web 对齐(均无页签),supplier-web 仍保留页签。
- 内容区业务页(商品/订单/门店等)未改造,仍为旧 antd 卡片风格;后续批次可逐页对齐原型。

## ★ 需求基准变更(2026-08-02,新会话先看这条)

**唯一真需求已切换为 `设计文档/mTrip_ Consumer App PRD_v1.0.md`**(缅甸 C 端酒店预订超级 App);旧三份 docx 仅框架期设计,现有 8 服务/54 表为可复用底座。
- 权威落地文档:[实现方案-ConsumerApp-PRDv1.0.md](./实现方案-ConsumerApp-PRDv1.0.md)(重新定基 + M0~M4 里程碑 + 建表 DDL + PRD 覆盖矩阵 + 遗留清单)、[差距分析-ConsumerApp-PRDv1.0.md](./差距分析-ConsumerApp-PRDv1.0.md)。
- **进度:在 `dev` 分支已实现 M0~M4 + admin 管理端,每增量 `scripts/check.ps1` 四步全绿;PRD 四层(数据/后端/C端/admin)整体闭环。三项架构级 A1 退款钱包化 / A2 Trip 多酒店 / A3 促销出资分账全部落地。**
- 遗留(非首发,均需第三方/产品决策):通知 Push/SMS/Email 多渠道分发、正式 Stripe/PayPal 收单(现 mock)、cops 页 i18n 词条、Phase2 AI/保险——详见实现方案文末「遗留清单」。
- 提交约定:本轮为逐增量本地 `check.ps1` 验收后由用户在 dev 分支统一 commit。
- **续作入口(下次开会话先看)**:[续作-ConsumerApp-下一步与提示词.md](./续作-ConsumerApp-下一步与提示词.md)(剩余待办 + 可直接复制的新会话提示词)。

> 下方第 1~7 节为旧三份 docx 期(框架层)的历史交接,作为底座背景保留。

## 1. 项目一句话

Mtrip 海外旅游 SaaS 平台:后端 Hyperf 3.1 微服务(backend/)+ 平台管理后台 Vue3(admin-web/)。**当前需求基准为 Consumer App PRD v1.0(见上方「★ 需求基准变更」)**;`设计文档/` 旧三份 docx 为框架期底座背景。

## 2. 当前进度(与 docs/plans/README.md 保持一致)

本任务最新进度：PRD模块12商户管理S0设计及S1～S4核心开发测试已完成；S5～S7尚未开始。S4真实扫码和完整UI、S3完整上传及模块11端到端未验，详见模块15计划及阶段交付报告；下表为历史底座状态。

**商户账号体系三期(2026-08-31)**:补齐平台对商户的三项管控,详见 [12-商家账号体系.md](./12-商家账号体系.md)「三期任务清单」。
- **功能模块授权**:新表 `merchant_module_grant` + `merchant_menu.module_key`(''=公共菜单)。可见性口径 ——
  商户**无授权行 = 全模块开通**(向后兼容,存量商户不受影响),有授权行则只见公共菜单 + 已授权模块;
  集团账号(account_type=1)恒不裁剪。裁剪同时作用于菜单树**和** JWT 里的 `permissions` 快照
  (`MerchantAuthService::applyModuleScope`,三处调用),只过滤菜单会留下越权接口。
  管理端保存授权后会 `auth_version + 1` 踢该商户全部账号下线以刷新快照。
- **内置角色预设**:补 `merchant_ops`(商户运营人员)/`merchant_cs`(商户客服)。
  **按 role_code 判存在插入,不硬编码自增 ID** —— 04 号种子里 1/2/3 是硬编码的,
  存量库的 4/5 很可能已被商户自建角色占用。
- **子账号配额**:`merchant_info`/`merchant_group` 加 `sub_account_limit`(默认 3,不含主账号),
  管理端在商户编辑表单配置,商户端 `GET /merchant/account/quota` 读取并在用满时禁用新增。
- 顺带修复 admin-web `views/merchant/account/index.vue` 商户下拉未预载(只在 `@search` 触发)导致恒为空。
- ⚠️ 本机(Linux)`php` 是 **PHP 7.x**,`php -l` 会把全仓 `match`/构造器属性提升/联合类型全部误报为语法错,
  **不能用作 lint 依据**;需在装有 PHP 8 的机器或容器内跑 `scripts/check.ps1`。

| 模块 | 状态 |
|------|------|
| 01 backend/shared 共享组件包 | 100%(单测于模块08-8 补齐:26 用例全过,修复 2 个 bug) |
| 02 system-service 系统服务 | 100% |
| 03 数据库 DDL + 种子数据 | 100%(两库 54 表,本机 MySQL 8.0.29 验收通过) |
| 04 admin-web 框架 | 100% |
| 05 管理后台系统页面 | 100%(14 页面,npm run build 零 TS 报错) |
| **06 业务微服务** | **100%(七服务全部完成,八服务 175 文件 php -l 零错误;Docker 联调归模块08)** |
| **07 管理后台业务页面** | **100%(07-1~07-6 全部完成,npm run build 终检零 TS 报错;接口联调归模块08)** |
| **08 部署与网关联调** | **部分完成 80%(权限键统一/deploy 基础设施/shared 单测/08-6 启动验证四步全过(2026-07-30);剩余 08-7 全链路联调,清单见 08 计划文件)** |
| 09/10 移动端 | 100%(09 三服务 C 端接口 / 10 client-app 全量落地;冒烟联调归模块08) |

各模块详细任务清单与完成记录:`docs/plans/01~10-*.md`;开发规范:`docs/guides/`。

## 3. 环境与操作注意

- Windows + PowerShell:命令分隔符用 `;`,**禁用 `&&`**。
- PHP 仅用于语法检查:`D:\BtSoft\php\80\php.exe -l 文件`(服务实际跑 Docker,联调归模块08)。
- 前端构建:cwd 必须在 `D:\GIT\jiaxu\MTrip\admin-web` 下执行 `npm run build`(vue-tsc + vite,要求零 TS 报错;echarts 已实际引用,chunk 约 522KB 属正常)。
- 数据库脚本目录是 `database/`(DDL 按服务分目录,种子在 `database/seed/`)。每个脚本**头部自带 `USE \`mtrip_xxx\`;` 且幂等**(`CREATE TABLE IF NOT EXISTS` / 守卫式 `ALTER`),可单独重复执行。
- **【硬约定】新增任何 `database/**/*.sql` 后,必须同步登记到 `deploy/docker-compose.yml` 的 mysql `docker-entrypoint-initdb.d` 挂载列表**,编号体现执行顺序(建表在种子前、被引用表在关联表前)。initdb **只在空数据卷首次启动时执行**——漏登记的脚本在全新环境永不建表(2026-08 曾漏挂 merchant 集团/RBAC 共 6 个脚本,导致 `merchant_group` 等表缺失)。
- **增量更新已跑起来的库,不必 `down -v` 重建**:脚本幂等,直接灌进运行中的容器即可。单文件 `Get-Content database/xxx.sql | docker exec -i mtrip-mysql-1 mysql -uroot -proot@2026`;批量用 `scripts/db-apply.ps1`(见「常用命令」)。只有想彻底清库重来时才 `docker compose down -v; docker compose up -d --build`。
- **【硬约定】新增一个「二级模块」路由(`/api/v1/{admin|app|merchant|supplier}/{模块}/*`)后,必须同步在网关 `deploy/openresty/conf.d/mtrip.conf` 对应的 `map $*_module $*_upstream` 里登记「模块 → 上游服务」**,否则网关命中 default `""` → 404(接口和服务都正常也白搭)。改完 `docker compose restart gateway` 生效。2026-08 曾漏登记 admin 的 `config`/`chat`、app 的 `theme`/`chat`/`marketing` 共 5 处。核对口径:各服务 `config/routes.php` 的 `addGroup` 前缀 / 路由第一段 ↔ 四张 map 的键。
- 遗留待用户手动删除:`d:\GIT\jiaxu\MTrip\.tmp-mysql-verify\` 临时目录。

## 4. 后端关键约定(模块06 必须遵守)

- 统一响应 `{code, message, data}`,成功 code=0;分页返回 `data={list,total,page,pageSize}`,入参 page/pageSize 默认20最大200。
- 错误码:40101/40102 未登录(前端跳登录)、40301/40302 无权限。
- 字段命名:**请求入参驼峰;列表行 snake_case 直出**(例外:管理员列表/登录返回/统计返回为驼峰)。
- 路由前缀:管理端 `/api/v1/admin/{merchant|goods|order|finance|user|marketing|payment}/*`;移动端双前缀方案见 `docs/plans/09-移动端微服务.md`。
- 新服务的工程组织、代码风格(Controller/Model/Service、#[Inject]、验证、软删除、操作日志)**以 backend/services/system-service 为唯一范本**,共享能力用 backend/shared。

## 5. 前端页面代码模式(模块07 必须沿用)

- `useTable(fetcher, defaultQuery)` → `{loading,list,query,load,search,reset,pagination}`;模板中**禁用 as 断言与 TS 类型标注**(需类型的回调放 script 定义具名函数)。
- 页面结构:`PageContainer` > 筛选 `a-card`(a-form inline)+ 列表 `a-card`;Tab 复合页单 a-card 内 a-tabs + `.tab-toolbar`。
- 多表格 Tab 页多次调 useTable,模板访问 `xxx.list.value / xxx.loading.value / xxx.pagination.value`(非顶层 ref 不解包)。
- 弹窗表单:`reactive form` + openCreate/openEdit(Object.assign)+ `editingId=0` 判新增;密钥字段编辑回显空串=保留原值。
- 高危操作 `a-popconfirm`;更高危用专用 Modal + 必填备注;`isSuper = userStore.profile?.isSuper === true`;StatusTag `:value/:map`;SiteTreeSelect 单选可 allow-all。
- v-for 动态编辑行 :key 用 indexOf,不可用可变字段。
- 动态路由:`router/dynamic.ts` 用 import.meta.glob 按菜单 component 字段解析 `views/{component}.vue`,菜单 seed 在 `database/seed/02-menu.sql` —— **新增页面目录必须与菜单 component 完全一致**。
- **多语言**(vue-i18n,默认/fallback 均 en-US):en-US.ts 为全量词条源,zh-CN.ts 只维护已翻译部分;菜单三字段 `menu_name`(中文)/`menu_name_en`(英文回退)/`i18n_key`(词条 key,目录与页面必填、按钮不占词条);显示名统一走 `locales/menuI18n.ts` 的 `resolveMenuTitle/menuTitle`(i18n_key 命中→t(key),未命中→非中文环境用英文名、中文用中文名);扩展新语言只需前端加语言包+SUPPORTED_LOCALES,菜单数据与后端零改动;详细规范见 `docs/guides/standards/README.md`。

## 6. 下一步(模块08 部署与网关联调,任务清单见 docs/plans/08-部署与网关.md)

商户账号体系三期下一步(2026-08-31,按优先级):
1. **先验库**:`select id,menu_name,perm_key,account_scope from merchant_menu where id in (200,201,202);`
   与 `select id,role_name,role_code from merchant_role;`。若为空,说明库建于二期脚本落地之前
   —— merchant-web「组织与权限」菜单看不到就是这个原因,按 12 号计划「升级说明」补跑脚本。
2. 增量执行 34/35/02-menu/06-role-preset 四个脚本,重启 merchant-service 与 gateway。
3. 在装有 PHP 8 的环境跑 `scripts/check.ps1`(本机 PHP 7.x 无法 lint,见第 2 节说明)。
4. 端到端验:管理端授权某商户只开"餐饮"→ 该商户主账号重新登录后应看不到「客房管理」「房量与价格」;
   子账号建到第 4 个应被配额拦截;新预设角色应出现在商户端角色列表且不可编辑(内置)。
5. 遗留决策见 12 号计划「遗留」节:restaurant 尚无专属菜单、运营/客服预设只覆盖商户账号类型、
   `MerchantService::approve` 尚未按入驻业态自动写入模块授权。

本任务下一步：用户审阅S4交付并补真实扫码和完整UI验收；下一开发阶段S5为酒店真实排名、消费者端展示和热门目的地。HEAD=232fd3e；S4不执行Git操作，之前的S3单次提交授权不延续。以下模块08内容为历史任务背景。

模块06/07 已收官,以下为沉淀的关键结论(模块08 仍需使用):

- **服务分工**:goods/order/user-service 已存在(C端接口,模块09预建),管理端接口在原服务内补充;merchant/finance/marketing/payment 四个服务新建。
- **端口**:system=9501、user=9502、goods=9503、order=9504、merchant=9505、finance=9506、marketing=9507、payment=9508。
- **业务服务代码风格**:Db::table 直查(不建 Model);管理端路由 `Router::addGroup('/api/v1/admin', ...)` 挂 AdminAuthMiddleware+OperationLogMiddleware;写接口加 `#[Permission('xxx:yyy')]`;入参驼峰、列表行 snake_case 直出;新服务骨架照抄 goods-service 配置模板改名改端口。
- **管理端基类范本**:merchant-service 的 AbstractController(pageSize 200 + applySiteScope/assertSiteScope + encryptField/decryptField),后续服务直接复用该模式。
- **库存机制**:goods_daily_stock + order-service OrderStockService(lock/deduct/release/refundRestore,变动写 goods_stock_log);退款到账确认全额退回补库存 change_type=4(部分退款不回补)。
- **重要陷阱**:order_main 无 sku_type 列,SKU 维度订单校验用 order_type(1酒店2门票)+sku_id。
- **骨架复制法**:新服务由 finance-service 整目录 Copy-Item 复制,删业务控制器后改6处差异:composer.json 名称描述、Dockerfile(名称/路径/端口)、bin/hyperf.php 注释、config.php app_name、server.php 端口、routes.php 整个重写。
- **payment-service 定位**:仅渠道抽象(app/Payment/PayChannelInterface)+ Stripe/PayPal 空实现 + 回调落日志应答 200;正式验签/收单对接归模块08;渠道配置 CRUD(sys_pay_channel)在 system-service。
- ~~**权限键错位陷阱**~~ ✅ 已于 08-2 解决:shared `Permission` 注解支持 `string|array` 多键任一匹配(`hasAnyPermission`),业务五服务 53 处注解键全改菜单种子 perm_key(83 键全部对齐 02-menu.sql)。共用接口双键:goods 酒店/门票 `['goods:hotel:x','goods:ticket:x']`、供应商结算 `['supplier:settle:x','finance:ssettle:x']`;提现审核/打款复用 `finance:msettle:confirm|pay`;order 备注降为页面级 `order:all:list`。
- **占位页策略**:router/dynamic.ts 的 resolveComponent 对未实现页面自动回退 views/wip/index.vue,无后端接口的菜单页(merchant/perm、supplier/report、user/level、user/log、finance/tax、marketing/activity|banner|points、verify/device|rule、order/export)不建文件。
- **统计接口(07-6 新建,联调需验证)**:order-service `GET /api/v1/admin/order/stats/dashboard`(大屏)、`GET /stats/report?dim=site|merchant|goods`(四维报表前三维);finance-service `GET /api/v1/admin/finance/report?year=`(财务年报);均只读无 Permission 注解;大屏口径:已支付=order_status IN(1,2,3)、待结算=settle status IN(0,1)、成功流水=flow_status=1;join merchant_info 时列名全限定(两表同有 site_id/created_at/deleted_at)。
- **EChart 封装**:`components/EChart.vue`(props option/height,echarts/core 按需注册 Line/Bar/Pie),页面用 `computed<EChartsCoreOption>` 构造 option。

待办顺序:

1. ~~模块06 七服务~~ ✅ / ~~模块07 业务页面~~ ✅ 全部完成(详见各计划文件完成记录)。
2. **模块08 部署与网关联调**(docs/plans/08-部署与网关.md):
   - ~~权限键前后端统一~~ ✅ 08-2 完成。
   - ~~deploy/ 目录~~ ✅ 08-3~08-5 完成:docker-compose.yml(MySQL 3307/Redis 6380/八服务/网关 8080,18 SQL 编号挂载)+ openresty/(map 路由表按 admin/app 二级模块分发、CORS 含签名头、限流 30r/s、错误 JSON)+ .env.example + k8s/ 预留;vite proxy 改指 8080。
   - **08-6 启动验证 ✅ 2026-07-30 完成**:Docker 29.6.2/Compose v5.3.1 就绪,按 deploy/README.md 第 4 节四步验证全部通过(11 容器全 Up、八服务 healthz ok、网关 **8081** 无签名 POST 返 401 符合预期、MTRIP_SUBMIT_* 注入生效),实际输出记录在 08 计划文件完成记录;**08-7 全链路联调待执行**(登录/CRUD/大屏 → 移动端冒烟 → ClientSignMiddleware 签名链路),完成后模块08 升 100%。启动指南:`docs/guides/setup/启动开发指南.md`。
   - **开发期热更新**:`deploy/docker-compose.override.yml`(compose 自动合并)已把本地 app/、config/、shared/src/ 挂载进容器,各服务日志挂出到 `deploy/logs/<服务名>/`(宿主机直查,已 gitignore);Hyperf 常驻内存,改代码后 `docker compose restart xxx-service`(约 2 秒)生效,仅新增 composer 依赖/改 Dockerfile 才需 `--build`;生产用 `-f docker-compose.yml` 显式指定跳过 override。详见启动指南 2.2 节;Windows 装 Docker Desktop/配 WSL2 见启动指南 2.0 节。
   - ~~shared 包单测~~ ✅ 08-8 完成:`backend/shared/tests/`(bootstrap 自加载+Hyperf 桩,无 vendor 可跑),`D:\BtSoft\php\81\php.exe backend/shared/tests/run.php` 26 用例/96 断言全过;顺带修复 CryptoHelper 空串解密边界(29→28)与 OrderNoGenerator 同毫秒碰撞(随机改自增序列)2 个 bug。
3. 每完成一阶段:更新 08 计划文件 checkbox、README 进度表、本文件。

## 7. 新会话接手提示词(用户复制粘贴用)

```
请先读取 docs/plans/HANDOFF.md 和 docs/plans/README.md 了解项目全部进度与约定,
然后读取 docs/plans/08-部署与网关.md。Docker 环境已就绪,请按其中「恢复联调清单」
执行 08-6 启动验证与 08-7 全链路联调,修复发现的问题。
工作方式不变:每完成一项任务同步更新 docs/plans/ 对应模块文件、README 进度表和 HANDOFF.md。
后端约定见 HANDOFF.md 第4节,前端模式见第5节,模块08 关键事项见第6节。
```
