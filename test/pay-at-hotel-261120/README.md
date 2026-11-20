# 到店支付统一与资金流程回归

在仓库根运行：

```powershell
python test/pay-at-hotel-261120/integration.py
node admin-web/scripts/check-commercial-settings-interactions.mjs
```

前置：Python3、Docker Desktop、已初始化的本地MySQL/Redis，以及现有merchant/order/finance服务容器的配置和镜像。服务本体可以保持停止。无需真实商户账号、支付证书、短信或生产凭据。

脚本复制正常库的表结构到随机 `pah_qa_*` 双库，使用随机数据库账号、JWT/内部接口密钥及本机随机端口。数据库账号只获临时双库权限；执行迁移前完整替换库名并检查USE目标，另验证该账号不能访问源业务库。业务余额由WalletLedger入账，不改开发账户余额。

`provider.py` 是短时运行、要求随机内部密钥的本地支付中心契约模拟。真实订单服务会执行出码请求、支付通知、原路退款请求、失败重试、退款合并和到账记账；模拟不会调用银行，也不代表payment-service真实渠道适配器、证书或资金到账已经通过验收。钱包链路使用真实应用代码和临时数据库记账。

65项业务断言通过，另检查源库关键表校验值不变。覆盖旧配置兼容、权限/站点/版本、门店覆盖、金额例子、部分/连续/原路/混合资金退款、酒店取消、No-show、运营完成、逐预订结算、重复通知与失败回滚。退出自动清理本次容器、数据库、账号及本地模拟服务。`runner.php`只接受临时库前缀，动作限入账、对账及退款队列。

14项配置组件交互使用真实Vue页面脚本和接口夹具。全量质量、迁移命名、商户Web构建和商户App类型检查另行执行。发布说明、验证边界及已恢复的本地结构事故见[交付记录](../../docs/plans/audits/2026-11-20-pay-at-hotel-unification.md)。
