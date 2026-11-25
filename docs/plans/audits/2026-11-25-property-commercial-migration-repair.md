# 2026-11-25 物业商务配置缺表恢复

## 原因与授权

用户报告 `GET /api/v1/admin/merchant/commercial-settings/property?merchantId=16&propertyId=20` 报错，随后明确要求修复。11-25 请求日志显示 MySQL 1146 / SQLSTATE 42S02：`mtrip_business.merchant_property_commercial_config` 不存在。物业20确属商户16，均为站点1且未删除。代码已包含物业佣金覆盖读取，正常开发库漏执行原迁移 `V20261120120000__property-commercial-commission.sql`；此前11-20专项仅在隔离环境执行过。

## 恢复范围和过程

- 本机原账本74条applied，最高版本20261124090000，共9条较旧迁移未执行；没有running/failed，现有文件路径与SHA-256全部匹配。
- 本轮仅恢复缺失的物业佣金配置表。原SQL只有 `CREATE TABLE IF NOT EXISTS`，无其他表改写、历史回填、资金或权限变更，无前置新表依赖。
- 先完成双库 `mysqldump --single-transaction --routines --events --triggers --no-tablespaces`，检查退出成功、982,512字节及完成标记。备份和证据位于忽略目录 `deploy/backups/property-commercial-repair-20261125104617/`，双库文件 `before-repair.sql`。
- 在上述目录的 `scoped-repository` 中保留全部74条已执行迁移的原文件及原账本DDL，再加入目标迁移的原文件；这75个文件由标准 `scripts/db-migrate.sh` 校验。以 `MTRIP_REPO_ROOT` 指向该恢复范围，仅显式允许20261120120000倒序执行；dry-run确认只待执行1条后再apply。
- 原始SQL、路径、SHA-256检查、MySQL迁移锁、running/applied状态与完整范围账本复核均由标准工具执行，没有手工伪造applied或改写已执行文件。目标applied_by记录out-of-order恢复来源。
- 修复后账本75条applied；原74条账本内容逐条保持一致。新表为空，未新增商务配置；物业归属保持。另8条待执行迁移未纳入本轮apply。完整仓库另作只读status白名单检查，证据 `full-status-after.log`。

## 验证与边界

- 用当前商户服务容器、实际控制器和原merchantId/propertyId参数执行只读调用，设置具有merchant:list:list的站点1管理员上下文，返回 `code=0`、propertyId20、latest_version0、current=null、historyCount0，符合尚无物业覆盖、继承商户默认的状态。
- 初次验证脚本误用admin_id0，被现有管理员权限门禁拒绝；改为有效编号的只读测试上下文后通过，未修改权限代码或实际账号。
- 本轮未签发登录令牌、未独立执行浏览器/网关登录态HTTP验收；已验证原路由处理器及真实库查询恢复。数据库结构对运行服务立即可见，无需重启或更新静态资源。
- 无业务代码改动，未执行无关迁移、保存配置、发通知、运行资金动作或操作远端环境；未提交/推送。未执行代码构建/全套业务测试，本轮验证针对结构恢复和原报错路径。
