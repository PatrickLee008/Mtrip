# standards 开发规范

目录预留:跨端通用开发规范(命名/提交/评审等)归此。

当前生效的约定:

- 后端约定(响应格式/错误码/字段命名/路由前缀/代码范本):`docs/plans/HANDOFF.md` 第 4 节
- 前端页面代码模式:`docs/plans/HANDOFF.md` 第 5 节
- 统一错误码定义:`backend/shared/src/Constants/ErrorCode.php`
- 权限键规范:`#[Permission]` 注解键与 `database/seed/02-menu.sql` perm_key 一致
- Hyperf 生产环境编码与上线检查:`Hyperf生产环境避坑规范.md`(协程/连接池/进程模型/安全编码)
- 三端前端框架层同步检查:`三端前端同步检查规范.md`(guard/directives/composables/utils 克隆文件清单、差异白名单与比对命令)
- 管理后台多语言规范:见下文「管理后台多语言规范」

## 管理后台多语言规范(admin-web,vue-i18n)

### 基础策略

- 默认语言与 fallbackLocale 均为 `en-US`;`src/locales/en-US.ts` 是**全量词条源**(新增文案必须先加英文),`zh-CN.ts` 只维护已翻译部分,缺失 key 自动回退英文。
- 语言列表由 `src/locales/index.ts` 的 `SUPPORTED_LOCALES` 维护;模板内禁止硬编码中/英文文案,一律 `t('xxx')`。
- 词条文件内**同一层级禁止重复 key**(后者会静默覆盖前者),提交前用 `npx vue-tsc --noEmit` 把关(TS1117)。

### 菜单多语言(sys_menu 三字段)

| 字段 | 含义 | 填写要求 |
| --- | --- | --- |
| `menu_name` | 中文名称 | 必填 |
| `menu_name_en` | 英文名称,词条未命中时非中文环境的回退显示名 | 建议全部填写(含按钮) |
| `i18n_key` | 多语言标记,对应前端词条 key(如 `menu.systemAdmin`) | 目录/页面必填;按钮不占词条,留空 |

- 显示名解析统一走 `src/locales/menuI18n.ts` 的 `resolveMenuTitle` / `menuTitle`(侧边栏、面包屑、页面标题、document.title、角色权限树均复用),优先级:
  1. `i18n_key` 命中词条 → `t(i18n_key)`(旧数据无 i18n_key 时用 `MENU_I18N` 中文名映射表兜底);
  2. 未命中且当前非中文环境 → `menu_name_en`;
  3. 其余 → `menu_name`。
- 动态路由 meta 约定(`router/dynamic.ts`):`title` 存词条 key,`rawTitle`/`rawTitleEn` 存原始中/英文名供回退。
- 后端入参驼峰(`menuNameEn`/`i18nKey`),列表行 snake_case 直出(`menu_name_en`/`i18n_key`),与全局字段命名约定一致;菜单管理页(系统管理→菜单权限)可直接维护这两个字段。

### 扩展新语言步骤(如新增日语)

1. 新建 `src/locales/ja-JP.ts`(以 en-US.ts 为模板翻译,允许部分缺失,自动回退英文);
2. 在 `src/locales/index.ts` 的 `messages` 与 `SUPPORTED_LOCALES` 各加一行;
3. 菜单数据(sys_menu)与后端接口**零改动**。
