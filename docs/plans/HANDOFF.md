# 会话交接文档(HANDOFF)

> 用途:当 AI 会话上下文超限需要新开会话时,新会话**第一步读取本文件**即可接手全部工作。
> 维护约定:每完成一个模块或阶段性节点,同步更新本文件的「当前进度」与「下一步」两节。
> 最后更新:2026-08-02(**需求基准已切换**:见下方「★ 需求基准变更」)

## ★ 需求基准变更(2026-08-02,新会话先看这条)

**唯一真需求已切换为 `设计文档/mTrip_ Consumer App PRD_v1.0.md`**(缅甸 C 端酒店预订超级 App);旧三份 docx 仅框架期设计,现有 8 服务/54 表为可复用底座。
- 权威落地文档:[实现方案-ConsumerApp-PRDv1.0.md](./实现方案-ConsumerApp-PRDv1.0.md)(重新定基 + M0~M4 里程碑 + 建表 DDL + PRD 覆盖矩阵 + 遗留清单)、[差距分析-ConsumerApp-PRDv1.0.md](./差距分析-ConsumerApp-PRDv1.0.md)。
- **进度:在 `dev` 分支已实现 M0~M4 + admin 管理端,每增量 `scripts/check.ps1` 四步全绿;PRD 四层(数据/后端/C端/admin)整体闭环。三项架构级 A1 退款钱包化 / A2 Trip 多酒店 / A3 促销出资分账全部落地。**
- 遗留(非首发,均需第三方/产品决策):通知 Push/SMS/Email 多渠道分发、正式 Stripe/PayPal 收单(现 mock)、cops 页 i18n 词条、Phase2 AI/保险——详见实现方案文末「遗留清单」。
- 提交约定:本轮为逐增量本地 `check.ps1` 验收后由用户在 dev 分支统一 commit。
- **续作入口(下次开会话先看)**:[续作-ConsumerApp-下一步与提示词.md](./续作-ConsumerApp-下一步与提示词.md)(剩余待办 + 可直接复制的新会话提示词)。

> 下方第 1~7 节为旧三份 docx 期(框架层)的历史交接,作为底座背景保留。

## 1. 项目一句话

Mtrip 海外旅游 SaaS 平台:后端 Hyperf 3.1 微服务(backend/)+ 平台管理后台 Vue3(admin-web/)。**当前需求基准为 Consumer App PRD v1.0(见上方「★ 需求基准变更」)**;`设计文档/` 旧三份 docx 为框架期底座背景。

## 2. 当前进度(与 docs/plans/README.md 保持一致)

| 模块 | 状态 |
|------|------|
| 01 backend/shared 共享组件包 | 100%(单测于模块08-8 补齐:26 用例全过,修复 2 个 bug) |
| 02 system-service 系统服务 | 100% |
| 03 数据库 DDL + 种子数据 | 100%(两库 54 表,本机 MySQL 8.0.29 验收通过) |
| 04 admin-web 框架 | 100% |
| 05 管理后台系统页面 | 100%(14 页面,npm run build 零 TS 报错) |
| **06 业务微服务** | **100%(七服务全部完成,八服务 175 文件 php -l 零错误;Docker 联调归模块08)** |
| **07 管理后台业务页面** | **100%(07-1~07-6 全部完成,npm run build 终检零 TS 报错;接口联调归模块08)** |
| **08 部署与网关联调** | **部分完成 80%(权限键统一/deploy 基础设施/shared 单测/08-6 启动验证四步全过(2026-07-30);剩余 08-7 全链路联调,清单见 08 计划文件)** |
| 09/10 移动端 | 100%(09 三服务 C 端接口 / 10 client-app 全量落地;冒烟联调归模块08) |

各模块详细任务清单与完成记录:`docs/plans/01~10-*.md`;开发规范:`docs/guides/`。

## 3. 环境与操作注意

- Windows + PowerShell:命令分隔符用 `;`,**禁用 `&&`**。
- PHP 仅用于语法检查:`D:\BtSoft\php\80\php.exe -l 文件`(服务实际跑 Docker,联调归模块08)。
- 前端构建:cwd 必须在 `D:\GIT\jiaxu\MTrip\admin-web` 下执行 `npm run build`(vue-tsc + vite,要求零 TS 报错;echarts 已实际引用,chunk 约 522KB 属正常)。
- 数据库脚本目录是 `database/`(DDL 按服务分目录,种子在 `database/seed/`)。每个脚本**头部自带 `USE \`mtrip_xxx\`;` 且幂等**(`CREATE TABLE IF NOT EXISTS` / 守卫式 `ALTER`),可单独重复执行。
- **【硬约定】新增任何 `database/**/*.sql` 后,必须同步登记到 `deploy/docker-compose.yml` 的 mysql `docker-entrypoint-initdb.d` 挂载列表**,编号体现执行顺序(建表在种子前、被引用表在关联表前)。initdb **只在空数据卷首次启动时执行**——漏登记的脚本在全新环境永不建表(2026-08 曾漏挂 merchant 集团/RBAC 共 6 个脚本,导致 `merchant_group` 等表缺失)。
- **增量更新已跑起来的库,不必 `down -v` 重建**:脚本幂等,直接灌进运行中的容器即可。单文件 `Get-Content database/xxx.sql | docker exec -i mtrip-mysql-1 mysql -uroot -proot@2026`;批量用 `scripts/db-apply.ps1`(见「常用命令」)。只有想彻底清库重来时才 `docker compose down -v; docker compose up -d --build`。
- **【硬约定】新增一个「二级模块」路由(`/api/v1/{admin|app|merchant|supplier}/{模块}/*`)后,必须同步在网关 `deploy/openresty/conf.d/mtrip.conf` 对应的 `map $*_module $*_upstream` 里登记「模块 → 上游服务」**,否则网关命中 default `""` → 404(接口和服务都正常也白搭)。改完 `docker compose restart gateway` 生效。2026-08 曾漏登记 admin 的 `config`/`chat`、app 的 `theme`/`chat`/`marketing` 共 5 处。核对口径:各服务 `config/routes.php` 的 `addGroup` 前缀 / 路由第一段 ↔ 四张 map 的键。
- 遗留待用户手动删除:`d:\GIT\jiaxu\MTrip\.tmp-mysql-verify\` 临时目录。

## 4. 后端关键约定(模块06 必须遵守)

- 统一响应 `{code, message, data}`,成功 code=0;分页返回 `data={list,total,page,pageSize}`,入参 page/pageSize 默认20最大200。
- 错误码:40101/40102 未登录(前端跳登录)、40301/40302 无权限。
- 字段命名:**请求入参驼峰;列表行 snake_case 直出**(例外:管理员列表/登录返回/统计返回为驼峰)。
- 路由前缀:管理端 `/api/v1/admin/{merchant|goods|order|finance|user|marketing|payment}/*`;移动端双前缀方案见 `docs/plans/09-移动端微服务.md`。
- 新服务的工程组织、代码风格(Controller/Model/Service、#[Inject]、验证、软删除、操作日志)**以 backend/services/system-service 为唯一范本**,共享能力用 backend/shared。

## 5. 前端页面代码模式(模块07 必须沿用)

- `useTable(fetcher, defaultQuery)` → `{loading,list,query,load,search,reset,pagination}`;模板中**禁用 as 断言与 TS 类型标注**(需类型的回调放 script 定义具名函数)。
- 页面结构:`PageContainer` > 筛选 `a-card`(a-form inline)+ 列表 `a-card`;Tab 复合页单 a-card 内 a-tabs + `.tab-toolbar`。
- 多表格 Tab 页多次调 useTable,模板访问 `xxx.list.value / xxx.loading.value / xxx.pagination.value`(非顶层 ref 不解包)。
- 弹窗表单:`reactive form` + openCreate/openEdit(Object.assign)+ `editingId=0` 判新增;密钥字段编辑回显空串=保留原值。
- 高危操作 `a-popconfirm`;更高危用专用 Modal + 必填备注;`isSuper = userStore.profile?.isSuper === true`;StatusTag `:value/:map`;SiteTreeSelect 单选可 allow-all。
- v-for 动态编辑行 :key 用 indexOf,不可用可变字段。
- 动态路由:`router/dynamic.ts` 用 import.meta.glob 按菜单 component 字段解析 `views/{component}.vue`,菜单 seed 在 `database/seed/02-menu.sql` —— **新增页面目录必须与菜单 component 完全一致**。
- **多语言**(vue-i18n,默认/fallback 均 en-US):en-US.ts 为全量词条源,zh-CN.ts 只维护已翻译部分;菜单三字段 `menu_name`(中文)/`menu_name_en`(英文回退)/`i18n_key`(词条 key,目录与页面必填、按钮不占词条);显示名统一走 `locales/menuI18n.ts` 的 `resolveMenuTitle/menuTitle`(i18n_key 命中→t(key),未命中→非中文环境用英文名、中文用中文名);扩展新语言只需前端加语言包+SUPPORTED_LOCALES,菜单数据与后端零改动;详细规范见 `docs/guides/standards/README.md`。

## 6. 下一步(模块08 部署与网关联调,任务清单见 docs/plans/08-部署与网关.md)

模块06/07 已收官,以下为沉淀的关键结论(模块08 仍需使用):

- **服务分工**:goods/order/user-service 已存在(C端接口,模块09预建),管理端接口在原服务内补充;merchant/finance/marketing/payment 四个服务新建。
- **端口**:system=9501、user=9502、goods=9503、order=9504、merchant=9505、finance=9506、marketing=9507、payment=9508。
- **业务服务代码风格**:Db::table 直查(不建 Model);管理端路由 `Router::addGroup('/api/v1/admin', ...)` 挂 AdminAuthMiddleware+OperationLogMiddleware;写接口加 `#[Permission('xxx:yyy')]`;入参驼峰、列表行 snake_case 直出;新服务骨架照抄 goods-service 配置模板改名改端口。
- **管理端基类范本**:merchant-service 的 AbstractController(pageSize 200 + applySiteScope/assertSiteScope + encryptField/decryptField),后续服务直接复用该模式。
- **库存机制**:goods_daily_stock + order-service OrderStockService(lock/deduct/release/refundRestore,变动写 goods_stock_log);退款到账确认全额退回补库存 change_type=4(部分退款不回补)。
- **重要陷阱**:order_main 无 sku_type 列,SKU 维度订单校验用 order_type(1酒店2门票)+sku_id。
- **骨架复制法**:新服务由 finance-service 整目录 Copy-Item 复制,删业务控制器后改6处差异:composer.json 名称描述、Dockerfile(名称/路径/端口)、bin/hyperf.php 注释、config.php app_name、server.php 端口、routes.php 整个重写。
- **payment-service 定位**:仅渠道抽象(app/Payment/PayChannelInterface)+ Stripe/PayPal 空实现 + 回调落日志应答 200;正式验签/收单对接归模块08;渠道配置 CRUD(sys_pay_channel)在 system-service。
- ~~**权限键错位陷阱**~~ ✅ 已于 08-2 解决:shared `Permission` 注解支持 `string|array` 多键任一匹配(`hasAnyPermission`),业务五服务 53 处注解键全改菜单种子 perm_key(83 键全部对齐 02-menu.sql)。共用接口双键:goods 酒店/门票 `['goods:hotel:x','goods:ticket:x']`、供应商结算 `['supplier:settle:x','finance:ssettle:x']`;提现审核/打款复用 `finance:msettle:confirm|pay`;order 备注降为页面级 `order:all:list`。
- **占位页策略**:router/dynamic.ts 的 resolveComponent 对未实现页面自动回退 views/wip/index.vue,无后端接口的菜单页(merchant/perm、supplier/report、user/level、user/log、finance/tax、marketing/activity|banner|points、verify/device|rule、order/export)不建文件。
- **统计接口(07-6 新建,联调需验证)**:order-service `GET /api/v1/admin/order/stats/dashboard`(大屏)、`GET /stats/report?dim=site|merchant|goods`(四维报表前三维);finance-service `GET /api/v1/admin/finance/report?year=`(财务年报);均只读无 Permission 注解;大屏口径:已支付=order_status IN(1,2,3)、待结算=settle status IN(0,1)、成功流水=flow_status=1;join merchant_info 时列名全限定(两表同有 site_id/created_at/deleted_at)。
- **EChart 封装**:`components/EChart.vue`(props option/height,echarts/core 按需注册 Line/Bar/Pie),页面用 `computed<EChartsCoreOption>` 构造 option。

待办顺序:

1. ~~模块06 七服务~~ ✅ / ~~模块07 业务页面~~ ✅ 全部完成(详见各计划文件完成记录)。
2. **模块08 部署与网关联调**(docs/plans/08-部署与网关.md):
   - ~~权限键前后端统一~~ ✅ 08-2 完成。
   - ~~deploy/ 目录~~ ✅ 08-3~08-5 完成:docker-compose.yml(MySQL 3307/Redis 6380/八服务/网关 8080,18 SQL 编号挂载)+ openresty/(map 路由表按 admin/app 二级模块分发、CORS 含签名头、限流 30r/s、错误 JSON)+ .env.example + k8s/ 预留;vite proxy 改指 8080。
   - **08-6 启动验证 ✅ 2026-07-30 完成**:Docker 29.6.2/Compose v5.3.1 就绪,按 deploy/README.md 第 4 节四步验证全部通过(11 容器全 Up、八服务 healthz ok、网关 **8081** 无签名 POST 返 401 符合预期、MTRIP_SUBMIT_* 注入生效),实际输出记录在 08 计划文件完成记录;**08-7 全链路联调待执行**(登录/CRUD/大屏 → 移动端冒烟 → ClientSignMiddleware 签名链路),完成后模块08 升 100%。启动指南:`docs/guides/setup/启动开发指南.md`。
   - **开发期热更新**:`deploy/docker-compose.override.yml`(compose 自动合并)已把本地 app/、config/、shared/src/ 挂载进容器,各服务日志挂出到 `deploy/logs/<服务名>/`(宿主机直查,已 gitignore);Hyperf 常驻内存,改代码后 `docker compose restart xxx-service`(约 2 秒)生效,仅新增 composer 依赖/改 Dockerfile 才需 `--build`;生产用 `-f docker-compose.yml` 显式指定跳过 override。详见启动指南 2.2 节;Windows 装 Docker Desktop/配 WSL2 见启动指南 2.0 节。
   - ~~shared 包单测~~ ✅ 08-8 完成:`backend/shared/tests/`(bootstrap 自加载+Hyperf 桩,无 vendor 可跑),`D:\BtSoft\php\81\php.exe backend/shared/tests/run.php` 26 用例/96 断言全过;顺带修复 CryptoHelper 空串解密边界(29→28)与 OrderNoGenerator 同毫秒碰撞(随机改自增序列)2 个 bug。
3. 每完成一阶段:更新 08 计划文件 checkbox、README 进度表、本文件。

## 7. 新会话接手提示词(用户复制粘贴用)

```
请先读取 docs/plans/HANDOFF.md 和 docs/plans/README.md 了解项目全部进度与约定,
然后读取 docs/plans/08-部署与网关.md。Docker 环境已就绪,请按其中「恢复联调清单」
执行 08-6 启动验证与 08-7 全链路联调,修复发现的问题。
工作方式不变:每完成一项任务同步更新 docs/plans/ 对应模块文件、README 进度表和 HANDOFF.md。
后端约定见 HANDOFF.md 第4节,前端模式见第5节,模块08 关键事项见第6节。
```

