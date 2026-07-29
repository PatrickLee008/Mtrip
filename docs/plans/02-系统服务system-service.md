# 模块02:系统服务 system-service(后台权限与底层配置)

状态:已完成(接口编码+语法验证,Docker 运行联调归入模块08) | 进度:100% | 依赖:模块01、模块03 | 更新时间:2026-07-28

## 目标

实现功能设计文档「第二部分 11 个底层模块 + 第三部分 3 个客户端鉴权模块」的全部后端接口,是管理后台首期核心服务。路由前缀 `/api/v1/admin/sys/*`、`/api/v1/admin/site/*` 等。

## 任务清单

### 服务骨架
- [x] Hyperf 3.1 项目骨架(Dockerfile、config、引入 mtrip/shared)
- [x] 登录/登出/当前管理员信息接口(JWT 签发,登录错误锁定策略)

### 模块1 管理员账号管理
- [x] 管理员 CRUD、分页筛选(账号/站点/状态)、重置密码、启停、批量操作、登录记录查询
- [x] 站点管理员仅能创建本站点子账号的权限约束

### 模块2 角色权限管理
- [x] 角色 CRUD(全局角色/站点角色)、权限分配(菜单+按钮+接口三层)、查看绑定管理员、启停、删除校验

### 模块3 菜单&按钮权限管理
- [x] 菜单树 CRUD(一级菜单/页面菜单/页面按钮)、排序、显隐、删除校验、权限标识维护
- [x] 动态菜单接口:按管理员角色返回可见菜单树 + 按钮权限标识集合

### 模块4 系统操作日志
- [x] 日志分页筛选、详情(修改前后对比);禁止删改(Excel 导出由前端基于分页接口实现,归入模块05)

### 模块5 全局系统配置
- [x] 分组配置读写(平台基础/安全策略/上传限制/客户端&日志全局)、重置默认、变更留痕(OperationLogMiddleware 自动落库)

### 模块6 多站点配置
- [x] 站点树形 CRUD(国家/区域/城市层级)、差异化参数(货币/时区/税率/抽佣)、启停、删除校验、绑定关系查询

### 模块7~10 第三方服务配置
- [x] 文件存储配置 CRUD(S3/R2/本地,AES 加密+脱敏)+ 文件库管理
- [x] 支付渠道配置 CRUD(Stripe/PayPal,批量复制到其他站点)
- [x] 短信渠道 + 模板管理 + 发送日志(手机号解密后脱敏回显)
- [x] 地图服务配置 CRUD(Google Maps,按站点 upsert)

### 模块12~14 客户端鉴权
- [x] 客户端密钥管理:CRUD、生成 ClientId/Secret、重置密钥、绑定权限模板、启停、调用统计(明文 Secret 仅创建/重置返回一次)
- [x] 接口权限模板:CRUD、白/黑名单模式、绑定客户端查询、启停
- [x] 接口调用日志:分页筛选、详情、统计(近N天趋势/失败量/平均耗时/TOP10 接口)

## 验收标准

- 所有接口通过 JWT + RBAC + site_id 双重校验
- 写操作自动落系统操作日志
- 密钥字段库内 AES 加密、返回脱敏

## 完成记录

- 2026-07-28 编码完成并通过本机 `php -l` 全量语法检查(65 个文件零报错):
  - 骨架 16 文件:composer.json / bin/hyperf.php / config 全套 / routes.php(148行) / CorsMiddleware / Dockerfile
  - app 层 33 文件:14 Model + AbstractController + 15 Controller + AuthService + TreeHelper + SecretField
  - 关键实现:JWT 登录(失败5次锁30分钟+登录留痕)、Permission 注解与种子 perm_key 严格对齐、站点隔离双重校验(newSiteQuery+findScoped 40302)、密钥 AES-256-GCM 加密+脱敏回显、手机号加密入库脱敏展示、写操作经 OperationLogMiddleware 自动审计
  - 精简决策:关联表/日志表(admin_role、role_menu、login_log、operation_log、api_access_log、sms_log)不建 Model 直接 Db::table 操作
- 待模块08:Docker 构建运行、接口全链路联调、操作日志导出联测
