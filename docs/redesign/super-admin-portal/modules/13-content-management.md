# 内容管理（Content Management）

## 概述

平台超管管理 **App 端展示内容**:横幅(Banner)投放 + 动态主题(Theme)。对应现有 `marketing/banner` + `cops/theme`(app_theme / ThemeController)的重组升级。主题编辑器很复杂(11 分区 + ~35 素材位 + 启动屏配置),对应 Consumer App PRD「通过管理后台进行动态主题管理」。位于 Content Management 组。

来源文件:`UI设计/Super Admin Portal/src/pages/ContentManagementPage.tsx`(~108KB)。按 `tab` 路由。

PageId 列表:
- `contentmgmt-banners` — Banner Management(横幅)
- `contentmgmt-themes` — Theme Management(主题)

## 子页面 / Tabs

| PageId | 标题 | 组件 |
|---|---|---|
| `contentmgmt-banners` | Banner Management | 主视图 |
| `contentmgmt-themes` | Theme Management | ThemeListPage + 全屏 ThemeEditor |

## 功能清单

### Banner Management（横幅）
- 表格/卡列:name、description、placement(投放位:Home Page/Hotel Search/Hotel Detail/Booking Confirmation/Login & Register)、linkedCampaign、scheduleStart/End(排期)、priority、status(active/scheduled/draft/expired)、action(点击动作:No Action/Hotel Detail/Campaign/Promotion/Voucher/Deep Link/External URL)、audience(投放人群:All/New/Returning/Membership Tier/Country/Language)、color、createdDate。
- 创建/编辑表单(BannerForm)+ 手机预览;上下架/排期。

### Theme Management（动态主题）
- 主题列表:name、description、category(Built-in/Custom)、type(Default/Seasonal/Promotion/Anniversary/Destination/Partnership/Custom)、scheduleStart/End、priority、status(active/scheduled/draft/inactive)、四色(primary/secondary/accent/button)、deletable、lastUpdated。内置主题(Default/Thingyan/Thadingyut 等)不可删。
- **ThemeEditor(全屏,11 分区 EDITOR_SECTIONS)**:
  1. Basic Information(name/description/type/status)
  2. App Branding(defaultLogo/seasonalLogo/appIcon)
  3. Splash Screens(splashDefault/Seasonal/Promo,各含 enabled/duration/order + 素材)
  4. Login & Registration(loginBg/regBg/authIllustration)
  5. Home Screen(homeHeaderLogo/homePromoBanner + 6 服务图标 serviceHotels/Flights/Buses/Food/Cars/Packages + 季节版)
  6. Search Page(searchHeaderBg/searchPromoBanner)
  7. Bottom Navigation(navHome/navMyTrips/navPromotions/navMore)
  8. Booking & Voucher(bookingSuccess/celebrationBanner + voucherHeader/Footer/Graphics/Decorations/Badge)
  9. Theme Colors(primary/secondary/accent/button/background)
  10. Schedule & Priority(排期 + 优先级)
  11. Preview & Publish(预览 + 发布)
- ~35 个素材位(ThemeAssetKey),9 个必填(REQUIRED_ASSETS:App Logo/Default Splash/Login Background/Home Banner/Service Icons/Search Banner/Bottom Navigation/Booking Confirmation/Booking Voucher)。
- ThemePreviewModal:手机内预览主题效果。

## 数据结构

```typescript
type BannerStatus = 'active'|'scheduled'|'draft'|'expired'
type BannerPlacement = 'Home Page'|'Hotel Search'|'Hotel Detail'|'Booking Confirmation'|'Login & Register'
type BannerAction = 'No Action'|'Hotel Detail'|'Campaign'|'Promotion'|'Voucher'|'Deep Link'|'External URL'
type BannerAudience = 'All Users'|'New Users'|'Returning Users'|'Membership Tier'|'Country'|'Language'
interface Banner { id; name; description; placement; linkedCampaign: string|null
  scheduleStart; scheduleEnd; priority; status; createdDate; action; audience; color }

type ThemeStatus = 'active'|'scheduled'|'draft'|'inactive'
type ThemeCategory = 'Built-in'|'Custom'
type ThemeType = 'Default'|'Seasonal'|'Promotion'|'Anniversary'|'Destination'|'Partnership'|'Custom'
interface Theme { id; name; description; category; type; scheduleStart: string|null; scheduleEnd: string|null
  priority; status; lastUpdated; primaryColor; secondaryColor; accentColor; buttonColor; deletable }

interface SplashConfig { enabled: boolean; duration: number; order: number }
type ThemeAssetKey = /* ~35 keys: defaultLogo, appIcon, splashDefault, loginBg, homePromoBanner,
  serviceHotels..Packages, seasonalHotels.., searchHeaderBg, navHome.., bookingSuccess,
  voucherHeader..Badge, ... */
type ThemeForm = { name; description; type; status; assets: Partial<Record<ThemeAssetKey,boolean>>
  splashDefault/Seasonal/Promo: SplashConfig; 5 colors; schedule*; priority }
```

### 实体 → 现有映射
Banner→`marketing_banner`(需扩展 placement/action/audience/linkedCampaign 字段);Theme→`app_theme`(ThemeController 已存在,需扩展多分区素材 + splash + 四/五色 + 排期);素材文件→`sys_file`/存储通道。

## 状态机 / 流转

- Banner:`draft → scheduled → active → expired`;按排期 + priority + placement + audience 投放。
- Theme:`draft → scheduled → active`(生效)/`inactive`;按排期 + priority 切换;必填素材齐全才可发布。

## 备注（后端缺口）

1. **Theme 动态主题** 对应 PRD「动态主题管理」验收标准:后端 `app_theme` 已有基础(ThemeController),但需扩展为**多分区素材集**(~35 素材位 + 9 必填 + splash 多屏配置 + 五色 + 排期优先级),App 端按生效主题拉取素材。
2. Banner 需扩展投放维度(placement/action/audience/linkedCampaign),支持人群定向与深链跳转。
3. 素材上传走存储通道(`sys_storage`/`sys_file`);发布前校验必填素材完整。
4. 与营销活动(linkedCampaign)、促销/券(action=Campaign/Promotion/Voucher)联动。
5. 内置主题不可删(deletable=false),自定义主题可增删。
