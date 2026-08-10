# 平台配置（Platform Configuration）

## 概述

平台超管的**全局配置中心**:一个卡片网格(17 个配置卡),点选进入对应配置表单。部分卡有真实表单(功能开关/维护模式/位置服务),多数为通用占位表单。对应现有 `config/*`(global/site/storage/pay/sms/map/client/permtpl)+ `finance/tax` + `verify/rule` 的整合。

来源文件:`UI设计/Super Admin Portal/src/pages/PlatformConfigPage.tsx`(~37KB)。

PageId:`platform-config`(单页,左侧卡片选择 + 右侧表单)。

## 子页面 / Tabs

单页,无 Tab。左侧 17 配置卡,选中 `activeConfig` 渲染右侧表单。

## 功能清单

### 17 个配置卡（configCards）

| id | 标题 | 说明 | 表单 |
|---|---|---|---|
| platform | Platform Settings | 通用配置/品牌/本地化 | 占位 |
| categories | Merchant Categories | 酒店/度假村/精品等商户类型 | 占位 |
| onboarding | Merchant Onboarding | 所需文档/验证步骤/审批流 | 占位 |
| commission | Commission Configuration | 标准/高级/VIP 佣金梯度 | 占位 |
| settlement | Settlement Configuration | 结算周期/打款计划/银行账户规则 | 占位 |
| refund | Refund Policy | 退款窗口/审批阈值/自动处理 | 占位 |
| cancellation | Cancellation Policy | 客/商取消规则与罚则 | 占位 |
| notifications | Notification Templates | 平台通知内容与触发 | 占位 |
| email | Email Templates | 交易邮件模板 | 占位 |
| sms | SMS Templates | 短信通知模板 | 占位 |
| features | **Feature Toggles** | 功能开关/Beta | **真实表单** |
| pms | PMS Integration | 酒店 PMS API 对接 | 占位 |
| channel | Channel Manager | OTA/分销渠道同步 | 占位 |
| api | API Configuration | API Key/限流/webhook/日志 | 占位 |
| maintenance | **Maintenance Mode** | 维护窗口/自定义状态页 | **真实表单** |
| announcements | Announcement Management | 平台级公告广播 | 占位 |
| lbs | **Location-Based Services** | 地图/地理围栏/坐标校验 | **真实表单** |

### Feature Toggles（真实,9 个开关）
Affiliate Program(on)/ Flash Sale Campaigns(on)/ Dynamic Pricing(off,AI 动态定价)/ Instant Booking(on,免商户确认)/ Split Payments(off,团单分账)/ Loyalty Points(on,mTrip Rewards)/ Multi-currency Display(off,按用户货币显示)/ **Merchant Impersonation(on,允许超管代入)**/ **Two-Factor Auth 2FA(on,强制管理员 2FA)**。

### Maintenance Mode（真实)
维护开关 + 计划窗口 + 自定义状态页文案。

### Location-Based Services（真实)
- 连接状态(LbsConnStatus:connected/disconnected/error/testing)、API 版本、Last Checked、Daily Usage/Quota。
- **地理围栏区(GeoZone)**:id、name、bizType、radius、status(active/inactive),可增删。
- **坐标校验模式**:strict(校验通过才可保存)/ warning(可保存但警示)/ disabled(不校验)。

### 通用占位表单（GenericConfigForm）
其余卡渲染通用占位表单(title + 通用字段),**未定义真实字段**——落地时按对应现有配置模块补齐。

## 数据结构

```typescript
interface ConfigCard { id; title; description; icon; color; bg }

type LbsConnStatus = 'connected'|'disconnected'|'error'|'testing'
interface GeoZone { id: number; name; bizType; radius; status: 'active'|'inactive' }

// Feature Toggle
interface FeatureToggle { label; sub; on: boolean }
```

### 实体 → 现有配置映射
platform/categories→`sys_config`+商品分类;commission/settlement→商户/财务配置(`merchant_info.commission_rate`/`settlement_cycle`、`finance_tax_config`);refund/cancellation→`goods_refund_rule`;email/sms/notifications→`sys_sms_template`+通知模板;features→新 `sys_feature_flag`;api→`sys_client`;lbs→`sys_map_config`+新 `geo_zone`;announcements→新 `help_announcement`(与帮助中心公告同源)。

## 状态机 / 流转

- 功能开关:on/off,即时生效(需权限 + 审计)。
- 维护模式:关闭 → 计划 → 生效 → 关闭。
- LBS 连接:disconnected →(Test)→ testing → connected/error。

## 备注（后端缺口）

1. 17 卡中仅 3 卡(features/maintenance/lbs)有真实字段,**其余 11 卡为占位**——落地时映射到现有配置控制器(config/*、finance/tax、verify/rule),不要照抄空表单。
2. **Feature Toggles 需 `sys_feature_flag` 表**驱动全平台特性开关(含 Merchant Impersonation、2FA、多货币显示等),前后端统一读取。
3. **多货币显示开关** 与"货币按站点可配"决策直接相关;**Merchant Impersonation 开关** 控制商户代入能力总闸。
4. LBS 地理围栏/坐标校验为新能力,需 `geo_zone` 表 + 校验模式配置。
5. 佣金/结算/退款/取消策略应集中可配并驱动业务(订单/财务)真实计算。
