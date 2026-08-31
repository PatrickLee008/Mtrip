<?php

declare(strict_types=1);

/**
 * merchant-service 路由总表(管理端,文档 6.4.2 商户管理 + 业务模块2 供应商)
 * 前缀 /api/v1/admin/{merchant|supplier}/*,JWT 鉴权 + 写操作审计日志
 * 按钮级权限由控制器 #[Permission] 注解校验
 */

use App\Controller\Admin\GroupController;
use App\Controller\Admin\MerchantController;
use App\Controller\Admin\NotificationController;
use App\Controller\Admin\OnboardingController;
use App\Controller\Admin\PlatformRuleController;
use App\Controller\Admin\RankingController;
use App\Controller\Admin\StoreController;
use App\Controller\Admin\SupplierController;
use App\Controller\Admin\VerifyController;
use App\Controller\Merchant\AccountController as MerchantAccountController;
use App\Controller\Merchant\AuthController as MerchantAuthController;
use App\Controller\Merchant\NotificationController as MerchantNotificationController;
use App\Controller\Merchant\RoleController as MerchantRoleController;
use App\Controller\Merchant\StoreController as MerchantStoreController;
use App\Controller\Supplier\AccountController as SupplierAccountController;
use App\Controller\Supplier\AuthController as SupplierAuthController;
use App\Controller\Supplier\GoodsController as SupplierGoodsController;
use App\Controller\Supplier\RoleController as SupplierRoleController;
use App\Controller\Supplier\SettleController as SupplierSettleController;
use Hyperf\HttpServer\Router\Router;
use Mtrip\Shared\Middleware\AdminAuthMiddleware;
use Mtrip\Shared\Middleware\MerchantAuthMiddleware;
use Mtrip\Shared\Middleware\OperationLogMiddleware;
use Mtrip\Shared\Middleware\SupplierAuthMiddleware;

// 健康检查(网关探活)
Router::get('/healthz', static fn () => ['status' => 'ok', 'service' => 'merchant-service']);

Router::addGroup('/api/v1/admin', static function () {
    // ---------- 商户管理(11 接口,文档 6.4.2) ----------
    Router::get('/merchant/list', [MerchantController::class, 'index']);
    Router::get('/merchant/detail', [MerchantController::class, 'detail']);
    Router::post('/merchant/property/bind', [\App\Controller\Admin\MerchantPropertyController::class, 'bind']);
    Router::get('/merchant/property/history', [\App\Controller\Admin\MerchantPropertyController::class, 'history']);
    Router::post('/merchant/add', [MerchantController::class, 'create']);
    Router::post('/merchant/update', [MerchantController::class, 'update']);
    Router::post('/merchant/audit', [MerchantController::class, 'audit']);
    Router::post('/merchant/toggle-status', [MerchantController::class, 'toggleStatus']);
    Router::post('/merchant/suspend', [MerchantController::class, 'suspend']);
    Router::post('/merchant/activate', [MerchantController::class, 'activate']);
    Router::post('/merchant/reactivate', [MerchantController::class, 'reactivate']);
    Router::get('/merchant/status-history', [MerchantController::class, 'statusHistory']);
    Router::get('/merchant/security/accounts', [\App\Controller\MerchantSecurityController::class, 'accounts']);
    Router::post('/merchant/reset-2fa', [MerchantController::class, 'resetTwoFa']);
    Router::post('/merchant/impersonate/start', [MerchantController::class, 'impersonateStart']);
    Router::post('/merchant/impersonate/end', [MerchantController::class, 'impersonateEnd']);
    // ---------- Marketplace Ranking(整改 Phase C,前缀沿用 merchant 网关零改动) ----------
    Router::get('/merchant/ranking/list', [RankingController::class, 'listings']);
    Router::get('/merchant/ranking/candidates', [RankingController::class, 'candidates']);
    Router::get('/merchant/ranking/preview', [RankingController::class, 'preview']);
    Router::post('/merchant/ranking/listing/add', [RankingController::class, 'addListing']);
    Router::post('/merchant/ranking/property-display', [RankingController::class, 'propertyDisplay']);
    Router::post('/merchant/ranking/save-order', [RankingController::class, 'saveOrder']);
    Router::post('/merchant/ranking/pin', [RankingController::class, 'pin']);
    Router::post('/merchant/ranking/publish', [RankingController::class, 'publish']);
    Router::get('/merchant/ranking/history', [RankingController::class, 'history']);
    Router::get('/merchant/ranking/destinations', [RankingController::class, 'destinations']);
    Router::post('/merchant/ranking/destination/add', [RankingController::class, 'destinationAdd']);
    Router::post('/merchant/ranking/destination/update', [RankingController::class, 'destinationUpdate']);
    Router::post('/merchant/ranking/destination/pin', [RankingController::class, 'destinationPin']);
    Router::post('/merchant/notification/send', [NotificationController::class, 'send']);
    Router::get('/merchant/notification/list', [NotificationController::class, 'list']);
    Router::get('/merchant/notification/templates', [NotificationController::class, 'templates']);
    Router::post('/merchant/commission', [MerchantController::class, 'commission']);
    Router::get('/merchant/account', [MerchantController::class, 'accounts']);
    Router::post('/merchant/account-save', [MerchantController::class, 'saveAccount']);
    // 功能模块授权(酒店/餐饮…):决定商户端 merchant-web 可见的业务菜单
    Router::get('/merchant/modules', [MerchantController::class, 'modules']);
    Router::post('/merchant/module-grant', [MerchantController::class, 'moduleGrant']);
    Router::post('/merchant/close', [MerchantController::class, 'close']);
    Router::get('/merchant/statistics', [MerchantController::class, 'statistics']);
    Router::get('/merchant/statement', [MerchantController::class, 'statement']);

    // ---------- 商户验证工作流(Super Admin Portal Phase 1,docs/redesign 模块 02/03) ----------
    Router::get('/merchant/verify/list', [VerifyController::class, 'index']);
    Router::get('/merchant/verify/queues', [VerifyController::class, 'queues']);
    Router::get('/merchant/verify/detail', [VerifyController::class, 'detail']);
    Router::post('/merchant/verify/approval-credentials', [VerifyController::class, 'approvalCredentials']);
    Router::post('/merchant/verify/approve', [VerifyController::class, 'approve']);
    Router::post('/merchant/verify/reject', [VerifyController::class, 'reject']);
    Router::post('/merchant/verify/resubmit', [VerifyController::class, 'resubmit']);
    Router::post('/merchant/verify/resubmit-received', [VerifyController::class, 'resubmitReceived']);
    Router::post('/merchant/verify/resend-code', [VerifyController::class, 'resendCode']);
    Router::post('/merchant/verify/doc-review', [VerifyController::class, 'docReview']);
    Router::get('/merchant/documents', [VerifyController::class, 'documents']);
    Router::get('/merchant/document/detail', [VerifyController::class, 'documentDetail']);
    Router::post('/merchant/document/replace', [\App\Controller\Admin\MerchantDocumentController::class, 'replace']);
    Router::post('/merchant/document/review', [\App\Controller\Admin\MerchantDocumentController::class, 'review']);
    Router::get('/merchant/document/download', [\App\Controller\Admin\MerchantDocumentController::class, 'download']);
    Router::get('/merchant/notification/channels', [NotificationController::class, 'channels']);
    Router::post('/merchant/document/resubmit', [VerifyController::class, 'documentResubmit']);
    Router::post('/merchant/blacklist', [VerifyController::class, 'blacklist']);
    Router::post('/merchant/unblacklist', [VerifyController::class, 'unblacklist']);
    Router::get('/merchant/activities', [VerifyController::class, 'activities']);
    Router::get('/merchant/activities/history', [\App\Controller\Admin\MerchantActivityController::class, 'history']);
    Router::get('/merchant/blacklist-list', [VerifyController::class, 'blacklistList']);
    Router::post('/merchant/verify/regenerate-code', [VerifyController::class, 'regenerateCode']);

    // ---------- 商户入驻流水线(Onboarding,原型 stir-long v4.2.1 / Merchant Verification) ----------
    Router::get('/merchant/onboarding/list', [OnboardingController::class, 'index']);
    Router::get('/merchant/onboarding/queues', [OnboardingController::class, 'queues']);
    Router::get('/merchant/onboarding/detail', [OnboardingController::class, 'detail']);
    Router::get('/merchant/onboarding/kyc-templates', [OnboardingController::class, 'kycTemplates']);
    Router::post('/merchant/onboarding/kyc-template-update', [OnboardingController::class, 'kycTemplateUpdate']);
    Router::post('/merchant/onboarding/add', [OnboardingController::class, 'create']);
    Router::post('/merchant/onboarding/update-stage', [OnboardingController::class, 'updateStage']);
    Router::post('/merchant/onboarding/assign-ops', [OnboardingController::class, 'assignOps']);
    Router::post('/merchant/onboarding/save-assessment', [OnboardingController::class, 'saveAssessment']);
    Router::post('/merchant/onboarding/send-kyc', [OnboardingController::class, 'sendKyc']);
    Router::post('/merchant/onboarding/send-reminder', [OnboardingController::class, 'sendReminder']);
    Router::post('/merchant/onboarding/note-add', [OnboardingController::class, 'addNote']);
    Router::post('/merchant/onboarding/confirm', [OnboardingController::class, 'confirm']);
    Router::post('/merchant/onboarding/submit-verification', [OnboardingController::class, 'submitVerification']);
    Router::post('/merchant/onboarding/kyc-upload', [OnboardingController::class, 'kycUpload']);
    Router::post('/merchant/onboarding/approve', [OnboardingController::class, 'approve']);
    Router::post('/merchant/onboarding/reject', [OnboardingController::class, 'reject']);

    // ---------- 集团管理(计划 11:管理/授权实体,商户授权绑定) ----------
    Router::get('/merchant/group/list', [GroupController::class, 'index']);
    Router::get('/merchant/group/detail', [GroupController::class, 'detail']);
    Router::post('/merchant/group/add', [GroupController::class, 'create']);
    Router::post('/merchant/group/update', [GroupController::class, 'update']);
    Router::post('/merchant/group/toggle-status', [GroupController::class, 'toggleStatus']);
    Router::post('/merchant/group/bind', [GroupController::class, 'bind']);
    Router::post('/merchant/group/unbind', [GroupController::class, 'unbind']);
    Router::post('/merchant/group/account-reset', [GroupController::class, 'accountReset']);
    Router::post('/merchant/group/delete', [GroupController::class, 'remove']);

    // ---------- 门店管理(计划 11:履约/核销单元,审核通过自动建主门店) ----------
    Router::get('/merchant/store/list', [StoreController::class, 'index']);
    Router::get('/merchant/store/detail', [StoreController::class, 'detail']);
    Router::post('/merchant/store/add', [StoreController::class, 'create']);
    Router::post('/merchant/store/update', [StoreController::class, 'update']);
    Router::post('/merchant/store/set-main', [StoreController::class, 'setMain']);
    Router::post('/merchant/store/toggle-status', [StoreController::class, 'toggleStatus']);
    Router::post('/merchant/store/account-reset', [StoreController::class, 'accountReset']);
    Router::post('/merchant/store/delete', [StoreController::class, 'remove']);

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

// ============================================================
// 平台规则与合规(Super Admin Portal 模块08)前缀 /api/v1/admin/compliance/*
// 网关 map:compliance → merchant_service
// ============================================================
Router::addGroup('/api/v1/admin/compliance', static function () {
    Router::get('/rule/list', [PlatformRuleController::class, 'rules']);
    Router::get('/rule/history', [PlatformRuleController::class, 'ruleHistory']);
    Router::post('/rule/save', [PlatformRuleController::class, 'ruleSave']);
    Router::post('/rule/publish', [PlatformRuleController::class, 'rulePublish']);
    Router::post('/rule/delete', [PlatformRuleController::class, 'ruleDelete']);
    Router::get('/violation/list', [PlatformRuleController::class, 'violations']);
    Router::post('/violation/record', [PlatformRuleController::class, 'violationRecord']);
    Router::post('/violation/handle', [PlatformRuleController::class, 'violationHandle']);
    Router::get('/warning/list', [PlatformRuleController::class, 'warnings']);
    Router::post('/warning/issue', [PlatformRuleController::class, 'warningIssue']);
    Router::post('/warning/revoke', [PlatformRuleController::class, 'warningRevoke']);
    Router::get('/history/list', [PlatformRuleController::class, 'complianceHistory']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);

// ============================================================
// 商户端(merchant-web)口径:前缀 /api/v1/merchant/*,MerchantAuthMiddleware 鉴权
// account_type(1集团/2商户/3门店)裁剪菜单与数据范围;按钮级权限由 #[Permission] 校验
// ============================================================
// 登录(组外,免鉴权)
Router::post('/api/v1/merchant/auth/login', [MerchantAuthController::class, 'login']);
Router::post('/api/v1/merchant/auth/2fa/setup', [\App\Controller\MerchantSecurityController::class, 'setup']);
Router::post('/api/v1/merchant/auth/2fa/verify', [\App\Controller\MerchantSecurityController::class, 'verify']);
Router::post('/api/v1/merchant/auth/impersonation/exchange', [\App\Controller\MerchantSecurityController::class, 'exchange']);

Router::addGroup('/api/v1/merchant', static function () {
    // ---------- 登录态 ----------
    Router::post('/auth/logout', [MerchantAuthController::class, 'logout']);
    Router::post('/auth/impersonation/end', [MerchantAuthController::class, 'logout']);
    Router::get('/auth/me', [MerchantAuthController::class, 'me']);
    Router::get('/auth/menus', [MerchantAuthController::class, 'menus']);
    Router::post('/auth/password', [MerchantAuthController::class, 'updatePassword']);

    // ---------- 子账号管理 ----------
    Router::get('/account/list', [MerchantAccountController::class, 'index']);
    Router::get('/account/quota', [MerchantAccountController::class, 'quota']);
    Router::post('/account/add', [MerchantAccountController::class, 'create']);
    Router::post('/account/update', [MerchantAccountController::class, 'update']);
    Router::post('/account/toggle-status', [MerchantAccountController::class, 'toggleStatus']);
    Router::post('/account/reset-password', [MerchantAccountController::class, 'resetPassword']);

    // ---------- 角色管理 ----------
    Router::get('/role/list', [MerchantRoleController::class, 'index']);
    Router::get('/role/menu-tree', [MerchantRoleController::class, 'menuTree']);
    Router::get('/role/menus', [MerchantRoleController::class, 'menus']);
    Router::post('/role/add', [MerchantRoleController::class, 'create']);
    Router::post('/role/update', [MerchantRoleController::class, 'update']);
    Router::post('/role/delete', [MerchantRoleController::class, 'remove']);
    Router::post('/role/assign', [MerchantRoleController::class, 'assign']);
    Router::post('/role/grant', [MerchantRoleController::class, 'grant']);
    Router::get('/role/account-roles', [MerchantRoleController::class, 'accountRoles']);

    // ---------- 门店管理 ----------
    Router::get('/store/list', [MerchantStoreController::class, 'index']);
    Router::get('/store/detail', [MerchantStoreController::class, 'detail']);
    Router::post('/store/add', [MerchantStoreController::class, 'create']);
    Router::post('/store/update', [MerchantStoreController::class, 'update']);
    Router::post('/store/set-main', [MerchantStoreController::class, 'setMain']);
    Router::post('/store/toggle-status', [MerchantStoreController::class, 'toggleStatus']);

    // ---------- 通知中心(Merchant App M6) ----------
    Router::get('/notifications/list', [MerchantNotificationController::class, 'index']);
    Router::get('/notifications/summary', [MerchantNotificationController::class, 'summary']);
    Router::get('/notifications/destination', [MerchantNotificationController::class, 'destination']);
    Router::post('/notifications/read', [MerchantNotificationController::class, 'read']);
}, [
    'middleware' => [MerchantAuthMiddleware::class, OperationLogMiddleware::class],
]);

// ============================================================
// 供应商端(supplier-web)口径:前缀 /api/v1/supplier/*,SupplierAuthMiddleware 鉴权
// 供应商为单层主体;数据范围恒为本 supplier_id;按钮级权限由 #[Permission] 校验
// ============================================================
// 登录(组外,免鉴权)
Router::post('/api/v1/supplier/auth/login', [SupplierAuthController::class, 'login']);

Router::addGroup('/api/v1/supplier', static function () {
    // ---------- 登录态 ----------
    Router::post('/auth/logout', [SupplierAuthController::class, 'logout']);
    Router::get('/auth/me', [SupplierAuthController::class, 'me']);
    Router::get('/auth/menus', [SupplierAuthController::class, 'menus']);
    Router::post('/auth/password', [SupplierAuthController::class, 'updatePassword']);

    // ---------- 子账号管理 ----------
    Router::get('/account/list', [SupplierAccountController::class, 'index']);
    Router::post('/account/add', [SupplierAccountController::class, 'create']);
    Router::post('/account/update', [SupplierAccountController::class, 'update']);
    Router::post('/account/toggle-status', [SupplierAccountController::class, 'toggleStatus']);
    Router::post('/account/reset-password', [SupplierAccountController::class, 'resetPassword']);

    // ---------- 角色管理 ----------
    Router::get('/role/list', [SupplierRoleController::class, 'index']);
    Router::get('/role/menu-tree', [SupplierRoleController::class, 'menuTree']);
    Router::get('/role/menus', [SupplierRoleController::class, 'menus']);
    Router::post('/role/add', [SupplierRoleController::class, 'create']);
    Router::post('/role/update', [SupplierRoleController::class, 'update']);
    Router::post('/role/delete', [SupplierRoleController::class, 'remove']);
    Router::post('/role/assign', [SupplierRoleController::class, 'assign']);
    Router::post('/role/grant', [SupplierRoleController::class, 'grant']);
    Router::get('/role/account-roles', [SupplierRoleController::class, 'accountRoles']);

    // ---------- 供货商品(自助维护) ----------
    Router::get('/goods/list', [SupplierGoodsController::class, 'index']);
    Router::get('/goods/detail', [SupplierGoodsController::class, 'detail']);
    Router::post('/goods/add', [SupplierGoodsController::class, 'create']);
    Router::post('/goods/update', [SupplierGoodsController::class, 'update']);
    Router::post('/goods/toggle-status', [SupplierGoodsController::class, 'toggleStatus']);
    Router::post('/goods/delete', [SupplierGoodsController::class, 'remove']);

    // ---------- 对账结算(只读) ----------
    Router::get('/settle/list', [SupplierSettleController::class, 'index']);
    Router::get('/settle/detail', [SupplierSettleController::class, 'detail']);
}, [
    'middleware' => [SupplierAuthMiddleware::class, OperationLogMiddleware::class],
]);
