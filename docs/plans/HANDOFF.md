# 会话交接文档(HANDOFF)

> 用途:当 AI 会话上下文超限需要新开会话时,新会话**第一步读取本文件**即可接手全部工作。
> 维护约定:每完成一个模块或阶段性节点,同步更新本文件的「当前进度」与「下一步」两节。
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
