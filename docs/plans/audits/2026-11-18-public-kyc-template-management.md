# 平台配置公共 KYC 模板管理

需求依据：用户已确认的公共模板管理方案；Super Admin PRD v1.0.14 M11（选择、分配及管理 KYC 要求）与 M18（商户文件模板管理、授权、审计、保护已有申请）。

## 方案与实施步骤

- [x] 在平台配置“商户入驻要求”中接入模板管理，支持主体／物业、业务类型、站点和状态筛选，新建、复制、编辑、启停、版本历史和文件清单预览；独立地址与动态菜单 component 一致。
- [x] 复用 `merchant_kyc_template`，增加公共模板分组、版本、当前版本及变更人／动作／原因。编辑和启停均追加版本，不覆盖旧要求；候选与自动分配只使用当前启用版本，已有申请、正式物业继续读取其绑定版本，包括已停用或已被新版替代的版本。
- [x] 增加 `config:kyc:list/add/edit/status` 权限及同键菜单种子／迁移。平台配置读写权限独立于入驻审核；普通管理员仅能维护本站点模板，可读取公共及本站点模板，超管可维护全平台模板。复制创建新的模板组。
- [x] 加入隔离库红绿回归：无效文档、唯一标识／必填约束、范围／业务类型校验、站点隔离、过时版本拒绝、停用与历史读取、入驻候选联动及旧审核门槛。再跑真实 SFC 交互、既有入驻及平台配置回归、质量基线。
- [x] 备份双库与8090资源，按标准迁移发布本机，重启商户池并核对网关；真实页面与窄屏验收，临时管理样例不影响真实申请。同步模块、README和HANDOFF。

## 边界

不增加删除模板，不改变现有申请审批／签署／最终批准顺序。已绑定模板始终可读；停用只阻止后续选择。当前物业的独立编辑保留，不自动发布为公共模板。已有未提交改动与平台配置其他卡片保持兼容，不重置用户数据，不提交或推送 Git。

## 验证记录

- 隔离数据库先确认 RED（管理服务不存在），实现后验证模板组、追加版本、复制、actor/reason、重复文件标识／必填／范围校验、当前候选、旧绑定、物业私有编辑、停用、历史只读、站点隔离和旧接口拒绝越权；最终公共模板专项 47 项通过。菜单迁移重复执行及 component 路径已覆盖。新增脚本拒绝已存在的隔离库，哨兵数据保留实测通过。
- 审批回归按序运行，注册 66／KYC 75／最终批准 52 项通过，保持文档审核、电子签署与最终批准门槛。四套套件串行执行，避免容器共用 `/tmp/M12Bootstrap.php` 相互覆盖。
- 真实 SFC：公共模板 17／平台总览 13／入驻 32 项通过，涵盖失败保留草稿、取消不写入、权限撤销、旧公共编辑入口跳转、排序 0–9999、复制与历史预览。后台 `npm run build`（含 vue-tsc）通过，仅既有 bundle 体积提示；全量后端 PHP lint 545 文件、shared 282 用例／1928 断言、client-app typecheck 均通过，diff/check 与迁移命名检查通过。
- 独立审查发现并修复正式核验详情的站点变量引用，以及新测试脚本的已有数据库保护；增加正式详情读取站点私有清单且无 PHP warning 的回归。
- 本机双库与静态资源已备份到忽略目录 `deploy/backups/public-kyc-template-20261118/`；标准迁移只执行新增 `V20261118130000`，原 71 条账本保留，最终 72 applied／0 pending。商户主／APP 池已重启，8 主／6 APP／网关及商户聊天鉴权健康通过。8090 HTTP200，实际返回 index 与构建一致。
- 8090 正常超管会话：真实创建主体模板、修改名称／文件并生成 v2、停用 v3、历史保留 v1 原清单，复制为物业酒店独立模板并启用 v2；全部 5 次写操作有审计记录。已验证筛选、取消、旧模板只读、桌面与 375px（文档宽度=视口宽度）；普通管理员边界由真实服务和 SFC 覆盖，未新建普通角色会话。
- 只清理本轮两个临时模板组共 5 条无引用版本，公共基线仍为 11 条；已有申请及物业私有模板保留，没有重置商户数据。未远端部署、提交或推送。截图见本任务产物 `public-kyc-management.png`，最终页面保留在浏览器。

## 需求映射与兼容说明

| 依据 | 实现 |
| --- | --- |
| Super Admin Enterprise v1.0.14 M18「商户配置」、AC18 入驻要求管理 | 平台配置的商户入驻要求卡片接管理页；新建、复制、编辑、启停、筛选及文件清单／版本历史 |
| M18 授权、审计、验证及不改变已有申请 | 独立 config:kyc 权限、服务端站点归属、变更人／原因和不可变版本；旧申请继续读取绑定 ID，新分配读取当前启用版本 |
| M11 选择／分配和预览管理 KYC 要求 | 入驻物业候选联动公共模板当前版本；旧绑定仍可查看、按原锁定／变更规则保存为物业私有版本 |

主体新模板使用 merchant/unified，物业新模板使用 property + hotel/restaurant/airline/car_rental/attraction。原 9 个主体按业态模板只读并标记历史配置，可复制成有效的新模板；不改写、删除旧定义，不把物业私有模板暴露为公共候选。已有模板 ID 在编辑和启停后仍可读，不自动迁移申请或正式物业；KYC 开放时冻结模板的既有时点保持不变。

## 接口与入口

入口 `/config/overview?section=onboarding`，独立页面 `/config/kyc-template`，菜单 1315/component `config/kyc-template/index`。

- GET `/api/v1/admin/merchant/kyc-template/list`：keyword/scopeType/businessType/siteId/status + page/pageSize。省略 siteId 表示全部可见，显式 0 表示平台公共；只列每组当前版本。
- GET `/api/v1/admin/merchant/kyc-template/history`：id + page/pageSize，按版本倒序，历史保留文件清单、操作者、原因。
- POST `/api/v1/admin/merchant/kyc-template/create`：name/siteId/scopeType/businessType/documents/sort/status/reason，可选 copyFromId，新建独立组。
- POST `/api/v1/admin/merchant/kyc-template/update`：id/expectedVersion/name/documents/sort/reason；保留归属／范围／业态／状态，追加版本。
- POST `/api/v1/admin/merchant/kyc-template/status`：id/expectedVersion/status/reason；追加启停版本。并发过期返回 DATA_CONFLICT。

响应沿用统一结构和标准分页；documents 为 `{docType,name,required}`。旧 `/onboarding/kyc-template-update` 兼容地址同样要求 config:kyc:edit 和 expectedVersion，经过同一版本服务；旧前端公共编辑弹窗已改为跳转平台配置。

## 同日追加：查询按钮及回车未触发请求修复

用户报告模板管理查询无法使用。8090正常登录态输入 `Unified` 后点击查询，仍显示11条，页面无报错；根因位于筛选表单的 `@finish`：当前 Ant Design Vue 的 Form 仅在提供 model 后才会验证并发出 finish，现有筛选表单无 model。此前专项直接调用 load()，未覆盖实际表单提交，因此漏测。

最小修改为 `@submit="search"`，保留原生提交按钮，点击和回车均直接调用现有 useTable.search，重置到第一页后传递原筛选参数；服务端过滤、编辑／启停、权限和审批均不改。新增回归使用真实 Ant Form 和页面中编译的筛选模板，在第三页提交关键词／范围／业态／状态／公共站点0，断言只发一次GET且页码为1；已观察旧实现0请求失败，再验证修复后通过。

验证：模板专项18项、平台总览13项、admin-web类型检查与构建、diff检查通过。8090实际 `Unified` 点击查询1条、`Hotel` 回车查询3条、Hotel＋物业1条、叠加停用0条、重置11条均通过。最终截图为本任务产物 `kyc-query-fixed.png`。本机静态入口备份 `deploy/backups/kyc-query-fix-20261118/index-before.html`，旧assets保留，8090返回index与本次构建一致；未改数据库或新增迁移、未远端部署或提交／推送。
