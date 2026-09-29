# 17-商户移动端 merchant-app

> 独立计划文件。商户移动端不并入既有 `client-app` 模块 10，目录为 `merchant-app/`，技术栈和工程习惯参考 `client-app`。

## 目标

按 `PRD/mTrip_Merchant App PRD_v1.0.docx` 和 Figma `mTrip_Merchant` 原型落地商户移动端：先完成全部设计页面，再按页面业务与 PRD 逐步接入 `/api/v1/merchant/*`、商品/订单/营销/财务等商户口径 API。

## 后端联动（2026-09-09，进行中）

- 新增公开移动端注册 OTP 接口：`GET /api/v1/app/merchant/register/config`、`POST /register/otp-send`、`POST /register/otp-verify`；站点从 `X-Site-Id` 强制取得。
- 网关 App 路由表及独立实例池已补 `merchant -> merchant-service-app`，移动端请求不会落到管理端主池。
- 注册页不再以固定数据决定验证方式：后端只返回当前站点已启用的 `email` / `sms` 渠道，用户二选一；验证成功返回 24 小时的签名 registration token。
- 新增站点级 SMTP 渠道配置、AES 加密的账号密码和不含验证码正文的投递日志。生产增量为 `database/migrations/V20260909123000__add-email-channel.sql`。
- 尚未接入 App：申请保存/提交、后台 Send KYC 后才可上传的 KYC 接口、Access Code、首次扫码 2FA 绑定与生物识别；原型页面仍保持本地演示，后续按状态机逐段替换。

### M3-M8 后端完成（2026-09-10）

- 新增 `V20260910094500__add-merchant-application-registration-owner.sql`，为申请保存经 OTP 验证的渠道和收件人哈希；不会在申请表保存原始 OTP 或 registration token。
- `MerchantAppOnboardingService` 已实现草稿保存、正式提交、状态查询、KYC 要求、单文件上传与 KYC 提交；每次读取或写入均验证 registration token 与申请所属关系。
- 后台未 Send KYC 前（非 `stage=3`）服务端拒绝上传和提交。KYC 提交只校验模板中的必需文件，非必需文件不会阻塞；提交后进 `stage=4`，不能继续覆盖文件。
- merchant-app 页面尚未改为调用 M0-M8；下一步为将原型本地 state 替换成上述 API，再实施 M9-M12。

### M0-M4 App 接入（2026-09-10）

- 注册 Step 1/2 保存公司和首个业务联系人；Step 3 从 M0 读取站点真实启用的 SMS/Email 渠道，取消固定收件人。
- Step 4 真正调用 OTP 发送/校验；校验成功后自动执行 M3 草稿保存和 M4 正式提交，审核页不再用定时器伪造“已批准”。
- KYC M5-M7 的前端文件选择和上传仍待接入，当前 KYC 页面不应视为真实上传。

## PRD 范围摘录

- 入驻与认证：Become Our Partner、注册表单、OTP、KYC 资料、状态查询、驳回重交、审批后 Merchant Access Code、强制 Authenticator 2FA、可选本机生物识别。
- 物业与房型：多物业/多业态入口，酒店资料、房型、设施、图片、价格、库存、政策、草稿/提交/审核状态。
- 房量房价：日历/列表、开关售、库存、基础/日期/周末/季节价、最小/最大入住、CTA/CTD、PMS/Channel Manager 同步状态与失败提醒。
- 预订管理：列表、搜索筛选、详情、客人信息、支付摘要、确认/入住/退房/取消/No-show、内部备注、时间线、同步状态。
- 经营与结算：Dashboard KPI、收入、入住率、ADR、佣金、单笔结算、结算历史、导出与申诉入口。
- 通知/设置/RBAC/营销/评价/帮助中心：通知分类与已读、2FA/设备/语言设置、员工角色权限、促销活动、评价回复、工单/FAQ/住客消息。

## 技术和目录约定

### 状态栏规范

- Figma 画布中的 iPhone 状态栏(时间、信号、电池、深浅色外观)仅作为设计稿环境说明,merchant-app 页面代码一律**不手绘**这些元素。
- 页面只通过 `expo-status-bar` 设置系统状态栏透明和图标深浅色；布局使用 `SafeAreaView` 让开真实设备安全区。
- 后续所有 Figma 页面实现前,先忽略/移除导出代码中的 `Status bar - iPhone` / `StatusBarIPhone` 节点。


- 技术栈：Expo 51 + React Native 0.74 + TypeScript + React Navigation + Zustand + axios + i18next，依赖版本对齐 `client-app`。
- API：默认基地址 `EXPO_PUBLIC_API_BASE_URL`，商户端请求统一拼接 `/api/v1/merchant`；登录先拿 `challengeToken`，再走 `/auth/2fa/setup|verify` 取得商户 JWT。
- 存储：AsyncStorage key 使用 `mtrip:merchant:*` 前缀，避免与 C 端 `client-app` 登录态串用。
- 样式：不引入 Tailwind；Figma 导出只作为参考，页面转成 RN `StyleSheet`、复用 `src/config/theme.ts` 与 `src/config/typography.ts`。
- 图片/图标：Figma 资产下载到 `merchant-app/assets/images/...`，不长期依赖 7 天临时 URL。

## 当前阶段

| 阶段 | 内容 | 状态 | 说明 |
|---|---|---|---|
| 0 | 独立工程骨架 | [x] | 新增 `merchant-app/`，复用 client-app 技术栈、别名、i18n、请求层、store、Toast、web 样式补丁。 |
| 1 | 引导首屏 | [x] | 完成 Figma `839:5721`：主色顶部、logo、三条卖点、底部 Register / Log In。 |
| 2 | 登录与 2FA 骨架 | [~] | 已接 `/merchant/auth/login`、`/auth/2fa/setup`、`/auth/2fa/verify` 的数据流；视觉未按后续 Figma 逐屏精修。 |
| 3 | 注册 / OTP / KYC 页面 | [x] | 按 SECTION `2685:22241` 收敛为 Figma 的 5 步注册（Contact Info → Verify Account → Enter Code → Company Info → Business Details），KYC 文档页补齐 E-Signature 卡与 Terms & Conditions / E-Signature 弹窗；上传/提交已接 M5-M8 API。 |
| 4 | Dashboard 与业务 Tab | [ ] | 按 PRD 模块搭建 Dashboard、Booking、Availability、Rooms、More 等导航。 |
| 5 | 业务功能接 API | [ ] | 在页面全部完成后按模块接入 merchant/goods/order/finance/marketing API。 |

## 本次实现记录(2026-09-08)

- 新增 `merchant-app/package.json`、`app.json`、`tsconfig.json`、`babel.config.js`、`.env.example`、`.gitignore`。
- 新增 `src/api/request.ts` 与 `src/api/merchant.ts`，统一响应结构 `{code,message,data}`，成功返回 `data`，401 清本地登录态。
- 新增 `src/store/commonStore.ts`、`src/store/merchantStore.ts`、`src/store/index.ts`，启动时注入请求 hooks 与日志上下文。
- 新增 `src/screens/onboarding/OnboardingScreen.tsx`，按 Figma `839:5721` 实现首屏，使用本地下载的 logo 与三枚 SVG 图标。
- 新增 `src/screens/auth/LoginScreen.tsx`、`RegisterScreen.tsx`、`src/screens/dashboard/DashboardScreen.tsx` 作为路由和后续页面承接。
- 验证：`npm run typecheck --prefix merchant-app` 通过；`npm run build:web --prefix merchant-app` 通过，验证后已删除 `merchant-app/dist`。

## 本次实现记录(2026-09-08 注册 Step 1 页面)

- 明确并落地状态栏规范：删除 `OnboardingScreen` 手绘时间/信号/电池状态栏；后续页面只使用系统透明状态栏和 `SafeAreaView`。
- 实现 Figma `839:6106` 注册 Step 1 Company Info：返回区、Step 1/4、25% 进度条、标题说明、业务数量选择框、公司/集团名称输入框、底部 disabled Next。
- 下载注册页 Figma 图标到 `assets/images/register/back.svg` 与 `assets/images/register/chevron-down.svg`；运行时代码用 `Svg + Path` 渲染,避免 Expo Web 的 `SvgXml` 兼容问题。
- 补齐 `register.*` i18n 三语言键。
- 验证：`npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过，构建产物已清理。
- 注意：`npm install --prefix merchant-app --ignore-scripts --prefer-offline` 已安装本地依赖，`node_modules/` 已加入 `.gitignore`。

## 2026-09-08 Web 运行警告修正

- 修复 `FeatureIcon.tsx` 在 Expo Web 下 `SvgXml` 为 `undefined` 导致的运行时报错；三枚图标改用 `Svg + Path` 渲染，path 数据逐字取自已下载的 Figma SVG 资产。
- Web 端标题阴影改用 `textShadow`，底板阴影改用 `boxShadow`；原生端继续使用 RN 的 `textShadow*` / `shadow*` 样式。
- 验证：`npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过，构建产物已清理。

## 2026-09-08 启动脚本修正

- 本地已进入 `merchant-app/` 目录时直接执行 `npm start` 或 `npm run dev`；不要再执行 `npm start --prefix merchant-app`，否则 npm 会寻找 `merchant-app/merchant-app/package.json`。
- 因本机访问 `https://api.expo.dev` 可能断开，默认 `start/android/ios/web/dev` 脚本已加 `--offline --port 8083`。Expo 51 中 `--offline` 与 `--localhost/--lan/--host` 互斥,因此脚本不再显式传 host 参数;如需联网 LAN 模式,去掉 `--offline` 后手动执行 Expo 命令。
- `npm run dev` 已补齐，当前等同 Web 调试：`expo start --web --offline --port 8083`。
- 验证：`npm run typecheck --prefix merchant-app` 通过。

## 本次实现记录(2026-09-08 注册 Step 2 页面)

- 实现 Figma `839:6159` 注册 Step 2 Business Details,继续遵守“不手绘手机状态栏”规范。
- 新增 `src/screens/auth/RegisterBusinessDetailsScreen.tsx`,包含 Back、Step 2/4、50% 进度条、Business Details 标题、两张 Business 详情卡、Terms/Privacy checkbox、底部 Submit。
- `RegisterScreen` 的 Next 现导航到 `RegisterBusinessDetails`;为方便按原型走页面流,按钮保留设计稿的 40% 淡色视觉但可点击。
- 注册 Step 2 的返回/下拉图标已下载到 `assets/images/register/back-step2.svg` 与 `chevron-down-step2.svg`;运行时代码继续用 `Svg + Path` 渲染。
- 补齐 `register.businessDetails.*` 三语言 i18n。
- 验证:`npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过,构建产物已清理。

## 本次实现记录(2026-09-09 入驻、KYC 与 2FA 原型流程)

- 新增 `src/screens/onboarding/MerchantFlowScreens.tsx`，实现 Figma `839:6107` 账号验证、`839:6133` OTP、`839:5984`/`839:6075` 注册审核状态与成功提醒；审核成功后可进入 KYC。
- 实现 Figma `839:6160`/`839:6192` KYC 文档状态：三份必传材料可模拟上传，全部完成前保持 Submit to Admin 禁用；随后展示本地模拟的审核中与 Figma `839:6044` 批准状态。
- 实现 Merchant Access Code 登录 `839:5779`、QR 扫描 `839:6224` 的 2 秒扫描线/边框动效、Authenticator 下载提示 `839:5844`、链接二维码 `839:5889`、验证码与完成弹窗 `839:5916`/`839:5941`，再进入生物识别选择 `1603:13873` 与 Figma `1591:13854` 的首页占位页。
- 补齐 10 个 Stack 路由，注册 Step 2 Submit 现连接到账号验证。文档上传、审批、OTP、扫码和生物识别目前均是可点击的本地原型状态，未伪造尚未确认的移动端入驻 API。
- 验证：`npm run typecheck --prefix merchant-app` 与 `npm run build:web --prefix merchant-app` 通过；构建产物已删除。

## 2026-09-10 统一 KYC 与真实上传联动

- 用户确认 KYC 不按 Business Type 分流。后台审核人员仅能发送申请级的 `Unified Merchant KYC` 清单；生产迁移 `V20260910110000__unify-merchant-kyc-template.sql` 幂等创建该可维护清单，历史分类模板只保留审计用途。
- `send-kyc` 不再接收模板、业务单元或业务类型参数；其创建 `biz_unit=''` 的申请级文档占位，并将申请置为 `stage=3`。App M5/M6/M7 同样只读取、上传和校验该统一清单，服务端继续强制 stage=3 门禁。
- merchant-app 已以 `expo-document-picker` 替换 KYC 点击模拟：管理员发送请求后，审核状态页轮询 M8 开放上传；资料页读取 M5、选择 PDF/JPG/PNG/WebP、以 multipart 调 M6，并只在所有必需资料上传后调用 M7。注册 Step 2 已删除 Business Type 字段。
- 验证：`npm run typecheck --prefix merchant-app`、`npm run build:web --prefix merchant-app`、`npm run build --prefix admin-web`、`bash scripts/db-migrate.sh --validate` 与 `git diff --check` 通过；Web 构建产物已清理。

## 2026-09-23 入驻流程按 Figma SECTION 2685:22241 对齐（静态界面收敛）

对照 Figma `mTrip_Merchant` SECTION `2685:22241`「Register & New Acc Login Flow」（22 屏）逐屏核对 merchant-app 现状，收敛为 5 步注册 + KYC 签署闭环。本轮只做界面与导航顺序，不新增业务逻辑。

- 新增 `src/screens/auth/RegisterContactScreen.tsx`（Step 1/5 Contact Info，Figma `2331:21717` / 组件 `2326:21552`）：`+95` 手机号 + 邮箱两个浮动标签字段，校验后写入注册草稿并进入渠道选择。
- 注册顺序改为 Figma 口径：`Onboarding → RegisterContact(1/5) → RegisterVerification(2/5) → RegisterOtp(3/5) → Register(4/5 Company Info) → RegisterBusinessDetails(5/5) → RegistrationReview`；进度条统一为 `current/total`（20/40/60/80/100%）。原顺序为 Company Info → Business Details → Verify → OTP 共 4 步且步数文案不一致。
- **唯一功能位移**：`apiApplicationSave` / `apiApplicationSubmit` 从 OTP 页移到 Business Details 的 Submit（重排后 OTP 阶段还没填公司信息，留在原处会提前提交空公司名）；OTP 页只保留验证并保存 registration token。
- 新增共用件 `src/components/onboarding/RegistrationForm.tsx`（`RegistrationScaffold` / `FloatingField` / `FieldInput` / `SelectField` / `PhoneField`），三个注册步骤页共用；`RegisterScreen` 与 `RegisterBusinessDetailsScreen` 因此删掉了各自重复的壳与图标（-530 / +379 行）。字段高度统一为 Figma 的 54，浮动标签统一 12px。
- Business Details 按 Figma 加回 `Business Type *` 下拉（Select Type 占位，静态只给 toast），并按稿移除原「I agree to Terms & Conditions and Privacy Policy」勾选行——Figma 该步骤没有勾选行，条款改由 KYC 阶段的 Terms & Conditions 弹窗承担。
- KYC 文档页（`KycDocumentsScreen`）对齐 `839:6160` / `839:6192`：页标题改 Outfit Bold 24、补「Upload required documents for **all 1 properties** to proceed.」段、告警盒换稿面文案、文档卡改稿面卡头（编号徽章 + Business N Documents + PDF/JPG/PNG）与虚线文档行（圆形图标 + REQUIRED 红标 + 上传按钮；已传态绿底 + 文件名 + 勾选徽章 + Replace 按钮）。
- 新增 `SignatureCard` / `TermsModal` / `SignatureModal`（`MerchantFlowComponents.tsx`）：KYC 页底部 E-Signature 卡（未签白卡 + Sign Now，签后转绿 + Signed），`Sign Now → Terms & Conditions 弹窗 → E-Signature 弹窗 → Confirm Signature`；签名框按「先做静态界面」只还原视觉，未实现手写绘制。Submit to Admin 现在额外要求 `signed`。
- Enter Code 页按稿把帮助行改为「刷新图标 + 4:58」与下划线 `Resend Code?`。
- i18n 三语言补 `register.contactInfo.*` 与 `register.businessDetails.{submitting,submitFailed,required,sessionExpired}`。
- **静态走查兜底**：`KycDocumentsScreen` 在接口未返回清单（无注册 token）时渲染 Figma 样张三份材料（Business Registration / Hotel Operating License / Owner ID / Passport），代码集中在 `FIGMA_SAMPLE_DOCUMENTS` 常量并标注接 API 后删除。
- **已知偏差（待后续决策）**：Figma 文档卡按业务分组（Business 1 / Business 2 Documents），后端已是申请级统一 KYC 清单（见 2026-09-10 记录），因此实现固定渲染 1 张卡（卡头文案 `Business 1 Documents`）；`PhoneField` 的 `+95` 国家码按稿为静态，未做区号选择。
- 验证：`npx tsc --noEmit` 通过，`npx expo export -p web` 通过（产物已删）；另用一次性 CDP 脚本以 390×844 设备视口对 5 个注册步骤页、KYC 文档页、Terms 弹窗、E-Signature 弹窗与签后绿卡逐屏截图核对，脚本与截图不留在仓库。
- 🐞 交付后走查报缺陷并已修：`Verify Account`（Step 2/5）与 `Enter Code`（Step 3/5）顶部的盾牌圆形图标**贴左未居中**。根因是 `IconBubble` 作为 `WhiteStepScaffold` 内容列（`whiteContent`，默认 `alignItems: stretch`）的直接子元素渲染，而 Figma 这两页的内容列 `EL-cace00dd` 是 `alignItems: center`；标题自带居中所以只有图标偏。已给 `MerchantFlowComponents` 的 `iconBubble` 加 `alignSelf: 'center'`（`IconBubble` 全仓只有这两处调用且都是稿面要求居中的 hero 图标，改一处两页同时生效）；`WhiteStepScaffold` 本身不动——KYC 文档页用的是 `EL-8c95bf53`（`alignItems: stretch`），全局居中反而会跑偏。复验：`tsc --noEmit` 与 `expo export -p web` 通过（产物已清理），CDP 390×844 截图确认两页图标居中。
- 🐞 同轮走查第二、三处缺陷并已修（均在 `RegisterVerificationScreen` 的渠道选项卡）：
  - **选中/未选中配色不切换**：原实现把图标底色写死按渠道类型区分（`icon === 'mail'` → teal light、SMS 恒为白底），与选中态无关，所以点选只换了卡片底色和描边，圆形图标框不动。对照 Figma 组件 `344:827`（选中）与 `344:856`（未选中）：**选中** = 卡片 teal light + Info Blue 2px 描边 / 图标底白 / 图标主色；**未选中** = 卡片白 + Slate 200 2px 描边 / 图标底 teal light / 图标 Slate 900。已改为按 `selected` 取 `optionIconSelected`（白底）/ `optionIconIdle`（teal light），并给 `SimpleIcon` 传 `selected ? colors.primary : colors.slate900`；删掉按渠道写死的 `optionIconMail`。
  - **默认渠道应为 SMS**：原 `useState<RegistrationChannel>('email')` 且拉到渠道后无条件 `setMethod(next[0])`，站点返回顺序里 email 在前就会默认选 Email。已改为初始 `'sms'`，并在拿到站点启用的渠道后 `setMethod((current) => (next.includes(current) ? current : next[0] ?? current))`——SMS 可用则保持 SMS，未启用 SMS 才回退到后端返回的第一个可用渠道（不写死成必然 SMS，避免站点禁用短信时选到不可用渠道）。
  - 复验：`tsc --noEmit` 与 `expo export -p web` 通过（产物已清理）；CDP 390×844 截图确认「默认进入 = SMS 选中 + Email 未选中（两卡配色相反）」与「点 Email 后配色对调」两个方向都正确。
- 🐞 同轮走查第四处问题（用户报「点 Send OTP 返回参数 phone 不能为空」）——**这是 App 与后端的真实契约不一致**，顺带按用户要求加了静态原型开关：
  - **根因**：`backend/services/merchant-service/app/Controller/App/Merchant/RegistrationController.php` 的 `sendOtp/verifyOtp` 要求 `phone`、`email`、`otpChannel`（verify 另要 `otpCode`）四个参数，且手机号与邮箱**都必须传**（服务端用两者哈希做联系方式一致性校验，见 `MerchantRegistrationOtpService::validateContacts/verify`）；而 App 发的是 `{ channel, recipient }`，`requireStr('phone')` 直接抛「phone 不能为空」。email 渠道同样会失败，属历史遗留、与本次改动无关。
  - **修真实契约**：`src/api/merchant.ts` 改为 `apiRegistrationOtpSend(phone, email, otpChannel)` / `apiRegistrationOtpVerify(phone, email, otpChannel, otpCode)`；`src/api/types.ts` 的 `RegistrationOtpResult` 补后端实际返回的 `testMode`、`RegistrationVerifyResult` 补 `applicationId`。真实链路下 Step 3 用草稿里的 `business.contactPhone` / `business.contactEmail` 一起提交。
  - **加静态原型开关**（用户要求「可以先跳过真实校验，我需要静态可操作」）：`src/config/env.ts` 新增 `ONBOARDING_PROTOTYPE`，由 `EXPO_PUBLIC_ONBOARDING_PROTOTYPE` 控制、默认 `true`（`.env` / `.env.example` 各加一行）。打开时注册 5 步与 KYC 页不调后端：Verify Account 不请求 `/register/config`、渠道列表为空时按稿面同时展示 SMS 与 Email、Send OTP 用本地联系方式（缺失则用稿面示例值）直接进 Step 3；Enter Code 任意 6 位即通过（不取 registration token）；Business Details Submit 校验必填后直接进审核页；审核页（注册与 KYC 两态）按「已通过」渲染保证按钮可点；KYC 文档行点击即本地标记为已上传（不打开文件选择器）、Submit to Admin 直接进 KYC 审核页。**关掉开关（`EXPO_PUBLIC_ONBOARDING_PROTOTYPE=false`）即为 100% 真实链路，没有任何静默回退**——刻意不做「失败即降级」，避免联调期把接口错误吞掉。
  - 复验：`tsc --noEmit` 与 `expo export -p web` 通过（产物已清理）；用 CDP 390×844 从引导首屏起**真点一遍**：`Onboarding → Register Now → Contact Info（填手机/邮箱）→ Verify Account → Send OTP（成功进入 Enter Code，副标题显示已填手机号）→ 填 6 位 → Verify & Continue → Company Info → Business Details（填联系人/手机/邮箱）→ Submit → 注册审核页 → Proceed to KYC Upload → KYC 文档页（三份资料点成已上传 + 签名 Signed）→ Submit to Admin（容器 opacity=1，可点）→ KYC 审核页`，全链路通过。
- 🐞 同轮走查第五处问题：`Enter Code`（注册 OTP，`TwoFaVerify` 共用同一组件）的 OTP 框里 `- - - - - -` 占位符**贴左未居中**。根因不是缺样式，而是 **`textAlign` 写在 prop 上、Web 端被静默丢弃**：`react-native-web/dist/exports/TextInput/index.js` 的 `forwardPropsList` 不含 `textAlign`，`pickProps()` 会把它过滤掉；而 RN 原生 `TextInput.d.ts` 里 `textAlign` 是合法 prop（所以 `tsc` 不报错），于是 iOS/Android 生效、Web 失效。已把 `textAlign: 'center'` 移入 `styles.otpInput`（style 两端都走 `text-align`）；同时把 `paddingHorizontal: 18` 拆成 `paddingRight: 18` + `paddingLeft: 26`，多出的 8px 用于抵消 `letterSpacing: 8` 给最后一个字符加的尾部字距造成的约 4px 左偏。复验：CDP 实测 `getComputedStyle(input).textAlign === 'center'`、输入框中心 195 = 390/2，截图确认**占位符与已输入数字（1 2 3 4 5 6）都居中**。**注意**：这是 RNW 的通用坑，后续任何 `<TextInput>`/`<Text>` 想居中都必须写 style 而不是 prop。
- 🔧 走查反馈「Number of Business 点击弹 Coming Soon，把提示取消掉」——按确认的方案把**三个下拉都做成可用选择**（用户选择：Number of Business 驱动 Step 5 卡片数；Business Type 与 Headquarters City 一并处理），不再有任何 Coming Soon 提示：
  - 新增 `src/components/onboarding/MerchantFlowComponents.tsx::SelectSheet`（通用底部选择面板：标题 + 当前项打勾 + Cancel + 超长可滚动），三个下拉共用。
  - 新增 `src/config/onboardingOptions.ts` 存放选项,**两项都不是臆造**:`ONBOARDING_BUSINESS_TYPES` 必须与后端 `MerchantAppOnboardingService::BUSINESS_TYPES` 一致(`hotel/car_rental/restaurant/airline/attraction`,**5 个**);注意 merchant-web 语言包里多一个 `other`,后端不接受,故未采用,否则 `application/save` 会以「businessType 不受支持」拒绝。`ONBOARDING_CITIES` 取自仓库既有平台目的地种子 `database/merchant/14-merchant-ranking.sql`(`ranking_destination` 8 条:Yangon/Bagan/Inle Lake/Mandalay/Ngapali Beach/Naypyidaw/Kyaiktiyo/Mrauk U);后端 `city` 本身是自由文本(`VARCHAR(50)`,无字典表),接站点字典后应改为远程获取。
  - `registrationStore` 新增 `businessCount`(+setter)与 `business.type`(businessType),`clear()` 一并复位;Number of Business 的选择结果决定 Step 5 渲染几张业务卡片,与后端 `num_businesses = count(businesses)` 口径一致。第 1 张卡直接绑注册草稿(提交时用得到),第 2..N 张静态阶段只存在本页本地状态,提交时随草稿一起拼进 `businesses[]`(后端 `save` 本就按数组逐条 `saveBusiness`)。Submit 现在校验**每一张**卡的必填项;真实链路的 payload 由 `{businessName, ...business}` 改为显式映射并补上 `businessType`(后端支持且会校验)。
  - i18n 三语言补 `register.companyInfo.businessCountOption.{one,many}` 与 `register.businessDetails.businessTypeOptions.*`;**复数按仓库既有写法**(本项目 `compatibilityJSON: 'v3'`,client-app 的 `roomsValue` 同样处理)——用 `one`/`many` 嵌套键手工挑,不用 i18next 的 `_one`/`_other` 后缀(第一版误用后缀,界面直接渲染出原始 key `register.companyInfo.businessCountOption`)。`common.comingSoon` 已无任何引用,三语言一并删除。
  - 复验:`tsc --noEmit` 与 `expo export -p web` 通过(产物已清理);CDP 390×844 实测:点 Number of Business 弹出 1–5 面板(当前项打勾)→ 选 `3 Businesses` → Step 4 显示 `3 Businesses` → Next 后 Step 5 出现 Business 1/2/3 三张卡;Business Type 面板列出后端 5 个枚举并选中 `Hotel`;City 面板选中 `Mandalay` 后字段回显。
- 🐞 走查反馈「Company Info 的 Next 按钮背景色不对(填完公司名仍发淡)」。根因是 2026-09-08 留下的 hack:注册 Step 1(现 Step 4)页脚按钮无条件叠加 `style={{ opacity: 0.4 }}` + `styles.nextDisabledLook`。**Figma 那个 0.4 不是无条件样式,而是设计稿画的是空表单**——页脚按钮组件 `EL-690831d9` 自身 `opacity: 0.4000000059604645`,而 Company Info / Business Details / Verification contact 三个画板的公司名等字段都还是 placeholder(未填)态,所以稿面呈现的是「未填完」的淡色。已删除该无条件覆盖,让这一屏与同一流程的 Contact Info `Next`、Business Details `Submit` 保持一致(实色主色 `#0D9488`),必填校验继续走原有的 toast 提示。复验:CDP 实测 `getComputedStyle` 为 `rgb(13,148,136)` + `opacity: 1`,**空表单与填完两种状态一致**;`tsc --noEmit` 与 `expo export -p web` 通过(产物已清理)。**若后续要还原稿面的"未填完淡色"**,正确做法是按校验结果驱动 `PrimaryButton` 的 `disabled`(其内置 `disabled: { opacity: 0.4 }`),而不是硬编码透明度——但那需要 Contact Info 一起改才不至于两屏不一致,故本轮未做。

## 下一步

1. 在浏览器或真机完整走查入驻原型：安全区、键盘、长文案、文件状态和 2 秒扫码动效。
2. 梳理现有后端是否已有移动端入驻 API；缺口单独列接口清单，不在原型阶段硬接。
3. 业务首页完成前，先保持 Dashboard 占位，避免提前臆造 PRD 未落图的业务交互。
4. KYC 文档卡是否需要恢复按业务分组展示，取决于后端统一清单是否再引入属性维度；决定前保持单卡。
5. E-Signature 目前是静态签名框，若产品确认需要手写签名，再引入绘制库或 `react-native-svg` 手势绘制并接后端签署存证。
6. **联调真实入驻 API 前把 `EXPO_PUBLIC_ONBOARDING_PROTOTYPE` 置为 `false`**：原型开关打开时真实链路完全不走，`apiRegistrationOtpSend/Verify`、`apiApplicationSave/Submit`、`apiKycUpload/Submit` 都只是保留未被执行的代码路径；另有 `MerchantAuthTestMode`（后台运行时开关）可在非生产环境用固定测试验证码联调。
7. `ONBOARDING_CITIES` 目前是内置的静态目的地列表（来自 `ranking_destination` 种子），后端 `city` 是自由文本；站点字典/目的地接口具备后应改为远程获取。`Business Type` 选项若后端枚举变更（`MerchantAppOnboardingService::BUSINESS_TYPES`），三处（本项目选项、merchant-web 语言包、admin-web 面板）需一起核对。
