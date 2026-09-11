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
| 3 | 注册 / OTP / KYC 页面 | [x] | 注册 Step 1-4、OTP、KYC 文档上传/提交、审核中/批准状态已按 Figma 页面连通；审批与上传仍是本地原型状态。 |
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

## 下一步

1. 在浏览器或真机完整走查入驻原型：安全区、键盘、长文案、文件状态和 2 秒扫码动效。
2. 梳理现有后端是否已有移动端入驻 API；缺口单独列接口清单，不在原型阶段硬接。
3. 业务首页完成前，先保持 Dashboard 占位，避免提前臆造 PRD 未落图的业务交互。

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
