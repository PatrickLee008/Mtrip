# 13 - 商家端 merchant-web 落地

> 参考 admin-web 从零搭建平行的 merchant-web(Vue3+Vite+TS+antdv),为商户账号(`merchant_admin`,account_type 1集团/2商户/3门店)落地一套完整仿 admin 的动态 RBAC:独立四表菜单/角色,登录按 `account_type` 下发菜单树+权限集,接口权限继续由 `#[Permission]` 注解按 `perm_key` 联动(与前端 `v-perm` 同一把钥匙)。
> 承接 12-商家账号体系.md 的二期清单。

## 2026-09-21 Hotel Profile 三个未实现页签(Long Stay Details / Hotel Policies / Nearby Attraction)

按 Figma SECTION `696:6334`(mTrip_Merchant,file `fsK2rrl2sadcowrxspvGV8`)补齐 `/properties/:id/profile` 上此前只有按钮、点不动的三个页签,**视图 + 编辑两态 + 提交审核全链路**。规格逐条落档 `.figma-cache/696-6334.md`(gitignored,含原始节点区间与解析器 `resolve.py`)。

**用户已确认的两项取舍**:① 做全功能(视图 + 编辑 + 增删改弹窗 + Save Draft / Submit Review),不只做只读;② 三块数据**新增 `merchant_store` JSON 列**,随现有 content revision 走草稿/审核/版本快照。

- **数据库**:`V20260921140000__add-property-profile-hotel-tabs.sql` 守卫式新增 `long_stay` / `hotel_policies` / `nearby_attractions` 三列(JSON NULL),`database/merchant/03-group-store.sql` 快照同步,供空库初始化;迁移账本 **28/28**,重复执行幂等。
- **后端**:`PropertyProfileService` 的 `FIELDS` 与新增 `JSON_FIELDS` 常量增补三列,`collect()` 写、`formatProperty()` / `formatPayload()` 读;新增 `normalizeLongStay` / `normalizePolicies` / `normalizeNearby` 三个归一化器,统一做名称 trim、条数上限(促销 10 / 权益 12 / 儿童 10 / 规则 12 / 景点 20)、折扣夹到 0–100、空名行丢弃、`status`/`bold` 布尔化(与 amenities 的 `enabled`/`highlighted` 同口径:停用项不可能同时加粗)。**零新增**路由、权限键、菜单种子与网关改动 —— 三个页签沿用 `mch:properties:profile-edit` / `profile-submit`,因此不触碰 RBAC 三处对齐。
- **前端**:`profile.vue` 解锁三个页签(`activeTab`/`editingTab` 从 2 个扩到 5 个联合类型,rooms 仍走 `/rooms` 独立页),`form` / `cloneForm` / `load` / `save` 增补三块并带读取兜底(老响应缺字段不炸);新增三个组件 `views/properties/components/HotelLongStay.vue` / `HotelPolicies.vue` / `HotelNearby.vue`,沿用 `HotelAmenities.vue` 的 `modelValue / editing / disabled` + `editRequested` 契约,视图与编辑两态同文件。
  - Long Stay:促销行(名称 → 折扣 %)+ 权益圆点标签;编辑态两张卡 + 促销弹窗(状态开关 / 名称 / 折扣 + `%`)、权益弹窗(状态 + Bold 两个开关)。
  - Policies:Booking / Check In & Out / Children & Extra Beds(含 Pet Policy)/ Property Rules 四组可折叠;编辑态六张卡 + 儿童加床弹窗(Policy Status / Name / Description / Amount / Per Unit)。
  - Nearby:卡片网格(图片 + 名称 + `10 mins drive (5 km)`)+ 卡片头 `Add New`;弹窗含图片上传(复用 `/properties/profile/media/upload`)、状态开关与 Location Icon/Name、Travel Time、Travel Mode、Distance。
- **i18n**:`properties.profile` 下新增 `longStayTab` / `policiesTab` / `nearbyTab` 三个嵌套段,en-US + zh-CN 两份键路径逐字一致(本项目无第三语言)。
- **稿面偏差(已与用户逐条确认,不做)**:① Nearby 弹窗的 `Mark 1 / Mark 2` 多分组与 `Add More` 不做 —— 视图一张卡只有一组名称与路程,按「一张卡 = 一个景点」实现,新增走卡片头;② Check In/Out 的数字滚轮时间控件不做,沿用本页 Details 的 `checkin_time`/`checkout_time` 文本口径;③ 编辑态底部保留既有 `Cancel / Save Draft / Submit Review`(稿面是 `Step 1 of 2 / Preview / Submit Review`,Preview 无对应能力);④ Property Rules 稿面没有编辑弹窗,行内直接编辑;⑤ 行尾细徽标文案在稿面模板里不可读,按弹窗里确实存在的开关数还原(促销 1 枚状态徽标,权益 2 枚:状态 + Bold);⑥ 本页既有主色令牌 `#4d6cf4` 沿用,不引入稿面的 `#4169ED`,避免同页两种蓝;卡片圆角/内边距同样沿用本页既有令牌。

**验证**:`merchant-web npm run build`(vue-tsc + vite)零报错;新增 `merchant-web/scripts/check-property-profile-tabs-figma.mjs` —— **真实 SSR 渲染**三个组件的视图/编辑/空态 + `ant-design-vue` 真实注册 + 编译产物 CSS 令牌 + i18n 两份键结构 + **跨层契约**(profile.vue 读写字段名、后端 `FIELDS`/`JSON_FIELDS`/归一化方法、迁移与快照列名)断言,**GREEN 131/131**,并做过灵敏度自检(故意把 `5 %` 改成 `5%` → `RED 127/131`,随即还原)。后端容器内 `php -l` 通过;真实 HTTP 往返验证 **21/21 PASS**(GET 回落空结构 → POST 草稿保存含越界/脏值 → GET 读回归一化结果 → 跨站读被拒 → 无权限写被拒),测试数据(revision 与三列)已还原。⚠️ **`PropertyProfileService` 改完必须热重启**(本次踩到:不重启时 HTTP 仍回旧结构,只有 CLI 会读新文件),已 `./mtrip.sh restart merchant-service` 并重启 `merchant-service-app` 孪生;⚠️ **未做登录态浏览器视觉走查**(环境无浏览器自动化、开发库无已知密码的商户账号),需人工对图一次(三个页签的视图与编辑态);⚠️ 该脚本未接进 `scripts/check.ps1`(本机未装 php / pwsh,该入口第 1 步即断)。

**🐞 交付后走查修复(用户截图反馈)**:① Check In & Out 政策在整块未填时**连出两条「未填写」**(时间和说明各一条),
现改为按「整块是否填过」判定、空块只给一处提示,并把时间从独立大号行改为与标签同排(标签左 / 时间右,基线对齐)、
两块之间补 1px 分隔线;② 编辑态卡片顺序此前照 Figma 编辑画板是 Booking → **Pet** → Check In → Check Out,
与视图的 Booking → Check In & Out → Children(末尾 Pet) **对调**,点编辑后宠物政策的输入位置跑到了入退房政策之前,
已把 Pet Policy 卡移到 Children & Extra Beds 之后,两态顺序一致。校验脚本补 5 条回归断言
(两态标题出现顺序递增 / 空块提示恰好 2 处 / 空块无大号占位时间 / 只填时间时不出现「未填写」),
**GREEN 136/136**(原 131),灵敏度自检 `RED 133/136` → 还原。

**🐞 第二轮走查(用户指定 `696:4711`):Check In & Out Policies 与稿面不一致,已逐值对齐**。上一轮修重复提示时我把标签与时间并排、时间取 34px,
**结构与稿面就不是一回事**。按 `696:4811` 重取规格后改为:标签独占一行(Inter 500/16 半透明黑)→ 下方**整体居中的值块**
(时间 Plus Jakarta Sans 700/**48** + letter-spacing **-0.02em**;说明 Inter 400/**16** 居中;证件行 row 居中 + gap 16,
`Require Documents` 红 Inter 500/16,两份证件之间按稿插入独立 `.` 文本节点);两块之间 1px `#E2E8F0` 分隔。
同卡片内共享字号一并对齐稿面:段标题 14→16 + chevron 12→24、标签/取值 14→16;「空块只给一处未填写」保留。
校验脚本的 CSS 断言改为**按选择器取 scoped 声明块**(兼容普通后代与 `:deep()` 两种编译形态),新增 9 条断言,
**GREEN 150/150**(原 136),灵敏度自检 `RED 146/150` → 还原。

**🐞 第三轮走查(译文):`Add New` 的 zh 串了场景**。`properties.profile.addNew` 是给酒店图片编辑器写的,zh 特化成 `新增图片` 而 en 仍是通用 `Add New`,
被我复用到三个新页签的 6 处按钮 → 中文界面里入住政策的证件、儿童加床、物业规则、长住促销/权益、附近景点的「新增」全变成「新增图片」。
已把通用键回归通用(`新增`),图片编辑器另立 `addNewImage`(zh `新增图片`,en `Add New`,英文界面不变);
另修自己引入的 `例如：10 mins` → `例如：10 分钟`。并做了一次 en/zh 全量译文体检(缺失键 0;16 条与英文相同者均为专有名词;
「en 通用 / zh 多加具体名词」的 10 条逐条核对,仅 `addNew` 属误译)。校验脚本新增 7 条断言并让渲染器支持指定语言,
**GREEN 157/157**(原 150),灵敏度自检 `RED 152/157` → 还原。

**🐞 第四轮走查(用户指定 `748:7074`):Children & Extra Beds 对齐 + 改名**。此前做成了堆叠行,而稿面**视图与编辑都是「一屏 3 张并排卡」**。
先经 Figma MCP 取节点并**导出渲染图核对**再改:视图卡 = 白底/1px `#E2E8F0`/圆角 12/padding 20,名称 700/16、说明 500/14、金额 **主色** 600/16 + 单位 400/12;
编辑卡 = 白底/**主色 1.5px 描边**/圆角 8/`padding 0 0 24px`,顶部工具栏 space-between(铅笔左/垃圾桶右,图标 24),内容块 `padding 16 16 24` + 底部 1px 分隔线,底部独立 `Policy Status` 行;
Pet Policy 说明按稿改 600/16。改名:en `Children & Extra Beds Policies` / zh `儿童与加床政策`。
同屏同类差异已记录未改(Property Rules 同为并排卡、两组标题在稿面是灰色、`Add New` 药丸样式、Pet 卡头状态开关需加字段)。
校验脚本改 3 条 + 新增 14 条(含 7 条 CSS 令牌断言,并为此加了「按选择器取 scoped 声明块」助手),**GREEN 171/171**(原 157),灵敏度自检 `RED 169/171` → 还原。

**🐞 第五轮走查(用户指定 `816:13556`):儿童与加床政策的 Add New 弹窗对齐**。原为「竖排 a-form + 底部两列网格」,稿面是 **2×2 字段网格**:
标题 PJS 600/18 → `Policy Status` 行(space-between,Inter 600/16)+ 1px 分隔线 → 2×2 网格(label↔input gap 6、行列 gap 24,标签 Inter 600/12 `#334155`)→
底部 Cancel(白底描边/圆角 6/高 44)+ Create Now(主色/圆角 8/高 44/尾部箭头,编辑态为 Save);输入框统一高 44/圆角 8/边 `#E2E8F0`。
金额框右侧按稿加**币种胶囊**(圆角 4/底 `rgba(65,105,237,.08)`/Inter 600/12 主色),**只读**(去 chevron)——币种是物业级事实、做成下拉即假控件,
与房量价格页/收益页同一口径;为此给后端 `PropertyProfileService::detail()` 的房型查询补选 `currency` 并以 `metrics.currency` 下发(在售房型为空时回退该物业任意房型)。
真实 HTTP 复核 `metrics.currency='MMK'`;校验脚本新增 17 条(9 条 CSS 令牌 + 5 条结构 + 3 条币种贯通),**GREEN 188/188**(原 171),灵敏度自检 `RED 185/188` → 还原。

**🐞 第六轮走查(用户截图):弹窗「计费单位」比另外三个输入框矮**。用 `sips` 转 PNG + Node 解 PNG 扫描线**逐行量像素**定位(不靠肉眼):
三个输入框与按钮都是 44 CSS px,只有下拉框 34 px。根因是全局 `src/styles/index.less` 用 `!important` 钉死了 antd 控件
(`.ant-input{min-height:34px!important}`、`.ant-select-single:not(...) .ant-select-selector{height:34px!important}`、下拉文本 `line-height:32px!important`),
我上一轮写的 `height:44px`/`border-radius:8px`/`border-color`/`background` 都没带 `!important` → 除 `height` 侥幸生效外全被吃掉。
已按同一 `!important` 口径并在特异性上压过全局,四个控件统一 高 44 / 圆角 8 / 边 `#E2E8F0` / 白底(下拉文本行高 42 居中、金额框内层输入 42 无边框透底)。
校验脚本拆成 4 条断言并直接断言 `!important` 本身,**GREEN 191/191**(原 188),灵敏度自检(只删下拉框那条覆盖) `RED 190/191` → 还原。

**🐞 第七轮走查(用户截图):儿童与加床政策卡片两条**。① 卡片**紧贴分组头分隔线、缺上边距** —— 按稿补 `margin-top: 16px`(编辑态 gap 16),
视图态分组头已有 10px 下内边距故补 14 凑成稿面 24;同屏的**物业规则列表同一缺陷一并修**。② **金额为空或 0 时显示占位「—」**,改为显示
**`Complimentary`(中文「免费」)**:新增 `amountLabel()`,金额去千分位/空白后为空或为 0 即判免费,视图卡与编辑卡共用;填了金额照原样显示。
校验脚本新增 4 条断言,**GREEN 195/195**(原 191),灵敏度自检 `RED 191/195` → 还原。

**🐞 第八轮走查:金额右侧 MMK 由只读胶囊改为可选下拉**。用户指出货币单位不该写死(稿面胶囊本就带 chevron,是选择器),但系统货币字典未定稿。
新增 `src/config/currencies.ts` 作为**唯一可替换的字典**(占位 EUR/MMK/THB/PHP/USD,取自 `sys_site.currency` 与仓库其它处;附「定稿后只改这一个文件」);
`children[]` 新增 `currency` 字段(后端归一化大写/限长,随 revision 走审核),新建默认取物业币种 `metrics.currency`;下拉选项 = 字典 + 当前值(物业币种不在字典里也能显示)。
组件换成 `<a-select :bordered="false">` 并保留稿面 24 高/圆角 4/蓝底胶囊样式,关键是把它**从「四个控件等高 44」的 `!important` 规则里 `:not()` 排除**。
卡片上纯数字金额按该行币种补前缀(`35000`+`MMK`→`MMK 35000`),已写货币的照原样。真实 HTTP 往返 5/5 PASS(测试数据已还原);
校验脚本新增/改写 12 条,**GREEN 207/207**(原 195),灵敏度自检 `RED 203/207` → 还原。

**🐞 第九轮走查(用户截图):币种下拉面板里「MMK」被截成「M...」**。antd 默认面板与触发器等宽(72px),选中项还要给勾选图标让位 → 3 位代码被省略号截掉(且只有选中项如此,其余选项看着正常)。
修法:`:dropdown-match-select-width="false"` 让面板按内容自适应 + 触发器 64→72px 留余量。校验脚本补 2 条断言,**GREEN 208/208**(原 207),灵敏度自检 `RED 206/208` → 还原。

**🐞 第十轮走查(用户截图):分组头的向下箭头太大**。照抄了稿面 lucide chevron 的**方框尺寸 24**(lucide 笔画在 24 框里只有 14×8、留白很大),而 antd `DownOutlined` 字形几乎填满方框。
扫像素实测现状 20×14 CSS px、应为 14×8 → 改 `font-size: 16px`。校验脚本断言同步改为 16 并写明理由,**GREEN 208/208**,灵敏度自检 `RED 207/208` → 还原。

**🐞 第十一轮走查:宠物政策编辑态补开关 + 编辑卡右上角箭头换图标**。① 按 Figma `772:11667` 给宠物政策卡头补 **状态开关**(不是 chevron),
新增 `pet.status` 字段(后端缺省 true 兼容旧数据),视图停用时整块淡化;② 所有编辑卡右上角的展开箭头原先用的是**文字箭头字符**(太小),
稿面两处实测均为 **14×8**(24 方框 lucide chevron),统一换成 `DownOutlined` **16px**、色 `#9aa0ae`,与视图分组头一致(共 5 处)。
真实 HTTP 往返 5/5 PASS(测试数据已还原);校验脚本新增 9 条断言,**GREEN 217/217**(原 208),灵敏度自检 `RED 211/217` → 还原。

**🐞 第十二轮走查(用户截图):宠物政策标签颜色 + 「未填写」占位**。先量截图确认:「宠物政策」标签 (133,134,145) 与「入住/退房」**完全相同**(稿面本就是灰标签,没写错);
真正的问题在「未填写」实测 (22,22,33) —— 宠物块的 `<p>` **漏了 `empty` 类**,占位跟着说明一起套用了稿面的 600/`#1b1d30`。补上 `:class="{ empty: … }"` 走页面既有淡化口径(`#a5a8b1`/400)。
标签颜色则**按用户口径覆盖稿面**改成蓝色标题(`#4d6cf4`/600,与「儿童与加床政策」「物业规则」一致),代码注释与规格文档均标注「别再照稿改回灰色」。
校验脚本新增 3 条断言,**GREEN 220/220**(原 217),灵敏度自检 `RED 218/220` → 还原。

**🐞 第十三轮走查(用户指定 `748:7074`):物业规则对齐稿面**。稿面 `Property Rules` 与儿童加床政策是**同一套卡片**,此前仍是堆叠行。
已改为:视图 = 一屏 3 张并排卡(白底 1px 边 / 圆角 12 / padding 20,内含 36×36 图标 + 名称 700/16 + 说明 400/14);
编辑 = 与儿童卡同壳(主色 1.5px 描边 / 圆角 8,顶部铅笔·垃圾桶分居两角、内容块底部 1px 分隔线、底部 Policy Status 行),**卡面纯展示**;
顺带清掉只服务旧版式的 9 个样式类。⚠️ 稿面没画规则弹窗,按同屏儿童政策**既有弹窗语言**补一个(复用同样的样式类与尺寸)。
`vue-tsc` 零报错(并修掉上一轮 `pet` 加 `status` 后 `patch({ pet: {...} })` 的类型漏改);校验脚本改 8 条 + 新增 4 条,**GREEN 222/222**(原 220),灵敏度自检 `RED 219/222` → 还原。

**🐞 第十四轮走查(用户指定 `696:4711`):预订政策对齐稿面**。稿面每组是**「标签独占一行 + 取值在下方」**(`EL-56135fb6` column/gap 16),此前做成了左右两列。
按稿重排,组间改用**独立分隔线元素**(稿面是 `Separator`,不是 border-top);**顺带统一四个分组的间距**——稿面四个分组容器都是 column + gap 24,而 `.hp-section-body` 是 14,改为 `gap: 24px; padding: 14px 0`,
于是删掉两处特例(`.hp-section-body .hp-card-grid{margin-top}` 与 `.hp-check + .hp-check{border-top}`),并去掉宠物块自造的 `border-top`。校验脚本新增 4 条 + 改 2 条,**GREEN 226/226**(原 222),灵敏度自检 `RED 222/226` → 还原。

**🐞 第十五轮走查(用户指定 `696:4914`):附近景点按稿重做,数据模型一起改**。第一轮我把弹窗里的 `Mark 1 / Mark 2` 当成重复示例,做成了「一张卡 = 一个地点」并写进文档当「已确认偏差」——**理解错了**:
稿面一张卡是「**机场 → 景点**」两段行程,即 `图片 + stops[]`,地点之间用竖直虚线相连,底部是整宽 `Edit Details`。
数据模型随之改为 `[{id,image,status,stops:[{id,icon,name,travelTime,travelMode,distance}]}]`(后端 `NEARBY_STOP_LIMIT=8` 且**兼容旧扁平结构**,前端同样兜底)。
卡面补齐:顶部 68px 渐变蒙层(渲染图实测确认)、左上角 12px 绿色圆点(放大核对过,不是数字序号)、36 圆形图标地点行(名称 600/16 + 路程 400/14)、
竖直虚线(2px 主色 4/4、40%)、`Edit Details` 按钮(整宽/高 34/圆角 8)。视图态点按钮会**先切编辑态再自动开弹窗**;弹窗支持 `Add More` 多地点。
真实 HTTP 往返 10/10 PASS(含旧结构迁移),测试数据已还原;校验脚本改 8 条 + 新增 5 条,**GREEN 231/231**(原 226),灵敏度自检 `RED 223/231` → 还原。

**🐞 第十六轮走查:附近景点空态按钮 + 底部操作栏置底**。① 空列表时头部改给**「编辑」按钮**(与 Hotel Details / Amenities / Policies 逐字同款:EditOutlined + Edit + `editRequested`),
`Add New` 只留给「已有数据再加一张」的场景;② `.edit-actions` 原来只有 `position: sticky`,**内容比视口短时不会吸底**,导致附近景点这类短页里操作栏浮在内容下方 —— 页面与 `a-spin` 两层包裹改为 flex column 撑满,操作栏 `margin-top: auto`(与 sticky 并存)。
校验脚本新增 4 条断言(profile.vue 的 scoped 样式用 `@vue/compiler-sfc` 单独编译后断言),**GREEN 235/235**(原 231),灵敏度自检 `RED 232/235` → 还原。

**🐞 用户报缺陷:附近景点空列表进编辑态后没有「新增」入口**。上一轮条件写成 `v-if="!modelValue.length"`,而**编辑态下它仍为真** → 点「编辑」进去后头部又变回「编辑」按钮,空列表永远加不了卡片。改为 `!editing && !modelValue.length`(编辑态一律 Add New),四种状态(视图/编辑 × 空/有数据)已逐个实渲染核对。校验脚本补 1 条回归断言,**GREEN 236/236**,灵敏度自检 `RED 234/236` → 还原。

**🐞 第十七轮走查(用户指定 `696:4375`):长住详情页签按稿重排**。四处结构性差异:① 稿面是**两张卡**(促销卡带卡头、权益卡没有);② 卡头 Edit 是**描边药丸**(透明底 + 1px 主色边 + 主色 600/12),不是 antd 默认按钮;
③ 促销行是「名称列**右对齐** + **固定 300px** 线 + 取值列**左对齐**」,行尾是 **12×12 状态绿点**(我画成了 chevron);④ 分组小标 13→**16/500**、权益圆点 6→**12px**、行间距 12→**16**。
校验脚本改 1 条 + 新增 6 条,**GREEN 242/242**(原 236),灵敏度自检 `RED 238/242` → 还原。

**🐞 第十八轮走查(用户指定 `747:5592`):长住详情编辑态按稿重排**。我第一版整块版式都不对:稿面是**一屏 3 张并排卡**(实测卡宽 392 / 间距 16、卡壳与儿童卡同构),
我做成了一列堆叠行;工具栏应是**铅笔左/垃圾桶右**(图标 24);内容行 `padding 16 16 24` + 底部 1px 分隔线,促销两端 **PJS 600/24 主色**、权益只有名称(`bold` 直接决定字重);
状态区是「标签 + **开关**」(促销 1 行、权益 2 行)—— 我原来那两枚 `Active/Paused/Bold` 文字徽标是**自己加的**。
校验脚本改 4 条 + 新增 6 条,**GREEN 248/248**(原 242),灵敏度自检 `RED 246/248` → 还原。

**🐞 第十九轮走查:四个页签的编辑按钮统一**。逐页签对齐后编辑按钮一度是两种样子(长住是稿面描边药丸、其余是 antd 默认按钮)。
这次**抽一份共享样式** `src/styles/index.less` 的 `.mtrip-edit-pill`(稿面尺寸:高 34 / padding 0 16 / 圆角 8 / 1px 主色边 / 图标 14 / 文字 600/12,颜色沿用本页 `#4d6cf4`),
**五个引用点**(详情卡、设施卡 ×2、长住卡、政策卡、附近空态)全部改用它,并删掉三处只服务旧 antd 按钮的失效规则。页头 `Edit Hotel Profile` 不动(稿面是实心蓝底)。
校验脚本新增 8 条断言(含渲染层「不许混进 ant-btn」),**GREEN 256/256**(原 248),灵敏度自检 `RED 253/256` → 还原。

**🐞 第二十轮走查(用户给 11 个节点):酒店设施页签核对**。两处真缺口:① **「加亮」在视图里根本没画** —— 稿面每枚胶囊/标签卡行尾是「**星 + 状态点**」两个 12×12(星:加亮=实心主色/未加亮=描边灰;点:启用绿 `#00A63E`/停用红 `#EC1317`),我第一版只有点、且点画成了 8px 带光晕;
② 尺寸/壳差一档:胶囊 `padding 12 16`/gap 16/**圆角 32**/图标 **24**/名称 **600/16**;标签卡 `padding 16`/**高 84**/圆角 32/图标 **40**;编辑卡与其它页签**同壳**(1.5px 描边/圆角 8/`padding 0 0 24px`、内容行 `padding 16 16 24`+分隔线、只显示图标 20+名称、状态行 16/600)。
顺带把弹窗标题收敛为全局 `.mtrip-modal-title`。校验脚本新增 17 条断言并把 HotelAmenities 纳入 SSR 渲染校验,**GREEN 273/273**(原 256),灵敏度自检 `RED 269/273` → 还原。

**🐞 第二十一轮走查(用户指定 `869:12478`):设施弹窗两处**。① 两个开关行(`Amenity Status` / `Add Highlight`)稿面是**同一行左右分列** —— 我的 `.modal-switches` 自身没设 `display:flex`,两行竖着堆了;
② `Amenity Icon` 稿面是**只显示图标**的选择器(60 高的框、图标 32 居中主色 + 右侧 chevron),我是 antd 标准下拉(图标+文字);
改法:`:options` 的 label 传 VNode + 下拉用 `#option` 插槽补名称。同时把弹窗输入框统一到 44 高(稿面实测 43)。校验脚本新增 4 条断言,**GREEN 277/277**(原 273),灵敏度自检 `RED 275/277` → 还原。

**🐞 第二十一轮补修(用户截图):设施弹窗开关行中间的竖线紧贴左侧开关**。根因:`label` 是 `flex:1` + `space-between`(开关贴右),只给第二个 label 加 `padding-left`,左侧没有任何留白。
修法:`.modal-switches` 加 `gap: 24px`(线左侧)+ `padding-left: 24`(线右侧)等距,窄屏竖排时 gap 归零。校验脚本把断言扩成「两侧都 24」,**GREEN 278/278**,灵敏度自检 `RED 277/278` → 还原。

**🐞 第二十二轮走查(用户截图):Hotel Images 卡头 `Add New` 文字几乎看不见**。根因是 `profile.vue` 的 `.section-head .ant-btn { color: var(--profile-primary) }` —— 它本是给描边编辑按钮染蓝的,**没排除主按钮**;
而第 19 轮编辑按钮换成 `.mtrip-edit-pill` 后,这条规则在该卡头已不再命中任何东西,只剩 Hotel Images 卡头的 primary `Add New` 被它命中 → 蓝底(#2563EB,全局 `!important`)配蓝字(#4d6cf4)。
修法:加 `:not(.ant-btn-primary)` 守卫;并**全仓审计同类规则**,未发现第二处染色泄漏。校验脚本新增 1 条断言(逐条扫编译后选择器含 `.section-head`+`.ant-btn` 且声明有 `color` 的规则,必须都带守卫),**GREEN 279/279**,灵敏度自检 `RED 278/279` → 还原。

**🐞 第二十三轮走查(用户报缺陷):左上角切换酒店时 Hotel Profile 不换资料**。两头都有问题:① `BasicLayout.selectProperty()` 的 `alwaysAvailable` 用 `path.startsWith('/properties/')` 判定,
把 `/properties/:id/profile` 也当成「与物业无关的页面」而跳过跳转;② 即使跳了,同一条路由只换参数时**组件被复用**,`propertyId` 是 setup 时常量、`onMounted` 不再跑。
修法:切换器增加 `PropertyProfile` 分支(跳新物业 profile,清空则回列表);`profile.vue` 的 `propertyId` 改 `computed` + 新增 `watch(propertyId)` 复位并重载。
对照:房型页 `rooms/index.vue` 早有 `watch(selectedPropertyId)`,这次是 Hotel Profile 漏了。校验脚本新增 4 条断言,**GREEN 283/283**,灵敏度自检 `RED 281/283` → 还原。
⚠️ 无 DOM 测试环境,该链路只有源码级断言,人工验收步骤已写进 HANDOFF。

**🐞 第二十四轮走查(用户报缺陷):侧边栏点「All Properties」没切到 All Properties 模式**。一个原因造成两半现象:`utils/http.ts` 给每个请求自动加 `X-Mtrip-Property-Id`,后端 `scopePropertyIds()` 选中物业时只回那一条 —— 列表被静默收窄(**真实 HTTP:无 header total=2 [10,7];带 7 → total=1 [7]**);
而侧边栏点 All Properties 只跳路由、没清选中物业。修法:在**路由守卫**里 `to.name === 'AllProperties'` 时 `selectProperty(null)`(挂载前清干净,列表只拉一次)。校验脚本新增 3 条断言(含跨层钉住后端收窄行为),**GREEN 286/286**,灵敏度自检 `RED 285/286` → 还原。

**🐞 第二十五轮走查(用户报缺陷):「所有物业」点 Manage 没切换全局物业上下文**。`openProperty()` 只 push 路由、从不设置选中物业 → 进 Hotel Profile 后下拉仍是 All Properties、左侧物业专属菜单不出现。
修法(与 All Properties 清理同处,都在路由守卫):从 `PropertyProfile` 的 `:id`(或 `?propertyId=`)对齐 `selectedPropertyId` —— 下拉与 `visibleMenus` 都挂在这个 id 上,自然一起联动。
⚠️ 只认 `PropertyProfile` 的 `:id`(`/rooms/:id` 是房型 id,专门加了断言钉死)。校验脚本新增 3 条断言,**GREEN 289/289**,灵敏度自检两次(删逻辑 / 误用房型 id)均 `RED 287/289` → 还原。

## 2026-09-17 侧边栏菜单调整(Stores/Goods 移出 + 物业专属分组)

按用户要求调整商户端侧边栏,5 个待确认点已逐条确认(均为推荐方案):

- [x] **Stores、Goods 移出侧边栏**:只在 `SideMenu.vue` 的 `HIDDEN_PATHS` 隐藏,数据库菜单行、权限键与路由全部保留 —— 工作台「View All Properties」与「所有物业」列表对非酒店物业的 Manage 按钮仍跳 `/store`,不会 404。
- [x] **Operations 仅在选中具体物业时出现**:子菜单为 Availability & Pricing(`/availability`)、Booking Management(`/order`,从原「经营」分组移入)。未选物业(All Properties)整组隐藏。
- [x] **新增 HOTEL MANAGEMENT 分组**:仅选中**酒店**物业时显示,含 Hotel Profile 与 Room Types。Hotel Profile 复用既有 `/properties/:id/profile` 页面(与「所有物业」列表 Manage 按钮同一页),入口按当前选中物业动态生成;Room Types 即原 Rooms 菜单改名,路由 `/rooms` 与权限 `mch:rooms:list` 不变。
- [x] **切回 All Properties 的兜底**:`BasicLayout.selectProperty()` 切换后若当前页面已不在菜单口径内(物业专属页面),直接跳回「所有物业」页。
- [x] 菜单口径抽到 `src/config/menuSections.ts`(`isMenuPathVisible`),侧边栏与切换兜底共用一份,避免两处漂移;`userStore.visibleMenus` 仍按既有 `module_key` 过滤(房型 600、房量与价格 700 本就是 `module_key='hotel'`)。
- [x] 菜单改名走增量 `database/migrations/V20260918130000__merchant-menu-restructure.sql`(守卫式 UPDATE,已 db-apply),`database/seed/04-merchant-menu.sql` 同步为「房型管理 / Room Types」供空库初始化;不改 `module_key`、不新增 menu 行(Hotel Profile 与 `/dashboard`、`/properties` 一样由前端直接挂入口,避免菜单树注册重复路由)。
- [x] i18n:新增 `sidebar.sections.hotelManagement`(en `HOTEL MANAGEMENT`/zh 酒店管理),`menu.rooms` 改为 Room Types/房型管理;Hotel Profile 复用既有 `properties.profile.title`(en/zh 已是 Hotel Profile/酒店资料)。

验证:用真实 `SideMenu.vue` + 真实 store/i18n/router 喂本地开发库的真实菜单树,在无头 Chrome 里跑三种物业上下文(临时探针已删除)——All Properties 下无 Operations/HOTEL MANAGEMENT/Stores/Goods;选中酒店时两组齐全,Hotel Profile 点击落到 `/properties/5/profile`、Room Types 落到 `/rooms`;选中餐厅时不出现 HOTEL MANAGEMENT,Operations 只剩 Booking Management。该轮实测还抓出一个真实缺陷并已修:**Hotel Profile 的动态路径初版没有业务类型判断,选中餐厅时仍会显示**,现 `hotelProfilePath` 仅在 `business_type === 'hotel'` 时生成。merchant-web 生产构建(vue-tsc + vite build)通过。

## 2026-09-16 客房管理 Figma 与 PRD 整改

- [x] 进入客房管理提示“物业上下文格式不正确”已修复：原因是酒店选项和 All Properties 列表把 `0` 作为 `X-Mtrip-Property-Id` 发出。现在未选物业时省略该头，有效物业仍显式发送；merchant-web 生产构建通过。
- [x] `/rooms` 已按 Figma `930:11444` 改为真实统计、搜索/酒店/状态/审核筛选、服务端排序和三列房型卡片；More Details 与旧的新建/编辑/详情路由共用同一套组件，复制、启停、删除审核和历史未被删减。
- [x] 四步弹窗实现 Room Information / Room Images / VR Tour / 3D Floor Plan，包含多床型、sqm/sqFt、客房设施、餐食计划、默认可售配额、取消政策、图片管理、视频、WebGL 360 全景和平面图热点。外部 VR 无服务商，可保存合法 HTTPS 配置但不能启用。
- [x] 站点币种由后端确定；`base_stock` 是物理房量，`launch_stock` 是无日库存时的默认可售配额，周五/周六统一使用周末价。显式日库存不会被房型内容审核覆盖，取消政策批准后更新执行规则并由订单冻结快照。
  - **2026-09-16 补修（后端 + 本页表单）**：该语义在 `RoomDefaults::stock()` 里被 `launch_stock ?? base_stock` 实现错了 —— `??` 不会在 `launch_stock=0` 时回退，而本页新建房型时该字段初值就是 0，导致房型建好后所有无日库存的日期都判「库存不足」(409)、消费者日历也显示 `stock=0`。后端已改为 `launch_stock > 0 ? launch_stock : base_stock` 并补单测。**本页表单同步收口**（`RoomEditor.vue`）：① 客房总数变化时，尚未设置或仍在跟随的默认可售配额自动同步（商户显式填过的更小值不覆盖）；② 打开编辑器时把历史 0 值按客房总数补上，且因补值发生在 baseline 捕获之前，不会出现「打开即脏/误弹放弃修改」；③ 提交审核时若客房总数 > 0 而配额 ≤ 0 直接拦截并提示（仅提交拦截，草稿仍允许不完整，与原有校验口径一致；客房总数 0 的复制草稿不拦）。13 条真实 Vue 响应式断言与 merchant-web 生产构建通过。
- [x] 新增 `hotel_room_media` 物业附件登记及房型结构化字段，服务端校验真实 MIME、尺寸/比例、大小、视频时长和归属；admin 房型审核可对比并预览全部新媒体。消费者接口仅返回已批准、在售、启用媒体及明确白名单字段。
- [x] `V20260916005000` 已本地应用，迁移账本 18/18。客房专项 61 个通过场景、物业发布/消费者回归、389 PHP lint、shared 95/957、双 Web 构建、client-app 类型检查、OpenResty 配置、迁移和差异检查通过；桌面和约 430px 窄屏已检查。未修改两个 App 的功能代码。

## 2026-09-15 Hotel Amenities 页签 Figma 对齐

- [x] 对照 Figma `696:4238` 主页面和 `743:4446` 编辑页面开放 Hotel Amenities 页签；查看态按 Essential Amenities、Reception Amenities、Dinning Amenities、Hotel Tags 分组展示，状态点、标签说明、三列设施/双列标签布局与原型一致。
- [x] 编辑态支持每组新增、编辑、删除，选择设施图标，并分别维护 Amenity Status 与 Add Highlight；每组最多启用 5 项、最多设置 5 项亮点，前后端同时校验，关闭设施时同步取消亮点。
- [x] 新增物业级结构化 `amenities` JSON 字段，随既有资料草稿、提交、审核、驳回和批准版本流转；启用且非 Hotel Tags 的名称继续自动投影到 `facilities`，旧物业的 `facilities` 自动转为 Essential Amenities，现有消费者接口与两个 App 无需修改。后台物业资料审核差异表可读展示完整结构化变更。
- [x] 已应用迁移 `V20260916004000`（17 已执行、0 待执行）。隔离发布/消费者兼容回归通过，覆盖旧数据回退、分组状态、5 项限制、审核落库和 `facilities` 投影；merchant-web/admin-web production build 通过。两个 App 未修改。

## 2026-09-15 酒店物业详情 Figma 对齐

- [x] 对照 Figma `696:4024` 主页面和 `712:6419` 编辑页面，将 `/properties/:id/profile` 落地为三项真实指标、六页签、双列详情、行程亮点、设施和图片网格；编辑由弹窗改为原型对应的整页分区表单。当时只开放 Hotel Details，Hotel Amenities 已在上方后续记录中完成。
- [x] 物业资料新增电话 1、电话 2、邮箱、经纬度和带启用状态的图片图库。两部电话在 `merchant_store` 与资料修订记录中均使用 AES-256-GCM 密文保存，商户编辑与后台审核接口解密展示；邮箱、经纬度范围均在服务端校验。
- [x] 新增 `/merchant/properties/profile/media/upload`，复用 `mch:properties:profile-edit` 权限并强制物业上下文。仅接收不超过 10MB、至少 800×600 的 JPG/PNG/WEBP，保存到物业隔离目录；编辑页支持上传、预览、删除和 Image Status 开关。`image_gallery` 保存完整列表，既有 `images` 只投影启用 URL，消费者接口及 App 无需改动。
- [x] 顶部 Room Types 读取已审核发布且在售的房型名称，Total Rooms 汇总这些房型的 `base_stock`，Guest Rating 汇总该物业可见评价的平均分和数量。地图区域按确认使用静态占位，经纬度真实保存，为以后地图服务对接保留数据。
- [x] 原有草稿、提交审核、驳回回显、审核中锁定、发布/下线、`v-perm` 和显式 `X-Mtrip-Property-Id` 全部保留；后台物业资料审核差异表同步展示新增字段。手机端详情路由沿用可展开侧栏。未修改 `client-app` 或 `merchant-app`。
- [x] 本地迁移账本已应用 `V20260916003000`（16 已执行、0 待执行）。隔离数据库完整物业发布/消费者兼容回归通过，覆盖电话密文、图片启停投影、上传格式/尺寸、坐标、邮箱和真实指标；merchant-web/admin-web 构建、383 个 PHP 文件语法检查、shared 95 用例/957 断言、桌面和 400×842 手机视口检查及 `git diff --check` 通过。

## 2026-09-14 All Properties 与全局菜单 Figma 对齐

- [x] 续接 Figma `585:7146` 的 Add New Property 第 1 步：新增 `/properties/new` 独立页面，完成面包屑、Basic Information/KYC Documents 步骤提示、物业名称/类型/房型数量/位置、图片拖放预览及底部操作栏；所有新增入口改进该页。用户确认本轮仍使用现有门店新增流程，Next 将名称和位置预填至 `/store` 新增弹窗；类型、房型数量、图片仅作页面预览，明确提示尚不保存。未新增物业专项 KYC 或上传接口。`merchant-web npm run build` 通过；1536×826 本地隔离预览截图已核对布局，临时预览文件已删除；无商户登录态，真实提交仍待验收。
- [x] 按 mTrip_Merchant 节点 `580:6100` 新增 `/properties`：四张统计卡、按酒店/餐厅分组的三列业务卡和新增卡；列表读取 `/merchant/auth/menus` 中当前账号已验证且有数据权限的 `businesses`，不写死设计稿示例名称、数量或审核状态。酒店卡使用本地保存的 Figma 图片作展示素材，状态只显示接口已证实的“已验证”；第四统计卡也明确标为“已验证业务”，避免把 KYC 结果冒充发布状态。
- [x] 左侧菜单按设计分为 Portfolio、Business、Team、System；为了保留既有门店/商品/客房/房量等入口，另设 Operations 分组。菜单仍从后端授权树提取页面，未修改原页面路由、接口或按钮权限。设计中的 Guest Messages 无独立列表，现有住客消息仍从预订详情进入。
- [x] 新页组件路径 `properties/index` 与商户菜单种子一致；增量迁移 `V20260914090000__add-merchant-properties-menu.sql` 为已有 Dashboard 权限的角色授予新菜单。“Add New Property”先进入新增物业基本信息页，再沿用门店新增弹窗；“Manage”和“Dashboard”分别进入已有门店页/看板，不新增入驻或独立物业看板接口。
- [x] `merchant-web npm run build`、迁移命名校验通过；本地迁移账本由 3 个已执行版本更新至 4 个，待执行 0。临时本地展示数据在 1536×995 浏览器视口对照节点检查，并将酒店卡片间距修到设计尺寸；预览数据与鉴权绕行代码已撤销。无可复用商户登录态，真实账号联动验收待补。

## 2026-09-13 商户登录传输密钥对齐

- [x] 本地商户登录报“加密数据解密失败”：`merchant-web/.env.development` 的 `VITE_LOGIN_AES_KEY` 与运行中 merchant-service 的 `MTRIP_ADMIN_AES_KEY` 不同；`PayloadDecryptMiddleware` 对商户登录同样使用后者，旧注释所写的 `MTRIP_MERCHANT_AES_KEY` 并不存在。
- [x] 开发配置已对齐 admin-web 与后端的登录密钥，修正商户前端配置注释和启动指南；重启 merchant-web 后，空的加密测试请求经 5174 代理返回 HTTP 400 / `40001`“参数 username 不能为空”，证明已通过解密并进入参数校验。真实账号及 TOTP 登录未代用户操作。

## 2026-09-10 商户登录页 Figma 对齐

- [x] 按 Figma `mTrip_Merchant` 节点 `1787:13875` 重做 `views/login/index.vue` 的展示层：55px 主色顶栏、真实 mTrip Logo、世界地图背景、900px 双栏安全登录卡、浅蓝标题区、虚线安全区、2FA 分隔标识和页脚。
- [x] Figma 原始 Logo 与地图底图已保存到 `src/assets/login/`，不依赖七天后失效的临时素材 URL；顶部 Logo 已按素材透明留白范围裁切放大，中英文登录页文案同步补齐。
- [x] 保持现有真实鉴权契约不变：第一步仍为商户访问码/用户名 + 密码，后端返回 challenge 后再验证六位 TOTP；首次 enrollment 时右栏展示 `/merchant/auth/2fa/setup` 返回的真实二维码和手动密钥。后端无扫码登录/重发验证码接口，因此未把设计稿静态二维码伪装成可用入口。
- [x] `merchant-web npm run build` 通过；本地预览在 `1536×826` 与 `390×844` 完成首屏视觉检查，窄屏自动转单列，浏览器控制台无 warning/error。未使用账号提交登录，challenge 后的真实 2FA 状态未做登录态浏览器验收。

## 2026-09-01 M4 Booking Management 预订管理落地(阶段0～6)

方案:`实现方案-Merchant-M4-酒店预订管理.md`(已全部完成并勾选)。前端交付集中在 `views/order/index.vue`:

- [x] 六页签布局(全部/待确认/In House/已退房/待支付/已取消)+ 页签内筛选工具栏,列表行直出 `available_actions` 驱动按钮显隐。
- [x] 右侧约 430px 详情面板:住客信息/日期房型/支付/时间线(含强制同步、住客消息事件)/可用操作区(确认/入住/退房/改房号/改单/联系方式/凭证上传),写操作全部 `v-perm` + `a-popconfirm` 防护。
- [x] 住客消息抽屉(`availableActions.includes('message')` + `mch:order:message`):拉取会话线程 `apiGuestThread`,气泡式展示,`sender_type===2` 商户消息靠右;会话结束(`status===1`)时只读。
- [x] 词条:新增 `booking.msg` 命名空间、`booking.actions.messageGuest`、时间线类型 `guest_message_sent`/`sync_failed`(en-US/zh-CN 同步)。
- [x] 构建 `npm run build`(vue-tsc + vite)通过,仅既有大 chunk 警告。
- [x] 验收:`m1001 / Merchant@123456` + TOTP 真实登录态,In House → 详情 → Message Guest → 发送消息气泡验证,截图 `.reasonix\attachments\m4-guest-message-*.png`。

配套后端契约(详见方案文档):`/api/v1/merchant/booking/*` 16 端点挂 order-service,`BookingLifecycleService` 管理状态机+库存联动+过期确认任务;通知/同步失败不回滚主事务、不伪造成功(时间线 `sync_failed` 事件如实记录)。期间发现并修复平台级缺陷:`PermissionAspect` 缺 `#[Aspect]` 注解导致全平台 `#[Permission]` 静默失效,已为 8 个服务补 `config/autoload/aspects.php` 显式注册(新服务必须携带,见 HANDOFF 第4节硬约定)。

## 2026-09-01 注册业务切换与菜单上下文整改

- [x] 移除 `BasicLayout.vue` 中照搬原型的 3 家酒店、2 家餐厅假数据及无真实动作的“添加物业”入口。
- [x] `/api/v1/merchant/auth/menus` 在原有 `menus/perms` 基础上返回当前账号数据范围内、已关联正式商户且业务 KYC 已通过的 `businesses`；集团账号按集团可见商户汇总，门店账号只返回当前门店绑定业务。
- [x] 默认进入商户端时保持“全部业务”全局上下文，只展示 `merchant_menu.module_key=''` 的公共菜单；选择具体业务后追加展示与其 `business_type` 同名模块菜单。酒店现有专属菜单为客房管理、房量与价格；餐饮暂无专属页面，不伪造入口。
- [x] 切换业务后如果当前路由不再可见，自动回到 `/dashboard`；动态路由和后端权限仍使用完整授权菜单，不用前端选择替代后端鉴权。
- [x] PHP 语法检查、merchant-web `vue-tsc --noEmit` 与 Vite production build 通过；Docker Desktop Engine 返回 500，真实接口与登录后浏览器联调待 Docker 恢复后补验。

## 2026-08-28 商户工作台服务器内部错误修复

- 现象：GET `/api/v1/merchant/stats/dashboard`服务器内部错误。日志先报`Unknown column merchant_id`；本地开发库及隔离库缺marketing/07迁移。
- 数据修复：执行已有`database/marketing/07-merchant-promotion-owner.sql`，补两个归属字段及索引，重复执行通过。compose本已有初始化挂载；存量数据库不会靠重启MySQL重新执行初始化脚本，需要显式执行增量迁移。未删除数据，未把历史平台券猜测分配给商户。
- 继续执行真实查询还发现趋势使用已安装Hyperf不支持的`groupByRaw`。仅修改StatsController两处为`groupBy(Db::raw('DATE(pay_time)'))`，SQL按日分组口径保持不变。
- 新增`order-service/test/m12-dashboard.php`实际查询回归；scripts/test-m12.ps1显式升级测试库优惠券结构并加入看板测试。14项覆盖空数据、完整响应、7日趋势、非零金额与取消/其他商户排除、促销固定/相对有效期、草稿/暂停/结束/删除/未来/过期排除、集团站点与黑名单过滤、门店/空授权不越权。
- 结果：14项看板＋300项既有集成＝314项通过；58单测/858断言、两个变更PHP语法通过；订单服务重启后healthz正常。测试订单及优惠券夹具已清理。
- 复测入口：`scripts/test-m12.ps1`。原始失败及回归日志在本任务work/dashboard-before.log、work/dashboard-regression.log；本次仅保存表结构快照，不是业务数据备份。
- 不涉及前端改动；未进行浏览器登录态端到端验收。平台AdminStatsController存在同类方法调用，另行记录未改，不声称已修复平台统计。Git未暂存、未提交、未推送。

## 架构结论
- 三前端三账号体系独立:admin-web(`sys_admin`) / merchant-web(`merchant_admin`×3类型) / supplier-web(未来)。merchant-web 是"一个前端三种视图",按 `account_type` 裁剪菜单与数据范围。
- 菜单/权限完全 DB 驱动(不复用平台 `sys_menu`),弃用 `merchant_admin.role_perms` JSON 隐式方案,改用四表 RBAC;`role_perms` 列保留不再写入。
- 鉴权复刻 admin 链路,JWT 复用全平台 `MTRIP_JWT_SECRET`,claims 增加 `aud='merchant'`、`account_type`、`group_id`、`merchant_id`、`store_id`、`is_owner`。
- 权限透明复用:`MerchantAuthMiddleware` 同时写 `MerchantContext` 与 `AdminContext`(`is_super=false`,`permissions`=JWT 权限集),现有 `#[Permission]`/`PermissionAspect` 无需改动即对商户端生效。
- 数据范围:集团=本集团全部绑定商户及其门店/订单/商品;商户=本商户;门店=本门店。由 `MerchantContext::scopeMerchantIds()` 统一提供。

## 任务清单(本轮实施)

### 数据库(database/)
- [x] `merchant/05-merchant-rbac.sql`:四表 `merchant_menu`/`merchant_role`/`merchant_role_menu`/`merchant_admin_role`(`CREATE TABLE IF NOT EXISTS` 幂等)
- [x] `seed/04-merchant-menu.sql`:商家域菜单树 + 按钮 `perm_key` + `account_scope`;预设三条内置角色(集团/商户/门店管理员,`merchant_id=0,is_builtin=1`)及其菜单授权(`INSERT IGNORE` 幂等)

### 后端-shared(backend/shared/src/)
- [x] `Context/MerchantContext.php`:协程级主体上下文 + `scopeMerchantIds()` / `hasAnyPermission()`
- [x] `Middleware/MerchantAuthMiddleware.php`:校验 `aud==='merchant'`,写 MerchantContext + AdminContext 以复用 `#[Permission]`

### 后端-merchant-service
- [x] `Controller/Merchant/AuthController.php` + `Service/Merchant/MerchantAuthService.php`:`login/logout/me/menus/updatePassword`,按 account_type 过滤菜单树 + 权限集
- [x] `Controller/Merchant/AccountController.php`:子账号 列表/新增/改/启停/重置密码(限本主体)
- [x] `Controller/Merchant/RoleController.php`:角色 CRUD + 分配菜单 + 给子账号赋角色(只授本 account_type 可见菜单)
- [x] `Controller/Merchant/StoreController.php`:门店 列表/详情/新增/改/设主/启停(数据范围裁剪)
- [x] `Support/MenuTreeHelper.php`:菜单树构建
- [x] `config/routes.php`:`/api/v1/merchant/*` 路由组(挂 MerchantAuthMiddleware + OperationLogMiddleware),组外 `POST /api/v1/merchant/auth/login`

### 后端-跨服务商户口径接口
- [x] order-service `Controller/Merchant/OrderController.php`:订单 列表/详情/核销(强制主体范围)
- [x] goods-service `Controller/Merchant/GoodsController.php`:商品 列表/详情/新增/改/提交审核/上下架(强制主体范围)

### 网关(deploy/openresty/conf.d/mtrip.conf)
- [x] `map $merchant_module $merchant_upstream`:auth/account/role/store→merchant_service、order→order_service、goods→goods_service
- [x] `location ~ ^/api/v1/merchant/(?<merchant_module>[a-z-]+)(/|$)`:CORS/限流/`proxy_pass http://$merchant_upstream`

### 前端-merchant-web 骨架
- [x] 工程配置:`package.json`(mtrip-merchant-web)、`vite.config.ts`(port 5174)、`tsconfig*.json`、`index.html`、`.env.*`(`VITE_APP_TITLE=商家中心`)
- [x] 入口/路由/store/utils:`main.ts`、`App.vue`、`router/{index,guard,dynamic}.ts`、`stores/{index,user,app,tabs}.ts`、`utils/{http,auth,crypto,format}.ts`、`directives/perm.ts`
- [x] i18n/组件/布局:`locales/{index,zh-CN,en-US,menuI18n}.ts`、`components/{PageContainer,StatusTag,AmountText}.vue`、`composables/useTable.ts`、`layouts/{BasicLayout,AppHeader,SideMenu,TabsView}.vue`
- [x] 基础页:`views/{login,error/403,error/404,wip,dashboard}`
- [x] 改造点:localStorage 键 `mtrip_merchant_*`;api 前缀 `/merchant/*`;去平台站点树切换器改展示当前主体;`stores/user` 的 isSuper 语义换为 isOwner

### 前端-merchant-web 首批业务页(views/)
- [x] `account/index.vue`:子账号 列表/增改/启停/重置密码 + 赋角色(`mch:account:*`、`mch:role:grant`)
- [x] `role/index.vue`:角色 CRUD + 菜单授权树(`mch:role:add/edit/delete/assign`)
- [x] `store/index.vue`:门店 列表/详情/编辑/设主/启停(`mch:store:*`)
- [x] `order/index.vue`:订单 列表/详情/核销(`mch:order:verify`)
- [x] `goods/index.vue`:商品 列表/增改/提交审核/上下架(`mch:goods:*`)
- [x] `api/{account,role,store,order,goods}.ts`:对接各服务 `/merchant/*` 端点

## 验证
- [x] 后端 `php -l` 全量语法检查(PowerShell `ForEach-Object`):新增/改动文件 0 报错
- [x] 前端 `vue-tsc --noEmit` 类型检查:通过(EXIT=0)

## 2026-08-14 布局原型化改造(侧边栏 + 顶部菜单)

> 按 Figma 原型(big-plank-58319748.figma.site,Hotel Merchant Dashboard)重构主界面框架,与 admin-web 的 redesign 方向对齐;内容区业务页未动。

### 关键决策
- 移除多页签 TabsView(含 keep-alive),直接渲染当前路由;`stores/tabs.ts`、`layouts/components/TabsView.vue` 已删除,`router/guard.ts` 页签逻辑同步移除(与 admin-web 已撤页签的状态一致)
- 移除暗色模式与语言切换 UI(stores/app.ts 仅留 locale 持久化);App.vue 固定 defaultAlgorithm
- 侧边栏物业切换器(Property Switcher)照搬原型假数据:All Properties(Portfolio view)+ HOTELS 分组(The Horizon Resort/Blue Lagoon Boutique/Cityview Business Hotel)+ RESTAURANTS 分组(The Terrace Kitchen/Horizon Rooftop Dining)+ 底部 Add New Property;选中项浅蓝底+蓝色细边框高亮,选中后切换器显示对应物业;不接真实数据。菜单内容仍由后端动态菜单树驱动

### 落地文件
- `layouts/BasicLayout.vue`:flex 全高布局;228px 白底侧边栏(Logo mTrip/Merchant → 主体切换器 → 可滚动菜单 → 底部 Logout),右侧 56px Header + router-view
- `layouts/components/SideMenu.vue`:浅色分组菜单(大写分组标题 11px/600;菜单项 13px/500 圆角 8px;选中态 #EFF6FF+#2563EB;hover #F1F5F9;子项圆点指示器)
- `layouts/components/AppHeader.vue`:面包屑(mTrip › 当前页,resolveMenuTitle 解析)+ 176px 搜索框(视觉占位)+ 通知铃铛(红点占位)+ 蓝底圆头像用户下拉(保留改密/登出)
- 全局配色/字体对齐原型:主色 #2563EB、页面背景 #F4F6FB、边框 #E2E8F0、slate 文字层级;字体 Plus Jakarta Sans(index.html Google Fonts + theme.ts fontFamily);antd token borderRadius 8
- i18n:新增 header.searchPlaceholder/notifications;清理 tabs.*、app.language/darkTheme/lightTheme
- `components/PageContainer.vue` min-height 重算(去 tabs 40px,header 48→56)

### 验证
- [x] `vue-tsc --noEmit` 通过(EXIT=0)
- [x] dev server 启动正常(端口 5176);界面效果由用户自行验收
- 测试账号:m000001 密码已重置为 `Mtrip@2026`(原随机密码无人持有,直接 UPDATE bcrypt 落库)

## 升级说明
- 存量库依次执行 `database/merchant/05-merchant-rbac.sql` 与 `database/seed/04-merchant-menu.sql`(均幂等)。
- 后端 shared/merchant-service/order-service/goods-service 改动需重建对应 service 容器生效;网关改 `mtrip.conf` 后 reload OpenResty。
- merchant-web 首次运行需 `npm install`,开发端口 5174,经同一网关新增 `/api/v1/merchant` 前缀访问;生产二级域名/路径由运维决定,本轮只保证网关路由可达。

## 2026-08-23 全模块样式同步与入口补齐

> 用户明确:后续不只做 M5,需对 M2/M3/M5/M6/M8/M9/M10 一并检查;第一步先同步样式,优先 CSS 覆盖复用原有组件,缺失组件再实现。

### 落地文件
- `merchant-web/src/main.ts`:调整样式加载顺序,让项目覆盖层在 antd reset 后生效。
- `merchant-web/src/styles/index.less`:新增全局 antd 覆盖层,统一卡片/表单/按钮/表格/分页/Tag/Modal/Drawer 到 Hotel Merchant Dashboard 原型口径(白卡片、12px 圆角、`#E2E8F0` 边框、`#F8FAFC` 表头/筛选底、`#2563EB` 主按钮)。
- `merchant-web/src/components/PageContainer.vue`:页面留白调整为 `24px 28px`,背景保留 `#F4F6FB` 并加轻微蓝色氛围层。
- `database/seed/04-merchant-menu.sql`:补齐 PRD 待办模块入口:M2 客房管理、M3 房量与价格、M5 收益结算、M6 通知中心/设置、M8 营销活动、M9 评价管理、M10 帮助中心。组件尚未实现时按 `router/dynamic.ts` 回退 `views/wip/index.vue`。
- `merchant-web/src/locales/{zh-CN,en-US}.ts` 与 `menuI18n.ts`:补齐新增菜单词条与 WIP 提示。
- 新增专项文档:`docs/plans/实现方案-Merchant-全模块差距与样式同步.md`。

### 验证
- [x] `cd merchant-web && npm run build` 通过(EXIT=0;仅保留原 Vite chunk 体积警告)。

## 未尽事项(后续批次)
- 供应商端(supplier-web / supplier_admin)仍为占位,未在本轮。
- 商品新增表单为最小可用集(类型/名称/分类/供应商/封面/简介),SKU/退改规则等富字段沿用平台侧或后续补齐。
- 精细报表/导出、工作台真实统计接入留后续批次。

## 2026-08-23 M5/M6/M9/M10 首轮补齐

> 在全局样式同步后继续按用户要求推进"不只 M5"的增量:优先复用既有 antd/公共 CSS,缺失能力再补轻量组件与后端接口。

### 后端与数据库
- order-service 新增 `App\Controller\Merchant\StatsController`,路由 `/api/v1/merchant/stats/dashboard`,返回经营看板 KPI、趋势、物业表现、今日运营;商户范围统一用 `MerchantContext::scopeMerchantIds()`。
- finance-service 新增 `App\Controller\Merchant\EarningsController`,路由 `/api/v1/merchant/earnings/*`,支持收益总览、结算单列表/详情、商户申诉(`mch:earnings:dispute`)。
- merchant-service 新增 `App\Controller\Merchant\NotificationController`,路由 `/api/v1/merchant/notifications/*`,支持通知列表/统计/标记已读(`mch:notifications:read`)。
- goods-service 新增 `App\Controller\Merchant\ReviewController`,路由 `/api/v1/merchant/reviews/*`,支持评价列表/统计/回复(`mch:reviews:reply`)/标记平台复核(`mch:reviews:flag`),通过 `goods_info.merchant_id` 裁剪范围。
- 数据库补 `merchant_notify.read_at/read_by` 与 `goods_review.merchant_flag_*` 字段;新增 `database/merchant/22-merchant-web-notify-read.sql`、`database/goods/05-merchant-review-flag.sql` 并登记 `deploy/docker-compose.yml` initdb。

### 网关与前端
- `deploy/openresty/conf.d/mtrip.conf` 已在 `map $merchant_module` 登记 `stats`、`earnings`、`notifications`、`reviews` 上游。
- 前端新增 `api/{stats,earnings,notifications,reviews}.ts` 与 `views/{earnings,notifications,reviews,settings,support}/index.vue`;Header 铃铛接通知未读数并跳转 `/notifications`。
- M5 dashboard/earnings、M6 notifications/settings、M9 reviews、M10 support 文案均接入 `vue-i18n`;按钮权限与 `04-merchant-menu.sql` 对齐。

### 验证
- [x] `D:\BtSoft\php\81\php.exe -l` 检查新增/修改后端控制器与路由通过。
- [x] `cd merchant-web; npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告)。

## 2026-08-23 M8 营销活动首轮补齐

> 继 M5/M6/M9/M10 后,继续按“前后端一起开发、SQL 差异补脚本、公共 CSS 覆盖优先”的策略补齐 Merchant App PRD Module 8。

### 后端与数据库
- marketing-service 新增 `App\Controller\Merchant\PromotionController`,路由 `/api/v1/merchant/promotions/*`,支持 `summary/list/detail/add/update/publish/toggle-status/delete`。
- 写接口权限键为 `mch:promotions:add`、`mch:promotions:edit`、`mch:promotions:status`、`mch:promotions:delete`,已同步 `database/seed/04-merchant-menu.sql` 按钮种子。
- 商家活动复用 `marketing_coupon`,新增 `merchant_id` 与 `created_by_merchant_admin`;全新库已改 `database/marketing/01-marketing.sql`,存量库新增幂等迁移 `database/marketing/07-merchant-promotion-owner.sql`,并登记 `deploy/docker-compose.yml` initdb。
- 首轮强制 `goods_scope=3` 并校验所有 `goodsIds` 属于当前 `MerchantContext::scopeMerchantIds()` 范围,避免商家出资优惠影响其他商家。
- `deploy/openresty/conf.d/mtrip.conf` 已登记 `promotions -> marketing_service`;dashboard 的 `activePromotionCount` 已由占位改为读取当前有效商家活动。

### 前端
- 新增 `merchant-web/src/api/promotions.ts` 与 `merchant-web/src/views/promotions/index.vue`。
- 页面复用 antd + 公共 CSS 覆盖层,按 Hotel Merchant Dashboard PromotionsScreen 口径实现深蓝焦点卡、统计卡、筛选、表格、新建/编辑弹窗、发布/停发/删除操作。
- 适用商品复用既有 `apiGoodsList`,集团账号前端限制一个活动只选择同一商家的商品;按钮均使用 `v-perm` 对齐权限键。
- `merchant-web/src/locales/{zh-CN,en-US}.ts` 已补齐 M8 页面文案,无硬编码业务文案。

### 验证
- [x] `D:\BtSoft\php\81\php.exe -l` 检查 marketing-service 新控制器/路由与 order-service StatsController 通过。
- [x] `cd merchant-web; npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告)。

## 2026-08-23 M2/M3 客房与房量价格首轮补齐

> 按用户要求继续推进非 M5 模块,并强调“界面一定要跟原型一样”:本轮优先复用 antd + 公共 CSS 覆盖,只在页面级补缺失结构。

### 设计差距与方案
- 新增专项文档 `docs/plans/实现方案-Merchant-M2M3-客房与房量价格.md`,记录 RoomsScreen / AvailabilityScreen 与现有 merchant-web 的差距、接口契约、字段补齐、权限位、网关和 initdb 清单。
- M2 复用 `hotel_room_type` 作为房型子实体,补足房型编码、描述、成人/儿童容量、床数量、楼层、景观、吸烟、餐食/取消政策、周末价、加床价、首发库存、视频、发布流程状态等字段。
- M3 复用 `goods_daily_stock` 作为房量价格日历,补足最少/最多入住、CTA/CTD、库存来源、备注字段。

### 后端、数据库与网关
- goods-service 新增 `App\Controller\Merchant\RoomController`,路由 `/api/v1/merchant/rooms/*`,支持酒店选项、房型列表/详情、保存、上下架、删除;写接口权限 `mch:rooms:add/edit/status/delete` 已对齐菜单种子。
- goods-service 新增 `App\Controller\Merchant\AvailabilityController`,路由 `/api/v1/merchant/availability/*`,支持房型树、日历查询、单日保存、批量更新、变更日志、同步占位;写接口权限 `mch:availability:edit/bulk-update/sync` 已对齐菜单种子。
- `deploy/openresty/conf.d/mtrip.conf` 已登记 `rooms -> goods_service`、`availability -> goods_service`。
- `database/goods/01-goods.sql` 已覆盖新增字段;存量库幂等迁移 `database/goods/06-merchant-room-availability-fields.sql` 已新增并登记 `deploy/docker-compose.yml` initdb。

### 前端
- 新增 `merchant-web/src/api/rooms.ts`、`merchant-web/src/views/rooms/index.vue`:按原型实现酒店筛选、页面标题、搜索/状态筛选、房型表格、设施胶囊、封面占位、全页 Create/Edit Room Type 表单、媒体占位格、发布流程提示、固定底部动作条。
- 新增 `merchant-web/src/api/availability.ts`、`merchant-web/src/views/availability/index.vue`:按原型实现工具栏、PMS/CM 同步状态、图例、可横向滚动日历网格、单日编辑抽屉、Pricing Rules / Active Alerts 面板、Bulk Update 弹窗。
- `merchant-web/src/locales/{zh-CN,en-US}.ts` 补齐 `rooms.*` 与 `availability.*` 文案;新增按钮均使用 `v-perm`。

### 验证
- [x] `D:\BtSoft\php\81\php.exe -l` 检查新增 RoomController / AvailabilityController / routes.php 通过。
- [x] `cd merchant-web; npm run build` 通过(EXIT=0;仅 Vite chunk 体积警告)。

## 2026-09-01 M2 房型列表、新增房型与完整审核流程

### 交付范围
- 房型列表保留酒店、关键词、审核状态筛选，展示销售状态、审核状态、驳回原因，并提供详情、编辑、复制、上下架、删除/申请下架操作。
- 新增与编辑房型采用独立页面 `/rooms/create`、`/rooms/:id/edit`，不是弹窗；表单覆盖基础资料、床型与人数、设施、真实图片/视频上传、定价、库存、政策及草稿/提交审核动作。
- 新增 `/rooms/:id` 详情页，同时展示当前生效版本、待审核/草稿版本、审核历史及驳回原因。
- 新增 `hotel_room_type_revision` 版本表及房型审核服务。草稿、提交、驳回、重新提交、撤回、复制、下架申请和管理员通过/驳回均有版本记录；已生效房型在新版本获批前保持不变。
- admin-web 商品审核页新增“房型审核”队列、版本差异、媒体预览与通过/驳回动作，沿用 `goods:audit:audit` 权限。
- C 端/市场读取只返回 `publish_status=2` 的已批准房型；既有已上架酒店房型由幂等迁移回填为生效版本。

### 数据与部署
- 新增幂等迁移 `database/goods/07-room-review-workflow.sql`，并同步基线 `database/goods/01-goods.sql` 与 Docker initdb 登记。
- goods-service 增加 `/uploads` 共享卷；merchant-web Vite 代理补齐 `/uploads`，媒体上传由 goods-service 校验类型、大小和图片分辨率。

### 验证
- [x] 房型审核服务回归 6 项通过：新建隔离、驳回、重新提交、批准发布、待审更新不覆盖线上、再次驳回保留线上版本。
- [x] 真实网关 HTTP 链路通过：图片 multipart 上传 → 商户提交 → 管理员队列/详情/通过 → 商户更新 → 管理员驳回 → 商户详情核对线上版本与驳回原因；临时业务数据与上传文件已清理。
- [x] `scripts/check.ps1` 通过：325 个 PHP 文件语法检查、shared 58 用例/858 断言、admin-web 构建、client 类型检查全部成功。
- [x] merchant-web `vue-tsc --noEmit && vite build` 与 admin-web production build 通过；仅有项目既有 Vite 大 chunk 提示，无新增 TypeScript 或构建警告。
- [x] 修复开发服务器仅监听 IPv6 导致 `127.0.0.1:5174` 白屏：Vite 明确监听 `0.0.0.0`，重启后 IPv4 与 `localhost` 的 `/rooms`、`/src/main.ts` 均返回 200。
- [x] 开发环境将 `localhost:5174` 规范化跳转到 `127.0.0.1:5174` 并保留路径、查询参数和 Hash，避免两个 Origin 的 `localStorage` 登录 Token 不共享而误跳登录页；生产环境不受影响。
- [x] 修复房型媒体上传文件权限：`UploadedFile::moveTo()` 生成的文件原为 `600`，OpenResty 无权读取并返回 403；保存后统一调整为 `0644`，存量房型图片已同步修复。真实新上传回归已验证网关公开读取返回 `200 image/*`。

### Git 记录
- 用户已授权将本节 M2 房型管理、审核流程、开发入口与图片显示修复做一次本地提交，不推送。
- 明确排除项目根目录 `start.bat`、`stop.bat`、`设计文档/` 下新增文件及与本任务无关的 OpenResty DNS 配置改动；实际提交哈希见 Git 日志。

---

## 2026-09-21 Availability & Pricing 按 Figma `1163:16345` 整页重写

### 设计源
Figma file `fsK2rrl2sadcowrxspvGV8`（mTrip_Merchant）SECTION `1163:16345`
「Availability & Pricing / Normal Edit / Bulk Update」。**4 个画板 = 同一页的 2 种模式**：

| 画板 | 节点 |
|---|---|
| Normal Edit（月历，默认） | `1153:15457` |
| Normal Edit + Edit Panel | `1225:14495` |
| Bulk Update（房型 × 日期网格） | `1170:23485` |
| Bulk Update + Edit Panel | `1170:24672` |

组件帧：`calendar-popover` `1163:16291`（月份浮层）、`room-type-dropdown-panel` `1163:16331`、
Edit Panel component set `1145:10347`（Normal）/ `1163:17357`（Bulk）。

数据经 **Figma MCP** `get_figma_data` 逐节点取回，规格落档 `.figma-cache/1163-16345.md`
（gitignored），整帧渲染图在 `~/Documents/FigmaImages/mtrip/availability-1163-16345/`。

### 用户确认的取舍
1. **完整照稿重写两种模式**，替换现有「房型 × 日期表格 + 单格抽屉 + 批量弹窗」。
2. 稿面没画的块**全部移除**。
3. 币种**只读展示**（取房型自带 `currency`），不做可切换下拉。

### 实现
- 页面壳 `views/availability/index.vue`：H1 + 副标题 + 工具栏卡 + `workspace`（主区 `fill` + 380 宽面板）。
- 新增组件 `views/availability/components/`：
  `AvIcon.vue`（内联 lucide 线性图标，稿面图标与 antd 不同形）、
  `CalendarGrid.vue`（月历 + 图例）、`BulkGrid.vue`（房型 × 日期多选网格 + 图例）、
  `EditPanel.vue`（两模式共用，仅标题/头部徽标不同）、
  `MonthNavigator.vue`（月份步进 + 年份/月份浮层）、`RoomTypeSelect.vue`（自绘下拉）。
- 新增 `helpers.ts`（`cellState` 四态判定与后端 `summary()` 同阈值、`priceShort` 复刻稿面 `85K` 写法）、
  `useDismiss.ts`（点击外部/Esc 关闭自绘浮层）、`tokens.less`（本页设计令牌）。
- **本页主色是稿面 `#4169ED`，不是全局 `--mtrip-primary` `#2563eb`**，故独立成令牌组并注释说明。
- `merchant-web/index.html`：Plus Jakarta Sans 补 `800` 字重、增载 `Inter`（稿面混排两种字体）。
- **i18n**：`availability.*` 整块重写（en-US + zh-CN），旧键（sync/views/rules/alerts/drawer/hints/bulk.tabs 等）随 UI 一并删除。

### 删除项（稿面没有）
房型×日期表格、单日编辑抽屉、Bulk Update 弹窗、PMS/CM 同步状态条与 Sync Now 按钮、
Pricing Rules 面板、Active Alerts 面板、Calendar/List 视图切换。
⚠️ 权限键 `mch:availability:sync` 与后端 `sync-now` 接口**保留未删**，仅前端不再有入口。

### 后端改动（唯一一处）
`backend/services/goods-service/app/Controller/Merchant/AvailabilityController.php`：
`roomTree()` 增选 `r.currency`，房型数组返回 `currency`（空值回退 `THB`），供面板币种胶囊只读展示。
**无新接口、无新权限键、无菜单种子改动、无迁移。**

### 实现侧定的交互语义（稿面未表达）
1. 日历为**单选一个日期** —— Edit Panel 主组件的日期徽标原文是多状态叠加的占位串
   （`Sep 14, 2026 – Sep 15, 2026 - Sep 16, 2026 `），实例里只有单日。
2. 两种模式都**禁止选过去日期**（后端 `saveDay` / `batchSet` 本就拒绝，前端提前拦下避免报错弹窗）。
3. 批量保存按**房型分组 → 切连续日期区间 → 逐段调用既有 `batch-set`**，不新增接口
   （稿面的选中格是任意散点，而 `batch-set` 只接受 `[startDate, endDate]`）。
4. 单日保存把当日原有 `minStay / maxStay / closedToArrival / closedToDeparture` 原样回传 ——
   面板只编辑状态/房量/价格，不传会被后端按缺省值写成 0/1/30。
5. 批量日期区间上限 31 天（稿面样例 5 列）；超限前端收敛并提示。

### 照稿逐字但存疑
稿面副标题为 `Manage your restaurant's availability, operating hours, pricing options, and menu rates
visible to your customers.` —— 本页是酒店，`restaurant` / `menu rates` 疑似从餐饮模板复制。
按「严格照稿」逐字实现，i18n 键独立，改文案只需动一处。

### 未照抄并已说明理由
1. **币种下拉改只读胶囊且去掉 chevron** —— 后端 `saveDay` / `batchSet` 只落 `price` 不接收 `currency`，
   做成可切换等于假控件（用户选定）。
2. **日历的 `Blocked` 态稿面没画**（只在图例与批量网格出现），采用批量网格同一套灰态：
   徽标 `Blocked`（底/描边 `#E2E8F0`、字 `rgba(25,26,37,.5)`）+ 价格 `-`。
3. **选中格的稿面 2px 主色描边**用「1px 边框 + 1px inset 阴影」实现，避免 2px 撑动网格布局。

### 验证
- [x] `cd merchant-web && npm run build`（`vue-tsc --noEmit && vite build`）零报错。
- [x] 新增 `merchant-web/scripts/check-availability-figma.mjs`：用 Vite SSR 打包 + `@vue/server-renderer`
      真实渲染 `CalendarGrid` / `BulkGrid` / `EditPanel`（带覆盖四态的样本数据），断言四态样式类、
      `Avail: 5` / `MMK 85K` / `1 Left!` / `Sold Out` / `Blocked` / `-`、选中与勾选徽标、图例四项、
      面板三字段与两种标题/徽标，另断言编译产物 CSS 与 `tokens.less` 的稿面令牌 —— **72/72 GREEN**。
      ⚠️ 该脚本**未接进 `scripts/check.ps1`**，需手动跑。
- [x] 容器内 `docker exec mtrip-goods-service-1 php -l app/Controller/Merchant/AvailabilityController.php`
      通过（本机未装 php，`scripts/check.ps1` 第 1 步即断，与本次改动无关）；`goods-service` 已热重启。
- [x] dev server 下 7 个新增/改动模块（页面 + 6 组件 + `tokens.less`）全部 HTTP 200。
- [x] 开发库 `mtrip_business.hotel_room_type` 物业 7 两个房型 `currency='MMK'`，与稿面样例一致。

### 走查修复：Select Period 右侧箭头渲染成斜杠（用户截图报告）
`AvIcon.vue` 的 `chevron-right` 写成了 `m9 18 6-6-6 6`——**末段 `-6 6` 把折线原路画回去了**，
于是只渲染出一条斜杠（`chevron-left` 写的是 `m15 18-6-6 6-6`，是对的，所以左边正常）。
已改为 lucide 原值 `m9 18 6-6-6-6`；同时把 `edit`（square-pen）与 `check-circle`（circle-check-big）
补成 lucide 精确值（原先手写取整到 1 位小数，14px 下无可见差异但不必要地偏离源）。
**防回归**：校验脚本新增 15 条图标断言（12 条「与 lucide 路径逐字一致」+ 3 条 chevron 几何自检
「三顶点互不重合」——后者与写法无关，专门抓「折回」这一类错误）。
红→绿留痕：把路径改回 `-6 6` 重跑得 **RED 70/72**（`points=[[9,18],[15,12],[9,18]]`，首末点重合），
修复后 **GREEN 72/72**。

### 未做 / 受限
- ⚠️ **没有登录态浏览器走查**：本环境无浏览器自动化工具，开发库也没有已知密码的商户账号，
  因此 `calendar` 响应新增的 `currency` **未做端到端实测**，仅三重旁证（容器内 lint + 纯增选列 +
  库内确有该字段）。需要一次人工对图验收。
- ⚠️ 新校验脚本未接进质量基线入口。

## 2026-09-21 M8 促销与活动管理按 Figma 整页重写 + 三块新增

设计源:Figma `fsK2rrl2sadcowrxspvGV8` SECTION `2285:21516`「Promotion tables」（6 画板 =
同一页的 2 种呈现 + 1 个抽屉）。用户确认三项取舍:做全功能需求、按稿整体重写、曝光走真实埋点。

**前端**（与同日 availability 页同一做法:整页壳 + 子组件 + 页面级 `tokens.less`）
- `views/promotions/index.vue` 重写为页面壳:H1「Promotion Tables」+ 副标题 + `Add New Promotion`
  + 统计卡（Percentage / Fixed Amount / Coupon Code / Long Stay，点击切 Tab）
  + Tab 条（58 高、选中态 4px 主色下划线）+ 内容区（Percentage/Fixed/Long Stay 卡片网格、
  Coupon Code 表格）+ 新建/编辑抽屉。
- 新增 `components/{PromoIcon,StatCards,PromoGrid,PromoCard,PromoTable,PromoDrawer}.vue`、
  `tokens.less`（本页主色 `#4169ED`，非全局 `#2563eb`）、`helpers.ts`（形态判定 / 折扣文案 /
  状态徽标 / 进度 / 表单↔载荷，全部纯函数）。
- 新增 `views/promotions/analytics/index.vue`（效果分析:7 张指标卡 + 趋势图 + 逐券明细表）与
  `views/campaigns/{index.vue,components/*}`（平台活动:概览卡 + 筛选 + 活动卡 + 详情抽屉，
  含资格/出资/条款与接受/拒绝邀请）。
- `api/promotions.ts` 重写（+options/performance/duplicate）、新增 `api/campaigns.ts`。
- **删除**（稿面没画）:聚光灯卡、筛选表单卡、antd 表格 + a-modal 表单、`create` 按钮的 `New Promotion` 文案。
- i18n:`promotions.*` 整块重写、新增 `promotions.performance.*` / `promotions.drawer.*` /
  `campaigns.*` / `menu.promotionPerformance` / `menu.campaigns`（en-US 全量，zh-CN 同步）。
- `SideMenu.vue` 的 `business` 分组新增 `/promotions/analytics`、`/campaigns`。

**后端**
- `Merchant/PromotionController` 扩展:`options` / `performance` / `duplicate` 三个新接口，
  新增 7 个字段的读写与校验，kind=3 同步 `marketing_promo_code` 镜像（让 C 端券码真能兑换）。
- 新增 `Merchant/CampaignController`:`summary` / `list` / `detail` / `respond`。
- `App/MarketingController::impression`（新）:C 端曝光上报，`insertOrIgnore` + `increment` 按日累加。
- `Admin/CampaignController::save` 接收 `fundingSource/fundingRules/requirements/terms/inviteMode`。
- 网关 `map $merchant_module` 新增 `campaigns marketing_service`。

**数据库**
- `database/marketing/09-merchant-promotion-rules.sql`（幂等，已登记 initdb `99m1-`）:
  `marketing_coupon` 补 `promotion_kind`/`promo_code`/`description`/`staff_note`/`min_nights`/`max_nights`/`book_advance_days`；
  `marketing_campaign` 补 5 列入资与条款；新增 `marketing_campaign_participant`、`marketing_promotion_impression`。
- `database/seed/04-merchant-menu.sql` 补菜单 1005/1006 与按钮 100005/100601；
  存量库走 `database/migrations/V20260921120000__merchant-promotion-campaign-menu.sql`。
- 01/04 快照同步补列，保证全新库自洽。

**关键结论（返工点）**
- `coupon_type` 是**计价轴**（`coupon_type=2` 的 `discount_value` 是 10 分制折扣率），
  稿面三个 Tab 是**展示轴**，两者维度不同，故另立 `promotion_kind`，换算收口在后端
  `discountPair()`；返回行带 `discount_percent_off`，前端不重复换算。计价与结算链路零改动。
- `finance_account_entry.coupon_id` 存的是**领券记录 ID 而不是券模板 ID**，
  效果分析的收益/出资必须经 `marketing_coupon_receive` 换算模板维度，否则恒为 0。

**验证**
- `merchant-web npm run build` 零 TS 报错；`client-app npm run typecheck` 零报错。
- 新增 `merchant-web/scripts/check-promotions-figma.mjs`:**真实 SSR 渲染** 6 个展示组件 +
  3 个页面壳，断言稿面硬值（Tab 名、统计卡、表格 6 列表头与 5 行样例、卡片 Target/Validity、
  抽屉字段、状态徽标、30 枚断言集 path 逐字、`#4169ED`/`#22C55E`/`#EC1317`/`562px`/`172px`/`58px`）
  + `helpers.ts` 纯函数行为，**199/199 GREEN**。
- 容器内 `php -l` 全部通过；迁移与菜单脚本重复执行幂等；网关新模块返回 401 而非 404。
- 埋点 upsert 语义实测:同日同来源 2 次上报（3+2）→ 1 行累计 5。
- 演示数据 `test/adhoc/m8-promotion-demo.sql` 下效果分析 SQL 手算:曝光 28,356 / 领券 108 /
  核销 54 / 收益 1,235,000 MMK / 商户出资 310,550 / ROI 3.98。

**未做 / 受限**
- 无登录态浏览器走查（本环境无浏览器自动化、开发库无已知密码的商户账号），未做端到端实测。
- admin-web 的活动出资/资格/条款表单未做（后端已接收入参）。
- 新校验脚本未接进 `scripts/check.ps1`（该入口本机因未装 PHP 本就跑不了）。
