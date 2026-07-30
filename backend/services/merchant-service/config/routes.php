<?php

declare(strict_types=1);

/**
 * merchant-service 路由总表(管理端,文档 6.4.2 商户管理 + 业务模块2 供应商)
 * 前缀 /api/v1/admin/{merchant|supplier}/*,JWT 鉴权 + 写操作审计日志
 * 按钮级权限由控制器 #[Permission] 注解校验
 */

use App\Controller\GroupController;
use App\Controller\Merchant\AccountController as MerchantAccountController;
use App\Controller\Merchant\AuthController as MerchantAuthController;
use App\Controller\Merchant\RoleController as MerchantRoleController;
use App\Controller\Merchant\StoreController as MerchantStoreController;
use App\Controller\MerchantController;
use App\Controller\StoreController;
use App\Controller\SupplierController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\MerchantAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'merchant-service']);

Router::addGroup('/api/v1/admin', static function () {
    // ---------- 商户管理(11 接口,文档 6.4.2) ----------
    Router::get('/merchant/list', [MerchantController::class, 'index']);
    Router::get('/merchant/detail', [MerchantController::class, 'detail']);
    Router::post('/merchant/add', [MerchantController::class, 'create']);
    Router::post('/merchant/update', [MerchantController::class, 'update']);
    Router::post('/merchant/audit', [MerchantController::class, 'audit']);
    Router::post('/merchant/toggle-status', [MerchantController::class, 'toggleStatus']);
    Router::post('/merchant/commission', [MerchantController::class, 'commission']);
    Router::get('/merchant/account', [MerchantController::class, 'accounts']);
    Router::post('/merchant/account-save', [MerchantController::class, 'saveAccount']);
    Router::post('/merchant/close', [MerchantController::class, 'close']);
    Router::get('/merchant/statistics', [MerchantController::class, 'statistics']);
    Router::get('/merchant/statement', [MerchantController::class, 'statement']);

    // ---------- 集团管理(计划 11:管理/授权实体,商户授权绑定) ----------
    Router::get('/merchant/group/list', [GroupController::class, 'index']);
    Router::get('/merchant/group/detail', [GroupController::class, 'detail']);
    Router::post('/merchant/group/add', [GroupController::class, 'create']);
    Router::post('/merchant/group/update', [GroupController::class, 'update']);
    Router::post('/merchant/group/toggle-status', [GroupController::class, 'toggleStatus']);
    Router::post('/merchant/group/bind', [GroupController::class, 'bind']);
    Router::post('/merchant/group/unbind', [GroupController::class, 'unbind']);
    Router::post('/merchant/group/account-reset', [GroupController::class, 'accountReset']);
    Router::post('/merchant/group/delete', [GroupController::class, 'remove']);

    // ---------- 门店管理(计划 11:履约/核销单元,审核通过自动建主门店) ----------
    Router::get('/merchant/store/list', [StoreController::class, 'index']);
    Router::get('/merchant/store/detail', [StoreController::class, 'detail']);
    Router::post('/merchant/store/add', [StoreController::class, 'create']);
    Router::post('/merchant/store/update', [StoreController::class, 'update']);
    Router::post('/merchant/store/set-main', [StoreController::class, 'setMain']);
    Router::post('/merchant/store/toggle-status', [StoreController::class, 'toggleStatus']);
    Router::post('/merchant/store/account-reset', [StoreController::class, 'accountReset']);
    Router::post('/merchant/store/delete', [StoreController::class, 'remove']);

    // ---------- 供应商管理(CRUD/资质审核/供货商品/结算) ----------
    Router::get('/supplier/list', [SupplierController::class, 'index']);
    Router::get('/supplier/detail', [SupplierController::class, 'detail']);
    Router::post('/supplier/add', [SupplierController::class, 'create']);
    Router::post('/supplier/update', [SupplierController::class, 'update']);
    Router::post('/supplier/audit', [SupplierController::class, 'audit']);
    Router::post('/supplier/toggle-status', [SupplierController::class, 'toggleStatus']);
    Router::post('/supplier/terminate', [SupplierController::class, 'terminate']);
    Router::get('/supplier/goods/list', [SupplierController::class, 'goodsList']);
    Router::post('/supplier/goods/add', [SupplierController::class, 'goodsAdd']);
    Router::post('/supplier/goods/update', [SupplierController::class, 'goodsUpdate']);
    Router::post('/supplier/goods/delete', [SupplierController::class, 'goodsDelete']);
    Router::get('/supplier/settle/list', [SupplierController::class, 'settleList']);
    Router::post('/supplier/settle/audit', [SupplierController::class, 'settleAudit']);
    Router::post('/supplier/settle/confirm-pay', [SupplierController::class, 'settleConfirmPay']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);

// ============================================================
// 商户端(merchant-web)口径:前缀 /api/v1/merchant/*,MerchantAuthMiddleware 鉴权
// account_type(1集团/2商户/3门店)裁剪菜单与数据范围;按钮级权限由 #[Permission] 校验
// ============================================================
// 登录(组外,免鉴权)
Router::post('/api/v1/merchant/auth/login', [MerchantAuthController::class, 'login']);

Router::addGroup('/api/v1/merchant', static function () {
    // ---------- 登录态 ----------
    Router::post('/auth/logout', [MerchantAuthController::class, 'logout']);
    Router::get('/auth/me', [MerchantAuthController::class, 'me']);
    Router::get('/auth/menus', [MerchantAuthController::class, 'menus']);
    Router::post('/auth/password', [MerchantAuthController::class, 'updatePassword']);

    // ---------- 子账号管理 ----------
    Router::get('/account/list', [MerchantAccountController::class, 'index']);
    Router::post('/account/add', [MerchantAccountController::class, 'create']);
    Router::post('/account/update', [MerchantAccountController::class, 'update']);
    Router::post('/account/toggle-status', [MerchantAccountController::class, 'toggleStatus']);
    Router::post('/account/reset-password', [MerchantAccountController::class, 'resetPassword']);

    // ---------- 角色管理 ----------
    Router::get('/role/list', [MerchantRoleController::class, 'index']);
    Router::get('/role/menu-tree', [MerchantRoleController::class, 'menuTree']);
    Router::get('/role/menus', [MerchantRoleController::class, 'menus']);
    Router::post('/role/add', [MerchantRoleController::class, 'create']);
    Router::post('/role/update', [MerchantRoleController::class, 'update']);
    Router::post('/role/delete', [MerchantRoleController::class, 'remove']);
    Router::post('/role/assign', [MerchantRoleController::class, 'assign']);
    Router::post('/role/grant', [MerchantRoleController::class, 'grant']);
    Router::get('/role/account-roles', [MerchantRoleController::class, 'accountRoles']);

    // ---------- 门店管理 ----------
    Router::get('/store/list', [MerchantStoreController::class, 'index']);
    Router::get('/store/detail', [MerchantStoreController::class, 'detail']);
    Router::post('/store/add', [MerchantStoreController::class, 'create']);
    Router::post('/store/update', [MerchantStoreController::class, 'update']);
    Router::post('/store/set-main', [MerchantStoreController::class, 'setMain']);
    Router::post('/store/toggle-status', [MerchantStoreController::class, 'toggleStatus']);
}, [
    'middleware' => [MerchantAuthMiddleware::class, OperationLogMiddleware::class],
]);
