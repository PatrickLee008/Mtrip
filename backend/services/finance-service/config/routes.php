<?php

declare(strict_types=1);

/**
 * finance-service 路由总表(管理端 /api/v1/admin/finance/*)
 * 结算单自动生成 / finance_flow 月分表路由归模块08 定时任务
 */

use App\Controller\AccountEntryController;
use App\Controller\FinanceController;
use App\Controller\SettleController;
use App\Controller\WithdrawController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'finance-service']);

Router::addGroup('/api/v1/admin/finance', static function () {
    // 资金总览与流水
    Router::get('/overview', [FinanceController::class, 'overview']);
    Router::get('/report', [FinanceController::class, 'report']);
    Router::get('/flow/list', [FinanceController::class, 'flows']);
    Router::post('/flow/adjust', [FinanceController::class, 'adjust']);
    // 商户提现
    Router::get('/withdraw/list', [WithdrawController::class, 'index']);
    Router::get('/withdraw/detail', [WithdrawController::class, 'detail']);
    Router::post('/withdraw/audit', [WithdrawController::class, 'audit']);
    Router::post('/withdraw/confirm-pay', [WithdrawController::class, 'confirmPay']);
    // 商户结算单
    Router::get('/settle/list', [SettleController::class, 'index']);
    Router::get('/settle/detail', [SettleController::class, 'detail']);
    Router::post('/settle/confirm', [SettleController::class, 'confirm']);
    Router::post('/settle/mark-paid', [SettleController::class, 'markPaid']);
    Router::post('/settle/dispute', [SettleController::class, 'dispute']);
    // 结算分账报表(PRD 模块8,只读)
    Router::get('/entry/list', [AccountEntryController::class, 'index']);
    Router::get('/entry/summary', [AccountEntryController::class, 'summary']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);
