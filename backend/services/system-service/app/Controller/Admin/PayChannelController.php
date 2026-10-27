<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Controller\AbstractController;

use App\Model\SysPayAccount;
use App\Model\SysPayChannel;
use App\Service\PayAccountService;
use App\Support\SecretField;
use Hyperf\Di\Annotation\Inject;
use Mtrip\Shared\Annotation\Permission;
use Mtrip\Shared\Constants\ErrorCode;
use Mtrip\Shared\Context\AdminContext;
use Mtrip\Shared\Exception\BusinessException;
use Mtrip\Shared\Model\BaseModel;
use Mtrip\Shared\Support\Result;

/**
 * 模块8 支付渠道配置:Stripe/PayPal/KBZPay MMQR 分站点配置,密钥AES加密、批量复制到其他站点
 * kbz_mmqr 不存密钥,通过 account_id 绑定收款账户(sys_pay_account),同一账户可被多个站点绑定(方案22 §5)
 */
class PayChannelController extends AbstractController
{
    private const CHANNELS = ['stripe', 'paypal', PayAccountService::CHANNEL_KBZ_MMQR];

    private const CHANNEL_NAMES = ['stripe' => 'Stripe', 'paypal' => 'PayPal', 'kbz_mmqr' => 'KBZPay MMQR'];

    /** MMQR 只接受缅币 */
    private const KBZ_CURRENCIES = ['MMK'];

    #[Inject]
    protected PayAccountService $payAccountService;

    public function index(): array
    {
        [$page, $pageSize] = $this->pageParams();
        $query = (new SysPayChannel())->newSiteQuery($this->intInput('siteId') ?: null);
        if (($channelCode = $this->strInput('channelCode')) !== '') {
            $query->where('sys_pay_channel.channel_code', $channelCode);
        }
        if (($status = $this->intInput('status')) > 0) {
            $query->where('sys_pay_channel.status', $status);
        }
        $total = (clone $query)->count();
        // 收款账户软删后仍 join 出名称便于排查(正常流程有绑定的账户不可删)
        $list = $query->leftJoin('sys_pay_account as pa', 'pa.id', '=', 'sys_pay_channel.account_id')
            ->select(['sys_pay_channel.*', 'pa.account_name', 'pa.mode as account_mode'])
            ->orderBy('sys_pay_channel.sort')->orderByDesc('sys_pay_channel.id')
            ->forPage($page, $pageSize)->get()
            ->map(static function (SysPayChannel $channel) {
                $row = $channel->toArray();
                $row['api_key'] = SecretField::mask((string) $channel->api_key);
                $row['account_id'] = $channel->account_id === null ? null : (int) $channel->account_id;
                $row['sub_merch_code'] = (string) $channel->sub_merch_code;
                $row['sub_app_id'] = (string) $channel->sub_app_id;
                $row['sort'] = (int) $channel->sort;
                $row['account_name'] = (string) $channel->account_name;
                $row['account_mode'] = $channel->account_mode === null ? null : (int) $channel->account_mode;
                return $row;
            })->toArray();
        return Result::page($list, $total, $page, $pageSize);
    }

    #[Permission('config:pay:add')]
    public function create(): array
    {
        $channel = new SysPayChannel();
        $channel->site_id = AdminContext::isSuper() ? $this->intInput('siteId') : AdminContext::siteId();
        $this->fill($channel);
        $channel->save();
        return Result::success(['id' => (int) $channel->id], '支付渠道创建成功');
    }

    #[Permission('config:pay:edit')]
    public function update(): array
    {
        $channel = $this->findScoped($this->requireId());
        $this->fill($channel);
        $channel->save();
        return Result::success(null, '支付渠道更新成功');
    }

    #[Permission('config:pay:delete')]
    public function delete(): array
    {
        $channel = $this->findScoped($this->requireId());
        if ($channel->status === 1) {
            throw new BusinessException(ErrorCode::DATA_CONFLICT, '渠道启用中,请先停用再删除');
        }
        $channel->delete();
        return Result::success(null, '支付渠道已删除');
    }

    #[Permission('config:pay:status')]
    public function toggleStatus(): array
    {
        $channel = $this->findScoped($this->requireId());
        $channel->status = $channel->status === 1 ? 2 : 1;
        $channel->save();
        return Result::success(['status' => $channel->status], $channel->status === 1 ? '已启用' : '已停用');
    }

    /** 批量复制渠道配置到其他站点(含密钥密文),已存在同渠道的站点跳过 */
    #[Permission('config:pay:add')]
    public function copy(): array
    {
        if (! AdminContext::isSuper()) {
            throw new BusinessException(ErrorCode::FORBIDDEN, '仅超级管理员可跨站点复制');
        }
        $channel = $this->findScoped($this->requireId());
        $siteIds = $this->input('siteIds');
        if (! is_array($siteIds) || $siteIds === []) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 siteIds 不能为空');
        }
        $copied = [];
        $skipped = [];
        foreach (array_unique(array_map('intval', $siteIds)) as $siteId) {
            if ($siteId === (int) $channel->site_id) {
                continue;
            }
            $exists = SysPayChannel::query()->where('site_id', $siteId)
                ->where('channel_code', $channel->channel_code)->exists();
            if ($exists) {
                $skipped[] = $siteId;
                continue;
            }
            $clone = $channel->replicate();
            $clone->site_id = $siteId;
            $clone->save();
            $copied[] = $siteId;
        }
        return Result::success(['copied' => $copied, 'skipped' => $skipped], '渠道复制完成');
    }

    private function fill(SysPayChannel $channel): void
    {
        $code = $this->strInput('channelCode', (string) ($channel->channel_code ?? ''));
        if (! in_array($code, self::CHANNELS, true)) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '支付渠道仅支持 stripe/paypal/kbz_mmqr');
        }
        $isKbz = $code === PayAccountService::CHANNEL_KBZ_MMQR;
        $channel->channel_code = $code;
        $channel->channel_name = $this->strInput('channelName', (string) ($channel->channel_name ?? (self::CHANNEL_NAMES[$code] ?? ucfirst($code))));
        $channel->sort = $this->intInput('sort', (int) ($channel->sort ?? 0));
        if ($isKbz) {
            $this->fillKbz($channel);
        } else {
            // Stripe/PayPal 行为不变,不使用账户绑定
            $channel->account_id = null;
            $channel->sub_merch_code = '';
            $channel->sub_app_id = '';
        }
        // kbz_mmqr 凭据在收款账户上,渠道行不存 api_key
        $channel->api_key = $isKbz ? '' : SecretField::keep($this->strInput('apiKey'), (string) $channel->api_key);
        $channel->merchant_no = $this->strInput('merchantNo', (string) $channel->merchant_no);
        $channel->webhook_url = $this->strInput('webhookUrl', (string) $channel->webhook_url);
        $channel->fee_rate = BaseModel::money((string) $this->input('feeRate', (string) ($channel->fee_rate ?? '0')));
        $channel->min_amount = BaseModel::money((string) $this->input('minAmount', (string) ($channel->min_amount ?? '0')));
        $channel->max_amount = BaseModel::money((string) $this->input('maxAmount', (string) ($channel->max_amount ?? '0')));
        $currencies = $this->input('currencies');
        if ($isKbz) {
            if (is_array($currencies) && $currencies !== []
                && array_values(array_unique(array_map('strtoupper', array_map('strval', $currencies)))) !== self::KBZ_CURRENCIES) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'KBZPay MMQR 仅支持 MMK 币种');
            }
            $channel->currencies = self::KBZ_CURRENCIES;
        } elseif (is_array($currencies)) {
            $channel->currencies = array_values(array_map('strtoupper', array_map('strval', $currencies)));
        }
        $channel->split_enabled = $this->intInput('splitEnabled', (int) $channel->split_enabled) === 1 ? 1 : 0;
        $channel->remark = $this->strInput('remark', (string) $channel->remark);
    }

    /**
     * kbz_mmqr:必须绑定调用者可用的启用账户;服务商模式子商户号/子 AppId 必填,直连模式清空
     */
    private function fillKbz(SysPayChannel $channel): void
    {
        $accountId = $this->intInput('accountId', (int) ($channel->account_id ?? 0));
        if ($accountId <= 0) {
            throw new BusinessException(ErrorCode::PARAM_ERROR, '参数 accountId 不能为空');
        }
        $account = $this->payAccountService->findBindable($accountId);
        $channel->account_id = (int) $account->id;
        if ((int) $account->mode === SysPayAccount::MODE_ISV) {
            $subMerchCode = $this->strInput('subMerchCode', (string) ($channel->sub_merch_code ?? ''));
            $subAppId = $this->strInput('subAppId', (string) ($channel->sub_app_id ?? ''));
            if ($subMerchCode === '' || $subAppId === '') {
                throw new BusinessException(ErrorCode::PARAM_ERROR, '服务商模式账户须填写 subMerchCode 与 subAppId');
            }
            if (mb_strlen($subMerchCode) > 64 || mb_strlen($subAppId) > 64) {
                throw new BusinessException(ErrorCode::PARAM_ERROR, 'subMerchCode / subAppId 不能超过 64 个字符');
            }
            $channel->sub_merch_code = $subMerchCode;
            $channel->sub_app_id = $subAppId;
        } else {
            $channel->sub_merch_code = '';
            $channel->sub_app_id = '';
        }
    }

    private function findScoped(int $id): SysPayChannel
    {
        /** @var SysPayChannel|null $channel */
        $channel = SysPayChannel::query()->find($id);
        if ($channel === null) {
            throw new BusinessException(ErrorCode::NOT_FOUND, '支付渠道不存在');
        }
        if (! AdminContext::isSuper() && (int) $channel->site_id !== AdminContext::siteId()) {
            throw new BusinessException(ErrorCode::NO_DATA_PERMISSION);
        }
        return $channel;
    }
}
