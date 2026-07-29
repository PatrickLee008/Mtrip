<?php

declare(strict_types=1);

/**
 * payment-service 路由总表
 * 渠道回调为外部 Webhook 入口,不挂 Admin 中间件(验签在渠道实现内完成,模块08 启用)
 * 渠道配置管理(sys_pay_channel CRUD)在 system-service,本服务只做收单/退款/回调
 */

use App\Controller\CallbackController;
use Hyperf\HttpServer\Router\Router;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'payment-service']);

// 支付渠道 Webhook 回调(Stripe / PayPal)
Router::addGroup('/api/v1/payment/callback', static function () {
    Router::post('/stripe', [CallbackController::class, 'stripe']);
    Router::post('/paypal', [CallbackController::class, 'paypal']);
});
