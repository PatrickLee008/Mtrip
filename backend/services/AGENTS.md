# AGENTS.md — backend/services 作用域(路由,不承载正文)

在本目录下开发任何微服务前,**必须先读** [docs/plans/HANDOFF.md 第 4 节「后端关键约定」](../../docs/plans/HANDOFF.md):统一响应、错误码、字段命名、路由前缀的权威定义都在那里,本文件不复制。

## 硬约束

- **工程范本以 `system-service` 为唯一标准**:新服务/新代码的工程组织与代码风格(Controller/Model/Service、`#[Inject]`、验证、软删除、操作日志)一律对照 [backend/services/system-service](system-service/),共享能力用 `backend/shared`。
- 写接口的 `#[Permission]` 键必须与 `database/seed/02-menu.sql` 的 perm_key 对齐(根 AGENTS.md 硬约定 2)。
- 站点隔离与响应结构约束见根 [AGENTS.md](../../AGENTS.md)。

## 相关路由

| 需要什么 | 去哪里 |
|---|---|
| 服务分工 / 端口 / 骨架复制法 / 已知陷阱 | HANDOFF.md 第 6 节 |
| 移动端双前缀路由方案 | [docs/plans/09-移动端微服务.md](../../docs/plans/09-移动端微服务.md) |
| 各服务模块的任务清单与踩坑记录 | `docs/plans/02、06、09-*.md` |
