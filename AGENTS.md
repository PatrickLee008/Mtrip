# AGENTS.md(路由表,不承载正文)

本文件只做路由与硬约束。所有规范/约定的**唯一事实源**是下表指向的现有文档,不要在此复制正文。

## 上下文路由

| 需要什么 | 去哪里 |
|---|---|
| 新会话接手全部上下文(第一入口) | [docs/plans/HANDOFF.md](docs/plans/HANDOFF.md) |
| 规范和约定的完整索引 | [README.md「文档索引」一节](README.md) |
| 项目进度 / 各模块状态 | [docs/plans/README.md](docs/plans/README.md) |
| 后端开发约定与代码范本 | HANDOFF.md 第 4 节(另见 `backend/services/AGENTS.md`) |
| 前端页面代码模式 | HANDOFF.md 第 5 节(另见 `admin-web/src/AGENTS.md`) |
| 环境搭建 / 启动 / 常见问题 | [docs/guides/setup/启动开发指南.md](docs/guides/setup/启动开发指南.md) |

## 三条硬约定(违反即返工,完整定义见 README「核心开发约定」)

1. **统一响应结构**:`{code, message, data}`,成功 `code=0`;分页 `data={list,total,page,pageSize}`。错误码表:`backend/shared/src/Constants/ErrorCode.php`。
2. **Permission 注解键与菜单种子一致**:写接口 `#[Permission('...')]` 的键必须与 `database/seed/02-menu.sql` 的 perm_key 对齐;前端按钮用 `v-perm` 同键防护。
3. **站点隔离**:`site_id=0` 超管全平台,其余强制本站点(`AdminContext::scopeSiteId`);新页面目录必须与菜单 component 字段完全一致。

## 工作方式

每完成一项任务,同步更新 `docs/plans/` 对应模块文件、README 进度表和 HANDOFF.md(约定出处:README「质量基线」)。
