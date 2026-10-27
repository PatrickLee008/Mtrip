# Merchant M10 Support 实施与验证

实施日期：2026-10-26，最终回归与交付整理：2026-10-27。依据：[确认方案](../设计方案-Merchant-M10-Support支持与帮助中心.md)，Figma `3047:21340` 及方案所列 PRD 基线。

后续发布更新（2026-10-27）：用户反馈 8091 不可见后已完成正常库备份、遗漏迁移真实补执行与标准迁移 48/48，商户双池/网关和 8091/8090 静态包已更新，正常商户登录态入口已验证。详见[本地发布记录](./2026-10-27-merchant-support-local-rollout.md)。本文末“未部署”等描述开发验证结束时的历史状态；后续正常端口已完成只读核验。验收截图已按用户要求在收尾阶段清理，文字记录保留。P4 真实指南内容/播放仍待配置。

## 当前交付

P1–P3 代码完成并通过本地隔离验证；P4 完成公开 API 契约核对、服务端适配和统一指南页面，真实商户内容及播放待配置；P5 完成本轮质量检查、浏览器走查与文档，完整验收及正常环境发布尚未完成。

- 商户端复用系统分组 `/support`，中英文分别为“支持与帮助”和 Support。访客消息 `/guest-messaging`、只读代为登录 `/support-session` 保持独立。
- 四张互斥汇总卡、真实筛选和分页、工单创建、回复与私有附件、活动历史、关闭/重开；平台 `/helpcenter/merchant-tickets` 提供查询、指派、优先级、状态、回复及历史。
- 双端共用 merchant-service 的 `SupportTicketService` 和业务库事务；六状态、版本并发、请求幂等、通知失败整笔回滚。并发重放使用当前锁定读取，防止创建成功后重复请求因旧快照误报找不到工单。
- `SupportAccess` 按当前账号、角色和物业授权复核；Support 内支持餐厅等非酒店物业，停业不删除已有授权历史。Support 局部资源筛选补足全局酒店物业选择器，通知返回工单与物业提示，页面再次按授权选项检查。
- FAQ 使用现有发布源，合规使用生效规则快照、违规与警告。关联申诉是支持工单，解决工单不改变处罚结果；没有评分引擎时显示“暂未配置”。
- 附件独立记录和私有卷，不输出公共 URL；PDF/JPG/PNG/XLSX，每份最多 10,000,000 字节，每次提交最多 5 份；24 小时未绑定附件由定时任务分批清理。

## 主要文件

| 部分 | 入口 |
| --- | --- |
| 正式迁移 / 新库快照 | `database/migrations/V20261026100000__merchant-support.sql` / `database/merchant/42-merchant-support.sql` |
| 领域 / 权限 / 状态 | merchant-service `SupportTicketService`、`SupportAttachmentService`、`SupportContentService`；shared `SupportAccess`、`SupportTicketPolicy` |
| 双端 HTTP | merchant-service `Controller/Merchant/SupportController.php`、`Controller/Admin/SupportController.php` |
| 商户 Web | `merchant-web/src/views/support/`、`src/api/support.ts`、`src/locales/support.ts` |
| 平台 Web | `admin-web/src/views/helpcenter/merchant-tickets/`、`src/api/support.ts`、`src/locales/support.ts` |
| 指南 | merchant-service `GuideHubService`、`config/autoload/guide_hub.php`；商户 `/support/guides` |
| 回归 | `test/support/integration.py`、`backend/shared/tests/cases/SupportTicketPolicyTest.php` |

## 验证结果

macOS 使用容器 PHP 执行项目质量基线的等价检查；不依赖宿主安装 PHP/PowerShell。

| 检查 | 结果 |
| --- | --- |
| 后端全量 PHP lint（排除 vendor/runtime/node_modules） | 446 文件，无语法错误 |
| shared `tests/run.php` | 150 用例、1248 断言，通过 |
| merchant-web `npm run build` | vue-tsc 与 Vite 通过；保留既有 chunk 体积提示 |
| admin-web `npm run build` | vue-tsc 与 Vite 通过；保留既有 chunk 体积提示 |
| client-app `npm run typecheck` | 通过 |
| Support 隔离 HTTP | 71 项通过，两个临时实例/两个 worker；正式迁移重复执行通过 |
| 访客消息回归 | 17 基础 HTTP + 9 停业物业访问 + 10 store 重试/切换检查通过 |
| Compose 主池及 APP 池 `config --quiet` | 通过，共享 Support 私有卷与服务端指南配置齐备 |
| 差异检查 | `git -c core.whitespace=cr-at-eol diff --check` 通过，保留原有后台语言文件 CRLF |

最终集成额外验证：非酒店本地筛选及汇总、筛选不能扩大员工权限、个人通知重复已读、过期临时附件不可下载或绑定。未授权查询条件与服务端授权求交集，列表为空；伪造物业 Header 继续拒绝。

浏览器用合成账号完成：商户创建 → 平台指派 → 平台回复 → 商户补充 → 商户关闭 → 填原因重开，两端同工单与历史一致；已解决详情禁止直接回复，提供显式重开。FAQ、合规及指南未配置页已走查。最后干净重载后的商户及平台页面无捕获到的控制台 error。

中英桌面及窄屏已检查；英文检查覆盖 1280×900、1440×900、375×900，中文检查覆盖 1440×900、375px 首页/创建/详情。375px 实测文档宽度为 375px，详情抽屉宽度为 375px，创建弹窗为 343px。中文 1280px 已检查但未保留最终截图，因此不宣称所有语言/尺寸/状态的笛卡尔组合均已验收。

修复了浏览器发现的 Antd Empty 空图片属性渲染异常与窄屏抽屉固定 680px 溢出；补上客服姓名字段、活动字段翻译、相同页面资源提示更新、物业切换清理及历史请求顺序保护。

## 验收边界

| 项目 | 本轮证据与剩余项 |
| --- | --- |
| A01–A05 | 菜单/双端主流程、汇总、六状态、幂等/并发/回滚已验；大数据量分页及所有筛选组合未穷举 |
| A06–A07 | 角色/物业撤权、跨站/跨商户、门店/通用、停业餐厅已验；集团账号及账号停用路径需补场景验收 |
| A08 | PDF/XLSX、ZIP 冒名、匿名/跨商户/重复绑定、个数和临时过期已验；JPG/PNG 内容、10MB 边界和定时清理实际调度未做专项 HTTP 验收 |
| A09 | 投递、父工单权限、个人重复已读、撤权后计数/深链隐藏已验；通知清空、正式账号完整点击恢复链待复验 |
| A10–A11 | 发布受众、隐藏分类、草稿/未来政策/例外隔离、警告到期/撤销、计分未配置、申诉与处罚独立已验 |
| A12 | 公开契约、权限与未配置状态已验；真实配置后的分类、搜索、播放及外部故障状态未验 |
| A13 | 双端主流程、中英桌面/375px、空历史/终态及未配置状态已验；完整尺寸/状态组合、迟到网络响应的浏览器压力场景未验 |
| A14 | 访客消息 36 项与 shared 中代为登录写操作门禁通过；平台原 FAQ/合规管理端的写入 UI 未重跑 |

## Guide Hub 依赖

已只读取得公开 Client API 1.0.0 文档，采用 `/api/v1/app`、`/api/v1/categories`、`/api/v1/video-guides` 及详情接口；服务端发送 `X-App-ID`/`X-App-Secret`，先校验 app ID 与商户 slug，再投影内容。设置 HTTPS、超时、禁止重定向，并区分未配置、鉴权失败、限流、应用不匹配和暂不可用；前端只接收投影与安全 HTTPS 视频地址。

待提供/配置 `MTRIP_GUIDE_HUB_APP_ID`、`MTRIP_GUIDE_HUB_APP_SECRET`、`MTRIP_GUIDE_HUB_MERCHANT_SLUG`，并用真实已发布商户内容核验语言/站点范围、分类/搜索和媒体观看。实际媒体链接是否足以直接观看仍取决于提供方；本轮没有登录外部后台，没有使用 PRD 中的账号或凭据，也没有把未配置页面计作指南播放完成。

## 正常环境与清理

只读 `bash scripts/db-migrate.sh --status` 返回既有阻塞：待执行 `20261015090000` 低于已上线最高 `20261015100000`，禁止倒序补迁移。本轮没有修复历史账本、执行正常库迁移或部署。上线前需先处理历史迁移阻塞并备份，按标准流程应用本次迁移，再更新 merchant-service 主/APP 池、网关和两个 Web；验证实际菜单、权限配置、私有卷和正常端口的通知深链。

Support 和访客消息临时容器、克隆库、随机数据库用户、私有文件/凭据、临时前端服务和 QA HTML 均已清理。开发阶段 PNG 全部为合成测试数据，后续验收截图均已按用户要求清理。未提交、未推送。

商户原生 App、评分引擎、正式处罚复核模型与外部短信/邮件/Push 继续按确认范围另期实施。
