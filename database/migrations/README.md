# 生产增量迁移

2026-11-19 `20261119073300` 因 `merchant_notify_read` 正常已读记录阻断时，保留原迁移文件及校验和，使用新增 `20261119090000` 修正版和[带审计恢复流程](../../docs/guides/setup/qa-merchant-7014-site-recovery.md)。专用命令核对回滚状态、备份双库，真实执行修正版后才记录原意图完成并归档失败快照；普通迁移的 failed/checksum 闸门保持。不能直接删除失败版本或手动改校验和后重发。

本目录是**生产存量库增量 SQL 的唯一入口**。`database/system`、`merchant`、`goods` 等目录保留为
空库初始化快照；业务表结构或种子发生变化时，可以同步维护快照，但必须另加一份本目录迁移。

> ⚠️ **发布闸门**：生产库只执行本目录。在旧目录新增或修改 `.sql` 时，必须同批在本目录新增版本文件，
> 否则 `scripts/auto-deploy.sh` 报 `[FAIL] 新增/修改旧目录快照 SQL 时必须同批新增 database/migrations/...`
> 并中止发布。快照副本可选：空库初始化时 `database/init/99-run-migrations.sh` 也会执行本目录全部版本。
版本账本从本机制上线后开始记录，不会倒推生产库是否执行过旧目录中的历史脚本；首次启用前仍需按当前
交接记录核对历史漏项，此后所有新变更才能由账本可靠追踪。

## 命名

2026-11-19 最终批准空注册号修复：新增 `V20261119070000__allow-missing-merchant-registration-number.sql`，
正式商户 `credit_code` 改为可空并将存量空字符串／纯空格置NULL，保留真实非空注册号唯一索引。
须与最终批准代码配套发布，目标服预检、双库备份、暂停商户双池、标准迁移及原申请重试见
[补救方案](../../docs/guides/setup/最终批准空注册号修复.md)。不修改历史迁移，不清理申请或KYC。

格式固定为：`VYYYYMMDDHHMMSS__lower-kebab-description.sql`。

示例：`V20260909143000__add-order-refund-index.sql`。版本必须是有效的 UTC 日期时间，14 位版本号在整个目录内
全局唯一；说明段只能用小写字母、数字和单个连字符分词，不能以连字符开头/结尾或连续使用连字符。
文件一旦在任一环境执行成功，禁止改名、删除或修改内容，校验和不一致会阻断发布。

禁止把 `database/system`、`merchant` 等旧初始化快照 rename/copy 到本目录；迁移必须只包含本次上线需要的
最小增量，避免在生产库重放整份历史快照。

可用下面的命令先检查命名：

```bash
bash scripts/db-migrate.sh --validate
```

## SQL 要求

- 文件首部必须包含 `SET NAMES utf8mb4;`，并显式 `USE mtrip_system` 或 `USE mtrip_business`。
- 每个文件只承载一个逻辑变更，并按可重复执行编写（`IF NOT EXISTS` 或 information_schema 守卫）。
- 采用 expand/contract：先增加向后兼容结构，再发布代码；删列、删表、批量删数据不进入自动迁移。
- MySQL DDL 会隐式提交，不能依赖事务整体回滚；失败后先核对实际结构和
  `mtrip_system.schema_migrations`，确认安全后再人工修复/重试。

## 执行

```bash
# 只看生产库与仓库的版本差异
bash scripts/db-migrate.sh --status

# 执行全部未登记版本；auto-deploy.sh --prod 会在发布代码前自动调用
bash scripts/db-migrate.sh
```

脚本以 `version` 为主键记录路径、SHA-256、执行 attempt、Git commit、执行节点、开始/结束时间、耗时和状态，
并使用 MySQL `GET_LOCK` 防止多个发布进程并发执行同一版本。

## 倒序补迁移（人工恢复）

默认禁止执行低于账本最高已执行版本的遗漏迁移。多分支先后上线可能出现：测试库已经执行
`20261105100000`，后来合入的 `20261105090000`、`20261105090100`、`20261105090200` 尚未执行。
这是版本顺序冲突；`auto-deploy.sh` 展示的 `DB 文件变更` 包含初始化快照，不能据此判断
`database/seed/02-menu.sql` 被执行，存量库仍只执行本目录。

不要改名/修改已在其他环境执行过的迁移，也不要删除账本记录或用 `--skip-db` 跳过缺失结构。
人工核对遗漏 SQL 与后续版本的依赖、备份数据库后，可显式列出允许补执行的版本。
`--allow-out-of-order` 仅放行列出的版本，不能绕过 SHA-256、路径、缺失文件、running/failed 状态检查，
仍使用迁移锁和原始 SQL，并在账本 `applied_by` 添加 `out-of-order:` 前缀。该参数不由自动部署启用。

本次三条迁移只扩展优惠券权益/领取快照、补站点促销限额配置、增加活动撤回表及一个按钮权限；
`20261105100000` 只扩展 `marketing_campaign.campaign_type`，彼此没有顺序依赖。
站点配置使用 `INSERT IGNORE`，保留已有值；新增额度保持空值，仍需通过站点配置页填写正式额度。

测试服同步本次脚本更新后，在仓库根目录执行（恢复期间避免并行发布；容器名非默认值时设置 `MYSQL_CONTAINER`）：

```bash
# 1. 备份双库；备份命令成功且文件非空后再继续
mkdir -p deploy/backups
repair_backup="deploy/backups/before-promotion-repair-$(date +%Y%m%d-%H%M%S).sql"
docker exec "${MYSQL_CONTAINER:-mtrip-mysql-1}" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --events --triggers --no-tablespaces --databases mtrip_system mtrip_business' \
  > "$repair_backup" && test -s "$repair_backup"

# 2. 只读预览：只允许这三条遗漏版本倒序；其他待执行版本仍按正常规则处理
repair_versions=20261105090000,20261105090100,20261105090200
bash scripts/db-migrate.sh --dry-run --allow-out-of-order="$repair_versions"

# 3. 上一步通过后执行；仍会执行本仓库全部待执行迁移，不仅是白名单
bash scripts/db-migrate.sh --allow-out-of-order="$repair_versions"

# 4. 复核待执行为 0 后，继续原自动部署
bash scripts/db-migrate.sh --status
bash scripts/auto-deploy.sh --apply-db
```

如出现校验和不一致或 running/failed，停止恢复并核对实际结构，不能通过加入白名单消除该错误。
新迁移编号应晚于各部署环境的已发布最高版本，避免不同分支再次产生倒序遗漏。

### 2026-11-19 商业设置迁移遗漏

测试服截图中的 `20261117100000 < 20261117160000` 是另一条遗漏迁移，不应继续使用上例的 11-05 三个版本号。
`V20261117100000__merchant-commercial-settings.sql` 新增商户商业配置历史表、商户 `commercial_version`
及订单 `merchant_commercial_snapshot` 列；`V20261117160000__app-version-control.sql` 只插入 App 版本配置，
两者没有顺序依赖。11-18 的 KYC 和平台配置迁移不引用上述商业字段；无需修改历史文件或顺序策略。

本机独立 MySQL 8.0 容器使用原始两条迁移复现默认拦截，验证白名单预览不写入、补执行后账本 2/2、
原 16:00 账本整行和 App 版本配置不变、两列和历史表创建成功、重复执行及原 SQL 幂等；临时容器已清理。
迁移命名 72 个版本、Bash 语法与状态机回归通过。此证据仅覆盖本机隔离恢复，不代表目标测试服已修复，
也不代表其他 11-18 迁移已在目标测试服通过验收。

在截图所示测试服务器仓库根目录执行下面整段命令；遇到错误自动停止。恢复期间避免并行发布：

```bash
(
  set -e
  cd /www/wwwroot/Mtrip
  bash scripts/db-migrate.sh --dry-run --allow-out-of-order=20261117100000

  mkdir -p deploy/backups
  repair_backup="deploy/backups/before-commercial-repair-$(date +%Y%m%d-%H%M%S).sql"
  docker exec "${MYSQL_CONTAINER:-mtrip-mysql-1}" sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --events --triggers --no-tablespaces --databases mtrip_system mtrip_business' \
    > "$repair_backup"
  test -s "$repair_backup"

  bash scripts/db-migrate.sh --allow-out-of-order=20261117100000
  bash scripts/db-migrate.sh --status
  bash scripts/auto-deploy.sh --apply-db
)
```

白名单只豁免该版本的顺序检查，执行仍覆盖本仓库全部待执行迁移（包括截图中的 11-18 迁移），
正常成功后 `--status` 应显示待执行 0，再继续发布。如果出现 SQL 错误或 failed 状态，先核对实际结构，
不要删除账本、重命名迁移、重放 `02-menu.sql` 或用 `--skip-db` 跳过。
