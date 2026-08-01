<?php

declare(strict_types=1);

/**
 * goods-service 路由总表
 * C端 /api/v1/app/goods/*:公开游客可访问,须携带 X-Site-Id;仅返回已上架商品
 * 管理端 /api/v1/admin/goods/*:JWT 鉴权 + 写操作审计日志,按钮级权限 #[Permission]
 */

use App\Controller\Admin\AdminCategoryController;
use App\Controller\Admin\AdminFilterController;
use App\Controller\Admin\AdminGoodsController;
use App\Controller\Admin\AdminReviewController;
use App\Controller\Admin\AdminSkuController;
use App\Controller\Admin\AdminStockController;
use App\Controller\GoodsController;
use App\Controller\Merchant\GoodsController as MerchantGoodsController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\MerchantAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;
use Mtrip\Shared\Middleware\UserAuthMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'goods-service']);

Router::addGroup('/api/v1/app/goods', static function () {
    Router::get('/home', [GoodsController::class, 'home']);
    Router::get('/category', [GoodsController::class, 'category']);
    Router::get('/list', [GoodsController::class, 'list']);
    Router::get('/detail', [GoodsController::class, 'detail']);
    Router::get('/calendar', [GoodsController::class, 'calendar']);
    Router::get('/reviews', [GoodsController::class, 'reviews']);
    Router::get('/filters', [GoodsController::class, 'filters']);
});

// C端评价提交:需登录(离店/完成后本人订单可评)
Router::addGroup('/api/v1/app/goods', static function () {
    Router::post('/review/add', [GoodsController::class, 'reviewAdd']);
}, [
    'middleware' => [UserAuthMiddleware::class],
]);

// ---------- 管理端商品管理(文档 6.4.3) ----------
Router::addGroup('/api/v1/admin/goods', static function () {
    // 商品主表:CRUD + 状态机(提交审核/审核/上下架/软删)
    Router::get('/list', [AdminGoodsController::class, 'index']);
    Router::get('/detail', [AdminGoodsController::class, 'detail']);
    Router::post('/add', [AdminGoodsController::class, 'create']);
    Router::post('/update', [AdminGoodsController::class, 'update']);
    Router::post('/submit', [AdminGoodsController::class, 'submit']);
    Router::post('/audit', [AdminGoodsController::class, 'audit']);
    Router::post('/toggle-status', [AdminGoodsController::class, 'toggleStatus']);
    Router::post('/delete', [AdminGoodsController::class, 'remove']);

    // 商品分类(树)
    Router::get('/category/list', [AdminCategoryController::class, 'index']);
    Router::post('/category/save', [AdminCategoryController::class, 'save']);
    Router::post('/category/delete', [AdminCategoryController::class, 'remove']);

    // 酒店房型 / 门票票种 / 退改规则
    Router::get('/room/list', [AdminSkuController::class, 'roomList']);
    Router::post('/room/save', [AdminSkuController::class, 'roomSave']);
    Router::post('/room/delete', [AdminSkuController::class, 'roomDelete']);
    Router::get('/ticket/list', [AdminSkuController::class, 'ticketList']);
    Router::post('/ticket/save', [AdminSkuController::class, 'ticketSave']);
    Router::post('/ticket/delete', [AdminSkuController::class, 'ticketDelete']);
    Router::get('/refund-rule/list', [AdminSkuController::class, 'ruleList']);
    Router::post('/refund-rule/save', [AdminSkuController::class, 'ruleSave']);

    // 价格库存日历 / 流水 / 预警 / 总览
    Router::get('/stock/calendar', [AdminStockController::class, 'calendar']);
    Router::post('/stock/batch-set', [AdminStockController::class, 'batchSet']);
    Router::post('/stock/adjust', [AdminStockController::class, 'adjust']);
    Router::get('/stock/logs', [AdminStockController::class, 'logs']);
    Router::get('/stock/low-warning', [AdminStockController::class, 'lowWarning']);
    Router::get('/stock/overview', [AdminStockController::class, 'overview']);

    // 酒店评价审核(PRD 模块4)
    Router::get('/review/list', [AdminReviewController::class, 'index']);
    Router::post('/review/audit', [AdminReviewController::class, 'audit']);
    Router::post('/review/reply', [AdminReviewController::class, 'reply']);

    // 筛选/排序项配置(PRD 模块3)
    Router::get('/filter/list', [AdminFilterController::class, 'filterList']);
    Router::post('/filter/save', [AdminFilterController::class, 'filterSave']);
    Router::post('/filter/delete', [AdminFilterController::class, 'filterDelete']);
    Router::get('/sort/list', [AdminFilterController::class, 'sortList']);
    Router::post('/sort/save', [AdminFilterController::class, 'sortSave']);
    Router::post('/sort/delete', [AdminFilterController::class, 'sortDelete']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);

// ---------- 商户端商品管理(/api/v1/merchant/goods) ----------
// 数据范围由 MerchantContext 裁剪:集团看绑定商户全部、商户/门店看本商户
Router::addGroup('/api/v1/merchant/goods', static function () {
    Router::get('/list', [MerchantGoodsController::class, 'index']);
    Router::get('/detail', [MerchantGoodsController::class, 'detail']);
    Router::post('/add', [MerchantGoodsController::class, 'create']);
    Router::post('/update', [MerchantGoodsController::class, 'update']);
    Router::post('/submit', [MerchantGoodsController::class, 'submit']);
    Router::post('/toggle-status', [MerchantGoodsController::class, 'toggleStatus']);
}, [
    'middleware' => [MerchantAuthMiddleware::class, OperationLogMiddleware::class],
]);
