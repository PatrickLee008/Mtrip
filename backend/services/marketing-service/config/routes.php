<?php

declare(strict_types=1);

/**
 * marketing-service 路由总表(管理端 /api/v1/admin/marketing/*)
 * 活动/Banner/积分商城归后续迭代;本期落地优惠券模板 + 领券记录
 */

use App\Controller\AffiliateController;
use App\Controller\CampaignController;
use App\Controller\PromotionController;
use App\Controller\CouponController;
use App\Controller\LongstayController;
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
    Router::get('/campaigns', [MarketingController::class, 'campaigns']);
    Router::get('/campaign/detail', [MarketingController::class, 'campaignDetail']);
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
    // 长住折扣梯度(PRD 模块2.1)
    Router::get('/longstay/list', [LongstayController::class, 'index']);
    Router::post('/longstay/save', [LongstayController::class, 'save']);
    Router::post('/longstay/delete', [LongstayController::class, 'delete']);
    // 促销中心活动(PRD 模块6.1)
    Router::get('/campaign/list', [CampaignController::class, 'index']);
    Router::post('/campaign/save', [CampaignController::class, 'save']);
    Router::post('/campaign/toggle-status', [CampaignController::class, 'toggleStatus']);
    Router::post('/campaign/delete', [CampaignController::class, 'remove']);
    // 促销独立实体(Super Admin Portal 模块05):代金券/促销码/新客奖励
    Router::get('/voucher/list', [PromotionController::class, 'vouchers']);
    Router::post('/voucher/save', [PromotionController::class, 'voucherSave']);
    Router::post('/voucher/delete', [PromotionController::class, 'voucherDelete']);
    Router::get('/promo-code/list', [PromotionController::class, 'codes']);
    Router::post('/promo-code/save', [PromotionController::class, 'codeSave']);
    Router::post('/promo-code/delete', [PromotionController::class, 'codeDelete']);
    Router::get('/welcome/list', [PromotionController::class, 'welcomes']);
    Router::post('/welcome/save', [PromotionController::class, 'welcomeSave']);
    Router::post('/welcome/delete', [PromotionController::class, 'welcomeDelete']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);

// ============================================================
// 带货达人与联盟(Super Admin Portal Phase 2)前缀 /api/v1/admin/affiliate/*
// 网关 map:affiliate → marketing_service(deploy/openresty/conf.d/mtrip.conf)
// ============================================================
Router::addGroup('/api/v1/admin/affiliate', static function () {
    // 申请审核
    Router::get('/application/list', [AffiliateController::class, 'applications']);
    Router::post('/application/approve', [AffiliateController::class, 'applicationApprove']);
    Router::post('/application/reject', [AffiliateController::class, 'applicationReject']);
    // 合作方名录
    Router::get('/partner/list', [AffiliateController::class, 'partners']);
    Router::post('/partner/toggle-status', [AffiliateController::class, 'partnerToggle']);
    // 联盟计划
    Router::get('/program', [AffiliateController::class, 'program']);
    Router::post('/program/save', [AffiliateController::class, 'programSave']);
    // 联盟折扣码
    Router::get('/code/list', [AffiliateController::class, 'codes']);
    Router::post('/code/save', [AffiliateController::class, 'codeSave']);
    Router::post('/code/delete', [AffiliateController::class, 'codeDelete']);
    // 奖励钱包
    Router::get('/wallet/commission-log', [AffiliateController::class, 'commissionLog']);
    Router::get('/wallet/withdraw-list', [AffiliateController::class, 'withdraws']);
    Router::post('/wallet/withdraw-pay', [AffiliateController::class, 'withdrawPay']);
    Router::post('/wallet/adjust', [AffiliateController::class, 'walletAdjust']);
    // 反欺诈
    Router::get('/fraud/list', [AffiliateController::class, 'fraudCases']);
    Router::post('/fraud/handle', [AffiliateController::class, 'fraudHandle']);
}, [
    'middleware' => [AdminAuthMiddleware::class, OperationLogMiddleware::class],
]);
