# AGENTS.md — admin-web/src 作用域(路由,不承载正文)

在本目录下新建/修改页面前,**必须先读** [docs/plans/HANDOFF.md 第 5 节「前端页面代码模式」](../../docs/plans/HANDOFF.md):useTable、页面结构、弹窗表单、权限指令、动态路由、多语言的权威定义都在那里,本文件不复制。

## 硬约束

- **新增页面目录必须与菜单 component 字段完全一致**(动态路由 `router/dynamic.ts` 按此解析;菜单种子:`database/seed/02-menu.sql`)。
- 按钮权限用 `v-perm`,键与后端 `#[Permission]` 注解及菜单种子 perm_key 同键(根 AGENTS.md 硬约定 2)。
- 模板中禁用 `as` 断言与 TS 类型标注(定义见 HANDOFF 第 5 节)。

## 相关路由

| 需要什么 | 去哪里 |
|---|---|
| 多语言/菜单标题词条详细规范 | [docs/guides/standards/README.md](../../docs/guides/standards/README.md) |
| 接口响应结构与错误码 | 根 [AGENTS.md](../../AGENTS.md) 硬约定 1 |
| 管理后台各页面模块任务与踩坑记录 | `docs/plans/04、05、07-*.md` |
