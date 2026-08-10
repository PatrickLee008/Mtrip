# 商户管理（Merchant Management）

## 概述

平台超管对已入驻商户的日常管理:名录/佣金计划/账户状态、暂停与拉黑、商户代入(Impersonation)、给商户发通知、合规文档库(有效期/核验/重交)、全量操作审计日志。位于左侧导航 Merchant Management 组。

来源文件:`UI设计/Super Admin Portal/src/pages/MerchantPage.tsx`(数据 `merchants`,类型 `Merchant`;文档/活动为页面内派生 mock)。主组件按 `tab` 路由到 3 个子视图:`MerchantDocumentsPage`(documents)、`MerchantActivitiesPage`(activities)、主列表(其余)。

PageId 列表:
- `merchants` — All Merchants(全部,status ∈ active/suspended/inactive)
- `merchants-documents` — Merchant Documents(合规文档库)
- `merchants-suspended` — Suspended(仅 status=suspended)
- `merchants-blacklisted` — Blacklisted(仅 status=inactive)
- `merchants-activities` — Merchant Activities(审计日志)

> 侧栏 badge:merchants-suspended=3、merchants-blacklisted=1。

## 子页面 / Tabs

| PageId | 标题 | 副标题 | 过滤 |
|---|---|---|---|
| `merchants` | All Merchants | Manage platform merchants, commissions, and account access | active/suspended/inactive |
| `merchants-suspended` | Suspended Merchants | Merchants currently suspended from accepting new bookings | suspended |
| `merchants-blacklisted` | Blacklisted Merchants | Merchants permanently removed from the platform | inactive |
| `merchants-documents` | Merchant Documents | Review, verify, and manage compliance documents | 独立视图 |
| `merchants-activities` | Merchant Activities | Audit log of all merchant and administrator actions | 独立视图 |

> 注:「Blacklisted」在数据上映射到 `MerchantStatus='inactive'`(设计稿未单列 blacklist 枚举,用 inactive 代指)。

## 功能清单

### 主列表(merchants / suspended / blacklisted 共用)

**页头**:小标题「Merchant Management」+ 大标题(按 tab)+ 副标题;右上「Export」+「Add Merchant」(蓝色主按钮)。

**4 张统计卡**:Total Merchants / Active / Suspended / Blacklisted Merchants(最后一张红色警示样式)。

**搜索栏**:关键词(merchantName/id/email/phone/businessRegNo)+ 下拉 All Status / All Categories(Hotel/Resort/Boutique)/ All Plans(VIP/Premium/Standard)——**下拉未接过滤** + `{total} results`。

**表格列(9 列)**:
1. Merchant ID(等宽蓝色 + VIP 星标)
2. Merchant Name(名 + city·stars★)
3. Category(下划线转空格)
4. Commission Plan(PlanBadge:vip 金/premium 紫/standard 灰/custom 绿)
5. Verification(VerifBadge:approved/pending/rejected/resubmission 四色)
6. Account Status(StatusBadge:active 绿/suspended 红/inactive 灰)
7. Revenue MTD(¥ 百万,0 显示 —)
8. Last Login(日期,Never 置灰)
9. Actions

**行操作**:查看(Eye→商户档案抽屉)/ 通知(Bell→NotificationDrawer)/ 代入(LogIn→Impersonation 弹窗)/ 更多(status=active 才显示,→ Suspend 弹窗)。分页 10/页。

**商户档案抽屉(600px)**:头部卡(名/VIP/businessName/city·country·stars·rooms + StatusBadge/VerifBadge);字段网格(Merchant ID / Business Reg. No. / Owner / Commission Plan(含费率) / Email / Phone / Bank Name / Bank Account / Join Date / Last Login);Monthly Performance(Revenue MTD / Bookings MTD 两卡);底部动作:Impersonate / Notify Merchant / Suspend(active 才有)。

**弹窗**:
- Impersonation(warning):必选原因(Technical Support / Booking Investigation / Payment Investigation / Customer Complaint / Other)→ 触发全局 Impersonation 横幅 + 审计。
- Suspend(danger):立即暂停,阻止新预订,不影响已确认订单。

### Merchant Documents(合规文档库)

**5 张可点筛选统计卡**:Total Documents / Verified / Pending Review / Expired / Resubmission Required(点击即按状态过滤)。

**搜索栏**:关键词(merchantName/id/docType)+ 下拉状态 + 下拉文档类型(8 种:营业执照/酒店经营许可/法人证件/银行核验函/税务登记/消防证/旅游经营许可/餐饮许可)+ `{total} results`。

**表格列(7 列)**:Merchant(名 + id·city)/ Document Type(名 + 大小·PDF)/ Verification Status(DocStatusBadge:Verified/Pending Review/Expired/Resubmission Required)/ Expiry Date(到期高亮,≤30 天「expiring soon」橙告警)/ Last Verified / Reviewer(头像缩写)/ Actions。每页 12。

**行操作**:预览(Eye→抽屉 preview tab)/ 下载 / 核验历史(History→抽屉 history tab)/ 核验(pending/expired 才有,CheckCircle)/ 要求重交(非 resubmission_required 才有,RefreshCw)。

**文档抽屉(520px,两 tab)**:
- Document Preview:状态横幅 + 文档缩略图(文件名/大小/上传日/到期日)+ 元信息网格(Document Type / Merchant / File Name / Uploaded / Expiry / Last Verified / Reviewer)+ 下载按钮。
- Verification History:审计时间线(date/by/action/note)+ 临期提醒条。
- 底部(pending/expired):Request Resubmission / Verify Document。

**弹窗**:Verify(success);Request Resubmission(warning,必选原因 6 项:图像不清/已过期/信息不符/缺章节签名/文档类型错误/疑似篡改 + 备注)。

### Merchant Activities(审计日志)

**活动类型 chip 过滤条**:All Activities + 6 个高亮类型(Login/Suspension/Verification/Warning/Document Upload/Profile Update),各带计数。

**搜索栏**:关键词(merchantName/id/description/performedBy/logId)+ 下拉:活动类型 / 日期(Today/7d/30d)/ 管理员 / 商户 + `{total} results`。

**表格列(8 列)**:Activity Time(日期+时间两行)/ Merchant(名+id)/ Activity Type(图标+标签,9 类)/ Description / Performed By(头像:System 灰/商户本人 紫/管理员 蓝)/ IP Address / Status(Success/Failed/Pending)/ Actions(Eye→详情抽屉)。每页 15。

**活动详情抽屉(480px)**:类型横幅 + 详情字段(Log ID/Activity Time/Merchant/Type/Description/Performed By/IP/Status)+ 审计说明(impersonation/failed 有额外提示)。

## 数据结构

### 共享自 `platformData.ts`

```typescript
type MerchantStatus = 'active' | 'suspended' | 'inactive'
type MerchantCategory = 'hotel' | 'resort' | 'boutique' | 'guesthouse' | 'serviced_apartment' | 'hostel'
type CommissionPlan = 'standard' | 'premium' | 'vip' | 'custom'

interface Merchant {
  id; merchantName; businessName; ownerName; category; city; country; phone; email
  stars; rooms; status; verificationStatus; commissionPlan; commissionRate
  joinDate; lastLogin; monthlyRevenue; monthlyBookings; isVip; businessRegNo; bankName; bankAccount
}
```

### 页面本地类型（后端需据此建表）

```typescript
type DocStatus = 'verified' | 'pending' | 'expired' | 'resubmission_required'
interface MerchantDoc {
  id; merchantId; merchantName; merchantCity; docType; fileName; fileSize
  uploadedDate; expiryDate: string | null; lastVerifiedDate: string | null
  reviewer; status: DocStatus; notes?
  history: { date; action; by; note? }[]
}

type ActivityType = 'login' | 'profile_update' | 'suspension' | 'reactivation'
  | 'document_upload' | 'verification' | 'warning' | 'impersonation' | 'booking'
interface ActivityLog {
  id; timestamp; merchantId; merchantName; activityType: ActivityType
  description; performedBy; ipAddress; status: 'success' | 'failed' | 'pending'
}
```

`NotifRecipient`(来自 `NotificationDrawer`):kind:'merchant' | id | name | email | phone | avatar | avatarBg —— 给商户发通知的收件人上下文。

## 状态机 / 流转

**商户账户**:`active ⇄ suspended`(Suspend/Reactivate);`active/suspended → inactive`(拉黑/注销,列表映射为 Blacklisted)。
**文档**:`pending → verified`(核验)/`→ resubmission_required`(要求重交)/`→ expired`(到期,系统)。
**代入会话**:管理员发起 Impersonation(选原因)→ 全局横幅 + 审计事件(activityType=impersonation,start/end 各记一条)。

## 备注（后端缺口）

1. **黑名单需要独立枚举/表**:设计稿用 `inactive` 代指 blacklist,真实应区分「停用/注销」与「拉黑」,并记录拉黑原因/操作人(见 data-structures.md `merchant_blacklist`)。
2. **合规文档库**(MerchantDoc)是新数据模型:文档类型、到期日、核验人、核验历史、临期告警(≤30 天),需 `merchant_verify_document` 扩展(有效期/reviewer/history)。文档类型清单应平台可配。
3. **商户活动审计**(ActivityLog)9 类事件 + IP + 状态,可复用/扩展 `sys_operation_log` 或新建 `merchant_activity_log`;需覆盖 login/impersonation/suspension/warning 等。
4. **Impersonation(商户代入)** 是平台级能力:需代入令牌、原因、起止审计、全程操作归因,后端目前无对应机制。
5. **通知商户**(NotificationDrawer)需接通知中心(渠道:站内/邮件/短信,收件人上下文)。
6. Revenue/Bookings MTD、IP、部分日期为 mock,需后端聚合与真实审计源。
7. 主列表筛选下拉(Status/Category/Plan)未接逻辑,需补后端过滤参数。
