# 2026-11-19 QA 测试表增量核查

后续执行：[修复与复测结果](./2026-11-19-qa-fix-retest.md)。返利展示及站点校验已修复并本地验证；本文件保留最初增量分析，当前处理状态以结果记录为准。

## 结论与范围

对比 `C:/test_result/mTrip Test Cases__261119.xlsx` 与本地上一版 `C:/test_result/mTrip Test Cases.xlsx`，读取全部 38 个页签，以「页签名 + 用例 ID」配对，避免消费者、商户页签使用相同 ID 时互相覆盖。两版没有页签内重复 ID，也没有删除用例。

**只有 1 条新增失败记录：`Ref_TC_014` 推荐奖励未自动入邀请人钱包。** 该用例原来结果为空，本版填写 `Not Pass`；没有发现 `Pass → Not Pass`，所以目前没有表格证据证明出现了新的回归。

本轮完成的是文件比较、历史记录与当前代码核查，没有操作 QA/生产业务数据、执行实际返利或回写 Excel；未独立复现上述失败。Excel 中保留的旧失败也不等于当前版本仍然失败。

后续已按用户要求准备[修复与复测计划](../2026-11-19-qa-fix-plan.md)。计划阶段已查看返利截图，确认其显示“已奖励1人、累计0 MMK”；尚未独立复现或认定钱包实际未入账，下一步优先核查对应奖励记录、历史配置与流水。

## 追加：最新证据包完整性核查

随后发现本地新增 `C:/test_result/MTrip Test Evidences-20261119T072753Z-1-001`。以这版重新核对最新 Excel 的全部 251 条证据引用，包内共 221 个文件，无零字节文件。按文件名规范化、相同 Drive 文件 ID 以及少量内容抽查，**全部引用均能对应本地文件，没有发现需要补传的已引用图片或视频**；此结论限于文件是否存在，不代表每个视频都逐帧验收。

其中 219 条引用按名称/扩展名匹配（兼容 UI/UX 标点与数字补零），30 条 BO 引用与 CP 引用使用相同 Drive 文件 ID，证据以 `CP_TC_*` 名称保存；余下两条通过内容核对确认了对应文件：

| 表格引用/用例 | 实际本地文件 | 核对结果 |
|---|---|---|
| Facebook 登录 `L_TC_003.png` | `Consumer App/Lite_TC_003.png` | 图片显示 Facebook 同意弹窗及登录失败提示，属于 Facebook 登录证据，文件名错位。 |
| Lite 订房 `Lite_TC_003` 引用 `L_TC_003.mp4` | `Consumer App/L_TC_003.mp4` | 抽帧显示 Lite 酒店订房、同一酒店被重复加入；引用内容匹配，文件名未使用 Lite 前缀。 |
| 消费者登录 `L_TC_014.mp4` | `Merchant Dashboard/L_TC_014.mp4` | 抽帧显示消费者登录及站点停用提示，内容匹配，放错目录。 |
| 推荐返利 `Ref_TC_014.png` | `Consumer App/Ref_TC_014.png` | 新包中已经存在；此前“本地缺图”只针对旧的 11-17 证据包，现予更新。 |

原始证据文件未改名、未移动。完整对应关系保存在 `C:/test_result/analysis-261119/evidence-mapping.csv`，机器可读核对结果为同目录 `evidence-audit.json`。本轮不包含“测试表没有填写任何证据引用”的用例，也不核验远端 Drive 可访问性。

## 唯一新增失败：Ref_TC_014

| 项目 | 内容 |
|---|---|
| 位置 | `Referral Consumer App`，第 36 行 |
| 场景 | 推荐奖励满足条件后自动入邀请人的 mTrip 钱包 |
| 上版 | `Status`、`Actual Result`、证据均为空 |
| 本版 | `Not Pass`；“Although required conditions are met, system do not automatically credited the reward to referrer's mTrip wallet” |
| 证据 | 新增 `Ref_TC_014.png` 的 Google Drive 链接；追加核查已在 11-19 新证据包 `Consumer App/Ref_TC_014.png` 找到本地文件，尚未据该图复现返利业务链路 |
| 日期限制 | `Test Date` 仍是 `2026-10-26`，没有补充步骤、站点、邀请双方或订单 ID；只能认定为本版新增报告，不能推断发生于 11 月 19 日 |

当前代码已经包含发奖链路，并非缺少整个功能：

- `backend/services/order-service/app/Service/Booking/BookingLifecycleService.php:192`：酒店订单办理入住核销时调用 `grantOnFirstBooking()`；仅完成注册或支付不会触发。
- `backend/services/order-service/app/Service/ReferralService.php:25`：只读取该被邀请人 `reward_status=0` 的绑定记录；金额按订单 `site_id` 精确读取 `referral_reward_inviter` / `referral_reward_invitee`。
- `ReferralService.php:51`：未配置的金额按 0 处理；`ReferralService.php:42`：即使金额为 0，仍将关系标为已发放。HANDOFF 的 2026-09-21 历史记录明确记载此行为当时按用户决定保留，不在本次核查中调整。
- `database/migrations/V20260921030000__add-referral-reward-config.sql`：初始奖励只为 MMK 站点补种子，不能假定任意站点均已启用或目标环境已执行迁移。

优先核查 QA 用例所用站点的奖励配置、实际订单是否经过入住核销、邀请绑定及奖励状态，再对照邀请人钱包批次/流水。截图文件现已补齐，但仍缺业务标识及环境核验，当前不能确认是配置、测试前置条件还是发奖链路异常；不能据此直接补发或修改余额。

## 新增用例与状态变化

新增 66 条用例全部在消费者 App；其中 21 条通过，45 条结果为空，没有新增用例被标失败。

| 页签 | 新增 ID | 新增数 | Pass | 结果为空 |
|---|---|---:|---:|---:|
| Login Consumer App | `L_TC_015–059` | 45 | 19 | 26 |
| Register Consumer App | `R_TC_019–027` | 9 | 2 | 7 |
| Home Consumer App | `Home_TC_012–023` | 12 | 0 | 12 |
| 合计 | | 66 | 21 | 45 |

新增覆盖忘记密码、OTP、社交登录异常与条款入口、注册推荐码、首页布局和导航；空结果代表尚无测试结论，不能列为已发现缺陷。Home/Account/Contact Us 中此前已编写而尚未填写结果的客服、注销和换绑用例，本版仍未提供验收结论。

现有用例共有 61 条发生字段变化，16 条更改了测试状态：

| 变化 | 用例 | 条数 |
|---|---|---:|
| 空白 → Not Pass | 消费者 `Ref_TC_014` | 1 |
| Not Pass → Pass | 消费者 `CH_TC_002`；商户物业 `AP_TC_020/021/022`；消费者 UI `UI/UX_TC_002/004/005/006` | 8 |
| Need enhancement → Pass | `MTW_TC_008`、消费者 UI `UI/UX_TC_003` | 2 |
| Not Pass → 空白 | `H_TC_058`、`MTW_TC_006`、`N_TC_018/019/020` | 5 |

地图、钱包过期流水和三项短信通知的状态被清空，并未标成通过，不能据此关闭。

以下为按「页签 + ID」统计的原始行数，不是去重后的业务问题数量。`Guest Mode` 夹有后台 `CP_TC_*` / `SA_TC_*` 用例，且历史上与超管专用页签存在重复场景；跨端总数不能直接作为独立缺陷数。

| 范围 | 版本 | 用例数 | Pass | Not Pass | Need enhancement | 结果为空 |
|---|---|---:|---:|---:|---:|---:|
| 全表 | 上版 | 981 | 349 | 343 | 8 | 281 |
| 全表 | 本版 | 1047 | 380 | 331 | 6 | 330 |
| 消费者 App（含 UI、Guest；排除 Guest 内后台 ID） | 上版 | 517 | 196 | 47 | 4 | 270 |
| 同上 | 本版 | 583 | 224 | 38 | 2 | 319 |

## 测试文档中需要校正的内容

| 位置 | 问题与建议 |
|---|---|
| 新增 `L_TC_022/023`，Login 第 52/54 行 | 新密码期望仍写 6–12 位。当前前后端共同规则是 6–32 位、至少一个大写字母及一个数字，见 `UserAuthService.php:23` 与 `client-app/src/utils/validate.ts:37`；旧 `R_TC_012` 也保留了 6–12 位描述。 |
| 新增 `L_TC_032`，Login 第 72 行 | 将注册/重置的复杂度规则用于登录。当前登录刻意兼容旧密码，只做 6–32 位长度校验，见 `validate.ts:42`；应区分设置密码与登录密码。 |
| 新增 `Home_TC_016/023`，Home 第 40/54 行 | 步骤写“Login to consumer app”，却验未登录会员卡。`HomeScreen.tsx:172` 只在未登录时渲染会员卡；`Home_TC_023` 又把 Login/Sign Up 的期望写成酒店搜索页，实际入口应去登录。需修正前置状态与目标页面。 |
| `AP_TC_020/021/022`；消费者 UI `UI/UX_TC_002–006` | 共 8 条已改 Pass，但 Actual Result 仍是原失败现象。建议补复测结果或在 Actual Result 标注旧记录，避免同时表达通过和失败。 |
| `Lite_TC_003`，Accessibility 第 14 行 | 证据名从 `Lite_TC_003.png` 改成 `L_TC_003.mp4`，Drive 链接也改变。追加抽帧已确认视频内容为 Lite 订房，当前链接内容匹配；Facebook 登录截图实际保存在 `Lite_TC_003.png`，属于证据文件名错位，详见追加核查。 |

## 与旧问题的关系

- `H_TC_115` 多酒店付款倒计时、`AP_TC_028` 已标可见酒店在 App 缺失、`Ref_TC_015` 邀请链接、超管 Campaign Platform，以及旧社交登录/短信条目没有新增失败状态或新的失败描述；不应重复计为本轮新增。
- `MV_TC_011`（Merchant Verification 第 30 行）新增 Development Status=`Completed` 和取消单独 KYC 请求步骤的开发说明，但 QA `Status` 没有改变；开发完成标记不等于 QA 已复测通过。
- `L_TC_003/004` 等旧社交登录失败与本版新增部分社交登录子步骤 Pass 同时存在；单独的条款/取消/跳转步骤通过，不能自动关闭整个登录链路。

`Ref_TC_014` 截图文件已在新包中找到；下一步结合该图与 QA 站点及订单/邀请用户标识，确认发奖前置条件和配置后复现；其余新增项先补执行结果，并同步纠正文档口径。

## 可复核性

使用 Python/openpyxl 按表头字段解析，跳过空行与汇总页，并核对链接/批注/公式差异。全部用例都能按页签及规范化 ID 唯一匹配；数量与状态转移的恒等关系已校验。输入文件保持原样，未回写 Development Status。

本机逐行数据与差异保存在 `C:/test_result/analysis-261119/{baseline,latest,diff}.json`。输入 SHA-256 见上述 `baseline.json` / `latest.json`，便于确认对比版本。
