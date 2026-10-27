# 2026-10-27 平台 FAQ 内部错误修复

## 故障与依据

用户反馈本机 8090 超级管理后台 FAQ 文章页面提示服务器内部错误。system-service 日志定位到：

```text
Call to undefined method App\Controller\Admin\HelpController::applySiteScope()
```

FAQ 页面先加载分类列表，`HelpController::categories()` 调用了缺失的站点过滤方法；文章、公告、搜索分析也依赖它。本轮 Support 开发前的当前 HEAD 中，`HelpController` 已存在这些调用，但 `AbstractController` 没有对应实现。本次排查前这两个文件均未被 Support 改动，HelpController 工作区内容与 HEAD 一致；网关原有 admin help 路由仍归 system-service，Support 新路由归 merchant-service。现有证据确认是基线中已存在的缺失实现，不能据此确定最早引入时间。此前 Support 交付未回归平台原有 FAQ 管理页，遗漏了这个故障。

## 修复范围

- 在 system-service `AbstractController` 补充 `applySiteScope()`，统一使用现有 `AdminContext::scopeSiteId()`：超管可查全部或指定站点，普通管理员强制限定本站点。
- 新增 `test/site-scope.php`，通过真实查询构造器验证站点条件，不连接数据库、不写业务数据。
- 通过标准 wrapper 重启本机 system-service 主池及 APP 池，使运行进程加载修复。
- 本次没有修改前端业务代码、迁移、菜单或账号权限，没有创建 FAQ 数据，没有提交或推送。

## 验证

1. 回归测试修复前复现缺失方法异常，修复后 6 项通过：超管全部、超管指定站点、普通管理员默认/指定本站/尝试跨站、非超管 site_id=0 仍限制为 0。
2. 8090 真实超管登录态下，FAQ 文章、分类、公告、搜索分析四页正常加载；实际列表为空，未伪造文章。修复后的浏览器错误日志为空。未执行新增、编辑或删除操作。
3. `bash deploy/mtrip.sh health --dev` 通过：8 个主服务、6 个 APP 实例及网关转发正常。
4. 本轮质量基线通过：PHP lint 447 个文件；shared 150 用例 / 1248 断言；admin-web 类型检查及生产构建；client-app 类型检查。admin-web 构建仍有既有 bundle 体积提示。
5. 专项回归执行方式（服务根目录及 vendor 由运行容器提供）：

```sh
docker exec -i -w /opt/www mtrip-system-service-1 php < backend/services/system-service/test/site-scope.php
```
