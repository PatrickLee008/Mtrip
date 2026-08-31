<?php

declare(strict_types=1);

/**
 * system-service 路由总表(文档第二部分 11 底层模块 + 第三部分 3 客户端鉴权模块)
 * 前缀约定:/api/v1/admin/{module}/...(module 与 OperationLogMiddleware::MODULE_MAP 对齐)
 * 受保护组:JWT 鉴权 + 写操作审计日志;按钮级权限由控制器 #[Permission] 注解校验
 */

use App\Controller\Admin\AdminController;
use App\Controller\Admin\ApiLogController;
use App\Controller\Admin\AuthController;
use App\Controller\Admin\ClientController;
use App\Controller\Admin\FeatureController;
use App\Controller\Admin\FileController;
use App\Controller\Admin\GlobalConfigController;
use App\Controller\Admin\HelpController;
use App\Controller\Admin\MapConfigController;
use App\Controller\Admin\MenuController;
use App\Controller\Admin\OperationLogController;
use App\Controller\Admin\PayChannelController;
use App\Controller\Admin\PermTemplateController;
use App\Controller\Admin\RecycleController;
use App\Controller\Admin\RoleController;
use App\Controller\Admin\SiteController;
use App\Controller\Admin\SmsController;
use App\Controller\Admin\StorageController;
use App\Controller\App\AppSiteController;
use App\Controller\ThemeController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'system-service']);

// 登录(无需鉴权,登录记录写 sys_admin_login_log)
Router::post('/api/v1/admin/auth/login', [AuthController::class, 'login']);

// C端公开站点接口(模块09 移动端微服务,无需登录)
Router::get('/api/v1/app/site/list', [AppSiteController::class, 'list']);
Router::get('/api/v1/app/site/config', [AppSiteController::class, 'config']);
// C端动态主题(无需登录,PRD 模块15)
Router::get('/api/v1/app/theme/active', [ThemeController::class, 'active']);

Router::addGroup('/api/v1/admin', static function () {
    // ---------- 登录态 ----------
    Router::post('/auth/logout', [AuthController::class, 'logout']);
    Router::get('/auth/me', [AuthController::class, 'me']);
    Router::get('/auth/menus', [AuthController::class, 'menus']);
    Router::post('/auth/password', [AuthController::class, 'updatePassword']);

    // ---------- 动态主题管理(PRD 模块15)----------
    Router::get('/config/theme/list', [ThemeController::class, 'adminList']);
    Router::post('/config/theme/save', [ThemeController::class, 'save']);
    Router::post('/config/theme/delete', [ThemeController::class, 'delete']);

    // ---------- 模块1 管理员账号管理 ----------
    Router::get('/sys/admin/list', [AdminController::class, 'index']);
    Router::get('/sys/admin/detail', [AdminController::class, 'detail']);
    Router::post('/sys/admin/add', [AdminController::class, 'create']);
    Router::post('/sys/admin/update', [AdminController::class, 'update']);
    Router::post('/sys/admin/delete', [AdminController::class, 'delete']);
    Router::post('/sys/admin/reset-password', [AdminController::class, 'resetPassword']);
    Router::post('/sys/admin/toggle-status', [AdminController::class, 'toggleStatus']);
    Router::get('/sys/admin/login-logs', [AdminController::class, 'loginLogs']);

    // ---------- 模块2 角色权限管理 ----------
    Router::get('/sys/role/list', [RoleController::class, 'index']);
    Router::get('/sys/role/all', [RoleController::class, 'all']);
    Router::post('/sys/role/add', [RoleController::class, 'create']);
    Router::post('/sys/role/update', [RoleController::class, 'update']);
    Router::post('/sys/role/delete', [RoleController::class, 'delete']);
    Router::post('/sys/role/toggle-status', [RoleController::class, 'toggleStatus']);
    Router::get('/sys/role/perms', [RoleController::class, 'perms']);
    Router::post('/sys/role/assign-perms', [RoleController::class, 'assignPerms']);
    Router::get('/sys/role/admins', [RoleController::class, 'admins']);

    // ---------- 模块3 菜单&按钮权限管理 ----------
    Router::get('/sys/menu/tree', [MenuController::class, 'tree']);
    Router::post('/sys/menu/add', [MenuController::class, 'create']);
    Router::post('/sys/menu/update', [MenuController::class, 'update']);
    Router::post('/sys/menu/delete', [MenuController::class, 'delete']);

    // ---------- 模块4 系统操作日志(只读,禁止删改) ----------
    Router::get('/sys/oplog/list', [OperationLogController::class, 'index']);
    Router::get('/sys/oplog/detail', [OperationLogController::class, 'detail']);

    // ---------- 回收站(软删数据统一管理,跨两库) ----------
    Router::get('/sys/recycle/tables', [RecycleController::class, 'tables']);
    Router::get('/sys/recycle/list', [RecycleController::class, 'index']);
    Router::post('/sys/recycle/restore', [RecycleController::class, 'restore']);
    Router::post('/sys/recycle/purge', [RecycleController::class, 'purge']);
    Router::post('/sys/recycle/empty', [RecycleController::class, 'empty']);

    // ---------- 模块5 全局系统配置 ----------
    Router::get('/sys/config/list', [GlobalConfigController::class, 'index']);
    Router::post('/sys/config/save', [GlobalConfigController::class, 'save']);
    Router::post('/sys/config/reset', [GlobalConfigController::class, 'reset']);

    // ---------- 模块6 多站点配置 ----------
    Router::get('/site/tree', [SiteController::class, 'tree']);
    Router::get('/site/list', [SiteController::class, 'index']);
    Router::post('/site/add', [SiteController::class, 'create']);
    Router::post('/site/update', [SiteController::class, 'update']);
    Router::post('/site/delete', [SiteController::class, 'delete']);
    Router::post('/site/toggle-status', [SiteController::class, 'toggleStatus']);
    Router::get('/site/configs', [SiteController::class, 'configs']);
    Router::post('/site/save-configs', [SiteController::class, 'saveConfigs']);

    // ---------- 模块7 文件存储配置 + 文件库 ----------
    Router::get('/sys/storage/list', [StorageController::class, 'index']);
    Router::post('/sys/storage/add', [StorageController::class, 'create']);
    Router::post('/sys/storage/update', [StorageController::class, 'update']);
    Router::post('/sys/storage/delete', [StorageController::class, 'delete']);
    Router::post('/sys/storage/toggle-status', [StorageController::class, 'toggleStatus']);
    Router::get('/sys/file/list', [FileController::class, 'index']);
    Router::get('/sys/file/tree', [FileController::class, 'tree']);
    Router::post('/sys/file/dir/save', [FileController::class, 'saveDir']);
    Router::post('/sys/file/dir/delete', [FileController::class, 'deleteDir']);
    Router::post('/sys/file/upload', [FileController::class, 'upload']);
    Router::post('/sys/file/delete', [FileController::class, 'delete']);

    // ---------- 模块8 支付渠道配置 ----------
    Router::get('/sys/pay/list', [PayChannelController::class, 'index']);
    Router::post('/sys/pay/add', [PayChannelController::class, 'create']);
    Router::post('/sys/pay/update', [PayChannelController::class, 'update']);
    Router::post('/sys/pay/delete', [PayChannelController::class, 'delete']);
    Router::post('/sys/pay/toggle-status', [PayChannelController::class, 'toggleStatus']);
    Router::post('/sys/pay/copy', [PayChannelController::class, 'copy']);

    // ---------- 模块9 短信渠道/模板/日志 ----------
    Router::get('/sys/sms/channel/list', [SmsController::class, 'channels']);
    Router::post('/sys/sms/channel/add', [SmsController::class, 'createChannel']);
    Router::post('/sys/sms/channel/update', [SmsController::class, 'updateChannel']);
    Router::post('/sys/sms/channel/delete', [SmsController::class, 'deleteChannel']);
    Router::post('/sys/sms/channel/toggle-status', [SmsController::class, 'toggleChannelStatus']);
    Router::get('/sys/sms/template/list', [SmsController::class, 'templates']);
    Router::post('/sys/sms/template/add', [SmsController::class, 'createTemplate']);
    Router::post('/sys/sms/template/update', [SmsController::class, 'updateTemplate']);
    Router::post('/sys/sms/template/delete', [SmsController::class, 'deleteTemplate']);
    Router::get('/sys/sms/log/list', [SmsController::class, 'logs']);

    // ---------- 模块10 地图服务配置 ----------
    Router::get('/sys/map/list', [MapConfigController::class, 'index']);
    Router::post('/sys/map/save', [MapConfigController::class, 'save']);

    // ---------- 模块12 客户端密钥管理 ----------
    Router::get('/client/list', [ClientController::class, 'index']);
    Router::get('/client/detail', [ClientController::class, 'detail']);
    Router::post('/client/add', [ClientController::class, 'create']);
    Router::post('/client/update', [ClientController::class, 'update']);
    Router::post('/client/delete', [ClientController::class, 'delete']);
    Router::post('/client/toggle-status', [ClientController::class, 'toggleStatus']);
    Router::post('/client/reset-secret', [ClientController::class, 'resetSecret']);
    Router::get('/client/stats', [ClientController::class, 'stats']);

    // ---------- 模块13 接口权限模板 ----------
    Router::get('/client/perm-template/list', [PermTemplateController::class, 'index']);
    Router::get('/client/perm-template/all', [PermTemplateController::class, 'all']);
    Router::post('/client/perm-template/add', [PermTemplateController::class, 'create']);
    Router::post('/client/perm-template/update', [PermTemplateController::class, 'update']);
    Router::post('/client/perm-template/delete', [PermTemplateController::class, 'delete']);
    Router::post('/client/perm-template/toggle-status', [PermTemplateController::class, 'toggleStatus']);
    Router::get('/client/perm-template/clients', [PermTemplateController::class, 'clients']);

    // ---------- 模块14 接口调用日志(只读) ----------
    Router::get('/client/api-log/list', [ApiLogController::class, 'index']);
    Router::get('/client/api-log/detail', [ApiLogController::class, 'detail']);
    Router::get('/client/api-log/stats', [ApiLogController::class, 'stats']);

    // ---------- 帮助中心(Super Admin Portal · 全新,前缀 /admin/help/*)----------
    Router::get('/help/article/list', [HelpController::class, 'articles']);
    Router::post('/help/article/save', [HelpController::class, 'articleSave']);
    Router::post('/help/article/delete', [HelpController::class, 'articleDelete']);
    Router::get('/help/category/list', [HelpController::class, 'categories']);
    Router::post('/help/category/save', [HelpController::class, 'categorySave']);
    Router::post('/help/category/delete', [HelpController::class, 'categoryDelete']);
    Router::get('/help/announcement/list', [HelpController::class, 'announcements']);
    Router::post('/help/announcement/save', [HelpController::class, 'announcementSave']);
    Router::post('/help/announcement/delete', [HelpController::class, 'announcementDelete']);
    Router::get('/help/analytics', [HelpController::class, 'searchAnalytics']);

    // ---------- 平台特性开关(Super Admin Portal 模块11)----------
    Router::get('/config/features/list', [FeatureController::class, 'index']);
    Router::post('/config/features/save', [FeatureController::class, 'save']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);
