<?php

declare(strict_types=1);

/**
 * payment-service 路由总表
 * - 渠道回调为外部 Webhook 入口(网关 /api/v1/payment/ 已转发),不挂 Admin 中间件,验签在渠道实现内完成;
 * - /internal/v1/* 为服务间内部接口:网关无对应 location(外网 404),InternalAuthMiddleware 校验内网来源 + X-Internal-Token;
 * - 渠道配置管理(sys_pay_account / sys_pay_channel CRUD)在 system-service,本服务不提供 admin 路由。
 */

use App\Controller\CallbackController;
use App\Controller\Internal\ChannelController;
use App\Controller\Internal\PaymentController;
use App\Controller\Internal\RefundController;
use Hyperf\HttpServer\Router\Router;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'payment-service']);

// 支付渠道 Webhook 回调(Stripe / PayPal / KBZPay MMQR)
Router::addGroup('/api/v1/payment/callback', static function () {
    Router::post('/stripe', [CallbackController::class, 'stripe']);
    Router::post('/paypal', [CallbackController::class, 'paypal']);
    Router::post('/kbz-mmqr', [CallbackController::class, 'kbzMmqr']);
});

// 统一支付中心内部接口(方案 22 §4.2)
Router::addGroup('/internal/v1', static function () {
    Router::post('/payment/create', [PaymentController::class, 'create']);
    Router::post('/payment/query', [PaymentController::class, 'query']);
    Router::post('/payment/renotify', [PaymentController::class, 'renotify']);
    Router::post('/refund/create', [RefundController::class, 'create']);
    Router::post('/refund/query', [RefundController::class, 'query']);
    Router::post('/channel/test', [ChannelController::class, 'test']);
    Router::post('/channel/available', [ChannelController::class, 'available']);
});