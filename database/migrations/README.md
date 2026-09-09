# 生产增量迁移

本目录是**生产存量库增量 SQL 的唯一入口**。`database/system`、`merchant`、`goods` 等目录保留为
空库初始化快照；业务表结构或种子发生变化时，可以同步维护快照，但必须另加一份本目录迁移。
版本账本从本机制上线后开始记录，不会倒推生产库是否执行过旧目录中的历史脚本；首次启用前仍需按当前
交接记录核对历史漏项，此后所有新变更才能由账本可靠追踪。

## 命名

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
