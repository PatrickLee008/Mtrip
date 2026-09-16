# 客房整改阶段记录

## 阶段 0：2026-09-16

- 只读审计本机 Docker MySQL 的 mtrip_business / mtrip_system。
- 7 个站点：1–4 为 EUR，5–7 为 MMK；未删除房型 0 条，退款规则 0 条。无需存量金额、面积、床型或媒体回填；其他环境部署前应重复审计，不据此推断生产数据为空。
- 物理总数 base_stock，缺省可售 launch_stock；现有日库存优先且不被房型审批覆盖。周末沿用当前商户日历的周五/周六，三处共用日期规则。
- area 仍以平方米存储，新增 area_unit 记录展示单位；sqFt 在编辑器中双向换算。旧非数字面积不静默重写。
- 新结构随 revision payload 审核；images 维持 URL 数组兼容，完整图片顺序/分类存 image_gallery。本地全景、外部 VR、平面图分开配置。
- 状态独立：紧急停售增加状态版本号，审核仅在版本未变时采用提交状态。
- 退款策略按明确的 ruleType/rules/remark 配置；批准时更新房型退款规则，新订单冻结快照，既有订单不追溯改动。旧文本保留，不自动推断阶梯。
- 上传附件按 site_id/property_id 登记，保存和提交时核验类型及归属。文件不做物理删除，避免破坏已批准版本、历史和复制房型引用；公开上传目录沿用既有策略，客户业务响应仅含批准且启用配置。
- 不修改 merchant-app/client-app；无外部 VR/PMS 服务商接入。

## 验证记录

阶段 1–5 已完成：

- 商户端完成 Figma 卡片列表、四项真实指标、筛选排序、More Details 和四步编辑弹窗；旧的新建/编辑/详情路由复用同一实现，复制、启停、删除审核和历史仍可用。
- 四步编辑支持多床型、sqm/sqFt 展示换算、客房设施、餐食枚举、默认可售配额、可执行取消政策、图片拖放/排序/分类/封面/替换/删除、视频、WebGL 全景预览和平面图热点。
- 后端补齐物业请求上下文、媒体归属与真实内容校验、房量/人数/面积校验、审批期间紧急停售保护、删除前及批准时的进行中订单检查，并串行化房型编码唯一性。
- 缺失日库存统一使用 `launch_stock`，周五/周六使用有效 `weekend_price`，显式日库存始终优先；商户日历、消费者日历和下单锁库共用同一规则。
- 取消政策批准后投影到 `goods_refund_rule`，新订单冻结结构化快照；修改政策不追溯已创建订单，旧的 JSON 字符串快照仍可执行。
- 管理后台房型审核已展示新结构差异及图片、视频、全景、VR 封面和热点预览；入口仍为“商品管理 → 商品审核 → 房型审核”，权限 `goods:audit:audit`。
- 消费者房型只返回已批准且在售的白名单字段与已启用媒体；退款仍以现有 `refundRules` 为执行契约，不暴露商户审核状态、内部库存、版本号或重复的 `refund_policy`。

最终验证：

- `scripts/test-room-remediation.sh` 输出 61 个通过场景，覆盖房型审核、内容校验、媒体、库存报价和退款快照；迁移在一次性数据库中连续执行两次。
- 物业发布/消费者发现隔离回归通过，包含消费者房型字段白名单断言；shared 95 用例/957 断言全部通过。
- backend 389 个 PHP 文件语法检查、merchant-web/admin-web 生产构建和 client-app 类型检查通过；两个 Web 仅有既有大 chunk 警告。
- admin-web 临时开发服务中，房型审核组件及其复用的全景/平面图组件均可由 Vite 正常转换加载；5175 临时进程已停止。
- OpenResty `nginx -t`、迁移命名校验和 `git diff --check` 通过；本地迁移账本 18 已执行、0 待执行。
- 桌面宽度和约 430px 窄屏已检查列表及四步弹窗；临时视觉夹具和 5174 Vite 进程已清理。

限制：当前没有外部 VR/PMS 服务商，外部 VR 配置可保存且校验 HTTPS，但启用会明确拒绝；PMS/CM 保持后续独立阶段。本轮没有修改 `merchant-app/**` 或 `client-app/**` 功能代码。

## 物业上下文格式修复

- 首次进入客房管理时，酒店选项及 All Properties 列表请求错误发送 `X-Mtrip-Property-Id: 0`；商户鉴权中间件契约为“未选择时省略请求头，选择后只接受正整数”，因此在房型控制器执行前返回“物业上下文格式不正确”。
- `merchant-web/src/api/rooms.ts` 现仅在 `propertyId > 0` 时生成显式物业头；All Properties 省略该头，已有全局物业选择仍由通用请求拦截器补入。merchant-web 生产构建和 `git diff --check` 通过。

## 列表样式修复（搜索框高度 / 卡片图片遮挡）

用户报两个视觉问题，均在 `merchant-web/src/views/rooms/index.vue` 修复。先用无头 Chrome 对真实 antd 组件量取修复前后尺寸（探针已删除，未入库）：

- **搜索房型输入框与搜索图标高度不一致** → 按用户要求**去掉右侧搜索图标，只保留输入框**。改前实测：`.ant-input-search` 外层 44px，内部输入框 34px，搜索图标按钮只有 32px。原因是 antd 的 `.ant-input-search .ant-input-search-button{height:32px}`（特指度 0,2,0）盖过全局 `.ant-btn{height:34px}`（0,1,0），而全局 `.ant-input{min-height:34px !important}` 连带把 affix 包裹层撑到 34+8+2=44px。现改为仓库既有写法 `<a-input class="room-search" allow-clear @press-enter="search" />`（与订单/评价/通知/促销/收益页一致，回车触发查询；`class` 由 antd 落在 `.ant-input-affix-wrapper` 上），DOM 里不再有 `.ant-input-group` / `.ant-input-search-button`（实测两者均为 false）。样式仅保留两条：`.toolbar :deep(.room-search){width:260px;height:34px;padding-top:0;padding-bottom:0}` 与 `.toolbar :deep(.room-search>input.ant-input){height:100%;min-height:0 !important}`（去除上下内边距 + 中和内层输入框的全局 `min-height`，否则包裹层仍会虚高到 44px）。修复后实测：输入框 260×34、顶底 13/47，与同排下拉框同为 34px 控制高度。
- **客房卡片图片高度异常并遮挡客房信息**。实测修复前：`.cover` 200px，`<img>` 渲染 597.33px，向下溢出 397.33px；`.cover` 是 `position:relative` 的定位元素，溢出部分绘制在 `.room-body` 文字之上——`elementFromPoint` 落在客房信息处返回 `IMG`，即图片确实盖住了文字。根因是 `.cover` 用 `display:grid;place-items:center`，行轨为 auto 而图片 `height:100%` 解析成固有尺寸（与同项目 `properties/index.vue` 的 `.property-image` 块级容器写法不同）。修复：`.cover` 改 `display:flex` 居中并补 `overflow:hidden`，图片 `display:block;width:100%;height:100%;object-fit:cover;object-position:center`。修复后实测：图片 200px＝容器 200px，溢出 0，客房信息处 `elementFromPoint` 返回文字节点。窄屏 `@media(max-width:650px)` 的 `.cover{height:210px}` 一并跟随，无需另改。
- 验证：merchant-web `npm run build`（vue-tsc + vite build）通过，仅有既有的 antd/echarts 大 chunk 警告；修复前后截图对比确认搜索栏只剩输入框、图片按 200px 裁切且客房信息完整可见。
