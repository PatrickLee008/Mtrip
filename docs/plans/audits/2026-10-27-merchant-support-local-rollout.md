# Merchant Support 本地正常端口发布

2026-10-27 收尾：用户测试反馈本次功能基本正常，按要求清理本次 Support 的 38 张非必需验收截图（共 4,921,599 字节）及文档图片引用，保留文字验证记录与其他模块历史截图。本次功能代码、回归测试及文档整理纳入本地提交；未推送远端。最终 Support 隔离 HTTP 回归为 79 项，外部指南真实内容/播放仍待配置验收。

日期：2026-10-27。用户反馈 `http://localhost:8091/` 未看到功能，接续[实施记录](./2026-10-26-merchant-support.md)完成本机发布。本记录不代表远端发布或 Guide Hub 真实播放验收。

## 原因与结果

- 8091/8090 挂载的 `deploy/web/merchant`、`deploy/web/admin` 仍是旧产物，与新 dist 不同。
- 正常库没有五张 `merchant_support_*` 表及新权限菜单；标准迁移因遗漏 `20261015090000` 低于已应用最高 `20261015100000` 拦截。
- 备份、结构演练和真实补迁移后，标准脚本复核为 48 已执行、0 待执行。商户主/APP 双池、网关及两个 Web 已更新；正常登录态商户和平台入口均可见。

## 备份与迁移证据

完整备份为 `deploy/backups/mtrip-20261027-002520.sql.gz`，gzip、dump 完成标记及相关表已核对。恢复材料位于忽略目录 `deploy/backups/support-rollout-20261027/`，包含原账本、通知表、原行哈希、迁移校验值、带守卫的修复 SQL 及旧双端站点 `web-before.tar.gz`；这些材料可能包含正常环境数据，不纳入 Git。

遗漏的 `V20261015090000__add-notify-params.sql` 与 Git `a9b24d2` 完全一致，SHA-256 为 `2958726d517f807b6f2d35e3753347630c4e6569f1e33b4488c4b99f3919817d`。正常库实际缺少 `notify_record.params` 和 `idx_event_biz`；原 SQL 仅新增可空 JSON 及 `(event_key,biz_id)` 索引，与后续访客消息迁移独立。

在两次空结构克隆演练中，依次执行遗漏通知、Facebook 身份及 Support 三份原迁移，检查列/索引和五张工单表。克隆均已清理。执行前正常手机号/hash 歧义及空手机号/空 hash 预检均为 0。

正常库修复持有 `GET_LOCK('mtrip_schema_migrations',10)`，守卫初始 45 条账本、最高版本、无 running/failed 及目标版本未执行；记录真实 running 尝试后执行原通知 SQL，核对结构后标记 applied，执行者为 `local-support-out-of-order-repair`。原 45 条账本及 4 条通知行哈希完全不变。未修改历史 SQL 或标准顺序校验。

随后标准 `bash scripts/db-migrate.sh` 应用 `V20261021010000__add-facebook-user-identities.sql` 和 `V20261026100000__merchant-support.sql`。服务更新后再次 `--status` 为 48 已执行、0 待执行。Facebook 仅补齐迁移结构，未新增启用或 OAuth 配置。

## 服务与静态站

`deploy/mtrip.sh` 原 APP 列表遗漏 Compose 已定义的 merchant 孪生；补齐服务列表、9505 健康检查及输出，`scripts/auto-deploy.sh` 同步补齐 merchant 的双池展开。

通过 `bash deploy/mtrip.sh start merchant-service merchant-service-app --dev` 更新服务和网关，创建共享 `mtrip_support-private` 卷；两个商户容器的 `/opt/support-private` 均使用该卷。Compose 因初始化挂载变化重建 MySQL 容器，保留原数据卷，更新后迁移复核通过。`bash deploy/mtrip.sh health --dev` 验证 8 主服务、6 APP 实例及网关/转发全部通过。

两个 Web 重新构建成功，以 `rsync -a --delete` 发布到对应 `deploy/web/`，保留 `.user.ini`、`.htaccess` 和 `blank.html`。8091 `/support`、`/support/guides`，8090 `/helpcenter/merchant-tickets` 的实际 HTML/入口 JS 与磁盘产物一致。未登录接口返回预期 40101，说明请求到达正确鉴权路由。

`auto-deploy --dry-run` 因 macOS 缺少 `flock` 未执行预览，输出“已有一个 auto-deploy 在运行”；不将其视为验证通过。本次使用标准 wrapper 和既有静态站发布流程完成，无 Git 同步。

## 正常浏览器验收

使用 Chrome 中既有登录态，只读检查正常端口；创建表单仅打开后取消，没有提交。

| 页面 | 结果 |
| --- | --- |
| 8091 `/support` | 系统 → 支持与帮助，与访客消息独立；四卡、筛选、工单表和创建入口可见；正常库无工单，如实显示 0 和空态 |
| 创建工单 | 分类、优先级、主题、描述与私有附件控件可见，已取消 |
| FAQ | 已发布来源可读，当前无匹配的已发布问题，显示真实空态 |
| 合规 | 评分暂未配置；当前规则、违规、警告与申诉按正常数据展示空态 |
| `/support/guides` | 统一指南入口可达，显示“商户指南服务待配置。” |
| 8090 `/helpcenter/merchant-tickets` | 帮助中心 → 商户支持工单，四卡、筛选与真实空表正常显示 |
| 浏览器控制台 | 本轮双端检查未捕获 error |

商户页面已返回 `/support` 并保留打开。

## 验证范围与后续

本轮两个 Web build、wrapper 脚本语法、diff 空白、迁移状态、标准 health、发布产物及正常登录态只读页面均已核对。此前实现的 Support 隔离 HTTP 71 项、访客消息 36 项和质量基线结果见原实施记录；本轮未重复执行隔离业务回归。

Guide Hub 真实商户内容/分类/搜索/播放仍依赖服务端安全配置与已发布内容，A12 不计完成。正常端口工单/通知深链写入闭环未用真实账号提交；隔离库已有双端闭环证据。未创建正常库 Support 工单或通知，未改账号授权、物业状态或外部服务；未提交、未推送。

回退时保留新增工单及历史数据，优先恢复旧静态包或受控关闭入口；数据库恢复须独立评估备份后的新增数据，禁止用删表回退。

## 后续组件样式修复

用户截图指出输入框与搜索按钮不等高。浏览器复现为外层搜索框 44px、内层输入框最小高度 34px、按钮 32px；根因是全局输入框最小高度叠加 affix wrapper 内边距，以及搜索组合的 table 布局基线偏移。

新增仅限 `.support-controls` 的样式，覆盖工单、FAQ、合规、指南及 Support 弹窗/抽屉，消除内层重复控件外观，搜索组合改为 flex 并修正拼接圆角；普通按钮统一 34px，大按钮、文字按钮及多行文本保留各自尺寸。侧栏将 `/support` 的设计图标映射为 `QuestionCircleOutlined`，菜单种子同步修正；既有菜单数据无需改库即可正确显示，已应用迁移文件未修改。

Merchant Web 的 `vue-tsc --noEmit` 与 production build 通过，重新发布至 8091。正常登录态 DOM 实测：四处搜索组合/按钮均 34px，筛选下拉框同高且顶边一致；创建弹窗输入框、下拉框、附件及取消/提交按钮均 34px，五行描述框约 108px。只打开并取消表单，无业务提交。发布前旧包保存为 `deploy/backups/merchant-before-support-controls-20261027.tar.gz`。

## 回复按钮与表格底部样式复核

空回复的发送按钮实际处于 disabled 状态，全局 `.ant-btn-primary` 的强制蓝色背景覆盖了组件禁用色；Support 局部统一主按钮/普通按钮禁用态为 `#e2e8f0` 背景、`#475569` 文字，启用主按钮保持蓝底白字，同时覆盖相同规则影响的提交、附件与加载更多入口。

工单表格的 `.table-card` 与全局 `.ant-table-wrapper` 同时绘制边框，外层另有 8px 底部 padding。移除冗余外层和相应样式，仅保留已有表格外框。8091 正常账号的实际分页栏底边与表格外框仅相差 1px 边框，无原先额外 9px 包裹区域。

当前正常工单已解决，未为样式验证重新开启。临时无接口样式页复用项目实际 Vue/Ant Design 组件和样式，以合成表格验证空态/分页，以本地输入草稿验证发送按钮 disabled → enabled：禁用时灰底深色文字，启用时 `#2563eb` 背景和白色文字；没有执行发送或修改正常工单。临时页面/服务已移除。Merchant Web 类型检查和 production build 通过，8091 静态包已更新，实际页面无 console error；旧包备份 `deploy/backups/merchant-before-support-button-table-20261027.tar.gz`。

## 工单分页对齐预订管理

2026-10-27，按用户反馈对照现有 `/order` 预订管理分页，实现相同的紧凑布局：统计居左、页码居右，关闭每页条数下拉框及快速跳转；统计文案为「显示当前条数 / 总数条工单」，补充英文翻译。分页仍为现有每页 20 条，查询和翻页回调保持原逻辑，样式仅作用于工单表。

8091 正常登录态逐项对比预订管理和支持工单：分页栏均 52px，页码均 24px、5px 圆角，统计文字均 11px、`rgb(123, 132, 149)`；统计位于左侧，单页前后箭头禁用，每页条数选择器已移除。当前真实工单 1 条，显示「显示 1 / 1 条工单」，没有新增或变更工单数据；未制造多页测试数据。修复后浏览器无新增 error。

Merchant Web 类型检查及 production build、质量基线（PHP lint 447、shared 150/1248、admin build、client typecheck）通过；构建保留既有 bundle 体积提示。发布到本机 8091，实际 index 与构建产物一致；旧包备份为 `deploy/backups/merchant-before-support-pagination-20261027-020317.tar.gz`，未提交或推送。

## 工单侧栏对齐 Figma

2026-10-27，按用户要求整改工单侧栏。通过 Figma 桌面应用实际 Inspect 主节点 `3193:28647` 与侧栏 `3193:29462`，对齐 585px 宽、12px 外圆角、`#E2E8F0` 边框；四项信息卡为创建时间、更新时间、客服、分类，背景 `#EBF0FF`、padding 10px、7px 圆角。创建人及物业保留为辅助上下文，未改用户此前保留的列表筛选区。

商户消息在右，背景 `#4169ED`、白字、圆角 `10px 3px 10px 10px`；支持消息在左，背景 `#D9E1FB`、圆角 `3px 10px 10px 10px`。气泡 padding 10px 14px、字号 12.5px、行高 20.313px；头像、支持人员名称、气泡外时间与附件按原型排列。原始描述作为首条商户消息，用户允许的对话记录/活动时间线页签继续保留。

回复区放在抽屉 footer，回复框 80px、普通操作按钮 34px，依次为发送、附件、关闭；终态按既有权限展示提示及操作。局部覆盖全局 drawer footer 绝对定位与灰底、textarea 背景，实测正文底边与 footer 顶边一致，没有遮挡。源码仅修改 `merchant-web/src/views/support/components/TicketDrawer.vue` 与 `merchant-web/src/locales/support.ts`，未改后端、权限或工单状态规则。

隔离验证页使用真实组件/项目样式及内存合成工单，仅提供只读模拟 GET，其他操作返回 405，不访问正常后端。验证中英桌面/375px、长文本/文件名换行、禁用灰底深字和可用蓝底白字、关闭态不显示回复框、页签切换保留草稿；没有提交回复。临时三个 QA 文件、15174 服务和浏览器验证页均已清理。

Merchant Web 类型检查与 production build、admin build、client typecheck、PHP lint 447、shared 150 用例/1248 断言通过，保留既有 bundle 体积提示。静态包已发布本机 8091，index 与 dist 核对一致；旧包备份 `deploy/backups/merchant-before-support-drawer-20261027-023857.tar.gz`。正常商户登录态打开已解决工单，三条消息颜色/方向及六项活动正确，585px 宽和底部布局正确，本轮无新增 console error。实际工单未发送回复、上传、关闭或重开；未提交、未推送。

## 创建工单附件上传框对齐 Figma

2026-10-27，用户指定创建表单 Figma `3047:20646`。实际通过 Figma 桌面 Inspect 上传框 `3047:20680`，核对高度 72px、圆角 8px、1.6px dashed `#E2E8F0`；内容容器 `3047:20681` 居中、8px 间距，上传图标 15px。

仅修改 Support `index.vue` 与 `locales/support.ts`：原小按钮改为整行 Ant Upload Dragger，白底虚线框内居中放图标、点击/拖拽提示与格式/大小说明，补选填标签；上传中显示旋转图标并禁用，保留五个附件上限、10MB、原文件类型/作用域校验与上传回调，已有附件标签可移除并支持长文件名换行。样式局部作用于创建表单，移除因本次替换而无引用的旧 `.file-hint` 样式。保持单文件处理，未扩大为批量上传。

商户 build（含 vue-tsc）、admin build、client typecheck、PHP lint 447、shared 150/1248 通过；仅有既有 bundle 体积提示。备份旧站点为 `deploy/backups/merchant-before-support-upload-20261027.tar.gz`，静态包已发布 8091，index 与 dist 一致。

8091 正常商户登录态只打开/关闭空白创建表单，未上传文件或提交工单。桌面中英内容单行显示，上传框实测 492×72px、8px 圆角、白底；1.6px 指定边框经浏览器像素舍入实测 1.5px，垂直中心偏移为 0。375px 使用临时同站点 iframe 嵌入实际 8091 页面检查，提示/格式自动分两行、无可见溢出，上传区保持 72px。英文已切回中文，临时页/服务已清理；本轮未新增持久测试或正常业务数据，未提交/推送。

## 平台工单状态入口区分

2026-10-27，用户反馈平台工单详情中两处状态选择混淆，并确认调整。原上方是单独变更状态，下方是回复携带的目标状态；两者都初始选中等待商户回复，上方又未显示为待操作目标，容易与顶部实际状态混淆。

仅修改 `admin-web/src/views/helpcenter/merchant-tickets/TicketDrawer.vue` 与 `admin-web/src/locales/support.ts`：

- 上方标注“变更工单状态”，初始显示“请选择目标状态”，空值保存禁用且处理函数拦截，保留原因必填；说明“仅修改工单状态，保存时需填写原因。”
- 下方标注“回复后状态”，默认等待商户回复；说明“发送本次回复时同步更新工单状态。”
- 切换工单或重新打开清空单独目标、恢复回复默认；单独状态变更成功清空目标，回复成功恢复回复默认。原因弹窗标题同步明确为变更状态。
- 补齐中英翻译、输入标签关联与窄屏换行；顶部真实状态、权限键、API 参数及后端状态矩阵未改。

临时验证页复用真实 Vue 组件、项目样式和权限指令，所有工单读写使用内存替身；网络 `/api/` 返回 405，不连接真实工单。实际操作验证：初始上方空值/保存禁用、下方等待商户；选择上方后请求仍为空；未填原因不提交；填写后仅产生 status 请求并清空目标；下方选择处理中并发送合成回复，仅产生 reply 请求，携带该状态并恢复默认；两处选择不同值后切换新工单，均恢复预期初值。中英桌面及 375px 显示正常，无 console error。四个临时 QA 文件、15176 服务及标签已清理，未新增持久测试。

质量基线通过：admin build（含 vue-tsc）、client typecheck、PHP lint 447、shared 150 用例/1248 断言；既有 bundle 体积提示保留。备份 `deploy/backups/admin-before-support-status-labels-20261027.tar.gz` 后发布到本机 8090，静态 index 与 dist 相同，浏览器实际加载 `/assets/index-Bmqiq_kf.js` 与本次构建一致。

8090 当前登录态已过期，停留账号登录页；未填密码、改授权或操作实际工单。正常登录态详情复验仍需用户重新登录，不将隔离组件验证记为真实工单验收。未提交、未推送。

## FAQ 对齐 Figma

用户指定 [Figma 3047:20149](https://www.figma.com/design/fsK2rrl2sadcowrxspvGV8/mTrip_Merchant?node-id=3047-20149&m=dev)。桌面 Figma 实际查看 FAQ 帧，并 Inspect 分类组件 `3047:20286`（1244px 宽、50.6px 高、12px 圆角、0.8px `#E2E8F0` 边框、白底）；交互细节同时参照仓库设计源 `UI设计/Hotel Merchant Dashboard/src/app/screens/SupportScreen.tsx` FAQ 分支。

修改仅涉及 `merchant-web/src/views/support/components/SupportResources.vue`、`merchant-web/src/locales/support.ts`：

- 原分类侧栏改为全宽分类卡片，左侧问号、名称/真实数量，右侧展开箭头；同一时刻展开一个分类，内部问答可分别展开。
- 初始取真实分类，展开时通过既有 `faq/list` 按 categoryId 查询，每页 20 条，保留分页；使用既有请求代次丢弃过期返回。
- 搜索框改为左侧搜索图标、320px 宽的白底输入，按 Enter 提交；搜索结果展示接口返回的 category_name，清空恢复分类。没有按设计示例造文章或计数。
- 蓝色帮助条加信息图标、边框及带加号的创建工单按钮，保留原权限指令和 create 事件；帮助文案沿用已确认内容，未增加服务时效承诺。
- FAQ 专属 CSS 不改变合规分支。FAQ 搜索框和帮助按钮最终生产实测均 40px（内 input 38px），分类按钮 50px、分类间距 16px。白底输入、蓝底白字按钮无低对比问题；375px 将数量及帮助按钮换行，避免挤压文案。

临时隔离页复用真实组件、全局样式、Support 控件样式、Pinia 和权限指令；内存替身提供 25 条合成文章，所有 /api/ 请求拦截为 405。验证分类 20+3 分页、切换/搜索后第一页及折叠状态重置、搜索单条/无结果/清空、英文计数/中文计数、空分类、失败提示、无脚本答案文本和创建事件；桌面及 375px 布局可见，console error 为空。共享合规分支正常显示原规则空态。未写正常库。五个临时文件、15177 服务及验收标签均清理。

质量基线通过：merchant build（vue-tsc+Vite）、admin build、client typecheck、PHP lint 447、shared 150 用例/1248 断言。构建只有既有体积提示；本轮触及文件无新增空白错误（仓库整体 diff-check 仍报告原有 admin-web 翻译 CRLF 行）。

备份 `deploy/backups/merchant-before-support-faq-20261027-1032.tar.gz` 后更新本机 8091，静态 index 与 dist 相同，浏览器实际入口为 `/assets/index-DN-ye-T2.js`。正常登录态真实“测试分类”2 篇文章可以展开，搜索“常见问题1”只返回对应文章，清空回分类；生产测量确认 40px 搜索/按钮，无 console error。保留已有业务数据，未创建或处理工单，未改后端、迁移或提交/推送。

## 平台工单统一保存与气泡对话

### 根因与行为

原后台抽屉将客服、优先级、状态分别保存；用户同时选择后点击状态旁保存，实际 payload 只有 status/reason，未提交的客服会被刷新结果覆盖。状态成功后又主动清空 targetStatus，导致下拉不能回显真实状态。此前仅更改两个状态入口的标签没有消除交互歧义，本轮按用户要求用统一保存及一个状态下拉替代。

- 平台 `TicketDrawer.vue` 统一提交已修改的客服/优先级/状态，修改状态时先填写原因。初值和成功后下拉同步真实值；轮询保留未提交字段，不清空回复草稿，离开抽屉保护处理草稿，冲突后回读服务端。
- 删除“回复后状态”下拉与重复关闭按钮；发送回复采用既有服务默认 waiting_merchant，关闭在唯一状态下拉选择 closed 后保存，已解决/关闭仍须显式重开才能继续处理。
- `SupportTicketService::change()` 仅对管理员 assign/priority/status 接收组合 assigneeId/priority，附加字段逐个检查原权限、站点和有效值；沿用既有事务、幂等请求、行锁、expectedVersion，同一事件记录全部变化。没有新增接口、权限、表或迁移。
- 对话从平铺卡片改为气泡：商户左侧浅蓝、客服右侧蓝底白字，原始问题作为第一条消息；头像、发送人、时间、长附件下载和活动页签保留。局部控件 34px、回复框 80px，禁用主按钮灰底深字。

### 验证

先在 `test/support/integration.py` 增加组合保存断言；旧实现真实失败于 `combined save persists assignee priority and status in one version`，证实接口只保存状态。修复后完整隔离 HTTP 79 项通过，新增 8 项覆盖三字段同时持久化/单次版本、幂等重试、事件变化、无效跨站客服回滚、无效优先级回滚、附加指派/优先级权限、指派+优先级不改现有状态。测试只复制正常库结构并使用合成数据，独立数据库用户/库/容器/文件均自动清理。

临时内存 API 替身复用真实 Vue 抽屉、Pinia、权限指令、管理端主题与全局样式，真实 /api/ 全部屏蔽为 405。验证初始回显、仅一个状态下拉、一次 status 请求同时含 assigneeId/priority/status/reason、空原因不提交、成功后保留选择且无修改时保存禁用、外部版本更新后保留未提交选择、保存优先级保留回复草稿、回复 payload 不含第二状态且成功后显示 waiting_merchant、409 冲突回读、切换工单、中英及 375px。气泡/附件无横向溢出，控件/保存/附件/发送按钮均 34px、回复框 80px，禁用按钮 #E2E8F0/#475569；无 console error。六个临时文件、15178 服务及两个临时验证标签已清理。

质量基线：admin build（含 vue-tsc）、client typecheck、PHP lint 447、shared 150/1248 通过；保留既有 bundle 体积提示。

### 本机发布

备份 `deploy/backups/admin-before-support-editor-20261027-1055.tar.gz` 后发布到 8090；静态 index 与 dist 相同，浏览器入口 `/assets/index-BJ8zIFzv.js` 一致。使用 wrapper restart 更新 merchant-service 与 merchant-service-app，8 主服务/6 APP 实例/网关健康全部通过。

原用户标签留有未提交原因弹窗，未刷新或提交，在新标签只读核验正常工单 2。服务器实际客服未指派/高优先级/处理中，下拉、顶部、列表一致；对话包含初始问题及三条历史回复，方向/颜色/附件均正确。生产实际控件均 34px，仅一个状态下拉，无旧 reply 状态下拉，无横向溢出和 console error。未更改正常工单、客服或回复，实际写入仅在隔离数据验证；用户可刷新旧页后重新选择并保存。未提交/推送。
