# Merchant Support 隔离回归

`integration.py` 从现有本地 MySQL 只复制业务库与系统库的**空表结构**，在随机命名的测试库中执行本次迁移并创建合成账号。随后启动两个临时 merchant-service 实例，在 `127.0.0.1:19525/19526` 通过真实 HTTP 验证事务、并发和授权；不复制客户记录，不执行正常库迁移。

前置条件：本地 Docker 可用，已有 `mtrip-mysql-1`、`mtrip-merchant-service-1` 及其镜像、网络，两个测试端口空闲。脚本使用已有容器的运行配置，但测试库、数据库用户、JWT 密钥和私有附件目录独立生成；不要输出临时 env 或 session 文件内容。

```bash
python3 test/support/integration.py
```

成功输出 `PASS_COUNT=79`。无论成功或失败，默认清理临时容器、数据库、用户、文件和凭据。测试会在克隆库中安装一个故意拒绝通知写入的触发器，验证整笔操作回滚。

覆盖：客服/优先级/状态组合保存与逐字段权限/回滚、迁移重复执行、当前 RBAC/站点/商户/物业范围、非酒店及停业历史、门店通用工单限制、六状态/显式重开、请求幂等及并发、活动历史、通知个人已读/深链/撤权、私有附件与临时过期、FAQ 发布受众与分类、政策生效快照和例外、警告撤销/到期、关联申诉独立性、指南未配置及权限状态。

浏览器联调可临时保留隔离环境：

```bash
SUPPORT_QA_KEEP=1 python3 test/support/integration.py
python3 test/support/integration.py --cleanup /absolute/path/from/QA_SESSION/session.json
```

`--cleanup` 只接受脚本生成并经名称检查的环境。若进程被强制终止，使用已输出的 session 路径清理。测试结束时部分员工权限、指派账号已被故意撤销，浏览器验证应使用合成 owner/admin。

本脚本不替代真实外部 Guide Hub 内容/播放联调、正式账号菜单验收、正常库迁移或发布后验收。图片内容、10MB 边界、集团账号和通知清空仍需补专项覆盖；当前测试已覆盖 PDF、有效 XLSX 容器、任意 ZIP 冒名、附件个数、转绑、匿名/跨主体读取和临时过期。

## 指南媒体投影回归

在仓库根目录运行 `php test/support/guide-media.php`（PHP >= 8.1），或使用现有镜像：

```bash
docker run --rm --network none --entrypoint php \
  -v "$PWD:/workspace:ro" mtrip-merchant-service /workspace/test/support/guide-media.php
```

6 个用例/11 次断言覆盖已发布适用功能保留、YouTube ID 投影、路径/查询注入与无效长度/未知提供商拒绝、非 HTTPS 观看链接过滤以及缺失媒体。无需数据库、外部凭据或网络，不替代真实视频播放验收。

## 已配置指南的运行依赖检查

`GuideHubService` 在配置齐全后才创建 Guzzle 客户端；未配置回归不会覆盖镜像缺少该依赖的情况。修改 Composer 依赖后，使用 `bash deploy/mtrip.sh build merchant-service merchant-service-app --dev` 重建双池，并分别验证实际运行容器：

```bash
docker exec mtrip-merchant-service-1 php -r 'require "vendor/autoload.php"; new GuzzleHttp\Client(); echo "OK\n";'
docker exec mtrip-merchant-service-app-1 php -r 'require "vendor/autoload.php"; new GuzzleHttp\Client(); echo "OK\n";'
```

随后在商户登录态检查分类/列表请求与页面。客户端可实例化不等于外部鉴权、应用匹配或真实内容验收通过；不得输出 Secret 或包含鉴权头的请求日志。
