# 会话交接文档(HANDOFF)
### ★ 2026-09-21(client-app 邀请码接后端:Refer & Earn 三页脱离假数据 + 奖励金额补种子)

client-app 推荐三页此前整页读 `screens/more/moreDemo.ts` 的设计稿常量(推荐码写死 `MTRIP-8D7H92`、统计写死 5/2/3),
而后端 `/api/v1/app/user/referral/my|invitees` 早已存在 —— 本次把 UI 接到真实接口,并删掉这两组已无用的 demo 常量。

- **注册绑定本就是通的,未改**:`UserAuthService::setupReferral`(无效码拦截注册、禁用自己的码)。
  已用真实账号端到端验证:注册邀请人 → 取码 → 带码注册被邀请人 → `user_referral` 落 1 行(26→27,status=0)
  → 两个接口读数正确;测试账号已清理。
- **发放时机改为入住核销(按用户口径纠正)**:原实现是**支付成功即发**(`OrderController::pay` / `TripController::pay`),
  与 PRD「入住完成后奖励」及 App 规则文案 `afterStay` 不符 —— 订金付完就退的单也会拿到奖励。
  现移到 `Booking\BookingLifecycleService::checkIn`:**商户后台点入住 / 商户核销 / 平台后台手工核销**
  三个入口都汇到这一个方法,放一处即可全覆盖;发放在 checkIn 的事务内,`reward_status` 0→1 + `lockForUpdate` 保证仅一次。
  两处支付时的调用连同已无用的 `ReferralService` 注入、`$firstBookingId` 一并删除。
  ⚠️ `revertCheckIn`(撤销入住)**不会退回已发奖励** —— 钱可能已被花掉,没有做追回,需要的话要单独设计。
- **后端小改**(`user-service ReferralController`):`my` 增 `pendingCount`/`rewardedCount`(统计卡三格要拆分,
  单条聚合 SQL 查完,无记录时 SUM 为 NULL 已强转兜 0);`invitees` 增选填 `status`(0/1)供 Pending/Rewarded 两页签,
  并补出 `reward_order_id`。**`status=0` 是合法值,判空只能判 null/''**。
- **前端**:新增 `screens/more/useReferralData.ts`(仿 `useMyPickData`,用 `useFocusEffect` 而非 `useEffect` ——
  奖励由后端在支付成功时入账,从订单页切回来必须拿到新战绩);`ReferralStatsCard` 改 props 驱动,两页共用同一份口径;
  推荐链接由前端按 `REFERRAL_LINK_BASE`(新增 env,可用 `EXPO_PUBLIC_REFERRAL_LINK_BASE` 覆盖)拼。
- **奖励金额补种子** `V20260921030000__add-referral-reward-config.sql`:`referral_reward_inviter/invitee`
  此前**全库零行**(无种子、无后台入口),于是首单达成时钱包一分不进、`reward_status` 却已置 1,推荐关系被静默消耗。
  ⚠️ **只给 MMK 站点(5/6/7)写 50000** —— `reward()` 取的是绝对金额,50000 落到 EUR 站点(1/2/3/4)就是每单 5 万欧元;
  EUR 站点要开推荐返利须按欧元口径另配。账本 25/25。
- ⚠️ **按用户决定保留现状**:奖励为 0 时 `grantOnFirstBooking` 仍会置 `reward_status=1`,
  推荐关系被消耗且事后补配金额也补发不了 —— EUR 站点在配额到位前命中首单即属此情形。
- ⚠️ 进度条五步(邀请→注册→下单→入住→奖励):改到核销发放后「已发放=确实住完了」,第5步是实的;
  但 `user_referral` 只落绑定与奖励两个事实,中间的「下单/入住」没单独跟踪,
  待达成一律停在第3步,分不清「刚注册」与「已下单未入住」。要精确点亮中间两步需后端补记首单订单状态。
- 验收:backend `php -l` 393/393、shared 单测 99 例 975 断言全过、admin-web build、client-app typecheck 均通过。
  **核销发奖已真机跑通**(非静态推断):在 order-service 容器内引导 Hyperf 容器直调 `checkIn(订单9)` ——
  订单 2→3(已入住),`user_referral` 0→1/50000/reward_order_id=9,邀请人钱包 0→50000、新人 +50000,
  两条 `user_balance_log`(change_type=4);**重复调用余额与流水不变**(幂等)。
  测试用的绑定行、余额、订单状态与时间线已全部还原到原值。
  ⚠️ `scripts/check.ps1` 本机仍不可跑(未装 php,第 1 步即断,与本次改动无关),上述两步 PHP 检查是在容器内跑的。

### ★ 2026-09-18（商户认证测试模式改为后台运行时开关）

商户固定 OTP 测试模式不再复用消费者注册的 `register_sms_required`，也不再由单一环境变量直接启停。新增全局安全配置 `sys_config.merchant_auth_test_mode`（默认 `0`）和部署能力门禁 `MTRIP_MERCHANT_AUTH_TEST_ALLOWED`（模板默认 `false`）；仅当环境不是 `prod/production`、部署门禁为 `true`、数据库开关为 `1` 时，商户注册/激活/登录/恢复才接受 `000000` 并跳过最终批准的外部凭证投递。生产环境始终关闭。

后续页面走查修复了布尔配置模板分支：后台 IP 白名单、注册强制短信验证和商户认证测试模式现在统一只渲染开关与元信息，不再为前两项额外显示 `false` 文本输入框；商户测试模式继续保留生效状态标签，配置行为未改变。

后台入口为“系统配置 → 全局参数 → 安全配置 → 商户认证测试模式”。只有超级管理员可以保存或重置该项；部署门禁关闭时不能开启，但可关闭遗留的数据库开启值。开关双向确认并展示“已生效/未开启/部署环境禁止”状态。最终批准在请求开始时冻结一次测试模式判定并传给凭证投递，避免审批过程中切换导致投递行为前后不一致；全局配置批量保存先完整校验再事务写入，失败批次不会留下已切换的安全开关。

迁移 `V20260918120000__add-merchant-auth-test-toggle.sql` 和权限对齐迁移 `V20260918121000__add-global-config-reset-permission.sql` 已应用，账本 23/23、待执行 0。开发 `deploy/.env` 的部署门禁为 `true`，运行时数据库开关已恢复为 `0`；主池、APP 池和网关已重建并健康。注册、认证、最终批准三套隔离回归及新增后台控制器 14 项安全断言通过；真实网关验证 `0→1→0` 即时返回 `testMode:false→true→false`，无需重启。admin-web 构建、迁移校验、PHP lint 和 `git diff --check` 通过。两个 App 未修改。详见 `docs/plans/audits/2026-09-18-merchant-auth-runtime-toggle.md`。

### ★ 2026-09-18（Merchant M4 预订管理 PRD v1.0.3 / Figma 整改）

> 本节是当前口径，取代 2026-09-17 菜单记录中“All Properties 隐藏 Booking Management”的部分；`/availability` 仍要求具体物业，`/order` 现支持 All Properties 聚合。

**范围**：仅 `merchant-web` 预订管理与现有后端链路；不扩展两个 App，不发送真实支付/短信/邮件/PMS 请求。基线是 Merchant PRD v1.0.3 模块 4 和 Figma `mTrip_Merchant` 详情节点 `1289:24340`、列表节点 `1289:16725`。

**阶段 0～6 已执行并逐阶段 Review**：

- 建立 `scripts/test-booking-remediation.sh` 一次性隔离库专项；收口取消政策退款上限、库存回补和旧核销入口。
- 预订通知深链存数字订单 ID 并携带 `property_id`，C 端酒店取消/退款申请通知商户；员工和物业账号按授权物业过滤。
- Pay at Hotel 仅使用 `pay_method=4`；`POST /merchant/order/mark-paid` 只对合法状态生效，权限键 `mch:order:mark-paid` 在注解、路由、菜单种子和前端 `v-perm` 一致。
- Booking Management 补齐总额、倒计时、Workflow、终态告警、支付方式、Mark as Paid 和 No-show 禁用态；删除重复 Pending Check-in 页签。列表按 `1289:16725` 收敛为单搜索栏、胶囊页签、七列主表格和卡片内分页，高级条件收入筛选弹层；行点击仍进入详情，业务操作入口未删除。
- All Properties 可查全部已授权酒店；选中具体物业后酒店筛选锁定，切换物业会清空旧房型筛选和详情。All Properties 省略 `X-Mtrip-Property-Id`，服务端授权集合仍是最终边界。
- No-show 新订单冻结站点 IANA 时区、入住日 `23:59:59` 与首晚房费策略；历史订单回退站点时区，API 返回带偏移的 ISO 时间。站点时区在单请求内按 `site_id` 缓存，避免历史列表 N+1 且不会跨请求固化旧配置。

**数据库/运行态**：`V20260918010000__booking-management-remediation.sql` 已应用，账本 21/21、待执行 0；该迁移已登记，禁止原地修改。order/order-app/merchant/gateway 已重启，8 主服务 + 5 App 孪生服务 + Gateway 健康检查全绿；未登录 `/merchant/order/mark-paid` 和 `/merchant/order/list` 均到达鉴权层并返回标准 `40101`。

**验证**：预订专项（含 All Properties、越权、Header 契约、No-show 时区、Mark as Paid、通知范围）全过；392 个 PHP lint、shared 99/975、admin-web build、merchant-web build、client-app typecheck、菜单可见性契约和 `git diff --check` 通过。恢复会话后又完成 1440×900、1366×768 与 iPhone 16 393×852 真实登录态列表/详情/入住弹窗验收；修复实测发现的 `payment_success` / `payment_failed` 时间线翻译缺口。authenticated Mark as Paid 使用不存在订单 ID 无副作用探测，返回 HTTP 404 / `40401` 而非 401。

**仍待决策/受控验证**：

1. 当前 6 笔真实订单均已支付，未对它们执行 Mark as Paid 成功写入。若需补登录态成功路径，必须先准备专用 Pay at Hotel 测试订单；现有隔离契约已覆盖成功、幂等和非到店付拒绝。
2. 待产品确认物业级 No-show 截止时间、费用策略（首期是否仅首晚/豁免）及配置入口（Hotel Profile 或 Settings）。确认前不新增物业字段、迁移或 UI。
### ★ 2026-09-18 深夜(关怀模式房型详情页**第三次**逐节点复核,Figma `2352:6030`)

**范围**:`RoomDetailLiteScreen` 一页 + 新增 `components/common/EdgeGradient.tsx`(从 `LiteHotelCard` 抽出)
+ 三份 i18n + 新增校验脚本。设计数据经 **Figma MCP** 取回,落档 `.figma-cache/2352-6030.txt`(整帧渲染图 `2352-6030.png`)。

**背景**:这页 09-18 夜已按同一节点改过**两轮**,用户再次要求照稿改 —— 逐节点比对后确实还有 **11 处**
数值/结构不符,**其中两处是本文件此前写明的规格却漏了实现**(设施卡 gap 24;早餐/价格卡 padding 应为 24 而非 25)。

**11 处(稿面 ← 旧值)**:① 顶栏渐变遮罩 `2352:9557` 补齐(主色 50% → 透明,带高 80;此前完全没有)
② 返回胶囊底 `rgba(0,0,0,.25)`(旧 .4) ③ 箭头 32(旧 20) ④ 大图↔内容 gap 10(旧无)
⑤ 覆盖层首行 `flex-end`(旧 center) ⑥ 设施卡 gap 24(旧:与信息卡共用 16) ⑦ 分组小标行高 16(旧 20)
⑧ 属性行图标宽 20(旧 16) ⑨ 早餐卡 padding 24(旧 25) ⑩ 价格卡 padding 24 / 合计行 paddingTop 12(旧 25 / 13)
⑪ 价格卡 `shadows.raised`、CTA `shadows.media`(稿面 0/4 blur6 -4 + 0/10 blur15 -3 与 0/2 blur4 -2 + 0/4 blur6 -1,
**与 theme 令牌注释逐字一致**,旧值分别是误用 `subtle` 与无阴影)。

**税费展示位(用户选定)**:稿面 `2352:6131`「Tax & Service Fees (15%)」**画出来**,值取占位常量
`TAX_AMOUNT = 0`,代码里写明「后端无税费字段、待后端出字段后替换」。不编造 27,75 ——
后端 `PricingService` 实付里没有这笔税费,且稿面自身数就对不上(212,750 + 27,75,Total 仍 212,750)。
新词条 `hotels.lite.room.taxAndFees`(`hotels.lite.room` 三份各 13 键同结构)。

**抽取**:`components/common/EdgeGradient.tsx` —— 顶栏遮罩与 `LiteHotelCard` 封面上下两条是同一规格,
抽出来两处共用(实现逐字搬运,`LiteHotelCard` 视觉值一个没动,原文件 `colors`/`shadows` 仍被其他样式使用)。

**未照抄且已说明理由**:覆盖层两行稿里写死宽 370(可用 378,左右不等距)判为稿面手工尺寸;
圆点数量不照稿的固定 3 枚(与其自身 "2/12" 矛盾),按实际图片数渲染(**用户选定**);
面积图标稿面是 17.76 + 1px 下内边距(三枚里只它这样),判为导出缩放产物,三枚统一 20(2px 级已知差异)。

**验证**:`npm run typecheck` 零报错;新增 `scripts/check-room-detail-lite.cjs` **35/35 GREEN**
(红→绿:8/34 → 34/35 → 35/35;中间 34/35 是**断言过度约束**——把遮罩高度写死字面量 80 而实现用
具名常量 `SCRIM_HEIGHT = 80`,已改为校验「高度解析为 80」这一事实);
`check-property-preview-lite.cjs` 仍 81/81(确认抽取没连带破坏)。
⚠️ `scripts/check.ps1` 本机仍跑不了(未装 php,第 1 步即断);⚠️ **仍未做真机 / Web 冒烟**;
⚠️ 缅文新增 1 条待母语复核(连同实景预览页 7 条,共 **8 条**)。

### ★ 2026-09-18 深夜(关怀模式实景预览页按 `2352:7051` 重做)

**范围**:`PropertyPreviewLiteScreen` 一页 + `theme.ts` 4 个令牌 + 三份 i18n + 新增校验脚本。
设计数据首次走 **Figma MCP**(`get_figma_data`)取回,落档 `.figma-cache/2352-7051.txt`(整帧渲染图 `2352-7051.png`)。

**五处照帧改动**:

1. **页签改成缩略图卡**(`2352:7056`):横滑 gap 12,四张 Video/360 · Facilities · Rooms · Dining;
   图高 **83.5** 圆角 8,标签 Inter 500/14/20 `#475569`,**标签居中在缩略图正下方**。
   没有 active 态 —— 稿里页签是 Link,四个都一样。
2. **360 区去掉白卡外壳**:标题 Inter 700/20/28 → **268.5** 高圆角 20 大图,整图叠 `rgba(0,0,0,.1)`,
   居中 64 毛玻璃圆(`view360` 40)下 8px 白字 **"360°"**。稿里没有原说明文字,已删
   (`video360Hint` 键保留但无调用点)。
3. **设施区双分组**:`Facilities` → 小标 `Kids areas` 16/600 `#8B8C91` → **223.75** 英雄图 →
   小标 `Pools & Gyms` → **两列网格**(格底 `#F3F4F6` 圆角 8、图高 **171** 圆角 20,列距 16)。
   两个小标是稿面静态文案 —— 后端 `facilities` 是扁平 key 列表,**无分组字段,不猜**。
4. **顶栏照稿写 "Back"**:`#FEFEFE` + Effect/DS,Inter 600/24 **`#204DDA`** —— ⚠️ **不是**
   `colors.primary` `#4169ED`,同一张稿上两者并存,新令牌 `colors.previewBack` 承载。
5. **页底纯白 `#FFFFFF`**,三段都无白卡 —— 与同族三屏(`#EBF0FF` 页底 + 白卡)**观感不同**,
   这是照帧结果不是漏改;本页不再引用 `liteShared.card`。

**3 处只能近似,已在代码注释逐条标注**(拿到设计明确值后替换):
① 缩略图**宽度**稿里没落值(tab 帧 hug / 内层图帧 fill 自相矛盾)→ 取 **120**(高 83.5 是稿面值);
② 顶栏箭头 SVG fill 为空(`fill_97d170e1: []`)→ 与 "Back" 同色 `#204DDA`;
③ `backdrop-filter: blur(2px)` 与两层 text-shadow RN 不支持 → 40% 白底 + 1px 60% 白描边近似、阴影取主导层 `0/4 blur3`。

**自查抓到并修掉的两个渲染缺陷**(不是设计变更):
① **阴影层与裁剪层拆开** —— iOS 上 `overflow:'hidden'` 会把同一视图的 shadow 一起裁掉,
原先两个盒子把两者写在同一块等于没阴影(同族 `LiteHotelCard.card` 同样写法,本页不跟、也未动那个文件);
② **设施格子可见圆角取图的 20** —— 格底 8 只是占位底,原先的 `overflow:'hidden'` 会把图裁成 8,与稿面 `2352:7104` 的 20 不符。

**i18n**:新增 `preview.{overview,back}`、`preview.tabs.{video360,facilities}`、`preview.facilityGroups.{kids,pools}`,
`preview.video360` 值改为稿面 `Video/360`;`preview.title` 未动(`HotelInfoLiteScreen` 在用)。
`hotels.lite.preview` 三份各 **14 键同结构**,整份文件相对 en-US 零缺失。
⚠️ **缅文 7 条为保守译法,需母语者复核**(`overview`/`back`/`video360`/`tabs.video360`/`tabs.facilities`/`facilityGroups.kids`/`facilityGroups.pools`)。

**验证**:`npm run typecheck` 零报错;新增 `scripts/check-property-preview-lite.cjs` **81/81 GREEN**
(红→绿留痕:实现前 `RED 26/72` → 实现后 `RED 77/81`(自查 4 条命中)→ 修完 `GREEN 81/81`;
过程中还修了脚本自身一个样式块解析 bug)。⚠️ 该脚本**未接进 `scripts/check.ps1`**,需手动跑。
⚠️ **`scripts/check.ps1` 本机跑不了**:第 1 步 `php -l` 因**本机未装 php** 立即中断(390 文件全报 `CommandNotFoundException`),
与本次改动无关,未动任何 PHP。⚠️ **未做真机 / Web 冒烟,需人工对图**。

### ★ 2026-09-18 夜(关怀模式房型详情页按 `2352:6030` 重做)

**范围**:`RoomDetailLiteScreen` 一页。**不是设计变更** —— 该页本来就是按 `2352:6030` 做的,
是实现漏了/多了东西,用户判定「差距大」后逐节点比对改的五处:

1. **大图底部覆盖层原先整层没做**(`2352:6033`):圆点条 + 张数胶囊 +「See 3D View」+「See 360 View」。
   ⚠️ **必须放在 ScrollView 之后**才点得到 —— 大图是绝对定位垫在最底层的,夹在中间会被滚动区盖住。
   圆点/张数按**实际可用图片数**渲染(过 `resolveMediaUri`),只有一张就不画;
   3D/360 没素材没接口,走 comingSoon。
2. **大图 260 → 300,且内容不再压图**:稿里 `2352:6031` 高 300、内容区 `2352:6048` 起点 y=354
   正好接在图后,原实现让首卡上移 120 压住了图。
3. **Room Amenities 分组**:接口给了 `sku.facilities` 就平铺真实值(**没有分类字段,不猜分类**),
   没给才回落稿里的三组 —— 复用 `DETAIL_AMENITY_GROUPS`(与 `HotelInfoLiteScreen` 同一份)。
4. **删掉吸底栏**:稿里 `2352:6164 Mobile Bottom Bar` 是 **`hidden="true"`**,
   CTA 由价格卡内的「Book This Room」承担。
5. **顶栏去掉标题**:稿里 `2352:9560 Heading 1` 是 `hidden`,只留返回键。

**⚠️ 一个查 metadata 会被骗的地方**:`get_metadata` 把 `2352:6032` 显示成**无子节点的自闭合 frame**,
看上去大图上什么都没有;实际那四个覆盖控件都是它的真子节点,**要用 `get_design_context` 才看得到**。
`contentsOnly: true` 的隔离渲染也能验证(控件仍在 = 属于本帧,不是画布上浮着的别帧元素)。

**⚠️ 第二轮返工:大图必须在滚动流里**。第一轮把大图做成绝对定位垫在 ScrollView 底下、
覆盖控件浮在最上层(为了让 3D/360 点得到),结果**滚动时那两枚按钮不跟着图走、一直悬在内容上方**,
用户指出「不应该是悬浮组件」。已改成:**大图是 ScrollView 的第一个子元素**,
覆盖控件绝对定位在**大图内部** —— 一起滚、也点得到;只有返回键仍绝对定位压在图上。
既然内容不再压图(第 2 条),大图本来就没有绝对定位的必要。
同轮按 `get_design_context` 实测校正了字体:房型名 Inter 600/24/**40** tracking **-0.32** `#0B1C30`、
「PRICE PER NIGHT」**大写** tracking .6、金额 Inter **700**/20、参数行 **16**/20、
脚注 Inter 600/**16/16** tracking .6;卡壳(信息/设施 r32 p24、价格卡 r20 p25)原本就对。

**「Tax & Service Fees (15%)」仍然不做,有据**:后端 `PricingService` 算的实付里没有这笔税费,
**而且稿子自己的数就对不上** —— Price per Night 212,750 + Tax 27,75,Total 却仍是 212,750,
说明那一行在稿里是占位。照画会让本页 Total 与结账页实收金额不一致。后端真出税费字段时再补。
「Loyalty Status Module」同理是稿里 `hidden`(`2352:6146`),不做。

**i18n**:补 `hotels.lite.room.{see3d,see360}`,删掉随吸底栏失去调用点的
`hotels.lite.room.{startAt,reserveNow}`;三份仍 **1023 键零差异**。

**验证**:`npm run typecheck` 零报错;**本页 15 个静态 i18n 键 + 2 个模板前缀全部解析通过**
(⚠️ typecheck 查不出缺 i18n 键,是单独跑脚本验的 —— 这页新加 `see3d`/`see360` 时就差点漏);
三份 i18n 1023 键零差异。⚠️ 未做真机 / Web 冒烟,需人工对图。

### ★ 2026-09-18 夜(关怀模式酒店详情页**改回** `2642:10749`,含多房间)

> **🔴 动这一页之前必读:设计文件里有两套并存的 Lite 详情稿,已确定以 `2642:10749` 为准。**
>
> | 稿 | 版式 | 状态 |
> |---|---|---|
> | **`2642:10749`**(含底栏)/ `2492:10399`(无底栏) | 文字顶栏 + 标题卡(See Map / View Hotel Detail)+ **左 90×90 缩略图横排房卡** + Choose | ✅ **当前基准** |
> | `2540:16882` | Hero 图库 + 9.2 评分行 + **整宽 192 封面大房卡** + Select + Read Policies | ❌ 已作废 |
>
> 09-18 白天曾按 `2540:16882` 把这页整个改成 Hero 版(当时我提示过这两个节点是旧版式,
> 用户先选了"保留新版"),**用户实际跑起来看过后判定"和设计稿差别太大",要求改回**。
> 本次已按 `2642:10749` 重做。`2540:16882` 那一版的 Hero 图库 / 评分行 / Read Policies 全部移除。
> **别再照 `2540:16882` 改回去**;原型流程(`/proto/` 链接)也还连着这套旧帧,与本结论一致。

**改了什么**

| 文件 | 改动 |
|---|---|
| `screens/hotel/HotelDetailLiteScreen.tsx` | 重写:文字顶栏(← Hotel Details / 📄 Hotel Policy)+ 标题卡(名 / 地址 / See Map / View Hotel Detail)+ Choose a Room + 横排房卡 + 多房间合计栏 |
| `components/hotel/lite/LiteRoomCard.tsx` | 重写回**左 90×90 缩略图 + 右文字**(`2642:10881`);去掉封面、收藏心、See Details;恢复 See Room、名字右侧 Bestseller 药丸、参数行定宽 100 wrap、Choose 按钮(圆角 **12**、Inter 600/20) |
| `components/hotel/HotelGallery.tsx` | **完全回退**到改动前(`counterTextSize` 是为已作废的 Hero 加的,现已无调用方,diff 归零) |
| `components/hotel/guide/guideSteps.tsx` | 跟着去掉 `onToggleFavorite`(新版式没有收藏心) |

**多房间保留**(上一轮刚补的,这次没丢):Choose 点一下即加入(置 1 间)、就地换成
−/数量/+ 加减器;减到 0 变回 Choose;选中后底部出 `2863:7627` 合计栏
(Total Price + `-15% TODAY` + 购物车角标 + Continue)。
⚠️ **合计只是展示**:后端 `order/create` 一单只收一个 sku,Continue 仍带**第一个**选中的房型。

**参数行的 Wifi**:设计稿第二张卡有一项 Wifi。接口的 `sku.facilities` 是**自由文本数组**,
所以按 `/wifi/i` 命中才画,没有就不画 —— 不硬编码成固定四项。

**i18n**(三份同步,仍 **1023 键零差异**):
- 补回 `hotels.lite.{detailTitle,hotelPolicy,viewHotelDetail,seeRoom}` —— 这四个是 09-18 白天
  改 Hero 版时删掉的,改回来就又要用了;
- 删掉随 Hero 版一起作废的 `hotels.lite.{seeAllDetail,seeDetails,select,readPolicies}`(已 grep 确认零引用)。

**验证**:`npm run typecheck` **零报错**;三份 i18n **1023 键零 missing / 零 extra**;
四个已删键全仓零引用;`HotelGallery` 相对 HEAD 的 diff 为空(确认是干净回退)。
⚠️ **未做真机 / Web 冒烟** —— 这一页版式刚被判定"差太多",**建议这次先跑起来对图再继续**
(后端服务起着,网关 8081,`cd client-app; npm start` 即可)。

### ★ 2026-09-18 晚(关怀模式详情族补齐 + 多房间选择补回)

**⚠️ 先看这一条,能省掉一次返工**:`2492:10399` 与 `2642:10749` 这两个节点**是旧版式**
(文字顶栏 + See Map/View Hotel Detail + 90×90 小图房卡 + Choose),不是当前基准。
当前 Lite 详情页的基准是 **`2540:16882`**(Hero 图库 + 评分行 + 整宽封面房卡 + Read Policies)。
设计文件里两套稿并存,原型流程还连着旧帧,**照旧帧改会把 09-18 的改版推翻**。
本次已与用户确认:**只从旧帧搬多房间能力,版式不回退**。

**四件事(同一批)**

**① 订房日期弹窗加遮罩**。`DatePickerSheet` 原本**故意不带遮罩** —— 代码里写着
「设计稿没有遮罩(背后大图保持原亮度)」,那是给搜索页定的(背后整屏 hero 大图)。
它有 **4 个调用方**,订房向导那处背后是白卡页面,不压遮罩浮层像浮空的。
做成 **opt-in 的 `backdrop` prop(默认 `false`)**,只在 `HotelBookingLiteScreen` 打开,
`HotelsScreen` / `HotelsLiteScreen` / `HotelResultsScreen` **一行没动**。
遮罩是 `Animated.View` 绑同一个 `anim`(跟浮层一起淡入淡出)+ `pointerEvents="none"`
(点击穿透到原来那层关闭区,点遮罩关闭的行为没变);色值 `rgba(0,0,0,0.25)`,
与同屏的 `GuestRoomSheet` / `AlertDialog` 一致(`HotelFilterSheet` 的 0.4 是整屏上拉面板,没跟)。

**② AI Summary 补到关怀版两处**。之前用户问「是不是没做还是没数据」——
查清了是**没做**:全仓 grep `aiSummary|aiSparkle|topPositive` 只命中 `HomeIcon.tsx` 与
完整模式 `HotelReviewsTab.tsx`。关怀版**评分与四条维度条都画了,偏偏漏了这一块**。
抽成 `components/hotel/lite/LiteAiSummary.tsx`,信息页(接在 Read All Reviews 之后)与
评价页(接在维度条之后)共用。**文案共用完整模式那五个键**
`hotels.detail.reviews.{aiSummary,topPositive,positiveQuote,improvement,improvementQuote}`,
**不另造 Lite 词条** —— 否则两种模式会给出不同的总结。
**不可能是"没数据"**:这块是纯静态 i18n 文案,后端没有评价接口、更没有 AI 总结接口。

**③ 详情族底栏**(`2540:18477`)→ `components/hotel/lite/LiteDetailBottomBar.tsx`。
**哪几页有、哪几页没有,是逐帧核过的,不要"统一加"**:

| 页面 | 底栏 | 依据 |
|---|---|---|
| 信息页 / 政策页 / 评价页 | ✅ 本次加 | 稿上都有 |
| 房型详情 | 早有自己的 Book This Room | 不动 |
| **主详情页** | ❌ | `2540:16882` 的 bottom bar 是 `hidden=true`,且房卡各自带 Select,再挂 Choose room 是重复入口 |
| **实景预览** | ❌ | `2540:18495` 稿里**没有这个节点** |

评价页原本**不取数**(评价内容全是静态的),为了底栏那行起价加了**一次轻量
`fetchHotelDetail`** —— 拿不到只是不画金额那一行,**不给评价内容加载态、不挡页面**。
`-15% TODAY` 取 `DETAIL_DEMO.discountPercent`,**后端没有"今日折扣"字段**,
与完整模式 `HotelDetailScreen` 同一口径;组件做成可选 `discountPercent`,不想显示不传。
i18n +1 键 `hotels.lite.chooseRoomCta`(`hotels.detail.chooseRoom` 是 "Choose my room",
与稿上的 "Choose room" 不同,没硬套)。

**④ 主详情页补回多房间选择**(`2642:10749` / 底栏 `2863:7627`)。
09-18 上午按用户确认删掉的多选,这次按用户确认**又加回来了** —— 但**版式基底仍是新稿**。
交互按用户选定的「两者都要」:房卡右下角 **Select 点一下即加入(置 1 间)、就地换成
−/数量/+ 加减器**(加减器规格取自旧稿 `2707:13670`,按新卡的圆角 16 调整);
减到 0 自动移出选择、按钮变回 Select。选中任一房型后底部出现合计栏,
客服悬浮球同时上移一个栏高,免得压住 Continue。
`LiteRoomCard` 新增**可选** `quantity` / `onChangeQuantity`,不传就退回纯单选
(`guideSteps` 里的演示卡不受影响)。i18n 补回 `hotels.lite.continue`(上午删多选时删掉的)。

⚠️ **合计只是展示,这是刻意的**:后端 `order/create` **一单只收一个 sku**,
Continue 仍带**第一个**选中的房型进订房向导。代码注释、模块文档、本条都写明了 ——
**别当成"没接完"去补**,真正的一单多房型要等后端支持。

**验证**

**✅ 质量基线四步这次全跑完了**(不是又停在第 1 步)。
**这一次是对整棵工作树跑的**,所以 09-18 全天三批改动(详情页改版 / 订房流程 4→2 步 /
本条这批)都被覆盖了 —— 那两条里写的「停在第 1 步」是当时的情况,现已不成立,
但保留原文不改写(历史记录按当时事实留痕)。

| 步骤 | 结果 |
|---|---|
| 1 backend 全量 `php -l` | **390 个文件 / 0 个语法错误** |
| 2 shared 纯逻辑单测 | **99 用例 / 975 断言 / 0 失败** |
| 3 admin-web `npm run build` | 通过(vue-tsc 零 TS 报错,built in 19.17s) |
| 4 client-app `npm run typecheck` | 通过,零报错 |

**⭐ 怎么绕开"本机没装 php"**(前面好几条记录都卡在这儿,以后照这个跑):
本机 PATH 上确实没有 php,但**微服务镜像里有 PHP 8.1.27**,借它跑前两步即可 ——

```bash
# 1) 全量 php -l(整个 backend 挂进临时容器;镜像有 ENTRYPOINT,必须 --entrypoint 覆盖)
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint sh \
  -v "C:\Codes\Mtrip\backend:/lint:ro" -w /lint mtrip-system-service -c \
  'for f in $(find . -name "*.php" -not -path "*/vendor/*" -not -path "*/runtime/*"); do php -l "$f" || exit 1; done'

# 2) shared 单测
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint php \
  -v "C:\Codes\Mtrip\backend:/lint" -w /lint mtrip-system-service shared/tests/run.php
```

要先 `cd deploy; ./mtrip.sh start` 把镜像准备好(裸 `docker compose up -d` 起不出 APP 孪生池,
网关会 [emerg] 重启,见下面 09-18 那条 Docker 排查)。第 3、4 步本机直接 npm 跑即可。
`admin-web/dist` 在 .gitignore 里,构建产物不用清。

- 三份 i18n **1023 键、零 missing / 零 extra**。
- ⚠️ **仍未做真机 / Web 冒烟,也没逐像素对图**(这是唯一还欠的一项)。要人工走:
  订房 step 1 点日期行看遮罩;信息页 / 评价页底部看 AI Summary 两块引言;
  信息 / 政策 / 评价三页的底栏与 Choose room 跳转;
  主详情页 Select → 加减器 → 底栏合计与购物车角标 → Continue 进向导。
- 缅文照现有 `my-MM.json` 同类措辞拼的,**需母语者复核**。

### ★ 2026-09-18 下午(关怀模式订房流程改版:**4 步 → 2 步**,Figma section `2540:19101`)

**范围**:`client-app` 的 Lite 订房向导 + Lite 预订结果页。后端、admin-web 未动;
完整模式的**页面一行没改**,但**共用的数据层 `useBookingWizard` 动了**(见下,需要回归)。

**为什么重做**:2026-09-15 那一版是**推导**的 —— 设计侧当时没出订房流程的 Lite 稿,
是从完整版 `1675:5776` 按「关怀模式换算规则」放大一档推出来的四步
(`dates → guests → review → payment`)。这次设计出了真稿,**推导那一版整体作废**。

| 新稿 | 落点 |
|---|---|
| `2540:19394` Lite Booking step 1「Confirm Your Room & Date」 | **新增** `components/hotel/booking/lite/LiteStepConfirm.tsx` |
| `2540:19621` Lite Booking step 2「Price Breakdown」 | **新增** `components/hotel/booking/lite/LiteStepPay.tsx` |
| `2540:19863` Booking Confirmed! / `2540:19741` Booking Confirming | `BookingSuccessLiteScreen` 重写(一屏两态) |
| `2540:20959` Account Login Required | 复用 `AlertDialog`,加了个 `tone: 'plain'`(不画图标) |

删除 `LiteStepDates` / `LiteStepGuests` / `LiteStepReview` / `LiteStepPayment`
(四个都只有 `HotelBookingLiteScreen` 在用,已 grep 确认无其它引用)。

**⚠️ 换算表作废**:`liteBookingShared.ts` 头部那段「设计侧没出 Lite 稿 / 按换算规则推导」
已删,改成新稿实测。**真稿的字号比推导值小**(区块标题 20/32 而非 32/40、
卡内标题 16/24 而非 24/32、输入框高 56 文字 16 而非 64/24)——
以后再有 Lite 订房相关的稿,以这一份实测为准,别再拿「放大一档」去推。

**共用数据层怎么改的(完整模式必须回归)**

`useBookingWizard` 新增三处,完整模式默认值保持原行为:

1. `steps?: BookingStepKey[]` —— 序列覆盖。Lite 传 **`['guests', 'payment']`**,
   **刻意复用原有的 step key**,于是 `goNext` 里「姓名/手机必填」与
   「渠道必选 / 未登录 / 余额不足 / 下单」两段校验**原样生效**,不用为 Lite 再写一份。
2. `confirmLogin?: boolean` —— 未登录时先弹确认浮层再跳登录页(Lite 传 true,完整模式默认 false)。
3. 返回值多了 `refundRules`(给 Step 1 的退改卡)与 `loginPrompt` / `setLoginPrompt`。

**⚠️ 顺带修掉一处会咬人的护栏失效**:`goNext` 里「离店日期为空就拦下」原本限定
`step === 'dates'`。Lite 新序列里**没有 dates 这一步**,这条护栏会整个失效 ——
半选日期(只点了入住日)会带着**空的 `endDate`** 去 `create`,被后端以
「入住/离店日期不正确」打回。已改成**无条件前置判断**。对完整模式无实际影响
(它第一步就是 dates,后面几步 `checkOut` 必非空),但这是本次唯一改到共用分支的逻辑。

另外 `paid` 补了 `orderId`、成功页参数补 `orderId` / `status`,
`BookingStay` 补了 `bedType`(Step 1 摘要行要画)。

**三个已确认的取舍(用户选定,别当 bug 改回去)**

1. **日期与人数:版式照稿做成只读摘要行,但可点开弹层**。新稿没画改日期/改人数的入口,
   可是进了订房页才发现日期错了只能退两层重选,实际用不了。日期行开现成的
   `DatePickerSheet`,「N Room」药丸与住客行开现成的 `GuestRoomSheet`(它本来就是
   Room + Adults + Children 三行)。两个弹层都是现成的,没新写。
2. **支付主位卡放「mTrip 钱包余额」,不是稿上的 MMQR Pay**。后端只有钱包余额是真渠道
   (`payOrder` 的 `payMethod=3`),照稿把 MMQR 摆主位的话**默认那张卡根本付不了款**。
   MMQR / KBZPay / Wave Pay / 酒店前台收进「See Other Payment」,展开后一律置灰 + Coming soon。
3. **「View More」是就地展开**加购卡列表(含保险那张,点它仍跳 `Insurance` 独立页),
   不是跳新页 —— 否则加购与保险两条既有链路会断。

**本次没动的两页**:Add New Guest `2540:19102` / Insurance `2540:19225` ——
逐屏比对过截图,**与已实现的 `1675:5777` / `1675:5900` 是同一版式,设计没改**。
现有 `AddGuestScreen` / `InsuranceScreen` 与它们的差异全是上次用户确认过的
**后端字段裁剪**(性别 / 出生日期 / 未满13 / NRC 三段码,`user_traveler` 没有这些列)。

**未做 / 已知缺口(都不是漏接,别去"补")**

- **成功页的 `confirming` 态目前产生不了**:后端 `ORDER_STATUS` 只有
  0待支付 / 1已支付 / 2已核销……,**没有「等酒店确认」这一档**,`order/pay` 成功即已支付。
  两态都实现好放在那儿了,等后端补上该状态时,只需让 `goSuccess` 传 `status: 'confirming'`。
- **新稿没有 Special Requests 输入框**:`request` 状态保留(Hook 里还在),
  但页面不再提供入口,于是真实下单的 `remark` **恒为空**。要留这个入口得跟设计确认。
- **新稿成功页没有核销二维码**:核销码没丢,它在订单详情页(`OrderDetailScreen`
  的 `VerifyCodeView`),所以「View Booking」跳 `OrderDetail{orderId}`;
  没有订单号(演示模式)时退回订单列表。
- **演示模式不画券卡**:券接口要登录态且要 `propertyId`,不伪造。
- 新稿 step 1 也**没有条款勾选框**,`agreed` 在 Lite 下闲置(`goNext` 只在 `review` 步查它,
  Lite 序列没有那一步,所以不触发)。

**i18n**:三份各新增 `hotels.booking.lite.*` 一整块(含 `success` 子块)。
复数沿用仓库既有的**嵌套 `one/many` 写法 + 代码里自己挑**(本项目 i18next 是
`compatibilityJSON: 'v3'`,与 `nightsLabel` / `nightsLowerLabel` 同一处理),
**不要写成 `key_one` / `key_other`**,那是 v4 的格式,在这里不生效。
旧四步的词条**全部保留** —— 完整模式的 `BookingStepDates/Guests/Review` 还在用,逐键 grep 确认过。

**验证**

- `cd client-app; npm run typecheck` **零报错**。
- 三份 i18n **1021 键、零 missing / 零 extra**;四个已删组件全仓零残留引用。
- ⚠️ `scripts/check.ps1` 仍跑不完:本机 PATH 上没有 php,停在第 1 步后端全量 lint
  (与本次改动无关,未动任何 PHP)。
- ⚠️ **未做真机 / Web 冒烟,也没逐像素对图**。需要人工走两条:
  1. **完整模式回归(重点)**:`HotelBooking` 四步 / 五步(多住宿)、Add More Stay、
     条款勾选、支付结果浮层,确认与改动前一致 —— 因为动了共用的 Hook。
  2. **Lite 流程**:结果页 → 详情 → Select → step 1(改日期 / 改人数与间数 / 填姓名手机 /
     展开邮箱 / Remember Info / 展开 Add On Service 并进 Insurance / Select 进常旅客页)
     → Continue → step 2(选券 / 展开 See Other Payment / 钱包支付)→ Pay Now
     → 成功页 → View Booking 进订单详情看到核销码;未登录时 Pay Now 应先弹确认浮层。
- 缅文文案照现有 `my-MM.json` 同类措辞拼的,**需母语者复核**。

### ★ 2026-09-18(关怀模式酒店详情页改版,Figma `Hotel Details Lite` **新稿** `2540:16881`)

**范围**:只有 `client-app` 的 Lite 酒店详情页(搜索结果点酒店进的那一页)。后端、admin-web、
完整模式详情页**一行未动**;路由表与入口也没动(`HotelResultsLite` → `HotelDetailLite` 不变)。

**为什么改**:设计出了新稿。旧稿 `2352:5591` 的首屏是「文字顶栏 + 标题卡 + 左 90×90 缩略图小房卡」,
新稿 `2540:16882` 换成「整宽图库 Hero → 标题卡 → Choose a Room 房卡列表 → Read Policies」。

| 区块 | 新稿节点 | 落点 |
|---|---|---|
| Hero 图库 402×**220** | `2540:16883` | **复用** `components/hotel/HotelGallery`(渐变 / 圆点条 / 张数胶囊逐项吻合) |
| 悬浮顶栏(返回 32 + 星级 24 `#FFC100`) | `2540:16900` | 照搬完整版 `HotelDetailScreen` 的「状态栏黑条 + `top: insets.top` 悬浮栏」 |
| 标题卡(名 / 评分 / 地址) | `2540:16917` | 新写,投影 `shadows.subtle` |
| 房卡(整宽 **192** 封面在上) | `2540:17042` | `components/hotel/lite/LiteRoomCard.tsx` **重写** |
| Read Policies(1px 主色描边 r12) | `2540:17287` | 新写,跳 `HotelPolicyLite` |
| Mobile Bottom Bar | `2540:17289` | 稿里 **`hidden=true`** —— 本页没有底部价格栏 |

**删掉的东西(用户确认)**:`mode` 单/多选状态、「+ Choose Multiple」链接、房卡加减器、
底部 Total Price + 购物车 + Continue 合计栏,以及标题卡上的「See Map」、顶栏的「Hotel Policy」。
多选本来就是假的 —— **后端一单只收一个 sku**,原先的 Continue 也只带**第一个**选中房型进向导
(旧代码注释自己写了这条)。

**两个口径决定(都问过用户)**

1. **评分 ×2 换算成十分制**:稿上写 9.3,后端 `goods.rating` 是**五分制**
   (`HotelResultCard` 至今直接显示 4.6 这种五分值)。本页按稿子显示 `(rating*2).toFixed(1)`,
   但 **EXCELLENT 的门槛仍按五分制原值判 `>= 4.5`**,复用 `hotels.results.excellent`。
   ⚠️ 于是同一家酒店在**搜索结果页是 4.6、详情页是 9.2** —— 这是刻意的(各自照各自的稿),
   后端确认评分刻度后应统一,别当 bug 修一半。
2. **零新增资产**:稿里九枚 fluent 图标(`arrow-left` / `star` / `location-16` / `heart` /
   `image-copy` / `people` / `bed-16` / `food-16` / `chat-20`)在 `HomeIcon` 里全部已有同名字形;
   房卡兜底图沿用 `TEMP_ROOM_COVERS`(**370×192,正好是新稿封面框尺寸**),Hero 兜底沿用
   `TEMP_HOTEL_GALLERY`。没有导出任何新 PNG/SVG。

**改了什么文件**

| 文件 | 改动 |
|---|---|
| `screens/hotel/HotelDetailLiteScreen.tsx` | 重写 |
| `components/hotel/lite/LiteRoomCard.tsx` | 重写(小横卡 → 整宽封面大卡);去掉 `mode`/`quantity`/`onChangeQuantity` 与导出的 `RoomCardMode`,加 `favorite`/`onToggleFavorite`/`strike`/`promo` |
| `components/hotel/HotelGallery.tsx` | **只加一个可选 `counterTextSize`**(默认 12,Lite 传 16),完整模式调用点零改动 |
| `components/hotel/guide/guideSteps.tsx` | 跟着补 `onToggleFavorite={noop}` |
| `assets/i18n/{en-US,zh-CN,my-MM}.json` | 各 +4 / −8 键(见下) |

**i18n**:`hotels.lite` 新增 `seeAllDetail` / `seeDetails` / `select` / `readPolicies`;
删除失去调用点的 `detailTitle` / `hotelPolicy` / `viewHotelDetail` / `chooseMultiRoom` /
`switchMulti` / `switchSingle` / `seeRoom` / `continue`。
**保留** `seeMap`(`HotelInfoLiteScreen` 在用)与 `totalPrice`(`RoomDetailLiteScreen` 在用)——
这两个看着像该一起删,别顺手删。三份 `hotels.lite` 均 **32 键、零 missing / 零 extra**。
缅文是照现有 `my-MM.json` 同类措辞拼的,**不是母语者产出,需人工过一遍**。

**未做 / 已知偏差**

- **划线原价与「5% off for 7Nights」没接**:`GoodsSku` 只有 `base_price`,没有原价与促销字段。
  `LiteRoomCard` 留了可选 `strike` / `promo` 两个 props,页面暂不传 —— 后端下发后在页面补即可,
  组件不用再动。
- **房卡收藏心走 comingSoon**:`addFavorite` 是**物业级**收藏,没有房型级接口;
  完整版 `HotelRoomsTab.tsx:118-121,163-166` 也是这么接的,两边一致。
- **Bestseller 按「排序最前两张」等价处理**:接口没有这个标记(稿上前两张有、第三张没有)。
- **房卡封面不可横滑**:只画圆点与张数(与完整版 `HotelRoomCard` 一致);且**只有真实图 >1 张时才画**,
  兜底临时图不伪造「2/12」。

**验证**

- `cd client-app; npm run typecheck` **零报错**。
- 三份 i18n JSON 解析通过、`hotels.lite` 键集三份一致;8 个已删键全仓 `grep` **零残留引用**;
  `RoomCardMode` 零残留。
- ⚠️ `scripts/check.ps1` **跑不完**:本机 **PATH 上没有 php**,停在第 1 步后端全量 lint
  (390 个文件全部报 CommandNotFound)。与本次改动无关 —— 本次未动任何 PHP,
  这台机器此前几次 client-app 提交也都卡在同一步(见 README 2026-09-14 / 09-15 两条)。
- ⚠️ **未做真机 / Web 冒烟,也没做逐像素对图** —— 需人工按新稿走查一遍:
  Hero 横滑与圆点、标题卡评分行、房卡四要素(Bestseller / 心 / 参数三格 / Select)、
  页尾 Read Policies、右下客服球,以及四条跳转(See All Detail / Read Policies / See Details / Select)。

### ★ 2026-09-17 下午(「强制短信验证」开关搬家:站点级 → **全局安全配置**)

> 本节**取代**下面那节(站点级方案)。`sys_site.sms_verify_required` 这一列**已被删除**,
> 照着那节去找它会扑空。保留旧节是为了记录动机与 50021/50022 的设计,那部分仍然有效。

**为什么搬**:站点级开关**挡不住「挑一个最宽松的站点」**。注册请求的站点来自
**客户端可控的 `X-Site-Id`**(`AuthController::register` 的 `requireSiteId()` 只校验 `>0`,
不校验站点是否存在/启用)。只要有任何一个站点被设成「跟随渠道」,带上那个站点号就能免验证码注册。
而且这本质上是**平台级安全策略**,不是站点差异化配置。

**改动**

| 层 | 内容 |
|---|---|
| 迁移 | `V20260917040000__move-sms-verify-required-to-global.sql`(账本 19→**20**):种 `sys_config` 行 `security` / `register_sms_required` / `value_type=3` / `default_value='1'`;**并 `DROP` 掉 `sys_site.sms_verify_required`** |
| user-service | `siteForcesSms(int)` → **`registerSmsRequired(): bool`**(读全局配置,不再吃 siteId);`registerRequiresSms($siteId)` = `registerSmsRequired() \|\| enabled($siteId)`,siteId 只用于判渠道归属 |
| system-service | 撤销站点级字段(`SiteController::fill()` / `SysSite` casts 回到改动前) |
| admin-web | 站点页改动**全部撤销**;**全局配置 → 安全配置**页加开/关**双向二次确认**(`Modal.confirm`,关闭走 `danger`),i18n 3 键 × 2 份 |
| client-app | **逻辑零改动**(50021/50022 契约没变),仅修注释口径 |

**开关在哪**:后台「系统配置 → 全局参数」(`/config/global`)→ **安全配置** 分组 →
「注册强制短信验证」。`value_type=3` 由该页既有逻辑自动渲染成 `a-switch`,前端没为它写专门控件。

**留痕**:靠既有 `OperationLogMiddleware`,不另写审计。因为该页**只提交变更项**,
日志 `content` 里就只有这一个键,附带管理员 / IP / URL / 状态码 / 时间。实测样例:
`{"configs":[{"key":"register_sms_required","value":"0"}]}`。
**局限:只有新值、没有旧值**(要看旧值得比对前一条日志)。

**验证(全部实跑)**

- 迁移账本 19→**20**,待执行 0;`sys_config` 有新行(中文名入库为正确 UTF-8)、`sys_site` 该列已消失。
- shared 单测 **99 用例 / 975 断言全绿**(改造而非新增)。
- 真值表 **13 项全过**(经网关 8081,每格跑完即回滚):

  | 全局开关 | 渠道 | `sms/send` | `register` 无 token |
  |---|---|---|---|
  | 强制(1) | 启用 | (跳过实测,见下) | `40111` |
  | 强制(1) | 停用 | `50022` | `40111`,不建号 |
  | 关闭(0) | 停用 | `50021` | `code=0` 建号(旧降级) |

  **关键一格**:开关=1 时,`X-Site-Id` 取 `1/2/7/999/12345`(含**不存在**的站点号)
  调 `register` **全部被 `40111` 拦下** —— 「挑弱站点」这条路已堵死,这正是搬家的目的。
  唯一**没实测**的是「开关=1 + 渠道启用 → `sms/send` 正常」:那会真往用户手机发一条短信(要花钱、要打扰人),
  且该格行为本次未触碰、当天早些时候已实测通过。
- 后台走查 **全过**:开关可见、开/关**都弹确认**且文案不同、取消不保存、确认后落库、最终恢复为「开」。
- `admin-web build`、`client-app typecheck` 零报错;改动 PHP 文件容器内 `php -l` 通过。
- 状态已还原:开关=1、渠道 status=1、测试账号已删(`user_info` 回到 6)。

**⚠️ 代价没变**:默认 `1`(强制),即 **SMSPoh 一旦挂掉或凭证失效,注册会全面不可用**(而不是降级放行)。
要放开就去上面那个开关关掉,会弹确认并留痕。

**仍未做(独立问题)**:`requireSiteId()` 依旧不校验站点存在/启用。开关全局化后,这个洞
在「注册强制短信」这件事上已不可利用(判据不再依赖 siteId),但**伪造的 `X-Site-Id` 仍会被其它
`/app/*` 接口接受**。影响面覆盖所有 C 端接口,值得单独评估,本次刻意没顺手改。

**⚠️ 验证留痕时顺带发现的另一个问题(未修,需单独决策)**:
**`sys_operation_log.content` 里存着明文的第三方凭证**。`MaskHelper::maskParams()` 的脱敏表是
**精确匹配小写键名**,含 `secret` / `secret_key` / `client_secret` / `access_key`,
但**不含 `apikey` / `apisecret`** —— 而短信、存储、文件三个配置接口用的正是 `apiKey` / `apiSecret` 驼峰命名
(`system-service` 的 `SmsController` / `StorageController` / `FileController`)。
结果:这些密钥在自己表里是 `SecretField` AES 加密存储的,却被操作日志以**明文**留了一份副本,
凡能读日志表或后台「日志」页的人都能看到。当前库里已有 4 条这样的记录
(`/sys/sms/channel/add` ×3、`/sys/sms/channel/update` ×1)。
修的方向:给 `maskParams` 的默认表补上这几个键名(或改成子串匹配,注意别误伤 `keyword` 之类),
并清洗存量记录。**本次未动** —— 属于另一件事,且清洗历史日志是不可逆操作,需要你点头。

---

### ~~2026-09-17 上午(站点级「强制短信验证」开关)~~ · **已被上一节取代**

> ⚠️ 本节描述的 `sys_site.sms_verify_required` **列已被 `V20260917040000` 删除**,
> 后台站点管理里也**没有**那个开关了。动机与 50021/50022 的设计仍然有效,其余按上一节为准。

**动机**:`AuthController::register` 原本读 `SmsVerifyService::enabled()`,即「渠道启用即强制」。
渠道一旦停用 / 软删 / 凭证失效,`enabled()` 变 false,注册**静默降级成免验证码注册**,且没有任何告警。
9/17 实测复现(渠道 id=4 临时置 `status=2`):不带 `verifyToken` 的 `register` 直接 `code=0` 建号,`user_info` 6→7。

**改动**

| 层 | 内容 |
|---|---|
| 迁移 | `V20260917032003__add-site-sms-verify-required.sql`:`sys_site` + `sms_verify_required TINYINT NOT NULL DEFAULT 1`(账本 18→19) |
| shared | `ErrorCode` 新增 `SMS_REQUIRED_UNAVAILABLE = 50022`(HTTP 500) |
| user-service | `SmsVerifyService` 新增 `siteForcesSms()` / `registerRequiresSms()`;`requireChannel()` 按站点开关抛 50021 或 50022;`register` 改读 `registerRequiresSms()` |
| system-service | `SiteController::fill()` 收 `smsVerifyRequired`;`SysSite` casts 补 integer |
| admin-web | 站点列表加一列标签、编辑弹窗加开关;i18n 4 键 × 2 份 |
| client-app | `API_CODE` 加 50022;`RegisterScreen` 的降级分支**仍只认 50021**(i18n 零新增) |

**`enabled()` 语义没动**(仍是「渠道能否解析」),既有语义与单测不受影响,新逻辑是它外面加了一层。

**50021 与 50022 的区别是「调用方能不能降级」**——这是这次设计的核心:
- `50021` 站点不强制 + 无可用渠道 → 后端也不会要 `verifyToken`,App 照旧跳过验证码页直接注册;
- `50022` 站点开了强制 + 渠道此刻不可用 → 后端**照样要** `verifyToken`,
  App **不能跳过**(跳过去只会在推荐码页被 `40111` 打回,是条死路),要停在注册页把后端文案说给用户。

**⚠️ 存量 7 个站点与新建站点一律默认 `1`(强制)** —— 用户的明确决定,已知晓代价:
**SMSPoh 一旦挂掉或凭证失效,所有站点的注册会立即全部不可用**(而不是降级放行)。
要放开的站点:后台「配置 → 站点管理」编辑该站点,把「强制短信验证」开关关掉(即 `sms_verify_required=0`)。

**验证(真值表逐格实测,site 1,经网关 8081)**

| 站点开关 | 渠道 | `sms/send` | `register` 无 token |
|---|---|---|---|
| 强制(1) | 启用 | 正常 | `40111` |
| 强制(1) | 停用 | **`50022`** | **`40111`,`user_info` 6→6 不建号** ✅ 漏洞已堵 |
| 跟随(0) | 停用 | `50021` | `code=0` 建号(旧降级行为保留) |

其余:shared 单测 97/968 → **99/975** 全绿(新增 2 用例 7 断言,覆盖 `registerRequiresSms` 四种组合
与 `requireChannel()` 的错误码切换);5 个改动 PHP 文件容器内 `php -l` 通过;
`admin-web build` 与 `client-app typecheck` 零报错。
**测试后状态已全部还原**:站点 7×`1`、渠道 `status=1`、`user_info` 回到 6。

**踩到的一个坑**:`a-switch` 的 `@change="(v) => ...)"` 会让 `v` 变成隐式 any,
而本仓库模板禁用类型标注 → `vue-tsc` 报 `TS7006`。改用带 setter 的 `computed` 做布尔↔0/1 转换。

**未做**
- 不动 `login-by-sms` / `reset-password`:这两条本就以短信为前提,不存在静默降级问题,开关只作用于 `register`。
- 不在 `AppSiteController::config` 下发该字段:错误码已经把信号带给 App 了,不必多一份公开契约。
  将来 App 想「进注册页之前就提示」再加。
- 真实收发短信的端到端仍待用户用真号自测(与 9/16 那条相同)。

### ★ 2026-09-17(商户端侧边栏菜单调整:Stores/Goods 移出 + 物业专属分组)

**范围**:`merchant-web` 侧边栏分组与菜单可见性。5 个待确认点已向用户逐条确认(均为推荐方案)。

- **Stores、Goods 移出侧边栏**,但只在 `SideMenu.vue` 的 `HIDDEN_PATHS` 隐藏:数据库菜单行、
  权限键、路由与页面全部保留。理由:`/store` 还被工作台「View All Properties」和「所有物业」
  列表对**非酒店物业**的 Manage 按钮使用,而 merchant-web 的路由是由菜单树生成的
  (`router/dynamic.ts` 的 `walk()`),删菜单行会连带删掉 `/store` 路由,这三处会 404。
- **Operations 仅在选中具体物业时出现**,子菜单 = Availability & Pricing(`/availability`)+
  Booking Management(`/order`,从「经营」分组移入)。All Properties 下整组隐藏。
- **新增 HOTEL MANAGEMENT 分组**,仅选中**酒店**物业时显示:Hotel Profile(复用既有
  `/properties/:id/profile`,入口按当前选中物业动态生成)+ Room Types(原 Rooms 改名,
  路由 `/rooms` 与权限 `mch:rooms:list` 不变)。
- **切回 All Properties 的兜底**:`BasicLayout.selectProperty()` 切换后若当前页面已不在菜单
  口径内,直接跳回「所有物业」页,避免停在一个侧边栏已无入口的页面上。
- **口径单一来源**:新增 `src/config/menuSections.ts` 的 `isMenuPathVisible(path, selected)`,
  侧边栏与切换兜底共用。注意它与 `merchant_menu.module_key` 是两层不同过滤:`module_key='hotel'`
  (房型 600、房量与价格 700)在 `userStore.visibleMenus` 里已按业务模块裁剪,本次只补
  「必须选中物业」这一层,没有改 `module_key`。
- **数据库**:改名走增量 `database/migrations/V20260918130000__merchant-menu-restructure.sql`
  (守卫式 UPDATE,已用 `scripts/db-apply.sh` 应用),`database/seed/04-merchant-menu.sql` 同步为
  「房型管理 / Room Types」供空库初始化。**不新增 menu 行**:Hotel Profile 与 `/dashboard`、
  `/properties` 一样由前端直接挂入口(`item()` 的 always-allowed 分支),否则菜单树会再注册
  一条与 `dynamic.ts` 硬编码路由重复的 `/properties/:id/profile`。
- **i18n**:新增 `sidebar.sections.hotelManagement`(en `HOTEL MANAGEMENT` / zh 酒店管理);
  `menu.rooms` 改 Room Types/房型管理;Hotel Profile 直接复用 `properties.profile.title`。

**验证**:用真实 `SideMenu.vue` + 真实 pinia store / i18n / vue-router,喂本地开发库真实菜单树,
在无头 Chrome 里渲染三种物业上下文(临时探针已删除,未入库):All Properties 下无
Operations/HOTEL MANAGEMENT/Stores/Goods;选中酒店时两组齐全且点击 Hotel Profile 落到
`/properties/5/profile`、Room Types 落到 `/rooms`;选中餐厅时 HOTEL MANAGEMENT 不出现、
Operations 只剩 Booking Management。**该轮实测抓出一个真实缺陷并修掉**:Hotel Profile 的
动态路径初版没有业务类型判断,选中餐厅时仍会显示,现 `hotelProfilePath` 仅在
`business_type === 'hotel'` 时生成。merchant-web 生产构建(vue-tsc + vite build)通过。
详见[模块13](13-商家端merchant-web落地.md)。

### ★ 2026-09-17(客房管理「今日可售」看不出非今日订单:根因复核 + 两处修复)

**问题**(用户报):商户新增房型并设好客房总数后,在 APP 下了该房型的订单,商户后台客房管理里
「今日可售」没有变化,像是订单没生效。

**根因(先证伪、再定性,原方案已被推翻)**:

1. **列表只读"今天"那一行,而订单只写入住日那几行**。库存按日期落 `goods_daily_stock`,
   订单只占「入住日 → 离店前一晚」(`OrderStockService::datesOf`),列表的「今日可售」只查
   `stock_date = 今天` 的一行(`RoomController::appendAvailability`)。那笔单(订单 id=3,
   房型 6)入住 **09-17**、离店 09-18,而当时"今天"是 09-16 —— 今天那一行**根本不存在**,
   列表按房型默认可售配额(`launch_stock` 30)兜底 → 与下单前**一模一样**。这不是丢单:
   同房型 09-17 的剩余确实由 30 掉到 29;对照组房型 5 的单含今天,它的今日可售确实 40→37。
   证据:`goods_daily_stock` 当时只有 `sku 6 / 2026-09-17` 一行(由订单 id=3 补建),
   没有 `sku 6 / 2026-09-16`。
2. **那笔单为什么是"明天"**:订房向导 `normalizeDates()` 在**拿不到日期**时把兜底写死成
   「明天起 1 晚」(`dayAfter(1)/dayAfter(2)`),而「我的精选」入口只传 `propertyId`
   (`MyPickScreen.tsx:191` / `MyPickLiteScreen.tsx:174` → `HotelDetailScreen.tsx:102`)——
   用户以为订的是"今天",系统静默订成"明天";搜索页默认却是「今天 → 后天」
   (`defaultDateRange(2)`),两处口径不一致。
3. **顺带推翻**:原计划的「审核通过时预生成日库存行」**治不了这个现象** —— 生成出来的
   "今天"那一行 `stock_total` 同样是 30、`sold/locked` 同样是 0,页面还是 30。
   该方案已放弃(仅"把兜底值固化成真实行",与本次症状无关)。

**修复 A(后端 + merchant-web):客房列表下发并展示未来窗口**
- `RoomController::appendAvailability` 一次取 `today .. today+7` 的库存行,新增
  `upcoming_days`(固定 7)、`upcoming_stock_left`(明天起窗口内**未关房**日期的最低剩余)、
  `upcoming_stock_date`(最低值所在日期,全关房为空串)、`upcoming_sold`(**明天起**窗口内已售+锁定间夜)。
  无日库存记录的日期仍按房型默认可售配额兜底(与 C 端日历同口径)。
- merchant-web 卡片在「今日可售」旁显示「未来 7 天最低 29 · 9/18」,`upcoming_sold > 0`
  (即有非今日订单)时用警示色高亮;助手 `upcomingLabel/upcomingTight` 落在 `presentation.ts`。

**修复 B(client-app):订房向导缺省日期与搜索页口径统一**
- `bookingFormat.ts::normalizeDates` 兜底由「明天起 1 晚」改为「**今天起 2 晚**」,与
  `DatePickerSheet.defaultDateRange(2)`(以及完整版/关怀版搜索页)一致;
  `useBookingWizard.ts` 与 `navigation/types.ts` 的注释同步。
- 「我的精选 → 酒店详情 → 订房向导」这条不带日期的链路因此不再静默挪到明天。

**验证**
- 新增 `backend/services/goods-service/test/room-list-availability.php`(13 条断言,已并入
  `scripts/test-room-remediation.sh` 的 goods-service 用例列表):无订单时今日=未来窗口=默认配额;
  复刻 `OrderStockService::lock()` 只订明天后,**今日不变、窗口 30→29、最低日期=明天、已订 1 间夜**;
  关房日不计入最低值(最低日期顺延)。客房整改全套(room-review/room-list-availability/
  room-content/room-media/room-contract)通过。
- 质量基线(本机无 pwsh,`scripts/check.ps1` 按等价分步执行并在容器内跑前两步):
  后端 **390 文件 `php -l` 零错**、shared **97 用例/968 断言全绿**、admin-web build 通过、
  client-app typecheck 零报错;另跑 merchant-web build 通过。
- 逻辑断言:`normalizeDates` 6 组(Node 直跑 `bookingFormat.ts`,覆盖缺省/空串/离店不晚于入住/
  过去日期/正常区间透传)、merchant-web 展示助手 7 组(中英双语 + 空值 + 全关房)。
- 真库核验(站点 7 / 商户 6,容器内直调 `RoomController::index()`):
  `room 6 today=28 upcoming=29@2026-09-18`(今天 2 单、明天 1 晚)、`room 5 today=37`;
  经网关未登录探活 `GET /api/v1/merchant/rooms/list` 返回标准 `40101` 信封。
- 已 `./mtrip.sh restart goods-service goods-service-app` + `restart gateway`(Swoole 进程启动即
  加载类,改 PHP 必须重启;`restart` 不刷网关,故网关单独重启),`./mtrip.sh health` 全绿。

**未做 / 遗留**
1. **没有做登录态浏览器点击走查**:merchant-web(5174)是 Vite dev、改动已 HMR;本轮只做到
   接口级(真库 Controller 调用)+ 展示助手级断言,页面视觉请在有会话的浏览器里复核一眼。
2. **"今天"的时区口径仍是隐患**:容器/PHP 为 UTC(`date.timezone` 未配置),后端 `date('Y-m-d')`
   取的是 UTC 日期,而 C 端传的是设备本地日期;北京时间 00:00–08:00 期间二者差一天,
   列表的「今日可售/未来窗口」会整体错位一天。本轮未改(需要统一 `TZ` 或由服务端下发"业务今天")。
3. 门票下单页 `OrderConfirmScreen` 的默认日期仍是「明天起 1 晚」,本轮只统一了酒店订房向导。

### ★ 2026-09-16(客房默认可售配额回退修复:C 端下单 409「库存不足」根因)

**问题**:`POST /api/v1/app/order/create` 在无日库存记录时抛 `DATA_CONFLICT`(409)「2026-09-16 库存不足」
(`OrderStockService.php:72`)。

**根因**:不在数据,在 `backend/shared/src/Support/RoomDefaults.php` 的 `stock()` 写成
`launch_stock ?? base_stock`。`??` 是空合并,只在键为 null/缺失时回退,而 merchant-web 新建房型的
`launch_stock` 初值就是 **0**(`RoomEditor.vue` 的 `draft` 初值 0;`validBasics` 只校验“不超过
base_stock”、不校验 >0)。于是“填了客房总数、没填默认可售配额”的房型走过 `OrderStockService::lock()`
时被补建成 `stock_total = RoomDefaults::stock($sku) = 0`, `available = 0 - 0 - 0 < 1` → 409。

- 同一函数的另一个消费方消费者日历(`HotelController:193`)也长期返回 `stock=0`,而价格
  19500 / 周末 20000 完全正常 —— 反证问题只在 `stock()` 一个函数。
- `goods_daily_stock` 全表 0 行也是旁证:每次都是补建后抛错、随事务回滚,所以库里看不到那行 0。

**修复**:改为 `launch_stock > 0 ? launch_stock : base_stock`,0/null/缺失一律视为“未设置”;真正的
“不卖”应走停售 `status=2` 或单日 `is_closed`。`backend/shared/tests/cases/SupportTest.php` 补
0/null/缺失/负数回退与周末价回退用例。

**验证**:shared 单测 95 用例/957 断言 → **97/968 全绿**;开发库房型 5(物业 7「胤竹酒店」/标准间)
的 `launch_stock` 由 0 设为 40,消费者日历 `stock` 由 0 恢复为 40;`goods_daily_stock` 补建 INSERT 的
无默认值非空列(仅 `sku_id`/`stock_date`)已核对,均显式提供;`./mtrip.sh health` 全绿。

**遗留**:无。同日已把 merchant-web 侧一并收口(`merchant-web/src/views/rooms/components/RoomEditor.vue`):**①** 客房总数变化时,尚未设置(`0`)或仍在跟随(等于上一个客房总数)的默认可售配额自动同步,商户显式填过的更小值不覆盖;**②** 打开编辑器时把历史 `launch_stock=0` 按客房总数补上(存量坏数据由此自愈),且补值写在 `baseline` 捕获之前,不会出现"打开即脏/误弹放弃修改";**③** 提交审核时若 `base_stock > 0` 而 `launch_stock <= 0` 直接拦截并提示(仅提交拦截,草稿仍允许不完整,与原有校验口径一致;`base_stock = 0` 的复制草稿不拦)。验证:用 merchant-web 自带 `vue` 在 Node 里以**真实 `watch` 语义**跑 13 条断言覆盖上述分支(含 pre-flush 时机与 baseline 交互)全绿,`npm run build`(`vue-tsc --noEmit` + vite)通过。

**本轮排查顺带确认的三个环境陷阱**(已按用户授权临时处理,**勿当成已修复**):

1. **`./mtrip.sh restart <服务>` 不刷新网关**:`docker restart` 会释放并重新分配容器 IP,而
   `cmd_restart()` 没有像 `cmd_start`/`cmd_build` 那样调用 `refresh_gateway()`。本次重启 4 个服务后
   网关仍连旧 IP `172.18.0.11`(实际已变 `172.18.0.15`),全量 `50200`,手动 `restart gateway` 才恢复。
   `CLAUDE.md` 里“网关会在 start/build 后自动刷新”这句对 restart 不成立 —— 属脚本缺口。
2. **C 端签名/传输加密的临时开关仍在 `deploy/.env`**(该文件 gitignored):`MTRIP_CLIENT_SIGN=false`、
   `MTRIP_PAYLOAD_ENCRYPT=false`。成因是 `client-app/.env` 的 `EXPO_PUBLIC_CLIENT_ID/SECRET` 为空,
   且 `sys_client` 表 0 行(无任何迁移/种子创建客户端;只能走 admin-web「配置→客户端管理」生成
   `mtc_*`,而 `client-app/.env.production` 里写死的 `mtrip_h5` 格式对不上、库里也查不到)。
   **二者不对称**:签名可以只靠服务端开关绕过,但传输加密的密钥就是客户端密钥本身
   (`PayloadDecryptMiddleware::resolveSecret` → `ClientSecretResolver::secretByClientId`),客户端不带
   密钥时服务端无法解密,所以改开关期间必须**同时保持**客户端密钥为空;一旦填了密钥就必须先建好
   `sys_client` 行,否则回到 40103。
3. **站点隔离 + 账号按站点绑定**:`AbstractController::siteId()` 登录态优先取 **JWT 里的 `site_id`**
   (游客才读 `X-Site-Id` 头);`login`/`register` 按 `site_id` 过滤用户、`issueToken` 把站点写进 token,
   故站点 1 的账号在站点 7 登不上(表现为「手机号或密码错误」)。App 的 `SiteSelectScreen.select()`
   切站点只 `switchSite` + `goBack`、**不清登录态**,会出现“列表按新站点、下单按旧站点”的不一致。
   本轮 404 即由此而来:物业 7/房型 5 属站点 7,用户在站点 1 注册 → `hotelTarget()` 查 `site_id=1`
   落空 → 业务 404「酒店物业不存在或暂不可预订」(`40401` 同样映射 HTTP 404,与路由 404 同形)。

本轮只做诊断与上述 `RoomDefaults` 修复,未修改两个 App 功能代码,未执行 Git 写操作。

### ★ 2026-09-16(恢复注册的真实短信 OTP:撤销临时固定码页)

**触发**:SMSPoh 已可测试,后台已在「配置 → 短信配置」添加渠道。

**改动:按上一条留的删除清单删,四处 + 一个文件,没有新写代码**

| 位置 | 删了什么 |
|---|---|
| `screens/user/FixedOtpScreen.tsx` | 整个文件 |
| `screens/user/RegisterScreen.tsx` | `USE_FIXED_OTP` 常量 + 那段 `if (USE_FIXED_OTP)` 跳转 |
| `navigation/index.tsx` | `FixedOtpScreen` 的 import 与 `<Stack.Screen name="FixedOtp">` |
| `navigation/types.ts` | `FixedOtp: { draft: SignupDraft }` 路由项 |

删完注册自动回到原链路:
`Register →(sms/send scene=register)→ VerifyOtp →(sms/verify 换一次性 verifyToken)→ ReferralCode(带 token 提交注册)`。
`VerifyOtpScreen` 自始至终原样保留、一行没动过,`RegisterScreen` 里原有的发码逻辑
(含「渠道未配 → 50021 → 跳过验证码页直接去推荐码页」的兜底分支)也一直在,所以是纯删除。

**这次是必修,不是清理**

后台新配的渠道让 `SmsVerifyService::enabled()` 对所有站点恒为 true,
而 `AuthController::register` 的策略是「渠道启用即强制」(`if ($smsRequired) assertTicket(...)`)——
固定码页是纯前端校验、永远拿不到 `verifyToken`,**留着的话每一次注册都会被 `40111` 打回**。

渠道行:`mtrip_system.sys_sms_channel` id=4,`provider_code=smspoh` / `status=1` /
`site_id=0`(全局,对所有站点生效)/ `deleted_at IS NULL` / `sign_name=SMSPohTest`。
(同表 id=2、id=3 两行分别被软删与停用,会被 `channel()` 的 `status=1 + whereNull(deleted_at)` 排掉。)

**验证**

1. **渠道确实能解析**:把 `api_key`/`api_secret` 密文取出,在 `mtrip-user-service-1` 容器内
   用它自己的 `MTRIP_AES_KEY` 走 AES-256-GCM 解密成功(41 / 32 字符),`sign_name` 非空。
   这四项正是 `channel()` 返回 null 的全部条件,故 `50021 短信服务未配置` 不可能再出现。
2. **反证渠道已生效**:经网关不带 `verifyToken` 调 `POST /api/v1/app/auth/register`
   → `40111 请先完成手机号短信验证`,且 `user_info` 行数 **6 → 6 无副作用**
   (若渠道未生效,这一调用会直接建号成功)。
3. `client-app` typecheck 零报错;全仓已无 `FixedOtp` / `USE_FIXED_OTP` 残留;
   后端也确认没有 `MTRIP_SMS_BYPASS_CODE` 一类的万能码残留(那一版早已整体回滚)。

**未做**:**真实收发短信的端到端没跑** —— 需要一个能收码的真实缅甸号码,
且发码会真的产生一条短信与费用,留给你用自己的号码自测:
注册页填号 → 收码 → 验证码页填入 → 推荐码页 Continue/Skip → 应建号成功。
若发码报服务商侧错误(号码前缀、余额、凭证),看 `sys_sms_log` 与 user-service 日志。

### ★ 2026-09-16(merchant-web 客房列表 `metrics` 空值兼容)

**现象**：进入 `/rooms` 后，`index.vue` 渲染 `metrics.totalRooms` 时抛出 `Cannot read properties of undefined`。页面虽然为 `metrics` 提供了初始值，但列表请求成功后无条件执行 `metrics.value = data.metrics`；只要运行中的接口实例未携带新增统计字段或返回空值，安全初始值就会被覆盖为 `undefined`。

**修复**：`apiRoomList` 将运行时可能缺失的 `metrics` 明确为可选/可空；页面通过 `normalizeMetrics()` 统一将缺失或结构异常的统计归一为 `{ totalRooms: 0, roomTypes: [] }`，并对 `totalRooms` 做数值归一。请求失败时同步清空 `list`、`total` 和 `metrics`，避免物业切换或重试后残留旧数据。当前 goods-service 源码仍按统一分页结构附带真实 `metrics`，正常响应不受影响。

**验证**：`merchant-web npm run build` 通过（`vue-tsc --noEmit && vite build`）；仅有既有的大 chunk 提示。

### ★ 2026-09-16(指定 Git 基线后的数据库增量复核)

按用户要求以提交 `2a32fe1996376e3b917aba838e2560ef52760217` 为起点复核并执行数据库增量。该提交本身没有数据库变更；从该提交（含）到当前 `dev` 的版本化迁移共新增 16 个。`scripts/db-migrate.sh --validate` 校验当前 18 个版本全部通过，`--status` 与正式 apply 均显示已执行 18、待执行 0；apply 随后再次完成全账本复核，数据库已是最新版本，没有重复执行已登记 SQL，也没有失败项。

### ★ 2026-09-16(关怀模式结果页取数对齐完整版:`/app/goods/list` → `/app/hotels/list`)

**问题**:`HotelResultsLiteScreen` 此前用 `fetchGoodsList({goodsType: GOODS_TYPE.HOTEL, …})`
打 `/api/v1/app/goods/list`,而 `GoodsController::list`(`goods-service`)第 100 行明确
`if (! in_array($goodsType, [0, 2], true)) throw PARAM_ERROR('当前商品接口仅支持门票')` ——
**带 `goodsType=1`(酒店)的这个请求必被 400 打回**,关怀模式结果页只能落到错误态,
拿不到任何真实酒店。

**修复**:改用完整版同一个端点 `fetchHotelList`(`/api/v1/app/hotels/list`,见 `HotelController::list`)。
两者同源 `MarketplaceReader::searchable`,字段一致(卡片要的 `minPrice` / `minPriceCitizen` /
`rating` / `goods_name` / `property_id` 都在),`sortBy` 的 default 语义也都是 ranking(`rank` 默认序)。

- `HotelResultsLiteScreen`:`import` 与 `load()` 换成 `fetchHotelList`;`query` 去掉 `goodsType`
  (hotels 端点本身就是酒店口径,不认这个参数),并补上完整版同款可选 `countryCode` / `cityKey`。
- `navigation/types.ts`:`HotelResultsLite` 路由参数补 `countryCode?` / `cityKey?`(完整版 `HotelResults` 早有),
  Lite 搜索页暂时不传,留着与完整版同一套参数面。
- Lite 稿**没有**排序面板与 chips 行,所以 `sortBy` / `reviewScore` / `breakfast` / `freeCancel` /
  `amenities` 一律不发 —— 请求参数取「完整版查询去掉 Lite 版式不提供的那些控件」。
- `GOODS_TYPE` 在本文件已无引用,import 一并删掉(常量本身其它页面还在用,不动)。

**同类隐患(本次未动,留作待办)**:`/app/goods/list` 收 `goodsType=1` 是**全仓通用的坑** ——
`HomeScreen:112/166/207`(PromoCard 与 Stays 的 See all 走 `goList(GOODS_TYPE.HOTEL)`)
和 `MyPickScreen:240` 都把它塞进 `GoodsList` 路由,那个页面照样会 400。
酒店入口正确的落点是 `Hotels`(完整模式)/ `HotelsLite`(关怀模式),不是商品列表页。

**验证**:`client-app` typecheck 待跑 —— 本次会话 DSH 的 shell 起不来(`pwsh` 任意命令均返回
`3221225794` = `STATUS_DLL_INIT_FAILED`,连 `Write-Output` 都失败),`npm run typecheck` 无法在本轮执行,
**下次接手请先补跑**。改动只涉及一个 import / 一处调用点 / 一处 `useMemo` / 一处路由类型,无逻辑风险。

### ★ 2026-09-16(酒店页用户指引 Coach Mark 七步,Figma section `Hotel Search Coach mark UI` `2150:4865`)

**范围**:七步 coach mark,讲完整条订房链路 ——
目的地 → 日期 → 住客 → 选酒店 → 选房 → 填资料 → 付款。

**入口三处**(用户指定「筛选旁边的问号」):

| 页面 | 入口 |
|---|---|
| `HotelsScreen`(完整版搜索页) | 顶栏筛选旁新增 `questionCircle` 圆按钮 |
| `HotelResultsScreen`(完整版结果页) | 同上 |
| `HotelsLiteScreen`(关怀版搜索页) | 顶栏「how do I book ?」药片(原 `comingSoon` 死链)接到同一浮层,传 `lite` |

**不自动弹**,只有点问号才出(用户明确要求);左上角 Skip Tutorial 是快速关闭,不记「已看过」标志。

**新增两个文件**

- `components/hotel/guide/HotelGuideOverlay.tsx` —— 遮罩 / 箭头 / 文案 / 底部控件 / 步进
- `components/hotel/guide/guideSteps.tsx` —— 七步插图

**设计稿实测**(取自 Coach Mark 2 `2154:7076` 的 design context,不是目测):
遮罩纯黑 **opacity .95**;文案块宽 320、gap 8;标题 Inter Bold 24 白、说明 Inter 400 16 `#D9E1FB`;
Skip Inter 400 12 白(左 17 / 上 9);底栏宽 370 两端对齐 —— Previous / 7 点 / Next,
按钮 1px `#D9E1FB` 描边、圆角 32、px20 py12。第 1 步没有 Previous,第 7 步主按钮是 Done。
曲线箭头是设计稿导出 SVG 的**单路径,逐字符照搬未重绘**,整体旋转 -53.55°;
因为不是 24 见方的图标字形,没塞进 `HomeIcon` 的图标表,就地内联。

**示例卡复用现成组件 + 设计稿同源演示数据,一个都没新造**

| 步 | 复用 |
|---|---|
| 4 | `HotelResultCard` + `DEMO_RESULTS[0]`(就是稿上那家 Heritage Bagan)+ `DEMO_COVERS`/`DEMO_RATING_TIER`/`DEMO_BADGE`,接线抄 `HotelResultsScreen` 的演示分支 |
| 5 | `HotelRoomCard` + `DETAIL_ROOMS[0]` + `ROOM_FACILITY_ICONS`,接线抄 `HotelRoomsTab` 的演示分支 —— 稿上的 Standard Room / 4 Left / 1 Queen / 32 sqft / MMK 195,000 与这条演示数据**逐字段吻合** |
| 6 | `FormInput`(订房第 2 步同一个),只读 |
| 7 | `PaymentMethodRow` + `TEMP_PAY_ICONS`,与 `BookingStepPayment` 同一套接线 |
| 1/2/3 | 搜索卡里的三个字段,样式取自 `HotelsScreen`,各十几行就地画 |

关怀模式下步 4/5 换 `LiteHotelCard` / `LiteRoomCard`,其余各步与浮层 chrome 字号放大一档。

**已知偏差(都写进了组件头注释)**

- **4~7 步不是真实挖洞高亮**:那四步高亮的元素属于结果页 / 详情页 / 订房页 / 支付页,
  浮层打开时那几个页面并没有挂载。**设计稿本身也是「遮罩 + 把元素副本画在遮罩之上」**
  (design context 里那个副本是独立的绝对定位节点),所以七步统一成「遮罩之上画该步示例卡」。
  遮罩 95% 黑,底层几乎不可见,肉眼差别仅在于透出的那层页面不同。
- 示例卡是**演示数据,不反映用户当前的搜索结果** —— 引导讲的是「长什么样、该看哪几个信息」。
- 步 6 只画三栏:稿上那张卡是四栏 + 提示 + Save Info、整卡近 450 高,叠上箭头与文案后小屏放不下,
  砍掉与姓名说明重复的手机号栏。
- 插图 + 箭头 + 文案放在 ScrollView 里(步 5/6 的卡本身就 400+ 高),底栏与 Skip 固定不滚。

**i18n**:三份各补 18 键(`hotels.guide.*`),加上下面那条修复共 **990**。
**缅文是照着现有 `my-MM.json` 同类措辞拼的,不是母语者产出,需要人工过一遍**
(英文照抄设计稿原文,中文自译)。

**冒烟时抓到一个既有 bug 并修了**:`hotels.detail.rooms.breakfast` 三份 i18n 里**根本不存在**,
而 `components/hotel/lite/LiteRoomCard.tsx:109` 一直在 `t()` 它 —— 于是**关怀模式的房型卡上,
凡是 `breakfast===1` 的房型都会把原始键名 `hotels.detail.rooms.breakfast` 当文案画出来**
(截图里显示为 `hotels.de…`)。这不是本次引导引入的,是引导的第 5 步复用 Lite 房卡后暴露出来的。
已补三份:en `Breakfast` / zh `含早餐` / my `မနက်စာ`(与既有 `facilities.breakfast` =
`Good Breakfast` / 优质早餐 区分开:那条是设施名,这条是房卡上的属性标)。

**验证(本轮真跑了)**

- `client-app` typecheck 零报错;i18n 三份各 **990** 键,零 missing / 零 extra,
  新增键无空值、无「与英文原文相同」的漏译。
- **真机冒烟已做**:`expo start --web` + headless Chrome(402×874,playwright-core 驱动
  本机 Chrome,装在 `C:\temp\mtrip-smoke`,**没往仓库里加任何依赖**)。
  **两种模式各 35 条断言全绿**:
  ① 关怀版点「how do I book ?」/ 完整版点问号 → 浮层打开且从 01 起;
  ② 七步标题逐条对上;③ 第 1 步无 Previous、其余有;④ 每步都有 Skip Tutorial;
  ⑤ 前六步主按钮 Next、第 7 步 Done;⑥ Done 后浮层关闭且回到酒店搜索页;
  ⑦ 重开从第 1 步起;⑧ Next×2 → 第 3 步,Previous → 第 2 步;⑨ Skip Tutorial 能关。
  逐屏看过截图:遮罩 / 箭头 / 白卡 / 七点指示器 / 按钮渲染都对,
  完整版顶栏三枚圆按钮实测坐标 x=20(返回)、298(问号)、346(筛选)—— 问号确实在筛选旁边。
- `scripts/check.ps1` 仍因本机未装 php 停在第 1 步(本次未动 PHP)。

**冒烟环境的两点说明(不是 bug)**

- 金额显示成 `€195,000.00` 而不是稿上的 `MMK 195,000`:后端没起,`siteStore` 取不到站点配置,
  `currency` 停在初值 `'EUR'`(「更多」页的钱包卡同样显示 `EUR 0.00`,全局如此,不只引导)。
  接上网关拿到站点配置即为 MMK。
- 浮层里的示例卡用的是演示数据(Heritage Bagan / Standard Room),这是设计如此,见上面「已知偏差」。

### ★ 2026-09-15(关怀模式订房流程,Figma section `Booking Flow` `759:9777`)

**范围**:关怀模式下单链路的最后一段。此前 Lite 详情页点 Choose 会掉回**完整模式**向导
(`HotelDetailLiteScreen:99` / `RoomDetailLiteScreen:95`),字号从 20/24 骤降到 14/16 ——
现在搜索 → 详情 → 订房 → 成功页全程同一套字号。

**先说设计来源这件事(重要)**:用户指定的 `759:9777` 这个 section,逐帧比对下来
与完整模式早已实现的 `Multi Booking Hotel Booking Flow` `1675:5776` **逐屏同构**
(`224:4808` 与 `1675:6292` 渲染完全一致)—— 即**设计侧没有出订房流程的 Lite 稿**。
所以这一版不是「照着某张 Lite 稿实现」,而是按仓库已确立的关怀模式换算规则从该稿**推导**:
版式不变、每个元素放大一档,与 `components/hotel/lite/liteShared.ts`(详情族)、
`HotelsLiteScreen`(搜索)同一口径。换算表写在
`components/hotel/booking/lite/liteBookingShared.ts` 头部,以后有真 Lite 稿就对着它改。

| 落地 | 说明 |
|---|---|
| `screens/hotel/useBookingWizard.ts` | **新增**:两个模式共用的数据层(状态 / 副作用 / 下单支付) |
| `screens/hotel/HotelBookingScreen.tsx` | 改为消费 Hook,**JSX 与像素零变化** |
| `screens/hotel/HotelBookingLiteScreen.tsx` | **新增**路由 `HotelBookingLite`,4 步同一路由内切换 |
| `screens/hotel/BookingSuccessLiteScreen.tsx` | **新增**路由 `BookingSuccessLite` |
| `components/hotel/booking/lite/` | **新增** `liteBookingShared.ts` + 四个步骤组件 |

- **业务逻辑抽成一份 Hook**(与「我的精选」`useMyPickData` 同一做法):真实/演示两种模式、
  只开通钱包余额渠道、加购与多住宿不提交、优惠券服务端试算 —— 这些口径现在只有一处,
  两种模式算出来的实付金额与用券结果必然一致。完整版页面只改了取值来源,渲染一行没动。
- **复用而不是重写**:日历只给 `BookingCalendar` 加了个 `lite` 尺寸开关(排布与选区数学
  两种模式同一份,不复制 200 行);选券弹窗 `CouponPickerSheet`、支付结果 `AlertDialog`、
  常旅客 `Travelers`、新增旅客 `AddGuest`、保险 `Insurance` 全部复用完整模式那几个。
- **文案零新增**:全部复用 `hotels.booking.*`(与 Lite 详情复用 `hotels.detail.*` 同理),
  i18n 三份仍是 971 键。
- **壳的两处差异**(为了少按几下):顶栏常驻(完整版只有第 1 步有),返回键位置固定;
  吸底栏恒为「预计总价 + 一枚大按钮」,不在第 2~4 步换成左右两枚。

**刻意砍掉的死路(用户确认的口径:砍死路、其余照搬)**

- **多住宿**(`trip` 步 + Add More Stay):后端 `create` 一单只收一个 sku,完整模式真实下单下
  点它本就只弹 Coming soon。Hook 传 `enableMultiStay:false`,序列恒为
  dates → guests → review → payment;**完整模式的多住宿一行没动**。
- 支付页银行卡 / 手机银行**不做展开**(展开后是写死的「Visa **** 3456」示例卡,渠道还没开通);
  支付汇总卡**不放 View Details**(跳的是完整版版式的 `StayDetail`,字号会突然变小);
  成功页去掉「探索当地玩乐」引流卡(comingSoon 死链)。
- 加购(早餐/接送/保险)照完整模式**只展示不提交**;真实模式不画 Tax & Service Fees
  (后端 `PricingService` 没有税费概念);渠道只开钱包余额 —— 三条都与完整模式逐条一致。

**顺带修掉 3 处既有类型错**(都在上一批未提交的 Lite 文件里,与本次改动无关但挡着 typecheck):
`HotelDetailLite` / `RoomDetailLite` 传给向导的 `goodsId/skuId` 应为 `propertyId/roomTypeId`
(物业收敛后向导只认后者);`HotelResultsLite` 的收藏映射 `f.goods_id` 应为 `f.property_id`
(`FavoriteItem` 早已改名)。

**验证**:`client-app` typecheck 零报错;新页面用到的 113 个 i18n 字面量键在三份语言文件里
逐键核对存在,三份键数均为 971。**`scripts/check.ps1` 没能跑完** —— 本机未安装 php,
停在第 1 步后端 lint(本次一行 PHP 都没动);admin-web build 同理未跑。
**未做真机 / H5 冒烟**,建议五条:① Lite 详情 Choose 进的是 Lite 向导;② 四步字号与 Lite 详情同档;
③ 日历半选(只点了入住日)时 Continue 应被拦下;④ 真实模式余额充足走完支付 → 落 **Lite 成功页**,
核对二维码=`pay` 返回的核销码、金额=`priceDetail.payAmount`,余额不足应在支付步拦下且不建单;
⑤ **回归完整模式**:关掉 Lite Mode 开关,原 `HotelBooking` 四步 + 成功页应与改动前完全一致
(Hook 抽取唯一的风险点就在这)。

### ★ 2026-09-15(关怀模式酒店详情七屏,Figma section `Hotel Details Lite` `2352:5591`)

**范围**:Lite 结果页点 Choose 之后的整条详情链路。七张稿落成 **6 个路由 + 3 个组件**:

| 设计稿 | 落地 |
|---|---|
| Lite Hotel Details `2492:10399`(单选)+ `2707:13098`(多选) | `HotelDetailLiteScreen`(一页两态) |
| Rooms Details `2352:6030` | `RoomDetailLiteScreen` |
| Lite Hotel Details Overview `2352:8182`(View Hotel Detail) | `HotelInfoLiteScreen` |
| Lite Hotel Details Policies `2352:8890` | `HotelPolicyLiteScreen` |
| Hotel Details Reviews `2352:6648` | `HotelReviewsLiteScreen` |
| Property Preview `2352:7051` | `PropertyPreviewLiteScreen` |
| Edit Room & Guest `2516:14575` | 上一轮已做的 `GuestRoomSheet`(搜索页共用) |

- **单选/多选是一页两态**:房卡右下角 Choose ⇄ 加减器,标题右侧链接来回切
  (`+ Choose Multiple` / `+ Choose Single`),多选时底部出合计栏(Total Price + 购物车 + Continue)。
  拆两页会让同一张房卡出现两份。
- **新增组件**:`LiteRoomCard`(单选/多选同卡两态)、`liteShared`(四个内容页共用的卡/标题/正文样式,
  与完整模式的 `detailShared` 同一做法)。
- **内容与完整模式同源**:设施 / 周边 / 评价 / 政策四段直接复用 `screens/hotel/detailDemo.ts`
  与 `hotels.detail.*` 文案(完整版页签用的就是这份)—— **不另造一套 Lite 数据**,
  否则同一家酒店在两种模式下会给出不同的分数与政策。
- **退改规则是真的**:政策页按 `/app/goods/detail` 的 `refundRules.rule_type`
  (1 免费取消 / 2 阶梯 / 3 不可退)出文案,无规则按「免费取消」——与 order-service
  `computeRefund` 的兜底(无规则=全额可退)一致。
- **入口改跳**:Lite 结果页的卡片由 `HotelDetail` 改跳 `HotelDetailLite`,
  关怀模式从搜索到选房全程留在 Lite 版;完整模式一行没动。
- 新增三枚图标(`eyeCircle` / `cart` / `documentList`),字形取自设计稿自己导出的 fluent SVG;
  `imageCopy` 项目里本来就有,**去重后复用原有那枚**(第一版加重了,typecheck 报 TS1117 才发现)。
- i18n 三份各补 ~40 键(`hotels.lite.*` 扩展),评论卡三条正文照抄设计稿。

**没做 / 刻意偏离(都因为后端没有对应数据,不编造)**

- **多选只算合计,不多间下单**:后端一单只收一个 sku,Continue 仍带**第一个选中的房型**
  进订房向导,其余间数只体现在合计上。真正的多房间下单要等**订房流程 Lite 版**与后端多 sku 支持。
- 房型详情页**没画「Tax & Service Fees (15%)」**:下单接口算的实付里没有这笔税费,
  画上去会与结账页对不上;有入离日期时改成「单价 × 晚数」。「Loyalty Status」模块同样没做(无接口)。
- 设施卡设计稿分 ESSENTIALS / RECREATION / DINING 三组,`hotel_room_type.facilities`
  是一维数组、没有分类字段 —— 房型详情页平铺一组。
- 评分、评论、周边景点仍是设计稿数值(**后端没有评价接口**,完整模式同此状态)。
- 360°/视频播放、地图、Property Preview 的区域页签切换一律 comingSoon(无对应依赖)。

**验证**:`client-app` typecheck 零报错(过程中真抓到上面那条图标重复)。
**i18n 三份补键结构对称**(逐键核对过 detailTitle / chooseMultiRoom / outOfTen 等代表键三份齐平),
但**收尾时本机 Bash 被限流,`node` 的 missing/extra 脚本这次没能跑**,下次会话补一次。
**未做真机 / H5 冒烟**:建议冒烟五条 —— 结果页 Choose 进 Lite 详情、单选 Choose 进订房向导、
多选加减与合计、See Room 进房型详情、View Hotel Detail / Hotel Policy 两个入口。

### ★ 2026-09-15(关怀模式酒店搜索三屏,Figma section `Hotel Search Lite` `2312:6435`)

**范围**:Lite 版酒店搜索页 + 结果页 + 筛选浮层。入口:**关怀模式首页的 Hotels 卡改跳 Lite 搜索页**
(`LITE_SERVICES.hotels.route` 由 `Hotels` 改成 `HotelsLite`),完整模式首页仍走完整版 `Hotels`。

- **一页四态,不拆四个页面**:设计稿 Search 14 `2312:6436`(默认)/ 15 `2312:6582`(聚焦)/
  16 `2312:6653`(输入中)/ 18 `2492:9680`(已选目的地)是同一页的四个状态,
  落成 `HotelsLiteScreen` 一个组件 + 一个 `focused` 状态。
- **只留搜索卡**:完整版 `HotelsScreen` 卡下面的阶梯折扣卡 / 促销卡 / 广告位,关怀稿里全部没有,没有补。
  每个元素放大一档(标题 24→32、搜索框文字 16→24、CTA 16→24)。
- **新增两个组件**:`components/hotel/lite/LiteHotelCard.tsx`(结果大卡:星 24 / 心 32 /
  酒店名 24 / 价 20 + Choose 按钮,去掉地址与右下角徽章)与
  `components/hotel/lite/GuestRoomSheet.tsx`(`2516:14575` Edit Room & Guest,
  三行加减**复用订房向导的 `GuestCounterRow`**,不另写)。
- **筛选浮层直接复用完整模式的 `HotelFilterSheet`(408:1824)**:Lite 稿 `2485:7101`
  与它逐段同构(Filter By / Recent Filters / Budget 直方图+双滑块 / Popular Filters / Show Results),
  没有需要放大的差异,再抄一份只会多一处要同步维护的地方。
- **日期复用 `DatePickerSheet`**;结果页数据、收藏、上拉加载与完整版同一套
  (`/app/hotels/list` + `user/favorite/*`,见顶部 2026-09-16 那条修复),卡片封面同样走 `tempCoverFor(index)` 兜底。
- **最近搜索是真的**:存本地 `mtrip:hotel-recent`(最多 3 条,`useFocusEffect` 每次回页重读),
  搜索时写入、点一条即回填目的地。设计稿那三条静态示例没有照抄。
- **新增一枚图标** `HomeIcon.mic`:字形取自设计稿自己导出的 `fluent:mic-20-filled` SVG 路径,不是手画的。
  其余图标(search/calendar2/people/checkbox/info/star/heart/filter/location/map/clock/
  arrowLeft/questionCircle)项目里都已有同名 fluent 字形。
- 大图**沿用现成的 `assets/images/hotels/hero.png`** —— 比对过,Lite 稿用的就是这张,没有重复导出。
- i18n 三份各补 26 键(`hotels.lite.*`,885→912,零 missing / 零 extra)。

**没做 / 刻意偏离**

- **没有地点库**,所以「输入中」那一屏的联想列表(Bagan Location / Bagan Hotel…)没有照抄,
  改成一行「用当前输入搜索」+ Nearby / Search on Map / 最近搜索。编造假联想词会让人以为能搜到。
- Nearby、Search on Map、语音搜索、「how do I book ?」、Myanmar Citizen 的说明一律 comingSoon
  (与完整模式同口径:没有定位 / 地图 SDK / 语音能力)。
- **房间与入住人只带在路由参数里回显**,不参与 `/app/hotels/list` 请求 —— 接口没有这些参数
  (日期同理,完整模式也是这样)。筛选项同样只留在前端状态。
- 结果页的「Choose」与整卡点击都进 `HotelDetail`(与完整模式一致),不是直接下单。

**验证**:`client-app` typecheck 零报错;i18n 三份 912 键零差异。
**未做真机 / H5 冒烟**(本轮纯前端新页面),建议冒烟四条:Lite 首页 Hotels 卡进新页、
搜索后结果页能出真实酒店、收藏心形能落库、筛选浮层能打开并应用。

### ★ 2026-09-15(注册页邮箱换姓名 + 登录/注册右上角按钮改版稿)

**范围**:client-app 注册表单的第二栏由「邮箱」换成「姓名」并真的落库;
`AuthShell` 右上角的登录/注册入口按改版稿 Figma Onboarding `2540:13083` 换成深色药丸按钮。
**其余样式一律未动**(用户明确要求)。

- **姓名落 `user_info.real_name`**(AES 加密列,与手机号同级):
  `AuthController::register` 新收 `realName`(截断 50 字),
  `UserAuthService::register` 末尾加可选参 `$realName`,在建号 insert 里加密写入。
  **刻意不动 `real_name_status`** —— 用户自己填的名字不等于通过实名认证,
  那个字段归 KYC 流程。也**没有顺手写进 `nickname`**(用户只要求落 real_name),
  所以昵称仍是后端自动生成的「User+手机后四位」。
- **姓名为必填**:原邮箱栏是「选填 + 填了才校验」,姓名换上来后改为必填
  (CTA 禁用态也把它算进去)—— 一个存进 `real_name` 的姓名留空没有意义。
  校验只查非空,不做格式校验(姓名没有通用格式)。
- 图标用设计稿同款 `fluent:rename-a-20-filled`(HomeIcon 里已有 `renameA`,Account 页在用),
  占位符走新键 `user.namePlaceholder` = "Enter your name"(三语,i18n 883→885)。
- `SignupDraft.email?` → `realName: string`(必填),`ReferralCodeScreen` 提交时透传;
  `apiRegister` 的 `email?` 入参同步换成 `realName?`。
  **`user.emailPlaceholder` / `user.invalidEmail` 两个键留着没删**(后续「完善资料」页还会用到邮箱)。
- **右上角按钮**(Figma Login `2540:13084` 节点 `2540:13182` / Signup `2540:13284` 同款):
  由纯白文字链改成**黑 25% 底、圆角 20、px12 py8 的药丸**,文字 Inter SemiBold **20/24** 白色
  (原 16/24)。改在 `AuthShell` 一处,**登录 / 注册 / 验证码 / 推荐码 / 忘记密码五屏同时生效** ——
  它们本来就共用这一条顶部栏,分开改会让同一套版式出现两种按钮。
  左侧返回键(设计稿把图标从 20 放大到 32)**按「其他样式不改」的要求保持原样**。

**没做的部分(别当成漏做)**

- 改版稿 Signup `2540:13284` 里**没有姓名栏**(姓名在其后的 "Complete Your Profile"
  `2540:13764` 那一屏),本次是按用户要求把姓名放进注册表单,不是照搬该稿。
- 改版稿的手机号占位符写的是 "enter your phone number"(现为 `9xxxxxxxx`)、
  登录页 CTA 20px 等差异**一律未动**。
- 「完善资料」两屏(头像 / 生日 / 性别 / 城市 / 地址、证件与自拍认证)整体未做。

**验证(已补齐,含真库冒烟)**

- **真库端到端跑通**:网关 8081 走完 `sms/send` → `sms/verify`(固定码 123456)→ `register`
  (带 `realName`),新用户 `user_info.real_name` 落了 **52 字节密文**,
  在容器内用 `CryptoHelper::decrypt` + `MTRIP_AES_KEY` 解回 `Kyaw Test`,
  `real_name_status` 保持 0。冒烟用户(id 18)与其 `user_referral` / `user_action_log`
  已逐表删除复核。顺带证明了固定直通码那一条也是通的。
- `client-app` typecheck 零报错、后端两个文件 `php -l` 通过、shared 98 用例 / 965 断言全绿;
  i18n 三份 885 键零 missing / 零 extra。
- **typecheck 在这一轮真抓到一个错**:`userStore.register` 的 `extra` 形参类型还写着
  `email?`,没跟着换成 `realName?` —— 已修。教训:改注册入参要连 store 的形参类型一起搜。

**踩坑:改完代码必须重启服务,容器里挂的是新代码但进程是旧的**

用户反馈「填了姓名没写进库」,排查后发现代码本身没问题 —— `docker exec` 进去 `grep`,
挂载的 `UserAuthService.php` 已经是新版,但容器已经跑了 6 小时:**Swoole 常驻进程在启动时
就把类加载进内存了,改文件不会热生效**。`./mtrip.sh restart user-service` 与
**`user-service-app`(C 端 `/api/v1/app/*` 走的是这个孪生,必须单独重启)** 之后立刻正常。
判断依据是 `docker inspect -f '{{.State.StartedAt}}'` 与出问题那条注册记录的 `register_time`
一比对:注册发生在容器启动之后、改代码之前。

### ★ 2026-09-15(【临时】注册验证码改为纯前端固定码页 123456)—— **已于 2026-09-16 整体撤销,见本文件顶部那条**

**范围**:client-app **新增一页** `screens/user/FixedOtpScreen.tsx`(路由 `FixedOtp`),
只认 `123456`、**纯前端校验、不发任何网络请求**。注册流程 `Register → FixedOtp → ReferralCode`。
**后端一行没改**(先前那版 `MTRIP_SMS_BYPASS_CODE` 万能码已整体回滚,见下)。

- **为什么纯前端就够**:后台现在没有启用中的短信渠道,`SmsVerifyService::enabled()` 返回 false,
  `AuthController::register` 的「渠道启用即强制」因此不要 `verifyToken` ——
  过完固定码页直接去推荐码页提交注册即可。**已实测**:`sms/send` 与 `sms/verify` 均回
  `50021 短信服务未配置`,而不带 token 的 `register` 正常成功。
- **真页 `VerifyOtpScreen` 原样留着,一行没动**(先前加在它上面的提示行也已回滚)。
  新页刻意**不复用**它的组件:混在一起会让「哪段是临时的」难分辨,删除时容易误伤。
  版式照搬(AuthShell + 白卡 + 六格 + CTA),但去掉倒计时与 Resend —— 本页根本没发过码。
- **删除清单(接通真实 OTP 时)**:`screens/user/FixedOtpScreen.tsx`、
  `RegisterScreen` 顶部的 `USE_FIXED_OTP` 与 `submit()` 里那段 if、
  `navigation/index.tsx` 的 import + `Stack.Screen`、`navigation/types.ts` 的 `FixedOtp` 路由项。
  删完原有的「发码 → VerifyOtp」链路自动恢复,**四处都带了同一句「临时 · 接通真实 OTP 时删掉」注释**。
- 码填错:把底部那行提示原样弹出来(它本身就写着该填什么)并清空重填。
  文案复用 `user.otp.fixedHint`(三语,这一条 i18n 键保留下来了)。

**回滚掉的东西(先前那版后端万能码,别再去找)**

`SmsVerifyService` 的 `bypassCode()` / `send()` / `verify()` 三处分支、
`config/autoload/mtrip.php` 的 `sms_bypass_code`、`deploy/docker-compose.yml` 与
`.env.example` 的 `MTRIP_SMS_BYPASS_CODE`、shared 的三条对应单测、
`VerifyOtpScreen` 的提示行 —— **全部 `git checkout` 还原**,现在后端不存在任何万能码。
改用纯前端的理由:那一版是**真的认证绕过**(知道手机号就能免密登录他人账号),
而纯前端只影响注册这一条链路,且后端本来就不校验。

**顺带修正的一个事实**:先前那版开着时,**删光短信渠道也关不掉它**(开关与渠道解耦,
`enabled()` 在直通模式下强制返回 true)。这也是改成纯前端的直接原因之一。

**验证**:`client-app` typecheck 零报错;shared 95 用例 / 957 断言(回滚后恢复原数);
真库端到端:`send`/`verify` 双双 `50021`、无 token 注册成功且 `real_name` 落 52 字节密文,
冒烟用户(id 19)已逐表清理。**注意**:后端回滚后必须
`./mtrip.sh restart user-service` 与 `user-service-app`,否则旧进程仍在内存里认 123456(已重启)。

2026-09-16 客房管理列表样式修复：用户报的两个视觉问题都在 `merchant-web/src/views/rooms/index.vue`。① 搜索房型框按用户要求**去掉右侧搜索图标只留输入框**——原先 `a-input-search` 的图标按钮被 antd 固定 32px（特指度盖过全局 `.ant-btn{height:34px}`），而全局 `.ant-input{min-height:34px !important}` 连带把 affix 包裹层撑到 44px（实测 44 vs 32）；现改用仓库既有的 `<a-input class="room-search" allow-clear @press-enter="search" />`（回车查询，`class` 落在 `.ant-input-affix-wrapper` 上），DOM 中不再有 `.ant-input-group`/`.ant-input-search-button`，样式只剩「包裹层 34px 去上下内边距 + 内层 input 中和全局 min-height」两条，实测输入框 260×34、顶底 13/47 与同排下拉框一致。② 客房卡片图片盖住客房信息——`.cover` 是 `display:grid`（行轨 auto），图片 `height:100%` 解析成固有尺寸（实测 597px，溢出 397px），又因 `.cover` 定位而绘制在文字之上（`elementFromPoint` 命中的是 `IMG`）；现改 flex 居中 + `overflow:hidden` + `object-fit:cover`，图片恒等于封面高度（200px，窄屏 210px）。用无头 Chrome 对真实 antd 组件量取前后尺寸并截图对比（临时探针已删除，未入库），merchant-web 生产构建通过。详见[客房整改记录](audits/2026-09-16-room-remediation.md)。

2026-09-16 客房管理物业上下文修复：`apiRoomHotels()` 和 All Properties 列表原会显式发送 `X-Mtrip-Property-Id: 0`，被 `MerchantAuthMiddleware` 按“只接受正整数”拒绝，导致页面进入即提示“物业上下文格式不正确”。`merchant-web/src/api/rooms.ts` 已改为未选物业时省略该头，有效 ID 仍显式发送，全局已选物业仍由通用拦截器补入。merchant-web 生产构建及差异检查通过。

2026-09-16 客房管理整改：[计划](20-客房管理Figma与PRD整改计划.md) 阶段 0–5 已完成。merchant-web 已实现 Figma `930:11444` 卡片列表、More Details 和四步房型编辑，包含多床型、面积换算、图片/视频、WebGL 全景及平面图热点；后端收口站点币种、`launch_stock` 默认配额、周末价、取消规则快照、媒体归属/内容校验、审批期间紧急停售和订单删除门禁；admin 房型审核可预览新媒体。消费者房型使用已批准白名单投影，退款仍走 `refundRules`。`V20260916005000` 已应用，账本 18/18；客房专项 61 场景、物业发布/消费者回归、389 PHP lint、shared 95/957、双 Web 构建、client 类型检查、OpenResty/DDL/差异检查及桌面/窄屏检查通过。外部 VR/PMS 待服务商；未修改两个 App 功能代码。详见[验收记录](audits/2026-09-16-room-remediation.md)。

2026-09-15 Hotel Amenities：按 Figma `696:4238` / `743:4446` 开放物业设施页签及查看/编辑、新增、删除、启用、亮点和图标选择。新增 `merchant_store.amenities` 结构化 JSON 并进入既有资料审核版本；启用的非标签项继续投影到 `facilities`，旧数据自动回退，消费者与两个 App 未改。`V20260916004000` 已应用；隔离发布/消费者回归和双 Web 构建通过。详见[模块13](13-商家端merchant-web落地.md)。

2026-09-15 酒店物业详情界面：按 Figma `696:4024` 主页面和 `712:6419` 编辑页面完成三项真实指标、六页签及 Hotel Details 整页编辑。新增双电话（主表与修订均 AES 密文）、邮箱、经纬度、物业图片上传和启停状态；`image_gallery` 保留全部图片，`images` 仅向消费者投影启用 URL。地图暂为静态占位，两个 App 未改。`V20260916003000` 已应用；隔离发布链路、merchant/admin 构建、383 PHP lint、95 shared 测试及桌面/手机预览通过。详见[模块13](13-商家端merchant-web落地.md)。

2026-09-15 本地提交归档：按用户授权统一提交当前商户入驻、酒店物业模型、三端适配、迁移及测试文档，基于 dev `29614ea` 保留双方改动；由用户自行推送。详见[提交记录](audits/2026-09-15-local-dev-commit.md)。

2026-09-15 dev 同步：已从 `14bbd94` 快进至 `29614ea`，保留本地未提交改动及远端余额支付、关怀模式和登录注册更新。三个冲突文件已整合，物业收藏逻辑迁入共享 `useMyPickData`，关怀模式酒店详情参数同步为 `propertyId`。本地原始改动保留于 stash `codex-backup-before-dev-sync-2026-09-15`；client-app 类型检查通过。

### ★ 2026-09-15(C 端支付只留余额一种,余额真扣款并落流水)

**范围**:client-app 的两个支付入口(订房向导 Step 4、订单详情待支付)——
除 mTrip 钱包余额外的渠道全部停用,余额支付从 mock 变成真扣款。

- **后端只加一个渠道码,不改口径**:`OrderController::pay` 的 `payMethod` 白名单
  `[1,2]` → `[1,2,3]`,**3 = 余额**。选 3 才是真金白银:同一事务内
  `WalletService::debit()` 行锁 `user_info` 扣款 → 写 `user_balance_log`
  (`change_type=2` 消费,`amount` **记负数**,带前后余额快照)→ `PaymentResultHandler::markPaid`
  置已支付并生成核销码 → 写 `finance_flow`(`flow_type=1` / `biz_type=1` / `pay_channel=3` /
  `trade_no=WALLET+流水号`)→ 扣库存。任一步抛错整单回滚,不会出现「扣了钱订单还待支付」。
- **`debit()` 与既有 `credit()` 成对**(退款/推荐返利走 credit)。余额不足抛
  `DATA_CONFLICT`「钱包余额不足」;比较时留 0.005 容差 —— 余额是 `DECIMAL(12,2)`,
  转成 float 后「刚好够」会被浮点尾差判成不足。
- **mock 渠道不写资金流水**:1/2 没有真实资金进来,写进 `finance_flow` 会污染对账。
- **`pay_method=3` 不是新发明**:admin-web 订单页早就有 `order.payMethod.balance` 的映射,
  所以**没有改库表结构与列注释**(列是 TINYINT,存 3 本来就合法;为一条注释去 MODIFY
  月分表模板不划算)。
- **前端置灰而不是删掉**:MMQR / KBZPay / Wave Pay / 到店付 / 银行卡 / 手机银行 /
  Stripe / PayPal 保留在页面上,`PaymentMethodRow` 新增 `disabled` + `badge` 两个 prop,
  整行 45% 透明度 + 「Coming soon」角标,点按只弹提示、**不会被选中**,也不发请求。
  删掉的话设计稿走查会以为漏做,而且渠道接通时要重做一遍。
- **余额显示改吃真实值**:钱包渐变卡与「Pay with mTrip Wallet」那行读 `/app/user/me` 的
  `balance`(演示模式仍回落 `bookingDemo.walletBalance`)。
  **进支付步 / 打开待支付订单详情会先 `refreshProfile()` 一次** —— 本地资料是启动时从
  AsyncStorage 恢复的,拿旧余额会把钱够的用户误判成「余额不足」。支付成功后再刷一次。
- **余额不足在客户端就拦**(`goNext` 里,创建订单之前):否则会留下一张十分钟后才过期的
  待支付订单。后端 `debit()` 是第二道闸,客户端拦不住也扣不动。
- **两处 `payOrder` 合并**:`api/order.ts` 与 `api/pay.ts` 各有一份、默认渠道还不一样。
  现在唯一实现在 `api/pay.ts`(带 `PAY_METHOD` 常量,默认 `BALANCE`),`api/order.ts` 只转出。

**没有做的部分(别当成漏做)**

- **`TripController::pay`(多住宿 Trip 单笔支付)仍只收 1/2**,没有接余额 ——
  client-app 目前没有任何入口调它(多住宿在真实模式下本来就走 comingSoon)。
  哪天开多住宿,照 `OrderController::pay` 这段抄一遍即可。
- **没有充值入口**:余额只能靠退款、推荐返利或后台调账进账。余额为 0 的账号在 App 里
  现在等于付不了款 —— 这是「只留余额」的直接后果,冒烟时请先用后台/SQL 给测试号加余额。
- 未接真实 Stripe/PayPal(仍归 payment-service 模块06)。

**验证**:后端 356 文件 `php -l` 零错、shared 95 用例 / 957 断言、admin-web build 通过、
client-app `tsc --noEmit` 零报错、i18n 三份 878→882 键零 missing / 零 extra。
**本机 PATH 没有 php**,前两步是在 `mtrip-order-service` 镜像里跑的
(`docker run --rm --entrypoint php -v C:/Codes/Mtrip/backend:/lint mtrip-order-service ...`),
`scripts/check.ps1` 直接跑仍会停在第 1 步。**未做真机/真库冒烟**(本地容器全停着):
扣款链路是按 `BookingRefundService` 的退款入账镜像写的,建议联调时先验三条 ——
余额充足支付成功、余额不足报「钱包余额不足」且订单仍为待支付、支付后
`user_balance_log` 与 `finance_flow` 各多一条且金额对得上。

### ★ 2026-09-14(关怀模式落地首页 / 我的精选 / 更多三屏,Figma section Home Lite `2540:21120`)

**范围**:上一条只是「记录选择」,这一条开始 `liteMode` **真的会换页面**。
三屏 Lite Home `2540:21338` / Lite My Pick `2540:21121` / Lite More `2540:21478` 全部落地。

- **在 Tab 这一层分叉,不在页面里写分支**:`navigation/index.tsx` 的 `MainTabs` 按 `liteMode`
  选 `HomeLiteScreen` / `MyPickLiteScreen` / `MoreLiteScreen` 与 `LiteTabBar`。
  两版版式差得远(完整首页是搜索+九宫格+七八个横滑区块,Lite 首页只有一句标题+四张大卡),
  塞进同一个组件会变成两套并行 JSX。**切模式会整棵重挂**,这是预期行为。
- **优惠中心没有 Lite 稿**,沿用完整模式那一页(底栏仍是 Lite 的 —— 四个页签必须共用同一条栏)。
- **取数必须同源**:抽了 `screens/mypick/useMyPickData.ts`(订单 / 收藏 / 取消收藏 / 获焦重拉 /
  `orderStatusColor`),两个「我的精选」共用。不这么做的话同一个账号在两种模式下
  看到的订单条数或状态颜色会对不上。`MyPickScreen` 已改用它,行为未变。
- **底栏图标是同一批 fluent 的两个网格**,不是两种图案:`TabBarIcon` 新增 `variant="lite"`
  的 24 网格字形。**刻意不复用 12 网格那套放大** —— 放大会把描边一起放大。
- **Lite Home 的四个业务线就是 `QUICK_ACTIONS` 那四个**,落地规则(route → goodsType → comingSoon)
  一字不差地共用,所以两种模式点 Hotels 去的是同一个页面。
- **插画不能复用 `assets/images/home/*.png`** —— 那四张是**整块满幅的蓝色方形图标**
  (见 QuickActionGrid 头部注释),叠在 Lite 的蓝色卡上会多出一个蓝方块。
  另存了去底插画 `assets/images/lite/*.png`;Figma 导出的是原始分辨率(cars 有 2426×1760、2.3MB),
  **已按 3× 渲染尺寸压到共 602KB**(原 4.6MB)—— 不压的话四张图就顶掉整个包的体积预算。
- **Lite More 补了一张设计稿没有的卡:语言 + 退出登录**(用户明确选定)。
  设计稿把完整模式那张「订单 / 站点 / 语言 / GDPR」整张删了,但**退出登录与切换语言是会把人卡死的两项**
  —— 关怀模式用户退不出账号、改不回看得懂的语言,就只能卸载重装。站点与 GDPR 按设计稿去掉。
- `Outfit_700Bold` 新增进 `useFonts` 与 `fonts.outfitBold`(Lite 首页大标题用的是 Outfit Bold,
  项目原先只加载了 400 / 600)。
- i18n 三份各补 6 键(共 **878** 键,脚本比对 missing / extra 均为空)。缅甸语仍是机器翻译。

**没有实现的部分(别当成漏做)**

- 设计稿 Lite My Pick 里那张「Multi Booking (2 Stay)」多住宿卡**没做** ——
  后端一个订单只对应一个 sku,造不出「一单两段住宿」的数据;完整模式同样没做这件事。
- Lite My Pick 按设计稿**去掉了**入住反馈卡与底部促销卡(两者都不是必需功能)。

**与设计稿的偏差(都是设计稿自身的不一致,不是实现取巧)**

- Lite Home 的 Hotels 卡副标行高写 36、其余三张写 24,统一取 24(留着会让四张卡文案基线对不齐)。
- Lite Home 标题复用 `home.quickAction.*`,故 Car 一项显示 "Cars"(设计稿写 "Car")——
  同一业务线不该在两种模式下有两个名字。
- Lite More 的 GOLD 徽章设计稿写 `20px/行高 15`,**行高小于字号在 Android 上会切字**,抬到 24。
- Lite Home 右上角光斑 RN 没有等价 blur 滤镜,用 SVG 径向渐变近似(纯色圆会是硬边,更不像)。

**验证**:`client-app` typecheck 零报错、`expo export -p web` 通过
(已确认四张 Lite 插画与新文案、`Outfit_700Bold` 都进包,dist 已删);
i18n 872→878 三份零 missing / 零 extra。本次只动 client-app,
后端 356 文件 `php -l` 零错、shared 95 用例/957 断言、admin-web build 为同日上一条目的结果,仍然有效。

### ★ 2026-09-14(开屏新增关怀模式选择页,Figma Splash `2485:7324`)

**范围**:设计稿在 Splash section `752:9379` 里新加了第三屏 "Choose Mode",落地为
`client-app/src/screens/splash/ChooseModeScreen.tsx`,引导流程变成
**纯开屏 → 语言选择 → 模式选择 → 主流程**(编排仍在 `App.tsx`,不进 Stack 导航)。

- **两道选择各记各的状态**:`commonStore` 新增 `liteMode` / `modeChosen` / `setMode()`,
  存储键 `STORAGE_KEYS.MODE`(`'lite' | 'full'`,见 `config/global.ts` 的 `APP_MODES`)。
  这样**老用户本地已有语言、没有模式记录时只补问模式这一屏**,不会把语言再问一遍。
- **不是「先选中再 Continue」**:设计稿两张卡各配一个 CTA,点哪张就按哪种模式直接进入 ——
  与语言选择页那种「选中 + Continue」的交互刻意不同,照设计稿走。
- **「更多」页那个 Lite Mode 开关不再是占位**:原来是 `useState` + `comingSoon()`,
  现已接到同一份 `commonStore.liteMode`。模式选择页脚注写的
  「You can change this anytime later in Settings」指的就是它,不接上这句话就是假的。
- **图标**:`accessibility` 已在 `HomeIcon` 里且与导出资产 `fluent:accessibility-20-filled`
  逐字节一致,直接复用;新增 `grid`(`fluent:grid-20-filled`)。两者 path 均与导出 SVG 校验相同。
- **开屏外壳抽公共件**:波浪 + logo 抽到 `components/splash/SplashBackdrop.tsx`
  (`SplashWaves` / `SplashLogo`),`SplashScreen` 与新页共用,视觉未改。
  logo 外框由调用方传:纯开屏/语言页 286×211,模式页 217×160(**设计稿本来就是两个尺寸**)。
- i18n 三份各补 10 键(共 **872** 键,脚本比对 missing / extra 均为空)。缅甸语仍是机器翻译。

**明确没做(别误以为已经有了)**:`liteMode` **目前只记录选择,不改变任何页面的字号与信息密度**。
设计稿对 Lite Mode 的描述是「更大的字、更简的页面、更少的选项」,那是一整套页面降级规则,
需要单独设计(至少要定义字号档位与各页的精简清单),不在本次范围内。

**已知与设计稿的不一致(未改,待定)**:设计稿里语言选择页 `2163:8057` 的 logo 也是 217×160,
而现有 `SplashScreen` 的语言阶段用的是 286×211 —— 这是本次之前就有的偏差。
两屏前后脚出现,logo 会有一次尺寸跳变;要不要把语言页一并改成 217×160 需产品确认,本次没动。

**验证**:`client-app` typecheck 通过、`expo export -p web` 打包通过(已确认新页文案与 grid 图标进包,dist 已删);
i18n 三份键集零 missing / 零 extra;两枚图标 path 与 Figma 导出 SVG 逐字节比对相同。
**`scripts/check.ps1` 跑不完**:本机 PATH 里没有 php,脚本第 1 步 `backend php -l` 直接 CommandNotFound 退出
(与本次改动无关,本次没动任何 PHP 文件)。

### ★ 2026-09-15（首次激活网关 404 修复）

merchant-web 的 `/merchant/activation/*` 后端已存在但网关遗漏 activation 映射，导致 resource not found；已补齐并通过 nginx -t/热加载。m000006 仍待激活而非失效，普通密码/访问码登录增加准确激活提示。新增激活路由回归脚本，两路径 16 项及认证隔离 44 项通过；原凭证通过真实 Web 加密请求，两种 activation/start 都成功，未执行用户账号激活。详见 `docs/plans/audits/2026-09-15-merchant-activation-routing-fix.md`。

### ★ 2026-09-15（测试凭证弹窗与固定 OTP）

该节记录初版实现，启停方式已由 2026-09-18 的后台运行时开关取代。最终批准后自动弹出凭证、测试 OTP 上下文、生产拒绝、审计和 Authenticator 行为保持不变；旧变量 `MTRIP_MERCHANT_AUTH_TEST_MODE` 已退役。详见 `docs/plans/audits/2026-09-15-merchant-auth-test-mode.md` 顶部的取代说明及最新运行时开关报告。

### ★ 2026-09-15（后台线索默认确认注册联系方式）

后台新增线索必须填写主账号 `registrationPhone/registrationEmail`，默认 `registration_channel=admin,contact_data_status=0`，区别于 OTP 并记录真实管理员；邮箱为凭证投递渠道，物业联系人独立。最终批准 readiness 纳入联系方式检查；超管按钮不再因渠道或未就绪而消失，未就绪时禁用并展示原因。30 项注册、50 项 KYC、27 项最终批准测试、admin-web 构建及 PHP lint 通过，双池已重启。现有申请 `APP-20260001`（ID 2）已按用户确认的 `+86` 区号补齐注册手机号和原邮箱，维护审计完整，最终批准 readiness 为 true，KYC 保留；未代用户执行最终批准。无迁移，两个 App 未修改。详见 `docs/plans/audits/2026-09-15-admin-assisted-onboarding-kyc.md`。

### ★ 2026-09-15（后台协助 KYC 与测试协议确认）

新流程申请详情已补齐商户及全部首批物业的逐项代传、补正上传和统一提交核验，复用 `merchant:onboarding:kyc` 权限；文件版本、事件和提交时间线记录真实管理员。新增超管测试协议确认接口，仅 `APP_ENV=dev/local/test` 有效；记录 `test_confirmed`，不生成签名图片或设置真实商户确认标志，生产环境的提交/最终批准拒绝测试记录。admin-web 构建、PHP 语法、独立测试容器内 50 项 KYC 和 19 项最终批准回归通过。两个商户服务已重启且 healthz 正常。详见 `docs/plans/audits/2026-09-15-admin-assisted-onboarding-kyc.md`；两个 App 未修改。

### ★ 2026-09-15（商户入驻审批整改阶段 7）

阶段 7 已完成整改总验收与 App 交接。新增 `scripts/test-merchant-onboarding-e2e.sh`，在同一一次性数据库中跨 merchant/goods/user 三个服务执行 OTP 草稿、注册补正、两家首批物业 KYC、条款签署、双进程最终批准、凭证投递失败重试、账号激活、资料与房型审核、发布、用户端搜索/详情/日历/评价/收藏、商户暂停恢复和物业下线恢复，共 56 项主链路断言通过；待审资料和房型均保持旧批准投影。阶段 2–5 的 92 项、阶段 6 主链路 49 项及 S5 排名回归通过。Docker PHP 8.1 lint 381 文件、shared 95 用例/957 断言、两套 Web 构建、client-app 类型检查、真实签名网关、迁移 15/15 和六实例健康检查通过；一次性库和冒烟夹具残留为 0。当前 macOS 无 PowerShell，已按 `scripts/check.ps1` 内容逐项执行等价四步。已新增 `docs/guides/api/商户入驻与酒店发布App接入包.md`；未修改 `merchant-app/**` 或 `client-app/**`。真实 App UI、Google/SMTP/SMS、推送和 Merchant App 物业经营移动端薄路由适配属于后续独立 App 阶段。详见 `docs/plans/audits/2026-09-15-merchant-onboarding-stage7.md`。

### ★ 2026-09-15（商户入驻审批整改阶段 6）

阶段 6 已将入驻最终批准产生的首批物业接入商户资料、房型审核和用户端发布链路。首批 `merchant_store` 登录后直接出现在 All Properties，`source_business_id` 继续与申请业务一对一；物业资料提交要求国家/城市，首次批准打开 `display_enabled`，后续资料待审/驳回保留旧线上版本。发布要求物业 KYC、`content_approved_version>0` 及至少一个 `approved_version>0` 的在售房型，首次发布同步打开物业/经营状态。`MarketplaceReader::searchable()` 从全部合格物业取普通搜索候选，无排名返回 `ranking_id=0,rank=0`；`published()` 继续只表示已发布推荐/排名榜单。搜索、详情、日历、评价和收藏资格共用实时门禁，merchant-web 已显示包含已批准在售房型的实际用户端可见状态。阶段 6 隔离专项、真实签名网关冒烟、merchant-web 构建和差异检查已通过；未新增迁移/权限键，未修改 `merchant-app/**` 或 `client-app/**`。详见 `docs/plans/audits/2026-09-15-merchant-onboarding-stage6.md`；阶段 7 后续已完成，见本文件顶部记录。

### ★ 2026-09-15（商户入驻审批整改阶段 5）

阶段 5 已完成最终批准后的账号激活、多方式登录、联系方式恢复与 merchant-web 接入。待激活主账号可用 `HXXXXX/CXXXXX` 或用户名 + 一次性初始密码建立激活上下文，选择注册邮箱/手机号完成 6 位 OTP，并可选关联 Google Authenticator 和 Google；完成激活时原子执行账号 `2→1`、商户 `1→3`、申请账号 `1→2`，初始密码失效并签发带真实 `amr` 的 JWT。再次登录支持访问码 + TOTP、邮箱 OTP、短信 OTP、Google + 独立 mTrip OTP；恢复流程会轮换 Authenticator 并递增 `auth_version` 撤销旧会话。未知联系方式使用伪 challenge 防枚举，OTP 为 5 分钟、60 秒冷却、5 次错误上限。merchant-web 新增 `/activate`、`/recover` 和四方式登录，保留旧用户名/密码 + TOTP 兼容入口；Google 配置为空时入口关闭，Web 不提供生物识别。阶段 5 的 24 项、阶段 2–4 的 68 项和旧 S4 套件回归、PHP 8.1 语法、merchant-web 构建及桌面/`390×844` 渲染通过；开发库迁移账本 15/15，两个服务池已重启，Web 配置路由实测 `code=0`。回归同时修复 `access_code_normalized` 从后台验证详情泄露完整访问码。真实 Google、SMTP、SMS 提供商联调因当前无配置未执行；App 网关继续要求客户端签名和 `X-Site-Id`，本阶段未修改 `merchant-app/**`、`client-app/**`。执行报告见 `docs/plans/audits/2026-09-15-merchant-onboarding-stage5.md`；阶段 6 物业内容、房型与用户端发布需用户单独授权。

### ★ 2026-09-15（商户入驻审批整改阶段 3）

阶段 4 已完成最终批准、正式实体创建和凭证投递。超级管理员最终批准会在单一事务中复用 KYC 门禁，创建 `merchant_info`、待激活主账号和全部首批 `merchant_store`，并用 `source_business_id` 保留每条申请业务的一对一来源；手机号和邮箱沿用注册期加密值与检索哈希。酒店生成 `HXXXXX`、租车生成 `CXXXXX`，访问码按规范化值大小写不敏感唯一；未定义前缀的业态失败关闭。加密 outbox 分别记录 email/sms/inapp 状态并支持并发安全重试，inapp 不保存临时密码；现有 SMSPoh 只支持 OTP，因此普通凭证短信会准确记录失败。基础注册批准、KYC 审核、最终批准和凭证重试权限已经拆分。新增并已应用 `V20260915210000__add-onboarding-final-approval.sql`，开发库账本 14/14；阶段 4 隔离测试 19 项、阶段 2 回归 20 项、阶段 3 回归 29 项、PHP 8.1 语法、admin-web 构建、迁移与差异检查通过，两池服务健康。阶段 1 的 12 条存量双口径文档继续人工处理；本阶段未修改 `merchant-app/**`、`client-app/**`。执行报告见 `docs/plans/audits/2026-09-15-merchant-onboarding-stage4.md`；主账号当前不能登录，阶段 5 需用户单独授权。

### ★ 2026-09-15（商户入驻审批整改阶段 2）

阶段 2 已完成注册草稿与基础注册审批。公开注册接口改为手机号和邮箱同时必填、选定 SMS/Email 投递固定 6 位 OTP；验证成功在事务中创建或恢复双联系方式唯一草稿，并签发绑定站点、申请 ID 和两个 HMAC 的注册 Token。草稿支持详情、增量保存、`applicationBusinessId/clientRef` 幂等多业务、步骤/完成度、状态和补正重交，真实保存 `hotel/car_rental/restaurant/airline/attraction`。后台队列、筛选及审核动作改由 `registration_status` 驱动，新增开始审核和要求补正；基础批准只将注册置为通过并开放商户 KYC，不创建 `merchant_info`、`merchant_admin`、`merchant_store` 或访问码。新状态模型拒绝旧 `stage` 和旧 KYC 写动作，旧字段仅兼容读取。新增迁移 `V20260915150000__add-registration-draft-identity.sql` 和专项测试；隔离库二次迁移及 20 项业务断言、PHP 8.1 语法、admin-web 构建、迁移命名和差异检查通过。`merchant-app/**`、`client-app/**` 未修改。执行报告见 `docs/plans/audits/2026-09-15-merchant-onboarding-stage2.md`；用户已授权阶段 3。

### ★ 2026-09-15（商户入驻审批整改阶段 1）

阶段 1 已完成数据模型与确定性迁移。新增生产迁移 `V20260915120000__add-onboarding-contract-model.sql`：申请具备注册/KYC/账号三层状态、双联系方式、草稿进度、主业务类型、审核与最终批准幂等字段；注册业务具备首批物业 KYC 和位置字段；文档新增 `application_business_id` 及范围解析标记；新增条款版本和电子签署表；访问码以大写生成列保证全部历史记录永久不可复用。存量数据只按同站点、同申请 ID 和 `merchant_store.source_business_id` 回填，不猜测联系方式或实体关系。开发库迁移账本 11/11：1 条现有申请回填为注册通过/KYC 通过/账号激活，6 个双口径文档冲突组共 12 条标记人工处理，3 条物业文档精确关联首批业务，全部 15 条文档保留；协议与签署表为空。隔离测试覆盖空表、有数据、二次执行、两家首批物业、跨站拒绝、重复来源映射和访问码业务表结构 DDL 前门禁，迁移命名、Shell 语法、差异检查及全服务健康检查通过。没有修改运行时业务逻辑、`merchant-app/**` 或 `client-app/**`。执行报告见 `docs/plans/audits/2026-09-15-merchant-onboarding-stage1.md`；下一步阶段 2 注册草稿与基础注册审批，需单独授权。

### ★ 2026-09-15（商户入驻审批整改阶段 0）

阶段 0 已完成且仅修改文档：运行环境主池/App 池/网关健康，迁移账本与仓库文件均为 10/10；运行库有 1 条已批准酒店申请、1 个主账号和 1 条首批物业映射，无跨站或跨商户映射。审计确认同一申请存在 6 份 `biz_unit=''` 待审商户文档与 6 份 `biz_unit=业务ID` 已通过文档，公开 KYC 提交路由仍指向不存在的控制器方法；现有 1 个访问码仍为 `MTRP-*`。已新增 `docs/plans/19-商户入驻审批整改计划.md`、阶段 0 基线、商户入驻状态与实体契约和用户端酒店物业接口契约，并更新商户端注册验证契约。目标固定为基础注册批准只开放 KYC，商户级及全部首批物业 KYC 通过后才在同一事务创建商户、主账号、首批物业和 `HXXXXX/CXXXXX`；普通酒店搜索资格由发布门禁决定，排名只影响推荐与排序。`merchant-app/**`、`client-app/**` 和全部业务逻辑未改，未写业务数据。下一步阶段 1 只做数据模型与确定性迁移，需按阶段授权后执行。

### ★ 2026-09-15（新增物业 KYC 请求上下文修复）

已修复“All Properties → Add New Property → 上传 KYC 文件”提示“请先选择具体物业”：新增物业保存后虽已有有效 `propertyId`，KYC 上传此前只在 multipart 表单中传 ID，未用 `X-Mtrip-Property-Id` 建立单物业请求上下文。`merchant-web/src/api/properties.ts` 现为 KYC 上传/提交及物业资料写入显式携带正在操作的物业 ID；请求拦截器只在调用方未指定物业头时才补全局选择，避免当前选中其他物业时覆盖页面目标。后端 `MerchantContext` 单物业写门禁未放宽。merchant-web 生产构建、隔离库 13 项物业范围与 14 项物业 KYC 回归、差异检查通过；未使用真实登录账号执行浏览器上传。

### ★ 2026-09-15（酒店商品收敛为物业批次 G）

批次 G 已完成旧酒店商品模型退役。开发库最终只读门禁报告为 `PASS`，酒店商品、未映射房型/订单、重复、跨站、跨商户和无效关系均为 0；无酒店证据的 1 条未分类门店保持不变。已应用并冻结迁移 `V20260915090000__retire-hotel-goods-model.sql`：建立 `hotel_goods_archive` 审计归档，清除酒店共享表旧键和旧关联，删除酒店分类及 `goods_info(goods_type=1)`，物理删除房型、房型版本和排名中的冗余商品字段，并移除旧酒店菜单。商品控制器、分类、库存和商户商品页仅处理门票，酒店下单仅接受 `propertyId/roomTypeId`，旧酒店评价及房型写路由已删除；门票继续使用 `goods_id/sku_id`。隔离库验证了未映射门禁失败、完整旧关系归档清理和迁移二次执行，G 专项 17 项及 A-G 共 242 项回归通过；65 个改动/新增 PHP 文件语法、admin-web/merchant-web 构建、client-app 类型检查、迁移和差异检查通过。账本 10/10，迁移后旧列、旧菜单和酒店商品均为 0；所有主池、App 池及网关健康，合法签名请求验证酒店/门票分页为 HTTP 200、`code=0`，旧酒店商品类型为 HTTP 400、`code=40001`，临时客户端已清理。没有可用的已登录浏览器会话，未执行登录态 UI/Figma 联动走查。

### ★ 2026-09-15（酒店商品收敛为物业批次 F）

批次 F 已完成消费者、排名和营销链路收敛。已应用并冻结迁移 `V20260914123000__add-property-consumer-ranking-marketing.sql`；消费者酒店列表、详情、日历、收藏、评价及客户端预订使用 `propertyId/roomTypeId`，排名候选和发布快照仅保留 `property_id`，酒店优惠券及活动范围使用 `property_ids/room_type_ids`，Dashboard 活动数随全部/所选物业裁剪。门票列表、收藏、优惠和下单继续使用 `goods_id/sku_id`。排名 68 项、消费者酒店/评价、Dashboard 17 项、订单券范围 5 项、收藏 5 项和管理券范围 7 项专项测试通过，B-E 共 112 项回归通过；61 个改动 PHP 文件语法、三端构建或类型检查、迁移与差异校验通过，账本 9/9，F 六列齐全，快照旧键和测试夹具残留为 0。相关主池、App 池及网关健康，带合法签名的酒店列表网关请求返回 HTTP 200 和统一分页响应，临时客户端已清理。没有可用的已登录浏览器会话，未执行登录态 UI/Figma 联动走查。下一步批次 G：在各环境复跑只读审计后退役酒店域剩余的商品兼容代码、字段、路由和菜单，门票链路保持不变。

### ★ 2026-09-14（酒店商品收敛为物业批次 E）

批次 E 已完成酒店预订与财务归属收敛。已应用并冻结迁移 `V20260914112115__add-property-order-finance.sql`，订单、退款、资金流水、分账分录和商户结算新增 `property_id/room_type_id`；历史数据只通过商品、房型、站点、商户完全一致的显式关系回填，不匹配记录保持未归属。单酒店和 Trip 新写入使用物业/房型键且旧商品键为 0，门票保持 `goods_id/sku_id`；库存履约、退款、PMS 同步、商户预订、看板、收益和结算均按物业追溯及裁剪，CSV 导出也携带所选物业上下文。隔离库 33 项订单、16 项看板、6 项收益及 B-D 56 项回归通过，正向/拒绝猜测迁移场景、PHP 8.1 语法、merchant-web 构建、差异与迁移校验通过；账本 8/8，MySQL、订单双池和财务服务健康。无法拆分的历史 `property_id=0` 商户级结算只保留管理端审计，不向商户物业收益接口展示。下一步批次 F：消费者酒店列表/详情/收藏/评价、市场排名和营销范围改用物业。

### ★ 2026-09-14（酒店商品收敛为物业批次 D）

批次 D 已完成所选物业请求上下文与员工物业授权。已应用并冻结迁移 `V20260914110000__add-employee-property-scope.sql`，新增 `merchant_employee_property`和 `mch:account:property-assign`；中间件验证 `X-Mtrip-Property-Id`，`MerchantContext` 按集团/商户主账号、员工显式授权和物业账号执行全部/单物业范围。物业切换器改用真实 `merchant_store.id`，前端统一为 `selectedPropertyId`；菜单启动不受失效选择阻断，已选物业也不会把切换列表错误缩成一条。隔离库 13 项范围、17 项房型/库存、12 项内容和 14 项 KYC 断言全部通过；权限实库唯一、夹具清理为 0、PHP 8.1 语法检查、merchant-web 生产构建、迁移校验和五服务 `healthz` 通过，账本 7/7。无已登录浏览器会话，未做登录态 Figma 走查。下一步批次 E：酒店订单、库存履约、退款、收益和结算切换至 `property_id/room_type_id`，门票继续使用 `goods_id/sku_id`。

### ★ 2026-09-14（酒店商品收敛为物业批次 C）

批次 C 已完成物业资料、房型与库存收敛。已应用并冻结迁移 `V20260914103000__add-property-content-room-inventory.sql`，只从 `ranking_listing` 和 `merchant_store_goods` 的有效显式一对一关系建立旧映射；物业资料采用版本审核，KYC、内容、房型和发布状态分离。商户房型与房量接口已改用 `propertyId/roomTypeId`，房型、库存、退款规则及库存日志写 `property_id`，过渡 `goods_id=0`；新建酒店商品返回 `40901`，门票创建保持可用。收尾审阅补齐批量房量必须显式且全量授权选择房型，以及物业账号只能撤回本物业房型版本。隔离库 17 项房型/库存、12 项内容生命周期和 14 项 KYC 回归通过；四个新权限键实际落库且各一条，20 个 PHP 文件语法检查、两端生产构建、服务重启健康、迁移校验和差异检查通过，迁移账本 6/6。没有可用的已登录浏览器会话，物业资料与管理端审核页尚未做登录态 Figma 视觉走查。下一步批次 D：`selectedPropertyId`、`X-Mtrip-Property-Id`、员工物业授权及全部/单物业后端强制范围。

### ★ 2026-09-14（酒店商品收敛为物业批次 B）

批次 B 已完成物业专项 KYC 闭环。迁移 `V20260914095000__add-property-kyc.sql` 扩展 `merchant_store` 物业 KYC 状态及文档 `scope_type/property_id`，新增三项酒店物业资料模板和 `mch:properties:add|kyc-upload|kyc-submit` 权限；商户端已接入真实物业草稿、专项文档上传/替换/提交，管理端复用文档审核并只同步对应物业。隔离库 14 项集成测试覆盖跨站拒绝、伪造 MIME、部分审核、驳回重交、最终批准及审计版本，并确认物业提交和驳回均不改变商户访问码或其他物业状态。PHP 8.1 容器语法检查、merchant-web/admin-web 构建、迁移命名校验和差异检查通过，本地迁移账本为已执行 5、待执行 0。当前进入批次 C，扩展物业资料与内容版本，将房型、库存及退款规则切换到 `property_id`。

### ★ 2026-09-14（酒店商品收敛为物业批次 A）

用户已确认按整改计划分批执行。批次 A 新增 `scripts/audit-hotel-property-mapping.sh`，只读审计 `ranking_listing(property_id, goods_id)` 与 `merchant_store_goods(store_id, goods_id)` 两类显式 ID 关系，输出分站点汇总、重复/跨站/跨商户冲突、仅物业、仅酒店商品、未映射房型和未映射酒店订单。本地报告 `docs/plans/audits/2026-09-14-hotel-property-mapping.md` 的所有退役阻断项均为 0，门禁 `PASS`；现有 1 条 `business_type` 为空的门店无酒店证据，仅列为未分类且未自动转换。其他环境在旧模型物理清理前仍须独立运行同一审计。当前进入批次 B 物业专项 KYC。

### ★ 2026-09-14（Add New Property 第 1 步 Figma 对齐）

按 `mTrip_Merchant` Figma 节点 `585:7146` 新增 `merchant-web/src/views/properties/new.vue` 与 `/properties/new`，所有物业页的新增按钮进入该页。基本信息、两步提示、图片本地拖放预览和底部栏完成。用户选择本轮继续沿用门店新增：Next 进入 `/store` 原有新增弹窗，并预填物业名称和位置；物业类型、房型数量、图片仅供原型预览，不写入后端，也未实现 KYC 第 2 步。`merchant-web npm run build` 通过；1536×826 本地隔离预览截图已核对并清理临时文件。本地无商户登录态，真实提交待验收。

### ★ 2026-09-14（merchant-web All Properties 与全局菜单对齐）

按 Figma mTrip_Merchant 节点 `580:6100` 完成 `merchant-web/src/views/properties/index.vue`，四张统计卡与业务卡读取已授权、已验证的真实 `businesses`；三张 Figma 酒店图片仅作展示素材，未写死示例业务数据。侧栏改为 Portfolio / Business / Operations / Team / System 分组，Operations 保留设计稿未展示的门店、商品、客房、房量入口；原路由、接口和权限不改。Guest Messages 仍在预订详情。新增菜单与组件路径通过迁移 `V20260914090000__add-merchant-properties-menu.sql` 对齐，已在本地应用（账本 4/4）。新增物业按钮现先进入基本信息页，再复用门店新增弹窗；卡片 Manage / Dashboard 进入既有页面，尚无独立物业级看板。merchant-web 构建、迁移命名校验与 1536×995 All Properties 本地原型视觉检查通过；临时预览数据与鉴权绕行已撤销，真实账号联动验收待补。

### ★ 2026-09-13（merchant-web 登录解密失败修复）

商户端登录密文由 shared `PayloadDecryptMiddleware` 使用 `MTRIP_ADMIN_AES_KEY` 解密，之前 `merchant-web/.env.development` 的 `VITE_LOGIN_AES_KEY` 与本地运行容器不一致，前端注释还误称不存在的 `MTRIP_MERCHANT_AES_KEY`。已对齐开发配置、修正注释和启动指南，并重启 merchant-web；经 5174 代理发空加密请求返回 HTTP 400 / `40001`“参数 username 不能为空”，已通过解密进入字段校验。真实账号及 TOTP 未操作；其他环境若单独更换后端密钥，须同步商户/管理前端环境变量并重启 Vite。

### ★ 2026-09-12（空库增量迁移与统一 KYC 模板）

本地首次 `./mtrip.sh build` 后，MySQL 挂载的 `99z-run-migrations.sh` 在 Docker Desktop 上被直接执行时报 `bad interpreter: Permission denied`；账本 0 条、统一 KYC 模板缺失，而旧健康检查误将空账本判为健康。已在当前本地库用容器内 runner 补跑 3 个迁移，账本均为 `applied`，统一模板 `id=10`、启用、6 项资料。`deploy/mysql/Dockerfile` 现将 runner 作为 0644 文件打进镜像（同时规范 Windows CRLF），由 MySQL entrypoint source；健康检查要求 `applied` 数量与 `database/migrations/V*.sql` 数量一致，且没有 `running/failed`。隔离新卷验证自动执行 3 个迁移并生成统一模板，测试卷已清理，现有库保留。`scripts/db-migrate.sh` 与 init runner 已兼容 macOS Bash 3.2，`--status` 显示已执行 3、待执行 0，状态机测试通过。加密登录后请求 `GET /api/v1/admin/merchant/onboarding/kyc-templates` 实测 HTTP 200、`code=0`、列表 1 条。其他环境拉取后需手工执行增量迁移并 `bash deploy/mtrip.sh build mysql`；`auto-deploy.sh` 对 compose 变化仅提示，不自动重建 MySQL。

### ★ 2026-09-10(merchant-web 登录页 Figma 对齐)

**范围**：仅调整 `merchant-web` 登录页展示层，设计来源为 `mTrip_Merchant` Login 节点 `1787:13875`；不改路由、登录 API、JWT、RBAC 或后端。

**落地**：

- `merchant-web/src/views/login/index.vue` 已改为 Figma 的 55px 蓝色顶栏 + mTrip Logo、世界地图背景、900px 双栏安全登录卡、浅蓝标题区、虚线安全面板、2FA 分隔和页脚；`760px` 以下自动转单列。
- Figma 原始素材保存为 `src/assets/login/mtrip-logo.png` 与 `world-map-background.jpeg`，不引用临时远程 URL；顶部 Logo 已按素材透明留白范围裁切放大；`locales/en-US.ts`、`zh-CN.ts` 同步新增安全登录文案。
- 业务流程保持“访问码/用户名 + 密码 → challenge → 六位 TOTP”。首次注册验证器时右栏渲染 `/merchant/auth/2fa/setup` 的真实二维码和手动密钥；当前后端无扫码登录/验证码重发接口，故没有使用设计稿静态二维码制造假功能。

**验证**：`merchant-web npm run build` 通过；本地预览在 `1536×826` 和 `390×844` 完成首屏视觉检查，控制台无 warning/error。未提交账号登录，challenge 后 2FA 状态尚未做真实登录态浏览器验收。本次与 `origin/dev` 最新基线合并后本地提交，未推送。

### ★ 2026-09-10（统一申请级 KYC + merchant-app 真实文件上传）

**用户确认**：后台审核人员发送一套统一 KYC 资料填写/上传请求；KYC 不按 Business Type 分流。业务类型如保留，仅用于后台运营资料，不参与模板或文件门禁。

**代码**：新增生产迁移 `V20260910110000__unify-merchant-kyc-template.sql`，幂等建立可编辑的 `Unified Merchant KYC` 清单；`OnboardingController::sendKyc()` 不再接受 `templateId`、`businessId`、业务类型或范围，统一创建申请级（`biz_unit=''`）文件占位并置 `stage=3`。M5-M7 同步改成申请级文档读、multipart 上传和必需文件校验。admin-web Send KYC 页面不再按业态选模板；merchant-app 使用 `expo-document-picker` 调真实 M5/M6/M7，并以 M8 轮询取代原先假审批定时器；注册 Step 2 移除 Business Type。

**验证**：`npm run typecheck --prefix merchant-app`、`npm run build:web --prefix merchant-app`、`npm run build --prefix admin-web`、`bash scripts/db-migrate.sh --validate`、`git diff --check` 通过；Web `dist` 已清理。后端 PHP 8 lint 仍需有 Docker socket 权限或 PHP 8.1 容器环境执行。

**下一步**：M9-M12 Access Code、首次扫码 Authenticator 绑定、2FA 校验/退出与端侧生物识别仍未真实联动。
### ★ 2026-09-10（商户 App M3-M8 申请与 KYC 后端联动）



**代码**：

- 新增生产迁移 `database/migrations/V20260910094500__add-merchant-application-registration-owner.sql`：申请保存 `registration_channel` 和收件人 SHA-256 哈希，以 M2 的 signed registration token 做归属检查；不落原始收件人、验证码或 token。
- 新增 `MerchantAppOnboardingService` 和 `Controller/App/Merchant/ApplicationController`，注册 M3-M8：`application/save|submit|status|kyc-requirements`、`kyc/upload|submit`。
- KYC 读要求可在 stage=3/4；上传与提交严格只在 stage=3（后台 `sendKyc` 后）允许。上传的 docType 必须是后台生成的占位文档，提交只检查启用模板的 required 文件，提交后置 stage=4 且禁止覆盖。

**验证**：`bash scripts/db-migrate.sh --validate`（2 个迁移）和 `git diff --check` 通过。尝试在用户刚重建的 merchant-service 容器执行 PHP 8 lint，但本机 Docker socket 无权限，未能做容器内语法检查；宿主 PHP 7.2 不适用于项目 PHP 8.1 语法。

**遗留**：merchant-app 仍未调用 M0-M8；M9-M12（Access Code、首次扫码 Authenticator 绑定、2FA 验证/退出）尚未实现。

**后续更新（2026-09-10）**：merchant-app 已接入 M0-M4：渠道由后端配置读取，SMS/Email OTP 真实发送校验，成功后调用申请草稿和正式提交；`npm run typecheck --prefix merchant-app` 通过。M5-M7 页面尚为本地文件原型。

### ★ 2026-09-09（商户 App 注册 OTP 后端联动第一段）

**范围**：用户确认注册验证方式为 SMS/Email 二选一；补齐邮件 SMTP 渠道，KYC 仍必须在后台 Send KYC 后才能上传，二维码仅用于首次 2FA 绑定。本段仅完成邮件渠道与 M0-M2 注册 OTP，不把尚未验证的 KYC/2FA 原型状态伪装成后端已接入。

**代码**：

- 新增生产迁移 `database/migrations/V20260909123000__add-email-channel.sql`（新规范：生产只写 `database/migrations/VYYYYMMDDHHMMSS__lower-kebab.sql`，不可再向历史目录追加增量）。迁移创建 SMTP 配置与无 OTP 正文的投递日志，并登记后台菜单/权限键 `config:email:*`。
- 新增 system-service `EmailController` / `SysEmailChannel` 与 `/api/v1/admin/sys/email/*`；账号和密码沿用 `SecretField` AES 存储、脱敏回显。admin-web 增加 `config/email/index` 配置页。
- 新增 shared `SmtpClient`（STARTTLS/SSL、SMTP AUTH PLAIN、证书校验不降级）及 merchant-service `MerchantRegistrationOtpService`，路由为 `GET /api/v1/app/merchant/register/config`、`POST /register/otp-send`、`POST /register/otp-verify`。OTP 是 Redis 哈希，邮件日志不存验证码；验证成功才给 24 小时 registration token。
- 补 `deploy/openresty/conf.d/mtrip.conf` 的 `merchant -> merchant_service_app`，并在 App 孪生池 compose/开发热挂载中增加 `merchant-service-app`；否则 App 前缀会在网关被拒绝。

**遗留**：

1. merchant-app 还未调用上述 M0-M2；页面的固定 SMS/Email 收件人和 OTP 状态仍是原型。
2. M3-M12（申请保存/提交、后台 Send KYC 状态门禁、KYC 上传、Access Code、首次扫码 2FA、生物识别）尚未实现，不能宣称已联动。

### ★ 2026-09-09(merchant-app 入驻、KYC、Authenticator 2FA 完整原型流程)

**范围**:补续中断的 merchant-app Figma 页面实现；本轮只交付可连续点击的移动端原型，不硬接尚未确认的入驻/KYC/扫码/生物识别 API。

**代码**:

- 新增 `src/screens/onboarding/MerchantFlowScreens.tsx`，并补齐 10 个 React Navigation Stack 路由；注册 Step 2 Submit 现在进入账号验证。
- 注册流程已覆盖 `839:6107`（账号验证）→ `839:6133`（OTP）→ `839:5984`（审核中）→ `839:6075`（审核成功）；审核状态在同页本地切换，成功后可进入 KYC。
- KYC 流程已覆盖 `839:6160`/`839:6192`（材料上传前/后）和审核成功 `839:6044`；三份必传材料都点选后才启用 Submit to Admin，审核结果仍是本地演示状态。
- Access Code / 2FA 流程已覆盖 `839:5779`、`839:6224`、`839:5844`、`839:5889`、`839:5916`、`839:5941`；扫码框以 2 秒循环扫描线和边框呼吸动效实现，完成弹窗后进入 `1603:13873` 生物识别选择，最后展示 `1591:13854` 首页待设计占位。
- `DashboardScreen` 更新为 Figma 的 Welcome Back 占位，避免继续显示与当前设计不符的旧卡片。

**验证**:

- `npm run typecheck --prefix merchant-app` 通过。
- `npm run build:web --prefix merchant-app` 通过，`merchant-app/dist` 已删除。

**遗留**:

1. 目前所有 OTP、文件上传、审批、Merchant Access Code、QR 扫描及 Face ID / Touch ID 都是本地可点击的原型状态；页面完成后再对照现有 merchant 入驻 API 明确接口复用/缺口。
2. 需要浏览器或真机实际点击走查安全区、长文案和动效；本会话完成了 TypeScript 与 Expo Web 导出验证，未做视觉截图比对。

### ★ 2026-09-08(独立 merchant-app 首屏,Figma `839:5721`)

**范围**:读取 `PRD/mTrip_Merchant App PRD_v1.0.docx` 的商户移动端需求,按用户确认将 `merchant-app` 作为独立计划,不并入既有 `client-app` 模块 10。本次先搭工程骨架并实现第一个 Figma 页面。

**需求结论**:

- PRD 的商户 App 覆盖入驻注册/OTP/KYC/审批状态、审批后 Merchant Access Code + Authenticator 2FA、可选生物识别、酒店/房型、房量房价、预订管理、经营结算、通知设置、RBAC 员工、营销、评价、帮助中心/住客消息。
- 当前实现顺序按用户要求:先逐个完成 Figma 页面,可以不对接接口;全部页面完成后再按 PRD 和页面业务接真实功能。
- API 口径先对齐已有 `merchant-web`:商户认证走 `/api/v1/merchant/auth/login` → challenge,再走 `/auth/2fa/setup|verify` 获取 JWT;后续业务优先复用 `/api/v1/merchant/*`、goods/order/finance/marketing 中已存在的商户端路由。

**代码**:

- 新增独立工程 `merchant-app/`,技术栈对齐 `client-app`:Expo 51 / RN 0.74 / TS / React Navigation / Zustand / axios / i18next / Outfit+Inter。端口使用 8083,scheme `mtripmerchant`,包名 `com.mtrip.merchantapp`。
- 请求层 `src/api/request.ts` 默认拼接 `/api/v1/merchant`,统一解包 `{code,message,data}`,40101/40102 清本地登录态;存储 key 前缀改成 `mtrip:merchant:*`,避免与 C 端串 token。
- `src/screens/onboarding/OnboardingScreen.tsx` 完成 Figma `839:5721`:主色 `#0D9488` 顶部、状态栏视觉、logo、标题/副标题、三条 feature、白色圆角底板和底部 Register / Log In。
- Figma 临时资产已下载成本地文件:`assets/images/onboarding/logo.png`、`booking.svg`、`mobile.svg`、`support.svg`;SVG 通过 `SvgXml` 渲染,不手写替代图标。
- `LoginScreen` 仅为数据流骨架:用户名/访问码 + 密码获取 challenge,需要 enrollment 时展示 manualKey,输入 6 位 Authenticator code 后调用 verify 并进 Dashboard。视觉后续要继续按 Figma 登录/2FA 节点精修。`RegisterScreen` 和 `DashboardScreen` 目前是承接占位。

**文档**:

- 新增 `docs/plans/17-商户移动端merchant-app.md`,作为 merchant-app 独立计划。
- 已更新 `docs/plans/README.md` 模块表/变更记录与根 `README.md` 技术栈、目录结构、质量基线补充。

**验证**:

- `npm install --prefix merchant-app --ignore-scripts --prefer-offline` 已安装本地依赖,`node_modules/` 已加入 `.gitignore`。
- `npm run typecheck --prefix merchant-app` 通过。
- `npm run build:web --prefix merchant-app` 通过,验证后已删除 `merchant-app/dist`。

**注册 Step 2**:

- 已实现 Figma `839:6159` 注册 Step 2 Business Details,不手绘 Figma 状态栏。
- 新增 `RegisterBusinessDetailsScreen`:Back、Step 2/4、50% 进度条、两张 Business 详情卡(业务类型、联系人、手机号、邮箱、总部城市)、Terms/Privacy checkbox、底部 Submit。
- Step 1 的 Next 改为导航到 Step 2;为了连续走原型,保留 40% opacity 淡色视觉但可点。
- 已补 `RegisterBusinessDetails` 路由和 `register.businessDetails.*` 三语言 i18n;下载 Step 2 图标到 `assets/images/register/back-step2.svg` 与 `chevron-down-step2.svg`。
- 验证:`npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过,`dist` 已删。

**注册 Step 1 与状态栏规范**:

- 用户确认：Figma 里画出的 iPhone 状态栏(时间/电池/信号/白天黑夜)只是设计稿环境,App 中由系统真实状态栏透明覆盖,页面代码不要手绘；后续所有 merchant-app Figma 页面都先忽略 `Status bar - iPhone` / `StatusBarIPhone` 节点。
- 已删除首屏 `OnboardingScreen` 的手绘 `StatusStrip`;页面改为只设置 `expo-status-bar` 透明和图标样式,通过 `SafeAreaView` 让开真实设备安全区。
- 已实现 Figma `839:6106` 注册 Step 1 Company Info：Back、Step 1/4、25% 进度条、标题说明、Number of Business 选择框、Company / Group Name 必填输入框、底部 Next。
- 已下载注册页 Figma 图标到 `merchant-app/assets/images/register/back.svg` 与 `chevron-down.svg`;代码用 `Svg + Path` 渲染,规避 Expo Web `SvgXml` 为 undefined 的问题。
- `npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过,`dist` 已删。

**Web 运行警告修正**:

- 用户浏览器控制台报 `FeatureIcon.tsx:37 React.jsx: type is invalid`,根因是 Expo Web 下 `SvgXml` 实际取到 `undefined`;已改成 `Svg + Path` 渲染,三枚 path 数据逐字来自已下载 Figma SVG。
- 同时处理 RN Web 的 `textShadow*` / `shadow*` deprecation:Web 用 `textShadow` / `boxShadow`,原生端保留 RN 阴影字段。
- `npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过,`dist` 已删。

**启动脚本修正**:

- 用户在 `merchant-app/` 目录内执行 `npm start --prefix merchant-app` 会让 npm 查找 `merchant-app/merchant-app/package.json`;正确命令是目录内 `npm start` / `npm run dev`,或仓库根目录 `npm start --prefix merchant-app`。
- 用户本地 `npm start` 又因访问 `https://api.expo.dev/v2/sdks/51.0.0/native-modules` TLS 断开失败;已将默认 `start/android/ios/web/dev` 改为 `--offline --port 8083`,Expo 51 中 `--offline` 与 `--localhost/--lan/--host` 互斥,因此不再显式传 host 参数。
- `npm run typecheck --prefix merchant-app` 通过。

**未做 / 下一步**:

1. 继续读取后续 Figma 节点,实现注册、OTP、KYC 上传、申请状态、2FA Setup/Login、生物识别等 onboarding 全流程页面。
2. 页面做完后再逐模块接 API;若移动端入驻/KYC API 缺口与 merchant-web 不同,单独补后端清单和计划,不要在页面阶段硬造。
3. 需要本地浏览器/真机视觉走查首屏高度与安全区;本次只做了 typecheck 与 Web export。

### ★ 2026-09-09(生产 MySQL 版本迁移接入 auto-deploy)

**原缺口**:`scripts/auto-deploy.sh` 只知道本次拉取里哪些 SQL 文件变了，默认只告警；即使传
`--apply-db`，也只是让 `db-apply.sh` 无记录地重灌这些文件。生产库曾多次因数据卷已存在而漏跑后加脚本，
且脚本无法回答“这个版本是否执行过、由谁执行、内容后来是否被改过”。

**新机制**:

- 新增 `mtrip_system.schema_migrations` 与 `scripts/db-migrate.sh`，扫描完整 `database/migrations/`，
  以版本主键 + SHA-256 对账，只执行缺失版本；记录脚本路径、Git commit、执行节点、开始/结束、耗时和状态。
- 命名固定 `VYYYYMMDDHHMMSS__lower-kebab.sql`（有效 UTC 日期时间、全目录唯一）。现有 `database/system|merchant|...`
  数字 SQL 不重命名，继续作为空库初始化快照；今后生产增量只进 migrations，已执行文件只增不改。自动发布会拒绝把旧快照 rename/copy 成版本迁移，避免整份历史 SQL 在生产重放。
- 每个版本执行时持有 MySQL `GET_LOCK`；先以唯一 `attempt_id` 写 `running`，且只能由同一次 attempt 更新
  `applied/failed`，避免锁超时的并发进程误伤真正执行者；并发成功判定同时匹配 checksum、状态与路径，批次结束后再重新读取完整账本收口。SQL 全部成功才改 `applied`。DDL 可能隐式提交，
  所以失败记录不会自动重试，必须先人工核对部分落库情况。checksum 不一致、账本文件丢失、失败/运行中状态
  或锁超时都会阻断。
- `auto-deploy.sh --prod` 默认在构建/重启前执行完整对账，失败立即中止；代码没有新 commit 时也继续查迁移，
  `.git/mtrip-last-successful-deploy` 只在整批发布成功后推进，因此 Git 已快进但迁移失败时，下个 cron 仍会
  从旧成功点重新计算并执行同批前后端/网关动作。非生产可显式 `--apply-db`，
  `--skip-db` 只给外部 DBA 已迁移的应急发布；强制目标支持 `database|db|mysql`。
- compose 首次初始化先跑 `01-schema-migrations.sql` 建账本，所有历史 init SQL 结束后由
  `99-run-migrations.sh` 遍历挂载目录；runner 独立调用 mysql 客户端，不依赖官方 entrypoint 内部函数，
  因此无论脚本挂载后是否可执行都能工作，且后续新增版本不再逐条维护 volume 映射。首次初始化迁移失败会登记 `failed`，MySQL 健康检查也会拒绝存在 `running/failed` 的账本，避免部分初始化卷继续带起业务服务。

**验证**:Git for Windows Bash 下 `bash -n scripts/auto-deploy.sh`、`bash -n scripts/db-migrate.sh`、
`bash -n database/init/99-run-migrations.sh` 和 `bash scripts/db-migrate.sh --validate` 通过；当前迁移目录 0 个业务版本。
`bash scripts/tests/test-db-migrate.sh` 以隔离 fake Docker/MySQL 验证非法日期/命名、首次建账本、执行成功、迁移后全账本复核、重复运行跳过、
failed/删除历史/倒序版本/checksum 阻断、并发 attempt 所有权、旧快照 rename 拒绝、auto-deploy dry-run 衔接，以及首次无成功标记时 Git 已快进但迁移失败后下一轮仍重放
网关动作并推进成功标记，已通过。
统一 `scripts/check.ps1` 已尝试，但宿主机命中 PHP 7.2，无法解析仓库 PHP 8.1 语法并在后端 lint 停止；
本次没有 PHP 改动。
本机无 Docker CLI，尚未执行 compose config 与真实 MySQL 迁移；到有 Docker 的环境先跑
`docker compose -f deploy/docker-compose.yml config --quiet`、`bash scripts/db-migrate.sh --status`，
再用一份幂等测试迁移验证成功/重复执行/失败阻断。

### ★ 2026-09-09(真 bug:App 请求层按 HTTP 状态判成败,导致「删掉短信渠道后仍注册不了」)

**现象**:后台把短信渠道删掉后,App 注册页仍卡在发验证码这一步 —— 而后端此时明明已按
「渠道启用才强制」放行(`curl` 直打 `/app/auth/register` 不带 `verifyToken` 返 `code=0` 注册成功)。

**真因在客户端 `client-app/src/api/request.ts`**:后端把业务码映射成了 HTTP 状态
(`ErrorCode::httpStatus`:`40111→401`、`42911→429`、`50021→500`),而 axios 默认只认 2xx,
**在读到响应体之前就 reject 掉了**。于是页面拿到的是 `ApiError(-1, "Request failed with status code 500")`,
注册页那句 `e.code === SMS_CHANNEL_UNAVAILABLE` 的跳过分支永远不成立。
这条不止影响注册:验证码页区分「码错/码过期」、以及 `40101/40102` 触发清登录态跳登录,**之前也全是死代码**。

**修法**:`validateStatus: () => true`,成败一律以响应体 `code` 为准;
不是本系统信封的响应(网关 502 HTML 等)才退回按 HTTP 状态报错。
顺带给 `request/get/post/postEncrypted` 加了可选 `RequestOptions.silentCodes`,
注册页对 `50021` 静默(它是预期内分支,再弹一句「短信服务未配置」会让用户以为注册失败了)。

**验证**:`client-app` typecheck 通过;网关实打 `/app/auth/sms/send` 确认是
`HTTP 500 + {"code":50021}`(证实上述判定路径),`/app/auth/register` 不带票据可注册成功;
冒烟建的账号已删,`user_info` 仍只剩 id=1。SMSPoh 账号侧仍未开通(见下条),本次不涉及。

### ★ 2026-09-08(补:手机号必须补国家码 + 当前发码失败的真因在 SMSPoh 账号侧)

**两件事,别混为一谈。**

**1)真 bug:出网号码没补 `+95`(已修)**

- App 登录/注册页把「+95」画成**静态标签**,占位符是 `9xxxxxxxx`,但**从不拼进请求** ——
  用户填 `9971183240`,后端原样发给 SMSPoh。而 SMSPoh 文档只接受
  `09xxxxxxxx` / `959xxxxxxx` / `+959xxxxxx` 三种前缀,`99` 开头三种都不是。
- 修法**只动出网那一刻**:`sys_sms_channel` 新增 `country_code`(默认 `95`,可配、可分站点),
  `SmsPohClient::normalizeMobile($mobile, $cc)` 归一成 E.164。
  **库里 `mobile`/`mobile_hash` 仍按用户原样输入存** —— 改存储格式会让存量账号登不进来。
- 归一规则:`+` 原样 → `00` 换 `+` → `0` 冠码去 0 补国家码 →
  以国家码开头**且总长 ≥ 国家码长+9** 判为已带国家码 → 其余补国家码。
  最后那条长度门槛是消歧用的:缅甸本地号 `95xxxxxxxx`(10 位)自己就以 95 开头,
  只看前缀会被当成「已带国家码」而少发两位;带国家码的 `959971183240` 是 12 位,用长度分得开。
  已锁 4 条单测(含这条消歧)。
- 想更严格得让客户端把国家码作为独立字段上送,那要改 App 与接口约定,**本次没做**。

**2)当前 `50021` 的真因:SMSPoh 账号侧,不是代码**

用户已配好真实渠道(id=2,`site_id=0` 全局,Sender ID `MTrip`),发码仍失败。逐项排掉:

| 试的东西 | 结果 | 结论 |
|---|---|---|
| 故意用错 token | `401 invalid credentials` | 真请求回 **400 不是 401** → **凭证有效** |
| 不带 `from` | `400 missing or invalid parameters` | 带 `from` 的请求**参数校验是过的** |
| `09971183240` / `959971183240` / `+959971183240` | **三种官方格式全部同样 400** | **换号码格式救不了** |
| 换 Sender ID 为 `SMSPoh` | 同样 400 | 与 Sender ID 无关 |
| 同一 token 打普通短信 API | `401` | 旁证该凭证只绑了部分产品权限 |

服务商原文:`We were unable to send your OTP. Please contact the SMSPoh Dev Team for assistance.`
—— 参数对、凭证对却拒绝发送,且它自己让你联系 Dev Team。
**典型原因是账号未开通 OTP/Verify 产品、无余额,或 Sender ID 未报备通过**,须由账号持有人找 SMSPoh 开通,
代码侧改不动。**因此「真收到一条验证码」这一步仍未跑通**,与上一条目的遗留项 1 是同一件事。

**验证**:shared **95 用例 / 957 断言**、后端 348 文件 `php -l` 零错、admin-web build 通过;
迁移幂等(连跑两次)、`country_code` 已落库且现有渠道回填为 `95`;
用 App 原样输入 `9971183240` 走真实发码,出网 `to` 已是 `+959971183240`(单测锁死),
服务商仍回同一条账号侧错误。冒烟日志已清空,`user_info` 只剩 id=1。

### ★ 2026-09-08(App 短信验证接入 SMSPoh Verify API V3)

**范围**:C 端**注册 / 验证码登录 / 忘记密码**三个场景接真实短信(用户明确选定这三个)。
凭证存 `sys_sms_channel`(用户选定,而非环境变量);强制策略选定为**「渠道启用即强制」**。

**服务商口径(照抄文档,别按常见 REST 习惯猜)**

- 基址 `https://v3.smspoh.com/api/otp`,发码 `POST /request`,验码 `POST /verify`。
- **参数全部走 query string,POST 没有请求体**。
- 鉴权 `accessToken=base64(APIKey:APISecret)`,也放 query 里;**V3 与旧版凭证不通用**,
  需在 v3.smspoh.com 的「Accounts & Security > API Credentials」重新申请。
- base64 会产出 `+ / =`,**必须 URL 转义** —— `+` 被解成空格就等于凭证错误,
  这是最难查的一个坑,已单独锁一条单测。
- 发码成功回 `requestId`(示例是 9 位整数,但服务商没承诺位数,**按字符串存**);
  验码要带 `requestId + code`。成功状态码是 **201** 不是 200。
- **验证码本身我方拿不到也不存**,码由 SMSPoh 校验。

**后端**

- 新增 `shared/src/Support/SmsPohClient.php`:纯逻辑(建 URL / 解析响应)与网络分开,
  `httpPost()` 是 protected,单测覆写它即可不联网跑全部分支。
  网络用 `stream_context_create` + `file_get_contents`(**与 system-service 调阿里云 OSS 同一写法**,
  Swoole hook 会协程化,**不必新增 composer 依赖**,也就不用 `./mtrip.sh build`)。
- 新增 `user-service/app/Service/SmsVerifyService.php`:渠道解析 / 场景前置校验 / 三道限流 /
  发码 / 验码 / 票据。**验码成功签发一次性 `verifyToken`**(Redis,10 分钟),
  票据绑定「站点 + 场景 + 手机号」—— 不绑手机号的话,拿自己号码验一次就能去注册别人的号码。
- **票据是 `assertTicket()` 验、`discardTicket()` 销,两步分开**:业务成功后才作废。
  这样「推荐码填错」不会把票据一起赔进去,用户改完直接重试,不用再等一条短信。
- 4 条新路由(公开,`/api/v1/app/auth/` 下,网关按二级模块已自动路由到 user_service_app,**网关无需改**):
  `sms/send`、`sms/verify`、`login-by-sms`、`reset-password`。
  `reset-password` 带明文新密码,已加进 `PayloadDecryptMiddleware` 的强制加密名单;
  `sms/send`/`sms/verify` 刻意不加(只有手机号+验证码,加了等于给发码链路多一层客户端密钥依赖)。
- ErrorCode 新增 5 个细分码:`40021` 码错 / `40022` 码过期 / `40111` 未完成短信验证 /
  `42911` 发送过频 / `50021` 短信服务不可用。**拆开是刻意的**:App 要区分
  「码错了(留在本页重填)」「码过期了(引导重新发码)」「没配渠道(跳过这一步)」三种处置。
- **强制策略「渠道启用即强制」**:本站点有启用中的 smspoh 渠道 → register 必须带 `verifyToken`;
  没配 → 照旧放行。本机开发不必申请凭证,生产装上凭证自动生效,不用再改代码或加开关。
- **顺手修掉 HANDOFF 记了两次的遗留隐患**:`UserAuthService::register` 的
  insert + `setupReferral` 现已包进 `Db::transaction`,推荐码填错不再留下孤儿账号。
- 迁移 `database/system/11-sms-smspoh.sql`(幂等,已连跑两次成功,compose initdb 登记为 `99n-`):
  `sys_sms_channel` 补 `api_secret`/`brand_name`/`pin_length`/`max_invalid_attempts`
  (原表是「一个密钥 + 一个账号」的 Twilio 模型,放不下 SMSPoh 的**两段密钥**);
  `sys_sms_log` 补 `scene`/`provider_request_id`(出问题要能回答「哪个场景」「服务商那边的 ID」)。
- system-service `SmsController` 放开 `smspoh` 并落新字段,两段密钥都走 `SecretField` 掩码回显 /
  留空保留;三个数值按服务商上下限夹取(ttl 60~3600、pinLength 4~8、attempts 1~10)。

**App(client-app)**

- 验证码页 `VerifyOtpScreen` 接真实接口:去掉演示码预填,格子数按后端 `pinLength` 渲染
  (后台配 4 位而前端写死 6 格的话,用户永远填不满、Continue 永远点不亮),
  验证通过后按 `scene` 分流(register→推荐码页 / login→直接登录 / reset→重置密码页)。
- **首次发码在上一屏发,本页只填码与重发**:注册页 / 忘记密码页 / 登录页的验证码入口各发一次。
  这么定有两个原因:① 本页挂载再发一次会连发两条、白烧一条短信;
  ② 「该手机号已注册 / 尚未注册」必须在**还能改号码的那一屏**报出来。
- 新增两页 `ForgotPasswordScreen` / `ResetPasswordScreen`(**设计稿没有这两张**,
  版式复用 AuthShell + 验证码页那张带描边的白卡,字段逐字沿用登录页取值,已在文件头注明);
  登录页新增「忘记密码」(与记住我同一行贴右端)与「验证码登录」(主按钮下方描边次要按钮,
  复用本页已填的手机号,不另开一页)——**这两个入口设计稿都没有**。
- 未配渠道时(50021)注册流程**直接跳过验证码页**去推荐码页,与后端「渠道启用才强制」对齐;
  不这么处理的话,未配渠道的站点会彻底注册不了。
- i18n 三份各补 8 键(共 **862** 键,脚本比对 missing / extra 均为空)。缅甸语仍是机器翻译。

**验证**

- 门禁:后端 **348 文件 `php -l` 零错**、shared **91 用例 / 945 断言**(原 58 用例,新增 33)、
  admin-web build、client-app `typecheck` + `expo export -p web`(已确认 4 个新接口进包,dist 已删)。
  本机 php 只有 7.2(认不了 8.x 语法),故 lint 与单测**在容器里跑**:
  `docker run --rm --entrypoint sh -v "C:/Codes/Mtrip/backend:/src:ro" mtrip-user-service:latest -c '...'`。
- **单测基建改动**:Redis / Db / ConfigInterface 三个桩从各用例文件**移到 `tests/bootstrap.php`**
  统一定义(run.php 按文件名 glob 加载,谁先定义取决于字母序,加新方法就得猜顺序);
  Redis 桩补 `setex/incr/expire/exists` 与 TTL 记录,Db 桩补 `connection()` 与 `transaction()`。
- **真实打到服务商验证过**:用假凭证发码,`sys_sms_log.fail_reason` 落到的是 SMSPoh 原文
  `Your request was made with invalid credentials.` —— 证明容器出网、TLS、URL 构造、
  响应解析、错误映射整条链路是通的(**未验的只有「凭真实凭证发出并收到短信」**,需真实账号)。
- 接口冒烟逐条命中:未配渠道发码 `50021`、非法 scene `40001`、未配渠道注册照旧放行;
  配上渠道后注册不带票据 `40111`、已注册号码发注册码 `40901`、未注册号码发登录码 `40401`;
  **发码失败不落冷却**(不然用户会被"发送过于频繁"锁 60 秒而实际一条都没发出去)。
- **票据与事务的端到端实测**:票据手机号不匹配 → `40111` 且票据被立即作废;
  推荐码填错 → `40001` + **建账号数为 0(事务已回滚)** + **票据保留**;
  同一票据改对推荐码重试 → 注册成功且票据随即作废。
- 冒烟数据已逐表清理复核:`user_info` 只剩用户自己的 id=1,`sys_sms_log` / `sys_sms_channel` 均 0 条,
  Redis `mtrip:otp:*` 无残留。`./mtrip.sh health` 8 个 healthz + 网关 + 5 个孪生全绿。
- **未做 / 遗留**:
  1. **没有真实 SMSPoh 凭证,真发一条短信的链路未跑通**。上线前需:在 v3.smspoh.com 申请 V3 凭证 →
     后台「配置 → 短信配置」建 smspoh 渠道(API Key / API Secret / Sender ID 三项必填)→
     走一遍注册,确认能收到码且验码通过。
  2. **浏览器/真机走查没做**(本会话无浏览器工具),需本地走一遍
     「注册 → 收码 → 填码 → 推荐码 → 登录页忘记密码 → 重置 → 验证码登录」。
  3. 后台**「发送测试短信」按钮仍是 comingSoon**(原本就是),接了 SMSPoh 后这个按钮值得做,本次未越界。
  4. 区号仍固定 +95,`normalizeMobile` 只去分隔符、不改写国家码(SMSPoh 三种写法都收)。
- 未执行任何 Git 操作。

### ★ 2026-09-07(订房 Step 3 结账选券,Figma `228:5118`,9月计划第 2 周 C-M6 的 App 部分)

**范围**:复核步(Step 3)的 Price Breakdown 自动应用最优券 + 弹窗更换/移除/恢复最优券。
第 2 周表格里的「价格试算接口」「创建订单再次校验」两行属后端 C-M6/C-M8,本次只做了选券必需的那一个接口。

**设计稿的两个事实**(先说清楚,免得下次以为是照抄):

- `228:5118` 的价格明细**没有券行** —— 只有 Original Price(划线)/ Room Price / Service Charge & Taxes(10%)/ TOTAL。
  券行是本次新增的。
- 但设计稿**预留了折扣行的样式**:`869:2503` 是一条 `hidden` 的「Member Discount (Gold Level)」/「- 27,750」,
  排版与普通行完全一致。券行按它做,**唯一偏离是金额用主色** —— 隐藏节点没给配色,
  折扣与房费同色会被读成又一笔收费。
- 选券弹窗设计稿也没画,沿用本流程既有的 `SelectSheet` 浮层做法(Modal + Animated + 黑 25% 遮罩)。

**后端(1 个新接口)**

- `GET /app/marketing/coupon/match-list`(`MarketingController::couponMatchList`):
  给定 `orderType/goodsId/skuId/amount`,返回本人**全部未使用券**的
  `{ list: CouponView[], best }`,每张券带**本单实际抵扣额 `discount`** 与 `unusableReason`。
  可用的排前面并按抵扣额从大到小,不可用的照样返回并给原因(用户要知道为什么不能选)。
  实现整段复用上一条目建的 `CouponView::receive($row, $ctx)`,没有第二套判定。
- **为什么不让前端算**:抵扣额必须与下单时 `PricingService::resolveCoupon` 同一公式,
  否则复核页显示的优惠与实际扣款会对不上。两处公式已逐行比对一致(折扣券 `base*(1-val/10)` → `max_discount` 封顶 → `min(discount, base)`)。
- `bestMatch` 保留不动(「自动应用最优券」用它就够,列表用新接口)。

**App**

- 新增 `components/hotel/booking/CouponPickerSheet.tsx`:券行 + 「最优」角标 + 每张券的抵扣额 +
  不可用原因(灰掉不可点)+ 底部「不使用优惠券」/「使用最优券」两个退路。
  券的文案(优惠值 / 门槛 / 有效期 / 原因)**复用优惠中心的 `couponFormat`** —— 同一张券在两个页面必须同一套说法。
- `ReviewCards.PriceRow` 扩了四个可选字段:`discount`(金额走主色)、`note`(券名/空态说明)、
  `actionLabel` + `onPress`(给了就整行可点)。Trip 页与支付页的既有用法未受影响。
- `ReviewBody` 新增可选 `coupon` 入参;**不传就完全不显示券行** —— Stay 明细页与演示模式行为一字未变。
- `HotelBookingScreen`:`couponEnabled = 真实模式 && 已登录 && 非多住宿`;
  房费(`current.roomPrice`)变化就重拉 match-list(改日期/间数后自动重新试算);
  `couponTouched` 守卫 —— 用户手动换过券之后不再被自动最优券覆盖,但**原券因金额变化而失效时会退回最优券**;
  吸底栏、支付页汇总卡与复核页总价统一走 `payableTotal = 总额 − 券抵扣`(免得 Step 3 显示优惠、Step 4 又变回原价);
  `createOrder` 提交 `couponId`(领券记录 id,**不提交前端算好的金额**,后端会用同一张券再算一次并以它为准)。
- i18n `hotels.booking.coupon.*` 9 键 ×3 语言(共 **852** 键,逐键对齐)。

**验证**

- `match-list` 实测两种金额,排序与判定都对:
  订单 **150** → 最优是「无门槛立减 10,000」但抵扣被压到 150(`min(discount, base)`),
  接着 15% = 22.5、10% = 15,两张满减券以 `min_amount` 落到末尾;
  订单 **400,000** → 15% 券 60,000 被 `max_discount` 封到 50,000 成为最优,其余按 40,000/30,000/20,000/10,000 排列。
- **「显示 = 实扣」端到端验证**:用 `couponId=15`(10% 券)真下了一单 —— `match-list` 在 amount=50,000 时给 5,000,
  `order/create` 返回 `couponDiscount: 5000 / payAmount: 45000`,完全一致。
  (顺带发现房型 `sku_id=2` 的**日历价现在是 50,000**,不是早前 HANDOFF 记的 150。)
- 冒烟数据已清理并复核:测试订单(id=6)及其 `order_booking_event` / `goods_stock_log` 已删、
  `goods_daily_stock` 2026-09-08 的 `stock_locked` 已归 0(行本身保留,等同基础库存状态,不删以免误伤商户设的价);
  临时账号 user id=8 及其 5 张领券记录已删,`received_count` **按 `marketing_coupon_receive` 重算**
  (不是置 0 —— 用户自己的 6 张券还在,详见下一条目的教训)。现 `user_info` 只剩 id=1。
- 门禁:后端 344 文件 `php -l` 零错、shared 58 用例 / 858 断言、client-app `typecheck` + `expo export -p web`(dist 已删)。
- **未做 / 遗留**:
  1. **浏览器实跑没做**(本会话无浏览器工具),需本地走一遍「进 Step 3 看是否自动选中最优券 →
     点券行换一张 → 选不使用 → 用最优券 → 回 Step 1 改日期再回来看抵扣是否重算」。
  2. `PricingService::resolveCoupon` **不校验 `sku_ids`(适用房型)**,而 `CouponView::matchScope` 校验。
     方向是安全的(客户端更严,只会少给券,不会多扣),但两处判定不完全同源;
     补齐属第 2 周「创建订单再次校验资格」那一行,本次未越界改 order-service。
  3. 长住折扣仍是 0(没配梯度),所以券的计算基数目前 = 房费;接长住(第 3 周)后基数会变成「房费 − 长住折扣」,
     届时前端传给 `match-list` 的 `amount` 要跟着改。
- 未执行任何 Git 操作。

### ★ 2026-09-07(C-M6 / C-M6.1 优惠中心真实化,9月计划第 1 周)

**范围**:《2026年9月酒店核心业务开发计划》第 1 周表格里 **C-M6(后端 2 行)+ C-M6.1(App 2 行)**。
同表的 M-M8(商户端促销可见状态)与 A-M14(平台后台发放追踪)是另外两个 Module,**本次未做**。

**后端(marketing-service)**

- **统一券口径 = `app/Service/CouponView.php`**(新增):领券中心 / 活动详情 / 券详情 / 我的券 /
  结账择优五处共用一套字段。命名沿用本服务既有约定 —— **库列 snake_case 直出、计算值 camelCase**
  (`canClaim`/`myReceived`/`unusableReason`),所以 `availableCoupons` 的老字段没有破坏性变更。
  状态与不可用原因**一律下发机器码**(`claimable|unclaimable|available|unusable|used|expired|void`,
  `sold_out|limit_reached|not_started|expired|used|void|min_amount|scope|offline`),
  文案交给各端 i18n —— 后端不给 App 下发中文,否则缅甸语用户会看到中文提示。
  `claim` / `redeem` 的可领判定都走 `CouponView::template()`,与列表上写的「能不能领」是同一处代码,
  不会出现「列表说能领、点了说领完」。
  `applicable_hotels` / `applicable_rooms` 由 `attachApplicable()` **批量**补名(join `goods_info` /
  `hotel_room_type`),避免逐券 N+1。
- **新增两个路由**:`GET /app/marketing/coupon/detail`(`receiveId` 我的券 / `couponId` 券模板,
  两者返回同一套字段,App 不用分支)、`POST /app/marketing/coupon/redeem`(促销码兑换)。
- **促销码兑换**:`code` 大小写不敏感(`UPPER(code)` 比对);站点不符与不存在**返回同一个码**,
  免得暴露其他站点的促销码;校验顺序是 促销码状态/有效期/总量 → 是否绑券 → 每人限兑 → 券模板本身可否领。
  成功后在**同一事务**内写 `marketing_coupon_receive` + `marketing_promo_code_redeem` 并累加两处计数。
- **错误码按五类拆开**(shared `ErrorCode` 新增,附 HTTP_MAP / MESSAGE_MAP):
  `PROMO_CODE_NOT_FOUND=40411`(404)、`PROMO_CODE_EXPIRED=40911`、`PROMO_CODE_EXHAUSTED=40912`、
  `PROMO_CODE_DUPLICATED=40913`、`PROMO_CODE_INELIGIBLE=40914`(后四个 409)。
  **这是刻意的**:计划要求「错误码区分不存在、过期、领完、重复和资格不符」,
  只用 40401+40901 两个码,App 分不出「过期」和「兑完」,只能把后端中文原样弹出来。
- **迁移 `database/marketing/08-consumer-coupon-promo.sql`**(幂等,查 information_schema;
  compose initdb 登记为 `99m-`,存量库已用 `scripts/db-apply.ps1` 应用并**连跑两次成功**):
  `marketing_coupon` 补 `sku_ids`(适用房型 —— 原表只有 `goods_ids` 即酒店级,表达不了「仅某几个房型」)
  与 `stackable`(叠加规则 —— 原表一个字段都没有,而券详情与结账都要展示);
  `marketing_promo_code` 补 `coupon_id`(兑换发放的券模板);新增 `marketing_promo_code_redeem`。
  **为什么要新表**:原表只有 `usage_count` 总量、没有按人的记录,`per_user_limit` 一直是摆设,
  「重复兑换」根本校验不了。
- **两处口径决定**(代码里已注明):① 促销码 `per_user_limit<=0` 时**按 1 次**处理
  (「一个码无限次兑同一张券」不是合理默认);② `coupon_id=0` 的存量促销码(后台只填了
  discount_type/value 的老数据)在 C 端**不可兑换**,返回 40914 而不是假装成功。
- `bestMatch` 增加 `skuId` 入参,抵扣与不可用判定改走 `CouponView::receive($row, $ctx)`,
  与券详情同源。**结账接入是第 2 周的事,本次只把后端口径备齐。**

**App(client-app)**

- 新增 `api/marketing.ts`(7 个接口)与 **`screens/promotions/couponFormat.ts`** ——
  「券字段 → 卡片文案」的唯一出口(金额/百分比标题、门槛副标题、有效期行、状态→按钮、原因文案),
  领券中心 / 我的券 / 券详情三处共用,免得同一张券在两个页面显示成不同金额或不同状态。
- `CouponCard` 改吃 `CouponCardModel`(成品文字),**不再认识后端字段**;设计稿示例券经
  `demoToCouponCard()` 转成同一个模型,两条路径共用同一个组件。
- `PromotionsScreen` 承担活动 + 领券中心 + 我的券三份数据与领取/兑换/刷新;
  `CouponsTab` 补「有效 / 已用 / 失效」三分类(设计稿没有,后端 `?type=` 本来就支持)与真实促销码兑换;
  `CouponDetailScreen` 按路由参数(`CouponDetail: {receiveId?} | {couponId?}`)拉真实详情。
- **登录后不再出现静态券**:为空给空态文案,`promoSections.ts` 的设计稿示例券只留给未登录
  —— 与「我的精选 / 收藏酒店」是同一条口径(登录后拿示例数据冒充,看起来就像没接后端)。
- **本页是常驻 Tab,刷新用 `useFocusEffect`**(同 MyPickScreen 的教训:`useEffect` 只在挂载时跑,
  从券详情领完券切回来会看到旧数据)。
- **对设计稿的三处偏离**(代码内均已注明):
  1. 券列表分段由设计稿的「每周 / 每月 / 酒店」改为「可领取 / 暂不可领」——
     后端没有这个分组维度,**不拿分组名硬套**(三个旧 i18n 键保留未删)。
  2. 券卡角标:真实券推不出「新用户 / 热门」这类运营标签,只在设了发行总量时显示「限量」,
     其余**不显示角标**而不是硬编一个。
  3. 券详情的「条款与条件」在有真实券时改为**由券数据生成**(门槛 / 封顶 / 适用酒店房型 /
     叠加规则 / 有效期),不再显示设计稿那四条与本券无关的通用文案;未领取的券底部按钮是
     「立即领取」而不是「立即使用」,券码框在未领取时整块隐藏(没有码就别画空框)。
- i18n 三份各补 39 键(共 **843** 键,脚本比对 missing / extra 均为空)。
  `promotions.myCoupons.empty` 由字符串改为按分类的对象(旧值已无引用)。缅甸语仍是机器翻译。

**验证**

- 迁移连跑两次成功,四项 schema 变更逐项核对存在。
- **接口全链路冒烟**(网关 8081,临时账号 + 三张券模板 + 一个促销码 + 一个活动):
  领取成功 → 再领 `40901 已达个人限领` → 领已领完的券 `40901 已领完`;
  兑换成功(小写 `smoke2026` 也认,发的是「领后 7 天」型券) → 重复兑换 `40913` →
  不存在 `40411` → 空码 `40001`;改数据后逐条命中 `40911 过期`、`40911 尚未生效`、
  `40912 兑完`、`40914 未绑券`、`40411 站点不符`。
  `coupon/my` 三个分类、`coupon/detail` 两种入参、`campaign/detail` 带券列表均正确;
  `best-match` 在 40 万订单上选中**封顶 5 万的折扣券**而非 3 万满减券,10 万时满减券因门槛被排除,
  换 `goodsId=99` 后折扣券因适用范围被排除、回落满减券,再降到 10 万返回 `null`。
- **冒烟数据已逐表清理复核**:`marketing_coupon` / `marketing_coupon_receive` /
  `marketing_promo_code` / `marketing_promo_code_redeem` / `marketing_campaign` 全部 `count=0`,
  临时账号(user id=6)及其 `user_referral` / `notify_record` / `user_action_log` 已删,
  `user_info` 只剩用户自己的 id=1。
- 四项质量门禁全绿:后端 **344 文件 `php -l` 零错**、shared **58 用例 / 858 断言**、
  admin-web build、client-app `typecheck` + `expo export -p web`(dist 已删)。
  注意 `scripts/check.ps1` 在本机仍第 1 步就断(php 不在 PATH,本机 BtSoft 只有 PHP 7.2 认不了 `match`),
  故 lint 与单测是**在容器里跑的**:
  `docker run --rm --entrypoint sh -v "C:/Codes/Mtrip/backend:/src:ro" mtrip-marketing-service:latest -c '...'`。
- `./mtrip.sh health` 8 个 healthz + 网关链路 + 5 个孪生全绿;marketing-service 与其 APP 孪生均已重启。
- **未做 / 遗留**:
  1. **浏览器/真机走查没跑**(本会话无浏览器工具),需本地起 App 走一遍
     「优惠活动领券 → 切我的券三分类 → 兑促销码 → 进券详情 → 立即使用跳酒店搜索」。
  2. **后台还不能配置新加的两列**:`sku_ids`(适用房型)与 `stackable`(叠加规则)已在库与接口里,
     但 admin-web / merchant-web 的券表单没有对应字段,现在只能改库。补表单属 A-M14 / M-M8,
     是第 1 周表格里的另外两行,本次刻意未越界。
  3. 结账选券(自动最优券 / 换券 / 移除)是**第 2 周**的 C-M6,本次只备齐后端口径,
     结账页的优惠券区仍是原样。
- 未执行任何 Git 操作。

### ★ 2026-09-03(「我的精选 / 收藏酒店」= 真实收藏)

- **反馈**:MyPick 的 Saved Hotels 应该是收藏的酒店。查网关日志确认**接口本来就通**:`09:22:19 favorite/add 200` → `09:22:23` 酒店页重拉得到 1 条(217 字节)→ `09:29:20` MyPick 重拉也是 1 条。库里 `user_favorite` 有 `user 1 / goods 1` 那条。
- **真正的两个毛病**:
  1. **不刷新**:`MyPickScreen` 用的是 `useEffect(..., [load])`,而它是常驻的底部 Tab —— 切走切回不会重新挂载,在酒店页收藏完切回来还是旧数据。已改 `useFocusEffect`(与 `MineScreen` 一致),顺带让订单列表也跟着获焦刷新。
  2. **空收藏时拿设计稿示例卡冒充**:原来是 `favorites.length > 0 ? favorites : SAMPLE_SAVED_HOTELS`,登录后收藏为空也会显示 2 张假酒店,看起来就像「没对接后端」。改为 `isLogin ? favorites : SAMPLE_SAVED_HOTELS` + 空态文案(`myPick.savedHotels.empty`),示例卡只留给未登录(与上面预订卡的处理一致)。
- **卡片同步做成真的收藏卡**:`StayCard` 加两个可选入参 `favorite` / `onToggleFavorite`(不传 = 首页那种不可点的空心装饰,行为不变)。收藏列表里心形是**实心且可点**,点了调 `/user/favorite/remove` 并就地移除(`myPick.savedHotels.removed`)。
- **点卡跳转纠正**:收藏的酒店(`goods_type=1`)改跳设计稿的 `HotelDetail`,与酒店搜索结果页一致;其余品类仍回落 `GoodsDetail`(原先一律跳通用商品详情)。
- 收藏列表接口不返回起价(`minPrice=0`),`StayCard` 早已按 `minPrice > 0` 隐藏价格行,无需额外处理;封面继续走 `tempCoverFor()` 兜底(真实 `cover_image` 目前多是脏值,库里那条就是 `'111'`)。
- **验证**:`npx tsc --noEmit` 零报错;接口侧用网关日志与 `user_favorite` 表核对过。**UI 未实跑**(获焦刷新与取消收藏的交互需要在真机/浏览器点一遍)。

### ★ 2026-09-03(网关无限重启的真因:启动命令漏了 APP 孪生池 + 一个漏执行的 SQL)

- **`mtrip-gateway-1` 一直重启,与 SQL 无关**:日志是 `nginx: [emerg] host not found in upstream "system-service-app:9501" in /etc/nginx/conf.d/mtrip.conf:20`。nginx **启动期**就要解析 upstream 主机名,解析不到直接退出,再被 `restart: unless-stopped` 拉起 —— 无限循环。
- **根因是启动方式**:`docker ps -a` 里只有 8 个主池服务,**一个 `*-service-app` 都没有**。孪生池定义在 `docker-compose.app-pool.yml`,裸 `docker compose up -d` 只加载 `yml + override`,起不出来;而网关自 commit `0921843`(管理端/APP 端服务分离)起就有 5 条 upstream 指向孪生。**唯一正确入口是 `deploy/mtrip.sh`**(dev 模式固定合并 4 个 compose 文件)。
- **文档是这次踩坑的源头,已一并改**:`CLAUDE.md`、`deploy/README.md`、`docs/guides/setup/启动开发指南.md` 里的 `docker compose up -d --build` 全部改成 `./mtrip.sh build|start|restart`,并写明「裸命令会导致网关无限重启」的因果。
- **本机 `-app` 镜像是 tag 出来的,不是 build 的**:首次 `up` 会去 build 孪生,但拉不到基础镜像 `hyperf/hyperf:8.1-alpine-v3.18-swoole`(`registry-1.docker.io` 连接超时)。孪生与主池用**同一个 Dockerfile 与构建上下文**,故直接 `docker tag mtrip-<svc>-service:latest mtrip-<svc>-service-app:latest`(5 个)即跳过构建。**下次跑 `./mtrip.sh build` 仍会因拉不到基础镜像而失败**,需要先解决 registry 网络或配镜像加速。
- **顺手修了 `./mtrip.sh health` 的误报**:网关转发探针写死「无签名 POST 预期 401」,但本机 `.env` 是 `MTRIP_CLIENT_SIGN=false`,请求会越过签名中间件落到业务校验返回 **400**(`40001 缺少站点标识`),于是 health **恒定退 1**。已改为 401/400 都算通过(都证明已达上游),并把 502/504 与 404 分开给出具体处置建议。现在 `./mtrip.sh health` 全绿退 0。
- **SQL 确实漏了一个**(你的直觉没错,只是与网关无关):initdb 只在数据卷首次初始化时跑,而本机 `mtrip_mysql-data` 建于 **2026-08-28**,之后有 20 个 SQL 被改动/新增。逐表核对(声明的 `CREATE TABLE` vs `information_schema`)只缺 **`merchant_code_sequence`**(`database/merchant/38-merchant-code-sequence.sql`,2026-09-02 的商户编号跨表唯一性修复)—— 缺它会让商户业务编号分配直接报表不存在。已用 `scripts/db-apply.ps1` 补跑 38 与同批的 39(`39-mch-5019-site-fix.sql`,带 `site_id = 0` 条件的一次性数据修复,幂等)。补完 133 张表齐全,序列表播种为 `next_value=8`。
- `database/merchant/22-kyc-template-restore.sql` 仍是**故意不登记** initdb 的一次性修复脚本(HANDOFF 2026-08-21 与整改方案里都写过),不是漏登记。
- **现状**:13 个容器(含 5 个孪生)全部 Up,`./mtrip.sh health` 8 个 healthz + 网关链路 + 5 个孪生全 200。

### ★ 2026-09-03(H5 输入框聚焦黄框 / 自动填充底色)

- **反馈**:点输入框聚焦时出现黄色的框。RN Web 把 `TextInput` 落成真实 `<input>`,浏览器有两套默认外观会盖到设计稿上:`:focus` 的系统 outline(Chromium 蓝、部分国产内核黄),以及 `-webkit-autofill` 的自动填充底色(老版 Chrome / Edge / 国产浏览器是黄的)。
- **修法**:新增 `utils/webStyles.ts` 的 `applyWebGlobalStyles()`,`App.tsx` 启动时调一次 —— **只在 web 生效,原生端空转**。注入两条规则:① `input/textarea/select:focus { outline: none }`;② 自动填充用「把 `background-color` 过渡拖到 100000s」压住,文字色取 `currentColor`。**没用 `inset box-shadow` 的老写法**,因为本项目输入框底色有 `#EFF4FF` 与纯白两种,那种写法得按底色各写一遍。
- **刻意只作用于表单控件**:按钮/链接的焦点框保留(键盘可达性)。
- **注意**:全项目 20 个 `TextInput` 分布在 14 个文件里,所以走的是一处全局补丁而不是逐个改 style —— 新增输入框自动生效。
- **验证**:`npx tsc --noEmit` 零报错、`expo export -p web --clear` 打包通过。**未在浏览器里肉眼确认**(本机不能起 App);若黄框实际出现在 Android 原生端,那是另一回事(`underlineColorAndroid`),本补丁不覆盖。

### ★ 2026-09-03(「更多」页去掉原生「More」顶栏)

- **结论**:More 页**只保留设计稿 `1690:4642` 的 mTrip 字标栏**,原生导航头(居中「More」)去掉 —— `MoreTab` 补上 `headerShown: false`,与另外三个 Tab 一致。
- **为什么之前会有两条**:`@react-navigation/bottom-tabs@6.6.1` 的 `headerShown` 默认是 `true`,而 `MoreTab` 从建栈起就没设过 `false`(git 历史可查),于是它是唯一带原生头的 Tab。
- **`MineScreen` 的 `SafeAreaView edges={['top']}` 必须留着**:原生头已关,状态栏高度只能由页面自己让开。(中途曾按「保留原生头」的方向把它改成普通 `View`,已改回。react-navigation 只向下透传 header 高度、**不会把安全区扣掉**,见 `@react-navigation/elements/lib/commonjs/Screen.js` —— 所以这两处是绑定的:谁开原生头,谁就不能再叠 top 安全区。)
- **mTrip 栏维持现状(用户明确不改)**:该栏目前只画了 logo,设计稿 `1690:4642` 右侧的积分胶囊(370)与铃铛未实现(首页 `components/home/HomeHeader.tsx` 就是这套,我的精选页在复用)。**不要**擅自补齐。
- **验证**:`npx tsc --noEmit` 零报错;未在真机/浏览器走查。

### ★ 2026-09-03(首页搜索框 Explore 按钮溢出修复)

- **现象**:部分机型 / H5 上首页搜索框的 Explore 按钮被顶出圆角白底。
- **根因**:`components/home/SearchSection.tsx` 的 `input` 只写了 `flex: 1` 而**漏了 `minWidth: 0`** —— 全项目 5 处 `flex: 1` 的 TextInput 只有它漏了。web 端 TextInput 落成 `<input>`,其 `min-width: auto` 约等于 20 个字符宽,`flex: 1` 压不下去;富余空间为负时整行溢出,表现就是右侧按钮跑到白底外面。窄屏 + 超大系统字号 + 缅甸语「လေ့လာရန်」比英文宽,叠起来更容易触发,所以只在「部分机型」上看得到。
- **修复**:① `input` 补 `minWidth: 0`(与登录页 / 酒店搜索框同款注释);② 按钮补 `flexShrink: 1` + `minWidth: 0` 兜底 —— `input` 的 flexBasis 是 0,负富余空间会全落在按钮上,默认 `flexShrink: 0` 时它只会溢出;③ 按钮文字加 `numberOfLines={1}`,极端窄屏改为省略号而不是顶破外框。
- **验证**:`npx tsc --noEmit` 零报错。未在真机/浏览器复现与回归(本机无法起 App),建议下次会话在窄屏 + 缅甸语 + 大字号下走查一眼。

### ★ 2026-09-03(client-app 短信验证码页 + 推荐码页,Figma Onboarding `752:9380`)

- **新增两页**:`screens/user/VerifyOtpScreen.tsx`(Figma `566:3741` 空态 / `566:3902` 填充态,路由 `VerifyOtp`)与 `screens/user/ReferralCodeScreen.tsx`(Figma `1077:1734`,路由 `ReferralCode`),两页都关掉 Stack 头(自带设计稿顶部栏)。注册链路由「一页」变成 **注册表单 → 短信验证码 → 推荐码** 三步。
- **短信通道还没接**,故验证码页是走过场:进页面就把演示码 `123456` 预填好,Continue 只校验「填满 6 位」,填什么都通过;倒计时 02:00 起跳,归零后「Resend OTP」可点,点了也只是把倒计时重置并重填演示码。接真实短信时改动集中在三处 —— 进页面不再预填、`resend` 调发码接口、`submit` 先调验码接口(文件头注释里已标出)。
- **推荐码是真的会上送的**(与短信不同,后端本来就有这条链路):`apiRegister` 入参补 `referralCode`,Continue 带码提交、Skip 不带码提交。
- **注册请求整体后移到推荐码页**:后端 `/app/auth/register` 是一次性收单(手机号 + 密码 + 推荐码),而设计稿把推荐码排在最后,所以 `RegisterScreen` 改为**只校验不落库**,把新增的 `SignupDraft`(手机号 / 密码 / 邮箱)经路由参数透传,由 `ReferralCodeScreen` 的 Continue / Skip 统一调 `register()` + 写 GDPR 授权 + `popToTop()`。
- **抽出公共外壳 `components/user/AuthShell.tsx`**:主色底 + 插画铺底 + 顶部栏(返回 / 右侧文字链)+ logo/标语 这套壳在 Onboarding 的四张稿里逐字相同,原先只写在 Login/Register 两页里。本次抽成一处并把 **Login / Register 同步改用**(取值一字未动,只是搬家),新两页直接复用。卡片仍留在各页 —— 登录/注册卡 gap 8 无描边,验证码/推荐码卡 gap 24 且带 1px `--secondary` 描边 + DS_AG 投影。
- **i18n**:`user.otp.*`(8 键)与 `user.referral.*`(5 键)中英缅三份逐键对齐(缅甸语仍是机器翻译,待母语者复核)。
- ⚠ **后端遗留隐患(本次未改)**:`UserAuthService::register` 先 `insert` 了 `user_info`,之后 `setupReferral()` 才校验推荐码,且**两步不在同一事务里**。因此推荐码填错时会「注册失败但账号已经建好」,用户再试会被告知「该手机号已注册」。以前 App 侧没有推荐码入口所以碰不到,现在有了。修法是把 insert + setupReferral 包进 `Db::transaction`(需要后端跑 Docker 验证,故留给下一次会话决定)。
- **验证**:`npx tsc --noEmit` 零报错。**未在模拟器/浏览器里跑过真实注册流程**(本机 Docker 无权限,后端起不来),视觉与交互按设计稿取值实现,建议下次会话起服务后走一遍三步注册。未执行 Git 操作。

### ★ 2026-09-02(mtrip-ops 输入框样式修复 + 发布管理接入 auto-deploy 全能力)

- **输入框「矮一条缝」的根因**:`public/app.css` 里有一条无差别的 `label input { width:auto; height:auto }`,本意是让筛选栏的复选框恢复原生尺寸,却把登录页 `<label>用户名<input></label>` 结构里的**文本框高度也一并清零**了。已把该规则**收窄为只作用于 `input[type=checkbox]` 与 `input[type=radio]`**。
- **输入框整体重做**:基础高度 44 → 48px(登录页 52px),圆角 16 → 14px,新增 hover/focus 态(品牌色描边 + 3px 聚焦环)、placeholder 配色、disabled 态;`select` 原生箭头在深色主题下几乎看不见,改为自绘箭头。
- **顺手理顺一处主题欠债**:四套主题各自定义了 `--field` 变量专供输入框,但基础样式却硬编码 `rgba(255,255,255,0.72)` 再用 `body[data-theme="classic-dark"] input {...}` 打补丁。现改为直接 `background: var(--field)`,**删掉了那条补丁规则**,四套主题自动正确。
- **登录页与用户管理表单**:登录卡加宽到 420px、内距与间距放大;`.login-card label` 必须显式 `white-space: normal`(全局 `label` 是 `nowrap`);用户管理页行内表单控件统一 42px 高、最小宽度,新建账号表单改为可换行的弹性布局。
- **发布管理页重做**(用户反馈:auto-deploy 已支持「自动拉取 + 按变更精准发布」与「强制指定发布某个应用」,但面板只暴露了 dry-run):
  - `src/runner.js` 新增 `deploy-auto`(`auto-deploy.sh` 无参数,全自动)、`deploy-target` / `deploy-target-dry`(`auto-deploy.sh [--dry-run] <目标>`)。目标白名单由 `deployTargetGroups()` 按「前端 / 后端主池 / APP 孪生 / 网关」四组给出,渲染层直接拿来做 `<optgroup>`。
  - **修了一个会导致部署被腰斩的问题**:`runWhitelistedCommand` 默认超时 180s,而全量自动部署含前端构建(仅 client-app 的 Expo web 打包就要 1-2 分钟,首次还要 `npm ci`)必然超时被 KILL。部署类命令超时改为 **15 分钟**。
  - 页面新增「自动部署」与「指定目标发布」两张卡(各带预检 + 真执行两个按钮、`高风险` 徽标、二次确认弹窗),并在 `enableActions=false` 时把所有按钮置灰 + 顶部横幅说明;工作区不干净时提前给出 ff-only 会中止的警告,并指路「指定目标发布」(它跳过洁净门禁)。
- **登录后跳转 404 修复**:会话过期时若用户正好 POST 了某个动作(如「执行 health」),守卫会把 `/actions/mtrip-health` 这个**只接受 POST 的路径**存进 `next`,登录成功后用 302(GET)跳回去必然 404。两处同时拦:① 守卫只在 `req.method === 'GET'` 时记 `next`,POST 一律回 `/`;② `safeNext()` 增加 `POST_ONLY_PREFIXES`(`/actions/`、`/users/`、`/logout`)黑名单兜底。原有的开放重定向防护(必须 `/` 开头且非 `//`)保留。
- **登录卡加宽**:420 → 560px,内距 40/36 → 48/52,标题 21 → 23px,并补窄屏(≤600px)回落规则。
- **验证**:发布页在 viewer 仍 403,operator/admin 可见新卡片。**注意**:自动部署与指定发布的「真执行」按钮本次**未在本机实跑**(会真的拉代码并重启服务),只验证了命令构造与白名单拦截,首次使用请先点「预检」。**本轮改动因命令行持续限流,`npm run check` 未能执行,下次会话请先补跑。**

### ★ 2026-09-02(mtrip-ops 账号鉴权 + 三级权限 + 启停脚本)

- **背景**:`mtrip-ops` 运维控制台此前**完全没有鉴权**,`src/server.js` 的 `handle()` 对所有路由直接放行;而 `mtrip-ops/ops.config.json` 里 `enableActions: true`,意味着任何能连到 `127.0.0.1:56700` 的人(同机任意用户、任意 SSH 端口转发)都能读全部业务日志、跑 `git pull`、重启任意服务、备份数据库。`docs/02-实施计划.md` 早把「账号登录与 RBAC」列为待办。本次补齐。
- **新增 `src/auth.js`(零依赖,只用 `node:crypto`)**:scrypt 加盐哈希 + `timingSafeEqual` 校验;用户存 `data/users.json`(`0600`,该目录已全量 gitignore);会话为「进程内 Map + 32 字节随机 sid」,cookie `HttpOnly; SameSite=Strict`,空闲 8 小时失效。**首次启动无账号时自动建 admin,随机口令只打印一次**,不留可猜默认口令。登录失败按「用户名+IP」5 次锁 5 分钟,且「用户名不存在」与「口令错误」返回同一提示以防账号枚举。
- **三角色 RBAC**(对齐 `docs/03-安全模型.md` 既有风险分级):`viewer`(只读页面)/ `operator`(+ 全部白名单动作)/ `admin`(+ `/users` 账号管理)。判定统一走 `can(user, perm)`,路由层**默认拒绝**;导航栏同步按权限隐藏入口,但**隐藏只是界面收敛,真正拦截在路由层**。角色与禁用状态每次请求回读 `users.json`,故管理员改角色/禁用账号对目标用户的**当前会话立即生效**。
- **防自锁**:最后一个可用管理员不能被降级、禁用或删除;不能删除当前登录账号。
- **CSRF**:每会话一个 token,全部状态变更表单带隐藏域并在服务端比对(`SameSite=Strict` 之外的第二道 —— 该面板能跑 `git pull` 与重启服务)。
- **审计补齐**:`src/runner.js` 的 `runWhitelistedCommand()` 增加第 4 个参数 `actor`,审计行落 `user` 与 `ip`,并新增 `command-rejected` 类型记录越权/未知命令探测。这是补上 `docs/03-安全模型.md`「审计字段」写明却一直没实现的两项。`/audit` 页新增「操作人」「来源 IP」两列(历史记录显示 `-`)。
- **新增 `mtrip-ops/ops.sh`**(非 systemd 场景的启停):`start|stop|restart|status|logs`。start 校验 Node ≥20、拒绝重复启动、**等端口真正就绪才报成功**、进程秒退时直接打印日志尾部,并在首次初始化时主动把随机管理员口令提示出来;stop 先 TERM 再 KILL;pid 存活判断额外校验 `/proc/<pid>/cmdline` 含 `src/server.js`,**防 pid 复用误杀无关进程**。pid 与日志落 `data/`,不进 Git。
- **注意**:会话在内存,**进程重启即全部登出**,这是「简单优先」的已知取舍,已写进 README。生产挂 HTTPS 时需在 `auth.js` 的 `sessionCookie()` 补 `; Secure`。忘记管理员口令的恢复方式是删 `data/users.json` 重启(会清空全部账号),已写进 README。
- **验证**:`npm run check`(已把 auth.js 加进该脚本)与 `bash -n ops.sh` 通过;隔离实例实测首次初始化打印口令且 `users.json` 内无明文、权限 `0600`;未登录访问 6 个受保护页面全部 302 到 `/login`、`/api/*` 返回 401 JSON、`/login` 与 `/public/*` 正常放行;错误口令 401、正确口令拿到 `HttpOnly; SameSite=Strict` cookie 后各页 200。

### ★ 2026-09-02(client-app H5 纳入部署链路 + 三个既有缺陷修复)

- **背景**:`deploy/web/` 只托管 admin/merchant/supplier 三个前端,移动端 `client-app` 完全不在部署链路里(`auto-deploy.sh` 刻意跳过)。本次把它的 **H5 网页版**补齐为第四个静态站点。**iOS/Android 商店发版仍走人工 EAS,刻意不进脚本**(提审是不可回退的对外动作)。
- **新增静态站 client**:产物目录 `deploy/web/client/`,网关直连端口 **8093**(`mtrip.conf` 新增 server 块,与 8092 块逐字一致仅 root 不同;compose 加端口映射与只读挂载;`.env.example` 补 `ADMIN_WEB_PORT`/`MERCHANT_WEB_PORT`/`SUPPLIER_WEB_PORT`/`CLIENT_WEB_PORT` 四个变量 —— 之前一个都没有,端口不可发现)。
- **`auto-deploy.sh` 接入**:`client-app/*` 变更 → 自动 `npm run build:web` 并原子发布(与另外三个同构);强制目标新增 `client-app|client|h5`,`mobile|native` 只提示原生走人工。新增 `web_dist_dir()`(`client-app`→`client`)与 `web_build_script()`(`client-app`→`build:web`)两个映射,原先的死变量 `FE_WEBS` 现已真正承担工程清单职责。`publish_web()` 补 `node_modules` 不存在时也 `npm ci`。
- **修复 1 —— `.env.production` 的 API 地址是错的**:原值 `EXPO_PUBLIC_API_BASE_URL=/api/v1`。该变量语义是 **origin** 而非路径前缀(`src/api/*.ts` 的 URL 本身就带 `/api/v1/...` 全前缀,`request.ts:70` 也按 `startsWith('/api/v1/app/')` 判断签名),原值会拼成 `/api/v1/api/v1/app/...` 全部 404,`resolveMediaUri` 也会把图拼成 `/api/v1/uploads/...`。**正确值是 `/`**。注意**留空同样不行** —— 实测编译产物确认 Expo 把空值 `.env` 变量当未定义丢弃,`??` 会回落到 `DEFAULT_BASE_URL.production = https://api.mtrip.com`。同时补了缺失的 `EXPO_PUBLIC_ENV=production`(否则 `IS_DEV=true`,debug/info 日志会进生产包)。
- **修复 2 —— Metro 缓存会编进过期 env**:Metro 按【源文件内容】缓存 transform,只改 `.env` 而 `env.ts` 没动时会复用旧缓存。实测改完 `.env.production` 重新 export,产物里仍是旧地址;必须 `--clear`。故 `build:web` 固定为 `expo export -p web --clear`,**不要去掉**。
- **修复 3 —— 发布后 cron 自动部署会永久中止**:`deploy/web/<app>/index.html` 占位页是被 git 跟踪的,每次发布都被构建产物覆盖 → `git status --porcelain` 永远非空 → ff-only 洁净门禁从「第一次发布之后」开始把每一次 cron 运行都判为脏工作区而 `exit 1`。已新增 `workspace_status()` 用 pathspec `':!deploy/web'` 把发布目标排除出洁净判断(发布产物不是源码)。
- **宝塔面板适配**(用户实际用宝塔建站,站点监听 :80 按域名分流,根目录指向 `deploy/web/<名>/`):
  - 站点根目录下的 `.user.ini`(被 `chattr +i`,删会报 `Operation not permitted`)与 `.htaccess` 不是构建产物,原先的 `rsync -a --delete` 会尝试删除它们导致整次发布失败。已加 `--exclude='.user.ini' --exclude='.htaccess'`(被 exclude 的文件在接收端不会被 `--delete` 清理,已实测验证)。**不要去掉这两个 exclude。**
  - 8090~8093 是 **gateway 容器**监听的直连端口,`auto-deploy.sh` 本身不监听任何端口(它只构建 + rsync 文件)。宝塔场景下这几个端口只是额外调试入口。
  - **宝塔站点必须自己加 `/api/` 与 `/uploads/` 反代到网关 `:8081`**,否则同源相对路径的接口全部 404。配置片段见 `deploy/README.md` 第 7 节。
- **验证**:`npm ci` + `typecheck` + `build:web` 通过;编译产物实测 `e.API_BASE_URL="/"`、`api/v1/api/v1` 出现 0 次、`/api/v1/app/goods/home` 存在;`scripts/auto-deploy.sh client-app` 实跑发布成功(`deploy/web/client/` 得到 index.html + `_expo/` + `assets/`);`docker compose config` 合法且四个挂载/端口齐全;`mtrip.conf` 大括号平衡、8093 块与 8092 块 diff 仅 root 一行;rsync 保护与洁净门禁排除均已用构造场景实测。**未执行 Git 操作**。Docker daemon 本机无权限(需 sudo),故 `openresty -t` 与 8093 端口实访未跑,留待部署机复验。

### ★ 2026-09-02(auto-deploy 强制发布指定目标)

- `scripts/auto-deploy.sh` 新增强制发布 target 模式:命令行只要带非选项目标(如 `admin-web` / `goods-service` / `goods-service-app` / `gateway`),就跳过 `git fetch`、落后判断、`ff-only merge` 与工作区干净门禁,直接按目标执行当前工作区内容的发布/重启。
- 用法: `scripts/auto-deploy.sh admin-web` 直接构建并发布 `deploy/web/admin/`; `scripts/auto-deploy.sh goods-service goods-service-app gateway` 直接重启对应主池、APP 孪生和网关。`--dry-run` 可预览决策且不构建、不重启。
- 范围边界:强制目标支持 `admin-web` / `merchant-web` / `supplier-web`、后端 `*-service`、APP 孪生 `*-service-app`、`gateway|openresty`; `client-app|mobile|app` 只提示需单独 Expo/商店发版,不会部署。默认无 target 的 cron 模式保持原 ff-only 安全策略不变。
  - **【已被 2026-09-02「client-app H5 纳入部署链路」条目取代】** 现在 `client-app|client|h5` 是有效强制目标(发 H5),`client-app/*` 变更在 cron 模式下也会自动构建发布;只有 `mobile|native`(原生商店发版)仍不部署。
- 验证:`bash -n scripts/auto-deploy.sh` 通过;`scripts/auto-deploy.sh --dry-run admin-web`、`bash scripts/auto-deploy.sh --dry-run goods-service goods-service-app gateway` 均正确跳过 fetch 并输出部署决策。脚本已补执行位,可直接 `scripts/auto-deploy.sh ...` 调用。

### ★ 2026-09-02(入驻线索必选站点 + MCH-5019 站点修复)

- 根因：超级管理员“录入线索”弹窗没有站点字段，提交也不带 `siteId`；`OnboardingController::create()` 对缺失值默认写 `0`，后续申请、KYC、正式商户、物业、商品和房型全部继承平台作用域，市场排名又明确要求具体 `site_id>=1`。
- 修复：admin-web 创建线索时对超级管理员显示必选 `SiteTreeSelect` 并提交 `siteId`；普通站点管理员仍使用自身站点。后端新增 `siteId>0` 硬校验，绕过前端同样返回 `40001`。中英文提示已补齐。
- 存量：用户明确确认将 `MCH-5019` 迁移到 `site_id=1（全球）`。新增幂等脚本 `database/merchant/39-mch-5019-site-fix.sql`，覆盖申请/业务、商户、物业、商户管理员、访问码与活动审计、KYC文件/时间线、酒店商品、房型及房型审核版本；compose initdb 登记为 `99l-mch-5019-site-fix.sql`，存量库已用 `scripts/db-apply.ps1` 执行成功。
- 验证：前端 `npm run build` 通过；PHP lint 与 `git diff --check` 通过；新增集成断言确认缺站点被拒、所选站点写入申请与业务单元。全量 M12 被隔离测试库缺 `meal_plan_snapshot` 阻断，定向目录套件在新增断言通过后又被隔离库缺 `sub_account_limit` 阻断，均非本次代码回归。数据库复查 `MCH-5019` 现有相关记录全部为站点1，物业 `2052` + 商品 `1033` 已进入 `CN/南宁` 排名候选；`display_enabled=0` 与正式排名绑定/发布仍按独立人工流程处理。

### ★ 2026-09-02(商户业务编号跨表唯一性修复)

- 根因：`merchant_application` 与 `merchant_info` 是两张独立自增表，旧实现却直接以申请主键生成 `MCH-XXXX`；申请 `id=1020` 审批时与既有正式商户 `MCH-1020` 冲突，触发 `merchant_info.uk_merchant_code` 唯一键并返回 500。
- 修复：新增 `merchant_code_sequence` 单行序列表，创建线索时在事务中使用 `FOR UPDATE` 行锁取得全局序号，并同时检查申请表和正式商户表；审批存量申请时若原编号已被占用，在同一事务中自动分配新编号并回写申请。
- 迁移：`database/merchant/38-merchant-code-sequence.sql`，compose initdb 登记为 `39q-merchant-code-sequence.sql`；存量库需用 `scripts/db-apply.ps1` 增量应用。
- 验证：迁移连续执行两次成功；在数据库外层回滚事务中，`APP-20260019` 审批由冲突的 `MCH-1020` 自动改为 `MCH-5019`，随后新建线索分配 `MCH-5020`，测试结束后真实申请仍保持 stage 4 / merchant_id 0；merchant-service healthz 正常，`scripts/check.ps1` 四项全绿。

### ★ 2026-09-01(订房第 1 步:去掉多余的日期选择弹层)

- 第 1 步本来就有一张**常驻的 `BookingCalendar`**,顶部摘要卡的日期胶囊却还能点开 `DatePickerSheet`(设计稿 1675:6806)—— 同一件事两个入口,弹层还会盖住下面那张日历。已把摘要卡的日期区改成纯展示:`BookingSummaryBar` 去掉 `onPressDates` 与外层 `Pressable`,`BookingStepDates` 移除 `DatePickerSheet` 与 `pickerOpen` 状态。`DatePickerSheet` 组件本身保留 —— 酒店搜索页与搜索结果页仍在用。
- 连带补了一个洞:日历是「点一下起头、再点一下收尾」,中间那一下之后 `checkOut` 是空的。以前弹层总是产出完整区间,看不出来;现在这个半选状态会一直留在页面上,所以在 `goNext` 的 dates 步加了拦截(新增 i18n 键 `hotels.booking.dates.checkOutRequired`,三份语言已对齐)。不拦的话真实模式会带着空 `endDate` 下单,被后端以「入住/离店日期不正确」打回。
- 验收:`npm run typecheck` 零报错、`npx expo export -p web` 打包通过(已删 `dist`)。

### ★ 2026-09-01(预订成功页:二维码改画真实核销码)

- 原来成功页的二维码是设计稿导出的**静态图**,与订单无关。现在画的是 `/app/order/pay` 返回的 `verifyCode`(实测形如 `A1A5C66F65FA2A27`),链路:`payOrder` 的返回 → 向导 `paid` 状态 → `BookingSuccess` 路由参数 `verifyCode` → 成功页。
- 新增依赖 **`react-native-qrcode-svg` 6.3.2**(peer 是已装的 `react-native-svg`,不引额外原生模块)。之前静态页阶段刻意没引它(见 10 号计划),现在是真实数据,值得。已确认 web 打包后 `qrcode` 内部符号进包(`Alphanumeric`/`toSJIS`),`expo export -p web` 通过。
- 没有核销码时(演示模式 / 设计稿走查)仍回落到 `TEMP_VOUCHER_QR` 静态图,设计稿走查不受影响。
- 尺寸取 `QR_SIZE = 172` = 设计稿 192 见方白框 − padding 9×2 − 描边 1×2;白框内层底色由占位蓝 `#E5EEFF` 改为白并居中,否则现场生成的二维码四周会露出蓝边(静态图是满铺的,看不出来)。
- **未做**(需要时再说):核销码没有以文字形式显示在二维码下方,现场核销时不能手输;设计稿也没有这一行。

### ★ 2026-09-01(订房:选房后日期被重置 + 金额与晚数对不上)

- 现象:在 hotels 搜索页选好入离日期,进详情点「选择房间」后,① 向导里的日期变回了别的值;② 金额与页面写的晚数对不上。
- 根因一(日期):搜索页选的日期**根本没往下传** —— `HotelDetail` 路由只有 `id`,向导拿不到就自己挑了「明天起 1 晚」。已给 `HotelDetail` 与 `HotelBooking` 两条路由都加 `checkIn`/`checkOut`,`HotelResultsScreen`(真实卡与演示卡两处)→ `HotelDetailScreen.selectRoom` → 向导逐级透传。
- 根因二(金额):向导的金额是**进来那一刻算一次**的常量 —— 真实模式初始化时按 1 晚写死,演示模式干脆用设计稿的固定数;只有在向导内部改日期时真实模式才重算。所以从搜索页带 3 晚进来,页面写着「3 Nights」金额还是 1 晚的数。
- 修法:`BookingStay` 新增 `units`(**每晚每间**的价格基数)+ `scaleStay(stay)`(按晚数 × 间数摊开成 `originalPrice`/`roomPrice`/`taxes`/`total`/`points`)。构造与 `patchStay` 都过 `scaleStay`,**两种模式统一**,金额不再有「初始值」与「改过之后」两套算法。演示模式默认 1 晚 1 间时结果与设计稿原值完全一致。
- 新增 `normalizeDates(checkIn, checkOut)`(`bookingFormat.ts`):没传 / 离店不晚于入住 / 入住早于今天,三种情况回落「明天起 1 晚」。第三条是后端 `order/create` 的硬校验(「使用日期不能早于今天」),搜索页留在页面上的旧日期很容易踩到。
- **一处对设计稿的偏离**:Trip 的第二段住宿(`BOOKING_SECOND_STAY`,6-06 → 6-08 共 2 晚)金额现在是设计稿数值的 2 倍。设计稿那张卡写的是 1 晚的金额配 2 晚的日期,本身对不上;新口径让「N Nights」与金额自洽,优先保证一致性。
- 实测:后端 `create` 3 晚 1 间 = `450`(150 × 3),与前端 `unit × 晚数 × 间数` 一致(此前已验 1 晚 1 间 = 150、2 晚 2 间 = 600)。冒烟数据(order id=4、user id=5 及其库存/日志行)已删并复核;**用户自己的 order id=3(user_id=1)与其库存行保留未动**。
- 验收:`npm run typecheck` 零报错、`npx expo export -p web` 打包通过(已删 `dist`)。

### ★ 2026-09-01(我的精选:真实酒店封面统一回落设计稿临时图)

- 「我的精选」的**预订卡**(真实订单,原来用 `goods_image`)与**收藏酒店卡**(真实收藏,原来用 `cover_image`)此前没有本地兜底,后端封面是脏值/空值时只剩渐变空块。现与酒店搜索结果页统一。
- 兜底规则抽到 `src/assets/tempImages.ts` 的 `tempCoverFor(index)`(内部即 `TEMP_HOTEL_COVERS` 的 heritageBagan / strandSuites 两张按位置轮流),`HotelResultsScreen` 原来的局部 `REAL_COVER_FALLBACKS` 已删除改调它 —— **一套规则一个出处**,免得同一家酒店在两个页面显示成两张不同的图。
- 真正的判空仍在 `utils/media.ts` 的 `resolveMediaUri`(只认 `http(s)://` 与 `/` 开头,`'111'` 这类脏值判成没有图),`CoverImage` 的三级降级(远程图 → 本地兜底 → 渐变占位)不变。商品真传了图之后会自动改用远程图,这些兜底不需要再动;等后端封面普遍可用了,删掉 `tempCoverFor` 与四处调用即可。
- 验收:`npm run typecheck` 零报错、`npx expo export -p web` 打包通过(已删 `dist`)。

### ★ 2026-09-01(订房向导接后端下单 + `order_main.guests` 列类型硬伤修复)

- 范围:把订房向导接到真实下单,**支付流程本次不做** —— 后端 `/app/order/pay` 本来就是 mock(直接置为已支付并返回 `verifyCode`),所以「点支付直接成功」不需要前端伪造,照常调即可;接真实渠道时只换 `pay` 的实现,前端不用改。
- **发现并修复了一个后端硬伤**:`order_main.guests` 在 `database/order/03-consumer-booking.sql` 里建成了 `JSON`,而 `OrderController::create` 与 `TripController::create` 两处写入的都是 `CryptoHelper::encrypt(json_encode($guests))` 的 **AES 密文**(base64,不是合法 JSON),MySQL 直接 `3140 Invalid JSON text` → **任何带 `travelers` 的下单一律 500**;不传 travelers 时写 `null` 才侥幸没暴露。已加 `database/order/06-guests-column-type-fix.sql`(查 `information_schema` 幂等,`JSON → TEXT`),登记进 `deploy/docker-compose.yml` initdb 为 `99k-`,并用 `scripts/db-apply.ps1` 补跑;复查列类型已是 `text`。保留「住客名单加密存储」的既有设计(同表 `contact_phone` 一致,读取侧 `decryptGuests()` 也是按密文写的),所以改列类型而不是改成明文 JSON。
- 前端两种模式(同一个 `HotelBookingScreen`,由 `route.params.goodsId`/`skuId` 是否存在决定):
  - **真实模式**(详情页真实房型卡 Select 进来):拉 `/app/goods/detail`,用 `goods_name` / `room_name` / `base_price` 覆盖演示数据;默认日期取**明天起 1 晚**(演示数据那组 `2026-06-04` 早已过去,后端 `create` 会以「使用日期不能早于今天」拒掉);房费 = `base_price × 晚数 × 间数`,改日期或间数实时重算。
  - **演示模式**(不带参数,设计稿走查):数值仍走 `screens/hotel/bookingDemo.ts`,不发任何请求,支付步直接弹设计稿的成功浮层。
  - 区分靠 `BookingStay.demo` 布尔位;`ReviewBody` 据此切价格明细 —— **真实模式只列房费一行**,不显示设计稿那条「服务费与税费 10%」,因为后端定价链路是「锁库存日历价 → 长住折扣 → 优惠券」,根本没有税费,照抄会与实付对不上。
- 本次刻意**不提交**的两项(页面照旧展示,提交时忽略):① 加购项(早餐/接送/保险)—— 后端没有加购价目表与字段;② 多住宿 Add More Stay —— 后端一次 `create` 只收一个 sku,真实模式下改走 comingSoon。
- 校验位置调整:联系人手机号后端 `create` 必填,而设计稿第 2 步是选填,真实模式改在**第 2 步就拦**,不拖到支付步才报错(新增 i18n 键 `hotels.booking.guests.phoneRequired`,三份语言已对齐)。**不拿账号手机号兜底** —— `/app/user/me` 与登录返回的 `mobile` 都过 `MaskHelper`(形如 `097****0199`),提交上去就是一条联系不上的假号码。
- 成功页 `BookingSuccessScreen` 改为读路由参数(单号/酒店名/地址/日期/人数/实付),缺参回落演示值;地址为空时(后台允许 `goods_info.address` 为空,本地这家真实酒店就是空)隐藏地址行与引流卡,而不是回落到设计稿的 Bagan 地址。二维码仍是设计稿静态图 —— `pay` 返回的 `verifyCode` 还没有出码接口。
- 实测(网关 8081,站点 1,商品 `goods_id=1` 房型 `sku_id=2` 单价 150):`create` 1 晚 1 间 → `payAmount=150`;2 晚 2 间 → `600`,与前端算法完全一致;`pay` 返回 `verifyCode`。**冒烟数据已清理并逐表复核**:`order_main` / `order_booking_event` / `goods_stock_log` / `goods_daily_stock` 均 `count=0`,冒烟账号 `user_info id=4`(0977000199)及其 `notify_record`/`user_action_log` 已删,`user_info` 只剩用户自己的 id=1。
- 验收:`cd client-app; npm run typecheck` 通过;`npx expo export -p web` 打包通过(已删 `dist`)。

### ★ 2026-09-01(客户端真实酒店房型不显示排查 + 接详情页)

- 现象:后台酒店/房型已审核通过,客户端仍看不到真实房型。排查到三道门槛:① 存量库漏跑 `database/goods/07-room-review-workflow.sql`,执行前 `hotel_room_type.approved_version` 缺列且 C 端 live room 过滤命中 0;② 当前本地新建酒店/房型都在 `site_id=0`,而 client-app 默认站点是 `EXPO_PUBLIC_DEFAULT_SITE_ID=1`,C 端接口还会拒绝 `X-Site-Id<=0`;③ C 端酒店发现/详情对酒店商品有 marketplace 发布门槛,当前 `ranking_market=0`、真实 `ranking_listing=0`,仅“商品+房型审核通过”还不会进入 C 端酒店列表。
- 已处理 SQL:补跑 `database/goods/07-room-review-workflow.sql`;复查本地 `goods_id=1` 两个房型 `status=1,publish_status=2,approved_version=1`,live room count=2。
- 已处理前端:`HotelResultsScreen` 真实酒店卡由旧 `GoodsDetail` 改为 `HotelDetail({id})`;`HotelDetailScreen` 有 id 时拉 `/api/v1/app/goods/detail`,标题/地址/图库/起价/Rooms 用接口数据,无 id 演示卡仍走设计稿静态数据;`HotelRoomsTab` 支持真实 `skus` 房型渲染,Select 接真实 `OrderConfirm`(未登录跳登录)。`client-app npm run typecheck` 通过。
- 仍需用户侧数据动作:要在当前客户端看到这家酒店,需把酒店/商户/房型建到客户端当前站点(通常 `site_id=1`),并在后台 Marketplace Ranking 里绑定酒店物业+酒店商品后 Publish;否则按设计会继续被 C 端过滤。不要把 `site_id=0` 当 C 端站点使用。

### ★ 2026-09-01(M4 预订 SQL 漏执行热修复)

- 现象:`merchant/booking` 列表统计报 `SQLSTATE[42S22] Unknown column 'booking_status' in 'where clause'`,出错 SQL 查 `order_main.booking_status`。
- 结论:本地 `mtrip-mysql-1` 是存量数据卷,不会因为 `deploy/docker-compose.yml` 新挂 initdb 脚本而自动重放;查询 `information_schema.COLUMNS` 确认 `order_main` 缺 `booking_status/payment_status/booking_channel/pms_sync_status`。
- 已处理:用 `scripts/db-apply.ps1` 幂等补跑 `database/order/05-merchant-booking.sql`、`database/merchant/36-merchant-booking-menu.sql`、`database/merchant/37-merchant-booking-message.sql`、`database/user/10-chat-booking-link.sql`;复查 `order_main` 关键列已存在,`order_booking_event` 表存在,`mch:order:detail/message` 权限共 2 条,`chat_conversation.order_id` 已存在。
- 顺手修复:发现 `database/user/10-chat-booking-link.sql` 与 `database/merchant/37-merchant-booking-message.sql` 漏登记到 `deploy/docker-compose.yml` initdb,已补为 `95a-chat-booking-link.sql` / `99j-merchant-booking-message.sql`,避免全新环境漏执行。`database/merchant/22-kyc-template-restore.sql` 仍是一次性修复脚本,未登记。

### ★ 2026-09-01(订房第 2 步:主要入住人自动填入 + 选择回填)

- 问题:Step 2 的 Select 原本只是 `navigate('Travelers')` 跳过去看看,常旅客页的选中态**没有回传通道**
  (上一轮留的口子);另外用户设了默认旅客也不会自动带出来。
- **自动填入**:`HotelBookingScreen` 挂载时(已登录)拉一次 `fetchTravelerList()`,取 `is_default === 1` 那条
  填进 Lead Guest。三条约束:只在姓名两栏**都为空**时填(不覆盖已输入)、`useRef` 守卫只填一次、
  **没设默认就不填** —— 接口虽按 `is_default DESC, id DESC` 排序、首行总有值,
  但拿「最新一条」冒充默认会让人莫名其妙。
- **选择回填**:Step 2 的 Select 改为 `navigate('Travelers', { pick: true })`;
  `TravelersScreen` 新增选择模式 —— 标题换成「选择主要入住人」(原来的 `(0/3)` 在单选场景是误导)、
  隐藏多选勾选框、**点一行即选中并返回**,用 `navigate({ name:'HotelBooking', params:{leadGuest}, merge:true })`
  把姓名合并回向导的路由参数。从「更多 → 账号」进入时行为不变,仍是管理列表。
  回填副作用依赖 `route.params.leadGuest` 的**对象身份**(React Navigation 只在 params 真变化时才换新对象),
  所以每次「选择并返回」只跑一次,不会反复盖掉用户之后手改的姓名 —— 也就不需要 `setParams` 清参数
  (那个 API 在联合类型的路由参数上还有类型坑)。
- **只能填姓名,电话与邮箱填不了**(两个原因叠加,已写进代码注释):
  `user_traveler` 表没有联系方式列;`/app/user/me` 走 `AuthService::profile()`,
  **mobile 与 email 都过了 `MaskHelper`**(`911****1111`),拿脱敏值占位会被用户直接提交成脏数据。
  要做到全自动,需后端给 `user_traveler` 加联系方式列,或提供不脱敏的自有资料接口 —— 属另一件事。
- i18n 新增 `more.travelers.pickTitle`(三份),共 **786** 键仍逐键对齐。
- 验证:`npm run typecheck` 零报错、`npx expo export -p web` 打包通过(dist 已删);
  接口侧冒烟确认 —— 建两位旅客、第二位 `isDefault:1`,`list` 首位即该默认旅客且 `is_default=1`
  (同时验证了 `clearDefault()` 会把前一位的默认标记清掉),前端 `find(r => r.is_default === 1)` 取到的正是它。
  **未做**:浏览器里的端到端走查(本会话无浏览器工具),需本地跑一遍
  「Step 2 是否自动带出默认旅客 → 点 Select 换一位 → 姓名变化而电话邮箱保持不变」。

**⚠️ 订正:此前两次「冒烟数据已清干净」的结论是错的**

- 清库命令写成了 `delete from mtrip_business.user_referral where user_id=...`,而 `user_referral`
  **没有 `user_id` 列**(实际是 `inviter_user_id` / `invitee_user_id`),MySQL 报 `ERROR 1054` 后
  **停在该语句、后续的 `delete from user_info` 从未执行**;而命令里加了 `2>/dev/null` 把错误吞掉、
  收尾的 `echo` 又是用 `;` 无条件执行的,于是我据此误报了「已清干净」。
  **教训:清理/校验类命令不要 `2>/dev/null`,收尾结论要用 `&&` 挂在命令成功之后,不能用 `;` 无条件 echo。**
- 实际残留:注册冒烟建的 `911111111`(user id=1)与常旅客冒烟建的 `988887777`(id=2)当时都还在。
- 已处理:**只删掉属于我的两个冒烟账号(id=2、id=3)**;
  **保留 user id=1 及其常旅客** —— 用户正用这个账号在浏览器里测试,删掉会破坏现场。
  `user_referral` 表本来就是空的,无需清理。

### ★ 2026-09-01(常旅客接后端 + 滚轮选择器两个 bug)

**1) 「更多 → 账号 → Traveler」接上真实接口**

- 后端本来就有 `user-service` 的 `TravelerController`(`/api/v1/app/user/traveler/{list,add,update,delete}`,
  挂 `UserAuthMiddleware`,表 `user_traveler`),所以这次**主要是前端对接**,后端只改了一处。
- **后端唯一改动**:`collect()` 增加 `bool $isUpdate`,编辑时 `idNo` 留空则不写 `id_no` 列,`update()` 传 `true`。
  原因是 `list` 返回的证件号经 `MaskHelper::idCard` 脱敏(如 `12/***********3456`),前端回填不了原文,
  而原来的 `requireStr('idNo')` 是必填 —— 不改的话用户不重输就会把掩码当成真证件号存回去。
- 前端:`types/models.ts` 加 `TravelerItem`;`api/user.ts` 加四个接口 + `TravelerPayload`;
  `config/global.ts` 加 `TRAVELER_ID_TYPES` / `TRAVELER_ID_TYPE_I18N`(口径对齐后端的 `[1,2,3]`);
  `navigation/types.ts` 的 `AddGuest` 改成 `{ traveler? }`(带值即编辑态 —— 列表接口已返回全部可编辑字段,
  不再单独请求详情);`TravelersScreen` 接真列表(未登录 / loading / 空 / 数据四态、默认角标、
  副行显示「证件类型 · 脱敏号」、`useFocusEffect` 保证从编辑页回来自动重拉);
  `AddGuestScreen` 重写为真表单,新增 / 编辑 / 删除都打接口。
- **按用户决策裁掉了设计稿 `1675:5777` 的四栏**(性别 / 出生日期 / 未满 13 岁 / NRC 姓名)——
  `user_traveler` 没有对应列,留着只会让用户白填一遍再被静默丢弃。
  另外两处收敛:证件号从 NRC 三段并成一个输入框(后端是单列,且证件类型还支持护照 / 其他,那两种没有段码);
  国籍从下拉改成输入框(后端是自由文本、也没有国家列表接口,一个只有 Myanmar 的下拉没有意义)。
  **反过来补了两个设计稿没有、后端有的字段**:证件到期日、设为默认。
- i18n:`more.travelers` 由 6 键扩到 29 键,**删掉已无引用的整组 `hotels.booking.addGuest`**;
  顺带把 `selectGuest` 的 `{{count}}` 换成 `{{selected}}` —— `count` 是 i18next 保留字,
  本来就违反仓库既有约定(其它页早就在避开它)。

**2) 「证件到期日」选不动,只能停在固定值**

两个真 bug 叠在一起,都在 `components/hotel/booking/WheelPickerSheet.tsx`:

- **主因**:选中项只由 `onMomentumScrollEnd` / `onScrollEndDrag` 推导,而 **react-native-web 下用滚轮 /
  触控板滚动时这两个事件不触发**,索引永远停在初始值 —— 表现就是「滚得动但选不动,确认后还是原来那天」。
  改为 `onScroll` + `scrollEventThrottle={16}` 实时推导(索引没变则跳过 setState),末尾两个事件保留做原生端校准。
- **次因**:关闭时组件只是 `return null`、实例并不卸载(挂载态由 `mounted` 自持,为的是放完关闭动画),
  三个 `useState` 的初值**只在第一次渲染算一次**,那时 `value` 往往还是空的 ——
  带着已有到期日再打开,列位置停在旧值。改为 `visible` 变 true 时按 `value` 重置三列,
  并用 `session` 作三列的 key,换 key 让 `WheelColumn` 重挂载,其挂载副作用才会滚到新位置。
- 顺带修掉一个静默改数据的坑:年份区间原本固定「今年 ~ 今年+20」,已存的到期日若早于今年(证件已过期)
  会因 `indexOf` 返回 -1 被夹到第 0 项,**一打开就把日期悄悄改掉**。现在区间会兜住当前值。
- 同批把该组件泛化成通用日期滚轮(`title` / `confirmLabel` / `minYear` / `maxYear` 都是 props),
  原来标题与确认文案是硬编码的出生日期词条。

**验证**

- `npm run typecheck` 零报错;`npx expo export -p web` 打包通过(dist 已删)。
- 三份语言包脚本比对 missing / extra 均为空,JSON 合法。
- 容器内 `php -l` 通过,`docker compose restart user-service` 已执行。
- **真实接口全链路冒烟**:临时账号 → add(返回 id)→ list(证件号确为脱敏)→
  update 不带 `idNo`(证件号保持 `12/***********3456` 未被覆盖、其余字段已改)→
  update 带新 `idNo`(变为 `MA9**6543`,证明能改)→ delete(list 变空)。
- **未做**:浏览器里逐屏的视觉走查(本会话没有浏览器工具),需本地跑一遍
  「更多 → 账号 → Traveler → 新增 → 编辑(到期日滚一下看能不能选中)→ 删除」。

### ★ 2026-09-01(登录/注册横向可拖动修复 + 本地 app 接口 401 的根因)

**1) 登录页与注册页可以左右拖动、元素超出屏幕**

- 根因是铺底插画:`styles.illustration` 是 `width:'150.41%' / left:'-18.49%'` 的绝对定位图
  (照搬设计稿的图片填充裁切),但它的父层 `styles.root` **没有 `overflow:'hidden'`**,
  右侧超出屏幕约 32%,于是整页可以横向拖动。开屏页的波浪是同一种画法,那里有
  `styles.waves`(`absoluteFillObject + overflow:'hidden'`)兜着,所以没出问题 —— 这次照同一做法补上
  `styles.illustrationClip` 裁切层(顺带加 `pointerEvents="none"`,免得它吃掉点击)。
- 同批修掉一个只在窄屏出现的溢出:三方登录按钮原本是 `paddingHorizontal:31` 的固定宽(20 图标 → 82 宽),
  三枚 + 两道 16 间距 = 278,而卡片可用宽 = 屏宽 - 32(页边距)- 48(卡片内边距),
  **屏宽小于约 358 时会被挤破**。改成 `flex:1 + maxWidth:82`:402 宽下与设计稿一致,窄屏自动收窄。
- 改动只在 `screens/user/LoginScreen.tsx` 与 `screens/user/RegisterScreen.tsx`,两页取值本来就同源。
  `npm run typecheck` 零报错。

**2) 注册返回 401 —— 是客户端签名,不是账号问题**

- 浏览器发出的 `POST /api/v1/app/auth/register` 只有 `X-Client-Type / X-Lang / X-Site-Id / X-Timestamp`,
  **缺 `X-Client-Id / X-Nonce / X-Sign`**;`ClientSignMiddleware` 对 `/api/v1/app/*` 强制校验这四个头,
  缺任一个抛 `ErrorCode::CLIENT_AUTH_FAIL = 40103`,而 `ErrorCode.php` 把它映射成 **HTTP 401**。
  第二道 `PayloadDecryptMiddleware` 的 `DEFAULT_ENCRYPT_PATHS` 里也有 `/app/auth/register`,
  要求 `X-Encrypted:1` + AES 密文,而请求体是明文。
- 为什么没带签名:`client-app/` 下**只有 `.env.example`、没有 `.env`**,`EXPO_PUBLIC_CLIENT_ID/SECRET` 为空,
  `api/request.ts` 的逻辑正是「没配密钥就不加签名头」,`postEncrypted` 同理回退明文。
  而运行库里 `mtrip_system.sys_client` **一条记录都没有**(`database/system/06-client.sql` 只建表不插种子),
  所以当时也拿不到可用的 ClientId/Secret。
- **按用户选择走开发调试路径**:`deploy/.env` 改为 `MTRIP_CLIENT_SIGN=false`、`MTRIP_PAYLOAD_ENCRYPT=false`,
  然后 `docker compose up -d` **重建**容器(注意:`restart` 不重新读 `.env`,只有重建才会生效),
  再 `docker compose restart gateway`(服务重建后容器 IP 变,不重启网关会 50200)。
  已复核 `user-service` 内 `printenv` 两项均为 `false`。
- 验证:用**与浏览器完全相同**的那条无签名请求复现 —— 注册返回 `HTTP 200 / code 0`;
  随后用不存在的账号打 `POST /app/auth/login` 得到 `40001 手机号或密码错误`(说明已进业务逻辑,不再被 401 拦);
  `GET /app/site/config` 仍 200。**复现时真的建出了 `911111111` 那个用户(id=1),已连同 `user_referral` 一并删除,
  库恢复到复现前的状态**,你在浏览器里可以正常走一遍注册。
- ⚠ **两项遗留**:
  1. `deploy/.env` 是 gitignore 的本地文件,这次改动不进仓库;**上线/联调前必须改回 `true`**,
     正规做法是在 admin-web「配置 → 客户端管理」建一个 app 客户端,把 ClientId/Secret 写进 `client-app/.env`。
  2. 注册接口**仍然不接收 `email`** —— 复现返回的 `user.email` 是空串,与此前记录的
     「`AuthController::register` 只读 mobile/password/nickname/referralCode」一致,需后端补一行才能落库。

**3) 登录页「记住我」没生效**

- 原状是纯 UI 状态:`LoginScreen.tsx` 的 `remember` 只控制勾选框图标,全项目再无第二处引用。
- 关键背景:**token 本来就无条件持久化**(`userStore.applyAuth` 每次登录写 `mtrip:token`,启动 `hydrate()` 恢复),
  所以「记住我」管的**不是免登录**。用户确认按**记住手机号**实现(不含密码)。
- 落地:`STORAGE_KEYS` 新增 `REMEMBER_MOBILE: 'mtrip:remember-mobile'`;登录页挂载时读取并回填号码、
  同时把勾选框恢复成勾上;**登录成功后**按当前勾选状态写入 / 清除(单纯勾或取消勾不动本地值,
  避免误碰就丢号码)。单独用一个键是因为它要**跨退出登录**保留 —— `userStore.clearLocal` 只清 TOKEN 与 USER。
- 顺带确认:`storage.clear()` 目前全项目没有调用方(GDPR 被遗忘权的本地清空入口还没接),
  将来接上时这个新键会一并被清掉,不需要额外处理。
- `npm run typecheck` 零报错。**未做**运行时验证(没有可用的浏览器工具):
  需要你本地跑一遍「注册 → 勾上记住我登录 → 退出登录 → 回到登录页看号码是否回填且默认勾上」。

### ★ 2026-09-01(client-app 订房流程,Figma section `Multi Booking Hotel Booking Flow` `1675:5776`)

- 这个 section 下有 21 张稿。**本次做**核心 4 步向导 + 配套子页 + **多住宿 Trip**;
  **不做**机场接送子流程(`1675:6985` / `7094` / `7203` / `7631` —— 那三张自带底部 Tab 栏,
  属首页 Cars 入口的独立功能,与订房主线无关)。范围与向导结构都是用户明确选定的。
- **向导落成「一个路由 + 内部分步」**(同酒店详情页「一个壳 + 六个页签组件」的做法):
  `screens/hotel/HotelBookingScreen.tsx`(路由 `HotelBooking`)只留壳 —— 状态栏黑条 / 第 1 步的返回栏 /
  进度条 / 滚动区 / 吸底栏 —— 内容按 `dates → guests → review →(多住宿才有)trip → payment` 分发。
  **步骤序列是单一出处**(`bookingDemo.ts` 的 `BOOKING_STEPS`);进度条固定 4 格,
  多住宿的支付页**没有进度条**(设计稿 `1675:9158` 确实没画);第 1 步的 Back 走 `goBack()` 退出向导。
  草稿状态(日期/人数/加购/表单/支付方式/stays)用页面内 `useState`,**没有建 store** —— 单路由内不需要跨路由共享。
- 稿 → 落地对照:Step 1 `1675:6069`(加购已选态 `1675:7406` 是同一组件的另一状态)/ Step 2 `1675:6292` /
  Step 3 `1675:6404`(单住宿变体 `1675:9010`,差别只是有没有 Add More Stay 区块,由 `stays.length` 决定)/
  Step 4 Trip `1675:9406` / Step 4 支付 `1675:6537`(多住宿态 `1675:9158`)/ 成功页 `1675:6714` /
  新增旅客 `1675:5777` / 旅行保险 `1675:5900` / Stay 明细 `1675:9677` / 出生日期浮层 `1675:7673` /
  性别下拉 `1675:7737` / 支付成功·失败浮层 `1675:7715`、`1675:7726`。
  **「Choose Date」`1675:6806` 与已实现的 `695:1428` 是同一张稿,直接复用现成的 `DatePickerSheet`,没有重做。**
- 新增 `components/hotel/booking/`:`bookingShared`(第四份卡壳 —— 这套稿 padding 是 **25** 不是 24、
  描边在 `--secondary` 与 `rgba(196,197,215,0.2|0.3)` 之间切换、底色分 `--tab` 与纯白两种,
  照搬 detailShared / promoShared / moreShared 会有肉眼可见的差)、`bookingFormat`(四种日期写法 + 晚数文案)、
  `BookingProgress` / `BookingBottomBar`(按钮版与「预计总价 + Continue」版两种布局)/ `BookingSummaryBar` /
  `BookingCalendar` / `GuestCounterRow` / `AddOnCard` / `FormField` / `SelectSheet` / `WheelPickerSheet` /
  `AlertDialog` / `ReviewCards` / `ReviewBody`(Step 3 与 Stay 明细页共用)/ `StaySummaryCard` / `PaymentMethodRow`。
  另新增 4 个屏 `screens/hotel/{AddGuest,Insurance,StayDetail,BookingSuccess}Screen.tsx`,
  前三个的页头与「更多」子页完全一致,**直接复用 `MorePageLayout`**,没有自绘顶栏。
- **接线**:酒店详情房型卡的 `Select` 由 comingSoon 改为进向导(`HotelRoomsTab` 新增 `onSelectRoom` 回调,
  `HotelRoomCard` 未动);底栏「Choose my room」改为切到 Rooms 页签;
  「更多 / 常用旅客」的「Add New Guest」也接到同一张新增旅客页。新增 5 条 Stack 路由,全部 `headerShown: false`。
- **图标 19 枚**进 `HomeIcon`(path 全部取自设计稿导出的 SVG,未手抄):minus / caretDown / calendarOutline /
  infoSmall / peopleDuo / shieldLock / infoCircle / edit / shareAndroid / megaphone / shieldSimple /
  lockSmall / shieldCheckSmall / headset / download / eye / dismissCircle / checkSlim / arrowRightLine。
  **同名不同字形的分开入表**:info(20)/ infoSmall(13.333)/ infoCircle(20) 是三个不同字形;
  share 与 shareAndroid、eyeOff 与 eye、arrowRight(8)与 arrowRightLine(9.3333)同理;
  caretDown 是**描边**箭头(表单下拉),与实心的 chevronDown 不能互相顶替。
  **可复用的没有重复入表**(逐条比对过 path):日期确认页人数图标 = 已有 `travelers`(同字形偏移 12/12)、
  复核页日历 = `calendar`、Add More Stay 水印 = `building`、支付成功对号 = `checkmarkCircle`、
  加购「+」= `plus`、勾选框 = `checkbox`、位置针 = `locationOutline`、钱包 = `wallet`、
  出生日期浮层的叉 = `close`、保险页的勾 = `check`、盾牌 = `shieldTask`。
- **素材 15 张**落 `assets/images/temp/hotel/booking/`(两张加购照片存 JPEG 各约 60KB,PNG 编码要 400KB+;
  其余是保留透明通道的小图标),已登记进 `assets/images/temp/README.md` 与 `src/assets/tempImages.ts`。
  Step 3 / Stay 明细的房型封面**与 Rooms 页签的 `room-deluxe.png` 逐像素相同(RMS=0),不重复入包**。
  二维码用设计稿导出的静态图,**没有为一张静态页引 `react-native-qrcode-svg`** —— 本次**零新增依赖**。
- **i18n** 新增 `hotels.booking.*` 中英缅各 186 键,三份仍逐键对齐(共 **781** 键)。
  插值键继续避开 i18next 保留字 `count`(用 `{{nights}}` / `{{guests}}` / `{{stays}}` / `{{points}}`)。
  缅甸语仍是机器翻译,**上线前需母语者复核**。
- **静态页边界**:后端没有酒店预订下单接口(现有 `createOrder` 是通用商品下单,没有房型 / 加购 / 多住宿概念),
  支付渠道仍是 mock。所以**不发任何请求**,数值全部来自 `screens/hotel/bookingDemo.ts`。
  真的能点:改日期(拉起 `DatePickerSheet`)、加减人数、勾加购、填表、勾条款、单选支付方式、
  加第二段住宿、逐步前进后退。走 comingSoon:区号选择、Save Info、优惠券、Pay by other / Share、
  Payment Summary 展开、新增卡片、Download Voucher / View Booking、Add Hotel and Homestay 的二次搜索。
  支付页点「Continue」会弹设计稿的成功浮层、关闭后进成功页 —— 这是演示链路,不代表真的下过单。
- **刻意偏离设计稿之处(代码内均已注明)**:
  1. **设计稿自身对不上** —— Step 1 摘要条写「Thu, 12 Oct → Sat, 14 Oct / 2 Nights」,同屏日历却高亮 2026 年 6 月的
     12–14,而 Step 3 / 4 / 成功页写「4 Jun – 5 Jun (1 Night)」。这里统一取 **2026-06-04 → 2026-06-05**
     (与价格行「(1 night)」自洽),日历随之高亮 6 月 4–5;晚数由实际选择推导,金额沿用设计稿原值。
  2. 第 1 步统一显示「← Back」返回栏 +「预计总价 + Continue」吸底栏(设计稿把这两样分在 `1675:6069`
     与 `1675:7406` 两张状态稿里),否则第 1 步没有退出向导的入口。
  3. 文案笔误按正确英文写并在代码注明:「Guest is under 13 year old」→ years、
     「Medical. Hospital and other expenses」→ 逗号、保险页「you agree to xxxxxx Terms & Conditions」的 xxxxxx 占位。
  4. 两张 Alert 稿是独立画板、没画遮罩,同 `PromoDialog` 的既有处理补一层黑 25%。
  5. 日历首尾格下方那枚 4px 白点(`1675:6172`)落在白卡上不可见,未实现(同 `DatePickerSheet` 的既有取舍)。
  6. `MorePageLayout` 的 footer 插槽自带 px16 / pt12 / pb20 的页面底色内边距,保险页与 Stay 明细页的吸底栏
     用等量负 margin 抵消,**没有改公共组件**。
- **验收**:`cd client-app; npm run typecheck` 零报错;`npx expo export -p web` 打包通过,
  15 张新素材全部进包(dist 已删)。三份语言包脚本比对 missing / extra 均为空。
  **未做**:真机 / 浏览器逐屏与设计稿的像素级视觉比对(本会话没有可用的浏览器工具),
  这一项需下次会话或用户本地 `npm start` 后按上面的稿号逐屏核对。
  本次未改任何 PHP,`scripts/check.ps1` 未跑(本机 php 不在 PATH,第 1 步即中断,与本改动无关)。
- 未执行 Git 暂存 / 提交 / 推送。

## ★ 2026-09-01：M4 酒店预订管理交付完成(阶段0～6 全量收口)

`实现方案-Merchant-M4-酒店预订管理.md` 七阶段全部完成,方案文档/README 进度表已勾选。后端:2 个迁移(`order/04` 库存字段、`goods/06` 房态字段)已应用并回填;`BookingLifecycleService` 过期确认任务+库存联动+幂等;商户预订管理 16 端点(列表/详情/确认/入住/退房/改房号/改单/联系方式/凭证/强制同步/统计/住客消息等)挂 `/api/v1/merchant/booking/*`;通知 23/23。前端:merchant-web `views/order/index.vue` 六页签(含 In House)+430px 详情面板+消息抽屉,构建通过。
**平台级修复(最重要)**:`Mtrip\Shared\Aspect\PermissionAspect` 缺 `#[Aspect]` 注解,从未进入 `aspects.cache`,全平台 `#[Permission]` 静默失效(S7 时期 merchant-service 同类问题的跨服务收口)。修复双保险:①补 `#[Aspect]`;②8 个服务全部新增/覆盖 `config/autoload/aspects.php` 显式注册(不依赖扫描收集时序)。验证:8 服务 aspects.cache 全含切面、无权限子账号 4 写端点全 40301、超管/主账号不误拦、8 服务 healthz 全绿。用户子账号未走 JWT 全量签发语义,靠切面拦截——**新增服务必须携带 aspects.php**。
回归:阶段3 E2E 22/22、阶段5 E2E 23/23(夹具用 `test/sql/m4-fixture-reset3.sql`/`m4-fixture-reset5.sql` 回补),`scripts/check.ps1` 四项全绿。浏览器验收:首轮网关对 merchant-service 上游 502(服务本体健康),`docker restart mtrip-gateway-1` 恢复;二轮 m1001+2FA 真实登录态全通过,截图存 `.reasonix\attachments\m4-guest-message-*.png`。**本次未执行任何 git 提交**,待用户审阅授权(变更含 8 个 aspects.php、2 迁移、后端、前端、测试脚本、文档)。
测试账号:商户 `m1001 / Merchant@123456`(TOTP 用 `test/sql/m4-totp.php` 容器内生成);管理端超管 `admin / Admin@123456`。

## ★ 2026-09-01：M4 酒店预订管理开发计划

已新增 `docs/plans/实现方案-Merchant-M4-酒店预订管理.md`，严格映射 Merchant PRD 模块 4、场景 3 和预订管理验收标准。计划确认本期不接真实支付渠道，现有模拟支付结果通过统一入口驱动预订确认；真实支付作为后续独立里程碑。merchant-web 的 Booking Management 页面、筛选页签、表格、约 430px 右侧详情面板、详情区块及操作弹窗必须严格按 `https://big-plank-58319748.figma.site/` 原型实现，并在 1440×900、1366×768 登录态下截图对比，禁止用假数据、空页面或登录跳转代替验收。当前只新增文档，没有修改业务代码；人工确认、No-show、房号、改单、联系方式和导出规则仍需产品确认。

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

- 入驻线索创建后在同一事务内生成唯一 `merchant_code`，格式为 `MCH-` + 至少四位序号；当前由 `merchant_code_sequence` 在申请表与正式商户表之间全局分配，编号在申请、待核实、重新提交、批准和拒绝阶段保持不变。
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

本任务最新进度：PRD模块12商户管理S0设计及S1～S4核心开发测试已完成；S5～S7尚未开始。S4真实扫码和完整UI、S3完整上传及模块11端到端未验，详见模块15计划及阶段交付报告；下表为历史底座状态。**2026-09-18 最新一轮为「关怀模式房型详情页第三次逐节点复核(11 处照稿修正 + 税费展示位)」(client-app),见本文件顶部那条 ★;上一轮为「关怀模式实景预览页按 `2352:7051` 重做」,再上为 2026-09-17「客房管理看不出非今日订单」的根因复核与修复。**

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
- **【硬约定】旧目录 `database/{system,merchant,...}` 是空库初始化快照，新增/调整快照 SQL 仍须同步登记到 `deploy/docker-compose.yml` 的 mysql `docker-entrypoint-initdb.d` 挂载列表**，编号体现执行顺序。生产增量则只新增 `database/migrations/VYYYYMMDDHHMMSS__lower-kebab.sql`，该目录已整体挂载并由 `99-run-migrations.sh` 遍历，**无需再逐文件登记 compose**。initdb 只在空数据卷首次启动时执行；存量生产库由 `scripts/db-migrate.sh` 对账执行。
- **增量更新已跑起来的库,不必 `down -v` 重建**:脚本幂等,直接灌进运行中的容器即可。单文件 `Get-Content database/xxx.sql | docker exec -i mtrip-mysql-1 mysql -uroot -proot@2026`;批量用 `scripts/db-apply.ps1`(见「常用命令」)。只有想彻底清库重来时才 `docker compose down -v; docker compose up -d --build`。
- **【硬约定】新增一个「二级模块」路由(`/api/v1/{admin|app|merchant|supplier}/{模块}/*`)后,必须同步在网关 `deploy/openresty/conf.d/mtrip.conf` 对应的 `map $*_module $*_upstream` 里登记「模块 → 上游服务」**,否则网关命中 default `""` → 404(接口和服务都正常也白搭)。改完 `docker compose restart gateway` 生效。2026-08 曾漏登记 admin 的 `config`/`chat`、app 的 `theme`/`chat`/`marketing` 共 5 处。核对口径:各服务 `config/routes.php` 的 `addGroup` 前缀 / 路由第一段 ↔ 四张 map 的键。
- 遗留待用户手动删除:`d:\GIT\jiaxu\MTrip\.tmp-mysql-verify\` 临时目录。

## 4. 后端关键约定(模块06 必须遵守)

- 统一响应 `{code, message, data}`,成功 code=0;分页返回 `data={list,total,page,pageSize}`,入参 page/pageSize 默认20最大200。
- 错误码:40101/40102 未登录(前端跳登录)、40301/40302 无权限。
- 字段命名:**请求入参驼峰;列表行 snake_case 直出**(例外:管理员列表/登录返回/统计返回为驼峰)。
- 路由前缀:管理端 `/api/v1/admin/{merchant|goods|order|finance|user|marketing|payment}/*`;移动端双前缀方案见 `docs/plans/09-移动端微服务.md`。
- 新服务的工程组织、代码风格(Controller/Model/Service、#[Inject]、验证、软删除、操作日志)**以 backend/services/system-service 为唯一范本**,共享能力用 backend/shared。
- **【硬约定】每个服务必须携带 `config/autoload/aspects.php` 显式注册 `\Mtrip\Shared\Aspect\PermissionAspect::class`**(2026-09-01 M4 收口时发现该切面缺 `#[Aspect]` 注解,全平台 `#[Permission]` 静默失效;显式注册不依赖扫描收集时序,是唯一可靠生效方式)。新建服务照抄现有 8 个服务的 aspects.php。

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

客房可用性可见性下一步(2026-09-17,承接本文件顶部「客房管理今日可售」一条):
1. **登录态浏览器走查**(merchant-web 5174 已在跑):新建房型 → 审核通过 → APP 订**明天**的房,
   确认卡片同时显示「今日可售 N」与「未来 7 天最低 N-1 · 次日」并在有占用时高亮;
   窄屏(≤1280)下新加的这一段是否会挤换行。
2. **"今天"的时区口径**:容器是 UTC,后端 `date('Y-m-d')` 与 C 端设备本地日期在
   北京时间 00:00–08:00 会差一天。建议给服务统一 `TZ`(或由服务端下发"业务今天"),
   涉及 `RoomController::appendAvailability`、`OrderStockService::datesOf`、
   `HotelController::calendar` 等所有 `date('Y-m-d')` 消费方 —— 属跨服务改动,单独立项。
3. **门票下单页 `OrderConfirmScreen`** 的默认日期仍是「明天起 1 晚」;若也要与搜索页统一,
   改它自己的 `dayAfter(1)/dayAfter(2)` 两个初值即可(本轮只动了酒店向导)。
4. 若发现「未来 7 天」这个窗口不够用(商户想看得更远),`RoomController::UPCOMING_DAYS`
   是唯一开关;窗口越长,列表查询返回的行数越多,注意 `goods_daily_stock` 的
   `idx_property_stock`/`idx_stock_date` 命中情况。

client-app 酒店指引下一步(2026-09-16,承接本文件顶部「酒店页用户指引」一条):
1. **缅文文案找母语者过一遍**(`hotels.guide.*` 共 18 键中的 14 条正文)。
2. Web 冒烟已过(见顶部那条的「验证」段),**真机 / 真容器仍值得补一次**:
   ① iOS/Android 上 `Modal` 的层级与安全区与 web 不同;
   ② 起上后端后确认金额显示为 MMK(web 冒烟时后端没起,币种停在初值 EUR)。
3. 设计稿这套只画了酒店线。餐饮 / 用车 / 套餐若也要引导,得先出稿 ——
   现在这七步的文案与示例卡是**写死给酒店用的**,不要直接套到别的业务线。
4. 若以后想「首次进页面自动弹一次」,本次刻意没做(用户要求只点问号触发),
   要加的话在 `HotelsScreen` 用 `storage` 记一个标志即可,浮层本身不用改。

client-app 关怀模式下一步(2026-09-15,承接本文件顶部「关怀模式订房流程」一条):
1. **本轮唯一未验项:真机冒烟**(尤其是完整模式的回归 —— 订房向导抽了共享 Hook,
   渲染虽一行没改,但状态搬家值得跑一遍四步)。冒烟清单见顶部那条的「验证」段。
2. 本机装 PHP 8 后补跑一次 `scripts/check.ps1`(本次因无 php 停在第 1 步,未动任何 PHP)。
3. 关怀模式目前只覆盖 酒店 一条业务线。首页 Lite 的另外三个入口(餐饮 / 用车 / 套餐)
   点进去仍是完整模式页面,要么补 Lite 稿、要么明确沿用完整版(与优惠中心同处理)。
4. 若后端将来支持一次多 sku 下单,Lite 版要不要放开多住宿需重新决策 ——
   现在是**刻意不给**,不是漏做。
5. **实景预览页(`2352:7051`)待办**(2026-09-18):未做真机 / Web 冒烟,需人工对图;
   3 处推定值待设计侧确认(缩略图宽度 120、顶栏箭头色 `#204DDA`、blur 与文字阴影的近似);
   缅文 7 条待母语者复核;`scripts/check-property-preview-lite.cjs` 尚未接进 `scripts/check.ps1`;
   本机未装 php,交付基线第 1 步仍跑不了(需在有 PHP 8 的机器/容器内跑)。
6. **房型详情页(`2352:6030`)待办**(2026-09-18 第三轮):未做真机 / Web 冒烟,需人工对图;
   税费行是**占位 0**(后端出税费字段后替换 `TAX_AMOUNT` 一处即可);面积图标稿面 17.76 + 1px 下内边距
   未跟(三枚统一 20,2px 级已知差异);缅文该页新增 1 条待母语复核;
   `scripts/check-room-detail-lite.cjs` 同样未接进 `scripts/check.ps1`;
   **该页已按同一节点改过三轮**——若还要再改,建议先跑起来对图,把「哪里不对」指出来,
   比继续逐节点重比对更省时间(前两轮都是"照稿改完仍被判差距大")。

client-app 订房线下一步(2026-09-01,承接本文件顶部「订房向导接后端下单」一条):
1. **上线前必做**:把 `deploy/.env` 的 `MTRIP_CLIENT_SIGN` / `MTRIP_PAYLOAD_ENCRYPT` 改回 `true`
   (本地为绕开 `sys_client` 为空导致的 40103 临时关掉了),改后要 `docker compose up -d` 重建再 `restart gateway`。
2. 日期与库存联动:向导现在只按 `base_price` 估价,没读 `/app/goods/calendar`,
   遇到分日定价 / 满房日期时页面金额会与 `create` 的 `payAmount` 有出入(以后者为准)。
   接日历后可顺带做「不可售日期置灰」。
3. 加购项(早餐/接送/保险)与多住宿 Trip 目前只在演示模式成立,要真做需要后端先有加购价目表
   与一次多 sku 的下单接口。
4. 成功页二维码仍是设计稿静态图;`pay` 返回的 `verifyCode` 还没有出码/展示接口。
5. `AuthController::register` 仍忽略 `email` 入参;本地这家真实酒店 `goods_info.cover_image='111'`
   是后台表单填进去的脏值(前端已用 `utils/media.ts` 兜底,但建议清掉)。

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
