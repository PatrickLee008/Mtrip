# 帮助中心管理（Help Center Management）

## 概述

平台超管维护 **C 端/商户/达人 的帮助内容**:FAQ 文章、分类、公告(定时广播)、搜索分析。**全新模块**(现有后台无对应)。位于 Help Center Management 组。

来源文件:`UI设计/Super Admin Portal/src/pages/HelpCenterPage.tsx`(~75KB)。按 `tab` 路由到 4 个子页面。

PageId 列表:
- `helpcenter` — FAQ Articles(文章)
- `helpcenter-categories` — Categories(分类)
- `helpcenter-announcements` — Announcements(公告)
- `helpcenter-analytics` — Search Analytics(搜索分析)

## 子页面 / Tabs

| PageId | 标题 | 组件 |
|---|---|---|
| `helpcenter` | FAQ Articles | 主视图 |
| `helpcenter-categories` | Categories | CategoriesPage |
| `helpcenter-announcements` | Announcements | AnnouncementsPage |
| `helpcenter-analytics` | Search Analytics | SearchAnalyticsPage |

## 功能清单

### FAQ Articles（文章）
- 筛选:分类(8 类)/ 受众(Customer/Merchant/Affiliate/Influencer/All)/ 状态(published/draft/archived)/ 关键词。
- 表格列:文章(id+title)、Category、Audience(受众徽标)、Views、Last Updated、Status、Author、Actions。
- 创建/编辑抽屉(BLANK_ARTICLE_FORM):title、category、audience、status、content(富文本)、attachments、images。

### Categories（分类）
- 卡/表:name、icon(emoji)、description、articleCount、order(排序)、visible(可见开关)。
- 8 个内置:Booking/Payment/Merchant/Affiliate/Promotion/Refund/Account/Platform。CRUD + 排序 + 显隐。

### Announcements（公告）
- 定时广播:title、audience、startDate/startTime、endDate/endTime、status(active/scheduled/expired/draft)、content、priority(high/normal/low)。
- 创建/编辑抽屉(BLANK_ANN_FORM);发布/暂停/排期。

### Search Analytics（搜索分析)
- Top Keywords(热搜词)、No-Result Keywords(无结果搜索词,指导补文章)、Top Viewed Articles(views/rating/helpful%)、Low-Rated Articles(rating/views/feedback,指导改进)。

## 数据结构

```typescript
type Audience = 'Customer'|'Merchant'|'Affiliate'|'Influencer'|'All'
type ArticleStatus = 'published'|'draft'|'archived'
type AnnouncementStatus = 'active'|'scheduled'|'expired'|'draft'

interface Article { id; title; category; audience: Audience; views; lastUpdated
  status: ArticleStatus; content; attachments; images; author }

interface Announcement { id; title; audience; startDate; startTime; endDate; endTime
  status: AnnouncementStatus; content; priority: 'high'|'normal'|'low' }

interface FaqCategory { id; name; icon; description; articleCount; order; visible }
```

### 推断实体（后端建模,全新）
`help_article`、`help_category`、`help_announcement`、`help_search_log`(搜索词/命中/评分/helpful)。

## 状态机 / 流转

- 文章:`draft → published → archived`。
- 公告:`draft → scheduled → active → expired`。
- 分类:visible 显隐 + order 排序。

## 备注（后端缺口）

1. 全新模块,需 4 张表 + C 端帮助中心接口(按受众/分类过滤、搜索、评分)。
2. **数据一致性问题**:FAQ 文章的分类是固定字符串列表 `CATEGORIES`(Booking/Payment/Merchant/Affiliate/Promotion/Refund/Account/Platform),而 Categories 页是独立 CRUD 实体(FaqCategory,含 8 条同名)。落地时应统一为**同一分类实体**(文章外键引用分类,而非硬编码字符串),否则改分类会与文章脱节。
3. 公告(Announcements)与平台配置的 Announcement Management、通知中心存在重叠,建议后端统一「平台公告」一处来源。
4. Search Analytics 需要 C 端搜索埋点(搜索词/命中数/点击/评分/helpful 反馈)驱动,`help_search_log` 需前端上报。
5. 受众 Audience 与 App 端用户分群(会员/商户/达人)对齐。
