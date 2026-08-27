# M12 S2：酒店商户目录、档案与物业关联交付

日期：2026-08-27
状态：S2编码与核心测试完成；以下未测项和数据准备事项仍保留。
仓库：D:/软件项目/Mtrip海外旅游平台/源码/Mtrip
Git：未暂存、未提交、未推送；由用户操作。HEAD保持4637803ffaf71533acd6e942f3668fd5bdf77058。

## 1. 本阶段实现

- 目录按商户名称、数字ID、MCH编号、邮箱、企业/注册业务名、物业名称搜索。
- 电话采用完整号码规范化后的HMAC精确检索；商户联系人及注册业务联系人均支持。保留加密原文，不使用密文LIKE或每次查询全表解密。
- 状态、酒店类别、物业国家/城市、注册起止日期、站点筛选；姓名/注册时间/最近登录/ID排序；服务端分页及同值ID次排序。
- 黑名单与普通暂停结果分离；修复S1中excludeBlacklisted误放到状态历史查询的接线问题。
- 档案聚合企业、注册业务/KYC、佣金、联系方式、银行、登录账号、集团和酒店物业；空值不伪造。
- 普通目录/档案不再返回access_code、2FA密钥或电话索引；访问码仅显示已配置/未配置。模块11既有凭证交付流程未改。
- 复用merchant_store作为酒店物业，显式绑定本商户同站点、KYC已验证的hotel注册业务。允许选择未绑定历史门店或显式创建新物业，不按名称/主门店猜测归属。
- 物业变更有权限、必填备注、版本校验、行锁、唯一约束；物业及变更前后快照/操作人/活动日志同事务写入。支持分页查看关联历史。
- 已关联业务不允许直接改绑；已删除物业的关联保留并显示为归档，不可被默默复用。
- 餐厅仍延期，只显示非酒店历史业务数量提示，不提供餐厅关联或运营操作。

## 2. 数据和接口边界

### 地理与业务类型

- 现有系统没有统一城市实体表。当前country_code采用两位字母并转大写，city_key去除首尾空白、合并空格并转小写；由操作者明确确认。**没有自动翻译、城市别名合并或全球地名有效性验证**。同城市应使用一致名称，S5接入排名前需核对这些键。
- 位置筛选仅匹配已关联且未归档酒店物业；两个条件必须命中同一物业。不把企业注册国当作酒店经营国。
- 酒店类别优先按注册业务/正式物业判断；没有入驻业务的历史主体保留merchant_type=1兼容。旧数值2仍为景区/门票，未改为餐厅。
- 新物业display_enabled默认为0，S2不发布排名、不接消费者端展示。
- **建立物业关联不等于授予门店订单访问权限。** 商品/订单尚未建立完整store_id链路，继续保持S1的门店隔离，历史订单由商户级账号处理；对应经营资源链路在后续阶段接入。

### 接口

| 接口 | 本阶段变化 |
|---|---|
| GET /api/v1/admin/merchant/list | keyword/category/country/city/registeredFrom/registeredTo/sortField/sortOrder；保留原有groupId等筛选 |
| GET /api/v1/admin/merchant/detail | 增加applications/businesses/properties/group；凭证白名单 |
| POST /api/v1/admin/merchant/property/bind | merchantId/businessId/storeId/expectedVersion/countryCode/cityKey/note |
| GET /api/v1/admin/merchant/property/history | merchantId/page/pageSize；返回变更前后快照 |

- storeId=0表示显式新建，非0表示选择已有物业；新建expectedVersion=0。
- 新写权限merchant:property:bind，菜单30114，前后端同键。不自动给旧角色扩权。
- 冲突返回40901，跨站返回40302，无绑定权限40301；未知排序和非法日期等返回40001。
- 电话不推测国家前缀；空格/括号/点/连字符与+、00格式做规范化，局部号码不匹配。修改电话会同时替换索引。
- 正常请求仍使用统一code/message/data与分页list/total/page/pageSize。

## 3. 迁移和本地运行结果

新增database/merchant/28-merchant-directory-property.sql，已登记compose初始化顺序39j。

- merchant_info、merchant_application_business增加电话检索索引。
- merchant_store增加业务类型、KYC来源、国家/城市键、展示开关、关联版本与来源唯一索引。
- 新增merchant_property_history追加式历史表和权限菜单。
- 本地开发库首次应用、重复应用均成功；没有回填任何猜测的物业关联。
- 电话回填工具：backend/services/merchant-service/bin/m12-phone-index.php。默认只预览，--apply才写入；每批200行，只更新索引，原号码和业务更新时间保持不变。
- 实际结果：预览12条可索引、2条无效；执行新增12条；再次执行新增0条。**2条无法索引的历史数据保留原值，需后续人工核实，不能宣称所有历史号码均可搜索。**
- 当前开发库物业映射0条、物业历史0条，说明没有为页面测试改动真实关联。
- 商户服务已重启并恢复；9501～9508全部healthz=ok。
- 无清库、无删除数据卷、无第三方通知发送。

复测入口：scripts/test-m12.ps1。先完成27/28迁移、重启商户和订单服务并等待healthz成功，让Hyperf扫描缓存完成更新。测试脚本使用mtrip_m12_s1_test，仅复制结构，升级测试库并生成/清理自身夹具。

若运行环境的bin目录未热挂载，需把新索引脚本复制到merchant容器/opt/www/bin/后执行；正式镜像构建会包含该脚本。先预览再应用，不输出号码或密钥。

## 4. 实际测试

| 检查 | 结果 |
|---|---|
| PHP语法 | 292文件，0错误 |
| shared单测 | 54用例，815断言，全通过 |
| S1状态集成 | 51项PASS |
| S1订单集成 | 25项PASS |
| S2目录/物业集成 | 62项PASS |
| admin-web类型检查与生产构建 | 通过 |
| merchant-web类型检查与生产构建 | 通过 |
| client-app类型检查 | 通过 |
| compose config / git diff --check | 通过 |
| 迁移重复执行 | 通过 |
| 测试数据清理 | 隔离库商户、门店、物业历史均0条 |

S2集成直接运行现有Hyperf控制器和MySQL，覆盖：

- 各关键词命中、完整电话规范化、局部号码不命中、字面百分号不扩展为通配符。
- 新增和修改商户同步电话索引；回填预览不写、重跑幂等。
- 日期含结束当天、无效日期/排序/类别拒绝、稳定跨页排序、最大200条。
- 伪造siteId、跨站详情/关联/历史、非超管site_id=0隔离。
- 凭证不返回、企业和KYC聚合；旧入驻/核验详情不暴露电话索引；餐厅与待审业务不可关联。
- 不自动复用主门店、重复/旧版本/改绑拒绝、地理字段规范化。
- 关联历史写入失败时回滚物业；两进程并发关联仅一个成功。
- 多物业国家/城市不串联，已归档关联可见但不可复用/命中位置筛选。
- 黑名单筛选及普通暂停排除黑名单。

浏览器已实际检查：中文目录、编号检索、企业/KYC/历史门店档案、访问码状态、关联表单提示与空字段拦截、取消操作、关联历史空态。界面复用已有Vue/Ant Design组件，未复制原型演示数据。

尚未验证：浏览器最终成功写入真实物业、普通角色完整UI路径、英文视觉与窄屏全流程、超大数据性能、空数据卷全部初始化。前者的后端成功写入/权限/回滚已由隔离集成验证，但不等同完整HTTP网关端到端验收。既有Vite大chunk警告保留。

## 5. S2文件清单

新增：

- admin-web/src/components/merchant/MerchantPropertyPanel.vue
- backend/services/merchant-service/app/Controller/MerchantPropertyController.php
- backend/services/merchant-service/app/Service/MerchantPhoneIndexService.php
- backend/services/merchant-service/bin/m12-phone-index.php
- backend/services/merchant-service/test/m12-directory.php
- backend/shared/src/Merchant/MerchantPhoneIndex.php
- backend/shared/tests/cases/MerchantPhoneIndexTest.php
- database/merchant/28-merchant-directory-property.sql
- docs/plans/m12/03-s2-delivery.md

修改：

- admin-web/src/api/merchant.ts
- admin-web/src/views/merchant/list/index.vue
- admin-web/src/locales/zh-CN.ts、en-US.ts
- backend/services/merchant-service/app/Controller/MerchantController.php
- backend/services/merchant-service/app/Controller/OnboardingController.php（同步注册业务电话索引并屏蔽返回）
- backend/services/merchant-service/app/Controller/VerifyController.php（仅屏蔽新增电话索引，凭证交付不变）
- backend/services/merchant-service/config/routes.php
- database/seed/02-menu.sql、deploy/docker-compose.yml、scripts/test-m12.ps1
- README.md、docs/plans/README.md、HANDOFF.md、15-M12-merchant-management.md
- docs/plans/m12/00-design.md、01-tasks-and-tests.md、CHANGELOG.md

S1仍未提交，多个文件包含S1和S2累积修改；不能把当前整个git diff误标为仅S2。用户可按阶段文档审阅并自行安排提交。原ReviewController、start/stop脚本、两份中文PRD的SHA-256与阶段开始完全一致，未改动。

## 6. 后续

下一阶段S3：商户证件的新版本替换/审核/下载权限、活动审计及完整导出、真实站内通知与外部通知接口预留。账号级2FA和真实模拟登录为S4；酒店排名/消费者展示为S5。餐厅及未确定服务商的真实对接继续延期。

本报告只交付S2范围，不表示完整模块12已完成。
