# M12 S5：酒店市场排名与热门目的地交付

日期：2026-08-28。基线：dev / b924cb6（S4及商户看板修复已本地提交）。本阶段未执行 Git 暂存、提交或推送。

## 1. 交付范围

依据 Super Admin Portal 中文 PRD 模块12、00-design.md 第8节及已确认 D4：酒店优先，餐厅和具体通知服务商继续延期。

- 酒店排名使用显式关联的注册酒店业务、酒店物业和同一商户的已上架酒店商品，不根据名称、默认主门店或商户自动猜测关系；一个物业/酒店商品只能有一个排名关联，房型不单独排名。
- 市场范围为站点＋hotel＋规范国家代码＋规范城市；热门目的地为站点＋区域。平台超管也必须指定具体范围，不允许 siteId=0 全局发布。非超管读接口强制本站点，写接口仅允许授权超管。
- 置顶 pinned、精选 featured 分离；置顶优先，其次精选、普通；双标记只进入置顶组一次；组内按 rank、id 稳定排序。完整同组重排，跨组/跨市场/重复/遗漏 ID 拒绝，不设固定排名数量上限。
- 每个市场有独立草稿版本和发布快照；expectedVersion 校验、市场行锁、事务内审计。保存草稿不改变线上；发布仅替换当前范围快照。历史有真实站点、市场、版本、操作人、时间、原因及前后配置。
- 酒店名称、商户、资格、评分和价格来自实时实体。商户暂停、拉黑、物业停用、KYC撤销、物业展示资格关闭、酒店商品下架/归属变化，读取时立即过滤，不自动重写人工排序。
- 物业展示资格是实时门禁，独立于排名草稿显示状态，带物业版本和专用历史；关闭立即影响线上。开启资格不审批或激活商户/商品，也不自动发布排名。
- 目的地支持站点/区域隔离、名称搜索、状态筛选、新增编辑、精选、完整组排序、独立发布、预览和历史；名称/图片/副标题/搜索国家城市全部随发布快照隔离，不套用商户KYC。
- 管理页保留项目 PageContainer、卡片、标签页、表格、弹窗/抽屉结构；中英文文案、对应 v-perm、只读资格详情、商户档案跳转、版本/最后操作信息及原因确认。
- 消费者首页真实热门目的地与酒店推荐；目的地点击带国家/城市进入酒店结果页。酒店搜索默认遵循已发布排名，明确价格/评分排序保持用户选择；搜索/首页/详情统一执行实时资格。酒店结果和目的地为空时不再用演示数据冒充结果。

## 2. 存储与接口

31-merchant-marketplace.sql 为可重复执行增量：

- ranking_market：唯一市场键、草稿version、published_version、published_json、更新/发布人及时间。
- ranking_listing：market_id、property_id、goods_id、独立pinned；物业/商品唯一约束。保留旧表字段兼容历史，但新读取不采用演示快照字段。
- ranking_destination：market_id、搜索目标国家/城市。完整目的地文案写入发布快照，防止编辑泄漏。
- ranking_history：market_id、version、before_json、after_json。
- 历史 market_id=NULL 的6条酒店演示行及旧目的地记录原样保留，不迁移、不删除、不自动发布。新建数据库初始化挂载为 compose 39m，已有库需单独执行31迁移。

后台 `/api/v1/admin/merchant/ranking`：

| 方法/路径 | 用途/权限 |
|---|---|
| GET list、destinations | 当前完整市场草稿及版本，merchant:ranking:list |
| GET candidates | 当前酒店市场的真实物业、同商户已上架酒店商品选项 |
| GET preview | view=draft/published，共用消费者安全投影和资格判断 |
| GET history | 当前市场分页审计记录 |
| POST listing/add | 显式物业→酒店商品关联，merchant:property:bind |
| POST property-display | 实时展示资格开关，merchant:property:bind；expectedPropertyVersion |
| POST save-order | 完整同组 ids 顺序，merchant:ranking:save |
| POST pin、destination/pin | 分离的置顶/精选/草稿显示标记，merchant:ranking:save |
| POST destination/add、destination/update | 目的地文案及搜索目标，merchant:ranking:add |
| POST publish | 仅当前市场原子发布，merchant:ranking:publish |

所有排名/目的地写接口要求明确范围、expectedVersion及note；物业资格接口使用独立物业版本。旧的无范围/无版本调用不再兼容，前端已同步升级。

消费者继续复用 goods/home、goods/list、goods/detail；home 新增 destinations，list 支持 countryCode/cityKey。默认无城市时按稳定国家/城市顺序组合各市场，不跨市场比较组内名次。首页推荐8张卡是展示数量，不是排名容量上限。

## 3. 本阶段顺带修复的阻断问题

1. 商品列表现有 applyFilters/applySort 调用缺失的 floatInput，导致实际请求失败；补充数值读取及非法数字校验，消费者真实 SQL 测试覆盖。
2. 重复并发测试暴露 insertOrIgnore 已存在市场后共享锁升级为排他锁的死锁；已存在市场直接排他锁，首次创建才尝试插入，连续5轮回归验证。
3. 删除酒店结果演示兜底后清理对应死代码/样式；首页切换站点和酒店筛选切换时用请求版本阻止旧响应覆盖新范围。
4. 从排名详情跳转商户档案，目录页按明确 merchantId 打开真实详情，后端仍执行数据权限。

未改动平台统计 AdminStatsController 的既有 groupByRaw 问题，未触碰原商户 ReviewController 修改。

## 4. 验证结果

| 验证 | 结果 |
|---|---|
| scripts/test-m12.ps1 | 395项通过：既有314项＋S5商户60项＋S5消费者21项 |
| S5商户套件重复5轮 | 300次检查通过；包括真实双进程竞争，只允许一个成功、一个409冲突 |
| scripts/check.ps1 | 310个PHP文件语法通过；58用例/858断言通过；admin-web构建、client-app类型检查通过 |
| 增量迁移重复执行 | 通过；已有业务记录不补猜关系、不转为公开数据 |
| Git diff --check | 通过；暂存区为空；HEAD仍为b924cb6 |
| 原5个无关文件SHA-256 | 全部保持进入S5时的值 |

S5主要集成覆盖：明确市场、非超管限制、伪造站点、跨城市/国家、未启用资格、重复关联、旧版本、缺失/重复/跨组排序、优先组与双标记、发布前后隔离、预览与消费者完全一致、实时暂停/拉黑/KYC/物业/商品资格、真实名称价格评分、目的地文案隔离/精选/隐藏、非法图片协议、审计故障发布回滚、并发胜出唯一性、历史分页、150行稳定排序无硬上限，以及消费者默认/价格/评分排序、分页、筛选、详情隐藏、既有门票路径。

测试严格使用 mtrip_m12_s1_test；结束后按本轮捕获ID清理。复核测试市场及S5酒店夹具为0。业务库仍为0酒店商品、17物业、6旧酒店演示行、0新市场，本阶段未创建真实发布内容。

构建仅保留既有包体积提示。没有安装新依赖。

## 5. 浏览器验收与未验项

- 已用现有已登录 Chrome 后台验证：仅酒店/目的地两标签；未加载范围时发布/预览禁用；明确站点国家城市加载成功；真实空数据和版本v0；预览弹窗、草稿/已发布切换；切换目的地范围后清空旧市场并禁用写入。部分 Ant Design 控件的语义点击超时，使用同浏览器的可见界面操作确认状态。
- figma.site 链接不是带节点的 Figma 设计文件，无法取得 get_design_context。已请求补充设计节点；本阶段沿用现有组件和布局体系，**未声明像素级原型验收通过**。Figma技能约束使未取得的原型细节不被猜测成验收依据。
- 开发库无真实酒店商品，未在业务库造假酒店用于页面演示；**有数据情况下的浏览器拖拽、绑定/发布提交及完整消费者页面端到端仍待人工/独立验收环境验证**。这些规则已通过真实数据库和控制器测试，但不等同于完整UI验收。
- client-app 未启动移动端/Expo进行设备实测，只完成类型检查和消费者接口集成。其他首页静态区块、历史收藏列表不在本阶段整改范围；酒店详情仍受资格门禁保护。
- 此轮不代表整个模块12完成；S6合规、S7整体回归及既有S1—S4未验项继续保留，餐厅和外部通知服务商继续延期。

## 6. 本地操作说明

1. 先完成商户及酒店业务KYC，并在商户档案显式关联物业，填写正确国家/城市；同商户需有已审核上架的酒店商品。
2. 市场排名选择具体站点、国家、城市并加载。在“关联酒店 / 展示资格”中选物业，确认实时展示资格，再选同商户酒店商品并填写原因关联。
3. 调整置顶/精选、显示和组内顺序。清空筛选才可拖动。保存只改变草稿；通过草稿预览后，填写原因发布当前市场。
4. 目的地另选站点/区域，填写文案及点击后的酒店搜索国家/城市；单独发布。它不会顺带发布酒店排名。
5. 撤销物业实时展示资格会立即隐藏线上酒店；草稿显示/排序和目的地文案编辑需发布后才生效。版本冲突必须刷新审阅，不自动重试覆盖。

本地商户/商品服务已重启健康。存量库上线顺序：备份并评审→执行31迁移→部署共享读取/两服务及前端→重启并等待健康→显式配置真实酒店→预览→按市场发布。本阶段只做本地开发验证，不是生产上线，也未代用户绑定或发布任何真实酒店。回退需保留新表和快照供审计，不可直接删除历史；不要只回退消费者代码而重新暴露演示或无资格酒店。

## 7. 变更清单与Git

本阶段不执行git add/commit/push。后续可由用户操作，或另行授权阶段提交；推荐提交标题：`feat(merchant): 完成 M12 S5 酒店市场排名与目的地发布`。

本阶段共29个文件：

```text
admin-web/src/api/marketplace.ts
admin-web/src/api/merchant.ts
admin-web/src/locales/en-US.ts
admin-web/src/locales/zh-CN.ts
admin-web/src/views/merchant/list/index.vue
admin-web/src/views/merchant/ranking/index.vue
backend/services/goods-service/app/Controller/AbstractController.php
backend/services/goods-service/app/Controller/GoodsController.php
backend/services/goods-service/test/m12-marketplace.php
backend/services/merchant-service/app/Controller/RankingController.php
backend/services/merchant-service/app/Service/MarketplaceService.php
backend/services/merchant-service/config/routes.php
backend/services/merchant-service/test/m12-s5.php
backend/shared/src/Merchant/MarketplaceReader.php
client-app/src/api/goods.ts
client-app/src/navigation/types.ts
client-app/src/screens/home/HomeScreen.tsx
client-app/src/screens/hotel/HotelResultsScreen.tsx
client-app/src/types/models.ts
database/merchant/31-merchant-marketplace.sql
deploy/docker-compose.yml
docs/plans/15-M12-merchant-management.md
docs/plans/HANDOFF.md
docs/plans/m12/01-tasks-and-tests.md
docs/plans/m12/06-s5-delivery.md
docs/plans/m12/CHANGELOG.md
docs/plans/README.md
README.md
scripts/test-m12.ps1
```
