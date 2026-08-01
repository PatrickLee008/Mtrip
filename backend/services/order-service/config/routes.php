<?php

declare(strict_types=1);

/**
 * order-service 路由总表(双前缀)
 * - C端  /api/v1/app/order/*   :UserAuthMiddleware,全部需登录
 * - 管理端 /api/v1/admin/order/*:AdminAuthMiddleware + OperationLogMiddleware
 * 支付本期为 mock,正式 Stripe/PayPal 收单归 payment-service(模块06)
 */

use App\Controller\Admin\AdminOrderController;
use App\Controller\Admin\AdminRefundController;
use App\Controller\Admin\AdminStatsController;
use App\Controller\Admin\AdminVerifyController;
use App\Controller\Merchant\OrderController as MerchantOrderController;
use App\Controller\OrderController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\MerchantAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;
use Mtrip\Shared\Middleware\UserAuthMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'order-service']);

Router::addGroup('/api/v1/app/order', static function () {
    Router::post('/create', [OrderController::class, 'create']);
    Router::post('/pay', [OrderController::class, 'pay']);
    Router::get('/list', [OrderController::class, 'list']);
    Router::get('/detail', [OrderController::class, 'detail']);
    Router::post('/cancel', [OrderController::class, 'cancel']);
    Router::get('/refund/quote', [OrderController::class, 'refundQuote']);
    Router::post('/refund/apply', [OrderController::class, 'applyRefund']);
    Router::get('/verify-code', [OrderController::class, 'verifyCode']);
}, [
    'middleware' => [UserAuthMiddleware::class],
]);

// 管理端:订单 / 退款 / 核销(导出由前端 CSV 实现,后端不做 export 接口)
Router::addGroup('/api/v1/admin/order', static function () {
    // 订单
    Router::get('/list', [AdminOrderController::class, 'index']);
    Router::get('/detail', [AdminOrderController::class, 'detail']);
    Router::get('/statistics', [AdminOrderController::class, 'statistics']);
    Router::post('/modify-price', [AdminOrderController::class, 'modifyPrice']);
    Router::post('/cancel', [AdminOrderController::class, 'cancel']);
    Router::post('/remark', [AdminOrderController::class, 'remark']);
    // 退款(双环节审核:商户→平台→退款中→到账确认)
    Router::get('/refund/list', [AdminRefundController::class, 'index']);
    Router::get('/refund/detail', [AdminRefundController::class, 'detail']);
    Router::post('/refund/audit', [AdminRefundController::class, 'audit']);
    Router::post('/refund/confirm', [AdminRefundController::class, 'confirm']);
    // 核销
    Router::post('/verify', [AdminVerifyController::class, 'verify']);
    Router::post('/verify-cancel', [AdminVerifyController::class, 'verifyCancel']);
    Router::get('/verify/logs', [AdminVerifyController::class, 'logs']);
    // 数据统计中心(只读):数据大屏 + 站点/商户/商品维度报表
    Router::get('/stats/dashboard', [AdminStatsController::class, 'dashboard']);
    Router::get('/stats/report', [AdminStatsController::class, 'report']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);

// 商户端(merchant-web):订单与核销,MerchantAuthMiddleware 鉴权 + 商户数据范围
Router::addGroup('/api/v1/merchant/order', static function () {
    Router::get('/list', [MerchantOrderController::class, 'index']);
    Router::get('/detail', [MerchantOrderController::class, 'detail']);
    Router::post('/verify', [MerchantOrderController::class, 'verify']);
}, [
    'middleware' => [MerchantAuthMiddleware::class, OperationLogMiddleware::class],
]);
