<?php

declare(strict_types=1);

/**
 * user-service 路由总表(双前缀)
 * - C端  /api/v1/app/*   :公开 注册/登录;受保护 UserAuthMiddleware(JWT aud=app)
 * - 管理端 /api/v1/admin/user/*:AdminAuthMiddleware + OperationLogMiddleware
 */

use App\Controller\Admin\AdminFeedbackController;
use App\Controller\Admin\AdminUserController;
use App\Controller\AuthController;
use App\Controller\UserController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;
use Mtrip\Shared\Middleware\UserAuthMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'user-service']);

// 公开接口(游客可用,须携带 X-Site-Id)
Router::post('/api/v1/app/auth/register', [AuthController::class, 'register']);
Router::post('/api/v1/app/auth/login', [AuthController::class, 'login']);

// 登录态接口
Router::addGroup('/api/v1/app', static function () {
    Router::post('/auth/logout', [AuthController::class, 'logout']);
    Router::post('/auth/refresh', [AuthController::class, 'refresh']);

    Router::get('/user/me', [UserController::class, 'me']);
    Router::post('/user/update', [UserController::class, 'update']);
    Router::post('/user/change-password', [UserController::class, 'changePassword']);
    Router::get('/user/balance-logs', [UserController::class, 'balanceLogs']);
    Router::get('/user/points-logs', [UserController::class, 'pointsLogs']);
    Router::post('/user/feedback/add', [UserController::class, 'addFeedback']);
    Router::get('/user/feedback/list', [UserController::class, 'feedbackList']);
}, [
    'middleware' => [UserAuthMiddleware::class],
]);

// 管理端:C端用户管理 + 反馈处理
Router::addGroup('/api/v1/admin/user', static function () {
    Router::get('/list', [AdminUserController::class, 'index']);
    Router::get('/detail', [AdminUserController::class, 'detail']);
    Router::post('/toggle-status', [AdminUserController::class, 'toggleStatus']);
    Router::get('/feedback/list', [AdminFeedbackController::class, 'index']);
    Router::post('/feedback/handle', [AdminFeedbackController::class, 'handle']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);
