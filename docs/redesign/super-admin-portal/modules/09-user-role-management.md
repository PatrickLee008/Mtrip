# 用户与角色管理（User & Role Management）

## 概述

平台后台**管理员账号 + 角色 + 权限矩阵 + 活跃会话**管理。对应现有 `system/admin`·`system/role`·`system/menu` 的重组。位于 User & Role Management 组。

来源文件:`UI设计/Super Admin Portal/src/pages/UserRolePage.tsx`(~17KB,纯页面本地 mock)。

PageId 列表:
- `users-roles` — Users(管理员列表 + 角色卡)
- `users-roles-list` — Roles(→ 权限矩阵视图)
- `users-roles-permissions` — Permission Matrix(权限矩阵)
- `users-sessions` — Active Sessions(活跃会话)

> 实现说明:`isPermTab = tab ∈ {users-roles-permissions, users-roles-list}` 显示权限矩阵;其余(含 users-roles、users-sessions)显示「Admin Users 表 + Roles 网格」。**`users-sessions` 当前无独立 UI**,活跃会话仅作为用户表的一列(sessions)。

## 子页面 / Tabs

| PageId | 标题 | 视图 |
|---|---|---|
| `users-roles` | Users | Admin Users 表 + Roles 网格 |
| `users-roles-list` | Roles | 权限矩阵 |
| `users-roles-permissions` | Permission Matrix | 权限矩阵 |
| `users-sessions` | Active Sessions | (无独立 UI,复用 Users 表的 sessions 列) |

## 功能清单

### Admin Users（管理员表）
- 页头右上:Create Role / Create User。
- 搜索:name/email。
- 表格列:User(头像+名+email)、Role(徽标,Super Admin 红/其余蓝)、Status(active/inactive)、Active Sessions(`{n} active`)、Last Login、Created、Actions。
- 行操作:查看(Eye)/ 重置密码(Key→发重置邮件弹窗)/ 强制登出(sessions>0 才有,LogOut→终止全部会话弹窗)/ 删除(非 Super Admin 才有,Trash)。

### Roles（角色网格)
- 每角色卡:图标(角色专属色)、名称、用户数、权限标签集(view/create/edit/delete/approve/export/reports)。
- 6 个内置角色:Super Admin(全 7 权限)/ Verification Admin(view/approve/edit)/ Finance Admin(view/approve/export/reports)/ Campaign Admin(view/create/edit/delete)/ Support Admin(view/edit)/ Read Only(view/reports)。

### Permission Matrix（权限矩阵）
- 二维表:行 = **8 模块 × 7 权限动作**(Module/Permission,模块行加粗,权限行缩进 `↳`),列 = **6 角色**;单元格为复选框(默认按角色 permissions 勾选,accentColor=角色色)。
- 8 模块:Dashboard / Merchant Verification / Merchant Management / Booking Administration / Campaigns / Affiliates / Finance / Reports。
- 7 权限动作:view / create / edit / delete / approve / export / reports。
- 底部「Save Permissions」保存。

### 弹窗
- Create Admin User(confirm):Full name / Email / Role(下拉)。
- Create Role(confirm):Role name。
- Force Logout(danger):终止某用户全部会话。
- Reset Password(warning):发重置邮件。

## 数据结构

```typescript
interface AdminUser {
  id; name; email; role; status: 'active'|'inactive'; lastLogin; created; sessions: number
}

// 角色（含权限动作集合）
interface Role { name; users: number; color; permissions: string[] }  // permissions ⊂ allPerms

const allPerms = ['view','create','edit','delete','approve','export','reports']
const modules  = ['Dashboard','Merchant Verification','Merchant Management','Booking Administration','Campaigns','Affiliates','Finance','Reports']
```

### 实体 → 现有表映射
`AdminUser`→`sys_admin`;`Role`→`sys_role`;权限矩阵(模块×动作)→ 现有 `sys_menu`(perm_key `模块:菜单:按钮`)+ `sys_role_menu`;活跃会话→`sys_admin_login_log`(需增在线会话表或据登录日志派生);sessions 计数 = 当前有效会话数。

## 状态机 / 流转

- 管理员:`active ⇄ inactive`;创建/删除(非超管)/重置密码/强制登出(清会话)。
- 角色权限:矩阵勾选 → Save。

## 备注（后端缺口）

1. **权限矩阵是「模块 × 动作」二维模型**,与现有 RBAC「权限键三处对齐」(`#[Permission('模块:菜单:按钮')]` ↔ `02-menu.sql` perm_key ↔ 前端 `v-perm`)一致——设计稿的 8 模块 × 7 动作可映射到现有 perm_key 体系。落地时矩阵应由 `sys_menu` 的 perm_key 动态生成,而非硬编码 8×7。
2. **Active Sessions** 需要真实在线会话数据(设备/IP/登录时间/最后活动),现有 `sys_admin_login_log` 记登录事件,需补在线会话表或按 JWT 有效期派生;强制登出需吊销 token。
3. 角色内置 6 个是示例,真实由 `sys_role` 维护;角色色/权限动作集需可配。
4. 创建用户/角色、重置密码、删除均为 mock,需接现有 AdminController/RoleController。
