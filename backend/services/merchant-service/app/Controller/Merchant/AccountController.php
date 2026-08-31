<?php

declare(strict_types=1);

namespace App\Controller\Merchant;

use App\Controller\AbstractController;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\MerchantContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Support\MaskHelper;
use Mtrip\Shared\Support\Result;

/**
 * 商户端子账号管理:主账号(is_owner=1)自助维护同主体下的子账号
 * 数据范围:集团→本集团账号;商户→本商户账号;门店→本门店账号(均限本 account_type)
 */
class AccountController extends AbstractController
{
    /** 子账号列表 */
    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = $this->scopedQuery();
        if (($name = $this->strInput('keyword')) !== '') {
            $query->where(function (Builder $q) use ($name) {
                $q->where('username', 'like', "%{$name}%")->orWhere('real_name', 'like', "%{$name}%");
            });
        }
        $status = $this->input('status');
        if ($status !== null && $status !== '') {
            $query->where('status', (int) $status);
        }
        $total = (clone $query)->count();
        $list = $query->orderByDesc('id')->forPage($page, $pageSize)->get()
            ->map(function ($row) {
                $row = (array) $row;
                return [
                    'id' => (int) $row['id'],
                    'username' => $row['username'],
                    'realName' => $row['real_name'],
                    'mobile' => MaskHelper::mobile($this->decryptField((string) $row['mobile'])),
                    'isOwner' => (int) $row['is_owner'] === 1,
                    'status' => (int) $row['status'],
                    'lastLoginAt' => (string) $row['last_login_at'],
                    'createdAt' => (string) $row['created_at'],
                ];
            })->all();
        return Result::page($list, $total, $page, $pageSize);
    }

    /** 子账号配额(管理端在商户/集团上配置,默认 3;主账号不占额) */
    public function quota(): array
    {
        return Result::success($this->quotaInfo());
    }

    /** 新增子账号(is_owner=0,与主账号同主体、同 account_type) */
    #[Permission('mch:account:add')]
    public function create(): array
    {
        $quota = $this->quotaInfo();
        if ($quota['remaining'] <= 0) {
            throw new BusinessException(
                ErrorCode::DATA_CONFLICT,
                "子账号数量已达上限({$quota['limit']}个),如需增加请联系平台"
            );
        }
        $username = $this->requireStr('username');
        if (Db::table('merchant_admin')->where('username', $username)->exists()) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '登录账号已存在');
        }
        $password = $this->requireStr('password');
        if (strlen($password) < 8 || ! preg_match('/[A-Za-z]/', $password) || ! preg_match('/\d/', $password)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码至少8位且需包含字母和数字');
        }
        $data = [
            'site_id' => MerchantContext::siteId(),
            'account_type' => MerchantContext::accountType(),
            'merchant_id' => MerchantContext::merchantId(),
            'group_id' => MerchantContext::groupId(),
            'store_id' => MerchantContext::storeId(),
            'username' => $username,
            'password' => password_hash($password, PASSWORD_BCRYPT),
            'real_name' => $this->strInput('realName'),
            'mobile' => $this->encryptField($this->strInput('mobile')),
            'is_owner' => 0,
            'status' => 1,
        ];
        $id = Db::transaction(function () use ($data) {
            $id = (int) Db::table('merchant_admin')->insertGetId($data);
            \App\Service\MerchantActivityService::changed($id, 'created', $this->clientIp());
            return $id;
        });
        return Result::success(['id' => $id], '子账号创建成功');
    }

    /** 编辑子账号(姓名/手机号) */
    #[Permission('mch:account:edit')]
    public function update(): array
    {
        $account = $this->findScopedAccount($this->requireId());
        $data = [];
        if (($name = $this->strInput('realName')) !== '') {
            $data['real_name'] = $name;
        }
        if (($mobile = $this->strInput('mobile')) !== '') {
            $data['mobile'] = $this->encryptField($mobile);
        }
        if ($data !== []) {
            Db::transaction(function () use ($account, $data) {
                Db::table('merchant_admin')->where('id', $account['id'])->update($data);
                \App\Service\MerchantActivityService::changed((int) $account['id'], 'profile_updated', $this->clientIp());
            });
        }
        return Result::success(null, '子账号更新成功');
    }

    /** 启用/禁用子账号(主账号不可禁用) */
    #[Permission('mch:account:status')]
    public function toggleStatus(): array
    {
        $account = $this->findScopedAccount($this->requireId());
        if ((int) $account['is_owner'] === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '主账号不可停用');
        }
        $next = (int) $account['status'] === 1 ? 2 : 1;
        Db::transaction(function () use ($account, $next) {
            Db::table('merchant_admin')->where('id', $account['id'])->update(['status' => $next, 'auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'pending_secret_enc' => '']);
            \App\Service\MerchantActivityService::changed((int) $account['id'], $next === 1 ? 'enabled' : 'disabled', $this->clientIp());
        });
        return Result::success(['status' => $next], $next === 1 ? '账号已启用' : '账号已禁用');
    }

    /** 重置子账号密码 */
    #[Permission('mch:account:reset-pwd')]
    public function resetPassword(): array
    {
        $account = $this->findScopedAccount($this->requireId());
        $password = $this->requireStr('password');
        if (strlen($password) < 8 || ! preg_match('/[A-Za-z]/', $password) || ! preg_match('/\d/', $password)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '密码至少8位且需包含字母和数字');
        }
        Db::transaction(function () use ($account, $password) {
            Db::table('merchant_admin')->where('id', $account['id'])->update(['password' => password_hash($password, PASSWORD_BCRYPT), 'auth_version' => Db::raw('auth_version + 1'), 'challenge_hash' => null, 'pending_secret_enc' => '']);
            \App\Service\MerchantActivityService::changed((int) $account['id'], 'password_reset', $this->clientIp());
        });
        return Result::success(null, '密码已重置');
    }

    /**
     * 子账号配额:上限取所属主体的 sub_account_limit(集团→merchant_group,商户/门店→merchant_info),
     * 已用只数 is_owner=0 的同主体账号(主账号不占额)。主体行缺失时回落到默认 3。
     */
    private function quotaInfo(): array
    {
        $raw = MerchantContext::accountType() === 1
            ? Db::table('merchant_group')->where('id', MerchantContext::groupId())->value('sub_account_limit')
            : Db::table('merchant_info')->where('id', MerchantContext::merchantId())->value('sub_account_limit');
        $limit = $raw === null ? 3 : max(0, (int) $raw);
        $used = $this->scopedQuery()->where('is_owner', 0)->count();
        return ['limit' => $limit, 'used' => $used, 'remaining' => max(0, $limit - $used)];
    }

    /** 同主体、同 account_type 的账号查询 */
    private function scopedQuery(): Builder
    {
        $query = Db::table('merchant_admin')->whereNull('deleted_at')
            ->where('account_type', MerchantContext::accountType());
        return match (MerchantContext::accountType()) {
            1 => $query->where('group_id', MerchantContext::groupId()),
            3 => $query->where('store_id', MerchantContext::storeId()),
            default => $query->where('merchant_id', MerchantContext::merchantId()),
        };
    }

    /** 取子账号并校验属于当前主体 */
    private function findScopedAccount(int $id): array
    {
        $account = (clone $this->scopedQuery())->where('id', $id)->first();
        if (! $account) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '账号不存在或无权操作');
        }
        return (array) $account;
    }
}
