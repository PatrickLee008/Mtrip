<?php

declare(strict_types=1);

/**
 * merchant-service 路由总表(管理端,文档 6.4.2 商户管理 + 业务模块2 供应商)
 * 前缀 /api/v1/admin/{merchant|supplier}/*,JWT 鉴权 + 写操作审计日志
 * 按钮级权限由控制器 #[Permission] 注解校验
 */

use App\Controller\MerchantController;
use App\Controller\SupplierController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
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
