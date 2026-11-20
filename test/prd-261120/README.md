# 2026-11-20 PRD 补充规则回归

覆盖注销预订资格、超管与独立财务经办/复核、策略生效和有效期、实际钱包作废及导出，以及多酒店付款会话。

## 真实服务集成

前置：Docker Desktop、已初始化的本地 MySQL/Redis；保留 `mtrip-user-service-1`、`mtrip-order-service-1` 的容器配置和镜像；Python 3 与 `openpyxl`。

在仓库根运行：

```powershell
python test/prd-261120/integration.py
```

脚本复制开发库表结构到随机的 `prd_qa_*` 双库，创建只获临时库权限的随机数据库账号，使用独立 JWT 密钥、临时服务容器和随机本机端口。测试余额由 WalletLedger 入账，不发送短信、不调用真实支付。退出时删除自己的容器、数据库及数据库账号，并检查源开发业务表校验值未变。勿把它指向生产。

71 项业务断言和额外的源数据未变检查通过。`runner.php` 仅允许 `prd_qa_*` 库执行。

## 页面交互

```powershell
node admin-web/scripts/check-account-deletion.mjs
```

16 项真实 Vue 页面脚本交互，接口使用夹具。统一构建会另行检查模板和类型。

`checkout-fixture.tsx` 和 `wizard-fixture.tsx` 用于独立 CDP 浏览器检查。按用户要求，浏览器脚本固定放 `C:/Tools/cdp/prd-checkout-261120.cjs`，使用 9223，不使用 T3 内置浏览器或用户的 9222。脚本把实际 hook/订房页面打包到临时目录，API/时间使用夹具；19 项行为检查通过，不代表生产真实支付或原生设备已验收。

## 统一质量检查

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
```

需求、菜单权限、发布内容与未验边界见[交付记录](../../docs/plans/audits/2026-11-20-prd-supplements-implementation.md)。
