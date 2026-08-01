<?php

declare(strict_types=1);

/**
 * user-service 路由总表(双前缀)
 * - C端  /api/v1/app/*   :公开 注册/登录;受保护 UserAuthMiddleware(JWT aud=app)
 * - 管理端 /api/v1/admin/user/*:AdminAuthMiddleware + OperationLogMiddleware
 */

use App\Controller\Admin\AdminChatController;
use App\Controller\Admin\AdminFeedbackController;
use App\Controller\Admin\AdminRiskController;
use App\Controller\Admin\AdminUserController;
use App\Controller\AppealController;
use App\Controller\AuthController;
use App\Controller\ChatController;
use App\Controller\FavoriteController;
use App\Controller\NotifyController;
use App\Controller\ReferralController;
use App\Controller\TravelerController;
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

    // 常旅客(Frequent Traveler)
    Router::get('/user/traveler/list', [TravelerController::class, 'list']);
    Router::post('/user/traveler/add', [TravelerController::class, 'add']);
    Router::post('/user/traveler/update', [TravelerController::class, 'update']);
    Router::post('/user/traveler/delete', [TravelerController::class, 'delete']);

    // 收藏(Saved Hotels)
    Router::get('/user/favorite/list', [FavoriteController::class, 'list']);
    Router::post('/user/favorite/add', [FavoriteController::class, 'add']);
    Router::post('/user/favorite/remove', [FavoriteController::class, 'remove']);

    // 推荐返利(Refer & Earn)
    Router::get('/user/referral/my', [ReferralController::class, 'my']);
    Router::get('/user/referral/invitees', [ReferralController::class, 'invitees']);

    // 站内通知(Notification Center)
    Router::get('/user/notify/list', [NotifyController::class, 'list']);
    Router::get('/user/notify/unread-count', [NotifyController::class, 'unreadCount']);
    Router::post('/user/notify/read', [NotifyController::class, 'read']);

    // 风控申诉(Booking Risk Appeal)
    Router::get('/user/appeal/status', [AppealController::class, 'status']);
    Router::post('/user/appeal/submit', [AppealController::class, 'submit']);

    // 在线客服 / 与酒店聊天(Chat)
    Router::get('/chat/faqs', [ChatController::class, 'faqs']);
    Router::get('/chat/conversations', [ChatController::class, 'conversations']);
    Router::post('/chat/start', [ChatController::class, 'start']);
    Router::get('/chat/messages', [ChatController::class, 'messages']);
    Router::post('/chat/send', [ChatController::class, 'send']);
    Router::post('/chat/finish', [ChatController::class, 'finish']);
    Router::post('/chat/rate', [ChatController::class, 'rate']);
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
    // 风控与申诉(PRD 模块10.1)
    Router::get('/appeal/list', [AdminRiskController::class, 'appealList']);
    Router::post('/appeal/handle', [AdminRiskController::class, 'appealHandle']);
    Router::get('/fraud/list', [AdminRiskController::class, 'fraudList']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);

// 管理端:客服工作台(PRD 模块13)
Router::addGroup('/api/v1/admin/chat', static function () {
    Router::get('/list', [AdminChatController::class, 'index']);
    Router::get('/messages', [AdminChatController::class, 'messages']);
    Router::post('/reply', [AdminChatController::class, 'reply']);
    Router::post('/close', [AdminChatController::class, 'close']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);
