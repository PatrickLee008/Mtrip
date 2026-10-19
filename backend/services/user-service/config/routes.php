<?php

declare(strict_types=1);

/**
 * user-service 路由总表(双前缀)
 * - C端  /api/v1/app/*   :公开 注册/登录;受保护 UserAuthMiddleware(JWT aud=app)
 * - 管理端 /api/v1/admin/user/*:AdminAuthMiddleware + OperationLogMiddleware
 */

use App\Controller\Admin\AdminRealNameController;
use App\Controller\Admin\AdminChatController;
use App\Controller\Admin\AdminFeedbackController;
use App\Controller\Admin\AdminRiskController;
use App\Controller\Admin\AdminReferralController;
use App\Controller\Admin\AdminUserController;
use App\Controller\App\AppealController;
use App\Controller\App\AuthController;
use App\Controller\App\ChatController;
use App\Controller\App\FavoriteController;
use App\Controller\App\NotifyController;
use App\Controller\App\ProfileSetupController;
use App\Controller\App\ReviewMediaController;
use App\Controller\App\ReferralController;
use App\Controller\App\TravelerController;
use App\Controller\App\UserController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;
use Mtrip\Shared\Middleware\UserAuthMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'user-service']);

// 公开接口(游客可用,须携带 X-Site-Id)
Router::post('/api/v1/app/auth/register', [AuthController::class, 'register']);
Router::post('/api/v1/app/auth/login', [AuthController::class, 'login']);
// 短信验证码(SMSPoh Verify API V3):三场景共用发码/验码,验码换一次性 verifyToken
Router::post('/api/v1/app/auth/sms/send', [AuthController::class, 'smsSend']);
Router::post('/api/v1/app/auth/sms/verify', [AuthController::class, 'smsVerify']);
Router::post('/api/v1/app/auth/login-by-sms', [AuthController::class, 'loginBySms']);
Router::post('/api/v1/app/auth/reset-password', [AuthController::class, 'resetPassword']);

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

    // 资料向导(Set Up Profile):回填 / 第1步个人资料 / 第2步实名资料 / 图片上传
    Router::get('/user/profile-setup/detail', [ProfileSetupController::class, 'detail']);
    Router::post('/user/profile-setup/profile', [ProfileSetupController::class, 'saveProfile']);
    Router::post('/user/profile-setup/identity', [ProfileSetupController::class, 'submitIdentity']);
    Router::post('/user/upload', [ProfileSetupController::class, 'upload']);
    // 订单评价的图片 / 视频上传(goods-service review/add 按本人目录前缀校验)
    Router::post('/user/review-media', [ReviewMediaController::class, 'upload']);

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
    Router::get('/chat/detail', [ChatController::class, 'detail']);
    Router::post('/chat/receipt', [ChatController::class, 'receipt']);
    Router::post('/chat/ticket', [\App\Controller\ChatTransportController::class, 'ticket']);
    Router::post('/chat/upload', [\App\Controller\ChatTransportController::class, 'upload']);
    Router::post('/chat/file-ticket', [\App\Controller\ChatTransportController::class, 'fileTicket']);
    Router::get('/chat/faqs', [ChatController::class, 'faqs']);
    Router::get('/chat/conversations', [ChatController::class, 'conversations']);
    Router::get('/chat/summary', [ChatController::class, 'summary']);
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
    Router::post('/adjust-balance', [AdminUserController::class, 'adjustBalance']);
    Router::post('/toggle-status', [AdminUserController::class, 'toggleStatus']);
    Router::get('/feedback/list', [AdminFeedbackController::class, 'index']);
    Router::post('/feedback/handle', [AdminFeedbackController::class, 'handle']);
    // 风控与申诉(PRD 模块10.1)
    Router::get('/appeal/list', [AdminRiskController::class, 'appealList']);
    Router::post('/appeal/handle', [AdminRiskController::class, 'appealHandle']);
    Router::get('/fraud/list', [AdminRiskController::class, 'fraudList']);
    // 推荐返利记录(Super Admin Portal Phase 2 · Referral)
    Router::get('/referral-list', [AdminReferralController::class, 'index']);
    // Customer 360 + 黑名单(Super Admin Portal Phase 3)
    Router::get('/customer360', [AdminUserController::class, 'customer360']);
    Router::post('/blacklist', [AdminUserController::class, 'blacklist']);
    Router::post('/unblacklist', [AdminUserController::class, 'unblacklist']);
    // 实名审核(App 资料向导第 2 步提交的实名资料)
    Router::get('/real-name/queues', [AdminRealNameController::class, 'queues']);
    Router::get('/real-name/list', [AdminRealNameController::class, 'index']);
    Router::get('/real-name/detail', [AdminRealNameController::class, 'detail']);
    Router::post('/real-name/approve', [AdminRealNameController::class, 'approve']);
    Router::post('/real-name/reject', [AdminRealNameController::class, 'reject']);
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

// Download tickets are single-use capabilities; the handler rechecks live conversation access.
Router::get('/api/v1/app/chat/file', [\App\Controller\ChatTransportController::class, 'file']);
Router::get('/api/v1/merchant/chat/file', [\App\Controller\ChatTransportController::class, 'file']);
Router::addGroup('/api/v1/merchant/chat', static function () {
    $c = \App\Controller\Merchant\ChatController::class;
    Router::get('/list', [$c, 'index']);
    Router::get('/summary', [$c, 'summary']);
    Router::get('/preferences', [$c, 'preferences']);
    Router::post('/preferences', [$c, 'savePreferences']);
    Router::post('/contact', [$c, 'contact']);
    Router::get('/detail', [$c, 'detail']);
    Router::get('/messages', [$c, 'messages']);
    Router::get('/note-history', [$c, 'noteHistory']);
    Router::get('/quick-replies', [$c, 'quickReplies']);
    Router::post('/send', [$c, 'send']);
    Router::post('/receipt', [$c, 'receipt']);
    Router::post('/note', [$c, 'saveNote']);
    Router::post('/assign', [$c, 'assign']);
    Router::post('/claim', [$c, 'claim']);
    Router::post('/resolve', [$c, 'resolve']);
    Router::post('/quick-reply', [$c, 'saveQuickReply']);
    Router::post('/ticket', [\App\Controller\ChatTransportController::class, 'ticket']);
    Router::post('/upload', [\App\Controller\ChatTransportController::class, 'upload']);
    Router::post('/file-ticket', [\App\Controller\ChatTransportController::class, 'fileTicket']);
}, ['middleware' => [\Mtrip\Shared\Middleware\MerchantAuthMiddleware::class, OperationLogMiddleware::class]]);
