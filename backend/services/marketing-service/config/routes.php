<?php

declare(strict_types=1);

/**
 * marketing-service 路由总表(管理端 /api/v1/admin/marketing/*)
 * 活动/Banner/积分商城归后续迭代;本期落地优惠券模板 + 领券记录
 */

use App\Controller\CouponController;
use App\Controller\MarketingController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;
use Mtrip\Shared\Middleware\UserAuthMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'marketing-service']);

// C端营销:促销中心 / 领券中心 / 我的券 / 自动择优(登录态)
Router::addGroup('/api/v1/app/marketing', static function () {
    Router::get('/promotion/banners', [MarketingController::class, 'promotionBanners']);
    Router::get('/coupon/available', [MarketingController::class, 'availableCoupons']);
    Router::post('/coupon/claim', [MarketingController::class, 'claim']);
    Router::get('/coupon/my', [MarketingController::class, 'myCoupons']);
    Router::get('/coupon/best-match', [MarketingController::class, 'bestMatch']);
}, [
    'middleware' => [UserAuthMiddleware::class],
]);

Router::addGroup('/api/v1/admin/marketing', static function () {
    Router::get('/coupon/list', [CouponController::class, 'index']);
    Router::get('/coupon/detail', [CouponController::class, 'detail']);
    Router::post('/coupon/add', [CouponController::class, 'add']);
    Router::post('/coupon/update', [CouponController::class, 'update']);
    Router::post('/coupon/publish', [CouponController::class, 'publish']);
    Router::post('/coupon/toggle-status', [CouponController::class, 'toggleStatus']);
    Router::post('/coupon/finish', [CouponController::class, 'finish']);
    Router::post('/coupon/delete', [CouponController::class, 'remove']);
    Router::get('/coupon/receives', [CouponController::class, 'receives']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);
