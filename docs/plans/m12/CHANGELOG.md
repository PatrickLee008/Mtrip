# M12 阶段开发日志

> 用于PRD模块12商户管理整改的本地Git追溯。代码未完成不能标记功能已验收。
> 提交内以阶段ID定位，最终commit哈希由交付回执记录，不把自身哈希写入自身提交。

## S0 — 2026-08-27 — 核验与技术设计交付

- 基线分支：dev。
- 父基线提交：0d4a942b9827bbc30366da09f6fb5b2023af6a65。
- 阶段状态：设计交付，待用户确认；无业务编码，无数据库迁移，无服务重启。
- 需求来源：中文Super Admin Portal PRD模块12；用户D1～D8决策；原型六页面信息架构。
- 交付：00-design.md、01-tasks-and-tests.md、15-M12-merchant-management.md及进度索引更新。
- 数据操作：只读表结构/汇总；未读取账号密码、2FA密钥或个人明细；未添加/修改测试数据。
- Git范围：只提交上述新文档、CHANGELOG、README、docs/plans/README.md和HANDOFF.md；不提交原有控制器改动、启动脚本、用户PRD。
- 外部通知：按用户决定仅预留接口，实际服务商对接明确延期，不能标为PRD全部完成。

### 证据摘要

- 商户/注册业务：10个有效商户，8个登录账号；3条已验证餐厅注册业务；正式餐厅实体映射仍缺失。
- 商品/订单：本地有效记录均为0。
- 排名：6条酒店演示记录，business_id及site_id均为0。
- 运行环境：11个容器运行；MySQL/Redis healthy；服务PHP8.1.27；本地基线PHP8.5.9。
- 代码缺口：双下单入口漏商户状态、JWT未复核黑名单、解除黑名单直接激活、2FA非账号级、排名无真实发布隔离。

### 实际执行的检查

| 检查 | 实际结果 |
|---|---|
| scripts/check.ps1 / backend php -l | 277个PHP文件，0语法错误（本地PHP8.5.9） |
| shared/tests/run.php | 47用例、723断言，全部通过 |
| admin-web npm run build | 通过；已有大chunk警告保留 |
| client-app npm run typecheck | 通过 |
| merchant-web vue-tsc --noEmit | 通过 |
| merchant-web Vite build | 通过；已有大chunk警告保留 |
| merchant-web npm run build统一入口复核 | cmd /c入口复核通过，退出0 |
| Docker/数据库只读核验 | 完成；未启停、未写数据 |
| 新状态/订单/2FA/排名业务测试 | 未执行：尚未编码，现有构建通过不等于PRD业务通过 |

商户端首次直接从PowerShell调用npm.cmd曾退出1且未给诊断；后续直接类型检查/Vite构建均通过，按项目check.ps1相同cmd /c入口再次执行整体构建也通过。未为此修改源码或宣称已经定位根因。

### 保留的原工作区内容

- backend/services/goods-service/app/Controller/Merchant/ReviewController.php；
- start.bat、stop.bat；
- 设计文档/mTrip_Merchant App PRD_v1.0_中文版.md；
- 设计文档/mTrip_Super_Admin_Portal_PRD_Enterprise_v1.0_中文版.md。

阶段结束时核对文件SHA-256与初始快照一致。具体哈希存于阶段交付回执，不纳入本阶段源代码修改。

### 风险与下一步

- 先确认设计G1～G4，再进入S1。
- 44～62人日原估算依赖餐厅可复用链路，本次核验不成立；餐厅补齐范围确认后重估，未承诺追加预算或固定完成日期。
- 本阶段文档更新不代表任何商户业务功能已实现，不执行生产部署。

## 后续阶段日志模板

- 阶段ID／日期／基线commit：
- PRD要求及用户决策：
- 修改文件／接口／数据库迁移：
- 验证命令、通过/失败/未测：
- 兼容性、回退与风险：
- 延期项：
- 交付提交定位与下一步：
