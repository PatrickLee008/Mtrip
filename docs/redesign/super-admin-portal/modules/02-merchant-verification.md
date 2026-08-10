# 商户验证与入驻（Merchant Verification & Onboarding）

## 概述

平台超管对商户入驻申请的**全生命周期审核工作流**。不是简单的通过/驳回,而是一条 **CRM 式入驻流水线**(6 阶段)+ 按业务类型的 KYC 模板 + 多业务(一个商户多家门店/多业态)分别核验 + 文档逐项审核 + 活动时间线 + 内部备注 + 指派运营专员。列表页按 4 个 Tab 分状态展示,点开抽屉进入完整详情工作台。

来源文件:`UI设计/Super Admin Portal/src/pages/VerificationPage.tsx`(数据 `allApplications`,类型 `VerifApplication`)。

PageId 列表:
- `verification` — Pending Review(待审核)
- `verification-approved` — Approved(已通过)
- `verification-rejected` — Rejected(已驳回)
- `verification-resubmission` — Resubmission(重新提交)

> 侧边栏该组 badge=9(待办总量);`verification` 子项 badge=7、`verification-resubmission` badge=2。

## 子页面 / Tabs

| PageId | 标题 | 副标题 | 过滤 status |
|---|---|---|---|
| `verification` | Pending Review | Applications waiting for verification or currently being reviewed | `pending` |
| `verification-approved` | Approved Applications | Merchants successfully verified and approved to list on mTrip | `approved` |
| `verification-rejected` | Rejected Applications | Applications that did not meet platform requirements | `rejected` |
| `verification-resubmission` | Resubmitted Applications | Applications returned to merchants for correction and resubmission | `resubmission` |

四 Tab 共用同一份 `allApplications`,由 `tabFilters[tab]` 决定过滤的 `VerifStatus`。

## 功能清单

### 列表页(所有 Tab 共用)

**页头**:小标题「Merchant Verification & Onboarding」+ 大标题(按 tab)+ 副标题;右上「Export」按钮。

**4 张统计卡**(横跨,当前 tab 对应卡高亮):Pending Review / Approved / Rejected / Resubmission,各显示对应 status 的计数(等宽大号数字)+ 底部进度条(width = value×4% 封顶 100%)。

**搜索栏**:关键词(匹配 merchantName / merchantId / phone / businessRegNo)+ 下拉「All Categories」(Hotel/Restaurant)+ 下拉「All Countries」(Myanmar/Thailand)——**下拉未接过滤逻辑** + 右侧 `{total} results`。

**表格列(8 列)**:
1. Lead ID(`applicationId`,等宽蓝色)
2. Merchant Name(名 + 下方 city)
3. Business Name(truncate 140px)
4. Reg. Number(`businessRegNo` 前 12 位 + …)
5. Submitted(`submittedDate`,等宽)
6. Onboarding Status(派生的 OnboardingBadge,见状态机)
7. Assigned Ops(`reviewer`,Unassigned 置灰)
8. Actions

**行操作**:查看(Eye→详情抽屉);当 `status ∈ {pending, resubmission}` 时额外显示 通过(CheckCircle)/驳回(XCircle)/要求重交(RefreshCw)三个图标按钮。分页 10/页。

### 详情抽屉(760px,`VerificationDetailContent`)—— 审核工作台,7 个分区

**§1 Registration Status（入驻状态卡）**
- 顶部状态条:OnboardingBadge + 「Onboarding Stage」+ 右侧「Change:」下拉(可手动改 7 个阶段之一)。
- 阶段进度条(`OnboardingProgressBar`):6 步横向步进(New Lead→Contacted→KYC Sent→Waiting Docs→Under Review→Approved);rejected 时显示红色「Application Rejected — Onboarding closed」。
- 元信息 4 格:Lead ID / Registration Date / Assigned Ops(下拉可改,5 个专员)/ Last Updated。

**§2 Registration Information（注册信息,2 列只读）**:Business Name / Contact Person / Mobile / Email / Address / City / Country(固定 Myanmar)/ Reg. Number。

**§3 Business Assessment（业务评估表单,提交 KYC 后转只读）**:Business Category(hotel/restaurant/airline/car_rental/attraction/mixed)、Operator Type(single_unit/chain/franchise/independent/mixed)、Number of Businesses(数字)、Expected Launch Date(日期)、Internal Notes(多行)。

**§4 KYC Management（KYC 模板管理）**
- Registered Businesses 面板:一个商户下多个业务(每个含 图标/名称/业态/注册日/核验状态 verified·pending·under_review·rejected),可切换。
- Verification Scope 切换:New Merchant / Additional Business(已核验商户加新业态只需补该业态文档)。
- Business Type 选择:hotel/restaurant/airline/car_rental/attraction(带 emoji)。
- Verification Template 下拉(仅 New Merchant):按业态过滤的 KYC 模板(见数据结构 `KYC_TEMPLATES`)。
- Required Documents 清单:按模板/业态动态展开,标记必需/可选(含「(if applicable)」为可选)。
- 操作:Preview Requirements / Edit Template / **Send KYC Request**(→ 状态转 kyc_requested)。

**§5 Submitted Documents（提交文档表,按选中业务）**:表格列 Document(名+类型)/ Status(DocStatusBadge:Approved 绿/Pending 橙/Rejected 红)/ Uploaded / Actions(View / Approve / Reject);驳回行展开「Rejection Comment」输入。空态显示占位。

**§6 Activity Timeline（活动时间线）**:按当前 OnboardingStatus 生成事件序列,每条含 date / 来源标签(System 灰 / Admin 蓝 / Merchant 绿)/ action / by。

**§7 Internal Notes（内部备注)**:历史备注列表(by/date/text)+ 新增备注框 + Add Note。

**抽屉底部动作条(`OnboardingActionBar`,按阶段变化)**:
- new_lead → Assign Merchant Operations / Reject Lead
- contacted → Send KYC Request / Save Assessment
- kyc_requested / waiting_docs → Send Reminder / Edit KYC Template
- under_review → Approve Merchant / Request Resubmission / Reject Merchant
- approved → Activate Merchant / Notify Merchant

### 列表页三个确认弹窗

- **Approve dialog**(success):确认批准 → loading 1200ms → success toast。
- **Reject dialog**(danger):必填「Rejection Reason」下拉(9 个预置原因:过期营业执照/无效经营许可/材料不全/身份核验失败/不符合平台要求/场所或车队文件无效/缺保险或安全认证/疑似欺诈/重复账号)+ 可选备注。
- **Resubmit dialog**(warning):必填「Comments for Merchant」多行 → 通知商户重交。

## 数据结构

### 共享自 `platformData.ts`

```typescript
type VerifStatus = 'approved' | 'pending' | 'rejected' | 'resubmission'

interface VerifApplication {
  applicationId: string; merchantId: string; merchantName: string; businessName: string
  businessRegNo: string; ownerName: string; ownerIdNo: string; phone: string; email: string
  city: string; category: MerchantCategory; submittedDate: string; status: VerifStatus
  reviewer: string; notes: string
  documents: { name: string; type: string; status: 'verified' | 'pending' | 'rejected' }[]
  timeline: { date: string; action: string; by: string }[]
}
```

### 页面本地类型（`VerificationPage.tsx` 定义,是本模块的真正业务模型,后端需据此建表）

```typescript
type OnboardingStatus = 'new_lead' | 'contacted' | 'kyc_requested'
  | 'waiting_docs' | 'under_review' | 'approved' | 'rejected'

type BusinessType = 'hotel' | 'restaurant' | 'airline' | 'car_rental' | 'attraction'

interface KycTemplate { id: string; name: string; businessType: BusinessType; docs: string[] }

interface AssessmentForm { merchantCategory: string; businessType: string
  numBusinesses: string; expectedLaunch: string; internalNotes: string }

interface DocumentRow { name: string; type: string
  status: 'verified' | 'pending' | 'rejected'; uploadDate: string; rejectionComment?: string }

interface TimelineEvent { date: string; action: string; by: string
  type?: 'system' | 'admin' | 'merchant' }

interface NoteEntry { text: string; by: string; date: string }

interface BusinessRecord { id: string; name: string; businessType: BusinessType
  verificationStatus: 'verified' | 'pending' | 'under_review' | 'rejected'
  addedDate: string; documents: DocumentRow[] }
```

**KYC 模板内置清单**(`KYC_TEMPLATES`,9 个):Hotel(单店/多店)、Restaurant(单店/连锁)、Airline、Car Rental(标准/大车队)、Attraction(单馆/多馆);每个含该业态所需文档数组(营业执照/经营许可/法人证件/银行证明/税务登记/场所租约/保险等)。追加业务另有 `ADDITIONAL_BUSINESS_DOCS`。

**推断实体(后端建模建议)**:

| 实体 | 关键字段 | 说明 |
|---|---|---|
| 入驻申请/线索 | application_id、merchant_id、onboarding_status、assigned_ops、submitted_date、last_updated | 6+1 阶段流水线 |
| 业务单元 | biz_id、application_id、name、business_type、verification_status、added_date | 一申请多业态 |
| KYC 模板 | id、name、business_type、docs[] | 平台可维护 |
| 提交文档 | doc_id、biz_id、name、type、status、upload_date、rejection_comment、file_url | 逐项审核 |
| 活动时间线 | id、application_id、date、action、by、type(system/admin/merchant) | 审计 |
| 内部备注 | id、application_id、text、by、date | 仅运营可见 |

## 状态机 / 流转

**入驻流水线(OnboardingStatus)**:
```
new_lead → contacted → kyc_requested → waiting_docs → under_review → approved
                                                            ├──→ rejected（关闭入驻）
                                                            └──→ (Request Resubmission → waiting_docs)
```
- `deriveOnboarding()` 把 4 态 VerifStatus 映射到 7 态:approved→approved;rejected→rejected;resubmission→waiting_docs;pending 按索引分布到前 5 阶段(演示态)。
- approved → 「Activate Merchant」激活商户账号。
- 文档级状态:pending → verified / rejected(rejected 需填原因)。

## 备注（后端缺口）

1. **本模块的真实模型是 OnboardingStatus 7 阶段流水线**,现有 `merchant_info.status`(0待审1通过2驳回3启用4禁用5注销)不足以承载,需要独立的入驻申请表 + 阶段字段 + 指派运营 + 业务单元表 + 文档表 + 时间线表 + 备注表(见 data-structures.md 的 Phase 1 新增表)。
2. KYC 模板需做成**平台可配置**(按业态维护所需文档清单),而非硬编码。
3. Assigned Ops(运营专员指派)、Send KYC / Send Reminder / Notify 需接通知中心与商户端。
4. 「Change 阶段」下拉允许人工改阶段,需权限控制 + 审计。
5. 多业务(Additional Business)核验:已核验商户加新业态只补该业态文档,需模型支持一商户多业务单元、各自核验状态。
6. Country 固定 Myanmar、部分 Last Updated/日期为硬编码,需真实数据。
7. 驳回原因 9 项预置 + Category/Country 过滤下拉需接后端枚举与过滤。
